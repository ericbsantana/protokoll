<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement>()

const A = -3
const B = 1
const X_LEFT = -1.8793852
const X_MIDDLE = 0.3472964
const X_RIGHT = 1.5320889
const VIEW = { xMin: -2.5, xMax: 2.5, yMin: -2.5, yMax: 2.5 }

const ORBIT_MS = 12000
const HOLD_MS = 1800
const SETTLE_MS = 350
const CYCLE_MS = ORBIT_MS + HOLD_MS

const TRAIL_LEN = 80
const HASH_LEN = 16
const HEX = '0123456789abcdef'

const trail: { x: number; y: number }[] = []
let cycleHash = scrambleHash()
let scrambleBuffer = scrambleHash()
let lastScrambleTs = 0
let lastCycleIndex = -1

let raf = 0
let resizeObs: ResizeObserver | null = null
let intersectionObs: IntersectionObserver | null = null
let mq: MediaQueryList | null = null
let mqListener: ((e: MediaQueryListEvent) => void) | null = null
let visListener: (() => void) | null = null

let inView = true
let visible = true
let reducedMotion = false
let dpr = 1
let logicalW = 0
let logicalH = 0
let started = 0
let lastTs = 0

function f(x: number): number {
  return x * x * x + A * x + B
}

function project(x: number, y: number): [number, number] {
  // Curve fills upper portion; bottom strip is reserved for the hash readout.
  const yPad = 0.78 // 78% of canvas height for curve, 22% for hash strip
  const px = ((x - VIEW.xMin) / (VIEW.xMax - VIEW.xMin)) * logicalW
  const curveH = logicalH * yPad
  const py = curveH - ((y - VIEW.yMin) / (VIEW.yMax - VIEW.yMin)) * curveH
  return [px, py]
}

function pointAt(t: number): { x: number; y: number } {
  const phase = (((t % 1) + 1) % 1) * Math.PI * 2
  const upper = phase < Math.PI
  const local = upper ? phase : phase - Math.PI
  const u = (1 - Math.cos(local)) / 2
  const x = upper ? X_LEFT + (X_MIDDLE - X_LEFT) * u : X_MIDDLE + (X_LEFT - X_MIDDLE) * u
  const y2 = f(x)
  const y = y2 > 0 ? Math.sqrt(y2) : 0
  return { x, y: upper ? y : -y }
}

function isDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

function scrambleHash(): string {
  let s = ''
  for (let i = 0; i < HASH_LEN; i++) {
    s += HEX[Math.floor(Math.random() * 16)]
  }
  return s
}

