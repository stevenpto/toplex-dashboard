import { useState, useEffect } from 'react'
import { getTVActivity } from '../services/api'

function CalendarBlock({ month }) {
  return (
    <div className="activity-cal">
      <div className="activity-cal-stripe" />
      <span className="activity-cal-month">{month}</span>
    </div>
  )
}

function groupByMonth(events) {
  const order = []
  const map = {}
  events.forEach(event => {
    const d = new Date(event.timestamp)
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`
    const label = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
    if (!map[key]) { map[key] = { label, items: [] }; order.push(key) }
    map[key].items.push({ ...event, day: d.getDate() })
  })
  return order.map(k => map[k])
}

export default function TVActivityFeed() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getTVActivity(20)
        if (!cancelled) setEvents(data)
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const groups = groupByMonth(events)

  return (
    <aside className="activity-feed">
      <div className="section-header">
        <h2 className="section-title">Activity</h2>
        <span className="activity-all-badge">⚡ LIVE</span>
      </div>

      {loading && (
        <div className="activity-groups">
          {[...Array(2)].map((_, gi) => (
            <div key={gi} className="activity-group">
              <div className="activity-cal skeleton" />
              <ul className="activity-list">
                {[...Array(4)].map((_, i) => (
                  <li key={i} className="activity-item">
                    <div className="skeleton activity-skel-day" />
                    <div className="skeleton activity-skel-title" style={{ width: `${50 + (i % 3) * 15}%` }} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="activity-groups">
          {groups.map((group, gi) => (
            <div key={gi} className="activity-group">
              <CalendarBlock month={group.label} />
              <ul className="activity-list">
                {group.items.map((event, i) => (
                  <li key={i} className="activity-item">
                    <span className="activity-day">{event.day}</span>
                    <div className="activity-body">
                      <span className="activity-movie">{event.title}</span>
                      <span className="activity-context">
                        {event.type === 'watch'
                          ? `${event.subtitle ? event.subtitle + ' · ' : ''}watched by ${event.user_name}`
                          : 'added to library'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
