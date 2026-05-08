import { describe, expect, test } from 'vitest'
import { bls12_381 } from '@noble/curves/bls12-381.js'
import {
  betaToBigint,
  bigintToHex,
  bytesToHex,
  DEMO_DST,
  encodeRoundId,
  K_DEMO,
  recomputeAndVerify,
  roundIdBytes,
  truncateHex,
} from './demo'
import { generateOracleProof } from '../../../../protokoll/src/oracle/proof'

describe('encodeRoundId', () => {
  test('encodes ASCII string and right-pads to 32 bytes', () => {
    expect(encodeRoundId('lottery-round-42')).toBe(
      '0x6c6f74746572792d726f756e642d343200000000000000000000000000000000',
    )
  })

  test('empty string yields 32 zero bytes', () => {
    expect(encodeRoundId('')).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    )
  })

  test('exactly 32 ASCII bytes is preserved (no padding, no truncation)', () => {
    const exact = 'a'.repeat(32)
    const expected = '0x' + '61'.repeat(32)
    expect(encodeRoundId(exact)).toBe(expected)
  })

  test('multi-byte UTF-8 chars are encoded by byte count', () => {
    // 'café' = 63 61 66 c3 a9 (5 bytes)
    expect(encodeRoundId('café')).toBe(
      '0x636166c3a9000000000000000000000000000000000000000000000000000000',
    )
  })

  test('throws when encoded length exceeds 32 bytes', () => {
    expect(() => encodeRoundId('a'.repeat(33))).toThrow(/32 bytes/)
  })

  test('throws when multi-byte input exceeds 32 bytes after encoding', () => {
    // 17 copies of 'é' (2 bytes each) = 34 bytes
    expect(() => encodeRoundId('é'.repeat(17))).toThrow(/32 bytes/)
  })
})

describe('roundIdBytes', () => {
  test('returns 32-byte Uint8Array right-padded with zeros', () => {
    const bytes = roundIdBytes('lottery-round-42')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBe(32)
    expect(bytes.slice(0, 16)).toEqual(
      new TextEncoder().encode('lottery-round-42'),
    )
    expect(bytes.slice(16)).toEqual(new Uint8Array(16))
  })

  test('throws when input exceeds 32 bytes', () => {
    expect(() => roundIdBytes('a'.repeat(33))).toThrow(/32 bytes/)
  })

  test('roundIdBytes and encodeRoundId are consistent', () => {
    const text = 'lottery-round-42'
    expect(bytesToHex(roundIdBytes(text))).toBe(encodeRoundId(text))
  })
})

describe('bytesToHex', () => {
  test('encodes empty Uint8Array as 0x', () => {
    expect(bytesToHex(new Uint8Array(0))).toBe('0x')
  })

  test('zero-pads single bytes correctly', () => {
    expect(bytesToHex(new Uint8Array([0x00, 0xff, 0x12, 0xab]))).toBe(
      '0x00ff12ab',
    )
  })
})

describe('bigintToHex', () => {
  test('zero-pads small bigint to byteLen', () => {
    expect(bigintToHex(0xabn, 4)).toBe('0x000000ab')
  })

  test('encodes zero as all-zero bytes', () => {
    expect(bigintToHex(0n, 2)).toBe('0x0000')
  })

  test('encodes a value occupying the full byteLen exactly', () => {
    expect(bigintToHex(0x1234567890abcdefn, 8)).toBe('0x1234567890abcdef')
  })

  test('throws on negative input', () => {
    expect(() => bigintToHex(-1n, 4)).toThrow(/non-negative/)
  })
})

describe('truncateHex', () => {
  test('returns hex unchanged when shorter than head + tail + ellipsis', () => {
    expect(truncateHex('0xabcd', 4, 4)).toBe('0xabcd')
  })

  test('truncates with horizontal ellipsis preserving 0x prefix', () => {
    const long = '0x' + 'a'.repeat(20)
    expect(truncateHex(long, 4, 4)).toBe('0xaaaa…aaaa')
  })

  test('handles hex without 0x prefix', () => {
    expect(truncateHex('a'.repeat(14), 3, 3)).toBe('aaa…aaa')
  })
})

async function makeProofFor(roundId: string) {
  const idBytes = roundIdBytes(roundId)
  const Hp = bls12_381.G1.hashToCurve(idBytes, { DST: DEMO_DST }).toAffine()
  const H = { x: Hp.x, y: Hp.y }
  const proof = await generateOracleProof(K_DEMO, idBytes)
  return { proof, H }
}

describe('recomputeAndVerify', () => {
  test('a valid proof verifies and the recomputed challenge equals c', async () => {
    const { proof, H } = await makeProofFor('verify-positive-test')
    const result = await recomputeAndVerify(proof, H)
    expect(result.matches).toBe(true)
    expect(result.c_prime).toBe(proof.c)
  })

  test('tampering with c breaks the verification', async () => {
    const { proof, H } = await makeProofFor('verify-tamper-c')
    const tampered = { ...proof, c: (proof.c + 1n) }
    const result = await recomputeAndVerify(tampered, H)
    expect(result.matches).toBe(false)
    expect(result.c_prime).not.toBe(tampered.c)
  })

  test('tampering with gamma breaks the verification', async () => {
    const { proof, H } = await makeProofFor('verify-tamper-gamma')
    // Substitute H for gamma - any other valid point would also do.
    const tampered = { ...proof, gamma: H }
    const result = await recomputeAndVerify(tampered, H)
    expect(result.matches).toBe(false)
  })

  test('tampering with s breaks the verification', async () => {
    const { proof, H } = await makeProofFor('verify-tamper-s')
    const tampered = { ...proof, s: (proof.s + 1n) }
    const result = await recomputeAndVerify(tampered, H)
    expect(result.matches).toBe(false)
  })
})

describe('betaToBigint', () => {
  test('decodes big-endian bytes', () => {
    expect(betaToBigint(new Uint8Array([0x00, 0x00, 0x00, 0x01]))).toBe(1n)
    expect(betaToBigint(new Uint8Array([0x01, 0x00]))).toBe(0x100n)
    expect(betaToBigint(new Uint8Array([0xff, 0xff]))).toBe(0xffffn)
  })

  test('empty bytes give 0n', () => {
    expect(betaToBigint(new Uint8Array(0))).toBe(0n)
  })

  test('full 32-byte beta decodes to a 256-bit bigint', () => {
    const beta = new Uint8Array(32)
    beta[0] = 0xab // most significant byte
    beta[31] = 0xcd
    const expected = (0xabn << 248n) | 0xcdn
    expect(betaToBigint(beta)).toBe(expected)
  })

  test('mod 6 + 1 yields 1..6 inclusive', () => {
    // Sample a handful of byte patterns; result must always land in [1, 6].
    for (const seed of [0x00, 0x01, 0x42, 0xff, 0xa5]) {
      const beta = new Uint8Array(32).fill(seed)
      const dice = Number(betaToBigint(beta) % 6n) + 1
      expect(dice).toBeGreaterThanOrEqual(1)
      expect(dice).toBeLessThanOrEqual(6)
    }
  })
})


