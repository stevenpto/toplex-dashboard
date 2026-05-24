import os
import re
import time
import asyncio
from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import httpx

load_dotenv()

PLEX_BASE_URL: str = os.getenv("PLEX_BASE_URL", "")
PLEX_TOKEN: str = os.getenv("PLEX_TOKEN", "")

_cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173")
CORS_ORIGINS: list[str] = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

app = FastAPI(title="Plex Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory cache: { key: (data, timestamp) }
# ---------------------------------------------------------------------------
_cache: dict = {}
CACHE_TTL = 60  # seconds


def _cache_get(key: str):
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _cache_set(key: str, data) -> None:
    _cache[key] = (data, time.time())


# ---------------------------------------------------------------------------
# Plex helpers (blocking – run via asyncio.to_thread)
# ---------------------------------------------------------------------------

def _get_plex():
    from plexapi.server import PlexServer  # noqa: PLC0415

    if not PLEX_BASE_URL or not PLEX_TOKEN:
        raise RuntimeError("PLEX_BASE_URL and PLEX_TOKEN must be set in .env")
    return PlexServer(PLEX_BASE_URL, PLEX_TOKEN)


HISTORY_DAYS = 30
_HISTORY_CACHE_KEY = "all_history"


def _fetch_all_history() -> list:
    """Fetch movie-only history for ALL users, limited to the last 30 days.

    Results are stored in the shared cache so every endpoint reuses the same
    fetch instead of hitting Plex independently.
    """
    cached = _cache_get(_HISTORY_CACHE_KEY)
    if cached is not None:
        return cached

    plex = _get_plex()
    mindate = datetime.now() - timedelta(days=HISTORY_DAYS)

    try:
        raw = plex.history(mindate=mindate)
    except Exception:
        raw = []

    # Keep only movie items (type == 'movie')
    history = [item for item in raw if getattr(item, "type", None) == "movie"]

    _cache_set(_HISTORY_CACHE_KEY, history)
    return history


def _fetch_users() -> list:
    """Derive users from watch history so IDs always match history accountIDs."""
    plex = _get_plex()

    # Build a name lookup from systemAccounts
    name_map: dict = {}
    try:
        for acc in plex.systemAccounts():
            if acc.id > 0:
                name_map[str(acc.id)] = acc.name or f"User {acc.id}"
    except Exception:
        pass

    # Collect unique account IDs that appear in movie history
    history = _fetch_all_history()
    seen: dict = {}
    for item in history:
        aid = str(item.accountID)
        if aid not in seen and item.accountID > 0:
            seen[aid] = name_map.get(aid, f"User {aid}")

    return [{"id": aid, "name": name} for aid, name in seen.items()]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/users")
async def get_users():
    cached = _cache_get("users")
    if cached is not None:
        return cached
    try:
        result = await asyncio.to_thread(_fetch_users)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set("users", result)
    return result


@app.get("/users/{user_id}/recent")
async def get_recent(user_id: str, limit: int = 4):
    # History is already cached by _fetch_all_history; no extra cache key needed
    def _fetch() -> list:
        history = _fetch_all_history()
        user_history = [h for h in history if str(h.accountID) == user_id]
        user_history.sort(key=lambda x: x.viewedAt, reverse=True)
        return [
            {
                "movie_id": str(item.ratingKey),
                "title": item.title,
                "viewed_at": item.viewedAt.isoformat(),
                "poster_path": item.thumb,
            }
            for item in user_history[:limit]
        ]

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return result


@app.get("/analytics/top-movies")
async def get_top_movies(
    time_range: str = Query(default="7d", alias="range"),
    limit: int = 4,
):
    def _fetch() -> list:
        # History is already limited to 30 days; optionally narrow further
        days = int(re.sub(r"[^0-9]", "", time_range) or "7")
        cutoff = datetime.now() - timedelta(days=days)
        history = _fetch_all_history()
        filtered = [h for h in history if h.viewedAt >= cutoff]
        counts: dict = {}
        for item in filtered:
            mid = str(item.ratingKey)
            if mid not in counts:
                counts[mid] = {
                    "movie_id": mid,
                    "title": item.title,
                    "poster_path": item.thumb,
                    "art_path": None,  # filled in below for top item
                    "count": 0,
                }
            counts[mid]["count"] += 1

        ranked = sorted(counts.values(), key=lambda x: x["count"], reverse=True)[:limit]

        # Fetch full metadata for the #1 movie to get the backdrop art
        if ranked:
            plex = _get_plex()
            try:
                top_item = plex.fetchItem(int(ranked[0]["movie_id"]))
                ranked[0]["art_path"] = getattr(top_item, "art", None)
            except Exception:
                pass

        return ranked

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return result


@app.get("/analytics/recently-added")
async def get_recently_added(limit: int = 4):
    cache_key = f"recently_added:{limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    def _fetch() -> list:
        plex = _get_plex()
        movies = []
        for section in plex.library.sections():
            if section.type == "movie":
                try:
                    for movie in section.recentlyAdded(maxresults=limit):
                        movies.append({
                            "movie_id": str(movie.ratingKey),
                            "title": movie.title,
                            "poster_path": getattr(movie, "thumb", None),
                            "added_at": getattr(movie, "addedAt", None).isoformat() if getattr(movie, "addedAt", None) else None,
                            "year": getattr(movie, "year", None),
                        })
                except Exception:
                    pass
        movies.sort(key=lambda x: x["added_at"] or "", reverse=True)
        return movies[:limit]

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(cache_key, result)
    return result


@app.get("/analytics/stats")
async def get_stats():
    cached = _cache_get("stats")
    if cached is not None:
        return cached

    def _fetch() -> dict:
        plex = _get_plex()
        now = datetime.now()
        year_start = datetime(now.year, 1, 1)

        # Year-to-date movie history (separate from the 30-day cache)
        try:
            ytd_raw = plex.history(mindate=year_start)
        except Exception:
            ytd_raw = []
        ytd = [h for h in ytd_raw if getattr(h, "type", None) == "movie"]

        total_watches = len(ytd)

        # Build ratingKey → duration (ms) from the movie library sections
        # History items don't carry duration; library items do.
        duration_map: dict = {}
        for section in plex.library.sections():
            if section.type == "movie":
                try:
                    for m in section.all():
                        dur = getattr(m, "duration", None)
                        if dur:
                            duration_map[str(m.ratingKey)] = dur
                except Exception:
                    pass

        total_ms = sum(duration_map.get(str(h.ratingKey), 0) for h in ytd)
        total_hours = round(total_ms / (1000 * 60 * 60))

        # Active users this year
        active_users = len({str(h.accountID) for h in ytd if h.accountID > 0})

        # Films added to library this year — reuse the duration_map scan above
        films_added = 0
        for section in plex.library.sections():
            if section.type == "movie":
                try:
                    all_movies = section.all()
                    films_added += sum(
                        1 for m in all_movies
                        if getattr(m, "addedAt", None) and m.addedAt >= year_start
                    )
                except Exception:
                    pass

        return {
            "films_added_this_year": films_added,
            "total_watches_this_year": total_watches,
            "total_hours_watched": total_hours,
            "active_users": active_users,
        }

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set("stats", result)
    return result


@app.get("/analytics/activity")
async def get_activity(limit: int = 10):
    cached = _cache_get(f"activity:{limit}")
    if cached is not None:
        return cached

    def _fetch() -> list:
        plex = _get_plex()

        # --- Name lookup ---
        name_map: dict = {}
        try:
            for acc in plex.systemAccounts():
                if acc.id > 0:
                    name_map[str(acc.id)] = acc.name or f"User {acc.id}"
        except Exception:
            pass

        events: list = []

        # --- Watch events: last 30 days history ---
        history = _fetch_all_history()
        for item in history:
            user = name_map.get(str(item.accountID), f"User {item.accountID}")
            events.append({
                "type": "watch",
                "title": item.title,
                "user_name": user,
                "poster_path": item.thumb,
                "timestamp": item.viewedAt.isoformat(),
            })

        # --- Added events: recently added movies ---
        for section in plex.library.sections():
            if section.type == "movie":
                try:
                    for movie in section.recentlyAdded(maxresults=30):
                        added_at = getattr(movie, "addedAt", None)
                        if added_at:
                            events.append({
                                "type": "added",
                                "title": movie.title,
                                "user_name": None,
                                "poster_path": getattr(movie, "thumb", None),
                                "timestamp": added_at.isoformat(),
                            })
                except Exception:
                    pass

        # Sort all events newest first, take top N
        events.sort(key=lambda x: x["timestamp"], reverse=True)
        return events[:limit]

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(f"activity:{limit}", result)
    return result


@app.get("/analytics/charts")
async def get_charts():
    cached = _cache_get("charts")
    if cached is not None:
        return cached

    def _fetch():
        from plexapi.server import PlexServer  # noqa: PLC0415

        plex = _get_plex()
        now = datetime.now()
        year_start = datetime(now.year, 1, 1)

        try:
            raw = plex.history(mindate=year_start)
        except Exception:
            raw = []

        history = [h for h in raw if getattr(h, "type", None) == "movie"]

        # ---- weekly counts (ISO week 1-52) ----
        weekly_map: dict = {}
        by_day_map: dict = {i: 0 for i in range(7)}  # Mon=0 … Sun=6

        for item in history:
            d = item.viewedAt
            iso_week = d.isocalendar()[1]
            weekly_map[iso_week] = weekly_map.get(iso_week, 0) + 1
            by_day_map[d.weekday()] += 1

        # Build full 52-week array
        weeks = [{"week": w, "count": weekly_map.get(w, 0)} for w in range(1, 53)]

        # ---- summary stats ----
        films_logged = len(history)
        months_elapsed = max(1, now.month)
        weeks_elapsed = max(1, (now - year_start).days // 7)
        avg_per_month = round(films_logged / months_elapsed, 1)
        avg_per_week = round(films_logged / weeks_elapsed, 1)

        # ---- day-of-week breakdown ----
        day_labels = ["M", "T", "W", "T", "F", "S", "S"]
        by_day = [{"label": day_labels[i], "count": by_day_map[i]} for i in range(7)]

        return {
            "weekly": weeks,
            "stats": {
                "films_logged": films_logged,
                "avg_per_month": avg_per_month,
                "avg_per_week": avg_per_week,
            },
            "by_day": by_day,
        }

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set("charts", result)
    return result


@app.get("/movie/info")
async def get_movie_info(movie_id: str = Query(..., min_length=1)):
    """Return full movie metadata from Plex using the ratingKey."""
    cache_key = f"movie_info:{movie_id}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    def _fetch():
        plex = _get_plex()
        m = plex.fetchItem(int(movie_id))

        # Duration: ms → "Xh Ym"
        duration_str = ""
        dur_ms = getattr(m, "duration", None)
        if dur_ms:
            total_secs = dur_ms // 1000
            h, rem = divmod(total_secs, 3600)
            mins = rem // 60
            duration_str = f"{h}h {mins}m" if h else f"{mins}m"

        genres = [g.tag for g in (getattr(m, "genres", None) or [])]
        directors = [d.tag for d in (getattr(m, "directors", None) or [])[:3]]
        actors = [r.tag for r in (getattr(m, "roles", None) or [])[:6]]

        return {
            "title": m.title,
            "year": str(m.year) if m.year else None,
            "poster": getattr(m, "thumb", None),
            "description": getattr(m, "summary", None),
            "genre": genres,
            "duration": duration_str,
            "rating": getattr(m, "rating", None),
            "rating_count": None,
            "content_rating": getattr(m, "contentRating", None),
            "keywords": "",
            "actors": actors,
            "directors": directors,
            "imdb_url": None,
        }

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Movie info failed: {exc}")

    _cache_set(cache_key, result)
    return result


# ---------------------------------------------------------------------------
# TV helpers (blocking – run via asyncio.to_thread)
# ---------------------------------------------------------------------------

_TV_HISTORY_CACHE_KEY = "all_tv_history"


def _fetch_all_tv_history() -> list:
    """Fetch episode-only history for ALL users, limited to the last 30 days."""
    cached = _cache_get(_TV_HISTORY_CACHE_KEY)
    if cached is not None:
        return cached

    plex = _get_plex()
    mindate = datetime.now() - timedelta(days=HISTORY_DAYS)

    try:
        raw = plex.history(mindate=mindate)
    except Exception:
        raw = []

    history = [item for item in raw if getattr(item, "type", None) == "episode"]
    _cache_set(_TV_HISTORY_CACHE_KEY, history)
    return history


def _fetch_tv_users() -> list:
    """Derive users from TV watch history."""
    plex = _get_plex()

    name_map: dict = {}
    try:
        for acc in plex.systemAccounts():
            if acc.id > 0:
                name_map[str(acc.id)] = acc.name or f"User {acc.id}"
    except Exception:
        pass

    history = _fetch_all_tv_history()
    seen: dict = {}
    for item in history:
        aid = str(item.accountID)
        if aid not in seen and item.accountID > 0:
            seen[aid] = name_map.get(aid, f"User {aid}")

    return [{"id": aid, "name": name} for aid, name in seen.items()]


# ---------------------------------------------------------------------------
# TV Endpoints
# ---------------------------------------------------------------------------

@app.get("/tv/users")
async def get_tv_users():
    cached = _cache_get("tv_users")
    if cached is not None:
        return cached
    try:
        result = await asyncio.to_thread(_fetch_tv_users)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set("tv_users", result)
    return result


@app.get("/tv/users/{user_id}/recent")
async def get_tv_recent(user_id: str, limit: int = 4):
    def _fetch() -> list:
        history = _fetch_all_tv_history()
        user_history = [h for h in history if str(h.accountID) == user_id]
        user_history.sort(key=lambda x: x.viewedAt, reverse=True)

        # Deduplicate by show, keep most recent episode per show.
        # Use grandparentTitle as the dedup key — grandparentRatingKey may be 0
        # or absent for unmatched items, causing every episode to be treated as unique.
        seen_shows: dict = {}
        for item in user_history:
            dedup_key = getattr(item, "grandparentTitle", None) or str(item.ratingKey)
            if dedup_key not in seen_shows:
                gp_key = getattr(item, "grandparentRatingKey", None)
                show_id = str(gp_key) if gp_key else ""
                seen_shows[dedup_key] = {
                    "show_id": show_id,
                    "title": getattr(item, "grandparentTitle", item.title),
                    "viewed_at": item.viewedAt.isoformat(),
                    "poster_path": getattr(item, "grandparentThumb", item.thumb),
                }
            if len(seen_shows) >= limit:
                break

        return list(seen_shows.values())

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return result


@app.get("/tv/analytics/top-shows")
async def get_top_shows(
    time_range: str = Query(default="30d", alias="range"),
    limit: int = 6,
):
    def _fetch() -> list:
        days = int(re.sub(r"[^0-9]", "", time_range) or "7")
        cutoff = datetime.now() - timedelta(days=days)
        history = _fetch_all_tv_history()
        filtered = [h for h in history if h.viewedAt >= cutoff]

        # Use grandparentTitle as dedup key — grandparentRatingKey may be 0/absent.
        counts: dict = {}
        for item in filtered:
            dedup_key = getattr(item, "grandparentTitle", None) or str(item.ratingKey)
            if dedup_key not in counts:
                gp_key = getattr(item, "grandparentRatingKey", None)
                show_id = str(gp_key) if gp_key else ""
                # grandparentArt is available directly on history items
                gp_art = getattr(item, "grandparentArt", None) or getattr(item, "art", None)
                counts[dedup_key] = {
                    "show_id": show_id,
                    "title": getattr(item, "grandparentTitle", item.title),
                    "poster_path": getattr(item, "grandparentThumb", item.thumb),
                    "art_path": gp_art,
                    "count": 0,
                }
            counts[dedup_key]["count"] += 1

        ranked = sorted(counts.values(), key=lambda x: x["count"], reverse=True)[:limit]

        # If art_path still missing, try fetching full show metadata via show_id
        if ranked and not ranked[0].get("art_path") and ranked[0].get("show_id"):
            plex = _get_plex()
            try:
                top_item = plex.fetchItem(int(ranked[0]["show_id"]))
                ranked[0]["art_path"] = getattr(top_item, "art", None)
            except Exception:
                pass

        return ranked

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return result


@app.get("/tv/analytics/recently-added")
async def get_tv_recently_added(limit: int = 4):
    cache_key = f"tv_recently_added:{limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    def _fetch() -> list:
        plex = _get_plex()
        shows = []
        for section in plex.library.sections():
            if section.type == "show":
                try:
                    for show in section.recentlyAdded(maxresults=limit):
                        shows.append({
                            "show_id": str(show.ratingKey),
                            "title": show.title,
                            "poster_path": getattr(show, "thumb", None),
                            "added_at": getattr(show, "addedAt", None).isoformat() if getattr(show, "addedAt", None) else None,
                            "year": getattr(show, "year", None),
                        })
                except Exception:
                    pass
        shows.sort(key=lambda x: x["added_at"] or "", reverse=True)
        return shows[:limit]

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(cache_key, result)
    return result


@app.get("/tv/analytics/stats")
async def get_tv_stats():
    cached = _cache_get("tv_stats")
    if cached is not None:
        return cached

    def _fetch() -> dict:
        plex = _get_plex()
        now = datetime.now()
        year_start = datetime(now.year, 1, 1)

        try:
            ytd_raw = plex.history(mindate=year_start)
        except Exception:
            ytd_raw = []
        ytd = [h for h in ytd_raw if getattr(h, "type", None) == "episode"]

        total_episodes = len(ytd)

        # History items don't carry duration — build a map from library episodes.
        duration_map: dict = {}
        for section in plex.library.sections():
            if section.type == "show":
                try:
                    for ep in section.searchEpisodes():
                        dur = getattr(ep, "duration", None)
                        if dur:
                            duration_map[str(ep.ratingKey)] = dur
                except Exception:
                    pass
        total_ms = sum(duration_map.get(str(h.ratingKey), 0) for h in ytd)
        total_hours = round(total_ms / (1000 * 60 * 60))
        active_users = len({str(h.accountID) for h in ytd if h.accountID > 0})

        shows_added = 0
        for section in plex.library.sections():
            if section.type == "show":
                try:
                    for show in section.all():
                        if getattr(show, "addedAt", None) and show.addedAt >= year_start:
                            shows_added += 1
                except Exception:
                    pass

        return {
            "shows_added_this_year": shows_added,
            "total_episodes_this_year": total_episodes,
            "total_hours_watched": total_hours,
            "active_users": active_users,
        }

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set("tv_stats", result)
    return result


@app.get("/tv/analytics/activity")
async def get_tv_activity(limit: int = 10):
    cached = _cache_get(f"tv_activity:{limit}")
    if cached is not None:
        return cached

    def _fetch() -> list:
        plex = _get_plex()

        name_map: dict = {}
        try:
            for acc in plex.systemAccounts():
                if acc.id > 0:
                    name_map[str(acc.id)] = acc.name or f"User {acc.id}"
        except Exception:
            pass

        events: list = []

        history = _fetch_all_tv_history()
        for item in history:
            user = name_map.get(str(item.accountID), f"User {item.accountID}")
            show_title = getattr(item, "grandparentTitle", item.title)
            ep_title = item.title
            season = getattr(item, "parentIndex", None)
            episode = getattr(item, "index", None)
            ep_info = f"S{season:02d}E{episode:02d}" if season and episode else ""
            events.append({
                "type": "watch",
                "title": show_title,
                "subtitle": f"{ep_info} {ep_title}".strip(),
                "user_name": user,
                "poster_path": getattr(item, "grandparentThumb", item.thumb),
                "timestamp": item.viewedAt.isoformat(),
            })

        for section in plex.library.sections():
            if section.type == "show":
                try:
                    for show in section.recentlyAdded(maxresults=30):
                        added_at = getattr(show, "addedAt", None)
                        if added_at:
                            events.append({
                                "type": "added",
                                "title": show.title,
                                "subtitle": None,
                                "user_name": None,
                                "poster_path": getattr(show, "thumb", None),
                                "timestamp": added_at.isoformat(),
                            })
                except Exception:
                    pass

        events.sort(key=lambda x: x["timestamp"], reverse=True)
        return events[:limit]

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(f"tv_activity:{limit}", result)
    return result


@app.get("/tv/analytics/charts")
async def get_tv_charts():
    cached = _cache_get("tv_charts")
    if cached is not None:
        return cached

    def _fetch():
        plex = _get_plex()
        now = datetime.now()
        year_start = datetime(now.year, 1, 1)

        try:
            raw = plex.history(mindate=year_start)
        except Exception:
            raw = []

        history = [h for h in raw if getattr(h, "type", None) == "episode"]

        weekly_map: dict = {}
        by_day_map: dict = {i: 0 for i in range(7)}

        for item in history:
            d = item.viewedAt
            iso_week = d.isocalendar()[1]
            weekly_map[iso_week] = weekly_map.get(iso_week, 0) + 1
            by_day_map[d.weekday()] += 1

        weeks = [{"week": w, "count": weekly_map.get(w, 0)} for w in range(1, 53)]

        episodes_logged = len(history)
        months_elapsed = max(1, now.month)
        weeks_elapsed = max(1, (now - year_start).days // 7)
        avg_per_month = round(episodes_logged / months_elapsed, 1)
        avg_per_week = round(episodes_logged / weeks_elapsed, 1)

        day_labels = ["M", "T", "W", "T", "F", "S", "S"]
        by_day = [{"label": day_labels[i], "count": by_day_map[i]} for i in range(7)]

        return {
            "weekly": weeks,
            "stats": {
                "films_logged": episodes_logged,
                "avg_per_month": avg_per_month,
                "avg_per_week": avg_per_week,
            },
            "by_day": by_day,
        }

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set("tv_charts", result)
    return result


@app.get("/tv/show/info")
async def get_show_info(
    show_id: str = Query(default=""),
    title: str = Query(default=""),
):
    if not show_id and not title:
        raise HTTPException(status_code=400, detail="Provide show_id or title")
    if show_id and not show_id.isdigit():
        raise HTTPException(status_code=400, detail="show_id must be a numeric Plex rating key")

    cache_key = f"show_info:{show_id or title}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    def _fetch():
        plex = _get_plex()
        s = None

        if show_id and show_id.isdigit():
            try:
                s = plex.fetchItem(int(show_id))
            except Exception:
                pass

        if s is None and title:
            try:
                results = plex.library.search(title=title, libtype="show")
                if results:
                    s = results[0]
            except Exception:
                pass

        if s is None:
            return None

        genres = [g.tag for g in (getattr(s, "genres", None) or [])]
        actors = [r.tag for r in (getattr(s, "roles", None) or [])[:6]]

        try:
            seasons = len(s.seasons())
        except Exception:
            seasons = None
        episodes = getattr(s, "leafCount", None)

        return {
            "title": s.title,
            "year": str(s.year) if getattr(s, "year", None) else None,
            "poster": getattr(s, "thumb", None),
            "description": getattr(s, "summary", None),
            "genre": genres,
            "seasons": seasons,
            "episodes": episodes,
            "rating": getattr(s, "rating", None),
            "content_rating": getattr(s, "contentRating", None),
            "actors": actors,
            "studio": getattr(s, "studio", None),
        }

    try:
        result = await asyncio.to_thread(_fetch)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Show info failed: {exc}")

    if result is None:
        raise HTTPException(status_code=404, detail="Show not found")

    _cache_set(cache_key, result)
    return result


# ---------------------------------------------------------------------------
# Image proxy
# ---------------------------------------------------------------------------

@app.get("/proxy/image")
async def proxy_image(path: str):
    """Proxy Plex poster images so the token is never sent to the browser."""
    # Restrict to Plex library paths only (prevents SSRF)
    if not re.match(r"^/library/", path):
        raise HTTPException(status_code=400, detail="Invalid image path")
    url = f"{PLEX_BASE_URL}{path}?X-Plex-Token={PLEX_TOKEN}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            plex_resp = await client.get(url)
            plex_resp.raise_for_status()
        return Response(
            content=plex_resp.content,
            media_type=plex_resp.headers.get("content-type", "image/jpeg"),
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail="Image not found")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch image: {exc}")
