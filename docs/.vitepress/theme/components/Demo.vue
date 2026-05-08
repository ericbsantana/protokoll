<template>
  <div class="demo">
    <header class="demo-intro">
      <h1>How a round runs</h1>
      <p class="lead">
        Walk through a full VRF round end-to-end. Every value is computed in
        your browser - the proof you watch verify is a real DLEQ proof, not a
        mock.
      </p>
    </header>

    <ol class="demo-steps">
      <!-- Step 1: Request -->
      <li class="step" :class="stepStateClass(1)">
        <div class="step-marker">01</div>
        <div class="step-body">
          <h2>Request</h2>
          <p>
            A consumer contract emits
            <code>RandomnessRequested(roundId)</code>. The oracle watches for
            this event and starts proving.
          </p>

          <div class="step-input">
            <label class="input-row">
              <span class="input-label">roundId</span>
              <input
                v-model="roundIdInput"
                type="text"
                class="input"
                :disabled="currentStep > 1"
                spellcheck="false"
                autocapitalize="off"
                autocomplete="off"
                @keydown.enter.prevent="runRequest"
              />
            </label>
            <button
              class="run-button"
              :disabled="!canRun"
              @click="runRequest"
            >
              <span v-if="currentStep === 1">Run</span>
              <span v-else>Done</span>
            </button>
          </div>

          <p v-if="inputError" class="input-error">{{ inputError }}</p>

          <pre v-if="step1Output" class="event-panel">{{ step1Output }}</pre>
        </div>
      </li>

      <!-- Step 2: Prove -->
      <li class="step" :class="stepStateClass(2)">
        <div class="step-marker">02</div>
        <div class="step-body">
          <h2>Prove</h2>
          <p>
            The oracle computes a DLEQ proof off-chain using its private key
            <code>k</code>. Every value below is freshly computed in your
            browser.
          </p>

          <div v-if="computing" class="proof-loading">
            <span class="loading-dot" aria-hidden="true">●</span>
            computing DLEQ proof…
          </div>

          <div v-else-if="proofError" class="proof-error">
            Error: {{ proofError }}
          </div>

          <div v-else-if="proof" class="proof-panel">
            <div class="demo-key-banner">
              <span class="banner-tag">DEMO ONLY</span>
              <code>k = {{ kDemoTruncated }}</code>
            </div>

            <dl class="proof-rows">
              <div
                v-for="(item, i) in proofRows"
                :key="item.label"
                class="proof-row"
              >
                <dt class="row-label">{{ item.label }}</dt>
                <dd class="row-value">
                  <HexDecode :text="item.value" :start-delay="i * 90" />
                </dd>
              </div>
            </dl>
          </div>

          <div v-else class="step-content">
            <em class="placeholder">— pending —</em>
          </div>
        </div>
      </li>

      <!-- Steps 3-4 placeholders -->
      <li
        v-for="step in pendingSteps"
        :key="step.n"
        class="step"
        :class="stepStateClass(step.n)"
      >
        <div class="step-marker">{{ step.n.toString().padStart(2, '0') }}</div>
        <div class="step-body">
          <h2>{{ step.title }}</h2>
          <p v-html="step.lead" />
          <div class="step-content">
            <em class="placeholder">— pending —</em>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { bls12_381 } from '@noble/curves/bls12-381'
import {
  bigintToHex,
  bytesToHex,
  DEMO_DST,
  encodeRoundId,
  K_DEMO,
  roundIdBytes,
  truncateHex,
} from '../lib/demo'
// Cross-tree import. Allowed by vite.server.fs.allow in config.ts.
import { generateOracleProof } from '../../../../src/oracle/proof'
import HexDecode from './HexDecode.vue'

const pendingSteps = [
  {
    n: 3,
    title: 'Verify',
    lead: 'On-chain, the BLS12-381 precompiles re-derive the challenge and check it matches.',
  },
  {
    n: 4,
    title: 'Deliver',
    lead: '<code>β</code> is returned to your contract via <code>fulfillRandomness(roundId, β)</code>.',
  },
]

// Demo "requester" address - in a real round this is the consumer contract.
const REQUESTER = '0x4a2c8a36b6b3df3c6c2e0f6a8b8e0c1f6b8e0d2a'

const roundIdInput = ref('lottery-round-42')
const currentStep = ref(1)
const step1Output = ref(null)
const computing = ref(false)
const proof = ref(null)
const hPoint = ref(null)
const proofError = ref(null)

