import { useState, useEffect } from 'react'
import { getStats } from '../services/api'

function StatItem({ value, label, loading }) {
  return (
    <div className="stat-item">
      {loading ? (
        <div className="stat-value-skeleton skeleton" />
      ) : (
        <span className="stat-value">
          {value !== null && value !== undefined ? value.toLocaleString() : '—'}
        </span>
      )}
      <span className="stat-label">{label}</span>
    </div>
  )
}

export default function StatsBar() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getStats()
        if (!cancelled) setStats(data)
      } catch {
        // silently fail — stats are supplementary
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="stats-bar">
      <StatItem value={stats?.films_added_this_year} label="Films Added" loading={loading} />
      <div className="stats-divider" />
      <StatItem value={stats?.total_watches_this_year} label="Watches This Year" loading={loading} />
      <div className="stats-divider" />
      <StatItem value={stats?.total_hours_watched} label="Hours Watched" loading={loading} />
      <div className="stats-divider" />
      <StatItem value={stats?.active_users} label="Active Users" loading={loading} />
    </div>
  )
}
