// Generates a VRF proof and prints the values needed for Foundry tests.
// Usage: npx tsx scripts/genProof.ts

import { generateOracleProof, encodePointHex } from '../oracle/proof.js';

const k = 42n;

// bytes32 roundId: "round-1" left-aligned, zero-padded to 32 bytes.
// Matches Solidity's bytes32("round-1").
const roundIdBytes = new Uint8Array(32);
roundIdBytes.set(new TextEncoder().encode('round-1'));

const proof = await generateOracleProof(k, roundIdBytes);

const toHex32 = (n: bigint) => `0x${n.toString(16).padStart(64, '0')}`;
const toHexBytes = (b: Uint8Array) => `0x${Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')}`;

console.log('// Paste these into Foundry test files');
console.log(`bytes32 constant ROUND_ID = bytes32("round-1");`);
console.log(`bytes constant PK         = hex"${encodePointHex(proof.publicKey).slice(2)}";`);
console.log(`bytes constant GAMMA      = hex"${encodePointHex(proof.gamma).slice(2)}";`);
console.log(`uint256 constant C        = ${toHex32(proof.c)};`);
console.log(`uint256 constant S        = ${toHex32(proof.s)};`);
console.log(`bytes32 constant BETA     = ${toHexBytes(proof.beta)};`);