function drawCurve(ctx: CanvasRenderingContext2D, resonance: number) {
  const dark = isDark()
  const baseAlpha = dark ? 0.5 : 0.45
  ctx.lineWidth = 1.25

  ctx.strokeStyle = dark
    ? `rgba(249, 115, 22, ${baseAlpha})`
    : `rgba(234, 108, 10, ${baseAlpha})`

  ctx.beginPath()
  let started = false
  for (let x = X_LEFT; x <= X_MIDDLE; x += 0.005) {
    const y2 = f(x)
    if (y2 < 0) continue
    const [px, py] = project(x, Math.sqrt(y2))
    if (!started) {
      ctx.moveTo(px, py)
      started = true
    } else {
      ctx.lineTo(px, py)
    }
  }
  for (let x = X_MIDDLE; x >= X_LEFT; x -= 0.005) {
    const y2 = f(x)
    if (y2 < 0) continue
    const [px, py] = project(x, -Math.sqrt(y2))
    ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.stroke()

  // Right component: alpha + glow rise during settle, decay through hold.
  const rightAlpha = Math.min(1, baseAlpha + resonance * 0.4)
  ctx.strokeStyle = dark
    ? `rgba(249, 115, 22, ${rightAlpha})`
    : `rgba(234, 108, 10, ${rightAlpha})`
  if (resonance > 0.05) {
    ctx.shadowColor = '#f97316'
    ctx.shadowBlur = resonance * 6
  }
  for (const sign of [1, -1] as const) {
    ctx.beginPath()
    let begun = false
    for (let x = X_RIGHT; x <= VIEW.xMax + 0.3; x += 0.005) {
      const y2 = f(x)
      if (y2 < 0) continue
      const [px, py] = project(x, sign * Math.sqrt(y2))
      if (!begun) {
        ctx.moveTo(px, py)
        begun = true
      } else {
        ctx.lineTo(px, py)
      }
    }
    ctx.stroke()
  }
  ctx.shadowBlur = 0
}

function drawTrail(ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < trail.length; i++) {
    const a = (i + 1) / trail.length
    ctx.fillStyle = `rgba(249, 115, 22, ${a * 0.55})`
    const [px, py] = project(trail[i].x, trail[i].y)
    ctx.beginPath()
    ctx.arc(px, py, 1 + a * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawLead(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  glow: number,
) {
  const [px, py] = project(p.x, p.y)
  ctx.shadowColor = '#f97316'
  ctx.shadowBlur = 12 + glow * 18
  ctx.fillStyle = '#f97316'
  ctx.beginPath()
  ctx.arc(px, py, 3.5 + glow * 1.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawHash(
  ctx: CanvasRenderingContext2D,
  text: string,
  lockedCount: number,
  settleProgress: number,
) {
  const dark = isDark()
  const baseY = logicalH * 0.91
  const fontSize = Math.max(11, logicalW * 0.038)
  ctx.font = `${fontSize}px "Fira Code", ui-monospace, monospace`
  ctx.textBaseline = 'middle'

  const lockedColor = dark ? 'rgba(249, 115, 22, 0.95)' : 'rgba(234, 108, 10, 0.92)'
  const scrambleColor = dark ? 'rgba(160, 170, 184, 0.36)' : 'rgba(110, 122, 138, 0.4)'

  const fullyLocked = lockedCount >= text.length

  if (fullyLocked) {
    ctx.textAlign = 'center'
    ctx.fillStyle = lockedColor
    ctx.shadowColor = '#f97316'
    ctx.shadowBlur = 8 * settleProgress
    ctx.fillText(text, logicalW / 2, baseY)
    ctx.shadowBlur = 0
    return
  }

  // Mid-decode: render char-by-char so locked positions read in brand color.
  ctx.textAlign = 'left'
  const charWidth = ctx.measureText('0').width
  const totalWidth = charWidth * text.length
  const startX = (logicalW - totalWidth) / 2
  for (let i = 0; i < text.length; i++) {
    ctx.fillStyle = i < lockedCount ? lockedColor : scrambleColor
    ctx.fillText(text[i], startX + i * charWidth, baseY)
  }
}

function setupCanvas(): CanvasRenderingContext2D | null {
  const canvas = canvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  dpr = window.devicePixelRatio || 1
  logicalW = rect.width
  logicalH = rect.height
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

function drawStaticFrame(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, logicalW, logicalH)
  drawCurve(ctx, 0)
  drawLead(ctx, pointAt(0), 0)
  drawHash(ctx, scrambleHash(), HASH_LEN, 1)
}

function frame(ts: number) {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (!started) started = ts
  lastTs = ts

  if (!inView || !visible) {
    raf = requestAnimationFrame(frame)
    return
  }

  const elapsed = ts - started
  const cyclePos = elapsed % CYCLE_MS
  const cycleIndex = Math.floor(elapsed / CYCLE_MS)

  const inOrbit = cyclePos < ORBIT_MS
  const orbitT = inOrbit ? cyclePos / ORBIT_MS : 1
  const settling = !inOrbit && cyclePos < ORBIT_MS + SETTLE_MS
  const settleProgress = settling ? (cyclePos - ORBIT_MS) / SETTLE_MS : 1

  // New cycle → fresh target hash; chars will lock progressively as orbit advances.
  if (cycleIndex !== lastCycleIndex) {
    cycleHash = scrambleHash()
    lastCycleIndex = cycleIndex
  }

  // Re-roll the noise buffer for unlocked positions.
  if (ts - lastScrambleTs > 80) {
    scrambleBuffer = scrambleHash()
    lastScrambleTs = ts
  }

  // Quadratic ease-in: most chars lock in the back half of the orbit.
  const lockProgress = inOrbit ? orbitT * orbitT : 1
  const lockedCount = Math.min(HASH_LEN, Math.floor(lockProgress * HASH_LEN))

  let display = ''
  for (let i = 0; i < HASH_LEN; i++) {
    display += i < lockedCount ? cycleHash[i] : scrambleBuffer[i]
  }

  // Resonance: rises with settle, decays through the rest of hold.
  let resonance = 0
  if (!inOrbit) {
    if (settling) {
      resonance = settleProgress
    } else {
      const postSettle = cyclePos - (ORBIT_MS + SETTLE_MS)
      const decayWindow = Math.max(1, HOLD_MS - SETTLE_MS)
      resonance = Math.max(0, 1 - postSettle / decayWindow)
    }
  }

  ctx.clearRect(0, 0, logicalW, logicalH)
  drawCurve(ctx, resonance)
  drawTrail(ctx)

  const p = pointAt(orbitT)
  const glow = inOrbit ? 0 : Math.min(1, settleProgress)
  drawLead(ctx, p, glow)

  if (inOrbit) {
    trail.push(p)
    while (trail.length > TRAIL_LEN) trail.shift()
  }

  drawHash(ctx, display, lockedCount, settleProgress)

  raf = requestAnimationFrame(frame)
}

function start() {
  cancelAnimationFrame(raf)
  raf = 0
  const ctx = setupCanvas()
  if (!ctx) return
  if (reducedMotion) {
    drawStaticFrame(ctx)
    return
  }
  trail.length = 0
  cycleHash = scrambleHash()
  scrambleBuffer = scrambleHash()
  lastScrambleTs = 0
  lastCycleIndex = -1
  started = 0
  lastTs = 0
  raf = requestAnimationFrame(frame)
}

function stop() {
  cancelAnimationFrame(raf)
  raf = 0
}

onMounted(() => {
  if (typeof window === 'undefined') return

  mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion = mq.matches
  mqListener = (e) => {
    reducedMotion = e.matches
    start()
  }
  mq.addEventListener('change', mqListener)

  visListener = () => {
    visible = !document.hidden
  }
  document.addEventListener('visibilitychange', visListener)

  const canvas = canvasRef.value
  if (canvas) {
    intersectionObs = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting
      },
      { threshold: 0 },
    )
    intersectionObs.observe(canvas)

    let lastW = 0
    let lastH = 0
    resizeObs = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      if (r.width === lastW && r.height === lastH) return
      lastW = r.width
      lastH = r.height
      start()
    })
    resizeObs.observe(canvas)
  }
})

onBeforeUnmount(() => {
  stop()
  resizeObs?.disconnect()
  intersectionObs?.disconnect()
  if (mq && mqListener) mq.removeEventListener('change', mqListener)
  if (visListener) document.removeEventListener('visibilitychange', visListener)
})
</script>

<template>
  <div class="curve-canvas">
    <canvas ref="canvasRef" />
  </div>
</template>

<style scoped>
.curve-canvas {
  width: 100%;
  max-width: 480px;
  aspect-ratio: 1 / 1;
  margin: 0 auto;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

@media (max-width: 959px) {
  .curve-canvas {
    display: none;
  }
}
</style>
