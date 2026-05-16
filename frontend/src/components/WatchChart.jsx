import { useState, useEffect } from 'react'
import { getCharts, getTVCharts } from '../services/api'

function WeeklyBars({ weeks }) {
  const maxCount = Math.max(1, ...weeks.map(w => w.count))
  const currentWeek = new Date().toISOString().split('W')[1]
    ? Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1)) / 604800000)
    : 52

  return (
    <div className="weekly-bars">
      {weeks.map(w => {
        const pct = (w.count / maxCount) * 100
        const isFuture = w.week > currentWeek
        return (
          <div
            key={w.week}
            className={`week-bar${isFuture ? ' week-bar--future' : ''}${w.count > 0 ? ' week-bar--active' : ''}`}
            style={{ height: `${Math.max(pct, isFuture ? 0 : 2)}%` }}
            title={`Week ${w.week}: ${w.count} film${w.count !== 1 ? 's' : ''}`}
          />
        )
      })}
    </div>
  )
}

function DayBars({ days }) {
  const maxCount = Math.max(1, ...days.map(d => d.count))
  return (
    <div className="day-bars">
      {days.map((d, i) => {
        const pct = (d.count / maxCount) * 100
        return (
          <div key={i} className="day-bar-col">
            <div className="day-bar-track">
              <div
                className="day-bar-fill"
                style={{ height: `${Math.max(pct, d.count > 0 ? 8 : 0)}%` }}
              />
            </div>
            <span className="day-bar-label">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function WatchChart({ mode = 'movies' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)
    const fetcher = mode === 'tv' ? getTVCharts : getCharts
    fetcher()
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [mode])

  if (loading) {
    return (
      <section className="watch-chart-section">
        <div className="chart-heading">
          <span className="chart-title">BY WEEK</span>
        </div>
        <div className="weekly-bars-wrap skeleton" style={{ height: 100 }} />
        <div className="chart-stats-row skeleton" style={{ height: 72, marginTop: 24 }} />
      </section>
    )
  }

  if (!data) return null

  const { weekly, stats, by_day } = data
  const currentYear = new Date().getFullYear()

  return (
    <section className="watch-chart-section">
      <div className="chart-heading">
        <span className="chart-title">BY WEEK</span>
      </div>

      <div className="weekly-bars-wrap">
        <WeeklyBars weeks={weekly} />
        <div className="weekly-axis">
          <span>Jan</span>
          <span>Dec</span>
        </div>
      </div>

      <div className="chart-stats-row">
        <div className="chart-stat-group">
          <div className="chart-stat">
            <span className="chart-stat-num">{stats.films_logged}</span>
            <span className="chart-stat-label">{mode === 'tv' ? 'Episodes logged' : 'Films logged'}</span>
          </div>
          <span className="chart-arrow">→</span>
          <div className="chart-stat">
            <span className="chart-stat-num">{stats.avg_per_month}</span>
            <span className="chart-stat-label">Average per month</span>
          </div>
          <span className="chart-arrow">→</span>
          <div className="chart-stat">
            <span className="chart-stat-num">{stats.avg_per_week}</span>
            <span className="chart-stat-label">Average per week</span>
          </div>
        </div>
        <DayBars days={by_day} />
      </div>
    </section>
  )
}
