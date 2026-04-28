import { useState, useEffect } from 'react'
import MovieCard from './MovieCard'
import MovieModal from './MovieModal'
import { getRecentMovies } from '../services/api'

export default function UserRow({ user }) {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedMovie, setSelectedMovie] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getRecentMovies(user.id)
        if (!cancelled) setMovies(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user.id])

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      <div className="user-row">
        <div className="user-header">
          <div className="user-avatar">{initials}</div>
          <span className="user-name">{user.name}</span>
        </div>

        {loading && (
          <div className="movie-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="loading-poster skeleton" />
            ))}
          </div>
        )}

        {error && (
          <p className="error-message">Failed to load activity: {error}</p>
        )}

        {!loading && !error && movies.length === 0 && (
          <p className="empty-state">No recent activity</p>
        )}

        {!loading && !error && movies.length > 0 && (
          <div className="movie-grid">
            {movies.map((movie) => (
              <MovieCard
                key={`${movie.movie_id}-${movie.viewed_at}`}
                movie={movie}
                onDoubleClick={setSelectedMovie}
              />
            ))}
          </div>
        )}
      </div>

      {selectedMovie && (
        <MovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </>
  )
}
