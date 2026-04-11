import { useState, useEffect, useCallback } from 'react'

// ── Style Tokens ──
const GREEN = "#50b878", GREEN_LIGHT = "#5eeb96", GREEN_DIM = "#1a2e22"
const CARD_BG = "#1a1a1a", CARD_BORDER = "#444"

const INP = {
  background: "#2a2a2a", border: "1px solid #888", borderRadius: 8,
  color: "#fff", padding: "11px 13px", fontSize: 15,
  width: "100%", outline: "none", fontFamily: "'DM Sans', sans-serif",
  boxSizing: "border-box", WebkitAppearance: "none"
}
const LBL = {
  fontSize: 10, color: "#ddd", textTransform: "uppercase",
  letterSpacing: "0.12em", marginBottom: 5, display: "block"
}
const CARD = {
  background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
  borderRadius: 12, padding: 14, marginBottom: 10
}
const BTN_BASE = {
  border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  fontSize: 14, fontWeight: 600, borderRadius: 10, transition: "all 0.15s",
  padding: "12px 20px", display: "inline-flex", alignItems: "center",
  justifyContent: "center"
}
const BARLOW = "'Barlow Condensed', sans-serif"

// ── Constants ──
const WEDGE_DISTANCES = [35,40,45,50,55,60,65,70,75,80,85,90,95,100,105,110,115,120,125,130]
const ARC_DEPTH_SEQUENCE = [
  "Deep","Correct","High","High","Correct","Deep",
  "Deep","Correct","High","High","Correct","Deep"
]
const CLUBS = ["PW","GW","SW","LW","9i","8i","7i","6i","5i","4i","3i","4h","3h","3w","Driver"]
const LOCATIONS = ["Basement","Range","Course","Simulator"]
const STRIKE_GRADES = [1,2,3,4,5]
const SHOT_SHAPES = ["Hook","Draw","Straight","Fade","Slice"]
const PUTT_BREAKS = ["Left to Right","Straight","Right to Left"]
const LAG_SLOPES = ["Uphill","Flat","Downhill"]
const LAG_RESULTS = ["Short","Even","Long"]

const TEMPLATES = {
  distance_matrix: { icon: "🎯", name: "Wedge Distance Matrix", desc: "Track miss distances for 20 random wedge targets" },
  arc_depth: { icon: "🔄", name: "Arc Depth", desc: "Pass/fail through a 12-step arc sequence" },
  shot_shaping: { icon: "🔀", name: "Shot Shaping", desc: "Track path and spin direction over 20 shots" },
  putting_ladder: { icon: "🕳️", name: "Putting Ladder", desc: "Log putts and total distance for ladder drills" },
  four_footer: { icon: "⛳", name: "4-Footer Drill", desc: "Track makes out of 10 from 4 feet" },
  strike_log: { icon: "📍", name: "Strike Log", desc: "Grade strike quality rep by rep" },
  driver_uprights: { icon: "🥅", name: "Driver Uprights", desc: "Track fairway hits and shot shape over 20 shots" },
  start_line: { icon: "🎱", name: "Start Line", desc: "Track gate hits, line accuracy and break over 20 putts" },
  lag: { icon: "📏", name: "Lag", desc: "Track lag putting distance control and miss patterns" },
  shape_randomizer: { icon: "🎲", name: "Shape Randomizer", desc: "Randomized start and curve targets over 10 or 20 shots" },
  toe_heel_strike: { icon: "🦶", name: "Toe/Heel Strike", desc: "Randomized strike location targets over 10 or 20 shots" }
}

const STORAGE_KEY = "gdt_drills_v1"
const MC_API = import.meta.env.VITE_MC_API_URL || ""

const TEMPLATE_TO_CATEGORY = {
  distance_matrix: "Wedges",
  arc_depth: "Full swing",
  shot_shaping: "Full swing",
  putting_ladder: "Putting",
  four_footer: "Putting",
  strike_log: "Full swing",
  driver_uprights: "Full swing",
  start_line: "Putting",
  lag: "Putting",
  shape_randomizer: "Full swing",
  toe_heel_strike: "Full swing",
}

