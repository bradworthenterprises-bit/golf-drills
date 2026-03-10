import { useState, useEffect, useCallback } from 'react'

// ── Style Tokens ──
const GREEN = "#4a9e6a", GREEN_LIGHT = "#4ade80", GREEN_DIM = "#1a2e22"
const CARD_BG = "#161616", CARD_BORDER = "#1e1e1e"

const INP = {
  background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 8,
  color: "#e0e0e0", padding: "11px 13px", fontSize: 15,
  width: "100%", outline: "none", fontFamily: "'DM Sans', sans-serif",
  boxSizing: "border-box", WebkitAppearance: "none"
}
const LBL = {
  fontSize: 10, color: "#555", textTransform: "uppercase",
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

const TEMPLATES = {
  distance_matrix: { icon: "🎯", name: "Wedge Distance Matrix", desc: "Track miss distances for 20 random wedge targets" },
  arc_depth: { icon: "🔄", name: "Arc Depth", desc: "Pass/fail through a 12-step arc sequence" },
  shot_shaping: { icon: "🔀", name: "Shot Shaping", desc: "Track path and spin direction over 20 shots" },
  putting_ladder: { icon: "🕳️", name: "Putting Ladder", desc: "Log putts and total distance for ladder drills" },
  four_footer: { icon: "⛳", name: "4-Footer Drill", desc: "Track makes out of 10 from 4 feet" },
  strike_log: { icon: "📍", name: "Strike Log", desc: "Grade strike quality rep by rep" }
}

const STORAGE_KEY = "gdt_drills_v1"

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

  const persist = useCallback((d) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)) } catch {}
  }, [])

  useEffect(() => { persist(drills) }, [drills, persist])

  const updateDrills = (fn) => setDrills(prev => { const next = fn(prev); return next })

  const goHome = () => {
    setView("home"); setActiveDrill(null); setSessionData(null)
    setSessionNotes(""); setCardStep(0); setShowSummary(false)
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
    }
    updateDrills(prev => prev.map(d =>
      d.id === drill.id ? { ...d, sessions: [...d.sessions, sessionObj] } : d
    ))
    goHome()
  }


  // ── Header ──
  const Header = ({ title, onBack, backLabel }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: GREEN, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
          ⛳ Golf Practice
        </span>
        {onBack && (
          <button onClick={onBack} style={{ ...BTN_BASE, background: "none", color: "#888", fontSize: 13, padding: "4px 0" }}>
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
            <div style={{ color: "#888", fontSize: 14 }}>out of {totalPossible} possible · {eff}%</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[
              { label: "Short", val: shorts, color: "#fb923c" },
              { label: "Long", val: longs, color: "#60a5fa" },
              { label: "Dead On", val: deads, color: "#4ade80" }
            ].map(s => (
              <div key={s.label} style={{ ...CARD, flex: 1, textAlign: "center" }}>
                <div style={{ fontFamily: BARLOW, fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{s.label}</div>
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
                      <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>
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
          <button onClick={saveSession} style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14 }}>
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
            <button onClick={goHome} style={{ ...BTN_BASE, background: "none", color: "#888", fontSize: 13, padding: "4px 8px" }}>
              ← Back
            </button>
          </div>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 24, color: GREEN_LIGHT }}>{liveScore}</div>
        </div>
        <h2 style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 22, color: "#fff", margin: "0 0 4px" }}>{activeDrill.name}</h2>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>Shot {step + 1} of {data.length}</div>

        <DotGrid items={data} current={step} onTap={setCardStep}
          colorFn={(d) => {
            if (d.miss === "" || d.miss === null) return { bg: "#2a2a2a", label: "" }
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
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>yards</div>
          {hasMiss && (
            <div style={{ marginTop: 10 }}>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 36, color: sc }}>{pts}</span>
              <span style={{ fontSize: 13, color: sc, marginLeft: 6 }}>{scoreLabel(pts)}</span>
            </div>
          )}
        </div>

        {lastRef && (
          <div style={{ ...CARD, background: "#111", padding: "8px 12px", fontSize: 12, color: "#666", marginBottom: 14 }}>
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
                  border: sel ? `2px solid ${b.color}` : "2px solid #2a2a2a"
                }}>
                {b.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCardStep(Math.max(0, step - 1))} disabled={step === 0}
            style={{ ...BTN_BASE, flex: 1, background: "#1c1c1c", color: step === 0 ? "#333" : "#999", border: "1px solid #2a2a2a" }}>
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
            <div style={{ color: "#888", fontSize: 14 }}>Pass Rate</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ ...CARD, flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: BARLOW, fontSize: 28, fontWeight: 700, color: "#4ade80" }}>{passed}</div>
              <div style={{ fontSize: 11, color: "#888" }}>Passed</div>
            </div>
            <div style={{ ...CARD, flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: BARLOW, fontSize: 28, fontWeight: 700, color: "#ef4444" }}>{failed}</div>
              <div style={{ fontSize: 11, color: "#888" }}>Failed</div>
            </div>
          </div>
          <div style={{ ...CARD, display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#888" }}>Club: <span style={{ color: "#fff" }}>{arcClub}</span></span>
            <span style={{ fontSize: 13, color: "#888" }}>Location: <span style={{ color: "#fff" }}>{arcLocation}</span></span>
          </div>
          <div style={{ marginBottom: 16 }}>
            {data.map((d, i) => (
              <div key={i} onClick={() => { setCardStep(i); setShowSummary(false) }}
                style={{ ...CARD, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div>
                  <span style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 16, color: cueStyles[d.cue].text }}>
                    {d.cue}
                  </span>
                  <span style={{ fontSize: 12, color: "#666", marginLeft: 8 }}>Step {i + 1}</span>
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
          <button onClick={saveSession} style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14 }}>
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
            <button onClick={goHome} style={{ ...BTN_BASE, background: "none", color: "#888", fontSize: 13, padding: "4px 8px" }}>
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
              return { bg: "#2a2a2a" }
            }
            return d.result
              ? { bg: "#4ade8044", border: "#4ade80" }
              : { bg: "#ef444444", border: "#ef4444" }
          }}
        />

        <div style={{ fontSize: 12, color: "#888", textAlign: "center", marginBottom: 6 }}>Step {step + 1} of {data.length}</div>
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
              border: current.result === false ? "2px solid #ef4444" : "2px solid #2a2a2a"
            }}>
            FAIL
          </button>
          <button onClick={() => updateStep(true)}
            style={{
              ...BTN_BASE, flex: 1, fontSize: 16, fontWeight: 700,
              background: current.result === true ? "#4ade8022" : "#1c1c1c",
              color: current.result === true ? "#4ade80" : "#666",
              border: current.result === true ? "2px solid #4ade80" : "2px solid #2a2a2a"
            }}>
            PASS
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCardStep(Math.max(0, step - 1))} disabled={step === 0}
            style={{ ...BTN_BASE, flex: 1, background: "#1c1c1c", color: step === 0 ? "#333" : "#999", border: "1px solid #2a2a2a" }}>
            ← Prev
          </button>
          <button onClick={() => setShowSummary(true)}
            style={{ ...BTN_BASE, flex: 1, background: "#1c1c1c", color: "#999", border: "1px solid #2a2a2a" }}>
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
                <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>{s.count}/{total}</div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ ...CARD, display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#888" }}>Club: <span style={{ color: "#fff" }}>{arcClub}</span></span>
            <span style={{ fontSize: 13, color: "#888" }}>Location: <span style={{ color: "#fff" }}>{arcLocation}</span></span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {data.map((d, i) => (
              <div key={i} onClick={() => { setCardStep(i); setShowSummary(false) }}
                style={{
                  width: "calc(25% - 5px)", ...CARD, textAlign: "center", padding: 8, cursor: "pointer",
                  marginBottom: 0
                }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>#{i + 1}</div>
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
                  <div style={{ fontSize: 11, color: "#444" }}>—</div>
                )}
              </div>
            ))}
          </div>
          <label style={LBL}>Session Notes</label>
          <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
            placeholder="Thoughts on this session..."
            style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
          <button onClick={saveSession} style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14 }}>
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
            <button onClick={goHome} style={{ ...BTN_BASE, background: "none", color: "#888", fontSize: 13, padding: "4px 8px" }}>
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
            if (!logged(d)) return { bg: "#2a2a2a", label: `${i + 1}`, text: "#666" }
            if (combo(d)) return { bg: "#4ade8044", border: "#4ade80", label: "✓", text: "#4ade80" }
            return { bg: "#555", label: "·", text: "#999" }
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
                    border: sel ? "2px solid #60a5fa" : "2px solid #2a2a2a"
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
                    border: sel ? "2px solid #f472b6" : "2px solid #2a2a2a"
                  }}>
                  {v}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCardStep(Math.max(0, step - 1))} disabled={step === 0}
            style={{ ...BTN_BASE, flex: 1, background: "#1c1c1c", color: step === 0 ? "#333" : "#999", border: "1px solid #2a2a2a" }}>
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
        <Header title={activeDrill.name} onBack={goHome} />
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
            <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>Avg Distance / Putt</div>
            <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 32, color: GREEN_LIGHT }}>{avg} ft</div>
          </div>
        )}

        <label style={LBL}>Notes</label>
        <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
          placeholder="Green speed, break tendencies, anything notable..."
          style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
        <button onClick={saveSession}
          style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14 }}>
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
        <Header title={activeDrill.name} onBack={goHome} />
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
                  border: sel ? "2px solid #c084fc" : "2px solid #2a2a2a"
                }}>
                {i}
              </button>
            )
          })}
        </div>

        {makePct !== null && (
          <div style={{ ...CARD, textAlign: "center", marginBottom: 14, background: pctColor(makePct) + "11", border: `1px solid ${pctColor(makePct)}44` }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>Make Rate</div>
            <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 32, color: pctColor(makePct) }}>{makePct}%</div>
          </div>
        )}

        <label style={LBL}>Notes</label>
        <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
          placeholder="Stroke thoughts, tendencies..."
          style={{ ...INP, minHeight: 80, resize: "vertical", marginBottom: 14 }} />
        <button onClick={saveSession}
          style={{ ...BTN_BASE, width: "100%", background: GREEN, color: "#fff", fontSize: 16, padding: 14 }}>
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
        <Header title={activeDrill.name} onBack={goHome} />
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
                style={{ ...BTN_BASE, background: "none", color: "#666", fontSize: 18, padding: "2px 6px" }}>×</button>
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
                      border: sel ? `2px solid ${GREEN}` : "2px solid #2a2a2a",
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
          <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
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
              <span style={{ fontSize: 11, color: "#666", marginLeft: 8 }}>{shorts}S / {longs}L</span>
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
              <span style={{ fontSize: 11, color: "#666", marginLeft: 8 }}>{s.club} · {s.location}</span>
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
              <span style={{ fontSize: 11, color: "#666", marginLeft: 8 }}>{s.club} · {s.location}</span>
              <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
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
              <span style={{ fontSize: 11, color: "#666", marginLeft: 4 }}>putts · {dist}ft · {avg}ft/putt</span>
              {s.data.location && <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{s.data.location}</div>}
            </div>
          )
        }
        case "four_footer": {
          const made = s.data.made
          const pct = made !== "" ? Number(made) * 10 : 0
          return (
            <div>
              <span style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 20, color: pctColor(pct) }}>{made}/10</span>
              <span style={{ fontSize: 11, color: "#666", marginLeft: 8 }}>{pct}%</span>
              {s.data.location && <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{s.data.location}</div>}
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
              <span style={{ fontSize: 11, color: "#666", marginLeft: 8 }}>{s.data.length} reps</span>
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
          <div style={{ textAlign: "center", padding: 40, color: "#444" }}>No sessions yet</div>
        ) : (
          sessions.map(s => (
            <div key={s.id} style={CARD}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: "#888" }}>
                  {formatDate(s.timestamp)} · {formatTime(s.timestamp)}
                </div>
              </div>
              {sessionSummary(s)}
              {s.notes && <div style={{ fontSize: 12, color: "#555", marginTop: 6, fontStyle: "italic" }}>{s.notes}</div>}
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
        default: return null
      }
    }

    return (
      <div>
        <Header title="My Drills" />
        {drills.map(drill => {
          const t = TEMPLATES[drill.template]
          return (
            <div key={drill.id} style={CARD}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{t?.icon}</span>
                  <div>
                    <div style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 18, color: "#fff" }}>{t?.name}</div>
                    <div style={{ fontSize: 11, color: "#666" }}>
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
                  style={{ ...BTN_BASE, flex: 1, background: "#1c1c1c", color: "#999", border: "1px solid #2a2a2a", fontSize: 14 }}>
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
    }
  }
  return <HomeView />
}
