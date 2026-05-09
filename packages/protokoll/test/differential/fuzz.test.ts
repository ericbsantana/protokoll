import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { generateOracleProof, encodePointHex } from '../../src/oracle/proof.js';
import { scalarMul, G1_GENERATOR, CURVE_ORDER } from '../../src/math/curve.js';
import { startHarness, stopHarness, verify, type Harness } from './harness.js';
import { proofToArgs, flipBitInHex, makeRoundId, bytesToHex } from './proofArgs.js';

const MUTATIONS_PER_CATEGORY = Number.parseInt(process.env.HARNESS_MUTATIONS ?? '50', 10);

describe('differential harness - mutation matrix', () => {
  let h: Harness;
  let baselineArgs: ReturnType<typeof proofToArgs>;

  beforeAll(async () => {
    h = await startHarness();
    const k = 0xdeadbeefn;
    const roundId = makeRoundId('fuzz-baseline');
    const proof = await generateOracleProof(k, roundId);
    baselineArgs = proofToArgs(proof, roundId);
    const ok = await verify(h, baselineArgs);
    if (!ok) throw new Error('baseline proof failed to verify - cannot fuzz');
  }, 120_000);

  afterAll(async () => { if (h) await stopHarness(h); });

  it(`gamma bit flip x ${MUTATIONS_PER_CATEGORY}`, async () => {
    const indices = pickBitIndices(128 * 8, MUTATIONS_PER_CATEGORY);
    for (const bit of indices) {
      const tampered = flipBitInHex(baselineArgs.gamma, bit);
      const out = await verify(h, { ...baselineArgs, gamma: tampered });
      if (out) throw new Error(`gamma bit flip at index ${bit} verified - leak`);
      expect(out).toBe(false);
    }
  }, 120_000);

  it(`c bit flip x ${MUTATIONS_PER_CATEGORY}`, async () => {
    const cBytes = scalarToBytes(baselineArgs.c);
    const indices = pickBitIndices(cBytes.length * 8, MUTATIONS_PER_CATEGORY);
    for (const bit of indices) {
      const mutated = flipBit(cBytes, bit);
      const c = bytesToBigint(mutated) % CURVE_ORDER;
      if (c === baselineArgs.c) continue;
      const out = await verify(h, { ...baselineArgs, c });
      if (out) throw new Error(`c bit flip at index ${bit} verified - leak`);
      expect(out).toBe(false);
    }
  }, 120_000);

  it(`s bit flip x ${MUTATIONS_PER_CATEGORY}`, async () => {
    const sBytes = scalarToBytes(baselineArgs.s);
    const indices = pickBitIndices(sBytes.length * 8, MUTATIONS_PER_CATEGORY);
    for (const bit of indices) {
      const mutated = flipBit(sBytes, bit);
      const s = bytesToBigint(mutated) % CURVE_ORDER;
      if (s === baselineArgs.s) continue;
      const out = await verify(h, { ...baselineArgs, s });
      if (out) throw new Error(`s bit flip at index ${bit} verified - leak`);
      expect(out).toBe(false);
    }
  }, 120_000);

  it(`mutated roundId x ${MUTATIONS_PER_CATEGORY}`, async () => {
    for (let i = 0; i < MUTATIONS_PER_CATEGORY; i++) {
      const altered = randomBytes32();
      if (altered === baselineArgs.roundId) continue;
      const out = await verify(h, { ...baselineArgs, roundId: altered });
      if (out) throw new Error(`mutated roundId ${altered} verified - leak`);
      expect(out).toBe(false);
    }
  }, 120_000);

  it(`mutated publicKey x ${MUTATIONS_PER_CATEGORY}`, async () => {
    for (let i = 0; i < MUTATIONS_PER_CATEGORY; i++) {
      const r = randomScalar();
      const fakePoint = scalarMul(r, G1_GENERATOR);
      if (fakePoint === 'infinity') continue;
      const fakeKeyHex = encodePointHex(fakePoint);
      if (fakeKeyHex === baselineArgs.publicKey) continue;
      const out = await verify(h, { ...baselineArgs, publicKey: fakeKeyHex });
      if (out) throw new Error(`mutated publicKey ${fakeKeyHex} verified - leak`);
      expect(out).toBe(false);
    }
  }, 240_000);
});

function pickBitIndices(total: number, count: number): number[] {
  const out = new Set<number>();
  while (out.size < count && out.size < total) {
    out.add(Math.floor(Math.random() * total));
  }
  return [...out];
}

function scalarToBytes(n: bigint): Uint8Array {
  const buf = new Uint8Array(32);
  let v = n;
  for (let i = 31; i >= 0; i--) { buf[i] = Number(v & 0xffn); v >>= 8n; }
  return buf;
}

function bytesToBigint(b: Uint8Array): bigint {
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  return n;
}

function flipBit(b: Uint8Array, bitIndex: number): Uint8Array {
  const out = new Uint8Array(b);
  const byteIdx = Math.floor(bitIndex / 8);
  const bit = bitIndex % 8;
  out[byteIdx] ^= (1 << (7 - bit));
  return out;
}

function randomBytes32(): `0x${string}` {
  const buf = new Uint8Array(32);
  for (let i = 0; i < 32; i++) buf[i] = Math.floor(Math.random() * 256);
  return bytesToHex(buf);
}

function randomScalar(): bigint {
  const buf = new Uint8Array(32);
  for (let i = 0; i < 32; i++) buf[i] = Math.floor(Math.random() * 256);
  let n = 0n;
  for (const x of buf) n = (n << 8n) | BigInt(x);
  n = n % CURVE_ORDER;
  return n === 0n ? 1n : n;
}
