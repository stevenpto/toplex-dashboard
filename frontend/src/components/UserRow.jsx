import { useState, useEffect } from 'react'
import MovieCard from './MovieCard'
import MovieModal from './MovieModal'
import ShowCard from './ShowCard'
import ShowModal from './ShowModal'
import { getRecentMovies, getTVUserRecent } from '../services/api'

export default function UserRow({ user, mode = 'movies' }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setItems([])
    setError(null)
    const fetcher = mode === 'tv'
      ? () => getTVUserRecent(user.id, 4)
      : () => getRecentMovies(user.id)
    fetcher()
      .then(d => { if (!cancelled) setItems(d) })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user.id, mode])

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

        {!loading && !error && items.length === 0 && (
          <p className="empty-state">No recent activity</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className={mode === 'tv' ? 'movie-grid' : 'movie-grid'}>
            {mode === 'tv'
              ? items.map((show) => (
                  <ShowCard
                    key={`${show.show_id}-${show.viewed_at}`}
                    show={show}
                    onDoubleClick={setSelectedItem}
                  />
                ))
              : items.map((movie) => (
                  <MovieCard
                    key={`${movie.movie_id}-${movie.viewed_at}`}
                    movie={movie}
                    onDoubleClick={setSelectedItem}
                  />
                ))
            }
          </div>
        )}
      </div>

      {selectedItem && mode === 'tv' && (
        <ShowModal show={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
      {selectedItem && mode === 'movies' && (
        <MovieModal movie={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </>
  )
}
