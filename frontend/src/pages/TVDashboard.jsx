import { useState, useEffect } from 'react'
import TopShows from '../components/TopShows'
import UserRow from '../components/UserRow'
import HeroBanner from '../components/HeroBanner'
import StatsBar from '../components/StatsBar'
import ToplexLogo from '../components/ToplexLogo'
import TVActivityFeed from '../components/TVActivityFeed'
import WatchChart from '../components/WatchChart'
import { getTVUsers } from '../services/api'

export default function TVDashboard({ view, onSwitch }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [topShow, setTopShow] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getTVUsers()
        if (!cancelled) setUsers(data)
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
    <div>
      <HeroBanner movie={topShow} />
      <StatsBar mode="tv" />

      <div className="app">
        <header className="header">
          <ToplexLogo height={34} />
          <span className="header-tagline">Analytics</span>
          <nav className="view-nav">
            <button
              className={`view-nav-btn${view === 'movies' ? ' active' : ''}`}
              onClick={() => onSwitch('movies')}
            >
              Movies
            </button>
            <button
              className={`view-nav-btn${view === 'tv' ? ' active' : ''}`}
              onClick={() => onSwitch('tv')}
            >
              TV Shows
            </button>
          </nav>
        </header>

        <div className="content-layout">
          <main className="content-main">
            <WatchChart mode="tv" />
            <TopShows onTopShow={setTopShow} />

            <section className="users-section">
              <div className="section-header">
                <h2 className="section-title">Recent Activity</h2>
              </div>

              {loading && (
                <div className="users-loading">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="user-row-skeleton skeleton" />
                  ))}
                </div>
              )}

              {error && (
                <p className="error-message">Failed to load users: {error}</p>
              )}

              {!loading && !error && users.length === 0 && (
                <p className="empty-state">No users found on this server</p>
              )}

              {users.map((user) => (
                <UserRow key={user.id} user={user} mode="tv" />
              ))}
            </section>
          </main>

          <TVActivityFeed />
        </div>
      </div>
    </div>
  )
}
