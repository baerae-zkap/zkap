# ZKAP AA SDK - Server Integration Improvements

> This document outlines improvements needed in the SDK to better support server-side integration with `zkap-global-server`.

## Overview

While integrating `@baerae-zkap/zkap-aa` with the ZKAP Global Server, several areas were identified where the SDK could be enhanced to provide better server-side support. Currently, the SDK is primarily designed for client-side usage, and these improvements would make it more versatile for backend services.

---

## 1. Paymaster Signature Utilities

### Current Situation
The server needs to sign paymaster data for sponsored transactions, but the SDK doesn't provide utilities for this. The server currently needs to implement its own signing logic.

### Proposed Addition

```typescript
// src/paymaster/index.ts

export interface PaymasterSignatureParams {
  userOp: PackedUserOperation;
  validUntil: number;
  validAfter: number;
  paymasterAddress: string;
  chainId: number;
}

export interface PaymasterData {
  paymasterVerificationGasLimit: bigint;
  paymasterPostOpGasLimit: bigint;
  validUntil: number;
  validAfter: number;
  signature: string;
}

/**
 * Compute the hash that the paymaster needs to sign
 * @param params - Parameters for hash computation
 * @returns The hash to be signed by the paymaster
 */
export function computePaymasterHash(params: PaymasterSignatureParams): string {
  // Implementation: hash userOp fields + validity window + chainId
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'uint256', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32', 'bytes32', 'uint48', 'uint48'],
    [
      params.userOp.sender,
      params.userOp.nonce,
      ethers.keccak256(params.userOp.initCode),
      ethers.keccak256(params.userOp.callData),
      params.userOp.accountGasLimits,
      params.userOp.preVerificationGas,
      params.userOp.gasFees,
      ethers.keccak256('0x'), // paymasterAndData hash without signature
      params.validUntil,
      params.validAfter,
    ]
  );
  return ethers.keccak256(encoded);
}

/**
 * Sign paymaster data with the paymaster's private key
 * @param params - Parameters including userOp and validity window
 * @param signer - ethers Signer for the paymaster
 * @returns Signed paymaster data ready for inclusion in userOp
 */
export async function signPaymasterData(
  params: PaymasterSignatureParams,
  signer: ethers.Signer
): Promise<PaymasterData> {
  const hash = computePaymasterHash(params);
  const signature = await signer.signMessage(ethers.getBytes(hash));

  return {
    paymasterVerificationGasLimit: 27000n,
    paymasterPostOpGasLimit: 0n,
    validUntil: params.validUntil,
    validAfter: params.validAfter,
    signature,
  };
}

/**
 * Encode paymaster data into the format expected by EntryPoint
 * @param paymasterAddress - Address of the paymaster contract
 * @param data - Signed paymaster data
 * @returns Encoded paymasterAndData field
 */
export function encodePaymasterAndData(
  paymasterAddress: string,
  data: PaymasterData
): string {
  return ethers.concat([
    paymasterAddress,
    ethers.zeroPadValue(ethers.toBeHex(data.paymasterVerificationGasLimit), 16),
    ethers.zeroPadValue(ethers.toBeHex(data.paymasterPostOpGasLimit), 16),
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint48', 'uint48'],
      [data.validUntil, data.validAfter]
    ),
    data.signature,
  ]);
}
```

### Usage Example (Server)

```typescript
import { signPaymasterData, encodePaymasterAndData } from '@baerae-zkap/zkap-aa';

const paymasterData = await signPaymasterData({
  userOp,
  validUntil: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  validAfter: 0,
  paymasterAddress: config.paymasterAddress,
  chainId: 84532,
}, paymasterSigner);

const paymasterAndData = encodePaymasterAndData(
  config.paymasterAddress,
  paymasterData
);
```

---

## 2. UserOp Hash Computation (Pure Function)

### Current Situation
Computing the UserOp hash requires instantiating the EntryPoint contract and making a contract call. For server-side validation and logging, a pure function would be more efficient.

### Proposed Addition

