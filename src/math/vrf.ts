// EC-VRF: DLEQ proof generation and verification - pure TypeScript
// See docs/theory/03-dleq-proofs.md

import { Fp, FP_MODULUS } from './field.js';
import {
  add, scalarMul, isOnCurve,
  G1_GENERATOR, CURVE_ORDER, INFINITY,
  type AffinePoint, type Point,
} from './curve.js';

// ── Hash utilities ────────────────────────────────────────────────────────────

// Encode a curve point to bytes for hashing.
// Format: 48 bytes x || 48 bytes y, each big-endian.
function pointToBytes(p: AffinePoint): Uint8Array {
  const buf = new Uint8Array(96);
  writeUint(buf, p.x, 0, 48);
  writeUint(buf, p.y, 48, 48);
  return buf;
}

function writeUint(buf: Uint8Array, value: bigint, offset: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) {
    buf[offset + i] = Number(value & 0xffn);
    value >>= 8n;
  }
}

// SHA-256 via Web Crypto - available in Node 22+ without imports.
// Copy into a plain ArrayBuffer first: crypto.subtle requires ArrayBuffer, not SharedArrayBuffer.
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const ab = new ArrayBuffer(data.byteLength);
  new Uint8Array(ab).set(data);
  const digest = await crypto.subtle.digest('SHA-256', ab);
  return new Uint8Array(digest);
}

// Hash several items together: sha256(item0 || item1 || ...)
async function hashConcat(...items: Uint8Array[]): Promise<Uint8Array> {
  const total = items.reduce((n, b) => n + b.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const item of items) {
    buf.set(item, offset);
    offset += item.length;
  }
  return sha256(buf);
}

// Reduce a 32-byte hash to a scalar in [0, CURVE_ORDER)
function hashToScalar(bytes: Uint8Array): bigint {
  let n = 0n;
  for (const byte of bytes) {
    n = (n << 8n) | BigInt(byte);
  }
  return n % CURVE_ORDER;
}

// G1 cofactor h - multiplying any curve point by h maps it into the G1 prime-order subgroup.
// Source: https://github.com/zcash/librustzcash/blob/master/pairing/src/bls12_381/README.md
// Full curve order = CURVE_ORDER * COFACTOR_H. Only points in G1 have order dividing CURVE_ORDER.
const COFACTOR_H = BigInt('0x396c8c005555e1568c00aaab0000aaab');

// ── Hash-to-curve (pedagogical try-and-increment) ─────────────────────────────
// NOT suitable for production - no uniform distribution, timing leak.
// Production: use @noble/curves hash_to_field + SWU (see src/oracle/proof.ts).
// See docs/theory/04-hash-to-curve.md for why try-and-increment is limited.
//
// Cofactor clearing is required: scalarMul reduces scalars mod CURVE_ORDER (= n).
// This is only valid for points whose order divides n - i.e., points in G1.
// A raw try-and-increment point has order n*h, so we multiply by h to clear it.
async function hashToCurve(input: Uint8Array): Promise<AffinePoint> {
  for (let counter = 0; counter < 256; counter++) {
    const attempt = new Uint8Array(input.length + 1);
    attempt.set(input);
    attempt[input.length] = counter;

    const digest = await sha256(attempt);
    let x = 0n;
    for (const byte of digest) x = (x << 8n) | BigInt(byte);
    x = x % FP_MODULUS;

    // Check if x³ + 4 has a square root mod p
    const rhs = Fp.add(Fp.mul(Fp.mul(x, x), x), 4n); // x³ + 4
    // Square root exists iff rhs^((p-1)/2) ≡ 1 (mod p) - Euler's criterion
    const legendre = Fp.pow(rhs, (FP_MODULUS - 1n) / 2n);
    if (legendre !== 1n) continue;

    // Tonelli-Shanks would be general; for BLS12-381 p ≡ 3 (mod 4) so:
    // sqrt(rhs) = rhs^((p+1)/4) mod p
    const y = Fp.pow(rhs, (FP_MODULUS + 1n) / 4n);

    const raw: AffinePoint = { x, y };
    if (!isOnCurve(raw)) continue;

    // Cofactor clearing: h·P maps any curve point into the prime-order subgroup G1.
    // Required because scalarMul reduces scalars mod n, which is only correct for G1 points.
    const cleared = scalarMul(COFACTOR_H, raw);
    if (cleared === INFINITY) continue; // should not happen for valid non-identity points
    return cleared as AffinePoint;
  }
  throw new Error('hashToCurve: no point found after 256 attempts (should never happen)');
}

