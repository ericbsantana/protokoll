import {
  createPublicClient,
  createWalletClient,
  http,
  hexToBytes,
  parseAbiItem,
  parseAbi,
  type Chain,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { generateOracleProof, encodePointHex } from './proof.js';

const REQUESTED_EVENT = parseAbiItem(
  'event RandomnessRequested(bytes32 indexed roundId, address indexed requester)'
);

const ADAPTER_ABI = parseAbi([
  'function fulfill(bytes32 roundId, bytes gamma, uint256 c, uint256 s)',
  'function fulfilled(bytes32 roundId) view returns (bool)',
]);

const POLL_INTERVAL_MS = 1000;
const CATCHUP_BLOCKS = 20n;  // blocks to scan on startup
const MAX_RANGE = 20n;  // max blocks per getLogs call - avoids RPC range limits

export type OracleConfig = {
  k: bigint;
  privateKey: Hex;
  adapterAddress: Hex;
  rpcUrl: string;
  chainId: number;
};

export class OracleService {
  private readonly config: OracleConfig;
  private readonly chain: Chain;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly processed = new Set<string>();

  constructor(config: OracleConfig) {
    this.config = config;
    this.chain = {
      id: config.chainId,
      name: 'Monad Testnet',
      nativeCurrency: { decimals: 18, name: 'MON', symbol: 'MON' },
      rpcUrls: { default: { http: [config.rpcUrl] } },
    };
  }

  async start(): Promise<void> {
    const client = createPublicClient({ chain: this.chain, transport: http(this.config.rpcUrl) });

    const latest = await client.getBlockNumber();
    let fromBlock = latest > CATCHUP_BLOCKS ? latest - CATCHUP_BLOCKS : 0n;

    console.log(`[oracle] started - adapter=${this.config.adapterAddress} scanning from block ${fromBlock}`);

    const poll = async () => {
      try {
        const current = await client.getBlockNumber();
        console.log(`[oracle] poll - block=${current} scanning=${fromBlock}–${current}`);

        if (current >= fromBlock) {
          const logs = await client.getLogs({
            address: this.config.adapterAddress,
            event: REQUESTED_EVENT,
            fromBlock,
            toBlock: current,
          });

          console.log(`[oracle] getLogs returned ${logs.length} event(s)`);

          for (const log of logs) {
            if (log.args.roundId) void this.fulfill(log.args.roundId);
          }

          fromBlock = current + 1n;
        }
      } catch (err) {
        console.error('[oracle] poll error:', err);
      }

      this.timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    void poll();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    console.log('[oracle] stopped');
  }

  private async fulfill(roundId: Hex): Promise<void> {
    if (this.processed.has(roundId)) return;
    this.processed.add(roundId);

    try {
      const client = createPublicClient({ chain: this.chain, transport: http(this.config.rpcUrl) });

      // Skip if already fulfilled on-chain (e.g. service restarted after a partial run)
      const alreadyDone = await client.readContract({
        address: this.config.adapterAddress,
        abi: ADAPTER_ABI,
        functionName: 'fulfilled',
        args: [roundId],
      });
      if (alreadyDone) {
        console.log(`[oracle] roundId=${roundId} already fulfilled on-chain, skipping`);
        return;
      }

      console.log(`[oracle] generating proof for roundId=${roundId}`);
      const proof = await generateOracleProof(this.config.k, hexToBytes(roundId));

      const account = privateKeyToAccount(this.config.privateKey);
      const walletClient = createWalletClient({
        account,
        chain: this.chain,
        transport: http(this.config.rpcUrl),
      });

      const txHash = await walletClient.writeContract({
        address: this.config.adapterAddress,
        abi: ADAPTER_ABI,
        functionName: 'fulfill',
        args: [roundId, encodePointHex(proof.gamma), proof.c, proof.s],
      });

      const betaHex = Array.from(proof.beta).map(b => b.toString(16).padStart(2, '0')).join('');
      console.log(`[oracle] fulfilled roundId=${roundId} beta=0x${betaHex} tx=${txHash}`);
    } catch (err) {
      this.processed.delete(roundId);
      console.error(`[oracle] failed roundId=${roundId}:`, err);
    }
  }
}