function syncToMC(drill, sessionObj) {
  if (!MC_API) return
  const sourceId = `drill_app_${drill.template}_${sessionObj.id}`
  fetch(`${MC_API}/golf/practice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: new Date(sessionObj.timestamp).toISOString().slice(0, 10),
      category: TEMPLATE_TO_CATEGORY[drill.template],
      drill: TEMPLATES[drill.template].name,
      duration_min: null,
      result_json: sessionObj.data,
      notes: sessionObj.notes || null,
      source: "drill_app",
      source_id: sourceId,
      template: drill.template,
    })
  }).catch(err => console.warn("MC sync failed:", err))
}

// ── Helpers ──
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function calcPoints(missYards, targetYards) {
  if (Number(missYards) === 0) return 10
  const pct = (Math.abs(Number(missYards)) / targetYards) * 100
  if (pct < 1) return 10
  if (pct < 2) return 9
  if (pct < 3) return 8
  if (pct < 4) return 7
  if (pct < 5) return 6
  if (pct < 6) return 5
  if (pct < 7) return 4
  if (pct < 8) return 3
  if (pct < 9) return 2
  if (pct < 10) return 1
  return 0
}

function scoreColor(pts) {
  if (pts >= 9) return "#4ade80"
  if (pts >= 7) return "#a3e635"
  if (pts >= 5) return "#facc15"
  if (pts >= 3) return "#fb923c"
  return "#ef4444"
}

function scoreLabel(pts) {
  if (pts === 10) return "Perfect"
  if (pts >= 9) return "Excellent"
  if (pts >= 7) return "Good"
  if (pts >= 5) return "OK"
  if (pts >= 3) return "Off"
  return "Miss"
}

function pctColor(pct) {
  if (pct >= 80) return "#4ade80"
  if (pct >= 60) return "#facc15"
  return "#ef4444"
}

function formatDate(ts) {
  const d = new Date(ts)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[d.getMonth()]} ${d.getDate()}, ${String(d.getFullYear()).slice(2)}`
}

function formatTime(ts) {
  const d = new Date(ts)
  let h = d.getHours(), m = d.getMinutes()
  const ampm = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`
}

// ── Main App ──
export default function App() {
  const [drills, setDrills] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
      // Ensure all 6 templates exist
      const existing = new Set(saved.map(d => d.template))
      const merged = [...saved]
      for (const [key, t] of Object.entries(TEMPLATES)) {
        if (!existing.has(key)) {
          merged.push({ id: Date.now() + Math.random(), name: t.name, template: key, sessions: [] })
        }
      }
      return merged
    } catch { return Object.entries(TEMPLATES).map(([key, t]) => ({ id: Date.now() + Math.random(), name: t.name, template: key, sessions: [] })) }
  })
  const [view, setView] = useState("home")
  const [activeDrill, setActiveDrill] = useState(null)
  const [sessionData, setSessionData] = useState(null)
  const [sessionNotes, setSessionNotes] = useState("")
  const [cardStep, setCardStep] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [arcClub, setArcClub] = useState("PW")
  const [arcLocation, setArcLocation] = useState("Basement")

  // ── Wake Lock: keep screen on ──
  useEffect(() => {
    let wakeLock = null
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch {}
    }
    requestWakeLock()
    const onVisChange = () => { if (document.visibilityState === 'visible') requestWakeLock() }
    document.addEventListener('visibilitychange', onVisChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisChange)
      if (wakeLock) wakeLock.release().catch(() => {})
    }
  }, [])

  const persist = useCallback((d) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)) } catch {}
  }, [])

  useEffect(() => { persist(drills) }, [drills, persist])

  // ── Auto-persist session draft ──
  const DRAFT_KEY = "gdt_draft_v1"
  useEffect(() => {
    if (view === "session" && sessionData !== null && activeDrill) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          drillId: activeDrill.id, template: activeDrill.template,
          sessionData, sessionNotes, cardStep, showSummary,
          arcClub, arcLocation
        }))
      } catch {}
    }
  }, [view, sessionData, sessionNotes, cardStep, showSummary, activeDrill, arcClub, arcLocation])

  // ── Restore draft on load ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw)
      const drill = drills.find(d => d.id === draft.drillId || d.template === draft.template)
      if (!drill || !draft.sessionData) { localStorage.removeItem(DRAFT_KEY); return }
      setActiveDrill(drill)
      setSessionData(draft.sessionData)
      setSessionNotes(draft.sessionNotes || "")
      setCardStep(draft.cardStep || 0)
      setShowSummary(draft.showSummary || false)
      setArcClub(draft.arcClub || "PW")
      setArcLocation(draft.arcLocation || "Basement")
      setView("session")
    } catch { localStorage.removeItem(DRAFT_KEY) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateDrills = (fn) => setDrills(prev => { const next = fn(prev); return next })

  const goHome = () => {
    localStorage.removeItem(DRAFT_KEY)
    setView("home"); setActiveDrill(null); setSessionData(null)
    setSessionNotes(""); setCardStep(0); setShowSummary(false)
  }

  // ── Save & Go Home: auto-save session data when leaving via Back ──
  const saveAndGoHome = () => {
    if (activeDrill && sessionData) {
      saveSession()
    } else {
      goHome()
    }
  }

  // ── Start Session ──
  const startSession = (drill) => {
    setActiveDrill(drill)
    setSessionNotes("")
    setCardStep(0)
    setShowSummary(false)
    switch (drill.template) {
      case "distance_matrix": {
        const shuffled = shuffle(WEDGE_DISTANCES)
        setSessionData(shuffled.map(d => ({ distance: d, miss: "", dir: "S" })))
        break
      }
      case "arc_depth":
        setSessionData(ARC_DEPTH_SEQUENCE.map((cue, i) => ({ step: i, cue, result: null })))
        break
      case "shot_shaping":
        setSessionData(Array(20).fill(null).map((_, i) => ({ shot: i, path: null, spin: null })))
        break
      case "putting_ladder":
        setSessionData({ putts: "", distance: "", location: "" })
        break
      case "four_footer":
        setSessionData({ made: "", location: "" })
        break
      case "strike_log":
        setSessionData([])
        break
      case "driver_uprights":
        setSessionData(Array(20).fill(null).map((_, i) => ({ shot: i, uprights: null, shape: null })))
        break
      case "start_line":
        setSessionData(Array(20).fill(null).map((_, i) => ({ shot: i, gate: null, lineRight: null, break_dir: null })))
        break
      case "lag":
        setSessionData({ count: null, putts: [] })
        break
      case "shape_randomizer":
        setSessionData({ count: null, shots: [] })
        break
      case "toe_heel_strike":
        setSessionData({ count: null, shots: [] })
        break
    }
    setView("session")
  }

  // ── Save Session ──
  const saveSession = () => {
    const drill = activeDrill
    let sessionObj = { id: Date.now(), timestamp: Date.now(), notes: sessionNotes }
    switch (drill.template) {
      case "distance_matrix":
        sessionObj.data = sessionData
        break
      case "arc_depth":
        sessionObj.data = sessionData
        sessionObj.club = arcClub
        sessionObj.location = arcLocation
        break
      case "shot_shaping":
        sessionObj.data = sessionData
        sessionObj.club = arcClub
        sessionObj.location = arcLocation
        break
      case "putting_ladder":
        sessionObj.data = sessionData
        break
      case "four_footer":
        sessionObj.data = sessionData
        break
      case "strike_log":
        sessionObj.data = sessionData
        break
      case "driver_uprights":
        sessionObj.data = sessionData
        sessionObj.club = arcClub
        sessionObj.location = arcLocation
        break
      case "start_line":
        sessionObj.data = sessionData
        break
      case "lag":
        sessionObj.data = sessionData
        break
      case "shape_randomizer":
        sessionObj.data = sessionData
        break
      case "toe_heel_strike":
        sessionObj.data = sessionData
        break
    }
    updateDrills(prev => prev.map(d =>
      d.id === drill.id ? { ...d, sessions: [...d.sessions, sessionObj] } : d
    ))
    syncToMC(drill, sessionObj)
    localStorage.removeItem(DRAFT_KEY)
    goHome()
  }

  // ── Deep-link: auto-start drill from URL param ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const drillParam = params.get("drill")
    if (drillParam && drills.length > 0) {
      const target = drills.find(d => d.template === drillParam)
      if (target) {
        startSession(target)
        // Clean up URL without reload
        window.history.replaceState({}, "", window.location.pathname)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync all history to MC ──
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  const syncAllToMC = async () => {
    if (!MC_API) { setSyncResult("No MC API URL configured"); return }
    setSyncing(true)
    setSyncResult(null)
    let count = 0
    for (const drill of drills) {
      for (const session of drill.sessions) {
        try {
          await fetch(`${MC_API}/golf/practice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: new Date(session.timestamp).toISOString().slice(0, 10),
              category: TEMPLATE_TO_CATEGORY[drill.template],
              drill: TEMPLATES[drill.template].name,
              duration_min: null,
              result_json: session.data,
              notes: session.notes || null,
              source: "drill_app",
              source_id: `drill_app_${drill.template}_${session.id}`,
              template: drill.template,
            })
          })
          count++
        } catch (err) {
          console.warn("Sync failed for session:", session.id, err)
        }
      }
    }
    setSyncing(false)
    setSyncResult(`Synced ${count} sessions to Mission Control`)
  }

  // ── Header ──
  const Header = ({ title, onBack, backLabel }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: GREEN, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
          ⛳ Golf Practice
        </span>
        {onBack && (
          <button onClick={onBack} style={{ ...BTN_BASE, background: "none", color: "#ddd", fontSize: 13, padding: "4px 0" }}>
            {backLabel || "← Back"}
          </button>
        )}
      </div>
      <h1 style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 28, color: "#fff", margin: 0 }}>{title}</h1>
    </div>
  )

  // ── Dot Progress ──
  const DotGrid = ({ items, current, onTap, colorFn }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, justifyContent: "center" }}>
      {items.map((item, i) => {
        const c = colorFn(item, i)
        return (
          <div key={i} onClick={() => onTap(i)} style={{
            width: 22, height: 22, borderRadius: "50%", background: c.bg,
            border: i === current ? `2px solid ${c.border || "#fff"}` : "2px solid transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.15s", fontSize: 8, color: c.text || "#fff"
          }}>
            {c.label || ""}
          </div>
        )
      })}
    </div>
  )

  // ── Select Dropdown ──
  const Select = ({ value, onChange, options, label }) => (
    <div style={{ flex: 1 }}>
      {label && <label style={LBL}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ ...INP, cursor: "pointer" }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  // ──────────────────────────────
  // DISTANCE MATRIX
  // ──────────────────────────────
  const DistanceMatrixSession = () => {
    const data = sessionData
    const step = cardStep
    const current = data[step]
    const totalPossible = data.length * 10

    const liveScore = data.reduce((sum, d) => {
      if (d.miss === "" || d.miss === null) return sum
      return sum + calcPoints(d.miss, d.distance)
    }, 0)

    // Find last session for reference
    const lastSession = activeDrill.sessions.length > 0
      ? activeDrill.sessions[activeDrill.sessions.length - 1] : null
    let lastRef = null
    if (lastSession) {
      const prev = lastSession.data.find(d => d.distance === current.distance)
      if (prev && prev.miss !== "" && prev.miss !== null) {
        const pts = calcPoints(prev.miss, current.distance)
        lastRef = { miss: prev.miss, dir: prev.dir, pts }
      }
    }

    const hasMiss = current.miss !== "" && current.miss !== null
    const pts = hasMiss ? calcPoints(current.miss, current.distance) : null
    const sc = pts !== null ? scoreColor(pts) : null

    const updateShot = (field, val) => {
      setSessionData(prev => prev.map((d, i) => i === step ? { ...d, [field]: val } : d))
    }

    if (showSummary) {
      const shorts = data.filter(d => d.dir === "S" && d.miss !== "" && Number(d.miss) !== 0).length
      const longs = data.filter(d => d.dir === "L" && d.miss !== "" && Number(d.miss) !== 0).length
      const deads = data.filter(d => d.miss !== "" && Number(d.miss) === 0).length
      const eff = totalPossible > 0 ? Math.round((liveScore / totalPossible) * 100) : 0

      return (
        <div>
          <Header title="Session Summary" onBack={() => setShowSummary(false)} backLabel="← Edit" />
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: BARLOW, fontSize: 72, fontWeight: 700, color: GREEN_LIGHT }}>{liveScore}</div>
            <div style={{ color: "#ddd", fontSize: 14 }}>out of {totalPossible} possible · {eff}%</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[
              { label: "Short", val: shorts, color: "#fb923c" },
              { label: "Long", val: longs, color: "#60a5fa" },
              { label: "Dead On", val: deads, color: "#4ade80" }
            ].map(s => (
              <div key={s.label} style={{ ...CARD, flex: 1, textAlign: "center" }}>
                <div style={{ fontFamily: BARLOW, fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "#ddd" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            {data.map((d, i) => {
              const p = d.miss !== "" ? calcPoints(d.miss, d.distance) : null
              return (
                <div key={i} onClick={() => { setCardStep(i); setShowSummary(false) }}
                  style={{ ...CARD, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div>
                    <span style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 18, color: "#fff" }}>{d.distance} yds</span>
                    {d.miss !== "" && (
                      <span style={{ fontSize: 12, color: "#ddd", marginLeft: 8 }}>
                        {Number(d.miss) === 0 ? "Dead on" : `${d.miss} yds ${d.dir === "S" ? "short" : "long"}`}
                      </span>
                    )}
                  </div>
                  {p !== null && (
                    <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 18, color: scoreColor(p) }}>{p}</span>
                  )}
                </div>
              )
            })}
          </div>
          <label style={LBL}>Session Notes</label>
          <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
            placeholder="Thoughts on this session..."
            style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
          <button onClick={saveSession} style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14, position: "fixed", bottom: 16, left: 16, right: 16, maxWidth: 398, margin: "0 auto", zIndex: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.6)" }}>
            Save Session
          </button>
        </div>
      )
    }

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <span style={{ fontSize: 10, color: GREEN, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
              ⛳ Golf Practice
            </span>
            <button onClick={saveAndGoHome} style={{ ...BTN_BASE, background: "none", color: "#ddd", fontSize: 13, padding: "4px 8px" }}>
              ← Back
            </button>
          </div>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 24, color: GREEN_LIGHT }}>{liveScore}</div>
        </div>
        <h2 style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 22, color: "#fff", margin: "0 0 4px" }}>{activeDrill.name}</h2>
        <div style={{ fontSize: 12, color: "#ddd", marginBottom: 12 }}>Shot {step + 1} of {data.length}</div>

        <DotGrid items={data} current={step} onTap={setCardStep}
          colorFn={(d) => {
            if (d.miss === "" || d.miss === null) return { bg: "#444", label: "" }
            const p = calcPoints(d.miss, d.distance)
            return { bg: scoreColor(p) + "33", border: scoreColor(p), label: "", text: scoreColor(p) }
          }}
        />

        <div style={{
          ...CARD, textAlign: "center", padding: 24, marginBottom: 14,
          background: hasMiss ? sc + "11" : CARD_BG,
          border: hasMiss ? `1px solid ${sc}44` : `1px solid ${CARD_BORDER}`
        }}>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 90, color: "#fff", lineHeight: 1 }}>
            {current.distance}
          </div>
          <div style={{ fontSize: 13, color: "#ddd", marginTop: 4 }}>yards</div>
          {hasMiss && (
            <div style={{ marginTop: 10 }}>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 36, color: sc }}>{pts}</span>
              <span style={{ fontSize: 13, color: sc, marginLeft: 6 }}>{scoreLabel(pts)}</span>
            </div>
          )}
        </div>

        {lastRef && (
          <div style={{ ...CARD, background: "#222", padding: "8px 12px", fontSize: 12, color: "#bbb", marginBottom: 14 }}>
            Last: {Number(lastRef.miss) === 0 ? "Dead on" : `${lastRef.miss} yds ${lastRef.dir === "S" ? "short" : "long"}`} ({lastRef.pts} pts)
          </div>
        )}

        <label style={{ ...LBL, textAlign: "center" }}>Miss (yards)</label>
        <input type="text" inputMode="numeric" value={current.miss}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9]/g, "")
            updateShot("miss", v)
          }}
          style={{ ...INP, textAlign: "center", fontSize: 28, fontFamily: BARLOW, fontWeight: 700, marginBottom: 12 }}
          placeholder="0"
        />

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { key: "S", label: "SHORT", color: "#fb923c" },
            { key: "L", label: "LONG", color: "#60a5fa" }
          ].map(b => {
            const sel = current.dir === b.key
            return (
              <button key={b.key} onClick={() => updateShot("dir", b.key)}
                style={{
                  ...BTN_BASE, flex: 1, fontSize: 15, fontWeight: 700,
                  background: sel ? b.color + "22" : "#1c1c1c",
                  color: sel ? b.color : "#666",
                  border: sel ? `2px solid ${b.color}` : "2px solid #666"
                }}>
                {b.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCardStep(Math.max(0, step - 1))} disabled={step === 0}
            style={{ ...BTN_BASE, flex: 1, background: "#333", color: step === 0 ? "#555" : "#ccc", border: "1px solid #666" }}>
            ← Prev
          </button>
          {step < data.length - 1 ? (
            <button onClick={() => setCardStep(step + 1)}
              style={{ ...BTN_BASE, flex: 1, background: hasMiss ? GREEN : "#1c1c1c", color: hasMiss ? "#fff" : "#666", border: `1px solid ${hasMiss ? GREEN : "#2a2a2a"}` }}>
              Next →
            </button>
          ) : (
            <button onClick={() => setShowSummary(true)}
              style={{ ...BTN_BASE, flex: 1, background: GREEN, color: "#fff" }}>
              Finish →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ──────────────────────────────
  // ARC DEPTH
  // ──────────────────────────────
  const ArcDepthSession = () => {
    const data = sessionData
    const step = cardStep
    const current = data[step]

    const passed = data.filter(d => d.result === true).length
    const answered = data.filter(d => d.result !== null).length
    const passPct = answered > 0 ? Math.round((passed / answered) * 100) : 0

    const cueStyles = {
      Deep: { bg: "#0e1a2e", border: "#2a4a6a", text: "#60a5fa" },
      High: { bg: "#2e1a0e", border: "#6a3a2a", text: "#fb923c" },
      Correct: { bg: "#1a2e22", border: "#2a5a3a", text: "#4ade80" }
    }
    const cs = cueStyles[current.cue]

    const updateStep = (result) => {
      setSessionData(prev => prev.map((d, i) => i === step ? { ...d, result } : d))
      if (step < data.length - 1) {
        setTimeout(() => setCardStep(step + 1), 150)
      }
    }

    if (showSummary) {
      const failed = data.filter(d => d.result === false).length
      return (
        <div>
          <Header title="Session Summary" onBack={() => setShowSummary(false)} backLabel="← Edit" />
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: BARLOW, fontSize: 72, fontWeight: 700, color: pctColor(passPct) }}>{passPct}%</div>
            <div style={{ color: "#ddd", fontSize: 14 }}>Pass Rate</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ ...CARD, flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: BARLOW, fontSize: 28, fontWeight: 700, color: "#4ade80" }}>{passed}</div>
              <div style={{ fontSize: 11, color: "#ddd" }}>Passed</div>
            </div>
            <div style={{ ...CARD, flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: BARLOW, fontSize: 28, fontWeight: 700, color: "#ef4444" }}>{failed}</div>
              <div style={{ fontSize: 11, color: "#ddd" }}>Failed</div>
            </div>
          </div>
          <div style={{ ...CARD, display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#ddd" }}>Club: <span style={{ color: "#fff" }}>{arcClub}</span></span>
            <span style={{ fontSize: 13, color: "#ddd" }}>Location: <span style={{ color: "#fff" }}>{arcLocation}</span></span>
          </div>
          <div style={{ marginBottom: 16 }}>
            {data.map((d, i) => (
              <div key={i} onClick={() => { setCardStep(i); setShowSummary(false) }}
                style={{ ...CARD, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div>
                  <span style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 16, color: cueStyles[d.cue].text }}>
                    {d.cue}
                  </span>
                  <span style={{ fontSize: 12, color: "#bbb", marginLeft: 8 }}>Step {i + 1}</span>
                </div>
                {d.result !== null && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: d.result ? "#4ade80" : "#ef4444" }}>
                    {d.result ? "PASS" : "FAIL"}
                  </span>
                )}
              </div>
            ))}
          </div>
          <label style={LBL}>Session Notes</label>
          <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
            placeholder="Thoughts on this session..."
            style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
          <button onClick={saveSession} style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14, position: "fixed", bottom: 16, left: 16, right: 16, maxWidth: 398, margin: "0 auto", zIndex: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.6)" }}>
            Save Session
          </button>
        </div>
      )
    }

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <span style={{ fontSize: 10, color: GREEN, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
              ⛳ Golf Practice
            </span>
            <button onClick={saveAndGoHome} style={{ ...BTN_BASE, background: "none", color: "#ddd", fontSize: 13, padding: "4px 8px" }}>
              ← Back
            </button>
          </div>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: pctColor(passPct) }}>
            {answered > 0 ? `${passPct}%` : "—"}
          </div>
        </div>
        <h2 style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 22, color: "#fff", margin: "0 0 12px" }}>{activeDrill.name}</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Select label="Club" value={arcClub} onChange={setArcClub} options={CLUBS} />
          <Select label="Location" value={arcLocation} onChange={setArcLocation} options={LOCATIONS} />
        </div>

        <DotGrid items={data} current={step} onTap={setCardStep}
          colorFn={(d, i) => {
            if (d.result === null) {
              if (i === step) return { bg: cueStyles[d.cue].bg, border: cueStyles[d.cue].text }
              return { bg: "#444" }
            }
            return d.result
              ? { bg: "#4ade8044", border: "#4ade80" }
              : { bg: "#ef444444", border: "#ef4444" }
          }}
        />

        <div style={{ fontSize: 12, color: "#ddd", textAlign: "center", marginBottom: 6 }}>Step {step + 1} of {data.length}</div>
        <div style={{
          ...CARD, textAlign: "center", padding: 28, marginBottom: 14,
          background: cs.bg, border: `1px solid ${cs.border}`
        }}>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 64, color: cs.text, lineHeight: 1 }}>
            {current.cue}
          </div>
          {current.result !== null && (
            <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: current.result ? "#4ade80" : "#ef4444" }}>
              {current.result ? "PASS" : "FAIL"}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => updateStep(false)}
            style={{
              ...BTN_BASE, flex: 1, fontSize: 16, fontWeight: 700,
              background: current.result === false ? "#ef444422" : "#1c1c1c",
              color: current.result === false ? "#ef4444" : "#666",
              border: current.result === false ? "2px solid #ef4444" : "2px solid #666"
            }}>
            FAIL
          </button>
          <button onClick={() => updateStep(true)}
            style={{
              ...BTN_BASE, flex: 1, fontSize: 16, fontWeight: 700,
              background: current.result === true ? "#4ade8022" : "#1c1c1c",
              color: current.result === true ? "#4ade80" : "#666",
              border: current.result === true ? "2px solid #4ade80" : "2px solid #666"
            }}>
            PASS
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCardStep(Math.max(0, step - 1))} disabled={step === 0}
            style={{ ...BTN_BASE, flex: 1, background: "#333", color: step === 0 ? "#555" : "#ccc", border: "1px solid #666" }}>
            ← Prev
          </button>
          <button onClick={() => setShowSummary(true)}
            style={{ ...BTN_BASE, flex: 1, background: "#333", color: "#ccc", border: "1px solid #666" }}>
            Summary
          </button>
        </div>
      </div>
    )
  }

  // ──────────────────────────────
  // SHOT SHAPING
  // ──────────────────────────────
  const ShotShapingSession = () => {
    const data = sessionData
    const step = cardStep
    const current = data[step]

    const combo = (d) => d.path === "R" && d.spin === "L"
    const logged = (d) => d.path !== null && d.spin !== null

    const updateShot = (field, val) => {
      setSessionData(prev => prev.map((d, i) => i === step ? { ...d, [field]: val } : d))
    }

    if (showSummary) {
      const total = data.filter(logged).length
      const pathR = data.filter(d => d.path === "R").length
      const spinL = data.filter(d => d.spin === "L").length
      const combos = data.filter(d => logged(d) && combo(d)).length
      const pathRPct = total > 0 ? Math.round((pathR / total) * 100) : 0
      const spinLPct = total > 0 ? Math.round((spinL / total) * 100) : 0
      const comboPct = total > 0 ? Math.round((combos / total) * 100) : 0

      return (
        <div>
          <Header title="Session Summary" onBack={() => setShowSummary(false)} backLabel="← Edit" />
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Path Right", val: pathRPct, count: pathR, color: "#60a5fa" },
              { label: "Spin Left", val: spinLPct, count: spinL, color: "#f472b6" },
              { label: "Path R + Spin L", val: comboPct, count: combos, color: "#4ade80" }
            ].map(s => (
              <div key={s.label} style={{ ...CARD, flex: 1, textAlign: "center" }}>
                <div style={{ fontFamily: BARLOW, fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}%</div>
                <div style={{ fontSize: 9, color: "#ddd", marginTop: 2 }}>{s.count}/{total}</div>
                <div style={{ fontSize: 10, color: "#bbb", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ ...CARD, display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#ddd" }}>Club: <span style={{ color: "#fff" }}>{arcClub}</span></span>
            <span style={{ fontSize: 13, color: "#ddd" }}>Location: <span style={{ color: "#fff" }}>{arcLocation}</span></span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {data.map((d, i) => (
              <div key={i} onClick={() => { setCardStep(i); setShowSummary(false) }}
                style={{
                  width: "calc(25% - 5px)", ...CARD, textAlign: "center", padding: 8, cursor: "pointer",
                  marginBottom: 0
                }}>
                <div style={{ fontSize: 11, color: "#ddd", marginBottom: 2 }}>#{i + 1}</div>
                {logged(d) ? (
                  <>
                    <div style={{ fontSize: 11 }}>
                      <span style={{ color: "#60a5fa" }}>{d.path}</span>
                      {" · "}
                      <span style={{ color: "#f472b6" }}>{d.spin}</span>
                    </div>
                    {combo(d) && <div style={{ fontSize: 9, color: "#4ade80" }}>✓</div>}
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "#ccc" }}>—</div>
                )}
              </div>
            ))}
          </div>
          <label style={LBL}>Session Notes</label>
          <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
            placeholder="Thoughts on this session..."
            style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
          <button onClick={saveSession} style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14, position: "fixed", bottom: 16, left: 16, right: 16, maxWidth: 398, margin: "0 auto", zIndex: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.6)" }}>
            Save Session
          </button>
        </div>
      )
    }

    const bothSelected = current.path !== null && current.spin !== null

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <span style={{ fontSize: 10, color: GREEN, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
              ⛳ Golf Practice
            </span>
            <button onClick={saveAndGoHome} style={{ ...BTN_BASE, background: "none", color: "#ddd", fontSize: 13, padding: "4px 8px" }}>
              ← Back
            </button>
          </div>
        </div>
        <h2 style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 22, color: "#fff", margin: "0 0 12px" }}>{activeDrill.name}</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Select label="Club" value={arcClub} onChange={setArcClub} options={CLUBS} />
          <Select label="Location" value={arcLocation} onChange={setArcLocation} options={LOCATIONS} />
        </div>

        <DotGrid items={data} current={step} onTap={setCardStep}
          colorFn={(d, i) => {
            if (!logged(d)) return { bg: "#444", label: `${i + 1}`, text: "#666" }
            if (combo(d)) return { bg: "#4ade8044", border: "#4ade80", label: "✓", text: "#4ade80" }
            return { bg: "#666", label: "·", text: "#ccc" }
          }}
        />

        <div style={{
          ...CARD, textAlign: "center", padding: 24, marginBottom: 14,
          background: "#1a1a2e", border: "1px solid #2a2a5a"
        }}>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 48, color: "#fff" }}>#{step + 1}</div>
          {bothSelected && (
            <div style={{ marginTop: 8, fontSize: 14 }}>
              <span style={{ color: "#60a5fa" }}>Path {current.path}</span>
              {" · "}
              <span style={{ color: "#f472b6" }}>Spin {current.spin}</span>
              {combo(current) && <span style={{ color: "#4ade80", marginLeft: 8 }}>✓ Combo</span>}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...LBL, color: "#60a5fa" }}>PATH</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["L", "R"].map(v => {
              const sel = current.path === v
              return (
                <button key={v} onClick={() => updateShot("path", v)}
                  style={{
                    ...BTN_BASE, flex: 1, fontSize: 16, fontWeight: 700,
                    background: sel ? "#60a5fa22" : "#1c1c1c",
                    color: sel ? "#60a5fa" : "#666",
                    border: sel ? "2px solid #60a5fa" : "2px solid #666"
                  }}>
                  {v}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ ...LBL, color: "#f472b6" }}>SPIN</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["L", "R"].map(v => {
              const sel = current.spin === v
              return (
                <button key={v} onClick={() => updateShot("spin", v)}
                  style={{
                    ...BTN_BASE, flex: 1, fontSize: 16, fontWeight: 700,
                    background: sel ? "#f472b622" : "#1c1c1c",
                    color: sel ? "#f472b6" : "#666",
                    border: sel ? "2px solid #f472b6" : "2px solid #666"
                  }}>
                  {v}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCardStep(Math.max(0, step - 1))} disabled={step === 0}
            style={{ ...BTN_BASE, flex: 1, background: "#333", color: step === 0 ? "#555" : "#ccc", border: "1px solid #666" }}>
            ← Prev
          </button>
          {step < data.length - 1 ? (
            <button onClick={() => setCardStep(step + 1)}
              style={{ ...BTN_BASE, flex: 1, background: bothSelected ? GREEN : "#1c1c1c", color: bothSelected ? "#fff" : "#666", border: `1px solid ${bothSelected ? GREEN : "#2a2a2a"}` }}>
              Next →
            </button>
          ) : (
            <button onClick={() => setShowSummary(true)}
              style={{ ...BTN_BASE, flex: 1, background: GREEN, color: "#fff" }}>
              Finish →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ──────────────────────────────
  // SHAPE RANDOMIZER
  // ──────────────────────────────
  const SHAPE_VALID_COMBOS = [
    { start: "Right", curve: "Straight" }, { start: "Right", curve: "Left" },
    { start: "At Pin", curve: "Right" }, { start: "At Pin", curve: "Straight" }, { start: "At Pin", curve: "Left" },
    { start: "Left", curve: "Right" }, { start: "Left", curve: "Straight" }
  ]
  const SHAPE_STARTS = ["Right", "At Pin", "Left"]
  const SHAPE_CURVES = ["Right", "Straight", "Left"]

  const ShapeRandomizerSession = () => {
    const data = sessionData

    const generateShots = (count) => {
      const shots = Array(count).fill(null).map((_, i) => {
        const combo = SHAPE_VALID_COMBOS[Math.floor(Math.random() * SHAPE_VALID_COMBOS.length)]
        return { shot: i, targetStart: combo.start, targetCurve: combo.curve, actualStart: null, actualCurve: null }
      })
      setSessionData({ count, shots })
      setCardStep(0)
    }

    // Setup: pick 10 or 20
    if (data.count === null) {
      return (
        <div>
          <Header title="Shape Randomizer" onBack={saveAndGoHome} />
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontFamily: BARLOW, fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 24 }}>
              How many shots?
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              {[10, 20].map(n => (
                <button key={n} onClick={() => generateShots(n)}
                  style={{ ...BTN_BASE, fontSize: 22, fontWeight: 700, padding: "20px 40px", background: GREEN, color: "#fff" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    const shots = data.shots
    const step = cardStep
    const current = shots[step]
    const logged = (d) => d.actualStart !== null && d.actualCurve !== null
    const bothMatch = (d) => logged(d) && d.actualStart === d.targetStart && d.actualCurve === d.targetCurve
    const startMatch = (d) => logged(d) && d.actualStart === d.targetStart
    const curveMatch = (d) => logged(d) && d.actualCurve === d.targetCurve

    const updateShot = (field, val) => {
      setSessionData(prev => ({
        ...prev,
        shots: prev.shots.map((d, i) => i === step ? { ...d, [field]: val } : d)
      }))
    }

    if (showSummary) {
      const total = shots.filter(logged).length
      const bothCount = shots.filter(bothMatch).length
      const startCount = shots.filter(startMatch).length
      const curveCount = shots.filter(curveMatch).length
      const bothPct = total > 0 ? Math.round((bothCount / total) * 100) : 0
      const startPct = total > 0 ? Math.round((startCount / total) * 100) : 0
      const curvePct = total > 0 ? Math.round((curveCount / total) * 100) : 0

      // Breakdown by target type
      const startBreakdown = SHAPE_STARTS.map(s => {
        const matching = shots.filter(d => d.targetStart === s && logged(d))
        const hit = matching.filter(d => d.actualStart === s).length
        return { label: s, hit, total: matching.length, pct: matching.length > 0 ? Math.round((hit / matching.length) * 100) : 0 }
      })
      const curveBreakdown = SHAPE_CURVES.map(c => {
        const matching = shots.filter(d => d.targetCurve === c && logged(d))
        const hit = matching.filter(d => d.actualCurve === c).length
        return { label: c, hit, total: matching.length, pct: matching.length > 0 ? Math.round((hit / matching.length) * 100) : 0 }
      })

      return (
        <div>
          <Header title="Session Summary" onBack={() => setShowSummary(false)} backLabel="← Edit" />
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Both", val: bothPct, count: bothCount, color: "#4ade80" },
              { label: "Start", val: startPct, count: startCount, color: "#60a5fa" },
              { label: "Curve", val: curvePct, count: curveCount, color: "#f472b6" }
            ].map(s => (
              <div key={s.label} style={{ ...CARD, flex: 1, textAlign: "center" }}>
                <div style={{ fontFamily: BARLOW, fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}%</div>
                <div style={{ fontSize: 9, color: "#ddd", marginTop: 2 }}>{s.count}/{total}</div>
                <div style={{ fontSize: 10, color: "#bbb", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ ...CARD, marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#ddd", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Start Breakdown</div>
            <div style={{ display: "flex", gap: 8 }}>
              {startBreakdown.map(b => (
                <div key={b.label} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontFamily: BARLOW, fontSize: 20, fontWeight: 700, color: pctColor(b.pct) }}>{b.pct}%</div>
                  <div style={{ fontSize: 9, color: "#bbb" }}>{b.hit}/{b.total}</div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...CARD, marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#ddd", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Curve Breakdown</div>
            <div style={{ display: "flex", gap: 8 }}>
              {curveBreakdown.map(b => (
                <div key={b.label} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontFamily: BARLOW, fontSize: 20, fontWeight: 700, color: pctColor(b.pct) }}>{b.pct}%</div>
                  <div style={{ fontSize: 9, color: "#bbb" }}>{b.hit}/{b.total}</div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {shots.map((d, i) => (
              <div key={i} onClick={() => { setCardStep(i); setShowSummary(false) }}
                style={{
                  width: "calc(25% - 5px)", ...CARD, textAlign: "center", padding: 8, cursor: "pointer",
                  marginBottom: 0
                }}>
                <div style={{ fontSize: 11, color: "#ddd", marginBottom: 2 }}>#{i + 1}</div>
                {logged(d) ? (
                  <>
                    <div style={{ fontSize: 9, color: "#aaa" }}>{d.targetStart[0]}→{d.targetCurve[0]}</div>
                    <div style={{ fontSize: 11 }}>
                      <span style={{ color: startMatch(d) ? "#60a5fa" : "#ef4444" }}>{d.actualStart[0]}</span>
                      {"→"}
                      <span style={{ color: curveMatch(d) ? "#f472b6" : "#ef4444" }}>{d.actualCurve[0]}</span>
                    </div>
                    {bothMatch(d) && <div style={{ fontSize: 9, color: "#4ade80" }}>✓</div>}
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "#ccc" }}>—</div>
                )}
              </div>
            ))}
          </div>
          <label style={LBL}>Session Notes</label>
          <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
            placeholder="Thoughts on this session..."
            style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
          <button onClick={saveSession} style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14, position: "fixed", bottom: 16, left: 16, right: 16, maxWidth: 398, margin: "0 auto", zIndex: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.6)" }}>
            Save Session
          </button>
        </div>
      )
    }

    const bothSelected = current.actualStart !== null && current.actualCurve !== null

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <span style={{ fontSize: 10, color: GREEN, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
              ⛳ Golf Practice
            </span>
            <button onClick={saveAndGoHome} style={{ ...BTN_BASE, background: "none", color: "#ddd", fontSize: 13, padding: "4px 8px" }}>
              ← Back
            </button>
          </div>
        </div>
        <h2 style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 22, color: "#fff", margin: "0 0 12px" }}>Shape Randomizer</h2>

        <DotGrid items={shots} current={step} onTap={setCardStep}
          colorFn={(d, i) => {
            if (!logged(d)) return { bg: "#444", label: `${i + 1}`, text: "#666" }
            if (bothMatch(d)) return { bg: "#4ade8044", border: "#4ade80", label: "✓", text: "#4ade80" }
            if (startMatch(d) || curveMatch(d)) return { bg: "#facc1544", border: "#facc15", label: "½", text: "#facc15" }
            return { bg: "#ef444444", border: "#ef4444", label: "✗", text: "#ef4444" }
          }}
        />

        <div style={{
          ...CARD, textAlign: "center", padding: 24, marginBottom: 14,
          background: "#1a1a2e", border: "1px solid #2a2a5a"
        }}>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 48, color: "#fff" }}>#{step + 1}</div>
          <div style={{ marginTop: 8, fontSize: 16 }}>
            <span style={{ color: "#60a5fa" }}>Start {current.targetStart}</span>
            {" · "}
            <span style={{ color: "#f472b6" }}>Curve {current.targetCurve}</span>
          </div>
          {bothSelected && (
            <div style={{ marginTop: 8, fontSize: 13, color: "#aaa" }}>
              Actual: <span style={{ color: startMatch(current) ? "#60a5fa" : "#ef4444" }}>{current.actualStart}</span>
              {" · "}
              <span style={{ color: curveMatch(current) ? "#f472b6" : "#ef4444" }}>{current.actualCurve}</span>
              {bothMatch(current) && <span style={{ color: "#4ade80", marginLeft: 8 }}>✓</span>}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...LBL, color: "#60a5fa" }}>ACTUAL START</label>
          <div style={{ display: "flex", gap: 8 }}>
            {SHAPE_STARTS.map(v => {
              const sel = current.actualStart === v
              return (
                <button key={v} onClick={() => updateShot("actualStart", v)}
                  style={{
                    ...BTN_BASE, flex: 1, fontSize: 14, fontWeight: 700,
                    background: sel ? "#60a5fa22" : "#1c1c1c",
                    color: sel ? "#60a5fa" : "#666",
                    border: sel ? "2px solid #60a5fa" : "2px solid #666"
                  }}>
                  {v}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ ...LBL, color: "#f472b6" }}>ACTUAL CURVE</label>
          <div style={{ display: "flex", gap: 8 }}>
            {SHAPE_CURVES.map(v => {
              const sel = current.actualCurve === v
              return (
                <button key={v} onClick={() => updateShot("actualCurve", v)}
                  style={{
                    ...BTN_BASE, flex: 1, fontSize: 14, fontWeight: 700,
                    background: sel ? "#f472b622" : "#1c1c1c",
                    color: sel ? "#f472b6" : "#666",
                    border: sel ? "2px solid #f472b6" : "2px solid #666"
                  }}>
                  {v}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCardStep(Math.max(0, step - 1))} disabled={step === 0}
            style={{ ...BTN_BASE, flex: 1, background: "#333", color: step === 0 ? "#555" : "#ccc", border: "1px solid #666" }}>
            ← Prev
          </button>
          {step < shots.length - 1 ? (
            <button onClick={() => setCardStep(step + 1)}
              style={{ ...BTN_BASE, flex: 1, background: bothSelected ? GREEN : "#1c1c1c", color: bothSelected ? "#fff" : "#666", border: `1px solid ${bothSelected ? GREEN : "#2a2a2a"}` }}>
              Next →
            </button>
          ) : (
            <button onClick={() => setShowSummary(true)}
              style={{ ...BTN_BASE, flex: 1, background: GREEN, color: "#fff" }}>
              Finish →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ──────────────────────────────
  // TOE/HEEL STRIKE
  // ──────────────────────────────
  const STRIKE_ZONES = ["Far Toe", "Toe", "Middle", "Heel", "Far Heel"]

  const ToeHeelStrikeSession = () => {
    const data = sessionData

    const generateShots = (count) => {
      const shots = Array(count).fill(null).map((_, i) => ({
        shot: i,
        target: STRIKE_ZONES[Math.floor(Math.random() * STRIKE_ZONES.length)],
        result: null
      }))
      setSessionData({ count, shots })
      setCardStep(0)
    }

    // Setup: pick 10 or 20
    if (data.count === null) {
      return (
        <div>
          <Header title="Toe/Heel Strike" onBack={saveAndGoHome} />
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontFamily: BARLOW, fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 24 }}>
              How many shots?
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              {[10, 20].map(n => (
                <button key={n} onClick={() => generateShots(n)}
                  style={{ ...BTN_BASE, fontSize: 22, fontWeight: 700, padding: "20px 40px", background: GREEN, color: "#fff" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    const shots = data.shots
    const step = cardStep
    const current = shots[step]
    const logged = (d) => d.result !== null
    const hit = (d) => d.result === true

    const updateShot = (val) => {
      setSessionData(prev => ({
        ...prev,
        shots: prev.shots.map((d, i) => i === step ? { ...d, result: val } : d)
      }))
    }

    if (showSummary) {
      const total = shots.filter(logged).length
      const hits = shots.filter(hit).length
      const hitPct = total > 0 ? Math.round((hits / total) * 100) : 0

      const zoneBreakdown = STRIKE_ZONES.map(z => {
        const matching = shots.filter(d => d.target === z && logged(d))
        const zHits = matching.filter(hit).length
        return { label: z, hit: zHits, total: matching.length, pct: matching.length > 0 ? Math.round((zHits / matching.length) * 100) : 0 }
      })

      return (
        <div>
          <Header title="Session Summary" onBack={() => setShowSummary(false)} backLabel="← Edit" />
          <div style={{ ...CARD, textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: BARLOW, fontSize: 42, fontWeight: 700, color: pctColor(hitPct) }}>{hitPct}%</div>
            <div style={{ fontSize: 11, color: "#ddd", marginTop: 2 }}>{hits}/{total} hit</div>
            <div style={{ fontSize: 10, color: "#bbb", marginTop: 4 }}>Overall</div>
          </div>

          <div style={{ ...CARD, marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#ddd", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>By Zone</div>
            <div style={{ display: "flex", gap: 6 }}>
              {zoneBreakdown.map(b => (
                <div key={b.label} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontFamily: BARLOW, fontSize: 18, fontWeight: 700, color: pctColor(b.pct) }}>{b.pct}%</div>
                  <div style={{ fontSize: 9, color: "#bbb" }}>{b.hit}/{b.total}</div>
                  <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {shots.map((d, i) => (
              <div key={i} onClick={() => { setCardStep(i); setShowSummary(false) }}
                style={{
                  width: "calc(25% - 5px)", ...CARD, textAlign: "center", padding: 8, cursor: "pointer",
                  marginBottom: 0
                }}>
                <div style={{ fontSize: 11, color: "#ddd", marginBottom: 2 }}>#{i + 1}</div>
                <div style={{ fontSize: 9, color: "#aaa" }}>{d.target}</div>
                {logged(d) ? (
                  <div style={{ fontSize: 13, color: hit(d) ? "#4ade80" : "#ef4444" }}>{hit(d) ? "✓" : "✗"}</div>
                ) : (
                  <div style={{ fontSize: 11, color: "#ccc" }}>—</div>
                )}
              </div>
            ))}
          </div>
          <label style={LBL}>Session Notes</label>
          <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
            placeholder="Thoughts on this session..."
            style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
          <button onClick={saveSession} style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14, position: "fixed", bottom: 16, left: 16, right: 16, maxWidth: 398, margin: "0 auto", zIndex: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.6)" }}>
            Save Session
          </button>
        </div>
      )
    }

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <span style={{ fontSize: 10, color: GREEN, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
              ⛳ Golf Practice
            </span>
            <button onClick={saveAndGoHome} style={{ ...BTN_BASE, background: "none", color: "#ddd", fontSize: 13, padding: "4px 8px" }}>
              ← Back
            </button>
          </div>
        </div>
        <h2 style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 22, color: "#fff", margin: "0 0 12px" }}>Toe/Heel Strike</h2>

        <DotGrid items={shots} current={step} onTap={setCardStep}
          colorFn={(d, i) => {
            if (!logged(d)) return { bg: "#444", label: `${i + 1}`, text: "#666" }
            if (hit(d)) return { bg: "#4ade8044", border: "#4ade80", label: "✓", text: "#4ade80" }
            return { bg: "#ef444444", border: "#ef4444", label: "✗", text: "#ef4444" }
          }}
        />

        <div style={{
          ...CARD, textAlign: "center", padding: 24, marginBottom: 14,
          background: "#1a1a2e", border: "1px solid #2a2a5a"
        }}>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 48, color: "#fff" }}>#{step + 1}</div>
          <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: "#60a5fa" }}>{current.target}</div>
          {current.result !== null && (
            <div style={{ marginTop: 8, fontSize: 16, color: hit(current) ? "#4ade80" : "#ef4444" }}>
              {hit(current) ? "✓ Hit" : "✗ Miss"}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {[{ label: "✓ Hit", val: true, color: "#4ade80" }, { label: "✗ Miss", val: false, color: "#ef4444" }].map(opt => {
            const sel = current.result === opt.val
            return (
              <button key={opt.label} onClick={() => updateShot(opt.val)}
                style={{
                  ...BTN_BASE, flex: 1, fontSize: 18, fontWeight: 700, padding: "16px 0",
                  background: sel ? `${opt.color}22` : "#1c1c1c",
                  color: sel ? opt.color : "#666",
                  border: sel ? `2px solid ${opt.color}` : "2px solid #666"
                }}>
                {opt.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCardStep(Math.max(0, step - 1))} disabled={step === 0}
            style={{ ...BTN_BASE, flex: 1, background: "#333", color: step === 0 ? "#555" : "#ccc", border: "1px solid #666" }}>
            ← Prev
          </button>
          {step < shots.length - 1 ? (
            <button onClick={() => setCardStep(step + 1)}
              style={{ ...BTN_BASE, flex: 1, background: current.result !== null ? GREEN : "#1c1c1c", color: current.result !== null ? "#fff" : "#666", border: `1px solid ${current.result !== null ? GREEN : "#2a2a2a"}` }}>
              Next →
            </button>
          ) : (
            <button onClick={() => setShowSummary(true)}
              style={{ ...BTN_BASE, flex: 1, background: GREEN, color: "#fff" }}>
              Finish →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ──────────────────────────────
  // PUTTING LADDER
  // ──────────────────────────────
  const PuttingLadderSession = () => {
    const data = sessionData
    const putts = Number(data.putts) || 0
    const dist = Number(data.distance) || 0
    const avg = putts > 0 && dist > 0 ? (dist / putts).toFixed(1) : null

    const update = (field, val) => setSessionData(prev => ({ ...prev, [field]: val }))

    return (
      <div>
        <Header title={activeDrill.name} onBack={saveAndGoHome} />
        <label style={LBL}>Location</label>
        <input type="text" value={data.location} onChange={e => update("location", e.target.value)}
          placeholder="e.g. Westwood CC, back green"
          style={{ ...INP, marginBottom: 14 }} />

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={LBL}># of Putts</label>
            <input type="text" inputMode="numeric" value={data.putts}
              onChange={e => update("putts", e.target.value.replace(/[^0-9]/g, ""))}
              style={{ ...INP, textAlign: "center", fontSize: 28, fontFamily: BARLOW, fontWeight: 700 }} placeholder="0" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={LBL}>Total Distance (ft)</label>
            <input type="text" inputMode="decimal" value={data.distance}
              onChange={e => update("distance", e.target.value.replace(/[^0-9.]/g, ""))}
              style={{ ...INP, textAlign: "center", fontSize: 28, fontFamily: BARLOW, fontWeight: 700 }} placeholder="0" />
          </div>
        </div>

        {avg && (
          <div style={{ ...CARD, textAlign: "center", marginBottom: 14, background: GREEN_DIM, border: `1px solid ${GREEN}44` }}>
            <div style={{ fontSize: 11, color: "#ddd", marginBottom: 2 }}>Avg Distance / Putt</div>
            <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 32, color: GREEN_LIGHT }}>{avg} ft</div>
          </div>
        )}

        <label style={LBL}>Notes</label>
        <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
          placeholder="Green speed, break tendencies, anything notable..."
          style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
        <button onClick={saveSession}
          style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14, position: "fixed", bottom: 16, left: 16, right: 16, maxWidth: 398, margin: "0 auto", zIndex: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.6)" }}>
          Save Session
        </button>
      </div>
    )
  }

  // ──────────────────────────────
  // 4-FOOTER DRILL
  // ──────────────────────────────
  const FourFooterSession = () => {
    const data = sessionData
    const made = data.made
    const makePct = made !== "" ? Number(made) * 10 : null

    const update = (field, val) => setSessionData(prev => ({ ...prev, [field]: val }))

    return (
      <div>
        <Header title={activeDrill.name} onBack={saveAndGoHome} />
        <label style={LBL}>Location</label>
        <input type="text" value={data.location} onChange={e => update("location", e.target.value)}
          placeholder="e.g. Home putting mat"
          style={{ ...INP, marginBottom: 14 }} />

        <label style={LBL}>Putts Made (out of 10)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {Array.from({ length: 11 }, (_, i) => {
            const sel = made === i
            return (
              <button key={i} onClick={() => update("made", i)}
                style={{
                  ...BTN_BASE, width: 52, height: 48, fontSize: 18, fontFamily: BARLOW, fontWeight: 700,
                  background: sel ? "#c084fc22" : "#1c1c1c",
                  color: sel ? "#c084fc" : "#666",
                  border: sel ? "2px solid #c084fc" : "2px solid #666"
                }}>
                {i}
              </button>
            )
          })}
        </div>

        {makePct !== null && (
          <div style={{ ...CARD, textAlign: "center", marginBottom: 14, background: pctColor(makePct) + "11", border: `1px solid ${pctColor(makePct)}44` }}>
            <div style={{ fontSize: 11, color: "#ddd", marginBottom: 2 }}>Make Rate</div>
            <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 32, color: pctColor(makePct) }}>{makePct}%</div>
          </div>
        )}

        <label style={LBL}>Notes</label>
        <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
          placeholder="Stroke thoughts, tendencies..."
          style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
        <button onClick={saveSession}
          style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14, position: "fixed", bottom: 16, left: 16, right: 16, maxWidth: 398, margin: "0 auto", zIndex: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.6)" }}>
          Save Session
        </button>
      </div>
    )
  }

  // ──────────────────────────────
  // STRIKE LOG
  // ──────────────────────────────
  const StrikeLogSession = () => {
    const data = sessionData

    const addRep = () => {
      setSessionData(prev => [...prev, { grade: null, location: "Basement", note: "" }])
    }

    const updateRep = (idx, field, val) => {
      setSessionData(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))
    }

    const deleteRep = (idx) => {
      setSessionData(prev => prev.filter((_, i) => i !== idx))
    }

    return (
      <div>
        <Header title={activeDrill.name} onBack={saveAndGoHome} />
        <button onClick={addRep}
          style={{
            ...BTN_BASE, width: "100%", background: "transparent", color: GREEN,
            border: `2px dashed ${GREEN}66`, marginBottom: 14, fontSize: 15
          }}>
          ＋ Add Rep
        </button>

        {data.map((rep, i) => (
          <div key={i} style={{ ...CARD }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 16, color: "#fff" }}>Rep {i + 1}</span>
              <button onClick={() => deleteRep(i)}
                style={{ ...BTN_BASE, background: "none", color: "#bbb", fontSize: 18, padding: "2px 6px" }}>×</button>
            </div>
            <label style={LBL}>Grade</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {STRIKE_GRADES.map(g => {
                const sel = rep.grade === g
                return (
                  <button key={g} onClick={() => updateRep(i, "grade", g)}
                    style={{
                      ...BTN_BASE, flex: 1, fontSize: 16, fontFamily: BARLOW, fontWeight: 700,
                      background: sel ? GREEN_DIM : "#1c1c1c",
                      color: sel ? GREEN_LIGHT : "#666",
                      border: sel ? `2px solid ${GREEN}` : "2px solid #666",
                      padding: "10px 0"
                    }}>
                    {g}
                  </button>
                )
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={LBL}>Location</label>
                <select value={rep.location} onChange={e => updateRep(i, "location", e.target.value)}
                  style={{ ...INP, cursor: "pointer" }}>
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={LBL}>Note</label>
                <input type="text" value={rep.note} onChange={e => updateRep(i, "note", e.target.value)}
                  placeholder="Optional" style={INP} />
              </div>
            </div>
          </div>
        ))}

        {data.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#ccc" }}>
            Tap "＋ Add Rep" to start logging
          </div>
        )}

        <label style={{ ...LBL, marginTop: 14 }}>Session Notes</label>
        <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
          placeholder="Overall session thoughts..."
          style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
        <button onClick={saveSession} disabled={data.length === 0}
          style={{
            ...BTN_BASE, width: "100%", fontSize: 16, padding: 14,
            background: data.length === 0 ? "#333" : GREEN,
            color: data.length === 0 ? "#666" : "#fff"
          }}>
          Save Session
        </button>
      </div>
    )
  }

  // ──────────────────────────────
  // DRIVER UPRIGHTS
  // ──────────────────────────────
  const DriverUprightsSession = () => {
    const data = sessionData
    const step = cardStep
    const current = data[step]

    const logged = (d) => d.uprights !== null && d.shape !== null
    const hit = (d) => d.uprights === true

    const updateShot = (field, val) => {
      setSessionData(prev => prev.map((d, i) => i === step ? { ...d, [field]: val } : d))
    }

    if (showSummary) {
      const total = data.filter(logged).length
      const hits = data.filter(d => logged(d) && hit(d)).length
      const hitPct = total > 0 ? Math.round((hits / total) * 100) : 0
      const shapeCounts = {}
      SHOT_SHAPES.forEach(s => { shapeCounts[s] = data.filter(d => d.shape === s).length })

      return (
        <div>
          <Header title="Session Summary" onBack={() => setShowSummary(false)} backLabel="← Edit" />
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: BARLOW, fontSize: 72, fontWeight: 700, color: pctColor(hitPct) }}>{hitPct}%</div>
            <div style={{ color: "#ddd", fontSize: 14 }}>Fairway Hit Rate · {hits}/{total}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {SHOT_SHAPES.map(s => (
              <div key={s} style={{ ...CARD, flex: "1 1 calc(33% - 6px)", textAlign: "center", minWidth: 80 }}>
                <div style={{ fontFamily: BARLOW, fontSize: 24, fontWeight: 700, color: "#fff" }}>{shapeCounts[s]}</div>
                <div style={{ fontSize: 10, color: "#ddd" }}>{s}</div>
              </div>
            ))}
          </div>
          <div style={{ ...CARD, display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#ddd" }}>Club: <span style={{ color: "#fff" }}>{arcClub}</span></span>
            <span style={{ fontSize: 13, color: "#ddd" }}>Location: <span style={{ color: "#fff" }}>{arcLocation}</span></span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {data.map((d, i) => (
              <div key={i} onClick={() => { setCardStep(i); setShowSummary(false) }}
                style={{
                  width: "calc(25% - 5px)", ...CARD, textAlign: "center", padding: 8, cursor: "pointer",
                  marginBottom: 0
                }}>
                <div style={{ fontSize: 11, color: "#ddd", marginBottom: 2 }}>#{i + 1}</div>
                {logged(d) ? (
                  <>
                    <div style={{ fontSize: 13, color: hit(d) ? "#5eeb96" : "#ef4444", fontWeight: 700 }}>
                      {hit(d) ? "✓" : "✗"}
                    </div>
                    <div style={{ fontSize: 9, color: "#ccc" }}>{d.shape}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "#666" }}>—</div>
                )}
              </div>
            ))}
          </div>
          <label style={LBL}>Session Notes</label>
          <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
            placeholder="Thoughts on this session..."
            style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
          <button onClick={saveSession} style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14, position: "fixed", bottom: 16, left: 16, right: 16, maxWidth: 398, margin: "0 auto", zIndex: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.6)" }}>
            Save Session
          </button>
        </div>
      )
    }

    const bothSelected = current.uprights !== null && current.shape !== null

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <span style={{ fontSize: 10, color: GREEN, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
              ⛳ Golf Practice
            </span>
            <button onClick={saveAndGoHome} style={{ ...BTN_BASE, background: "none", color: "#ddd", fontSize: 13, padding: "4px 8px" }}>
              ← Back
            </button>
          </div>
        </div>
        <h2 style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 22, color: "#fff", margin: "0 0 12px" }}>{activeDrill.name}</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Select label="Club" value={arcClub} onChange={setArcClub} options={CLUBS} />
          <Select label="Location" value={arcLocation} onChange={setArcLocation} options={LOCATIONS} />
        </div>

        <DotGrid items={data} current={step} onTap={setCardStep}
          colorFn={(d, i) => {
            if (!logged(d)) return { bg: "#444", label: `${i + 1}`, text: "#ccc" }
            if (hit(d)) return { bg: "#5eeb9644", border: "#5eeb96", label: "✓", text: "#5eeb96" }
            return { bg: "#ef444444", border: "#ef4444", label: "✗", text: "#ef4444" }
          }}
        />

        <div style={{
          ...CARD, textAlign: "center", padding: 24, marginBottom: 14,
          background: "#1a2e1a", border: "1px solid #2a5a2a"
        }}>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 48, color: "#fff" }}>#{step + 1}</div>
          {bothSelected && (
            <div style={{ marginTop: 8, fontSize: 14 }}>
              <span style={{ color: current.uprights ? "#5eeb96" : "#ef4444", fontWeight: 700 }}>
                {current.uprights ? "✓ Fairway" : "✗ Missed"}
              </span>
              <span style={{ color: "#ccc", marginLeft: 8 }}>{current.shape}</span>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...LBL, color: "#5eeb96" }}>IN THE UPRIGHTS?</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ val: true, label: "YES", color: "#5eeb96" }, { val: false, label: "NO", color: "#ef4444" }].map(b => {
              const sel = current.uprights === b.val
              return (
                <button key={b.label} onClick={() => updateShot("uprights", b.val)}
                  style={{
                    ...BTN_BASE, flex: 1, fontSize: 16, fontWeight: 700,
                    background: sel ? b.color + "22" : "#333",
                    color: sel ? b.color : "#ccc",
                    border: sel ? `2px solid ${b.color}` : "2px solid #666"
                  }}>
                  {b.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ ...LBL, color: "#60a5fa" }}>SHOT SHAPE</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SHOT_SHAPES.map(s => {
              const sel = current.shape === s
              return (
                <button key={s} onClick={() => updateShot("shape", s)}
                  style={{
                    ...BTN_BASE, flex: "1 1 calc(33% - 4px)", fontSize: 13, fontWeight: 700,
                    background: sel ? "#60a5fa22" : "#333",
                    color: sel ? "#60a5fa" : "#ccc",
                    border: sel ? "2px solid #60a5fa" : "2px solid #666",
                    padding: "10px 8px"
                  }}>
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCardStep(Math.max(0, step - 1))} disabled={step === 0}
            style={{ ...BTN_BASE, flex: 1, background: "#333", color: step === 0 ? "#555" : "#ccc", border: "1px solid #666" }}>
            ← Prev
          </button>
          {step < data.length - 1 ? (
            <button onClick={() => setCardStep(step + 1)}
              style={{ ...BTN_BASE, flex: 1, background: bothSelected ? GREEN : "#333", color: bothSelected ? "#fff" : "#ccc", border: `1px solid ${bothSelected ? GREEN : "#666"}` }}>
              Next →
            </button>
          ) : (
            <button onClick={() => setShowSummary(true)}
              style={{ ...BTN_BASE, flex: 1, background: GREEN, color: "#fff" }}>
              Finish →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ──────────────────────────────
  // START LINE
  // ──────────────────────────────
  const StartLineSession = () => {
    const data = sessionData
    const step = cardStep
    const current = data[step]

    const logged = (d) => d.gate !== null && d.lineRight !== null && d.break_dir !== null

    const updateShot = (field, val) => {
      setSessionData(prev => prev.map((d, i) => i === step ? { ...d, [field]: val } : d))
    }

    if (showSummary) {
      const total = data.filter(logged).length
      const gates = data.filter(d => d.gate === true).length
      const gatePct = total > 0 ? Math.round((gates / total) * 100) : 0
      const lineAll = data.filter(d => logged(d) && d.lineRight === true).length
      const lineAllPct = total > 0 ? Math.round((lineAll / total) * 100) : 0

      const breakStats = PUTT_BREAKS.map(b => {
        const putts = data.filter(d => logged(d) && d.break_dir === b)
        const right = putts.filter(d => d.lineRight === true).length
        const pct = putts.length > 0 ? Math.round((right / putts.length) * 100) : null
        return { label: b, right, total: putts.length, pct }
      })

      return (
        <div>
          <Header title="Session Summary" onBack={() => setShowSummary(false)} backLabel="← Edit" />
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: BARLOW, fontSize: 72, fontWeight: 700, color: pctColor(gatePct) }}>{gatePct}%</div>
            <div style={{ color: "#ddd", fontSize: 14 }}>Through the Gate · {gates}/{total}</div>
          </div>
          <div style={{ ...CARD, textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: BARLOW, fontSize: 36, fontWeight: 700, color: pctColor(lineAllPct) }}>{lineAllPct}%</div>
            <div style={{ fontSize: 11, color: "#ddd" }}>Line Right (All Putts) · {lineAll}/{total}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {breakStats.map(s => (
              <div key={s.label} style={{ ...CARD, flex: 1, textAlign: "center" }}>
                <div style={{ fontFamily: BARLOW, fontSize: 24, fontWeight: 700, color: s.pct !== null ? pctColor(s.pct) : "#bbb" }}>
                  {s.pct !== null ? `${s.pct}%` : "—"}
                </div>
                <div style={{ fontSize: 9, color: "#ddd", marginTop: 2 }}>{s.right}/{s.total}</div>
                <div style={{ fontSize: 9, color: "#bbb", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {data.map((d, i) => (
              <div key={i} onClick={() => { setCardStep(i); setShowSummary(false) }}
                style={{
                  width: "calc(25% - 5px)", ...CARD, textAlign: "center", padding: 8, cursor: "pointer",
                  marginBottom: 0
                }}>
                <div style={{ fontSize: 11, color: "#ddd", marginBottom: 2 }}>#{i + 1}</div>
                {logged(d) ? (
                  <>
                    <div style={{ fontSize: 13, color: d.gate ? "#5eeb96" : "#ef4444", fontWeight: 700 }}>
                      {d.gate ? "✓" : "✗"}
                    </div>
                    <div style={{ fontSize: 8, color: d.lineRight ? "#5eeb96" : "#ef4444" }}>
                      {d.lineRight ? "Line ✓" : "Line ✗"}
                    </div>
                    <div style={{ fontSize: 8, color: "#ccc" }}>
                      {d.break_dir === "Left to Right" ? "L→R" : d.break_dir === "Right to Left" ? "R→L" : "Str"}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "#666" }}>—</div>
                )}
              </div>
            ))}
          </div>
          <label style={LBL}>Session Notes</label>
          <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
            placeholder="Thoughts on this session..."
            style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
          <button onClick={saveSession} style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14, position: "fixed", bottom: 16, left: 16, right: 16, maxWidth: 398, margin: "0 auto", zIndex: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.6)" }}>
            Save Session
          </button>
        </div>
      )
    }

    const allSelected = current.gate !== null && current.lineRight !== null && current.break_dir !== null

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <span style={{ fontSize: 10, color: GREEN, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
              ⛳ Golf Practice
            </span>
            <button onClick={saveAndGoHome} style={{ ...BTN_BASE, background: "none", color: "#ddd", fontSize: 13, padding: "4px 8px" }}>
              ← Back
            </button>
          </div>
        </div>
        <h2 style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 22, color: "#fff", margin: "0 0 12px" }}>{activeDrill.name}</h2>

        <DotGrid items={data} current={step} onTap={setCardStep}
          colorFn={(d, i) => {
            if (!logged(d)) return { bg: "#444", label: `${i + 1}`, text: "#ccc" }
            if (d.gate && d.lineRight) return { bg: "#5eeb9644", border: "#5eeb96", label: "✓", text: "#5eeb96" }
            if (d.gate || d.lineRight) return { bg: "#facc1544", border: "#facc15", label: "·", text: "#facc15" }
            return { bg: "#ef444444", border: "#ef4444", label: "✗", text: "#ef4444" }
          }}
        />

        <div style={{
          ...CARD, textAlign: "center", padding: 24, marginBottom: 14,
          background: "#1a1a2e", border: "1px solid #2a2a5a"
        }}>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 48, color: "#fff" }}>#{step + 1}</div>
          {allSelected && (
            <div style={{ marginTop: 8, fontSize: 14 }}>
              <span style={{ color: current.gate ? "#5eeb96" : "#ef4444", fontWeight: 700 }}>
                {current.gate ? "✓ Gate" : "✗ Gate"}
              </span>
              <span style={{ color: current.lineRight ? "#5eeb96" : "#ef4444", marginLeft: 10, fontWeight: 700 }}>
                {current.lineRight ? "✓ Line" : "✗ Line"}
              </span>
              <span style={{ color: "#ccc", marginLeft: 10 }}>{current.break_dir}</span>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...LBL, color: "#5eeb96" }}>THROUGH THE GATE?</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ val: true, label: "YES", color: "#5eeb96" }, { val: false, label: "NO", color: "#ef4444" }].map(b => {
              const sel = current.gate === b.val
              return (
                <button key={b.label} onClick={() => updateShot("gate", b.val)}
                  style={{
                    ...BTN_BASE, flex: 1, fontSize: 16, fontWeight: 700,
                    background: sel ? b.color + "22" : "#333",
                    color: sel ? b.color : "#ccc",
                    border: sel ? `2px solid ${b.color}` : "2px solid #666"
                  }}>
                  {b.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...LBL, color: "#60a5fa" }}>LINE RIGHT?</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ val: true, label: "YES", color: "#5eeb96" }, { val: false, label: "NO", color: "#ef4444" }].map(b => {
              const sel = current.lineRight === b.val
              return (
                <button key={b.label} onClick={() => updateShot("lineRight", b.val)}
                  style={{
                    ...BTN_BASE, flex: 1, fontSize: 16, fontWeight: 700,
                    background: sel ? b.color + "22" : "#333",
                    color: sel ? b.color : "#ccc",
                    border: sel ? `2px solid ${b.color}` : "2px solid #666"
                  }}>
                  {b.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ ...LBL, color: "#c084fc" }}>PUTT BREAK</label>
          <div style={{ display: "flex", gap: 6 }}>
            {PUTT_BREAKS.map(b => {
              const sel = current.break_dir === b
              const short = b === "Left to Right" ? "L → R" : b === "Right to Left" ? "R → L" : "Straight"
              return (
                <button key={b} onClick={() => updateShot("break_dir", b)}
                  style={{
                    ...BTN_BASE, flex: 1, fontSize: 13, fontWeight: 700,
                    background: sel ? "#c084fc22" : "#333",
                    color: sel ? "#c084fc" : "#ccc",
                    border: sel ? "2px solid #c084fc" : "2px solid #666",
                    padding: "10px 6px"
                  }}>
                  {short}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCardStep(Math.max(0, step - 1))} disabled={step === 0}
            style={{ ...BTN_BASE, flex: 1, background: "#333", color: step === 0 ? "#555" : "#ccc", border: "1px solid #666" }}>
            ← Prev
          </button>
          {step < data.length - 1 ? (
            <button onClick={() => setCardStep(step + 1)}
              style={{ ...BTN_BASE, flex: 1, background: allSelected ? GREEN : "#333", color: allSelected ? "#fff" : "#ccc", border: `1px solid ${allSelected ? GREEN : "#666"}` }}>
              Next →
            </button>
          ) : (
            <button onClick={() => setShowSummary(true)}
              style={{ ...BTN_BASE, flex: 1, background: GREEN, color: "#fff" }}>
              Finish →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ──────────────────────────────
  // LAG
  // ──────────────────────────────
  const LagSession = () => {
    const data = sessionData

    // Setup screen: choose 10 or 20
    if (data.count === null) {
      return (
        <div>
          <Header title="Lag" onBack={saveAndGoHome} />
          <div style={{ textAlign: "center", padding: "40px 0 20px" }}>
            <div style={{ fontSize: 14, color: "#ddd", marginBottom: 20 }}>How many putts?</div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              {[10, 20].map(n => (
                <button key={n} onClick={() => {
                  setSessionData({
                    count: n,
                    putts: Array(n).fill(null).map((_, i) => ({
                      shot: i, totalPutts: "", firstDist: "", break_dir: null,
                      slope: null, result: null, secondDist: ""
                    }))
                  })
                }}
                  style={{
                    ...BTN_BASE, width: 100, height: 80, fontSize: 32, fontFamily: BARLOW, fontWeight: 700,
                    background: GREEN_DIM, color: GREEN_LIGHT, border: `2px solid ${GREEN}`
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    const putts = data.putts
    const step = cardStep
    const current = putts[step]

    const logged = (d) => d.totalPutts !== "" && d.break_dir !== null && d.slope !== null && d.result !== null

    const updatePutt = (field, val) => {
      setSessionData(prev => ({
        ...prev,
        putts: prev.putts.map((d, i) => i === step ? { ...d, [field]: val } : d)
      }))
    }

    if (showSummary) {
      const total = putts.filter(logged).length
      // Overall result breakdown
      const shorts = putts.filter(d => d.result === "Short").length
      const evens = putts.filter(d => d.result === "Even").length
      const longs = putts.filter(d => d.result === "Long").length

      // Avg putts and 2-putt-or-less %
      const puttCounts = putts.filter(d => d.totalPutts !== "" && !isNaN(Number(d.totalPutts)))
      const avgPutts = puttCounts.length > 0
        ? (puttCounts.reduce((s, d) => s + Number(d.totalPutts), 0) / puttCounts.length).toFixed(1)
        : null
      const twoPuttOrLess = puttCounts.filter(d => Number(d.totalPutts) <= 2).length
      const twoPuttPct = puttCounts.length > 0 ? Math.round((twoPuttOrLess / puttCounts.length) * 100) : 0

      // By slope
      const slopeStats = LAG_SLOPES.map(s => {
        const group = putts.filter(d => d.slope === s && d.result !== null)
        return {
          label: s,
          total: group.length,
          short: group.filter(d => d.result === "Short").length,
          even: group.filter(d => d.result === "Even").length,
          long: group.filter(d => d.result === "Long").length,
        }
      })

      // By break
      const breakStats = PUTT_BREAKS.map(b => {
        const group = putts.filter(d => d.break_dir === b && d.result !== null)
        return {
          label: b,
          short: b === "Left to Right" ? "L→R" : b === "Right to Left" ? "R→L" : "Str",
          total: group.length,
          shortCount: group.filter(d => d.result === "Short").length,
          even: group.filter(d => d.result === "Even").length,
          long: group.filter(d => d.result === "Long").length,
        }
      })

      // Avg 2nd putt distance
      const secondDists = putts.filter(d => d.secondDist !== "" && !isNaN(Number(d.secondDist)))
      const avgSecond = secondDists.length > 0
        ? (secondDists.reduce((s, d) => s + Number(d.secondDist), 0) / secondDists.length).toFixed(1)
        : null

      return (
        <div>
          <Header title="Session Summary" onBack={() => setShowSummary(false)} backLabel="← Edit" />
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: BARLOW, fontSize: 72, fontWeight: 700, color: pctColor(twoPuttPct) }}>
              {avgPutts || "—"}
            </div>
            <div style={{ color: "#ddd", fontSize: 14 }}>Avg Putts · {twoPuttPct}% two-putt or less</div>
          </div>

          {/* Overall result */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Short", val: shorts, color: "#60a5fa" },
              { label: "Even", val: evens, color: "#5eeb96" },
              { label: "Long", val: longs, color: "#fb923c" }
            ].map(s => (
              <div key={s.label} style={{ ...CARD, flex: 1, textAlign: "center" }}>
                <div style={{ fontFamily: BARLOW, fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: "#ddd" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {avgSecond && (
            <div style={{ ...CARD, textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: BARLOW, fontSize: 28, fontWeight: 700, color: GREEN_LIGHT }}>{avgSecond} ft</div>
              <div style={{ fontSize: 10, color: "#ddd" }}>Avg 2nd Putt Distance</div>
            </div>
          )}

          {/* By Slope */}
          <div style={{ fontSize: 11, color: "#ddd", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>By Slope</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {slopeStats.map(s => (
              <div key={s.label} style={{ ...CARD, flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#fff", fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                {s.total > 0 ? (
                  <div style={{ fontSize: 10, color: "#ccc" }}>
                    <span style={{ color: "#60a5fa" }}>S{s.short}</span>
                    {" · "}<span style={{ color: "#5eeb96" }}>E{s.even}</span>
                    {" · "}<span style={{ color: "#fb923c" }}>L{s.long}</span>
                  </div>
                ) : <div style={{ fontSize: 10, color: "#666" }}>—</div>}
              </div>
            ))}
          </div>

          {/* By Break */}
          <div style={{ fontSize: 11, color: "#ddd", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>By Break</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {breakStats.map(s => (
              <div key={s.label} style={{ ...CARD, flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#fff", fontWeight: 700, marginBottom: 4 }}>{s.short}</div>
                {s.total > 0 ? (
                  <div style={{ fontSize: 10, color: "#ccc" }}>
                    <span style={{ color: "#60a5fa" }}>S{s.shortCount}</span>
                    {" · "}<span style={{ color: "#5eeb96" }}>E{s.even}</span>
                    {" · "}<span style={{ color: "#fb923c" }}>L{s.long}</span>
                  </div>
                ) : <div style={{ fontSize: 10, color: "#666" }}>—</div>}
              </div>
            ))}
          </div>

          {/* Shot grid */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {putts.map((d, i) => (
              <div key={i} onClick={() => { setCardStep(i); setShowSummary(false) }}
                style={{
                  width: "calc(25% - 5px)", ...CARD, textAlign: "center", padding: 8, cursor: "pointer",
                  marginBottom: 0
                }}>
                <div style={{ fontSize: 11, color: "#ddd", marginBottom: 2 }}>#{i + 1}</div>
                {logged(d) ? (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: d.result === "Even" ? "#5eeb96" : d.result === "Short" ? "#60a5fa" : "#fb923c" }}>
                      {d.result}
                    </div>
                    <div style={{ fontSize: 8, color: "#ccc" }}>{d.totalPutts}p · {d.firstDist}ft</div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "#666" }}>—</div>
                )}
              </div>
            ))}
          </div>

          <label style={LBL}>Session Notes</label>
          <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
            placeholder="Thoughts on this session..."
            style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
          <button onClick={saveSession} style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14, position: "fixed", bottom: 16, left: 16, right: 16, maxWidth: 398, margin: "0 auto", zIndex: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.6)" }}>
            Save Session
          </button>
        </div>
      )
    }

    const allSelected = current.totalPutts !== "" && current.break_dir !== null && current.slope !== null && current.result !== null

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <span style={{ fontSize: 10, color: GREEN, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
              ⛳ Golf Practice
            </span>
            <button onClick={saveAndGoHome} style={{ ...BTN_BASE, background: "none", color: "#ddd", fontSize: 13, padding: "4px 8px" }}>
              ← Back
            </button>
          </div>
        </div>
        <h2 style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 22, color: "#fff", margin: "0 0 12px" }}>{activeDrill.name}</h2>

        <DotGrid items={putts} current={step} onTap={setCardStep}
          colorFn={(d, i) => {
            if (!logged(d)) return { bg: "#444", label: `${i + 1}`, text: "#ccc" }
            if (d.result === "Even") return { bg: "#5eeb9644", border: "#5eeb96", label: "✓", text: "#5eeb96" }
            if (d.result === "Short") return { bg: "#60a5fa44", border: "#60a5fa", label: "S", text: "#60a5fa" }
            return { bg: "#fb923c44", border: "#fb923c", label: "L", text: "#fb923c" }
          }}
        />

        <div style={{
          ...CARD, textAlign: "center", padding: 20, marginBottom: 14,
          background: "#1a1a2e", border: "1px solid #2a2a5a"
        }}>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 48, color: "#fff" }}>#{step + 1}</div>
          {allSelected && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <span style={{ color: current.result === "Even" ? "#5eeb96" : current.result === "Short" ? "#60a5fa" : "#fb923c", fontWeight: 700 }}>
                {current.result}
              </span>
              <span style={{ color: "#ccc", marginLeft: 8 }}>{current.slope} · {current.break_dir === "Left to Right" ? "L→R" : current.break_dir === "Right to Left" ? "R→L" : "Str"}</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={LBL}># of Putts</label>
            <input type="text" inputMode="numeric" value={current.totalPutts}
              onChange={e => updatePutt("totalPutts", e.target.value.replace(/[^0-9]/g, ""))}
              style={{ ...INP, textAlign: "center", fontSize: 22, fontFamily: BARLOW, fontWeight: 700 }} placeholder="0" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={LBL}>1st Putt Dist (ft)</label>
            <input type="text" inputMode="decimal" value={current.firstDist}
              onChange={e => updatePutt("firstDist", e.target.value.replace(/[^0-9.]/g, ""))}
              style={{ ...INP, textAlign: "center", fontSize: 22, fontFamily: BARLOW, fontWeight: 700 }} placeholder="0" />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...LBL, color: "#c084fc" }}>1ST PUTT BREAK</label>
          <div style={{ display: "flex", gap: 6 }}>
            {PUTT_BREAKS.map(b => {
              const sel = current.break_dir === b
              const short = b === "Left to Right" ? "L → R" : b === "Right to Left" ? "R → L" : "Straight"
              return (
                <button key={b} onClick={() => updatePutt("break_dir", b)}
                  style={{
                    ...BTN_BASE, flex: 1, fontSize: 12, fontWeight: 700,
                    background: sel ? "#c084fc22" : "#333",
                    color: sel ? "#c084fc" : "#ccc",
                    border: sel ? "2px solid #c084fc" : "2px solid #666",
                    padding: "10px 6px"
                  }}>
                  {short}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...LBL, color: "#facc15" }}>1ST PUTT SLOPE</label>
          <div style={{ display: "flex", gap: 6 }}>
            {LAG_SLOPES.map(s => {
              const sel = current.slope === s
              return (
                <button key={s} onClick={() => updatePutt("slope", s)}
                  style={{
                    ...BTN_BASE, flex: 1, fontSize: 12, fontWeight: 700,
                    background: sel ? "#facc1522" : "#333",
                    color: sel ? "#facc15" : "#ccc",
                    border: sel ? "2px solid #facc15" : "2px solid #666",
                    padding: "10px 6px"
                  }}>
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...LBL, color: "#5eeb96" }}>1ST PUTT RESULT</label>
          <div style={{ display: "flex", gap: 6 }}>
            {LAG_RESULTS.map(r => {
              const sel = current.result === r
              const color = r === "Even" ? "#5eeb96" : r === "Short" ? "#60a5fa" : "#fb923c"
              return (
                <button key={r} onClick={() => updatePutt("result", r)}
                  style={{
                    ...BTN_BASE, flex: 1, fontSize: 13, fontWeight: 700,
                    background: sel ? color + "22" : "#333",
                    color: sel ? color : "#ccc",
                    border: sel ? `2px solid ${color}` : "2px solid #666",
                    padding: "10px 6px"
                  }}>
                  {r}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={LBL}>2nd Putt Dist (ft)</label>
          <input type="text" inputMode="decimal" value={current.secondDist}
            onChange={e => updatePutt("secondDist", e.target.value.replace(/[^0-9.]/g, ""))}
            style={{ ...INP, textAlign: "center", fontSize: 22, fontFamily: BARLOW, fontWeight: 700 }} placeholder="0" />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCardStep(Math.max(0, step - 1))} disabled={step === 0}
            style={{ ...BTN_BASE, flex: 1, background: "#333", color: step === 0 ? "#555" : "#ccc", border: "1px solid #666" }}>
            ← Prev
          </button>
          {step < putts.length - 1 ? (
            <button onClick={() => setCardStep(step + 1)}
              style={{ ...BTN_BASE, flex: 1, background: allSelected ? GREEN : "#333", color: allSelected ? "#fff" : "#ccc", border: `1px solid ${allSelected ? GREEN : "#666"}` }}>
              Next →
            </button>
          ) : (
            <button onClick={() => setShowSummary(true)}
              style={{ ...BTN_BASE, flex: 1, background: GREEN, color: "#fff" }}>
              Finish →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ──────────────────────────────
  // HISTORY VIEW
  // ──────────────────────────────
  const HistoryView = () => {
    const drill = activeDrill
    const sessions = [...drill.sessions].reverse()

    const sessionSummary = (s) => {
      switch (drill.template) {
        case "distance_matrix": {
          const score = s.data.reduce((sum, d) =>
            d.miss !== "" && d.miss !== null ? sum + calcPoints(d.miss, d.distance) : sum, 0)
          const max = s.data.length * 10
          const shorts = s.data.filter(d => d.dir === "S" && d.miss !== "" && Number(d.miss) !== 0).length
          const longs = s.data.filter(d => d.dir === "L" && d.miss !== "" && Number(d.miss) !== 0).length
          return (
            <div>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: GREEN_LIGHT }}>{score}/{max}</span>
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: 8 }}>{shorts}S / {longs}L</span>
            </div>
          )
        }
        case "arc_depth": {
          const passed = s.data.filter(d => d.result === true).length
          const total = s.data.length
          const pct = Math.round((passed / total) * 100)
          return (
            <div>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: pctColor(pct) }}>{pct}%</span>
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: 8 }}>{s.club} · {s.location}</span>
            </div>
          )
        }
        case "shot_shaping": {
          const total = s.data.filter(d => d.path !== null && d.spin !== null).length
          const pathR = s.data.filter(d => d.path === "R").length
          const spinL = s.data.filter(d => d.spin === "L").length
          const combos = s.data.filter(d => d.path === "R" && d.spin === "L").length
          const comboPct = total > 0 ? Math.round((combos / total) * 100) : 0
          const pathRPct = total > 0 ? Math.round((pathR / total) * 100) : 0
          const spinLPct = total > 0 ? Math.round((spinL / total) * 100) : 0
          return (
            <div>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: "#4ade80" }}>{comboPct}%</span>
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: 8 }}>{s.club} · {s.location}</span>
              <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>
                PathR {pathRPct}% · SpinL {spinLPct}% · Combo {comboPct}%
              </div>
            </div>
          )
        }
        case "putting_ladder": {
          const putts = Number(s.data.putts) || 0
          const dist = Number(s.data.distance) || 0
          const avg = putts > 0 ? (dist / putts).toFixed(1) : "—"
          return (
            <div>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: GREEN_LIGHT }}>{putts}</span>
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: 4 }}>putts · {dist}ft · {avg}ft/putt</span>
              {s.data.location && <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>{s.data.location}</div>}
            </div>
          )
        }
        case "four_footer": {
          const made = s.data.made
          const pct = made !== "" ? Number(made) * 10 : 0
          return (
            <div>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: pctColor(pct) }}>{made}/10</span>
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: 8 }}>{pct}%</span>
              {s.data.location && <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>{s.data.location}</div>}
            </div>
          )
        }
        case "strike_log": {
          const graded = s.data.filter(r => r.grade !== null)
          const avg = graded.length > 0
            ? (graded.reduce((s, r) => s + r.grade, 0) / graded.length).toFixed(1)
            : "—"
          return (
            <div>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: GREEN_LIGHT }}>{avg}</span>
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: 8 }}>{s.data.length} reps</span>
            </div>
          )
        }
        case "driver_uprights": {
          const total = s.data.filter(d => d.uprights !== null && d.shape !== null).length
          const hits = s.data.filter(d => d.uprights === true).length
          const hitPct = total > 0 ? Math.round((hits / total) * 100) : 0
          const shapeCounts = {}
          SHOT_SHAPES.forEach(sh => { shapeCounts[sh] = s.data.filter(d => d.shape === sh).length })
          const topShape = Object.entries(shapeCounts).sort((a, b) => b[1] - a[1])[0]
          return (
            <div>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: pctColor(hitPct) }}>{hitPct}%</span>
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: 8 }}>{s.club} · {s.location}</span>
              <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>
                {hits}/{total} fairways · Top: {topShape[0]} ({topShape[1]})
              </div>
            </div>
          )
        }
        case "start_line": {
          const total = s.data.filter(d => d.gate !== null && d.lineRight !== null && d.break_dir !== null).length
          const gates = s.data.filter(d => d.gate === true).length
          const gatePct = total > 0 ? Math.round((gates / total) * 100) : 0
          const lineRight = s.data.filter(d => d.lineRight === true).length
          const linePct = total > 0 ? Math.round((lineRight / total) * 100) : 0
          const breakSummary = PUTT_BREAKS.map(b => {
            const putts = s.data.filter(d => d.break_dir === b)
            const right = putts.filter(d => d.lineRight === true).length
            const pct = putts.length > 0 ? Math.round((right / putts.length) * 100) : null
            const short = b === "Left to Right" ? "L→R" : b === "Right to Left" ? "R→L" : "Str"
            return pct !== null ? `${short} ${pct}%` : null
          }).filter(Boolean).join(" · ")
          return (
            <div>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: pctColor(gatePct) }}>{gatePct}%</span>
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: 8 }}>gate · {linePct}% line</span>
              <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>
                {breakSummary}
              </div>
            </div>
          )
        }
        case "lag": {
          const putts = s.data.putts || []
          const puttCounts = putts.filter(d => d.totalPutts !== "" && !isNaN(Number(d.totalPutts)))
          const avgPutts = puttCounts.length > 0
            ? (puttCounts.reduce((sum, d) => sum + Number(d.totalPutts), 0) / puttCounts.length).toFixed(1)
            : "—"
          const twoPuttOrLess = puttCounts.filter(d => Number(d.totalPutts) <= 2).length
          const twoPuttPct = puttCounts.length > 0 ? Math.round((twoPuttOrLess / puttCounts.length) * 100) : 0
          const logged = putts.filter(d => d.result !== null)
          const shorts = logged.filter(d => d.result === "Short").length
          const evens = logged.filter(d => d.result === "Even").length
          const longs = logged.filter(d => d.result === "Long").length
          return (
            <div>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: pctColor(twoPuttPct) }}>{avgPutts}</span>
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: 8 }}>avg putts · {twoPuttPct}% ≤2</span>
              <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>
                S{shorts} · E{evens} · L{longs}
              </div>
            </div>
          )
        }
        case "shape_randomizer": {
          const shots = s.data.shots || []
          const total = shots.filter(d => d.actualStart !== null && d.actualCurve !== null).length
          const bothCount = shots.filter(d => d.actualStart === d.targetStart && d.actualCurve === d.targetCurve).length
          const startCount = shots.filter(d => d.actualStart !== null && d.actualStart === d.targetStart).length
          const curveCount = shots.filter(d => d.actualCurve !== null && d.actualCurve === d.targetCurve).length
          const bothPct = total > 0 ? Math.round((bothCount / total) * 100) : 0
          const startPct = total > 0 ? Math.round((startCount / total) * 100) : 0
          const curvePct = total > 0 ? Math.round((curveCount / total) * 100) : 0
          return (
            <div>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: pctColor(bothPct) }}>{bothPct}%</span>
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: 8 }}>{shots.length} shots</span>
              <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>
                Both {bothPct}% · Start {startPct}% · Curve {curvePct}%
              </div>
            </div>
          )
        }
        case "toe_heel_strike": {
          const shots = s.data.shots || []
          const total = shots.filter(d => d.result !== null).length
          const hits = shots.filter(d => d.result === true).length
          const hitPct = total > 0 ? Math.round((hits / total) * 100) : 0
          const zoneStr = STRIKE_ZONES.map(z => {
            const m = shots.filter(d => d.target === z && d.result !== null)
            const h = m.filter(d => d.result === true).length
            return `${z[0]}${z.includes(" ") ? z.split(" ")[1][0] : ""} ${m.length > 0 ? Math.round((h / m.length) * 100) : 0}%`
          }).join(" · ")
          return (
            <div>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: pctColor(hitPct) }}>{hitPct}%</span>
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: 8 }}>{shots.length} shots</span>
              <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>{zoneStr}</div>
            </div>
          )
        }
        default: return null
      }
    }

    return (
      <div>
        <Header title={`${drill.name} History`} onBack={goHome} />
        {sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#ccc" }}>No sessions yet</div>
        ) : (
          sessions.map(s => (
            <div key={s.id} style={CARD}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: "#ddd" }}>
                  {formatDate(s.timestamp)} · {formatTime(s.timestamp)}
                </div>
              </div>
              {sessionSummary(s)}
              {s.notes && <div style={{ fontSize: 12, color: "#bbb", marginTop: 6, fontStyle: "italic" }}>{s.notes}</div>}
            </div>
          ))
        )}
      </div>
    )
  }

  // ──────────────────────────────
  // HOME VIEW
  // ──────────────────────────────
  const HomeView = () => {
    const drillStat = (drill) => {
      if (drill.sessions.length === 0) return null
      const last = drill.sessions[drill.sessions.length - 1]
      switch (drill.template) {
        case "distance_matrix": {
          const score = last.data.reduce((sum, d) =>
            d.miss !== "" && d.miss !== null ? sum + calcPoints(d.miss, d.distance) : sum, 0)
          return <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 18, color: GREEN_LIGHT }}>{score}/{last.data.length * 10}</span>
        }
        case "arc_depth": {
          const passed = last.data.filter(d => d.result === true).length
          const pct = Math.round((passed / last.data.length) * 100)
          return <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 18, color: pctColor(pct) }}>{pct}%</span>
        }
        case "shot_shaping": {
          const total = last.data.filter(d => d.path !== null && d.spin !== null).length
          const combos = last.data.filter(d => d.path === "R" && d.spin === "L").length
          const pct = total > 0 ? Math.round((combos / total) * 100) : 0
          return <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 18, color: "#4ade80" }}>{pct}%</span>
        }
        case "putting_ladder": {
          const p = Number(last.data.putts) || 0
          const d = Number(last.data.distance) || 0
          const avg = p > 0 ? (d / p).toFixed(1) : "—"
          return <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 18, color: GREEN_LIGHT }}>{avg}ft</span>
        }
        case "four_footer": {
          const pct = last.data.made !== "" ? Number(last.data.made) * 10 : 0
          return <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 18, color: pctColor(pct) }}>{last.data.made}/10</span>
        }
        case "strike_log": {
          const graded = last.data.filter(r => r.grade !== null)
          const avg = graded.length > 0 ? (graded.reduce((s, r) => s + r.grade, 0) / graded.length).toFixed(1) : "—"
          return <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 18, color: GREEN_LIGHT }}>{avg}</span>
        }
        case "driver_uprights": {
          const total = last.data.filter(d => d.uprights !== null && d.shape !== null).length
          const hits = last.data.filter(d => d.uprights === true).length
          const pct = total > 0 ? Math.round((hits / total) * 100) : 0
          return <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 18, color: pctColor(pct) }}>{pct}%</span>
        }
        case "start_line": {
          const total = last.data.filter(d => d.gate !== null && d.lineRight !== null && d.break_dir !== null).length
          const gates = last.data.filter(d => d.gate === true).length
          const pct = total > 0 ? Math.round((gates / total) * 100) : 0
          return <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 18, color: pctColor(pct) }}>{pct}%</span>
        }
        case "lag": {
          const putts = last.data.putts || []
          const puttCounts = putts.filter(d => d.totalPutts !== "" && !isNaN(Number(d.totalPutts)))
          const avgPutts = puttCounts.length > 0
            ? (puttCounts.reduce((sum, d) => sum + Number(d.totalPutts), 0) / puttCounts.length).toFixed(1)
            : "—"
          return <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 18, color: GREEN_LIGHT }}>{avgPutts} avg</span>
        }
        case "shape_randomizer": {
          const shots = last.data.shots || []
          const total = shots.filter(d => d.actualStart !== null && d.actualCurve !== null).length
          const bothCount = shots.filter(d => d.actualStart === d.targetStart && d.actualCurve === d.targetCurve).length
          const pct = total > 0 ? Math.round((bothCount / total) * 100) : 0
          return <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 18, color: pctColor(pct) }}>{pct}%</span>
        }
        case "toe_heel_strike": {
          const shots = last.data.shots || []
          const total = shots.filter(d => d.result !== null).length
          const hits = shots.filter(d => d.result === true).length
          const pct = total > 0 ? Math.round((hits / total) * 100) : 0
          return <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 18, color: pctColor(pct) }}>{pct}%</span>
        }
        default: return null
      }
    }

    return (
      <div>
        <Header title="My Drills" />
        {MC_API && (
          <div style={{ ...CARD, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: "#ccc", fontWeight: 500 }}>Mission Control</div>
              {syncResult && <div style={{ fontSize: 11, color: GREEN_LIGHT, marginTop: 2 }}>{syncResult}</div>}
            </div>
            <button onClick={syncAllToMC} disabled={syncing}
              style={{ ...BTN_BASE, background: syncing ? "#333" : "#333", color: syncing ? "#999" : GREEN_LIGHT, border: `1px solid ${syncing ? "#333" : GREEN}`, fontSize: 12, padding: "8px 14px" }}>
              {syncing ? "Syncing..." : "Sync History"}
            </button>
          </div>
        )}
        {drills.map(drill => {
          const t = TEMPLATES[drill.template]
          return (
            <div key={drill.id} style={CARD}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{t?.icon}</span>
                  <div>
                    <div style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 18, color: "#fff" }}>{t?.name}</div>
                    <div style={{ fontSize: 11, color: "#bbb" }}>
                      {drill.sessions.length} {drill.sessions.length === 1 ? "session" : "sessions"}
                    </div>
                  </div>
                </div>
                {drillStat(drill)}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => startSession(drill)}
                  style={{ ...BTN_BASE, flex: 1, background: GREEN, color: "#fff", fontSize: 14 }}>
                  ▶ Start Session
                </button>
                <button onClick={() => { setActiveDrill(drill); setView("history") }}
                  style={{ ...BTN_BASE, flex: 1, background: "#333", color: "#ccc", border: "1px solid #666", fontSize: 14 }}>
                  History
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ──────────────────────────────
  // RENDER
  // ──────────────────────────────
  if (view === "history") return <HistoryView />
  if (view === "session" && activeDrill) {
    switch (activeDrill.template) {
      case "distance_matrix": return <DistanceMatrixSession />
      case "arc_depth": return <ArcDepthSession />
      case "shot_shaping": return <ShotShapingSession />
      case "putting_ladder": return <PuttingLadderSession />
      case "four_footer": return <FourFooterSession />
      case "strike_log": return <StrikeLogSession />
      case "driver_uprights": return <DriverUprightsSession />
      case "start_line": return <StartLineSession />
      case "lag": return LagSession()
      case "shape_randomizer": return <ShapeRandomizerSession />
      case "toe_heel_strike": return <ToeHeelStrikeSession />
    }
  }
  return <HomeView />
}