// ── Secure random scalar in [1, CURVE_ORDER) ──────────────────────────────────
function randomScalar(): bigint {
  // 32 bytes of CSPRNG entropy → reduce mod n
  // Loop until nonzero (probability of hitting 0 is negligible: 1/2^255)
  while (true) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let r = 0n;
    for (const byte of bytes) r = (r << 8n) | BigInt(byte);
    r = r % CURVE_ORDER;
    if (r !== 0n) return r;
  }
}

// ── Public types ──────────────────────────────────────────────────────────────

export type VRFProof = {
  gamma: AffinePoint; // Γ = k·H
  c: bigint;          // Fiat-Shamir challenge
  s: bigint;          // response s = r - c·k mod n
  beta: Uint8Array;   // β = sha256(Γ) - the random output
};

// ── generateProof ─────────────────────────────────────────────────────────────
// See docs/theory/03-dleq-proofs.md - Proof Generation
export async function generateProof(scalar_k: bigint, roundId: Uint8Array): Promise<VRFProof> {
  // 1. H = hash_to_curve(roundId)
  const point_H = await hashToCurve(roundId);

  // 2. Γ = k·H  (VRF output point)
  const gamma = scalarMul(scalar_k, point_H) as AffinePoint;

  // 3. r = fresh random nonce - MUST never be reused (see docs/theory/03-dleq-proofs.md)
  const r = randomScalar();

  // 4. U = r·G,  V = r·H  (commitments)
  const point_U = scalarMul(r, G1_GENERATOR) as AffinePoint;
  const point_V = scalarMul(r, point_H) as AffinePoint;

  // 5. c = sha256(G || Y || H || Γ || U || V)  - Fiat-Shamir challenge
  // Y = k·G is derived here for the hash; caller holds the public key separately.
  const point_Y = scalarMul(scalar_k, G1_GENERATOR) as AffinePoint;
  const cBytes = await hashConcat(
    pointToBytes(G1_GENERATOR),
    pointToBytes(point_Y),
    pointToBytes(point_H),
    pointToBytes(gamma),
    pointToBytes(point_U),
    pointToBytes(point_V),
  );
  const c = hashToScalar(cBytes);

  // 6. s = (r - c·k) mod n
  const ck = (c * scalar_k) % CURVE_ORDER;
  const s = ((r - ck) % CURVE_ORDER + CURVE_ORDER) % CURVE_ORDER;

  // 7. β = sha256(Γ)
  const beta = await sha256(pointToBytes(gamma));

  return { gamma, c, s, beta };
}

// ── verifyProof ───────────────────────────────────────────────────────────────
// See docs/theory/03-dleq-proofs.md - Proof Verification
export async function verifyProof(
  point_Y: Point,
  roundId: Uint8Array,
  gamma: Point,
  c: bigint,
  s: bigint,
): Promise<boolean> {
  if (point_Y === 'infinity' || gamma === 'infinity') return false;

  // 1. H = hash_to_curve(roundId)
  const point_H = await hashToCurve(roundId);

  // 2. U' = s·G + c·Y  (should equal the original r·G)
  const sG = scalarMul(s, G1_GENERATOR);
  const cY = scalarMul(c, point_Y);
  const point_U_prime = add(sG, cY);

  // 3. V' = s·H + c·Γ  (should equal the original r·H)
  const sH = scalarMul(s, point_H);
  const cGamma = scalarMul(c, gamma);
  const point_V_prime = add(sH, cGamma);

  if (point_U_prime === 'infinity' || point_V_prime === 'infinity') return false;

  // 4. c' = sha256(G || Y || H || Γ || U' || V')
  const cBytes = await hashConcat(
    pointToBytes(G1_GENERATOR),
    pointToBytes(point_Y),
    pointToBytes(point_H),
    pointToBytes(gamma),
    pointToBytes(point_U_prime),
    pointToBytes(point_V_prime),
  );
  const c_prime = hashToScalar(cBytes);

  // 5. Accept iff c' == c
  return c_prime === c;
}
