# Plex Analytics Dashboard

Letterboxd-style analytics dashboard for your Plex server.

## Stack

- **Backend** — FastAPI + plexapi (Python)
- **Frontend** — React + Vite

---

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env          # fill in your PLEX_BASE_URL and PLEX_TOKEN
pip install -r requirements.txt
uvicorn main:app --reload     # runs on http://localhost:8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # runs on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Getting your Plex token

1. Sign in to app.plex.tv
2. Open any media item → click ··· → "Get Info"
3. View XML — the token is in the URL as `X-Plex-Token=...`

Or follow the [official guide](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/).

---

## Architecture

```
Browser → Vite dev server (/api/* proxied) → FastAPI → Plex Server
```

Plex images are proxied through `/proxy/image` so the Plex token is never
sent to the browser.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | Server accounts |
| GET | `/users/{id}/recent?limit=4` | Last N watched items |
| GET | `/analytics/top-movies?range=7d&limit=4` | Most-watched this period |
| GET | `/proxy/image?path=...` | Proxied poster image |

Responses are cached in-memory for 60 seconds.

---

## Notes

- The backend uses `PlexServer.systemAccounts()` to list users — these IDs
  match `item.accountID` in watch history, which is what history filtering
  relies on.
- Requires a Plex admin token to read history across all accounts.
- No database — all data is fetched live from Plex and cached in memory.
