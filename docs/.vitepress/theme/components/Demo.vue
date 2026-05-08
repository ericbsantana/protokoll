<template>
  <div ref="demoRoot" class="demo">
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
                ref="inputEl"
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

          <div v-if="canContinue && currentStep === 1" class="continue-row">
            <button class="continue-button" type="button" @click="continueToNext">
              Continue
              <span class="continue-arrow" aria-hidden="true">↓</span>
            </button>
          </div>
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

          <div v-if="canContinue && currentStep === 2" class="continue-row">
            <button class="continue-button" type="button" @click="continueToNext">
              Continue
              <span class="continue-arrow" aria-hidden="true">↓</span>
            </button>
          </div>
        </div>
      </li>

      <!-- Step 3: Verify -->
      <li class="step" :class="stepStateClass(3)">
        <div class="step-marker">03</div>
        <div class="step-body">
          <h2>Verify</h2>
          <p>
            On-chain, the BLS12-381 precompiles re-derive
            <code>U'</code>, <code>V'</code>, and the challenge
            <code>c'</code>. If <code>c' == c</code>, the proof is valid -
            the oracle could not have produced these values without knowing
            <code>k</code>.
          </p>

          <div v-if="currentStep >= 3 && verifyResult" class="verify-panel">
            <dl class="proof-rows">
              <div
                v-for="(item, i) in verifyRows"
                :key="item.label"
                class="proof-row"
              >
                <dt class="row-label">{{ item.label }}</dt>
                <dd class="row-value">
                  <HexDecode :text="item.value" :start-delay="i * 90" />
                </dd>
              </div>
            </dl>

            <div
              class="verify-result"
              :class="verifyResult.matches ? 'is-verified' : 'is-failed'"
              :style="{ animationDelay: `${verifyRows.length * 90 + 700}ms` }"
            >
              <span class="verify-badge">
                <span v-if="verifyResult.matches">✓ VERIFIED</span>
                <span v-else>✗ FAILED</span>
              </span>
              <span class="verify-explainer">
                <code>c'</code>
                {{ verifyResult.matches ? 'matches' : 'differs from' }}
                <code>c</code>
              </span>
            </div>
          </div>

          <div v-else class="step-content">
            <em class="placeholder">— pending —</em>
          </div>

          <div v-if="canContinue && currentStep === 3" class="continue-row">
            <button class="continue-button" type="button" @click="continueToNext">
              Continue
              <span class="continue-arrow" aria-hidden="true">↓</span>
            </button>
          </div>
        </div>
      </li>

      <!-- Step 4: Deliver -->
      <li class="step" :class="stepStateClass(4)">
        <div class="step-marker">04</div>
        <div class="step-body">
          <h2>Deliver</h2>
          <p>
            The adapter calls <code>fulfillRandomness(roundId, β)</code> on
            your contract. <code>β</code> is the 32-byte random value -
            same bytes every time for this <code>roundId</code>, derivable
            into any outcome.
          </p>

          <div v-if="currentStep >= 4 && proof" class="deliver-panel">
            <dl class="beta-row">
              <dt class="row-label">β</dt>
              <dd class="row-value beta-value">
                <HexDecode :text="betaHex" :resolve-ms="900" />
              </dd>
            </dl>

            <dl class="derivation-rows">
              <div class="derivation-row">
                <dt class="derivation-label">dice roll</dt>
                <dd class="derivation-formula">
                  <code>uint256(β) % 6 + 1</code>
                </dd>
                <dd class="derivation-value">{{ diceRoll }}</dd>
              </div>
              <div class="derivation-row">
                <dt class="derivation-label">lottery ticket</dt>
                <dd class="derivation-formula">
                  <code>uint256(β) % 100</code>
                </dd>
                <dd class="derivation-value">#{{ lotteryWinner }}</dd>
              </div>
            </dl>

            <p class="integration-callout">
              Your contract receives this same <code>β</code> via
              <a href="/guide/integration"><code>fulfillRandomness</code></a>.
            </p>

            <div class="reset-row">
              <button class="reset-button" type="button" @click="reset">
                <span class="reset-icon" aria-hidden="true">↻</span>
                Run again
              </button>
            </div>
          </div>

          <div v-else class="step-content">
            <em class="placeholder">— pending —</em>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { bls12_381 } from '@noble/curves/bls12-381'
import {
  betaToBigint,
  bigintToHex,
  bytesToHex,
  DEMO_DST,
  encodeRoundId,
  K_DEMO,
  recomputeAndVerify,
  roundIdBytes,
  truncateHex,
} from '../lib/demo'
// Cross-tree import. Allowed by vite.server.fs.allow in config.ts.
import { generateOracleProof } from '../../../../src/oracle/proof'
import HexDecode from './HexDecode.vue'

// Demo "requester" address - in a real round this is the consumer contract.
const REQUESTER = '0x4a2c8a36b6b3df3c6c2e0f6a8b8e0c1f6b8e0d2a'

