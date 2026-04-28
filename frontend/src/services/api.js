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

export const getStats = () =>
  apiFetch('/analytics/stats')

export const getActivity = (limit = 10) =>
  apiFetch(`/analytics/activity?limit=${limit}`)

export const getCharts = () =>
  apiFetch('/analytics/charts')

export const getMovieInfo = (movieId) =>
  apiFetch(`/movie/info?movie_id=${encodeURIComponent(movieId)}`)
