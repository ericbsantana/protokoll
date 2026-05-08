// Encodes a free-form roundId string into a Solidity bytes32 hex literal.
// Right-pads with zeros so short inputs still produce a full 32-byte value.
// Throws if the UTF-8 encoding of the input exceeds 32 bytes (bytes32 capacity).
export function encodeRoundId(text: string): string {
  const bytes = new TextEncoder().encode(text)
  if (bytes.length > 32) {
    throw new Error(`roundId must be at most 32 bytes (got ${bytes.length})`)
  }
  const padded = new Uint8Array(32)
  padded.set(bytes)
  let hex = '0x'
  for (const b of padded) hex += b.toString(16).padStart(2, '0')
  return hex
}
