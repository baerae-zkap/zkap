# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-04

Removes the SDK's dependencies on ZKAP Server's chain-config and bundler REST
endpoints, and repairs the ESM build.

**Why now:** the ZKAP web3 server is removing `rpcUrl` and `explorerUrl` from its
public chain-config surface (`GET /api/v1/chains*` and the GCS static JSON),
because that surface is unauthenticated and therefore cannot carry a keyed RPC
endpoint. Every SDK path that consumed it was already dead — two of the three
endpoints do not exist server-side at all — so this release removes the latent
trap rather than reacting to a live break.

### BREAKING CHANGES

- **`ChainRegistry` and type `ChainConfig` removed.** The class fetched chain
  config from `GET /api/v1/chains` and `/api/v1/chains/:id` and threw when the
  response had no `rpcUrl`. No consumer used it — every product independently
  reimplemented chain config instead.
  - **Migration**: supply chain configuration yourself. `AccountReader({ rpcUrl })`
    and `ZkapBuilder({ enUrl })` already take the RPC URL directly, and contract
    addresses keep coming from your own config service. There is **no replacement
    type** for `ChainConfig` — model your own. Note that `ChainConfig.contracts`
    carried the key-logic addresses (`zkOAuthVerifier1of1` / `zkOAuthVerifier3of3`);
    those are the `logicContract` values `AccountKeyBuilder` needs, so keep sourcing
    them.
- **`WalletHelper` and type `WalletHelperConfig` removed.** It required a
  `ChainRegistry`, and no consumer used it.
  - **Migration** (sends): `ZkapBuilder` + `BundlerClient` + `Erc4337BundlerProvider`.
    See the rewritten Quick Start in the README.
  - **Migration** (`computeSalt`): use the already-exported `computeSalt` — the
    static method only delegated to it, so this is 1:1.
  - **Migration** (`deriveAddress`): `ZkapCreator.deriveZkapAddress()`. Note this
    method could not have worked: it called a `getAddress(uint256)` selector
    (`0xb93f9b0a`) that `ZkapAccountFactory` does not implement — absent from both
    the ABI and the `deployedBytecode` of the compiled factory artifact this SDK
    ships, and never present in the repository's history. The factory exposes
    `calcAccountAddress(uint256,bytes,bytes)` (`0xfc8737d2`) instead. A ZKAP
    counterfactual address is CREATE2 over init code embedding `encodedMasterKey`
    and `encodedTxKey` — inputs `deriveAddress` never received. Its only test
    coverage mocked `ethers.Contract` outright.
  - **Migration** (reads): the `AccountReader` methods share the names but are
    **not drop-in**. Drop the per-call `chainId` argument and pass it to the
    constructor instead — `new AccountReader({ rpcUrl, chainId })`, which also sets
    ethers' `staticNetwork` and skips the `eth_chainId` probe. `isDeployed`,
    `getBalance` and `getTxKeyList` become single-argument;
    `findTxKeysByRpId(address, chainId, rpIdHash)` becomes
    `findTxKeysByRpId(address, rpIdHash)`, so its second argument changes meaning.
- **`ZkapBundlerProvider` removed.** It called `/api/v1/bundler/submit-direct` and
  `/api/v1/bundler/status/:hash`; ZKAP Server has no bundler controller, so both
  404'd.
  - **Migration**: `Erc4337BundlerProvider({ rpcUrl: <bundler RPC endpoint> })`.
    Note `rpcUrl` here is the **bundler** endpoint, not a JSON-RPC node.
- **`FetchService` union member `"chain_registry"` removed**, since
  `ChainRegistry` was its only producer.
  - **Migration**: only affects code that narrows on `err.service`. The four now
    unused `operation` strings (`get_chain_config`, `get_supported_chains`,
    `parse_chain_config`, `derive_address`) are not a breaking concern —
    `operation` is documented as a free-form string, not a closed catalog.
- **The Hardhat artifact `.json` files no longer ship in `dist`**, and `dist/esm`
  is now genuinely ESM (see Fixed). Every `*ABI` export keeps its exact name and
  type. Only code deep-importing `dist/**/types/abi/*.json` is affected; the
  package's `exports` map has only ever exposed `"."`.

### Fixed

- **`dist/esm/index.js` was unloadable in native Node.** Two defects: no
  `{"type":"module"}` marker for `dist/esm` (so Node classified the output as
  CommonJS and only newer versions rescued it via module-syntax detection), and
  bare `.json` specifiers, which native ESM rejects without an import attribute.
  The build now emits `dist/esm/package.json` and generates ABI modules
  (`scripts/gen-abi.mjs` → `lib/types/abi/generated.ts`) so no runtime JSON
  import remains. `engines.node` is unchanged.
  - Side effect: ~820 KB of unused contract bytecode and metadata no longer ships.
    `dist/lib` 1.5M → 1.1M, `dist/esm` 1.3M → 908K.
- **README documented a receipt field that does not exist.** `UserOpReceipt` is
  flat — the transaction hash is `receipt.txHash`, not
  `result.receipt.transactionHash`. Same bug in `examples/basic-userop`.
- **README nested `poseidonMerkleTreeDirectory` under `contracts`** in the
  `ZkOAuthSigner` sample. `ChainConfig` declared it at the top level, so the
  sample would not have compiled.
- **README documented the ZKAP bundler default as `https://bundler.zkap.app`**
  while the code used `https://api.zkap.app`. Moot with the provider removed.

### Removed

- Dead internal test helpers (`lib/__tests__/helpers/{mocks,fixtures}.ts`) — zero
  inbound references, excluded from both test discovery and coverage, never
  shipped. No consumer impact.

### Changed

- README rewritten around the API consumers actually use: a caller-supplied
  `CHAIN` config object, `ZkapBuilder` + `BundlerClient` +
  `Erc4337BundlerProvider` for sends, `ZkapCreator` for address derivation, and
  `AccountReader` for reads. `examples/basic-userop` rewritten to match, with its
  `chains` command replaced by `info`.
- `exports` conditions reordered so `types` resolves first. Hygiene only —
  TypeScript already fell through a matched-but-failing `import` condition.
  `dist/esm` intentionally ships no `.d.ts`; types always resolve from the CJS
  build.
- CI: the release workflow now verifies `package.json`'s version matches the
  release version before publishing, always builds (previously skippable), and
  asserts both entrypoints actually load. PR CI additionally typechecks test
  files and verifies the generated ABI module is in sync.

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
