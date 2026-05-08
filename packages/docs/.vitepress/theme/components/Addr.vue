<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ addr: string }>()
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

async function copy() {
  try {
    await navigator.clipboard.writeText(props.addr)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = props.addr
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } finally {
      document.body.removeChild(ta)
    }
  }
  copied.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
  }, 1500)
}
</script>

<template>
  <span class="addr">
    <code>{{ addr }}</code>
    <button
      type="button"
      class="addr-copy"
      :class="{ copied }"
      :title="copied ? 'Copied' : 'Copy to clipboard'"
      :aria-label="copied ? 'Copied' : 'Copy to clipboard'"
      @click="copy"
    >
      <svg
        v-if="!copied"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <svg
        v-else
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  </span>
</template>

<style scoped>
.addr {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  white-space: nowrap;
}
.addr code {
  white-space: nowrap;
}
.addr-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  cursor: pointer;
  color: var(--vp-c-text-2);
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
  flex: none;
}
.addr-copy:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
}
.addr-copy:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
.addr-copy.copied {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}
</style>
