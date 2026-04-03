# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-31

First public open-source release on [npmjs.com](https://www.npmjs.com/package/@baerae-zkap/zkap).

### BREAKING CHANGES

- **ZkPasskeySigner renamed to ZkOAuthSigner** — reflects actual functionality (ZK proofs of OAuth JWTs, not WebAuthn)
  - **Migration**: Replace all `ZkPasskeySigner` imports and usages with `ZkOAuthSigner`
  - `clearJwksCache` is no longer exported; it is internal only

- **WalletHelperConfig**: `apiUrl` field removed (was dead code)
  - **Migration**: Configure the API URL on `ChainRegistry` directly: `new ChainRegistry({ apiUrl: '...' })`

- **IUserOpSigner**: `keyTypes` property is now optional (`keyTypes?: number[]`)
  - **Migration**: If your code reads `signer.keyTypes`, add a fallback: `signer.keyTypes ?? []`

- **BaseAccountBuilder**: Constructor now rejects `chainId <= 0`
  - **Migration**: Use a valid EVM chain ID (e.g., `1`, `11155111`)

- **OneInchAggregator**: `allowance` field type changed from `number | null` to `string | null`
  - **Migration**: Parse with `BigInt(allowance)` instead of numeric operations

### Added

- **ESM build** — dual CJS + ESM output (`dist/lib/` and `dist/esm/`). ESM is the recommended target for bundlers; CJS for direct Node.js use.
- **`package.json` exports map** — `import` resolves to `dist/esm/index.js`, `require` to `dist/lib/index.js`
- **`ChainRegistry`** — fetches chain config (RPC URL, entry point, factory, bundler, contract addresses) from the ZKAP API with 5-minute cache
- **`WalletHelper`** — high-level interface: `deriveAddress`, `sendTransaction`, `sendBatchTransaction`

### Changed

- Package published to `https://registry.npmjs.org/` (was private GCP Artifact Registry)
- **`strictNullChecks: true`** enabled — zero TypeScript errors
- **PaymasterService**: HTTPS enforcement — HTTP rejected except for `localhost` / `127.0.0.1`
- **ZkOAuthSigner**: `proofServerUrl` HTTPS enforcement — same localhost exception applies

### Refactored (non-breaking)

- **ZkOAuthSigner** (formerly ZkPasskeySigner): `getSignatures()` slot branching replaced with generic pad-to-3 loop (behavior unchanged)
- **ZkOAuthSigner**: `BN254_FR` constant imported from `utils/crypto` instead of re-declared inline
- **ZkOidcSigner**: `validateBN254Field()` helper extracted; `sharedInputs` range checks unified
- All source file comments translated to English

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