const inputError = computed(() => {
  if (currentStep.value > 1) return null
  if (!roundIdInput.value.trim()) return null
  try {
    encodeRoundId(roundIdInput.value)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
})

const canRun = computed(() => {
  if (currentStep.value !== 1) return false
  if (!roundIdInput.value.trim()) return false
  return inputError.value === null
})

const kDemoTruncated = computed(() => truncateHex(bigintToHex(K_DEMO, 32), 8, 6))

const proofRows = computed(() => {
  if (!proof.value || !hPoint.value) return []
  const p = proof.value
  const h = hPoint.value
  return [
    { label: 'H.x', value: truncateHex(bigintToHex(h.x, 48)) },
    { label: 'H.y', value: truncateHex(bigintToHex(h.y, 48)) },
    { label: 'Y.x', value: truncateHex(bigintToHex(p.publicKey.x, 48)) },
    { label: 'Y.y', value: truncateHex(bigintToHex(p.publicKey.y, 48)) },
    { label: 'γ.x', value: truncateHex(bigintToHex(p.gamma.x, 48)) },
    { label: 'γ.y', value: truncateHex(bigintToHex(p.gamma.y, 48)) },
    { label: 'c',   value: truncateHex(bigintToHex(p.c, 32)) },
    { label: 's',   value: truncateHex(bigintToHex(p.s, 32)) },
    { label: 'β',   value: truncateHex(bytesToHex(p.beta)) },
  ]
})

async function runRequest() {
  if (!canRun.value) return
  const idHex = encodeRoundId(roundIdInput.value)
  step1Output.value = `RandomnessRequested(\n  roundId:    ${idHex},\n  requester:  ${REQUESTER}\n)`
  currentStep.value = 2
  computing.value = true
  proof.value = null
  hPoint.value = null
  proofError.value = null

  try {
    const idBytes = roundIdBytes(roundIdInput.value)
    const H = bls12_381.G1.hashToCurve(idBytes, { DST: DEMO_DST }).toAffine()
    hPoint.value = { x: H.x, y: H.y }
    proof.value = await generateOracleProof(K_DEMO, idBytes)
  } catch (e) {
    proofError.value = e instanceof Error ? e.message : String(e)
  } finally {
    computing.value = false
    if (proof.value) {
      // After staggered reveal completes, advance to Step 3.
      const totalReveal = 9 * 90 + 800
      setTimeout(() => {
        if (proof.value) currentStep.value = 3
      }, totalReveal)
    }
  }
}

function stepStateClass(n) {
  if (currentStep.value > n) return 'is-done'
  if (currentStep.value === n) return 'is-active'
  return 'is-pending'
}
</script>

<style scoped>
.demo {
  max-width: 760px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
}

.demo-intro {
  margin-bottom: 3rem;
}

.demo-intro h1 {
  font-family: 'Fira Code', monospace;
  font-weight: 500;
  letter-spacing: -0.025em;
  font-size: 1.85rem;
  margin: 0 0 0.75rem;
  background: linear-gradient(135deg, #fb923c 0%, #f97316 60%, #ea6c0a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.demo-intro .lead {
  font-family: 'Lora', serif;
  font-size: 1.05rem;
  line-height: 1.75;
  color: var(--vp-c-text-2);
  margin: 0;
}

.demo-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1.25rem;
}

.step {
  display: grid;
  grid-template-columns: 3.25rem 1fr;
  gap: 1.25rem;
  padding: 1.5rem 1.5rem 1.5rem 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  transition: opacity 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.step.is-pending {
  opacity: 0.45;
}

.step.is-active {
  border-color: var(--vp-c-brand-1);
  box-shadow: inset 0 2px 0 0 var(--vp-c-brand-1);
}

.step.is-done {
  opacity: 0.85;
}

.step-marker {
  font-family: 'Fira Code', monospace;
  font-size: 1.05rem;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--vp-c-brand-1);
  align-self: start;
  padding-top: 0.15rem;
}

.step.is-pending .step-marker {
  color: var(--vp-c-text-3);
}

.step-body h2 {
  font-family: 'Fira Code', monospace;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.85rem;
  margin: 0 0 0.5rem;
  color: var(--vp-c-text-1);
}

.step-body p {
  font-family: 'Lora', serif;
  font-size: 0.975rem;
  line-height: 1.7;
  color: var(--vp-c-text-2);
  margin: 0 0 1rem;
}

.step-body :deep(code) {
  font-family: 'Fira Code', monospace;
  font-size: 0.85em;
  padding: 0.1em 0.35em;
  border-radius: 3px;
  background-color: rgba(249, 115, 22, 0.1);
  color: #f97316;
}

/* Step 1 input row */

.step-input {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
  align-items: stretch;
}

.input-row {
  display: grid;
  grid-template-columns: 5.25rem 1fr;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 5px;
  background: var(--vp-c-bg-alt);
  padding: 0.55rem 0.75rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-row:focus-within {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12);
}

.input-label {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.input {
  font-family: 'Fira Code', monospace;
  font-size: 0.9rem;
  background: transparent;
  border: none;
  outline: none;
  color: var(--vp-c-text-1);
  padding: 0;
  width: 100%;
}

.input:disabled {
  color: var(--vp-c-text-2);
  cursor: not-allowed;
}

.run-button {
  font-family: 'Fira Code', monospace;
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  padding: 0 1.25rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 5px;
  background: var(--vp-c-brand-1);
  color: #0c0f12;
  cursor: pointer;
  transition: background-color 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
}

.run-button:hover:not(:disabled) {
  background: var(--vp-c-brand-3);
  transform: translateY(-1px);
}

.run-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  background: transparent;
  color: var(--vp-c-text-3);
  border-color: var(--vp-c-divider);
}

.input-error {
  font-family: 'Fira Code', monospace;
  font-size: 0.78rem;
  color: #f87171;
  margin: 0.5rem 0 0;
}

.event-panel {
  font-family: 'Fira Code', monospace;
  font-size: 0.78rem;
  line-height: 1.65;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  border-left: 2px solid var(--vp-c-brand-1);
  border-radius: 4px;
  padding: 0.85rem 1rem;
  margin: 1rem 0 0;
  color: var(--vp-c-text-1);
  white-space: pre;
  overflow-x: auto;
}

/* Step 2 proof panel */

.proof-loading {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-family: 'Fira Code', monospace;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  padding: 0.75rem 0 0;
}

.loading-dot {
  display: inline-block;
  color: var(--vp-c-brand-1);
  animation: loading-pulse 1.2s ease-in-out infinite;
}

@keyframes loading-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.proof-error {
  font-family: 'Fira Code', monospace;
  font-size: 0.82rem;
  color: #f87171;
  padding: 0.75rem 1rem;
  background: rgba(248, 113, 113, 0.06);
  border: 1px solid rgba(248, 113, 113, 0.25);
  border-radius: 4px;
}

.proof-panel {
  display: grid;
  gap: 0.65rem;
}

.demo-key-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.85rem;
  background: rgba(249, 115, 22, 0.06);
  border: 1px solid rgba(249, 115, 22, 0.2);
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
}

