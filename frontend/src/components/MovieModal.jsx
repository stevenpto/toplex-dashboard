import { useState, useEffect, useCallback } from 'react'
import { getMovieInfo } from '../services/api'

function StarRating({ value, max = 10 }) {
  if (!value) return null
  const pct = (value / max) * 100
  return (
    <div className="modal-stars" title={`${value} / ${max}`}>
      <div className="modal-stars-bg">★★★★★</div>
      <div className="modal-stars-fill" style={{ width: `${pct / 2}%` }}>★★★★★</div>
      <span className="modal-rating-val">{value}</span>
    </div>
  )
}

export default function MovieModal({ movie, onClose }) {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const movieId = movie?.movie_id

  useEffect(() => {
    if (!movie || !movieId) return
    let cancelled = false
    setLoading(true)
    setInfo(null)
    setError(null)
    getMovieInfo(movieId)
      .then(d => { if (!cancelled) setInfo(d) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [movieId])

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [handleKey])

  if (!movie) return null

  // Prefer Plex poster from card; fall back to whatever the info endpoint returns
  const posterPath = movie.poster_path || info?.poster
  const posterUrl = posterPath
    ? (posterPath.startsWith('/library/')
        ? `/api/proxy/image?path=${encodeURIComponent(posterPath)}`
        : posterPath)
    : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="modal-body">
          {/* Poster */}
          <div className="modal-poster">
            {posterUrl ? (
              <img src={posterUrl} alt={movie.title} />
            ) : (
              <div className="modal-poster-placeholder">
                <span>{movie.title}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="modal-info">
            {loading && (
              <div className="modal-loading">
                <div className="skeleton modal-skel-title" />
                <div className="skeleton modal-skel-meta" />
                <div className="skeleton modal-skel-desc" />
                <div className="skeleton modal-skel-desc" style={{ width: '75%' }} />
              </div>
            )}

            {error && (
              <>
                <h2 className="modal-title">{movie.title}</h2>
                <p className="modal-error">Could not load IMDB info: {error}</p>
              </>
            )}

            {!loading && !error && info && (
              <>
                <h2 className="modal-title">{info.title}</h2>

                <div className="modal-meta">
                  {info.year && <span className="modal-year">{info.year}</span>}
                  {info.duration && <span className="modal-duration">{info.duration}</span>}
                  {info.content_rating && (
                    <span className="modal-cert">{info.content_rating}</span>
                  )}
                </div>

                {info.genre?.length > 0 && (
                  <div className="modal-genres">
                    {info.genre.map(g => (
                      <span key={g} className="modal-genre-tag">{g}</span>
                    ))}
                  </div>
                )}

                <StarRating value={info.rating} />

                {info.description && (
                  <p className="modal-description">{info.description}</p>
                )}

                {info.directors?.length > 0 && (
                  <div className="modal-crew-row">
                    <span className="modal-crew-label">Director</span>
                    <span className="modal-crew-names">{info.directors.join(', ')}</span>
                  </div>
                )}

                {info.actors?.length > 0 && (
                  <div className="modal-crew-row">
                    <span className="modal-crew-label">Cast</span>
                    <span className="modal-crew-names">{info.actors.join(', ')}</span>
                  </div>
                )}

                {info.imdb_url && (
                  <a
                    className="modal-imdb-link"
                    href={info.imdb_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on IMDB →
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
