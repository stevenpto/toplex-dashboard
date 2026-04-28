# Plex Analytics Dashboard - Phase 1 PRD

## Overview
Build a web-based analytics dashboard for a Plex server that visualizes user viewing behavior (similar to Letterboxd style UI).

---

## Architecture
Plex Server → FastAPI Backend → React Frontend

---

## Environment Variables
PLEX_BASE_URL=http://YOUR_PLEX_SERVER:32400  
PLEX_TOKEN=YOUR_TOKEN  

---

## Backend Requirements

### Dependencies
- fastapi
- uvicorn
- plexapi
- python-dotenv

### Core Responsibilities
- Connect to Plex API
- Fetch users and watch history
- Transform data
- Expose REST endpoints
- Cache responses (60 seconds)

---

## Plex API Integration

### Connect to Plex
```python
from plexapi.server import PlexServer
plex = PlexServer(PLEX_BASE_URL, PLEX_TOKEN)
```

### Get Users
```python
from plexapi.myplex import MyPlexAccount
account = MyPlexAccount(token=PLEX_TOKEN)
users = account.users()
```

### Get Watch History
```python
history = plex.library.section('Movies').history()
```

### Fields to Extract
- item.accountID → user_id
- item.ratingKey → movie_id
- item.title
- item.viewedAt
- item.thumb

### Poster URL
```python
poster_url = f"{PLEX_BASE_URL}{item.thumb}?X-Plex-Token={PLEX_TOKEN}"
```

---

## API Endpoints

### GET /users
Returns list of users

### GET /users/{id}/recent?limit=4
Returns last 4 watched movies

### GET /analytics/top-movies?range=7d&limit=4
Returns top 4 movies in last 7 days

---

## Data Logic

### Recent Movies
- Filter by user
- Sort by viewedAt desc
- Limit 4

### Top Movies
- Filter last 7 days
- Group by movie_id
- Count occurrences
- Sort desc
- Limit 4

---

## Frontend (React)

### Structure
/src
  /components
  /pages
  /services

### Components
- Dashboard
- TopMovies
- UserRow
- MovieCard

### UI
- Dark theme
- Poster grid
- Responsive layout

---

## Acceptance Criteria
- Backend runs
- Frontend runs
- Displays:
  - Top 4 movies
  - Users
  - Last 4 watched per user
- Posters render correctly

---

## Notes
- No database in Phase 1
- Use in-memory caching
- Do not expose Plex token to frontend
