import { useState, useEffect } from 'react'
import ShowCard from './ShowCard'
import ShowModal from './ShowModal'
import { getTVRecentlyAdded } from '../services/api'

export default function RecentShows() {
  const [shows, setShows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedShow, setSelectedShow] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getTVRecentlyAdded(4)
        if (!cancelled) setShows(data)
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
          <div className="movie-grid movie-grid--6">
            {shows.length === 0 ? (
              <p className="empty-state">No shows recently added</p>
            ) : (
              shows.map((show) => (
                <ShowCard
                  key={show.show_id}
                  show={show}
                  onDoubleClick={setSelectedShow}
                />
              ))
            )}
          </div>
        )}
      </section>

      {selectedShow && (
        <ShowModal show={selectedShow} onClose={() => setSelectedShow(null)} />
      )}
    </>
  )
}
