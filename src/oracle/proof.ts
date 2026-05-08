// Production oracle proof - uses EIP-2537 128-byte point encoding throughout
// so proofs can be verified directly by MonadVRFVerifier.sol via precompiles.
//
// Difference from src/math/vrf.ts:
//   vrf.ts encodes points as 96 bytes (48+48) - pedagogical, self-contained
//   this file encodes as 128 bytes (16 pad + 48 + 16 pad + 48) - EIP-2537 format
// Because c = sha256(G||Y||H||γ||U||V), different encoding → different c value.
// These two modules are NOT interchangeable - use one consistently.

import { bls12_381 } from '@noble/curves/bls12-381.js';
import {
  scalarMul, add,
  G1_GENERATOR, CURVE_ORDER,
  type AffinePoint,
} from '../math/curve.js';

// Must match the DST constant in MonadVRFVerifier.sol
const DST = 'protokoll-v1';

// ── EIP-2537 encoding ─────────────────────────────────────────────────────────
// Format: [16 zero bytes][48 byte x-coord][16 zero bytes][48 byte y-coord] = 128 bytes
// Matches what the BLS12-381 precompiles (0x0b, 0x0c, 0x10) expect and return.

export function encodePoint(p: AffinePoint): Uint8Array {
  const buf = new Uint8Array(128);
  writeUint(buf, p.x, 16, 48);
  writeUint(buf, p.y, 80, 48);
  return buf;
}

export function encodePointHex(p: AffinePoint): `0x${string}` {
  return `0x${Array.from(encodePoint(p)).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
}

function writeUint(buf: Uint8Array, value: bigint, offset: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) {
    buf[offset + i] = Number(value & 0xffn);
    value >>= 8n;
  }
}

// ── Hash utilities ────────────────────────────────────────────────────────────

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const ab = new ArrayBuffer(data.byteLength);
  new Uint8Array(ab).set(data);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', ab));
}

async function hashConcat(...items: Uint8Array[]): Promise<Uint8Array> {
  const total = items.reduce((n, b) => n + b.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const item of items) { buf.set(item, offset); offset += item.length; }
  return sha256(buf);
}

function hashToScalar(bytes: Uint8Array): bigint {
  let n = 0n;
  for (const byte of bytes) n = (n << 8n) | BigInt(byte);
  return n % CURVE_ORDER;
}

// ── Hash-to-curve (RFC 9380: expand_message_xmd + SWU + cofactor clearing) ────
// Uses @noble/curves which implements the same algorithm as the MAP_FP_TO_G1
// precompile (0x10). DST must match MonadVRFVerifier.sol exactly.

function hashToCurve(input: Uint8Array): AffinePoint {
  const p = bls12_381.G1.hashToCurve(input, { DST }).toAffine();
  return { x: p.x, y: p.y };
}

function randomScalar(): bigint {
  while (true) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let r = 0n;
    for (const byte of bytes) r = (r << 8n) | BigInt(byte);
    r = r % CURVE_ORDER;
    if (r !== 0n) return r;
  }
}

// ── Public types ──────────────────────────────────────────────────────────────

export type OracleProof = {
  publicKey: AffinePoint; // Y = k·G
  gamma: AffinePoint; // γ = k·H
  c: bigint;
  s: bigint;
  beta: Uint8Array;  // β = sha256(encode(γ)) - the random output
};

// ── generateOracleProof ───────────────────────────────────────────────────────

export async function generateOracleProof(scalar_k: bigint, roundId: Uint8Array): Promise<OracleProof> {
  const point_H = hashToCurve(roundId);
  const gamma = scalarMul(scalar_k, point_H) as AffinePoint;
  const r = randomScalar();
  const point_U = scalarMul(r, G1_GENERATOR) as AffinePoint;
  const point_V = scalarMul(r, point_H) as AffinePoint;
  const point_Y = scalarMul(scalar_k, G1_GENERATOR) as AffinePoint;

  // Fiat-Shamir: hash all 6 points in EIP-2537 encoding (matches Solidity verifier)
  const c = hashToScalar(await hashConcat(
    encodePoint(G1_GENERATOR),
    encodePoint(point_Y),
    encodePoint(point_H),
    encodePoint(gamma),
    encodePoint(point_U),
    encodePoint(point_V),
  ));

  const s = ((r - (c * scalar_k) % CURVE_ORDER) % CURVE_ORDER + CURVE_ORDER) % CURVE_ORDER;
  const beta = await sha256(encodePoint(gamma));

  return { publicKey: point_Y, gamma, c, s, beta };
}
