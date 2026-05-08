// Generates a fresh BLS12-381 oracle keypair.
//
//   private key (k)  - a scalar in [1, CURVE_ORDER), kept secret by the oracle
//   public key  (Y)  - Y = k·G, encoded in EIP-2537 128-byte format,
//                      passed to the adapter constructor at deploy time
//
// Usage: npx tsx src/scripts/genOracleKey.ts
//
// The private key MUST be stored securely (e.g. .env, never committed).
// Anyone with k can produce valid proofs and impersonate the oracle.

import { scalarMul, G1_GENERATOR, CURVE_ORDER } from '../math/curve.js';
import { encodePointHex } from '../oracle/proof.js';
import type { AffinePoint } from '../math/curve.js';

function randomScalar(): bigint {
  while (true) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let n = 0n;
    for (const byte of bytes) n = (n << 8n) | BigInt(byte);
    n = n % CURVE_ORDER;
    if (n !== 0n) return n;
  }
}

const k = randomScalar();
const Y = scalarMul(k, G1_GENERATOR) as AffinePoint;
const pubHex = encodePointHex(Y);

console.log('────────────────────────────────────────────────────────────────────');
console.log(' Oracle keypair (BLS12-381 G1)');
console.log('────────────────────────────────────────────────────────────────────');
console.log('');
console.log(' Private key (decimal scalar k - SECRET, store in .env as ORACLE_K):');
console.log(`   ${k.toString(10)}`);
console.log('');
console.log(' Public key (128-byte EIP-2537 hex - pass as ORACLE_PUBLIC_KEY):');
console.log(`   ${pubHex}`);
console.log('');
console.log('────────────────────────────────────────────────────────────────────');
console.log(' .env snippet:');
console.log('────────────────────────────────────────────────────────────────────');
console.log(`ORACLE_K=${k.toString(10)}`);
console.log(`ORACLE_PUBLIC_KEY=${pubHex}`);
