const BASE = '/api'

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export const getUsers = () =>
  apiFetch('/users')

export const getRecentMovies = (userId, limit = 4) =>
  apiFetch(`/users/${encodeURIComponent(userId)}/recent?limit=${limit}`)

export const getTopMovies = (range = '7d', limit = 4) =>
  apiFetch(`/analytics/top-movies?range=${range}&limit=${limit}`)

export const getRecentlyAddedMovies = (limit = 4) =>
  apiFetch(`/analytics/recently-added?limit=${limit}`)

export const getStats = () =>
  apiFetch('/analytics/stats')

export const getActivity = (limit = 10) =>
  apiFetch(`/analytics/activity?limit=${limit}`)

export const getCharts = () =>
  apiFetch('/analytics/charts')

export const getMovieInfo = (movieId) =>
  apiFetch(`/movie/info?movie_id=${encodeURIComponent(movieId)}`)

export const getTVUsers = () =>
  apiFetch('/tv/users')

export const getTVUserRecent = (userId, limit = 4) =>
  apiFetch(`/tv/users/${encodeURIComponent(userId)}/recent?limit=${limit}`)

export const getTVTopShows = (range = '7d', limit = 4) =>
  apiFetch(`/tv/analytics/top-shows?range=${range}&limit=${limit}`)

export const getTVRecentlyAdded = (limit = 4) =>
  apiFetch(`/tv/analytics/recently-added?limit=${limit}`)

export const getTVStats = () =>
  apiFetch('/tv/analytics/stats')

export const getTVActivity = (limit = 10) =>
  apiFetch(`/tv/analytics/activity?limit=${limit}`)

export const getTVCharts = () =>
  apiFetch('/tv/analytics/charts')

export const getShowInfo = (showId, title = '') => {
  const params = new URLSearchParams()
  if (showId) params.set('show_id', showId)
  if (title) params.set('title', title)
  return apiFetch(`/tv/show/info?${params.toString()}`)
}
