import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { generateOracleProof } from '../../src/oracle/proof.js';
import { startHarness, stopHarness, verify, type Harness } from './harness.js';
import { proofToArgs, flipBitInHex, makeRoundId } from './proofArgs.js';

describe('differential harness - smoke', () => {
  let h: Harness;

  beforeAll(async () => { h = await startHarness(); }, 60_000);
  afterAll(async () => { if (h) await stopHarness(h); });

  it('valid proof verifies end-to-end', async () => {
    const k = 42n;
    const roundId = makeRoundId('round-1');
    const proof = await generateOracleProof(k, roundId);
    const args = proofToArgs(proof, roundId);
    expect(await verify(h, args)).toBe(true);
  });

  it('one-bit flip in gamma causes verification to fail', async () => {
    const k = 42n;
    const roundId = makeRoundId('round-1');
    const proof = await generateOracleProof(k, roundId);
    const args = proofToArgs(proof, roundId);
    const tamperedGamma = flipBitInHex(args.gamma, 1023);
    const out = await verify(h, { ...args, gamma: tamperedGamma });
    expect(out).toBe(false);
  });
});
