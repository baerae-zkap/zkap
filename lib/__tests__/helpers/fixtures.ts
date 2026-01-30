/**
 * 테스트용 Fixture 데이터 - ZKAP AA SDK용
 */

import { UserOperation } from '../../types/UserOperation';
import { PrimitiveAccountKeyTypes } from '../../types/AccountKey';

/**
 * 테스트용 주소들
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
 * ZkapBuilder 설정
 */
export const MOCK_CHAIN_CONFIG = {
  chainId: 1,
  entryPoint: MOCK_ADDRESSES.entryPoint,
  enUrl: 'https://eth-mainnet.example.com',
} as const;

/**
 * Paymaster 설정
 */
export const MOCK_PAYMASTER_CONFIG = {
  serverUrl: 'https://paymaster.example.com',
  paymasterAddress: MOCK_ADDRESSES.paymaster,
  chainId: 1,
  mode: 0, // PaymasterMode.VERIFYING
} as const;

/**
 * 완전한 UserOperation 객체
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
 * Paymaster가 설정된 UserOperation
 */
export const MOCK_USER_OP_WITH_PAYMASTER: UserOperation = {
  ...MOCK_USER_OP,
  paymaster: MOCK_ADDRESSES.paymaster,
  paymasterVerificationGasLimit: '0x6978',
  paymasterPostOpGasLimit: '0x0',
};

/**
 * initCode가 있는 UserOperation (지갑 생성 시)
 */
export const MOCK_USER_OP_WITH_INIT_CODE: UserOperation = {
  ...MOCK_USER_OP,
  initCode: `${MOCK_ADDRESSES.factory}${'00'.repeat(100)}`, // factory + calldata
};

/**
 * WebAuthn 키 정보
 */
export const MOCK_WEBAUTHN_KEY = {
  credentialPubkey: '0x04' + 'ab'.repeat(64), // uncompressed secp256r1 public key
  credentialId: 'mock-credential-id-base64url',
  rpIdHash: '0x' + 'd4'.repeat(32),
  origin: 'https://app.example.com',
};

/**
 * ZK-OAuth 키 정보
 */
export const MOCK_ZK_OAUTH_KEY = {
  n: 17,
  k: 6,
  commitment: ['0x1234', '0x5678', '0x9abc'],
  poseidonMerkleTreeDirectory: 'https://merkle.example.com',
};

/**
 * 테스트용 UserOp 해시
 */
export const MOCK_USER_OP_HASH = '0x' + 'ab'.repeat(32);

/**
 * 테스트용 개인키 (절대 실제 사용 금지!)
 */
export const MOCK_PRIVATE_KEY = '0x' + '11'.repeat(32);

/**
 * 키 타입 상수 (편의용)
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
 * Gas 관련 상수
 */
export const GAS_CONSTANTS = {
  ADDRESS_KEY_VALIDATION: 15000n,
  WEBAUTHN_KEY_VALIDATION: 470000n,
  ZK_OAUTH_KEY_VALIDATION: 340000n,
  DEFAULT_PRE_VERIFICATION: 25000n,
} as const;
