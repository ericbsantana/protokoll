import {
  add,
  CURVE_ORDER,
  G1_GENERATOR,
  scalarMul,
  type AffinePoint,
} from '../../../../src/math/curve'
import { encodePoint } from '../../../../src/oracle/proof'
import type { OracleProof } from '../../../../src/oracle/proof'

// Demo private key. Hardcoded so Y = k·G is stable across page reloads.
// Leading byte 0x42 keeps the value below the BLS12-381 G1 group order
// r ≈ 0x73eda753... NOT the production oracle key.
export const K_DEMO =
  0x4242424242424242424242424242424242424242424242424242424242424242n

// DST must match src/oracle/proof.ts. Hash-to-curve uses it to domain-separate
// the input bytes from any other use of BLS12-381.
export const DEMO_DST = 'protokoll-v1'

export function roundIdBytes(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text)
  if (bytes.length > 32) {
    throw new Error(`roundId must be at most 32 bytes (got ${bytes.length})`)
  }
  const padded = new Uint8Array(32)
  padded.set(bytes)
  return padded
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '0x'
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

export function bigintToHex(value: bigint, byteLen: number): string {
  if (value < 0n) throw new Error('value must be non-negative')
  const bytes = new Uint8Array(byteLen)
  let v = value
  for (let i = byteLen - 1; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return bytesToHex(bytes)
}

export function truncateHex(hex: string, head = 8, tail = 6): string {
  const hasPrefix = hex.startsWith('0x')
  const prefix = hasPrefix ? '0x' : ''
  const body = hasPrefix ? hex.slice(2) : hex
  if (body.length <= head + tail + 1) return hex
  return `${prefix}${body.slice(0, head)}…${body.slice(-tail)}`
}

export function encodeRoundId(text: string): string {
  return bytesToHex(roundIdBytes(text))
}

export type VerifyResult = {
  U_prime: AffinePoint
  V_prime: AffinePoint
  c_prime: bigint
  matches: boolean
}

// Recomputes U', V', and c' from a DLEQ proof and returns whether c' == c.
// This mirrors what MonadVRFVerifier.sol does on-chain via BLS12-381
// precompiles, so the demo can show every intermediate value.
export async function recomputeAndVerify(
  proof: OracleProof,
  H: AffinePoint,
): Promise<VerifyResult> {
  // U' = s·G + c·Y
  const sG = scalarMul(proof.s, G1_GENERATOR) as AffinePoint
  const cY = scalarMul(proof.c, proof.publicKey) as AffinePoint
  const U_prime = add(sG, cY) as AffinePoint
  // V' = s·H + c·γ
  const sH = scalarMul(proof.s, H) as AffinePoint
  const cGamma = scalarMul(proof.c, proof.gamma) as AffinePoint
  const V_prime = add(sH, cGamma) as AffinePoint
  // c' = sha256(G || Y || H || γ || U' || V') mod n
  const buf = concatBytes(
    encodePoint(G1_GENERATOR),
    encodePoint(proof.publicKey),
    encodePoint(H),
    encodePoint(proof.gamma),
    encodePoint(U_prime),
    encodePoint(V_prime),
  )
  const ab = new ArrayBuffer(buf.byteLength)
  new Uint8Array(ab).set(buf)
  const hashBuf = await crypto.subtle.digest('SHA-256', ab)
  const c_prime = bytesToBigint(new Uint8Array(hashBuf)) % CURVE_ORDER
  return {
    U_prime,
    V_prime,
    c_prime,
    matches: c_prime === proof.c,
  }
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0)
  const buf = new Uint8Array(total)
  let off = 0
  for (const a of arrs) {
    buf.set(a, off)
    off += a.length
  }
  return buf
}

function bytesToBigint(bytes: Uint8Array): bigint {
  let n = 0n
  for (const b of bytes) n = (n << 8n) | BigInt(b)
  return n
}
