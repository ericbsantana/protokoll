import { describe, it, expect } from 'vitest';
import { add, double, negate, scalarMul, isOnCurve, G1_GENERATOR, CURVE_ORDER, INFINITY } from '../../src/math/curve.js';

describe('BLS12-381 G1 curve operations', () => {

  // ── Basic sanity ─────────────────────────────────────────────────────────

  it('generator point is on the curve', () => {
    expect(isOnCurve(G1_GENERATOR)).toBe(true);
  });

  it('point at infinity is the identity', () => {
    expect(INFINITY).toBe('infinity');
  });

  // ── Identity (O is the additive identity) ────────────────────────────────

  it('P + O = P (right identity)', () => {
    const result = add(G1_GENERATOR, INFINITY);
    expect(result).toEqual(G1_GENERATOR);
  });

  it('O + P = P (left identity)', () => {
    const result = add(INFINITY, G1_GENERATOR);
    expect(result).toEqual(G1_GENERATOR);
  });

  it('O + O = O', () => {
    expect(add(INFINITY, INFINITY)).toBe(INFINITY);
  });

  // ── Negation ─────────────────────────────────────────────────────────────

  it('negate(G) has the same x, negated y', () => {
    const neg = negate(G1_GENERATOR);
    if (neg === 'infinity') throw new Error('unexpected infinity');
    expect(neg.x).toBe(G1_GENERATOR.x);
    expect(neg.y).not.toBe(G1_GENERATOR.y);
  });

  it('negate(O) = O', () => {
    expect(negate(INFINITY)).toBe(INFINITY);
  });

  it('P + (-P) = O', () => {
    const neg = negate(G1_GENERATOR);
    expect(add(G1_GENERATOR, neg)).toBe(INFINITY);
  });

  // ── Commutativity ────────────────────────────────────────────────────────

  it('P + Q = Q + P (commutativity)', () => {
    const twoG = scalarMul(2n, G1_GENERATOR);
    const threeG = scalarMul(3n, G1_GENERATOR);
    expect(add(twoG, threeG)).toEqual(add(threeG, twoG));
  });

  // ── Doubling consistent with addition ────────────────────────────────────

  it('double(P) = P + P', () => {
    expect(double(G1_GENERATOR)).toEqual(add(G1_GENERATOR, G1_GENERATOR));
  });

  it('double(O) = O', () => {
    expect(double(INFINITY)).toBe(INFINITY);
  });

  // ── Scalar multiplication ─────────────────────────────────────────────────

  it('0·G = O', () => {
    expect(scalarMul(0n, G1_GENERATOR)).toBe(INFINITY);
  });

  it('1·G = G', () => {
    expect(scalarMul(1n, G1_GENERATOR)).toEqual(G1_GENERATOR);
  });

  it('2·G = G + G', () => {
    expect(scalarMul(2n, G1_GENERATOR)).toEqual(add(G1_GENERATOR, G1_GENERATOR));
  });

  it('3·G = 2·G + G', () => {
    expect(scalarMul(3n, G1_GENERATOR)).toEqual(add(scalarMul(2n, G1_GENERATOR), G1_GENERATOR));
  });

  // ── Homomorphism - the key property for cryptography ─────────────────────
  // (a + b)·G = a·G + b·G
  // This is what makes public keys work: k·G is a group homomorphism.

  it('(a+b)·G = a·G + b·G', () => {
    const a = 17n;
    const b = 31n;
    const lhs = scalarMul(a + b, G1_GENERATOR);
    const rhs = add(scalarMul(a, G1_GENERATOR), scalarMul(b, G1_GENERATOR));
    expect(lhs).toEqual(rhs);
  });

  it('(a·b)·G = a·(b·G)', () => {
    const a = 5n;
    const b = 7n;
    const lhs = scalarMul(a * b, G1_GENERATOR);
    const rhs = scalarMul(a, scalarMul(b, G1_GENERATOR));
    expect(lhs).toEqual(rhs);
  });

  // ── Group order ───────────────────────────────────────────────────────────

  it('n·G = O (the group order annihilates the generator)', () => {
    expect(scalarMul(CURVE_ORDER, G1_GENERATOR)).toBe(INFINITY);
  });

  // ── Result is always on the curve ─────────────────────────────────────────

  it('2·G is on the curve', () => {
    const p = scalarMul(2n, G1_GENERATOR);
    expect(isOnCurve(p)).toBe(true);
  });

  it('100·G is on the curve', () => {
    const p = scalarMul(100n, G1_GENERATOR);
    expect(isOnCurve(p)).toBe(true);
  });
});
