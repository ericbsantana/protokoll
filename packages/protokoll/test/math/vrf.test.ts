import { describe, it, expect } from 'vitest';
import { generateProof, verifyProof } from '../../src/math/vrf.js';
import { scalarMul, G1_GENERATOR, CURVE_ORDER } from '../../src/math/curve.js';

// A fixed private key for deterministic tests.
// In production k is secret. Here it's a known constant so we can predict Y.
const k = 42n;
const point_Y = scalarMul(k, G1_GENERATOR);

const roundId = new TextEncoder().encode('round-1');

describe('VRF - generateProof', () => {

  it('returns gamma, c, s, and beta', async () => {
    const proof = await generateProof(k, roundId);
    expect(proof).toHaveProperty('gamma');
    expect(proof).toHaveProperty('c');
    expect(proof).toHaveProperty('s');
    expect(proof).toHaveProperty('beta');
  });

  it('gamma is a curve point (not infinity)', async () => {
    const { gamma } = await generateProof(k, roundId);
    expect(gamma).not.toBe('infinity');
  });

  it('c and s are scalars in [0, curve order)', async () => {
    const { c, s } = await generateProof(k, roundId);
    expect(c).toBeGreaterThanOrEqual(0n);
    expect(c).toBeLessThan(CURVE_ORDER);
    expect(s).toBeGreaterThanOrEqual(0n);
    expect(s).toBeLessThan(CURVE_ORDER);
  });

  it('beta is a 32-byte Uint8Array', async () => {
    const { beta } = await generateProof(k, roundId);
    expect(beta).toBeInstanceOf(Uint8Array);
    expect(beta.length).toBe(32);
  });

  // Determinism: same k + same roundId → same gamma and same beta.
  // r is random each call so c and s differ, but the output is always the same.
  it('gamma is deterministic: same k + roundId always gives same gamma', async () => {
    const p1 = await generateProof(k, roundId);
    const p2 = await generateProof(k, roundId);
    expect(p1.gamma).toEqual(p2.gamma);
  });

  it('beta is deterministic: same k + roundId always gives same beta', async () => {
    const p1 = await generateProof(k, roundId);
    const p2 = await generateProof(k, roundId);
    expect(p1.beta).toEqual(p2.beta);
  });

  it('different roundId → different gamma and beta', async () => {
    const other = new TextEncoder().encode('round-2');
    const p1 = await generateProof(k, roundId);
    const p2 = await generateProof(k, other);
    expect(p1.gamma).not.toEqual(p2.gamma);
    expect(p1.beta).not.toEqual(p2.beta);
  });

  it('different k → different gamma and beta', async () => {
    const p1 = await generateProof(k, roundId);
    const p2 = await generateProof(k + 1n, roundId);
    expect(p1.gamma).not.toEqual(p2.gamma);
    expect(p1.beta).not.toEqual(p2.beta);
  });

});

describe('VRF - verifyProof', () => {

  it('valid proof verifies correctly', async () => {
    const { gamma, c, s } = await generateProof(k, roundId);
    expect(await verifyProof(point_Y, roundId, gamma, c, s)).toBe(true);
  });

  it('wrong gamma → verification fails', async () => {
    const { gamma, c, s } = await generateProof(k, roundId);
    const fakeGamma = scalarMul(2n, G1_GENERATOR);
    expect(await verifyProof(point_Y, roundId, fakeGamma, c, s)).toBe(false);
  });

  it('wrong c → verification fails', async () => {
    const { gamma, c, s } = await generateProof(k, roundId);
    const badC = (c + 1n) % CURVE_ORDER;
    expect(await verifyProof(point_Y, roundId, gamma, badC, s)).toBe(false);
  });

  it('wrong s → verification fails', async () => {
    const { gamma, c, s } = await generateProof(k, roundId);
    const badS = (s + 1n) % CURVE_ORDER;
    expect(await verifyProof(point_Y, roundId, gamma, c, badS)).toBe(false);
  });

  it('wrong public key → verification fails', async () => {
    const { gamma, c, s } = await generateProof(k, roundId);
    const wrongY = scalarMul(k + 1n, G1_GENERATOR);
    expect(await verifyProof(wrongY, roundId, gamma, c, s)).toBe(false);
  });

  it('wrong roundId → verification fails', async () => {
    const { gamma, c, s } = await generateProof(k, roundId);
    const wrongRound = new TextEncoder().encode('round-2');
    expect(await verifyProof(point_Y, wrongRound, gamma, c, s)).toBe(false);
  });

});
