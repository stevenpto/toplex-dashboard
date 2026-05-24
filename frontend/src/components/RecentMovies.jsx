import { useState, useEffect } from 'react'
import MovieCard from './MovieCard'
import MovieModal from './MovieModal'
import { getRecentlyAddedMovies } from '../services/api'

export default function RecentMovies() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedMovie, setSelectedMovie] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getRecentlyAddedMovies(4)
        if (!cancelled) setMovies(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <section className="top-movies-section">
        <div className="section-header">
          <h2 className="section-title">Recently Added</h2>
        </div>

        {loading && (
          <div className="movie-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="loading-poster skeleton" />
            ))}
          </div>
        )}

        {error && (
          <p className="error-message">Failed to load recently added: {error}</p>
        )}

        {!loading && !error && (
          <div className="movie-grid">
            {movies.length === 0 ? (
              <p className="empty-state">No movies recently added</p>
            ) : (
              movies.map((movie) => (
                <MovieCard
                  key={movie.movie_id}
                  movie={movie}
                  onDoubleClick={setSelectedMovie}
                />
              ))
            )}
          </div>
        )}
      </section>

      {selectedMovie && (
        <MovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </>
  )
}
