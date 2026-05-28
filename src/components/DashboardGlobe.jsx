import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { geoOrthographic, geoPath, geoGraticule, geoBounds } from 'd3-geo'
import { timer as d3Timer } from 'd3-timer'
import { interpolate as d3Interpolate } from 'd3-interpolate'
import { feature as topoFeature } from 'topojson-client'
import { useAuth } from '../context/AuthContext'
import { getLibraryProjectsByState } from '../lib/programData'

// DashboardGlobe — UNIFIED d3-canvas globe.
//
// Aden's 2026-05-27 brief (third pass):
//   "It looks like two separate images just spliced together. It needs to
//    be the same artifact / code and when you click into it the globe
//    slowly turns and focuses on the US and zooms into a better viewing
//    experience of the US."
//
// Previous build was a splice — cobe WebGL canvas at rest, then a fade-
// swap to a react-simple-maps SVG orthographic on click. Two rendering
// systems, one hard cut between them. This rewrite uses ONE artifact:
// a single <canvas> driven by d3-geo + Canvas 2D, with the projection's
// rotation and scale animated continuously across the four phases Aden
// described:
//
//   Phase 1 (idle):       World-view orthographic, dot-matrix land,
//                         slow auto-rotate.
//   Phase 2 (rotating):   rotation interpolates toward [100, -38]
//                         (US-facing). Auto-rotate paused.
//   Phase 3 (zooming):    scale interpolates from radius_idle to
//                         radius_zoomed (~2.4× bigger). Dots fade out,
//                         state choropleth fades in.
//   Phase 4 (focused):    static at US-facing + zoomed. States are
//                         clickable. "Zoom out" pill restarts the
//                         transition in reverse.
//
// Phase transitions are continuous on the same projection — no canvas
// swap, no DOM teardown, no hard fade between two different artifacts.
// Click detection is via projection.invert() + point-in-polygon test
// against the US state topojson features.
//
// Reference patterns adopted from Skills/Interactive Globe Support/
// Interactive Globe 1.md (d3.geoOrthographic + Canvas + dot-matrix
// halftone via generateDotsInPolygon).
//
// No new dependencies. d3-geo, d3-timer, d3-interpolate, topojson-client
// are all already installed transitively via react-simple-maps.

// ─── Data sources ────────────────────────────────────────────────────────
// World land (small, ~50KB simplified at 110m resolution). Loaded on mount.
const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json'
// US states (200KB at 10m — same topojson USMap uses).
const STATES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

// FIPS → state-abbrev lookup (mirrors USMap.jsx)
const FIPS = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
  "10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL",
  "18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD",
  "25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE",
  "32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND",
  "39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD",
  "47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
  "55":"WI","56":"WY",
}

// ─── State-fill ramp (dark-surface palette) ──────────────────────────────
// Same teal-700/500/400/300/200 buckets as USOrthographicGlobe, plus
// muted slate for no-program states.
function fillForState(stateInfo, isHovered, isSelected) {
  if (isSelected) return '#A78BFA'
  if (isHovered)  return '#5EEAD4'
  if (!stateInfo || stateInfo.csStatus === 'none') return '#1F2A3D'
  if (stateInfo.csStatus === 'pending')            return '#FBBF24'
  const score = stateInfo.feasibilityScore || 0
  if (score >= 75) return '#0F766E'
  if (score >= 60) return '#14B8A6'
  if (score >= 45) return '#2DD4BF'
  if (score >= 25) return '#5EEAD4'
  return '#99F6E4'
}

// ─── Point-in-polygon (for click detection) ──────────────────────────────
// Standard ray-casting algorithm. Lifted from the Interactive Globe 1
// skill — same idea, applied to a single feature at a time.
function pointInPolygon(point, polygon) {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}
function pointInFeature(point, feature) {
  const geom = feature.geometry
  if (!geom) return false
  if (geom.type === 'Polygon') {
    if (!pointInPolygon(point, geom.coordinates[0])) return false
    for (let i = 1; i < geom.coordinates.length; i++) {
      if (pointInPolygon(point, geom.coordinates[i])) return false
    }
    return true
  }
  if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      if (pointInPolygon(point, poly[0])) {
        let inHole = false
        for (let i = 1; i < poly.length; i++) {
          if (pointInPolygon(point, poly[i])) { inHole = true; break }
        }
        if (!inHole) return true
      }
    }
  }
  return false
}

