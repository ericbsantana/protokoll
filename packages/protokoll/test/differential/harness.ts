import { spawn, type ChildProcess, execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, http, type Address, type Hex, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..', '..');
const ARTIFACT_PATH = join(PACKAGE_ROOT, 'out', 'MonadVRFVerifier.sol', 'MonadVRFVerifier.json');

const DEV_PRIVATE_KEY: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export type Harness = {
  anvil: ChildProcess;
  port: number;
  publicClient: PublicClient;
  walletClient: WalletClient;
  verifier: Address;
  rpcUrl: string;
};

type Artifact = {
  abi: unknown[];
  bytecode: { object: Hex } | Hex;
};

function pickPort(): number {
  return 30000 + Math.floor(Math.random() * 20000);
}

async function waitForRpc(rpcUrl: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'web3_clientVersion', params: [] }),
      });
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`anvil did not respond on ${rpcUrl} within ${timeoutMs}ms`);
}

function loadArtifact(): Artifact {
  if (!existsSync(ARTIFACT_PATH)) {
    execSync('forge build', { cwd: PACKAGE_ROOT, stdio: 'inherit' });
  }
  const json = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
  return { abi: json.abi, bytecode: json.bytecode };
}

export async function startHarness(): Promise<Harness> {
  const port = pickPort();
  const rpcUrl = `http://127.0.0.1:${port}`;

  const anvil = spawn(
    'anvil',
    ['--port', String(port), '--hardfork', 'prague', '--silent'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  anvil.stderr?.on('data', (chunk) => {
    if (process.env.HARNESS_DEBUG) process.stderr.write(`[anvil] ${chunk}`);
  });

  await waitForRpc(rpcUrl);

  const account = privateKeyToAccount(DEV_PRIVATE_KEY);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: foundry, transport });
  const walletClient = createWalletClient({ account, chain: foundry, transport });

  const artifact = loadArtifact();
  const bytecode: Hex = typeof artifact.bytecode === 'string' ? artifact.bytecode : artifact.bytecode.object;

  const hash = await walletClient.deployContract({
    abi: artifact.abi as never,
    account,
    chain: foundry,
    bytecode,
    args: [],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error('verifier deployment failed: no contractAddress');

  return { anvil, port, publicClient, walletClient, verifier: receipt.contractAddress, rpcUrl };
}

export async function stopHarness(h: Harness): Promise<void> {
  return new Promise((resolve) => {
    h.anvil.once('exit', () => resolve());
    h.anvil.kill('SIGTERM');
    setTimeout(() => { try { h.anvil.kill('SIGKILL'); } catch {} }, 2000);
  });
}

export const VERIFIER_ABI = [
  {
    type: 'function',
    name: 'verifyProof',
    stateMutability: 'view',
    inputs: [
      { name: 'publicKey', type: 'bytes' },
      { name: 'roundId', type: 'bytes32' },
      { name: 'gamma', type: 'bytes' },
      { name: 'c', type: 'uint256' },
      { name: 's', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

export async function verify(
  h: Harness,
  args: { publicKey: Hex; roundId: Hex; gamma: Hex; c: bigint; s: bigint },
): Promise<boolean> {
  const result = await h.publicClient.readContract({
    address: h.verifier,
    abi: VERIFIER_ABI,
    functionName: 'verifyProof',
    args: [args.publicKey, args.roundId, args.gamma, args.c, args.s],
  });
  return result as boolean;
}
