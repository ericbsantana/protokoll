export type ContractKey = 'verifier' | 'adapter'

export type Deployment = {
  version: string
  active: boolean
  verifier: `0x${string}`
  adapter: `0x${string}`
  dst: string
}

export const MONAD_TESTNET = {
  name: 'Monad Testnet',
  chainId: 10143,
  rpc: 'https://testnet-rpc.monad.xyz',
  explorer: 'https://testnet.monadexplorer.com',
  requestFee: '0.001 MON',
  requestFeeWei: '1000000000000000',
} as const

export const DEPLOYMENTS: readonly Deployment[] = [
  {
    version: 'v0.3.0',
    active: true,
    verifier: '0x540A336317274Aac36b8cf9B7510f428Bf3e49Cc',
    adapter: '0x9c46878D6736eDC7eAF135DB6B3B2A9Dab2A756F',
    dst: 'protokoll-v1',
  },
  {
    version: 'v0.2.0',
    active: false,
    verifier: '0xFb70863723D8a54a559A657416Cdb2068B1b9F9D',
    adapter: '0x7782a54741dd9Dac95a8a79F181EFB97Bac2Dd19',
    dst: 'randnad-v1',
  },
  {
    version: 'v0.1.x',
    active: false,
    verifier: '0xe7f01914d7547d08d155ba47ee9616ee7d504b21',
    adapter: '0xf04f829a98a686893ba740260e37876725c89ed5',
    dst: 'randnad-v1',
  },
] as const

export const ACTIVE_DEPLOYMENT: Deployment = DEPLOYMENTS.find((d) => d.active)!

export function getDeployment(version: string): Deployment {
  const d = DEPLOYMENTS.find((x) => x.version === version)
  if (!d) throw new Error(`Unknown deployment version: ${version}`)
  return d
}

export function getAddress(
  version: string | undefined,
  contract: ContractKey,
): `0x${string}` {
  const d = version ? getDeployment(version) : ACTIVE_DEPLOYMENT
  return d[contract]
}
