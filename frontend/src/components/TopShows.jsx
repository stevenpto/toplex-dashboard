import { useState, useEffect } from 'react'
import ShowCard from './ShowCard'
import ShowModal from './ShowModal'
import { getTVTopShows } from '../services/api'

export default function TopShows({ onTopShow }) {
  const [shows, setShows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedShow, setSelectedShow] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getTVTopShows('30d')
        if (!cancelled) {
          setShows(data)
          if (onTopShow && data.length > 0) onTopShow(data[0])
        }
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
          <h2 className="section-title">Popular This Month</h2>
        </div>

        {loading && (
          <div className="movie-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="loading-poster skeleton" />
            ))}
          </div>
        )}

        {error && (
          <p className="error-message">Failed to load top shows: {error}</p>
        )}

        {!loading && !error && (
          <div className="movie-grid movie-grid--6">
            {shows.length === 0 ? (
              <p className="empty-state">No shows watched this month</p>
            ) : (
              shows.map((show) => (
                <ShowCard
                  key={show.show_id}
                  show={show}
                  showCount
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
