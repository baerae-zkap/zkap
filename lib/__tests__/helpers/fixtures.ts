/**
 * Test fixture data for the ZKAP AA SDK
 */

import { UserOperation } from '../../types/UserOperation';
import { PrimitiveAccountKeyTypes } from '../../types/AccountKey';

/**
 * Test addresses
 */
export const MOCK_ADDRESSES = {
  sender: '0x1234567890123456789012345678901234567890',
  entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  factory: '0x9876543210987654321098765432109876543210',
  paymaster: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  zeroAddress: '0x0000000000000000000000000000000000000000',
} as const;

/**
 * ZkapBuilder configuration
 */
export const MOCK_CHAIN_CONFIG = {
  chainId: 1,
  entryPoint: MOCK_ADDRESSES.entryPoint,
  enUrl: 'https://eth-mainnet.example.com',
} as const;

/**
 * Paymaster configuration
 */
export const MOCK_PAYMASTER_CONFIG = {
  serverUrl: 'https://paymaster.example.com',
  paymasterAddress: MOCK_ADDRESSES.paymaster,
  chainId: 1,
  mode: 0, // PaymasterMode.VERIFYING
} as const;

/**
 * Complete UserOperation object
 */
export const MOCK_USER_OP: UserOperation = {
  sender: MOCK_ADDRESSES.sender,
  nonce: '0x0',
  initCode: '0x',
  callData: '0x',
  callGasLimit: '0x5208',
  verificationGasLimit: '0x186a0',
  preVerificationGas: '0x6190',
  maxFeePerGas: '0x3b9aca00',
  maxPriorityFeePerGas: '0x3b9aca00',
  paymaster: MOCK_ADDRESSES.zeroAddress,
  paymasterData: '0x',
  paymasterVerificationGasLimit: '0x0',
  paymasterPostOpGasLimit: '0x0',
  signature: '0x',
};

/**
 * UserOperation with Paymaster configured
 */
export const MOCK_USER_OP_WITH_PAYMASTER: UserOperation = {
  ...MOCK_USER_OP,
  paymaster: MOCK_ADDRESSES.paymaster,
  paymasterVerificationGasLimit: '0x6978',
  paymasterPostOpGasLimit: '0x0',
};

/**
 * UserOperation with initCode (for wallet creation)
 */
export const MOCK_USER_OP_WITH_INIT_CODE: UserOperation = {
  ...MOCK_USER_OP,
  initCode: `${MOCK_ADDRESSES.factory}${"00".repeat(100)}`, // factory + calldata
};

/**
 * WebAuthn key info
 */
export const MOCK_WEBAUTHN_KEY = {
  credentialPubkey: '0x04' + 'ab'.repeat(64), // uncompressed secp256r1 public key
  credentialId: 'mock-credential-id-base64url',
  rpIdHash: '0x' + 'd4'.repeat(32),
  origin: 'https://app.example.com',
};

/**
 * ZK-OAuth key info
 */
export const MOCK_ZK_OAUTH_KEY = {
  n: 17,
  k: 6,
  commitment: ['0x1234', '0x5678', '0x9abc'],
  poseidonMerkleTreeDirectory: 'https://merkle.example.com',
};

/**
 * Test UserOp hash
 */
export const MOCK_USER_OP_HASH = '0x' + 'ab'.repeat(32);

/**
 * Test private key (NEVER use in production!)
 */
export const MOCK_PRIVATE_KEY = '0x' + '11'.repeat(32);

/**
 * Key type constants (for convenience)
 */
export const KEY_TYPES = {
  ADDRESS: PrimitiveAccountKeyTypes.keyAddress,
  SECP256K1: PrimitiveAccountKeyTypes.keySecp256k1,
  SECP256R1: PrimitiveAccountKeyTypes.keySecp256r1,
  WEBAUTHN: PrimitiveAccountKeyTypes.keyWebAuthn,
  OAUTH_RS256: PrimitiveAccountKeyTypes.keyOAuthRS256,
  ZK_OAUTH_RS256: PrimitiveAccountKeyTypes.keyZkOAuthRS256,
} as const;

/**
 * Gas-related constants
 */
export const GAS_CONSTANTS = {
  ADDRESS_KEY_VALIDATION: 15000n,
  WEBAUTHN_KEY_VALIDATION: 150000n, // P256VERIFY 프리컴파일 실측 기준 (ZkapBuilder.WEB_AUTHN_KEY_VALIDATION_GAS와 동기)
  ZK_OAUTH_KEY_VALIDATION: 340000n,
  DEFAULT_PRE_VERIFICATION: 25000n,
} as const;
