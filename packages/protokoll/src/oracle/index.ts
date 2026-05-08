// Oracle service entry point.
// Usage: ORACLE_K=... ORACLE_PRIVATE_KEY=0x... ADAPTER_ADDRESS=0x... node dist/oracle/index.js

import { OracleService, type OracleConfig } from './service.js';
import type { Hex } from 'viem';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

const config: OracleConfig = {
  k: BigInt(requireEnv('ORACLE_K')),
  privateKey: requireEnv('ORACLE_PRIVATE_KEY') as Hex,
  adapterAddress: requireEnv('ADAPTER_ADDRESS') as Hex,
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  chainId: Number(process.env['CHAIN_ID'] ?? '10143'),
};

const service = new OracleService(config);
await service.start();

process.on('SIGINT', () => { service.stop(); process.exit(0); });
process.on('SIGTERM', () => { service.stop(); process.exit(0); });
