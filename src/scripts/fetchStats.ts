// Counts RandomnessFulfilled events on the current adapter and writes a
// shields.io endpoint badge to .github/badges/rounds.json. The same file
// stores the last scanned block so subsequent runs only scan the delta.
//
// Extra fields (lastBlock, generatedAt) are ignored by shields.io. See:
//   https://shields.io/badges/endpoint-badge

import { createPublicClient, http, parseAbiItem } from 'viem';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ADAPTER = '0x9c46878D6736eDC7eAF135DB6B3B2A9Dab2A756F';
const RPC = 'https://testnet-rpc.monad.xyz';

// Adapter deploy block on Monad testnet (v0.3.0).
const DEPLOY_BLOCK = 30497597n;

// Monad testnet caps eth_getLogs at 100 blocks per request.
const CHUNK_SIZE = 100n;

const BADGE_PATH = '.github/badges/rounds.json';

const event = parseAbiItem(
  'event RandomnessFulfilled(address indexed consumer, bytes32 indexed roundId, bytes32 beta, bool callbackOk)'
);

type Badge = {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
  lastBlock: string;
  generatedAt: string;
};

function loadState(): { count: number; fromBlock: bigint } {
  try {
    const raw = JSON.parse(readFileSync(BADGE_PATH, 'utf8')) as Partial<Badge>;
    const count = Number.parseInt(raw.message ?? '0', 10);
    const last = BigInt(raw.lastBlock ?? String(DEPLOY_BLOCK - 1n));
    return { count: Number.isFinite(count) ? count : 0, fromBlock: last + 1n };
  } catch {
    return { count: 0, fromBlock: DEPLOY_BLOCK };
  }
}

const client = createPublicClient({ transport: http(RPC) });

const { count: initialCount, fromBlock: startBlock } = loadState();
const currentBlock = await client.getBlockNumber();

let count = initialCount;
let from = startBlock;
let chunks = 0;

while (from <= currentBlock) {
  const to = from + CHUNK_SIZE - 1n > currentBlock ? currentBlock : from + CHUNK_SIZE - 1n;
  const logs = await client.getLogs({
    address: ADAPTER,
    event,
    fromBlock: from,
    toBlock: to,
  });
  count += logs.length;
  chunks += 1;
  from = to + 1n;
}

const badge: Badge = {
  schemaVersion: 1,
  label: 'rounds fulfilled',
  message: String(count),
  color: count > 0 ? 'blue' : 'lightgrey',
  lastBlock: String(currentBlock),
  generatedAt: new Date().toISOString(),
};

mkdirSync(dirname(BADGE_PATH), { recursive: true });
writeFileSync(BADGE_PATH, JSON.stringify(badge, null, 2) + '\n');

console.log(
  `updated ${BADGE_PATH}: count=${count} lastBlock=${currentBlock} chunks=${chunks} (delta ${
    currentBlock - startBlock + 1n
  } blocks)`
);
