<template>
  <span>{{ display }}</span>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  text: { type: String, required: true },
  startDelay: { type: Number, default: 0 },
  resolveMs: { type: Number, default: 700 },
  cycleMs: { type: Number, default: 55 },
})

const display = ref(props.text)

const HEX = '0123456789abcdef'
const HEX_CHAR = /^[0-9a-f]$/i
const randHex = () => HEX[Math.floor(Math.random() * 16)]

function partial(real, lockIdx) {
  let out = ''
  for (let i = 0; i < real.length; i++) {
    const c = real[i]
    if (i < lockIdx || !HEX_CHAR.test(c)) out += c
    else out += randHex()
  }
  return out
}

let timers = []

function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}

function startAnim() {
  clearTimers()
  const real = props.text
  if (typeof window === 'undefined') {
    display.value = real
    return
  }
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    display.value = real
    return
  }
  display.value = partial(real, 0)
  const startId = setTimeout(() => {
    const t0 = performance.now()
    const tick = () => {
      const elapsed = performance.now() - t0
      const lock = Math.floor((elapsed / props.resolveMs) * real.length)
      if (lock >= real.length) {
        display.value = real
        return
      }
      display.value = partial(real, lock)
      timers.push(setTimeout(tick, props.cycleMs))
    }
    tick()
  }, props.startDelay)
  timers.push(startId)
}

onMounted(startAnim)

watch(
  () => props.text,
  () => startAnim(),
)

onBeforeUnmount(clearTimers)
</script>