const roundIdInput = ref('lottery-round-42')
const currentStep = ref(1)
// Highest step whose reveal animation has finished. Drives the Continue
// button: it appears when stepRevealed === currentStep.
const stepRevealed = ref(0)
const step1Output = ref(null)
const computing = ref(false)
const proof = ref(null)
const hPoint = ref(null)
const proofError = ref(null)
const verifyResult = ref(null)
const demoRoot = ref(null)
const inputEl = ref(null)
const pendingTimers = []

// Reveal durations are tuned to match the staggered HexDecode + banner
// timings inside each step's panel.
const STEP_REVEAL_MS = {
  2: 9 * 90 + 800,        // 9 proof rows + final resolve
  3: 5 * 90 + 700 + 600,  // 5 verify rows + VERIFIED banner
  4: 1900,                // beta hex + derivation cards + callout
}

function scheduleReveal(stepN) {
  const ms = STEP_REVEAL_MS[stepN]
  if (!ms) return
  pendingTimers.push(
    setTimeout(() => {
      if (stepRevealed.value < stepN) stepRevealed.value = stepN
    }, ms),
  )
}

// Step 2: schedule once both proof data and the active panel are present.
watch([proof, currentStep], ([p, step]) => {
  if (p && step === 2 && stepRevealed.value < 2) scheduleReveal(2)
})

// Step 3: same gate, against verifyResult.
watch([verifyResult, currentStep], ([v, step]) => {
  if (v && step === 3 && stepRevealed.value < 3) scheduleReveal(3)
})

// Step 4: only depends on having entered, since beta is already in proof.
watch(currentStep, (step) => {
  if (step === 4 && proof.value && stepRevealed.value < 4) scheduleReveal(4)
})

const canContinue = computed(
  () => currentStep.value < 4 && stepRevealed.value === currentStep.value,
)

function continueToNext() {
  if (!canContinue.value) return
  currentStep.value++
}

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

const verifyRows = computed(() => {
  if (!verifyResult.value) return []
  const v = verifyResult.value
  return [
    { label: "U'.x", value: truncateHex(bigintToHex(v.U_prime.x, 48)) },
    { label: "U'.y", value: truncateHex(bigintToHex(v.U_prime.y, 48)) },
    { label: "V'.x", value: truncateHex(bigintToHex(v.V_prime.x, 48)) },
    { label: "V'.y", value: truncateHex(bigintToHex(v.V_prime.y, 48)) },
    { label: "c'",   value: truncateHex(bigintToHex(v.c_prime, 32)) },
  ]
})

const betaHex = computed(() =>
  proof.value ? bytesToHex(proof.value.beta) : '',
)

const diceRoll = computed(() =>
  proof.value ? Number(betaToBigint(proof.value.beta) % 6n) + 1 : null,
)

const lotteryWinner = computed(() =>
  proof.value ? Number(betaToBigint(proof.value.beta) % 100n) : null,
)

async function runRequest() {
  if (!canRun.value) return
  const idHex = encodeRoundId(roundIdInput.value)
  step1Output.value = `RandomnessRequested(\n  roundId:    ${idHex},\n  requester:  ${REQUESTER}\n)`
  // Step 1 has no animation - mark it revealed immediately so Continue shows.
  stepRevealed.value = 1
  computing.value = true
  proof.value = null
  hPoint.value = null
  proofError.value = null
  verifyResult.value = null

  try {
    const idBytes = roundIdBytes(roundIdInput.value)
    const H = bls12_381.G1.hashToCurve(idBytes, { DST: DEMO_DST }).toAffine()
    hPoint.value = { x: H.x, y: H.y }
    proof.value = await generateOracleProof(K_DEMO, idBytes)
    verifyResult.value = await recomputeAndVerify(proof.value, hPoint.value)
  } catch (e) {
    proofError.value = e instanceof Error ? e.message : String(e)
  } finally {
    computing.value = false
  }
}

function reset() {
  while (pendingTimers.length) clearTimeout(pendingTimers.pop())
  proof.value = null
  hPoint.value = null
  verifyResult.value = null
  proofError.value = null
  step1Output.value = null
  computing.value = false
  currentStep.value = 1
  stepRevealed.value = 0
  nextTick(() => {
    if (typeof window === 'undefined') return
    demoRoot.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    inputEl.value?.focus()
  })
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

/* Step 3 verify result */

.verify-panel {
  display: grid;
  gap: 0.65rem;
}

.verify-result {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.95rem 1.1rem;
  border-radius: 6px;
  font-family: 'Fira Code', monospace;
  opacity: 0;
  transform: translateY(4px);
  animation: verify-in 600ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}

.verify-result :deep(code) {
  background: transparent;
  padding: 0;
  font-size: 0.92em;
}

.verify-result.is-verified {
  background: linear-gradient(135deg, rgba(251, 146, 60, 0.16) 0%, rgba(249, 115, 22, 0.10) 100%);
  border: 1px solid var(--vp-c-brand-1);
  color: var(--vp-c-brand-3);
  box-shadow:
    inset 0 1px 0 0 rgba(249, 115, 22, 0.18),
    0 8px 24px rgba(249, 115, 22, 0.08);
}

.verify-result.is-failed {
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: #f87171;
}

.verify-badge {
  font-size: 1.05rem;
  font-weight: 500;
  letter-spacing: 0.05em;
}

.verify-explainer {
  font-family: 'Lora', serif;
  font-style: italic;
  font-size: 0.82rem;
  font-weight: 300;
  color: var(--vp-c-text-2);
}

@keyframes verify-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .verify-result {
    opacity: 1;
    transform: none;
    animation: none;
  }
}

