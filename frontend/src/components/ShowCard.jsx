export default function ShowCard({ show, showCount = false, onDoubleClick }) {
  const posterUrl = show.poster_path
    ? `/api/proxy/image?path=${encodeURIComponent(show.poster_path)}`
    : null
  // Allow modal if we have either a numeric Plex ID or at least a title to search by
  const canOpenModal = onDoubleClick && !!(show.show_id || show.title)

  return (
    <div
      className="movie-card"
      onDoubleClick={() => canOpenModal && onDoubleClick?.(show)}
      title={canOpenModal ? 'Double-click for details' : undefined}
      style={canOpenModal ? { cursor: 'pointer' } : undefined}
    >
      <div className="poster-wrapper">
        {posterUrl ? (
          <img src={posterUrl} alt={show.title} loading="lazy" />
        ) : (
          <div className="poster-placeholder">
            <span>{show.title}</span>
          </div>
        )}
        {canOpenModal && (
          <div className="poster-info-hint">⊕</div>
        )}
      </div>
      <p className="movie-title" title={show.title}>
        {show.title}
      </p>
      {showCount && show.count > 0 && (
        <p className="watch-count">
          {show.count} {show.count === 1 ? 'episode' : 'episodes'}
        </p>
      )}
    </div>
  )
}
