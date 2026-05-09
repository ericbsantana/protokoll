//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IRandomnessAdapter
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const iRandomnessAdapterAbi = [
  {
    type: 'function',
    inputs: [
      { name: 'roundId', internalType: 'bytes32', type: 'bytes32' },
      { name: 'beta', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'fulfillRandomness',
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MonadVRFAdapter
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const monadVrfAdapterAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'verifier_', internalType: 'address', type: 'address' },
      { name: 'pk0_', internalType: 'bytes32', type: 'bytes32' },
      { name: 'pk1_', internalType: 'bytes32', type: 'bytes32' },
      { name: 'pk2_', internalType: 'bytes32', type: 'bytes32' },
      { name: 'pk3_', internalType: 'bytes32', type: 'bytes32' },
      { name: 'requestFee_', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'CALLBACK_GAS_LIMIT',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    name: 'escrow',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'consumer', internalType: 'address', type: 'address' },
      { name: 'roundId', internalType: 'bytes32', type: 'bytes32' },
      { name: 'gamma', internalType: 'bytes', type: 'bytes' },
      { name: 'c', internalType: 'uint256', type: 'uint256' },
      { name: 's', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'fulfill',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    name: 'fulfilled',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'oraclePublicKey',
    outputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    name: 'pendingRequests',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'requestFee',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'consumer', internalType: 'address', type: 'address' },
      { name: 'roundId', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'requestKey',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'roundId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'requestRandomness',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'verifier',
    outputs: [
      { name: '', internalType: 'contract MonadVRFVerifier', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'consumer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'roundId',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'beta',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
      {
        name: 'callbackOk',
        internalType: 'bool',
        type: 'bool',
        indexed: false,
      },
    ],
    name: 'RandomnessFulfilled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'roundId',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'requester',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'RandomnessRequested',
  },
  {
    type: 'error',
    inputs: [
      { name: 'consumer', internalType: 'address', type: 'address' },
      { name: 'roundId', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'AlreadyFulfilled',
  },
  {
    type: 'error',
    inputs: [
      { name: 'consumer', internalType: 'address', type: 'address' },
      { name: 'roundId', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'AlreadyRequested',
  },
  { type: 'error', inputs: [], name: 'FeeTransferFailed' },
  {
    type: 'error',
    inputs: [
      { name: 'sent', internalType: 'uint256', type: 'uint256' },
      { name: 'expected', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'IncorrectFee',
  },
  { type: 'error', inputs: [], name: 'InvalidProof' },
  { type: 'error', inputs: [], name: 'InvalidPublicKey' },
  {
    type: 'error',
    inputs: [
      { name: 'consumer', internalType: 'address', type: 'address' },
      { name: 'roundId', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'NoPendingRequest',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MonadVRFVerifier
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const monadVrfVerifierAbi = [
  {
    type: 'function',
    inputs: [
      { name: 'publicKey', internalType: 'bytes', type: 'bytes' },
      { name: 'roundId', internalType: 'bytes32', type: 'bytes32' },
      { name: 'gamma', internalType: 'bytes', type: 'bytes' },
      { name: 'c', internalType: 'uint256', type: 'uint256' },
      { name: 's', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'verifyProof',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
] as const
