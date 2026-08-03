# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.10] - 2026-08-03

### Added

- `calcAltoRequiredPvg()` / `calibrateBundlerPvg()` (`lib/utils/bundlerPvg.ts`) and
  `BaseAccountBuilder.applyBundlerPreVerificationGas()`: compute the bundler's actual
  `preVerificationGas` floor instead of guessing at it. The calculation is a port of
  Pimlico alto's `calcExecutionPvgComponent`, which is exactly what
  `eth_sendUserOperation` compares against; `calibrateBundlerPvg` adds a margin
  (default `x1.10 + 15,000`, the same 110% alto's own estimator returns, plus a flat
  cushion for overhead drift).

  **Why it matters:** EntryPoint charges `preVerificationGas` in FULL — `preOpGas` is
  `measuredValidationGas + preVerificationGas` — so anything declared above the floor is
  paid and never refunded, while anything below it is rejected at submission. The common
  "multiply the SDK estimate by 4" workaround costs ~200k gas per op on ZK-signed ops.
  Measured on Sepolia (EntryPoint v0.8): the floor for a wallet-deploy op is 76,673 gas
  against 295,232 declared under the x4 policy.

  Verified against the live endpoint, not just unit-tested: for five op shapes on chains
  1 and 11155111, `eth_estimateUserOperationGas` returned exactly `port x 1.10`. Re-run
  `scripts/check-pvg-floor.mjs` after an alto release or a bundler-vendor change.

  ⚠️ **alto-specific, execution component only.** Chains where alto adds an L2
  data-availability component (`op-stack`, `arbitrum`, `mantle`, `etherlink`, `citrea`,
  `monad`) need that part supplied via `extraComponent`, or a conservative multiplier
  instead. Verified `chainType=default` (component 0): Ethereum mainnet, Sepolia.
  ⚠️ The op must be complete before calling: the signature must already have the REAL
  signature's byte length (that is what dummy signatures are for), and `callGasLimit`
  must be final. Call it after `autoFillUserOp()` and before any paymaster handoff or
  `getUserOpHash()`.

- `ZkapBuilder.ZK_OAUTH_RS256_SINGLE_PROOF_VALIDATION_GAS` (400,000): zk-OAuth
  validation budget for a single-proof (1-of-1) signature, selected automatically from
  the proof count in the signature already set. Undecodable or absent signatures keep
  using the conservative 3-of-6 constant.

### Changed

- `ZkapBuilder.ZK_OAUTH_RS256_KEY_VALIDATION_GAS` lowered from 1,000,000 to 900,000.
  Sepolia-measured `validateUserOp` for shuffled 3-of-6 key updates is 753,719–753,790
  gas across six ops; with `autoFillUserOp`'s x1.2 buffer the resulting
  `verificationGasLimit` drops from 1,230,000 to 1,110,000 (~1.43x measured). Wallet
  deployments drop much further — their validation is 1-of-1 (250,215–278,797 measured;
  the 3-of-6 verification happens in `updateKeys` EXECUTION, not validation), so with the
  new single-proof constant a deploy's `verificationGasLimit` goes from 1,919,821 to
  ~1,199,821. Fees are unchanged (unused verification gas is never charged by EntryPoint
  v0.7/v0.8); what shrinks is the required prefund locked per op, which is what gates a
  user-paid wallet on having "enough" balance.

- `updateKeys` (wallet-creation `callGasLimit`, used when the wallet is not yet deployed
  so on-chain estimation is impossible) lowered from 2,000,000 to 1,300,000 (+25,000
  buffer = 1,325,000). Sepolia-measured execution is 867,516 gas, stable across traced
  deploys, with a ~927,500 worst case derived from the callData-length spread of 20
  deploys — the new value keeps ~1.4x headroom.

  **Why it matters:** EntryPoint v0.7/v0.8 charge a 10% penalty on UNUSED
  `callGasLimit` above a 40,000 threshold, so the old value burned ~115k gas per deploy.
  ⚠️ This is the one field whose under-declaration is not a free rejection: execution
  reverts ON-CHAIN and is still charged, leaving a wallet deployed with its keys
  un-updated. The constants are measurements of the CURRENT contract deployment —
  re-measure after a ZkapAccount/verifier redeploy or a circuit change.

## [0.1.9] - 2026-07-28

### Changed

