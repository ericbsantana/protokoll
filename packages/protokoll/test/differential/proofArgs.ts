import type { Hex } from 'viem';
import { encodePoint, encodePointHex, type OracleProof } from '../../src/oracle/proof.js';

export function bytesToHex(bytes: Uint8Array): Hex {
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as Hex;
}

export type VerifyArgs = { publicKey: Hex; roundId: Hex; gamma: Hex; c: bigint; s: bigint };

export function proofToArgs(proof: OracleProof, roundId: Uint8Array): VerifyArgs {
  return {
    publicKey: encodePointHex(proof.publicKey),
    roundId: bytesToHex(roundId) as Hex,
    gamma: encodePointHex(proof.gamma),
    c: proof.c,
    s: proof.s,
  };
}

export function flipBitInHex(hex: Hex, bitIndex: number): Hex {
  const raw = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(raw.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  const byteIdx = Math.floor(bitIndex / 8);
  const bit = bitIndex % 8;
  if (byteIdx >= bytes.length) throw new Error(`bit index ${bitIndex} out of range for ${bytes.length}-byte buffer`);
  bytes[byteIdx] ^= (1 << (7 - bit));
  return bytesToHex(bytes);
}

export function makeRoundId(label: string): Uint8Array {
  const b = new Uint8Array(32);
  const enc = new TextEncoder().encode(label);
  b.set(enc.slice(0, 32));
  return b;
}

export { encodePoint, encodePointHex };
