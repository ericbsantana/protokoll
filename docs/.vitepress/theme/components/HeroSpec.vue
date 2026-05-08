<template>
  <ul class="hero-spec" aria-label="Project guarantees">
    <li
      v-for="(item, i) in items"
      :key="item.key"
      :style="{ animationDelay: `${120 + i * 90}ms` }"
    >
      <span class="check" aria-hidden="true">✓</span>
      <span class="key" :aria-label="item.key">{{ keyDisplay[i] }}</span>
      <span class="desc" :aria-label="item.desc">{{ descDisplay[i] }}</span>
    </li>
  </ul>

  <a class="hero-cta" href="/demo">
    <span class="cta-play" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14">
        <polygon points="6,4 20,12 6,20" fill="currentColor" />
      </svg>
    </span>
    <span class="cta-text">
      <span class="cta-title">See it run</span>
      <span class="cta-sub">walk through a full round in your browser</span>
    </span>
    <span class="cta-arrow" aria-hidden="true">→</span>
  </a>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const items = [
  { key: 'unforgeable',   desc: 'one valid outcome per round, checkable by anyone' },
  { key: 'drop-in',       desc: 'one interface, a few lines of Solidity' },
  { key: 'self-hostable', desc: 'MIT-licensed, no gatekeeper, no shared secret' },
]

const keyDisplay = ref(items.map(i => i.key))
const descDisplay = ref(items.map(i => i.desc))

const HEX = '0123456789abcdef'
const randHex = () => HEX[Math.floor(Math.random() * 16)]

function partial(real, lockIdx) {
  let out = ''
  for (let idx = 0; idx < real.length; idx++) {
    const c = real[idx]
    if (idx < lockIdx || c === ' ') out += c
    else out += randHex()
  }
  return out
}

let timers = []

onMounted(() => {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced) return

  // Scramble everything synchronously so the first paint after the fade-in is garbled.
  items.forEach((item, i) => {
    keyDisplay.value[i] = partial(item.key, 0)
    descDisplay.value[i] = partial(item.desc, 0)
  })

  items.forEach((item, i) => {
    const startDelay = 240 + i * 260
    const cycleMs = 55
    const resolveMs = 950
    const totalLen = item.key.length + item.desc.length
    const charsPerMs = totalLen / resolveMs

    const startId = setTimeout(() => {
      const t0 = performance.now()
      const tick = () => {
        const elapsed = performance.now() - t0
        const lock = Math.floor(elapsed * charsPerMs)
        const keyLock = Math.min(lock, item.key.length)
        const descLock = Math.max(0, Math.min(lock - item.key.length, item.desc.length))
        keyDisplay.value[i] = partial(item.key, keyLock)
        descDisplay.value[i] = partial(item.desc, descLock)
        if (keyLock >= item.key.length && descLock >= item.desc.length) {
          keyDisplay.value[i] = item.key
          descDisplay.value[i] = item.desc
          return
        }
        timers.push(setTimeout(tick, cycleMs))
      }
      tick()
    }, startDelay)
    timers.push(startId)
  })
})

onBeforeUnmount(() => {
  timers.forEach(t => clearTimeout(t))
  timers = []
})
</script>

<style scoped>
.hero-spec {
  list-style: none;
  padding: 0;
  margin: 2.25rem 0 0;
  max-width: 600px;
  font-family: 'Fira Code', monospace;
  font-size: 0.85rem;
  line-height: 1.7;
  display: grid;
  gap: 0.35rem;
}

.hero-spec li {
  display: grid;
  grid-template-columns: 1.1rem 7.25rem 1fr;
  align-items: baseline;
  gap: 0.6rem;
  opacity: 0;
  transform: translateY(4px);
  animation: spec-in 480ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}

.check {
  color: var(--vp-c-brand-1);
  font-weight: 500;
}

.key {
  color: var(--vp-c-text-1);
  font-weight: 500;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}

.desc {
  color: var(--vp-c-text-2);
  font-weight: 300;
  font-variant-numeric: tabular-nums;
}

@keyframes spec-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-spec li {
    opacity: 1;
    transform: none;
    animation: none;
  }
}

.hero-cta {
  display: inline-grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.95rem;
  margin-top: 1.85rem;
  padding: 0.85rem 1.05rem 0.85rem 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  text-decoration: none;
  font-family: 'Fira Code', monospace;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.25s ease;
  opacity: 0;
  transform: translateY(4px);
  animation: cta-in 540ms cubic-bezier(0.2, 0.7, 0.2, 1) 480ms forwards;
}

.hero-cta:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-elv);
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 0 rgba(249, 115, 22, 0.12),
    0 8px 24px rgba(249, 115, 22, 0.08);
}

.hero-cta:hover .cta-arrow {
  transform: translateX(3px);
  color: var(--vp-c-brand-1);
}

.cta-play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #fb923c 0%, #f97316 60%, #ea6c0a 100%);
  color: #0c0f12;
  flex-shrink: 0;
}

.cta-play svg {
  margin-left: 2px;
}

.cta-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.cta-title {
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: -0.015em;
  color: var(--vp-c-text-1);
}

.cta-sub {
  font-family: 'Lora', serif;
  font-style: italic;
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  margin-top: 0.15rem;
}

.cta-arrow {
  font-size: 1.1rem;
  color: var(--vp-c-text-3);
  transition: transform 0.2s ease, color 0.2s ease;
}

@keyframes cta-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-cta {
    opacity: 1;
    transform: none;
    animation: none;
  }
}

@media (max-width: 640px) {
  .hero-spec {
    font-size: 0.75rem;
    margin-top: 1.75rem;
  }
  .hero-spec li {
    grid-template-columns: 0.9rem 5.75rem 1fr;
    gap: 0.45rem;
  }
  .hero-cta {
    margin-top: 1.5rem;
    padding: 0.75rem 0.9rem 0.75rem 0.75rem;
    gap: 0.75rem;
  }
  .cta-play {
    width: 1.85rem;
    height: 1.85rem;
  }
  .cta-title {
    font-size: 0.88rem;
  }
  .cta-sub {
    font-size: 0.72rem;
  }
}
</style>