// ─── Halftone dot generator ──────────────────────────────────────────────
// Same pattern as the Interactive Globe 1 skill: rasterize each land
// feature into a lat/lng grid, keep points that fall inside. Done ONCE
// at load time; dots are projected each frame.
function generateDotsForFeatures(features, dotSpacing = 2.4) {
  const dots = []
  for (const f of features) {
    const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(f)
    for (let lng = minLng; lng <= maxLng; lng += dotSpacing) {
      for (let lat = minLat; lat <= maxLat; lat += dotSpacing) {
        if (pointInFeature([lng, lat], f)) dots.push([lng, lat])
      }
    }
  }
  return dots
}

// ─── Phase parameters ────────────────────────────────────────────────────
// Idle: full earth visible (projection scale ≈ canvas/2). Dot-matrix at
// full opacity. Auto-rotate slowly.
// Focused: zoomed onto US. State choropleth at full opacity. Dots faded.
const IDLE_ROTATION   = [0, 0]
const FOCUS_ROTATION  = [98, -38]  // [longitude, latitude] of central US (~Kansas)
// Idle scale bumped 0.42 → 0.66 per Aden 2026-05-27: "just increase the
// size of the globe too, way too much empty space there." The earlier
// 0.42 left ~half the container as dead negative space; 0.66 fills most
// of the disc with the globe while keeping a small rim margin.
const IDLE_SCALE_FRAC = 0.66
// Focus scale bumped 1.0 → 1.6 per Aden: "the map of the US is too
// zoomed out, so increase the size to fit the screen more." At 1.6× the
// sphere radius exceeds the container by 60%, which means the visible
// disc is a slice — the US fills it edge-to-edge while the Canadian
// and Mexican rim still hint at globe curvature.
const FOCUS_SCALE_FRAC = 1.6
const TRANSITION_MS   = 1600        // total interpolation duration