```typescript
// src/userop/hash.ts

/**
 * Compute UserOp hash without contract interaction
 * This is useful for server-side validation and logging
 *
 * @param userOp - The packed user operation
 * @param entryPointAddress - Address of the EntryPoint contract
 * @param chainId - Chain ID for domain separation
 * @returns The UserOp hash
 */
export function computeUserOpHash(
  userOp: PackedUserOperation,
  entryPointAddress: string,
  chainId: number
): string {
  // Pack the userOp into the format expected by EntryPoint
  const userOpPacked = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      'address',    // sender
      'uint256',    // nonce
      'bytes32',    // initCode hash
      'bytes32',    // callData hash
      'bytes32',    // accountGasLimits
      'uint256',    // preVerificationGas
      'bytes32',    // gasFees
      'bytes32',    // paymasterAndData hash
    ],
    [
      userOp.sender,
      userOp.nonce,
      ethers.keccak256(userOp.initCode),
      ethers.keccak256(userOp.callData),
      userOp.accountGasLimits,
      userOp.preVerificationGas,
      userOp.gasFees,
      ethers.keccak256(userOp.paymasterAndData),
    ]
  );

  const userOpHash = ethers.keccak256(userOpPacked);

  // Domain separator: keccak256(abi.encode(userOpHash, entryPoint, chainId))
  const domainEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'address', 'uint256'],
    [userOpHash, entryPointAddress, chainId]
  );

  return ethers.keccak256(domainEncoded);
}
```

### Usage Example (Server)

```typescript
import { computeUserOpHash } from '@baerae-zkap/zkap-aa';

// No contract call needed - fast validation
const hash = computeUserOpHash(userOp, entryPointAddress, chainId);
console.log('UserOp Hash:', hash);

// Useful for logging, tracking, and pre-submission validation
await db.userOpLogs.create({
  userOpHash: hash,
  sender: userOp.sender,
  status: 'pending',
});
```

---

## 3. Anchor Generation Utility

### Current Situation
The ZkOAuth system uses "anchors" (commitment values) derived from OAuth provider information. The server needs to generate these anchors when creating new wallets, but the SDK doesn't expose this utility.

### Proposed Addition

```typescript
// src/zkoauth/anchor.ts

export interface AnchorParams {
  /** OAuth provider identifier (e.g., 'google', 'apple') */
  provider: string;
  /** OAuth client ID */
  clientId: string;
  /** User's unique identifier from the OAuth provider */
  sub: string;
  /** Optional: Additional domain separation */
  domain?: string;
}

/**
 * Compute the anchor (commitment) for a ZkOAuth key
 * The anchor is used to bind the wallet to a specific OAuth identity
 *
 * @param params - Parameters for anchor computation
 * @returns Array of field elements representing the anchor
 */
export function computeAnchor(params: AnchorParams): string[] {
  // Poseidon hash of: provider || clientId || sub || domain
  // Returns as array of field elements for circuit compatibility

  const preimage = ethers.concat([
    ethers.toUtf8Bytes(params.provider),
    ethers.toUtf8Bytes(params.clientId),
    ethers.toUtf8Bytes(params.sub),
    params.domain ? ethers.toUtf8Bytes(params.domain) : '0x',
  ]);

  // Note: Actual implementation should use Poseidon hash
  // This is a placeholder showing the interface
  const hash = poseidonHash(preimage);

  return splitToFieldElements(hash);
}

/**
 * Validate an anchor against OAuth token claims
 * @param anchor - The anchor to validate
 * @param claims - OAuth token claims (iss, sub, aud)
 * @returns True if the anchor matches the claims
 */
export function validateAnchor(
  anchor: string[],
  claims: { iss: string; sub: string; aud: string }
): boolean {
  const expectedAnchor = computeAnchor({
    provider: extractProvider(claims.iss),
    clientId: claims.aud,
    sub: claims.sub,
  });

  return anchor.every((elem, i) => elem === expectedAnchor[i]);
}
```

### Usage Example (Server)

```typescript
import { computeAnchor, validateAnchor } from '@baerae-zkap/zkap-aa';

// When creating a new wallet
const anchor = computeAnchor({
  provider: 'google',
  clientId: process.env.GOOGLE_CLIENT_ID,
  sub: googleIdToken.sub,
});

const txKeyConfig = {
  type: 'ZkOAuthRS256',
  threshold: 1,
  keys: [{
    logicAddress: zkOAuthVerifierAddress,
    weight: 1,
    n: 121,
    k: 17,
    anchor, // Use computed anchor
    merkleTreeDirectoryAddress,
  }],
};

// When validating a transaction
const isValid = validateAnchor(storedAnchor, idTokenClaims);
```

---

## 4. Additional ABI Exports

### Current Situation
The SDK exports ABIs for core contracts (ZkapAccount, ZkapAccountFactory, EntryPoint) but not for all contracts the server needs to interact with.

### Proposed Addition

