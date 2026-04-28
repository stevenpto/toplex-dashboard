export default function MovieCard({ movie, showCount = false, onDoubleClick }) {
  const posterUrl = movie.poster_path
    ? `/api/proxy/image?path=${encodeURIComponent(movie.poster_path)}`
    : null

  return (
    <div
      className="movie-card"
      onDoubleClick={() => onDoubleClick?.(movie)}
      title={onDoubleClick ? 'Double-click for details' : undefined}
      style={onDoubleClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="poster-wrapper">
        {posterUrl ? (
          <img src={posterUrl} alt={movie.title} loading="lazy" />
        ) : (
          <div className="poster-placeholder">
            <span>{movie.title}</span>
          </div>
        )}
        {onDoubleClick && (
          <div className="poster-info-hint">⊕</div>
        )}
      </div>
      <p className="movie-title" title={movie.title}>
        {movie.title}
      </p>
      {showCount && movie.count > 0 && (
        <p className="watch-count">
          {movie.count} {movie.count === 1 ? 'watch' : 'watches'}
        </p>
      )}
    </div>
  )
}
