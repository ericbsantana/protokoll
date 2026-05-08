// Regenerates VRF proof fixtures and rewrites the constants in the two
// Foundry test files in place. Use after changing DST, the oracle key,
// or anything else that affects the proof inputs.
//
// Usage: npx tsx src/scripts/refreshFixtures.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { generateOracleProof, encodePointHex } from '../oracle/proof.js';

const k = 42n;
const ROUND = 'round-1';

const ADAPTER_TEST = 'test/contracts/MonadVRFAdapter.t.sol';
const VERIFIER_TEST = 'test/contracts/MonadVRFVerifier.t.sol';

const roundIdBytes = new Uint8Array(32);
roundIdBytes.set(new TextEncoder().encode(ROUND));

const proof = await generateOracleProof(k, roundIdBytes);

const gammaHex = encodePointHex(proof.gamma).slice(2);
const cHex = `0x${proof.c.toString(16).padStart(64, '0')}`;
const sHex = `0x${proof.s.toString(16).padStart(64, '0')}`;
const betaHex = `0x${Array.from(proof.beta).map((x) => x.toString(16).padStart(2, '0')).join('')}`;

function patch(path: string, withBeta: boolean): boolean {
  const before = readFileSync(path, 'utf8');

  let after = before
    .replace(
      /(bytes constant GAMMA\s*=\s*\n\s*hex")[0-9a-f]+(";)/,
      `$1${gammaHex}$2`,
    )
    .replace(
      /(uint256 constant C\s*=\s*)0x[0-9a-f]+;/,
      `$1${cHex};`,
    )
    .replace(
      /(uint256 constant S\s*=\s*)0x[0-9a-f]+;/,
      `$1${sHex};`,
    );

  if (withBeta) {
    after = after.replace(
      /(bytes32 constant BETA\s*=\s*)0x[0-9a-f]+;/,
      `$1${betaHex};`,
    );
  }

  if (after === before) return false;
  writeFileSync(path, after);
  return true;
}

const adapterChanged = patch(ADAPTER_TEST, true);
const verifierChanged = patch(VERIFIER_TEST, false);

console.log(`gamma: ${gammaHex.slice(0, 32)}...`);
console.log(`c    : ${cHex}`);
console.log(`s    : ${sHex}`);
console.log(`beta : ${betaHex}`);
console.log('');
console.log(`${ADAPTER_TEST} : ${adapterChanged ? 'updated' : 'no change'}`);
console.log(`${VERIFIER_TEST}: ${verifierChanged ? 'updated' : 'no change'}`);
