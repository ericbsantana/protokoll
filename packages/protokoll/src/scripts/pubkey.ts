// Print the oracle public key (Y = k·G) in EIP-2537 hex format.
// Usage: ORACLE_K=42 npx tsx scripts/pubkey.ts

import { encodePointHex } from '../oracle/proof.js';
import { scalarMul, G1_GENERATOR } from '../math/curve.js';

const k = BigInt(process.env['ORACLE_K'] ?? '');
if (!k) throw new Error('ORACLE_K not set');

const Y = scalarMul(k, G1_GENERATOR);
if (Y === 'infinity') throw new Error('k must be nonzero');

console.log(encodePointHex(Y));
