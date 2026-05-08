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