// ─── Component ───────────────────────────────────────────────────────────
export default function DashboardGlobe({
  onStateClick,
  selectedStateId,
  stateProgramMap = {},
  deltaMap = null,
}) {
  const { user } = useAuth()
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  // Phase: 'idle' (rotating world view) | 'animating' (mid-transition)
  // | 'focused' (US-centered, states clickable). Strings (not enum) for
  // brevity; this is the only place they're referenced.
  const [phase, setPhase] = useState('idle')
  // Loading flag — both topojson fetches must resolve before we draw.
  const [ready, setReady] = useState(false)
  // Hover state for the focused phase — tracked here so the React layer
  // can render a tooltip. The canvas itself reads from a ref to avoid
  // re-renders on every mousemove.
  const [hover, setHover] = useState(null) // { stateId, x, y } | null

  // Refs that the imperative render loop reads. Using refs (not state)
  // for these so we can mutate inside d3-timer without triggering React
  // re-renders — the canvas re-paint is what we want, not React's diff.
  const phaseRef = useRef('idle')
  const rotationRef = useRef([...IDLE_ROTATION])
  const scaleFracRef = useRef(IDLE_SCALE_FRAC)
  const dotOpacityRef = useRef(1)
  const stateOpacityRef = useRef(0)
  const selectedIdRef = useRef(null)
  const hoverIdRef = useRef(null)
  const stateProgramMapRef = useRef(stateProgramMap)
  const deltaMapRef = useRef(deltaMap)

  // Keep refs in sync with the latest prop values so the render loop
  // reads fresh data without restarting.
  useEffect(() => { stateProgramMapRef.current = stateProgramMap }, [stateProgramMap])
  useEffect(() => { deltaMapRef.current = deltaMap }, [deltaMap])
  useEffect(() => { selectedIdRef.current = selectedStateId }, [selectedStateId])

  // Cached topojson data and projection — set once after fetch resolves.
  const dataRef = useRef({ worldFeatures: null, stateFeatures: null, dots: [] })
  const projectionRef = useRef(null)
  const pathRef = useRef(null)
  const containerSizeRef = useRef({ width: 0, height: 0 })

  // Pulse phase for the delta-marker breathing animation (Phase 4 only).
  const pulsePhaseRef = useRef(0)

  // Top-N states to highlight as bright dots during idle (visible cue
  // that this is a US-focused intelligence tool even before zoom).
  const topStateCoords = useMemo(() => {
    const arr = Object.values(stateProgramMap || {})
      .filter((s) => s.csStatus !== 'none')
      .sort((a, b) => (b.feasibilityScore || 0) - (a.feasibilityScore || 0))
      .slice(0, 15)
    // We don't have lat/lng on state info; rely on FIPS later. Markers
    // come from a centroid lookup that lives on the rendering path —
    // here we just need the IDs and feasibility score for marker size.
    return arr.map((s) => ({ id: s.id, score: s.feasibilityScore || 0 }))
  }, [stateProgramMap])

  // ── Live markers — Aden 2026-05-28 "make the globe icons live" ──────────
  // Authed users see markers at the states where they have saved Library
  // projects (their own market intel). Signed-out / preview visitors see
  // markers at the top-7 states from LBNL Sharing the Sun (real operating
  // CS projects — public ground truth). Source label exposed for the
  // legend / tooltip so users know which read they're seeing.
  const [liveMarkers, setLiveMarkers] = useState([])
  const [liveMarkersSource, setLiveMarkersSource] = useState(null) // 'library' | 'cs_projects' | null
  const liveMarkersRef = useRef([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Aden 2026-05-28: "make it so the only dots that light up are the
      // markets we're in." Scope strictly to the user's saved Library
      // projects. NO LBNL fallback — if the user hasn't saved any
      // projects yet, the live layer is empty (the idle top-15-by-
      // feasibility ambient dots are still there as the baseline read).
      // Signed-out / preview visitors also get no live layer.
      if (!user) {
        liveMarkersRef.current = []
        setLiveMarkers([])
        setLiveMarkersSource(null)
        return
      }
      try {
        const lib = await getLibraryProjectsByState({ topN: 7 })
        if (cancelled) return
        if (Array.isArray(lib) && lib.length > 0) {
          setLiveMarkers(lib)
          setLiveMarkersSource('library')
          liveMarkersRef.current = lib
        } else {
          // Authed but no saved projects yet — keep the live layer empty
          // so the user isn't misled into thinking other states are
          // somehow "theirs."
          setLiveMarkers([])
          setLiveMarkersSource(null)
          liveMarkersRef.current = []
        }
      } catch (e) {
        console.warn('[DashboardGlobe] live markers fetch failed:', e?.message)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  // ── Fetch topojson once on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [worldRes, statesRes] = await Promise.all([
          fetch(WORLD_URL).then((r) => r.json()),
          fetch(STATES_URL).then((r) => r.json()),
        ])
        if (cancelled) return
        const worldFeatures = topoFeature(worldRes, worldRes.objects.land).features
        const stateFeatures = topoFeature(statesRes, statesRes.objects.states).features
        // Pre-generate dots ONCE — most expensive part. ~7000 dots at
        // dotSpacing=2.4 for the world's land mass; cheap to project + draw
        // each frame.
        const dots = generateDotsForFeatures(worldFeatures, 2.4)
        dataRef.current = { worldFeatures, stateFeatures, dots }
        setReady(true)
      } catch (e) {
        console.warn('[DashboardGlobe] topojson fetch failed:', e?.message)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Set up canvas + projection + render loop ─────────────────────────
  useEffect(() => {
    if (!ready) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')

    // Track container size for responsive resize.
    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      const size = Math.min(rect.width, rect.height) || rect.width
      if (size === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = size * dpr
      canvas.height = size * dpr
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      containerSizeRef.current = { width: size, height: size }

      // Build / rebuild the projection at the new size.
      const radius = (size / 2) * scaleFracRef.current
      const projection = geoOrthographic()
        .scale(radius)
        .translate([size / 2, size / 2])
        .clipAngle(90)
        .rotate(rotationRef.current)
      projectionRef.current = projection
      pathRef.current = geoPath().projection(projection).context(ctx)
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(container)

    // ── Render frame ──────────────────────────────────────────────────
    const render = () => {
      const { width, height } = containerSizeRef.current
      if (width === 0) return
      const projection = projectionRef.current
      const path = pathRef.current
      if (!projection || !path) return
      const { worldFeatures, stateFeatures, dots } = dataRef.current
      const stateMap = stateProgramMapRef.current
      const dMap = deltaMapRef.current

      // Re-sync projection on every frame (scale + rotation may be
      // mid-interpolation between phases).
      const radius = (width / 2) * scaleFracRef.current
      projection.scale(radius).translate([width / 2, height / 2]).rotate(rotationRef.current)

      ctx.clearRect(0, 0, width, height)

      // 1) Sphere fill (the ocean disc)
      ctx.beginPath()
      ctx.arc(width / 2, height / 2, radius, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(11, 22, 35, 0.85)'
      ctx.fill()

      // 2) Graticule — very subtle teal lines, only above some min radius
      //    so it doesn't fight the focused-zoom state where it'd look noisy.
      const showGraticule = scaleFracRef.current < 0.75
      if (showGraticule && worldFeatures) {
        ctx.beginPath()
        path(geoGraticule()())
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.10)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // 3) World land outlines (always drawn — even in focused phase the
      //    Canadian/Mexican rim adds context)
      if (worldFeatures) {
        ctx.beginPath()
        worldFeatures.forEach((f) => path(f))
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.22)'
        ctx.lineWidth = 0.6
        ctx.stroke()
      }

      // 4) Halftone dots — fade out as we zoom in (dotOpacity ref)
      if (dotOpacityRef.current > 0.01 && dots.length > 0) {
        ctx.globalAlpha = dotOpacityRef.current
        ctx.fillStyle = 'rgba(94, 234, 212, 0.55)'
        for (const [lng, lat] of dots) {
          const p = projection([lng, lat])
          if (!p) continue
          ctx.beginPath()
          ctx.arc(p[0], p[1], 1.1, 0, 2 * Math.PI)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      // 5) US state choropleth — fade in as we zoom in (stateOpacity ref)
      if (stateOpacityRef.current > 0.01 && stateFeatures) {
        ctx.globalAlpha = stateOpacityRef.current
        const hoverId = hoverIdRef.current
        const selId = selectedIdRef.current
        for (const f of stateFeatures) {
          const fips = String(f.id).padStart(2, '0')
          const stateId = FIPS[fips]
          const info = stateMap[stateId]
          // Draw fill (skip if no data row — e.g. DC)
          if (info) {
            const fill = fillForState(info, hoverId === stateId, selId === stateId)
            ctx.beginPath()
            path(f)
            ctx.fillStyle = fill
            ctx.fill()
            ctx.strokeStyle = 'rgba(11, 22, 35, 0.85)'
            ctx.lineWidth = 0.6
            ctx.stroke()
          }
        }
        // 5b) Delta pulse on states that moved this week — breathing
        //     stroke (linewidth + opacity oscillate)
        if (dMap) {
          const pulse = (Math.sin(pulsePhaseRef.current) + 1) / 2 // 0..1
          ctx.strokeStyle = `rgba(94, 234, 212, ${0.35 + pulse * 0.55})`
          ctx.lineWidth = 1 + pulse * 2
          for (const f of stateFeatures) {
            const fips = String(f.id).padStart(2, '0')
            const stateId = FIPS[fips]
            if (!stateMap[stateId]) continue
            if (!dMap.get?.(stateId)) continue
            ctx.beginPath()
            path(f)
            ctx.stroke()
          }
        }
        ctx.globalAlpha = 1
      }

      // 6) Idle-phase top-state markers — bright teal dots at each top-15
      //    state's centroid, sized by feasibility score. Visible only
      //    when dots are visible (i.e. during idle/early transition).
      if (dotOpacityRef.current > 0.3 && stateFeatures) {
        const seenIds = new Set(topStateCoords.map((s) => s.id))
        for (const f of stateFeatures) {
          const fips = String(f.id).padStart(2, '0')
          const stateId = FIPS[fips]
          if (!seenIds.has(stateId)) continue
          const cent = path.centroid(f)
          if (!cent || isNaN(cent[0])) continue
          const info = stateMap[stateId]
          const score = info?.feasibilityScore || 0
          const r = 1.5 + (score / 100) * 2.5
          ctx.globalAlpha = dotOpacityRef.current
          ctx.beginPath()
          ctx.arc(cent[0], cent[1], r, 0, 2 * Math.PI)
          ctx.fillStyle = '#14B8A6'
          ctx.shadowColor = 'rgba(20, 184, 166, 0.7)'
          ctx.shadowBlur = 8
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.globalAlpha = 1
        }
      }

      // 6b) LIVE markers — only for AUTHED users with ≥1 saved Library
      //     project (Aden 2026-05-28: "only dots that light up are the
      //     markets we're in"). NO public-data fallback; the unauth
      //     visitor sees the idle ambient dots only.
      //     Sits ON TOP of idle top-state markers with brighter fill +
      //     breathing pulse halo. Stays visible across phases — when
      //     zoomed in, markers project naturally onto the focused US sphere.
      //     Sizes tightened per Aden's "slightly smaller" callout —
      //     baseline 2px, up to ~4.5px for the biggest market in the set.
      if (liveMarkersRef.current.length > 0 && stateFeatures) {
        const live = liveMarkersRef.current
        const pulse = (Math.sin(pulsePhaseRef.current * 1.4) + 1) / 2 // 0..1
        const maxCount = Math.max(...live.map((m) => m.count || 1), 1)
        for (const m of live) {
          // Lookup the state's centroid via the topojson feature.
          const f = stateFeatures.find((sf) => FIPS[String(sf.id).padStart(2, '0')] === m.stateId)
          if (!f) continue
          const cent = path.centroid(f)
          if (!cent || isNaN(cent[0])) continue
          // Size by count (relative within the visible set). 2.0–4.5px.
          const r = 2 + (m.count / maxCount) * 2.5
          // Outer halo — pulses
          ctx.beginPath()
          ctx.arc(cent[0], cent[1], r + 3 + pulse * 3.5, 0, 2 * Math.PI)
          ctx.fillStyle = `rgba(94, 234, 212, ${0.16 - pulse * 0.08})`
          ctx.fill()
          // Mid halo
          ctx.beginPath()
          ctx.arc(cent[0], cent[1], r + 1.5, 0, 2 * Math.PI)
          ctx.fillStyle = 'rgba(94, 234, 212, 0.28)'
          ctx.fill()
          // Core dot — bright + glow
          ctx.beginPath()
          ctx.arc(cent[0], cent[1], r, 0, 2 * Math.PI)
          ctx.fillStyle = '#5EEAD4'
          ctx.shadowColor = 'rgba(94, 234, 212, 0.95)'
          ctx.shadowBlur = 9
          ctx.fill()
          ctx.shadowBlur = 0
        }
      }

      // 7) Sphere rim outline (drawn last, sits on top of land at limb)
      ctx.beginPath()
      ctx.arc(width / 2, height / 2, radius, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // ── Animation timer ───────────────────────────────────────────────
    let lastTs = 0
    let transition = null  // { startTs, fromRotation, toRotation, fromScale, toScale, fromDot, toDot, fromState, toState }

    const t = d3Timer((elapsed) => {
      const dt = elapsed - lastTs
      lastTs = elapsed
      pulsePhaseRef.current += dt * 0.003

      // Idle auto-rotation — slow drift on longitude
      if (phaseRef.current === 'idle') {
        rotationRef.current = [rotationRef.current[0] + dt * 0.012, rotationRef.current[1]]
      }

      // Transition interpolation
      if (transition) {
        const u = Math.min(1, (elapsed - transition.startTs) / TRANSITION_MS)
        // Ease-in-out cubic for organic feel
        const k = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
        rotationRef.current = transition.interpRotation(k)
        scaleFracRef.current = transition.interpScale(k)
        dotOpacityRef.current = transition.interpDot(k)
        stateOpacityRef.current = transition.interpState(k)
        if (u >= 1) {
          phaseRef.current = transition.endPhase
          setPhase(transition.endPhase)
          transition = null
        }
      }

      render()
    })

    // Expose the transition launcher to the React layer via a ref-like
    // closure attached to the canvas (so React handlers can fire it).
    canvas._startTransition = (direction) => {
      const isFocusing = direction === 'focus'
      const fromRot = [...rotationRef.current]
      const toRot   = isFocusing ? FOCUS_ROTATION : IDLE_ROTATION
      // Normalize fromRot[0] to the range nearest toRot[0] so we don't
      // animate the wrong way around the globe.
      const delta = ((toRot[0] - fromRot[0] + 540) % 360) - 180
      const normFromRot = [toRot[0] - delta, fromRot[1]]
      const fromScale  = scaleFracRef.current
      const toScale    = isFocusing ? FOCUS_SCALE_FRAC : IDLE_SCALE_FRAC
      const fromDot    = dotOpacityRef.current
      const toDot      = isFocusing ? 0 : 1
      const fromState  = stateOpacityRef.current
      const toState    = isFocusing ? 1 : 0
      transition = {
        startTs: lastTs,
        endPhase: isFocusing ? 'focused' : 'idle',
        interpRotation: d3Interpolate(normFromRot, toRot),
        interpScale:    d3Interpolate(fromScale, toScale),
        interpDot:      d3Interpolate(fromDot, toDot),
        interpState:    d3Interpolate(fromState, toState),
      }
      phaseRef.current = 'animating'
      setPhase('animating')
    }

    return () => {
      t.stop()
      ro.disconnect()
    }
  }, [ready, topStateCoords])

  // ── Click handler ─────────────────────────────────────────────────────
  // While idle → click triggers the focus transition.
  // While focused → click is hit-tested against the state polygons;
  //   if it hits a state, fire onStateClick. If empty space → no-op
  //   (use the "Zoom out" pill to return).
  const handleClick = useCallback((evt) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = evt.clientX - rect.left
    const y = evt.clientY - rect.top
    const phase_ = phaseRef.current
    if (phase_ === 'animating') return
    if (phase_ === 'idle') {
      canvas._startTransition?.('focus')
      return
    }
    // Focused — hit-test
    const proj = projectionRef.current
    if (!proj) return
    const lngLat = proj.invert?.([x, y])
    if (!lngLat) return
    const stateFeatures = dataRef.current.stateFeatures
    if (!stateFeatures) return
    for (const f of stateFeatures) {
      if (pointInFeature(lngLat, f)) {
        const fips = String(f.id).padStart(2, '0')
        const stateId = FIPS[fips]
        if (stateId && onStateClick) onStateClick(stateId)
        return
      }
    }
  }, [onStateClick])

  // ── Hover handler (Focused phase only) ────────────────────────────────
  const handleMouseMove = useCallback((evt) => {
    if (phaseRef.current !== 'focused') {
      if (hoverIdRef.current) {
        hoverIdRef.current = null
        setHover(null)
      }
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = evt.clientX - rect.left
    const y = evt.clientY - rect.top
    const proj = projectionRef.current
    if (!proj) return
    const lngLat = proj.invert?.([x, y])
    if (!lngLat) {
      if (hoverIdRef.current) { hoverIdRef.current = null; setHover(null) }
      return
    }
    const stateFeatures = dataRef.current.stateFeatures
    if (!stateFeatures) return
    for (const f of stateFeatures) {
      if (pointInFeature(lngLat, f)) {
        const fips = String(f.id).padStart(2, '0')
        const stateId = FIPS[fips]
        if (stateId !== hoverIdRef.current) {
          hoverIdRef.current = stateId
          setHover({ stateId, x: evt.clientX, y: evt.clientY })
        } else {
          setHover((h) => h ? { ...h, x: evt.clientX, y: evt.clientY } : null)
        }
        return
      }
    }
    if (hoverIdRef.current) {
      hoverIdRef.current = null
      setHover(null)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (hoverIdRef.current) {
      hoverIdRef.current = null
      setHover(null)
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas._startTransition?.('idle')
  }, [])

  // ── Render JSX shell ──────────────────────────────────────────────────
  const hoverState = hover?.stateId ? stateProgramMap[hover.stateId] : null
  // Cursor: pointer when something is clickable (idle to zoom in, focused
  // to click a state); default otherwise. Previously used cursor-wait
  // during the rotate+zoom transition, which rendered as a system loading
  // spinner — Aden flagged it as visually noisy ("the blue loading thing
  // on my cursor when I click it, it should never show that").
  const cursorClass = phase === 'animating' ? 'cursor-default' : 'cursor-pointer'

  return (
    <div className="flex items-center justify-center w-full h-full p-2">
      <div
        ref={containerRef}
        className="relative aspect-square w-full max-w-[560px] mx-auto"
      >
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={`${cursorClass} select-none`}
          style={{
            opacity: ready ? 1 : 0,
            transition: 'opacity 0.8s ease',
            touchAction: 'none',
          }}
        />

        {/* Idle CTA pill — bottom-center, only while idle/animating-in */}
        {phase === 'idle' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.20em] font-semibold"
              style={{
                background: 'rgba(11,22,35,0.78)',
                border: '1px solid rgba(20,184,166,0.45)',
                color: '#5EEAD4',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#14B8A6' }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
              </span>
              Click to explore US
            </span>
          </div>
        )}

        {/* Live-markers source label — bottom-left when the user has
            saved Library projects loaded. Aden 2026-05-28: only the
            user's saved markets light up; no public-data fallback. */}
        {phase === 'idle' && liveMarkersSource === 'library' && (
          <div className="absolute bottom-4 left-4 pointer-events-none">
            <span
              className="inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.22em]"
              style={{ color: 'var(--text-muted, #6C7A91)' }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#5EEAD4', boxShadow: '0 0 6px rgba(94,234,212,0.6)' }} />
              Your saved markets
            </span>
          </div>
        )}

        {/* Zoom-out pill — top-right, only while focused */}
        {phase === 'focused' && (
          <button
            type="button"
            onClick={handleZoomOut}
            className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors hover:brightness-110"
            style={{
              background: 'rgba(11,22,35,0.85)',
              border: '1px solid rgba(20,184,166,0.30)',
              color: '#98A4B6',
              backdropFilter: 'blur(8px)',
            }}
            aria-label="Return to rotating globe"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
            </svg>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold">Zoom out</span>
          </button>
        )}

        {/* Hover tooltip — Focused phase, state hit-test */}
        {phase === 'focused' && hover && hoverState && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{ left: hover.x + 12, top: hover.y - 10 }}
          >
            <div
              className="text-xs rounded-md px-3 py-2 shadow-2xl max-w-[220px]"
              style={{
                background: 'rgba(11,22,35,0.96)',
                border: '1px solid rgba(20,184,166,0.40)',
                backdropFilter: 'blur(8px)',
                color: 'rgba(255,255,255,0.92)',
              }}
            >
              <div className="font-semibold">{hoverState.name}</div>
              {hoverState.csProgram && (
                <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{hoverState.csProgram}</div>
              )}
              {hoverState.feasibilityScore > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.55)' }}>Feasibility</span>
                  <span className="font-mono tabular-nums" style={{ color: '#5EEAD4', fontWeight: 700 }}>
                    {hoverState.feasibilityScore}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading skeleton — a shimmering circular wireframe that
            previews the globe shape, plus a centered status label.
            Replaces the previous bare "Loading globe…" text per Aden's
            2026-05-28 note on loading-state polish. */}
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div
              className="absolute inset-0 flex items-center justify-center"
              aria-hidden="true"
            >
              {/* Three concentric pulsing rings — sells the "earth booting up" feel */}
              <div className="absolute rounded-full dash-pulse-dot" style={{ width: '60%', height: '60%', border: '1px solid rgba(94,234,212,0.35)', animationDuration: '2.4s' }} />
              <div className="absolute rounded-full dash-pulse-dot" style={{ width: '75%', height: '75%', border: '1px solid rgba(94,234,212,0.20)', animationDuration: '3.2s', animationDelay: '0.4s' }} />
              <div className="absolute rounded-full dash-pulse-dot" style={{ width: '90%', height: '90%', border: '1px solid rgba(94,234,212,0.10)', animationDuration: '4.0s', animationDelay: '0.8s' }} />
              {/* Shimmer band sweeping across the sphere area */}
              <div className="absolute rounded-full overflow-hidden" style={{ width: '60%', height: '60%' }}>
                <div className="absolute inset-0 dash-shimmer" />
              </div>
            </div>
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#14B8A6' }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold" style={{ color: 'var(--link, #5EEAD4)' }}>
                  Building globe
                </span>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                Fetching world + state topology…
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
