// BLS12-381 G1 elliptic curve: y² = x³ + 4 over Fp
// See docs/theory/02-elliptic-curves.md

import { Fp, FP_MODULUS } from './field.js';

// Curve order n - the number of points in the G1 prime-order subgroup.
// Used for scalar arithmetic (private keys, nonces).
// Source: https://github.com/zcash/librustzcash/blob/master/pairing/src/bls12_381/README.md
export const CURVE_ORDER = BigInt(
  '0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001'
);

export type AffinePoint = { x: bigint; y: bigint };
export type Point = AffinePoint | 'infinity';

// The point at infinity - the additive identity of the group.
export const INFINITY = 'infinity' as const;

// BLS12-381 G1 generator point.
// Source: https://github.com/zcash/librustzcash/blob/master/pairing/src/bls12_381/README.md
export const G1_GENERATOR: AffinePoint = {
  x: BigInt('0x17f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb'),
  y: BigInt('0x08b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1'),
};

// Verify a point satisfies y² = x³ + 4 (mod p)
export function isOnCurve(p: Point): boolean {
  if (p === INFINITY) return true;
  const { x, y } = p;
  const lhs = Fp.mul(y, y);           // y²
  const rhs = Fp.add(Fp.mul(Fp.mul(x, x), x), 4n); // x³ + 4
  return lhs === rhs;
}

// Point negation: -(x, y) = (x, -y mod p)
export function negate(p: Point): Point {
  if (p === INFINITY) return INFINITY;
  return { x: p.x, y: Fp.neg(p.y) };
}

// Point doubling: 2P using the tangent-line formula.
// λ = 3x² / 2y  (a=0 so the 'a' term vanishes)
// See docs/theory/02-elliptic-curves.md
export function double(p: Point): Point {
  if (p === INFINITY) return INFINITY;
  if (p.y === 0n) return INFINITY; // tangent is vertical → identity

  // λ = 3x₁² · (2y₁)⁻¹ mod p
  const lambda = Fp.mul(
    Fp.mul(3n, Fp.mul(p.x, p.x)),
    Fp.inv(Fp.mul(2n, p.y))
  );
  const x3 = Fp.sub(Fp.mul(lambda, lambda), Fp.mul(2n, p.x)); // λ² - 2x₁
  const y3 = Fp.sub(Fp.mul(lambda, Fp.sub(p.x, x3)), p.y);   // λ(x₁ - x₃) - y₁
  return { x: x3, y: y3 };
}

// Point addition: P + Q using the chord-line formula.
// Covers all cases: identity, negation, doubling, general.
// See docs/theory/02-elliptic-curves.md
export function add(p: Point, q: Point): Point {
  if (p === INFINITY) return q;
  if (q === INFINITY) return p;

  if (p.x === q.x) {
    // Same x: either P = Q (double) or P = -Q (cancel to infinity)
    if (p.y === q.y) return double(p);
    return INFINITY; // P + (-P) = O
  }

  // λ = (y₂ - y₁) · (x₂ - x₁)⁻¹ mod p
  const lambda = Fp.mul(
    Fp.sub(q.y, p.y),
    Fp.inv(Fp.sub(q.x, p.x))
  );
  const x3 = Fp.sub(Fp.sub(Fp.mul(lambda, lambda), p.x), q.x); // λ² - x₁ - x₂
  const y3 = Fp.sub(Fp.mul(lambda, Fp.sub(p.x, x3)), p.y);     // λ(x₁ - x₃) - y₁
  return { x: x3, y: y3 };
}

// Scalar multiplication: k·P via double-and-add.
// O(log k) doublings + at most O(log k) additions.
// See docs/theory/02-elliptic-curves.md
export function scalarMul(k: bigint, p: Point): Point {
  k = ((k % CURVE_ORDER) + CURVE_ORDER) % CURVE_ORDER; // reduce into [0, n)
  if (k === 0n) return INFINITY;

  let result: Point = INFINITY;
  let addend: Point = p;
  while (k > 0n) {
    if (k & 1n) result = add(result, addend); // add current bit
    addend = double(addend);                   // double for next bit
    k >>= 1n;
  }
  return result;
}
