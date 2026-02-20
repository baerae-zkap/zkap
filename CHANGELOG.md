# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-02-20

### BREAKING CHANGES

- **IUserOpSigner**: `keyTypes` property is now optional (`keyTypes?: number[]`)
  - **Impact**: None for consumers using built-in signers (PasskeySigner, ZkPasskeySigner, ZkOidcSigner, AddressKeySigner) — all still expose `keyTypes`
  - **Impact**: External custom `IUserOpSigner` implementations no longer required to declare `keyTypes`
  - **Migration**: If your code reads `signer.keyTypes`, add a fallback: `signer.keyTypes ?? []`

- **BaseAccountBuilder**: Constructor now rejects `chainId <= 0`
  - **Impact**: Code using `chainId = 0` as a placeholder will throw at runtime
  - **Migration**: Use a valid EVM chain ID (e.g., `1` for Ethereum mainnet, `31337` for Hardhat local)

- **OneInchAggregator**: `allowance` field type changed from `number | null` to `string | null`
  - **Impact**: TypeScript consumers accessing `allowance` as a number will get type errors
  - **Migration**: Parse with `BigInt(allowance)` instead of using numeric operations

### Changed

- **PaymasterService**: HTTPS enforcement — HTTP URLs now rejected except for `localhost` and `127.0.0.1`
  - **Impact**: Staging environments using `http://` non-local URLs will throw
  - **Migration**: Use HTTPS for remote paymaster URLs, or update to a localhost URL for local testing

- **ZkPasskeySigner**: `proofServerUrl` HTTPS enforcement — same localhost exception applies

### Refactored (non-breaking)

- **ZkPasskeySigner**: `getSignatures()` 1/2/3-slot branching replaced with generic pad-to-3 loop (behavior unchanged)
- **ZkPasskeySigner**: `BN254_FR` constant now imported from `utils/crypto` instead of re-declared inline
- **ZkOidcSigner**: `validateBN254Field()` helper extracted; `sharedInputs` type + range checks combined into one pass
- **ZkOidcSigner**: Error message for `sharedInputs` out-of-range standardized to "BN254 scalar field range"

## [0.0.25] - 2026-02-06

### BREAKING CHANGES

- **ZkOidcSigner**: Complete API redesign to match `AccountKeyZkOAuthRS256Verifier.sol` contract's new signature format
- Removed `setProofAndPublicInput(proof, publicInputs)` method
- Added `setProofData({ sharedInputs, partialRhsList, proofs })` method
- Changed signature encoding format from `["uint256[8]", "uint256[8]"]` to `["uint256[7]", "uint256[]", "uint256[8][]"]`

### Changed

- **ZkOidcSigner**: Restructured internal fields
  - Removed: `proof: string[]`, `publicInputs: string[]`
  - Added: `sharedInputs: string[]`, `partialRhsList: string[]`, `proofs: string[][]`
- **Signature Format**: Updated to match contract's `abi.decode(sig, (uint256[7], uint256[], uint256[8][]))`
  - `sharedInputs`: 7-element array containing [hanchor, h_ctx, root, h_sign_userop, block_timestamp, lhs, h_aud_list]
  - `partialRhsList`: K-element array (K = number of proofs)
  - `proofs`: K × 8 array (K Groth16 proofs, each with 8 elements)

### Migration Guide

Users must update all `ZkOidcSigner` usage:

```typescript
// Before (0.0.24)
const signer = new ZkOidcSigner();
signer.setProofAndPublicInput(proof, publicInputs);
const signature = await signer.signUserOpHash();

// After (Unreleased)
const signer = new ZkOidcSigner();
signer.setProofData({
  sharedInputs: proofResult.sharedInputs,    // 7 elements
  partialRhsList: proofResult.partialRhsList, // K elements
  proofs: proofResult.proofs                  // K × 8 array
});
const signature = await signer.signUserOpHash();
```

### Technical Details

The new format aligns with the contract's validate function at `AccountKeyZkOAuthRS256Verifier.sol` (lines 108-112), which expects:
- `uint256[7] sharedInputs`: Common inputs shared across all K proofs
- `uint256[] partialRhsList`: K partial right-hand side values (one per proof)
- `uint256[8][] proofs`: K Groth16 proofs in BN254 scalar field

This change enables multi-proof ZK-OIDC authentication with proper separation of shared and per-proof inputs.

## [0.0.24] - 2026-02-05

### BREAKING CHANGES

- Added required `hAudList` parameter to `ZkOAuthRS256KeyData` type
- Updated ABI encoding to include `hAudList` as third parameter: `(n, k, hAudList, commitment[])`
- This change aligns SDK with smart contract `AccountKeyZkOAuthRS256Verifier.sol` requirements

### Changed

- **Type Definition**: Added `hAudList: string` field to `ZkOAuthRS256KeyData` in `lib/types/AccountKey.ts`
- **Encoding Functions**: Updated both `getEncodedZkOAuthRS256KeyInitData` and `setEncodedInitData` in `lib/builders/AccountKeyBuilder.ts` to encode 4 parameters instead of 3
- **ABI Format**: Changed from `["uint256", "uint256", "uint256[]"]` to `["uint256", "uint256", "uint256", "uint256[]"]`
- **Encoding Values**: Changed from `[n, k, commitment]` to `[n, k, hAudList, commitment]`

### Migration Guide

Users must update all `ZkOAuthRS256KeyData` objects to include the `hAudList` field:

```typescript
// Before (0.0.23)
const keyData: ZkOAuthRS256KeyData = {
  n: 121,
  k: 17,
  commitment: [...],
  poseidonMerkleTreeDirectory: "0x..."
};

// After (0.0.24)
const keyData: ZkOAuthRS256KeyData = {
  n: 121,
  k: 17,
  hAudList: "0x...", // NEW: Poseidon hash of audience list
  commitment: [...],
  poseidonMerkleTreeDirectory: "0x..."
};
```

### Technical Details

The `hAudList` parameter represents a Poseidon hash of the audience list in the ZK-OIDC verification context. It is encoded as `uint256` to match the Solidity contract's state variable type.

The contract expects the following decoding format:
```solidity
// encoded format: (n, k, hAudList, tag[])
(n, k, hAudList, anchor) = abi.decode(
    encoded,
    (uint256, uint256, uint256, uint256[])
);
```

## [0.0.23] - Previous release

See git history for changes prior to 0.0.24.
