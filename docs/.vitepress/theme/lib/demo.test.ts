import { describe, expect, test } from 'vitest'
import {
  bigintToHex,
  bytesToHex,
  encodeRoundId,
  roundIdBytes,
  truncateHex,
} from './demo'

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
