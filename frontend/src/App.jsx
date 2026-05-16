import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import TVDashboard from './pages/TVDashboard'

export default function App() {
  const [view, setView] = useState('movies')
  return view === 'movies'
    ? <Dashboard view={view} onSwitch={setView} />
    : <TVDashboard view={view} onSwitch={setView} />
}
