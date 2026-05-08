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
      <li
        v-for="step in steps"
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
import { ref } from 'vue'

const steps = [
  {
    n: 1,
    title: 'Request',
    lead: 'A consumer contract emits <code>RandomnessRequested(roundId)</code>.',
  },
  {
    n: 2,
    title: 'Prove',
    lead: 'The oracle computes a DLEQ proof off-chain using its private key <code>k</code>.',
  },
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

const currentStep = ref(1)

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
}
</style>
