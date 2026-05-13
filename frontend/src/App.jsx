import { useEffect, useMemo, useState } from 'react'
import api from './api'
import { MILESTONES, QUOTES, TOTAL_DAYS } from './constants'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function pickRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]
}

export default function App() {
  const [booting, setBooting] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(emptyForm)
  const [authError, setAuthError] = useState('')
  const [busy, setBusy] = useState(false)
  const [user, setUser] = useState(null)
  const [tracker, setTracker] = useState(null)
  const [quote, setQuote] = useState(pickRandomQuote())
  const [notice, setNotice] = useState('')

  useEffect(() => {
    initializeSession()
  }, [])

  useEffect(() => {
    if (tracker?.summary?.completed != null) {
      setQuote(pickRandomQuote())
    }
  }, [tracker?.summary?.completed])

  const summary = tracker?.summary ?? {
    completed: 0,
    remaining: TOTAL_DAYS,
    percentage: 0,
    streak: 0,
  }

  const days = tracker?.days ?? Array.from({ length: TOTAL_DAYS }, () => false)

  const milestoneState = useMemo(
    () =>
      MILESTONES.map((milestone) => ({
        ...milestone,
        unlocked: days.slice(0, milestone.day).every(Boolean),
      })),
    [days],
  )

  async function initializeSession() {
    try {
      const me = await api('/auth/me')
      setUser(me.user)
      setTracker(me.user.tracker)
      setNotice('')
      return
    } catch (_error) {
      try {
        const refreshed = await api('/auth/refresh', { method: 'POST' })
        setUser(refreshed.user)
        setTracker(refreshed.user.tracker)
        setNotice('')
        return
      } catch (_refreshError) {
        // No active session yet — that is fine.
      }
    } finally {
      setBooting(false)
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthError('')
    setNotice('')

    if (authMode === 'register' && authForm.password !== authForm.confirmPassword) {
      setAuthError('Passwords do not match.')
      return
    }

    setBusy(true)

    try {
      const payload =
        authMode === 'register'
          ? {
              name: authForm.name.trim(),
              email: authForm.email.trim(),
              password: authForm.password,
            }
          : {
              email: authForm.email.trim(),
              password: authForm.password,
            }

      const response = await api(`/auth/${authMode}`, {
        method: 'POST',
        body: payload,
      })

      setUser(response.user)
      setTracker(response.user.tracker)
      setAuthForm(emptyForm)
      setNotice(authMode === 'register' ? 'Account created. Welcome aboard.' : 'Welcome back.')
    } catch (error) {
      setAuthError(error.message || 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleDay(dayNumber) {
    if (!user) return

    try {
      const response = await api(`/tracker/day/${dayNumber}`, { method: 'PATCH' })
      setTracker(response.tracker)
      setNotice(`Day ${dayNumber} updated.`)
    } catch (error) {
      setAuthError(error.message || 'Unable to update progress.')
    }
  }

  async function handleResetTracker() {
    const confirmed = window.confirm('Reset all progress? This cannot be undone.')
    if (!confirmed) return

    try {
      const response = await api('/tracker/reset', { method: 'POST' })
      setTracker(response.tracker)
      setNotice('Tracker reset.')
    } catch (error) {
      setAuthError(error.message || 'Unable to reset tracker.')
    }
  }

  async function handleLogout() {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch (_error) {
      // Even if the token is expired, clear the client session.
    } finally {
      setUser(null)
      setTracker(null)
      setAuthForm(emptyForm)
      setAuthError('')
      setNotice('You have been signed out.')
      setAuthMode('login')
    }
  }

  if (booting) {
    return (
      <main className="app-shell">
        <div className="loading-card">Loading your tracker…</div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="app-shell auth-layout">
        <section className="hero">
          <div className="badge-title">Your Journey to Freedom</div>
          <h1>90-Day Freedom Tracker</h1>
          <div className="hero-sub">One day at a time. One decision at a time.</div>
        </section>

        <section className="auth-card">
          <div className="auth-tabs">
            <button className={authMode === 'login' ? 'tab active' : 'tab'} onClick={() => setAuthMode('login')}>
              Sign In
            </button>
            <button
              className={authMode === 'register' ? 'tab active' : 'tab'}
              onClick={() => setAuthMode('register')}
            >
              Create Account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === 'register' && (
              <label>
                Full Name
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  placeholder="John Doe"
                  autoComplete="name"
                />
              </label>
            )}

            <label>
              Email Address
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                placeholder="Minimum 8 characters"
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
              />
            </label>

            {authMode === 'register' && (
              <label>
                Confirm Password
                <input
                  type="password"
                  value={authForm.confirmPassword}
                  onChange={(event) => setAuthForm({ ...authForm, confirmPassword: event.target.value })}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                />
              </label>
            )}

            {(authError || notice) && (
              <div className={authError ? 'alert error' : 'alert success'}>{authError || notice}</div>
            )}

            <button className="primary-btn" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : authMode === 'register' ? 'Create My Account' : 'Enter Dashboard'}
            </button>
          </form>

          <p className="auth-footnote">
            Protected by JWT cookies, MongoDB persistence, and a refresh-token flow that keeps sessions tidy.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="hero dashboard-hero">
        <div className="badge-title">Your Journey to Freedom</div>
        <h1>90-Day Freedom Tracker</h1>
        <div className="hero-sub">Welcome back, {user.name}. Keep the momentum rolling.</div>
      </section>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Current Streak</div>
          <div className="stat-value accent">{summary.streak}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Days Completed</div>
          <div className="stat-value">{summary.completed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Days Remaining</div>
          <div className="stat-value teal">{summary.remaining}</div>
        </div>
      </div>

      <section className="progress-section">
        <div className="progress-header">
          <span className="progress-label">Overall Progress</span>
          <span className="progress-pct">{summary.percentage}% Complete</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${summary.percentage}%` }} />
        </div>
      </section>

      <section className="quote-box">
        <div className="quote-text">“{quote.text}”</div>
        <div className="quote-author">— {quote.author}</div>
      </section>

      <section className={summary.completed === TOTAL_DAYS ? 'congrats-banner visible' : 'congrats-banner'}>
        <h2>You Did It. 90 Days.</h2>
        <p>You've rewired your brain. You've proven your will is unbreakable. This is only the beginning.</p>
      </section>

      {notice && <section className="inline-note">{notice}</section>}
      {authError && <section className="inline-note error">{authError}</section>}

      <section className="grid-section">
        <div className="grid-title">Mark Each Completed Day</div>
        <div className="days-grid">
          {days.map((done, index) => {
            const dayNumber = index + 1
            const isMilestone = MILESTONES.some((milestone) => milestone.day === dayNumber)

            return (
              <button
                key={dayNumber}
                type="button"
                className={['day-btn', done ? 'done' : '', isMilestone ? 'milestone' : ''].filter(Boolean).join(' ')}
                title={`Day ${dayNumber}${isMilestone ? ' • Milestone' : ''}`}
                onClick={() => handleToggleDay(dayNumber)}
              >
                <span className="check">✓</span>
                <span className="day-num">{dayNumber}</span>
                <span className="milestone-dot" />
              </button>
            )
          })}
        </div>
      </section>

      <section className="milestones-section">
        <div className="grid-title">Milestone Achievements</div>
        <div className="milestones-grid">
          {milestoneState.map((milestone) => (
            <div key={milestone.day} className={milestone.unlocked ? 'milestone-card unlocked' : 'milestone-card'}>
              <div className="milestone-icon">{milestone.icon}</div>
              <div className="milestone-info">
                <div className="milestone-day">Day {milestone.day}</div>
                <div className="milestone-name">{milestone.name}</div>
              </div>
              <span className="lock-icon">🔒</span>
              <span className="unlock-icon">✓</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer-row">
        <button className="btn-secondary" type="button" onClick={handleLogout}>
          Sign Out
        </button>
        <button className="btn-reset" type="button" onClick={handleResetTracker}>
          Reset Tracker
        </button>
      </footer>
    </main>
  )
}
