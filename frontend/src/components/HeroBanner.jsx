export default function HeroBanner({ movie, label = 'Most Popular This Week' }) {
  if (!movie) return null

  const backdropUrl = movie.art_path
    ? `/api/proxy/image?path=${encodeURIComponent(movie.art_path)}`
    : null

  return (
    <div className="hero-banner">
      {backdropUrl && (
        <div
          className="hero-backdrop-img"
          style={{ backgroundImage: `url(${backdropUrl})` }}
        />
      )}
      <div className="hero-fade" />
      <div className="hero-content">
        <p className="hero-label">{label}</p>
        <h2 className="hero-title">{movie.title}</h2>
        <p className="hero-meta">
          {movie.count} {movie.count === 1 ? 'watch' : 'watches'}
        </p>
      </div>
    </div>
  )
}
