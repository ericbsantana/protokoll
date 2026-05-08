import { describe, it, expect } from 'vitest';
import { Fp } from '../../src/math/field.js';

// BLS12-381 Fp modulus - same constant as in field.ts
const p = BigInt('0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab');

describe('Fp - BLS12-381 prime field arithmetic', () => {

  // ── Commutativity ────────────────────────────────────────────────────────

  it('addition is commutative: a + b = b + a', () => {
    const a = 7n;
    const b = 13n;
    expect(Fp.add(a, b)).toBe(Fp.add(b, a));
  });

  it('multiplication is commutative: a * b = b * a', () => {
    const a = 999999999999999n;
    const b = 123456789n;
    expect(Fp.mul(a, b)).toBe(Fp.mul(b, a));
  });

  // ── Associativity ────────────────────────────────────────────────────────

  it('addition is associative: (a + b) + c = a + (b + c)', () => {
    const a = 11n;
    const b = 22n;
    const c = 33n;
    expect(Fp.add(Fp.add(a, b), c)).toBe(Fp.add(a, Fp.add(b, c)));
  });

  it('multiplication is associative: (a * b) * c = a * (b * c)', () => {
    const a = 2n ** 40n;
    const b = 2n ** 50n;
    const c = 2n ** 30n;
    expect(Fp.mul(Fp.mul(a, b), c)).toBe(Fp.mul(a, Fp.mul(b, c)));
  });

  // ── Distributivity ───────────────────────────────────────────────────────

  it('multiplication distributes over addition: a * (b + c) = a*b + a*c', () => {
    const a = 17n;
    const b = 31n;
    const c = 41n;
    expect(Fp.mul(a, Fp.add(b, c))).toBe(Fp.add(Fp.mul(a, b), Fp.mul(a, c)));
  });

  // ── Additive identity ────────────────────────────────────────────────────

  it('additive identity: a + 0 = a', () => {
    const a = 12345678901234567890n;
    expect(Fp.add(a, 0n)).toBe(Fp.mod(a));
  });

  // ── Multiplicative identity ──────────────────────────────────────────────

  it('multiplicative identity: a * 1 = a', () => {
    const a = 99999999999999999n;
    expect(Fp.mul(a, 1n)).toBe(Fp.mod(a));
  });

  // ── Additive inverse ─────────────────────────────────────────────────────

  it('additive inverse: a + (-a) = 0', () => {
    const a = 42n;
    expect(Fp.add(a, Fp.neg(a))).toBe(0n);
  });

  it('neg of 0 is 0', () => {
    expect(Fp.neg(0n)).toBe(0n);
  });

  // ── Multiplicative inverse ───────────────────────────────────────────────

  it('multiplicative inverse: a * a^{-1} = 1', () => {
    const a = 7n;
    expect(Fp.mul(a, Fp.inv(a))).toBe(1n);
  });

  it('inverse of 1 is 1', () => {
    expect(Fp.inv(1n)).toBe(1n);
  });

  it('inv throws for 0 (0 has no multiplicative inverse)', () => {
    expect(() => Fp.inv(0n)).toThrow();
  });

  // ── Subtraction ──────────────────────────────────────────────────────────

  it('subtraction: a - a = 0', () => {
    const a = 100n;
    expect(Fp.sub(a, a)).toBe(0n);
  });

  it('subtraction never underflows below 0 (result is always in [0, p))', () => {
    const a = 5n;
    const b = p - 2n;
    const result = Fp.sub(a, b);
    expect(result).toBeGreaterThanOrEqual(0n);
    expect(result).toBeLessThan(p);
  });

  // ── Modular reduction ────────────────────────────────────────────────────

  it('all results are in the range [0, p)', () => {
    const a = p - 1n;
    const b = p - 2n;
    expect(Fp.add(a, b)).toBeLessThan(p);
    expect(Fp.mul(a, b)).toBeLessThan(p);
  });

  it('p itself reduces to 0', () => {
    expect(Fp.mod(p)).toBe(0n);
  });

  it('values larger than p are reduced correctly', () => {
    expect(Fp.mod(p + 1n)).toBe(1n);
    expect(Fp.mod(2n * p + 7n)).toBe(7n);
  });

  // ── pow ──────────────────────────────────────────────────────────────────

  it('pow: a^0 = 1', () => {
    expect(Fp.pow(12345n, 0n)).toBe(1n);
  });

  it('pow: a^1 = a mod p', () => {
    const a = 999n;
    expect(Fp.pow(a, 1n)).toBe(Fp.mod(a));
  });

  it('pow: a^2 = a * a', () => {
    const a = 7n;
    expect(Fp.pow(a, 2n)).toBe(Fp.mul(a, a));
  });

  it('pow: Fermat - a^(p-1) = 1 for nonzero a', () => {
    // Fermat's little theorem: a^(p-1) ≡ 1 (mod p) for a ≢ 0
    const a = 42n;
    expect(Fp.pow(a, p - 1n)).toBe(1n);
  });

  // ── Known vector spot-checks ─────────────────────────────────────────────

  // In GF(7): inv(3) = 5 because 3 * 5 = 15 = 2*7 + 1 ≡ 1 (mod 7)
  // We verify the same property holds in our Fp via Fermat-based inv.
  // Use small numbers that are easy to hand-verify.
  it('spot check: 2 * inv(2) = 1 in Fp', () => {
    expect(Fp.mul(2n, Fp.inv(2n))).toBe(1n);
  });

  it('spot check: inv(2) = (p+1)/2 when p is odd prime', () => {
    // For an odd prime p, 2^{-1} = (p+1)/2 because 2 * (p+1)/2 = p+1 ≡ 1 (mod p)
    expect(Fp.inv(2n)).toBe((p + 1n) / 2n);
  });
});
