import { useState, useEffect } from 'react'
import TopMovies from '../components/TopMovies'
import UserRow from '../components/UserRow'
import HeroBanner from '../components/HeroBanner'
import StatsBar from '../components/StatsBar'
import ToplexLogo from '../components/ToplexLogo'
import ActivityFeed from '../components/ActivityFeed'
import WatchChart from '../components/WatchChart'
import { getUsers } from '../services/api'

export default function Dashboard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [topMovie, setTopMovie] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getUsers()
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
      <HeroBanner movie={topMovie} />
      <StatsBar />

      <div className="app">
        <header className="header">
          <ToplexLogo height={34} />
          <span className="header-tagline">Analytics</span>
        </header>

        <div className="content-layout">
          <main className="content-main">
            <WatchChart />
            <TopMovies onTopMovie={setTopMovie} />

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
                <UserRow key={user.id} user={user} />
              ))}
            </section>
          </main>

          <ActivityFeed />
        </div>
      </div>
    </div>
  )
}