```typescript
// src/abi/index.ts

// Already exported
export { ZkapAccountABIstring } from './ZkapAccount';
export { ZkapAccountFactoryABIstring } from './ZkapAccountFactory';
export { EntryPointABIstring } from './EntryPoint';

// Proposed additions
export { ZkapPaymasterABIstring } from './ZkapPaymaster';
export { PoseidonMerkleTreeDirectoryABIstring } from './PoseidonMerkleTreeDirectory';
export { ZkOAuthVerifierABIstring } from './ZkOAuthVerifier';

// Typed ABI objects (for better TypeScript support)
export const ZkapPaymasterABI = [
  'function validatePaymasterUserOp(tuple userOp, bytes32 userOpHash, uint256 maxCost) external returns (bytes context, uint256 validationData)',
  'function postOp(uint8 mode, bytes context, uint256 actualGasCost) external',
  'function deposit() external payable',
  'function withdrawTo(address payable withdrawAddress, uint256 amount) external',
  'function getDeposit() external view returns (uint256)',
  // ... other functions
] as const;

export const PoseidonMerkleTreeDirectoryABI = [
  'function getRoot(bytes32 treeId) external view returns (bytes32)',
  'function verifyProof(bytes32 treeId, bytes32 leaf, bytes32[] proof) external view returns (bool)',
  'function updateRoot(bytes32 treeId, bytes32 newRoot) external',
  // ... other functions
] as const;

export const ZkOAuthVerifierABI = [
  'function verify(bytes proof, uint256[] publicInputs) external view returns (bool)',
  'function verifyAndExtract(bytes proof) external view returns (bool valid, bytes32 anchor)',
  // ... other functions
] as const;
```

### Usage Example (Server)

```typescript
import {
  ZkapPaymasterABIstring,
  PoseidonMerkleTreeDirectoryABIstring,
  ZkOAuthVerifierABIstring,
} from '@baerae-zkap/zkap-aa';

// Paymaster balance management
const paymaster = new ethers.Contract(
  paymasterAddress,
  ZkapPaymasterABIstring,
  provider
);
const deposit = await paymaster.getDeposit();

// Merkle tree root verification
const merkleDirectory = new ethers.Contract(
  merkleTreeDirectoryAddress,
  PoseidonMerkleTreeDirectoryABIstring,
  provider
);
const currentRoot = await merkleDirectory.getRoot(treeId);
```

---

## 5. Type Re-exports and Utilities

### Current Situation
Some types are exported but require explicit imports from deep paths. A cleaner re-export structure would improve DX.

### Proposed Changes

```typescript
// src/index.ts - Main entry point

// === Types ===
export type {
  // UserOp types
  UserOperation,
  PackedUserOperation,
  UserOperationReceipt,

  // Key types
  KeyInfo,
  KeyData,
  AddressKeyData,
  ZkOAuthRS256KeyData,
  WebAuthnKeyData,

  // Config types
  AccountConfig,
  FactoryConfig,

  // Result types
  GasEstimation,
  SimulationResult,
} from './types';

// === Enums ===
export {
  PrimitiveAccountKeyTypes,
  CompositeAccountKeyTypes,
} from './types';

// === Builders ===
export { AccountKeyBuilder } from './builders/AccountKeyBuilder';
export { ZkapFactoryBuilder } from './builders/ZkapFactoryBuilder';
export { UserOpBuilder } from './builders/UserOpBuilder';

// === ABIs ===
export * from './abi';

// === Utilities (NEW) ===
export { computeUserOpHash } from './userop/hash';
export { computeAnchor, validateAnchor } from './zkoauth/anchor';
export { signPaymasterData, encodePaymasterAndData, computePaymasterHash } from './paymaster';

// === Constants ===
export {
  DEFAULT_VERIFICATION_GAS_LIMIT,
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  PAYMASTER_VERIFICATION_GAS_LIMIT,
  PAYMASTER_POST_OP_GAS_LIMIT,
} from './constants';
```

---

## Implementation Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **High** | Paymaster Signature Utilities | Medium | Critical for sponsored transactions |
| **High** | UserOp Hash Computation | Low | Improves server performance |
| **Medium** | Anchor Generation Utility | Medium | Required for wallet creation flow |
| **Medium** | Additional ABI Exports | Low | Convenience improvement |
| **Low** | Type Re-exports | Low | DX improvement |

---

## Notes for Implementation

1. **Poseidon Hash**: The anchor computation requires Poseidon hash for circuit compatibility. Consider using `circomlibjs` or a similar library.

2. **Testing**: All server-side utilities should be tested against the actual contract behavior to ensure consistency.

3. **Versioning**: These additions should be backward-compatible and can be added in a minor version bump.

4. **Documentation**: Each new utility should include JSDoc comments with usage examples.

---

## Contact

For questions about these improvements, coordinate with the `zkap-global-server` development team.

**Last Updated**: 2026-01-30