/* Step 4 deliver panel */

.deliver-panel {
  display: grid;
  gap: 0.85rem;
}

.beta-row {
  margin: 0;
  display: grid;
  grid-template-columns: 3rem 1fr;
  gap: 0.85rem;
  align-items: baseline;
  padding: 0.85rem 1rem;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  border-left: 2px solid var(--vp-c-brand-1);
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 0.78rem;
}

.beta-value {
  color: var(--vp-c-text-1);
  margin: 0;
  word-break: break-all;
}

.derivation-rows {
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
  opacity: 0;
  animation: fade-in 600ms cubic-bezier(0.2, 0.7, 0.2, 1) 950ms forwards;
}

.derivation-row {
  display: grid;
  grid-template-columns: 7rem 1fr auto;
  align-items: baseline;
  gap: 0.85rem;
  padding: 0.65rem 0.95rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  font-family: 'Fira Code', monospace;
}

.derivation-label {
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.72rem;
  color: var(--vp-c-text-2);
  margin: 0;
}

.derivation-formula {
  font-size: 0.78rem;
  margin: 0;
  color: var(--vp-c-text-3);
}

.derivation-formula :deep(code) {
  background: transparent;
  padding: 0;
  color: var(--vp-c-text-2);
  font-size: 0.92em;
}

.derivation-value {
  font-weight: 500;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
  color: var(--vp-c-brand-1);
  margin: 0;
}

.integration-callout {
  font-family: 'Lora', serif;
  font-style: italic;
  font-size: 0.92rem;
  color: var(--vp-c-text-2);
  margin: 0.35rem 0 0;
  opacity: 0;
  animation: fade-in 600ms cubic-bezier(0.2, 0.7, 0.2, 1) 1300ms forwards;
}

.integration-callout a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  border-bottom: 1px dotted var(--vp-c-brand-1);
}

.integration-callout a:hover {
  border-bottom-style: solid;
}

.integration-callout :deep(code) {
  font-size: 0.88em;
}

.continue-row {
  display: flex;
  justify-content: center;
  margin-top: 1.1rem;
  opacity: 0;
  animation: fade-in 360ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}

.continue-button {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-family: 'Fira Code', monospace;
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  padding: 0.55rem 1.2rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 5px;
  background: transparent;
  color: var(--vp-c-brand-1);
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.2s ease;
}

.continue-button:hover {
  background: var(--vp-c-brand-soft);
  transform: translateY(1px);
  box-shadow: 0 4px 14px rgba(249, 115, 22, 0.1);
}

.continue-arrow {
  display: inline-block;
  font-size: 0.95rem;
  transition: transform 0.18s ease;
}

.continue-button:hover .continue-arrow {
  transform: translateY(2px);
}

.continue-button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.reset-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.4rem;
}

.reset-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: 'Fira Code', monospace;
  font-size: 0.78rem;
  letter-spacing: -0.01em;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 5px;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    color 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}

.reset-button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.reset-icon {
  display: inline-block;
  font-size: 0.95rem;
  transition: transform 0.4s ease;
}

.reset-button:hover .reset-icon {
  transform: rotate(-180deg);
}

/* Focus-visible for keyboard nav */

.run-button:focus-visible,
.reset-button:focus-visible,
.input-row:focus-within {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.input-row:focus-within {
  outline: none; /* the existing border-color shift already signals focus */
}

.integration-callout a:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
  border-radius: 2px;
}

@keyframes fade-in {
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .derivation-rows,
  .integration-callout {
    opacity: 1;
    animation: none;
  }
}

@media (max-width: 640px) {
  .derivation-row {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'label value'
      'formula formula';
    gap: 0.35rem 0.85rem;
  }
  .derivation-label {
    grid-area: label;
  }
  .derivation-value {
    grid-area: value;
  }
  .derivation-formula {
    grid-area: formula;
  }
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

  .verify-result {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
  }

  .beta-row {
    grid-template-columns: 2.25rem 1fr;
    gap: 0.55rem;
    font-size: 0.72rem;
  }
}
</style>
