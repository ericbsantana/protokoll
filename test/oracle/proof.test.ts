import { describe, it, expect } from 'vitest';
import { generateOracleProof, encodePoint, encodePointHex } from '../../src/oracle/proof.js';
import { scalarMul, G1_GENERATOR, CURVE_ORDER } from '../../src/math/curve.js';

const k = 42n;
const roundId = (() => { const b = new Uint8Array(32); b.set(new TextEncoder().encode('round-1')); return b; })();

describe('oracle proof - structure', () => {

  it('returns all required fields', async () => {
    const p = await generateOracleProof(k, roundId);
    expect(p).toHaveProperty('publicKey');
    expect(p).toHaveProperty('gamma');
    expect(p).toHaveProperty('c');
    expect(p).toHaveProperty('s');
    expect(p).toHaveProperty('beta');
  });

  it('publicKey equals k·G', async () => {
    const { publicKey } = await generateOracleProof(k, roundId);
    const expected = scalarMul(k, G1_GENERATOR);
    expect(publicKey).toEqual(expected);
  });

  it('c and s are scalars in [0, curve order)', async () => {
    const { c, s } = await generateOracleProof(k, roundId);
    expect(c).toBeGreaterThanOrEqual(0n);
    expect(c).toBeLessThan(CURVE_ORDER);
    expect(s).toBeGreaterThanOrEqual(0n);
    expect(s).toBeLessThan(CURVE_ORDER);
  });

  it('beta is a 32-byte Uint8Array', async () => {
    const { beta } = await generateOracleProof(k, roundId);
    expect(beta).toBeInstanceOf(Uint8Array);
    expect(beta.length).toBe(32);
  });

});

describe('oracle proof - EIP-2537 encoding', () => {

  it('encodePoint produces 128 bytes', async () => {
    const { publicKey } = await generateOracleProof(k, roundId);
    expect(encodePoint(publicKey).length).toBe(128);
  });

  it('first 16 bytes of x-slot are zero (padding)', async () => {
    const { publicKey } = await generateOracleProof(k, roundId);
    const encoded = encodePoint(publicKey);
    for (let i = 0; i < 16; i++) expect(encoded[i]).toBe(0);
  });

  it('first 16 bytes of y-slot are zero (padding)', async () => {
    const { publicKey } = await generateOracleProof(k, roundId);
    const encoded = encodePoint(publicKey);
    for (let i = 64; i < 80; i++) expect(encoded[i]).toBe(0);
  });

  it('encodePointHex returns 0x + 256 hex chars (128 bytes)', async () => {
    const { publicKey } = await generateOracleProof(k, roundId);
    const hex = encodePointHex(publicKey);
    expect(hex.startsWith('0x')).toBe(true);
    expect(hex.length).toBe(258); // 2 + 256
  });

});

describe('oracle proof - determinism', () => {

  it('gamma is deterministic: same k + roundId → same gamma', async () => {
    const p1 = await generateOracleProof(k, roundId);
    const p2 = await generateOracleProof(k, roundId);
    expect(p1.gamma).toEqual(p2.gamma);
  });

  it('beta is deterministic: same k + roundId → same beta', async () => {
    const p1 = await generateOracleProof(k, roundId);
    const p2 = await generateOracleProof(k, roundId);
    expect(p1.beta).toEqual(p2.beta);
  });

  it('different roundId → different gamma and beta', async () => {
    const other = (() => { const b = new Uint8Array(32); b.set(new TextEncoder().encode('round-2')); return b; })();
    const p1 = await generateOracleProof(k, roundId);
    const p2 = await generateOracleProof(k, other);
    expect(p1.gamma).not.toEqual(p2.gamma);
    expect(p1.beta).not.toEqual(p2.beta);
  });

  it('different k → different gamma and beta', async () => {
    const p1 = await generateOracleProof(k, roundId);
    const p2 = await generateOracleProof(k + 1n, roundId);
    expect(p1.gamma).not.toEqual(p2.gamma);
    expect(p1.beta).not.toEqual(p2.beta);
  });

});
