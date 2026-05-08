import { describe, expect, test } from 'vitest'
import { encodeRoundId } from './demo'

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