- `ZkapBuilder.WEB_AUTHN_KEY_VALIDATION_GAS` lowered from 470,000 to 150,000. The old value was
  measured on the pure-Solidity P-256 verification path before the P256VERIFY precompile
  (EIP-7951); mainnet-measured validation via the precompile is now ~97k gas. WebAuthn ops'
  `verificationGasLimit` drops from 594,000 to 210,000. Fees are unchanged (unused verification
  gas is never charged by EntryPoint v0.7/v0.8); the required prefund locked per op shrinks by
  ~384k gas and app-side fee previews (limit-sum based) become accurate. ⚠️ Chains without the
  P256VERIFY precompile fall back to the pure-Solidity path and will revert with this limit —
  verify precompile support before using WebAuthn ops on non-mainnet/Sepolia chains.
- Release CI: `npm` pinned to 11 in the publish workflow — `npm@latest` (12) requires Node ≥ 22
  and EBADENGINEs on the Node 20 runner (broke the v0.1.8 tag publish on first run).

### Removed

- `withTokenPayment` helper and `AaOperationErrorCode.PAYMASTER_REWRITE_MISMATCH` (revert of the
  unshipped byte-level paymaster rewrite-verification path; `PaymasterService` trimmed
  accordingly). No known consumers.

## [0.1.8] - 2026-07-28

Salt-only release, cut from `v0.1.7` (excludes everything above).

### Added

- `computeSalt(aud, sub, walletIndex?)` — optional third argument derives additional wallets
  from the same social account. `undefined`/`0` keep the historical 2-arg salt byte-for-byte;
  `1..255` append `String(walletIndex)` as a third ABI string. ABI slot 3 is reserved for the
  walletIndex decimal string; future derivation parameters must use slot 4+. Out-of-range or
  non-integer values (including `null`) throw. Canonical salt implementation — mirrored test
  vectors live in embedded-zkap and zkap-web3-server.
- `MAX_WALLET_INDEX` (= 255) export.
- `WalletHelper.computeSalt(aud, sub, walletIndex?)` and
  `WalletHelper.deriveAddress({ aud, sub, chainId, walletIndex? })`.

## [0.1.5] - 2026-04-21

### Added
- **`rpcEstimateGasCap` constructor option** on `ZkapBuilder` / `ZkapCreator` (via `ZkapAccountInfo` / `ZkapCreatorInfo`). Bounds `gasLimit` in internal `eth_estimateGas` calls with a default of 15M. Fixes Base Sepolia public RPCs rejecting wallet deploy with `"intrinsic gas too high"`. Set to `0n` to disable injection and fall back to node default behavior (escape hatch).
- **`BaseAccountBuilder` constructor 4th positional arg `rpcEstimateGasCap?: bigint`** — propagated from the subclasses above.

### Fixed
- `autoFillUserOp()` no longer fails on Base Sepolia (chainId 84532) public RPC endpoints (sepolia.base.org, onfinality, drpc, Tenderly gateway) when estimating gas for `createAccount` or `execute`.

## [0.1.4] - 2026-04-09

### Added
- **`estimateUserOpGas()`** — gas estimation via `eth_estimateUserOperationGas` on `Erc4337BundlerProvider`
- **`PimlicoGasEstimate` type** — typed response for gas estimation (preVerificationGas, verificationGasLimit, callGasLimit, paymaster gas fields)
- **`normalizeHex()` helper** — pads odd-length hex strings from bundler responses to even length for ethers.js compatibility

## [0.1.3] - 2026-04-08

### Added
- **Pimlico bundler support** — `Erc4337BundlerProvider` now accepts `usePimlicoFormat: true` to convert packed UserOperations to Pimlico v0.7/v0.8 JSON-RPC format
- **`PimlicoUserOperation` type** — unpacked format with separate `factory`/`factoryData` fields instead of `initCode`
- **`toPimlicoFormat()` utility** — converts `PackedUserOperation` to Pimlico format with minimal hex encoding (JSON-RPC convention)
- **`Erc4337BundlerProviderConfig` type** — typed configuration for `Erc4337BundlerProvider`
- Input validation in `toPimlicoFormat()`: rejects malformed `initCode` (truncated address) and `paymasterAndData` (missing gas fields)

### Changed
- Package renamed from `@baerae/zkap` to `@baerae/zkap-aa`
- `ethers` moved from dependencies to peerDependencies (`^6.0.0`)
- Fixed GitHub repository URLs in package.json

## [0.1.0] - 2026-03-31

First public open-source release on [npmjs.com](https://www.npmjs.com/package/@baerae/zkap-aa).

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