.demo-key-banner :deep(code) {
  background: transparent;
  padding: 0;
  color: var(--vp-c-text-1);
  font-size: 0.78rem;
}

.banner-tag {
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.18rem 0.45rem;
  background: var(--vp-c-brand-1);
  color: #0c0f12;
  border-radius: 3px;
  flex-shrink: 0;
}

.proof-rows {
  margin: 0;
  padding: 0.85rem 1rem;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  border-left: 2px solid var(--vp-c-brand-1);
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 0.78rem;
  display: grid;
  gap: 0.4rem;
}

.proof-row {
  display: grid;
  grid-template-columns: 3rem 1fr;
  gap: 0.85rem;
  align-items: baseline;
}

.row-label {
  color: var(--vp-c-brand-1);
  font-weight: 500;
  letter-spacing: -0.01em;
  margin: 0;
}

.row-value {
  color: var(--vp-c-text-1);
  margin: 0;
  word-break: break-all;
}

.step-content {
  font-family: 'Fira Code', monospace;
  font-size: 0.82rem;
  padding: 0.85rem 1rem;
  background: var(--vp-c-bg-alt);
  border-radius: 4px;
  border: 1px dashed var(--vp-c-divider);
  min-height: 2.5rem;
  display: flex;
  align-items: center;
  color: var(--vp-c-text-3);
}

.placeholder {
  font-style: italic;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
}

@media (max-width: 640px) {
  .demo {
    padding: 1.5rem 1rem 3rem;
  }

  .demo-intro h1 {
    font-size: 1.5rem;
  }

  .step {
    grid-template-columns: 2rem 1fr;
    gap: 0.75rem;
    padding: 1.25rem 1rem;
  }

  .step-marker {
    font-size: 0.95rem;
  }

  .step-input {
    grid-template-columns: 1fr;
  }

  .input-row {
    grid-template-columns: 4.5rem 1fr;
  }

  .proof-row {
    grid-template-columns: 2.5rem 1fr;
    gap: 0.5rem;
  }

  .proof-rows {
    font-size: 0.72rem;
    padding: 0.7rem 0.85rem;
  }

  .demo-key-banner {
    flex-wrap: wrap;
    font-size: 0.7rem;
  }
}
</style>
