# @baerae/zkap-aa

[![npm version](https://img.shields.io/npm/v/@baerae/zkap-aa)](https://www.npmjs.com/package/@baerae/zkap-aa)
[![CI](https://github.com/baerae-zkap/zkap-aa-sdk/actions/workflows/dev-pr-ci.yml/badge.svg)](https://github.com/baerae-zkap/zkap-aa-sdk/actions)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

TypeScript SDK for [ZKAP](https://zkap.app) smart wallets — ERC-4337 account abstraction with WebAuthn (Passkey) and ZK-OIDC (Google / Kakao) signing.

## Features

- **Passkey signing** — WebAuthn / FIDO2 credentials, no seed phrases
- **ZK-OIDC signing** — sign with Google or Kakao identity, privacy-preserving via ZK proofs
- **EOA signing** — standard private key / `ethers.Wallet` integration
- **Gas sponsorship** — verifying and ERC-20 paymaster support
- **Batch transactions** — multiple calls in a single UserOperation
- **Dual build** — CommonJS and ESM, works in Node.js and bundlers

## Installation

```bash
npm install @baerae/zkap-aa
```

`ethers` is a peer dependency — install it alongside:

```bash
npm install ethers
```

Requires Node.js >= 18.

## Quick Start

> **Prerequisites:** ZKAP wallets are ERC-4337 smart contract wallets, so before sending UserOps you need three things the SDK does not discover for you:
> - **Chain config** — an RPC URL, a bundler RPC URL, the EntryPoint address, and (only when deriving or deploying a wallet) the ZkapAccountFactory and key-logic addresses. Keep these in your own config table; see step 1.
> - **A wallet address** — an already-deployed wallet, or a counterfactual address derived with `ZkapCreator` (step 3).
> - **A signer** whose key type matches a key registered on that wallet.
>
> The first UserOp sent from a counterfactual address deploys the wallet on-chain via `initCode` — that is what `ZkapCreator` sets up.

### 1. Configure your chain

The SDK never fetches configuration — you pass addresses and endpoints in. Keep one entry per chain in your app; every sample below reads from this `CHAIN` object.

```typescript
const CHAIN = {
  chainId: 11155111,                     // Ethereum Sepolia
  rpcUrl: process.env.RPC_URL!,           // JSON-RPC node — gas estimation, nonce reads
  bundlerUrl: process.env.BUNDLER_URL!,   // ERC-4337 bundler RPC (Pimlico, Alchemy, alto, ...)
  entryPoint: '0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108', // EntryPoint v0.8

  // Only needed by the features that use them:
  zkapFactory: process.env.ZKAP_FACTORY!,               // deriving / deploying a wallet
  addressKeyLogic: process.env.ADDRESS_KEY_LOGIC!,      // building an EOA master key
  poseidonMerkleTreeDirectory: process.env.MERKLE_DIR!, // AccountKeyBuilder (zk key)
};
```

> `rpcUrl` and `bundlerUrl` are **different endpoints**. `Erc4337BundlerProvider` takes the bundler one.

This is the subset the samples below use. A production integration also needs a logic-contract address per key type it registers — `addressKeyLogic` for EOA keys, and the zkOAuth verifier or WebAuthn implementation address for those key types.

### 2. Send a transaction (EOA signer)

`ZkapBuilder` builds and signs the UserOperation; `BundlerClient` submits it and waits for the receipt.

```typescript
import {
  ZkapBuilder,
  BundlerClient,
  Erc4337BundlerProvider,
  AddressKeySigner,
} from '@baerae/zkap-aa';

const WALLET_ADDRESS = '0xYourZkapWalletAddress';
const signer = new AddressKeySigner([process.env.PRIVATE_KEY!]);

const builder = new ZkapBuilder({
  chainId: CHAIN.chainId,
  entryPoint: CHAIN.entryPoint,
  enUrl: CHAIN.rpcUrl,
});

builder
  .setSender(WALLET_ADDRESS)
  .setExecuteCallData(
    '0xRecipientAddress',
    '1000000000000000', // 0.001 ETH in wei
    '0x',               // calldata — '0x' for a plain transfer
    signer.keyTypes,    // which on-chain key verifies this op
  );

await builder.autoFillUserOp(); // nonce, gas limits and fee fields, from CHAIN.rpcUrl

// Trim preVerificationGas to what the bundler actually requires. Must run before
// getUserOpHash() — see "preVerificationGas calibration" below.
builder.applyBundlerPreVerificationGas();

const userOpHash = builder.getUserOpHash();
const signatures = await signer.signUserOpHash(userOpHash);
builder.setSignature(signer.keyTypes.map((_, i) => i), signatures);

const bundlerClient = new BundlerClient(
  new Erc4337BundlerProvider({
    rpcUrl: CHAIN.bundlerUrl,  // the BUNDLER endpoint, not CHAIN.rpcUrl
    usePimlicoFormat: true,    // Pimlico / alto want the unpacked factory+factoryData shape
  }),
);

const submittedHash = await bundlerClient.submitUserOp(
  builder.getPackedUserOp(),
  CHAIN.entryPoint,
);
console.log('Submitted:', submittedHash);

const receipt = await bundlerClient.waitForReceipt(submittedHash);
console.log('Confirmed in tx:', receipt.txHash, '— success:', receipt.success);
```

`waitForReceipt` returns a flat `UserOpReceipt` (`txHash`, `blockNumber`, `success`, `actualGasCost`, `actualGasUsed`, plus `revertReason` / `contractError` on an execution revert).

### 3. Derive a counterfactual wallet address

A ZKAP address is `CREATE2(salt, encodedMasterKey, encodedTxKey)` — it depends on the key material the wallet will be **deployed** with, not on the identity alone. Derive it from exactly the inputs you will deploy with, or you will fund an address the deploy never targets.

```typescript
import { computeSalt, ZkapCreator, AccountKeyBuilder, PrimitiveAccountKeyTypes } from '@baerae/zkap-aa';
import { ethers } from 'ethers';

// keccak256(abi.encode(aud, sub)). Pass a walletIndex of 1-255 to derive additional
// independent wallets for the same identity; 0 and omitted both mean the default wallet.
const salt = computeSalt(aud, sub);

// For a wallet controlled by an EOA:
const encodedMasterKey = new AccountKeyBuilder(1, [
  {
    keyType: PrimitiveAccountKeyTypes.keyAddress,
    logicContract: CHAIN.addressKeyLogic, // on-chain verifier for keyAddress
    weight: 1,
    keyData: { signerAddress: new ethers.Wallet(process.env.PRIVATE_KEY!).address },
  },
]).getEncodedKey();

const creator = new ZkapCreator({
  chainId: CHAIN.chainId,
  entryPoint: CHAIN.entryPoint,
  zkapFactory: CHAIN.zkapFactory,
  enUrl: CHAIN.rpcUrl,
  salt,
  encodedMasterKey,
  encodedTxKey: '0x', // '0x' when the wallet has no separate transaction key at deploy
});

const address = await creator.deriveZkapAddress(); // factory.calcAccountAddress eth_call
```

`ZkapCreator` extends `ZkapBuilder`, and `deriveZkapAddress()` has already set both `initCode` and `sender` — so the same instance sends the wallet's first UserOp, and that op deploys it. Use `ZkapCreator` for the first op and plain `ZkapBuilder` after that.

## Signers

### AddressKeySigner

Signs with one or more EOA private keys. Useful for testing or server-side flows.

```typescript
import { AddressKeySigner } from '@baerae/zkap-aa';

const signer = new AddressKeySigner([privateKey]);
```

### PasskeySigner

Signs with a WebAuthn credential. Provide a `verifyWithPasskey` callback that calls
`navigator.credentials.get` and returns the assertion response.

```typescript
import { PasskeySigner } from '@baerae/zkap-aa';

const signer = new PasskeySigner(
  credentialId,
  async (credentialId, challenge) => {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: Buffer.from(challenge, 'base64url'),
        allowCredentials: [{ type: 'public-key', id: Buffer.from(credentialId, 'base64url') }],
        userVerification: 'required',
      },
    }) as PublicKeyCredential;

    const response = assertion.response as AuthenticatorAssertionResponse;
    return {
      response: {
        signature: Buffer.from(response.signature).toString('base64url'),
        authenticatorData: Buffer.from(response.authenticatorData).toString('base64url'),
        clientDataJSON: Buffer.from(response.clientDataJSON).toString('base64url'),
      },
    };
  }
);
```

### ZkOidcSigner

Signs with a ZK proof of an OIDC id_token. The user's identity is never revealed
on-chain — the proof shows they hold a valid token without exposing it.

This signer performs **no network calls and never touches an id_token**. It takes
a finished proof and encodes it into the UserOperation signature. Producing that
proof — collecting the logins, fetching JWKS, running the circuit — is the job of
whatever backend you operate; the raw id_token must never reach the client.

```typescript
import { ZkOidcSigner } from '@baerae/zkap-aa';

const signer = new ZkOidcSigner();

signer.setProofData({
  // uint256[6]: hanchor, h_ctx, root, h_sign_userop, lhs, h_aud_list
  sharedInputs,
  // K entries each, one per proof
  jwtExpList,
  partialRhsList,
  // K x 8 Groth16 proofs
  proofs,
});

// signUserOpHash re-checks the binding itself:
//   sharedInputs[3] === userOpHash mod SNARK_SCALAR_FIELD
// so a proof cannot be replayed against a different UserOperation.
const signature = await signer.signUserOpHash(userOpHash);

// Drop the proof once used — it is single-use material.
signer.destroy();
```

All values are decimal strings and are range-checked against the BN254 scalar
field; a malformed proof throws `AaOperationError` with
`SIGNER_PROOF_INVALID` rather than producing an unusable signature.

## Batch transactions

`setExecuteBatchCallData` puts several calls into one UserOperation. Everything else — `autoFillUserOp`, PVG calibration, signing, submission — is identical to Quick Start step 2.

```typescript
builder
  .setSender(WALLET_ADDRESS)
  .setExecuteBatchCallData(
    [tokenAddress, recipient],  // to
    ['0', '1000000000000000'],  // value, in wei
    [approveCallData, '0x'],    // data
    signer.keyTypes,
  );
```

All three arrays must be the same length and in the same order — the calls execute sequentially, and a revert in any one reverts the whole UserOperation.

## preVerificationGas calibration

`autoFillUserOp()` leaves a conservative `preVerificationGas`. EntryPoint charges PVG in FULL — anything declared above the bundler's floor is paid and never refunded, and anything below it is rejected at submission — so `applyBundlerPreVerificationGas()` sets what the bundler actually requires plus a margin (default `x1.10 + 15,000`).

```typescript
await builder.autoFillUserOp();

// ORDER MATTERS:
//  1. after autoFillUserOp() — nonce / initCode / callData / signature must be final;
//  2. after the final callGasLimit — the EIP-7623 branch reads it;
//  3. BEFORE getUserOpHash() — preVerificationGas is part of the hash.
builder.applyBundlerPreVerificationGas();

const userOpHash = builder.getUserOpHash(); // safe to sign now
```

The signature present when you call it must already have the byte length of the REAL signature — that is what the dummy signature `autoFillUserOp()` installs is for. The bundler recomputes its floor from the bytes you submit, so a length that changes between calibration and submission invalidates the result.

> **Not compatible with a builder-configured paymaster.** When `paymaster` is set on `ZkapBuilder`, `autoFillUserOp()` performs the paymaster handoff itself and the paymaster signs a digest that includes `preVerificationGas`. Changing PVG afterwards invalidates that signature. Use a conservative multiplier on paymaster-sponsored ops instead.

Calibrated against Pimlico alto's **execution** component only. On chains where alto adds an L2 data-availability component (`op-stack`, `arbitrum`, `mantle`, `etherlink`, `citrea`, `monad`) supply it explicitly, or keep a conservative multiplier:

```typescript
builder.applyBundlerPreVerificationGas({ extraComponent: 40_000n });
```

Other options: `marginPercent` (default `110n`) and `marginAbsolute` (default `15000n`). The underlying functions are exported for direct use — `calcAltoRequiredPvg(userOp, opts)` and `calibrateBundlerPvg(userOp, opts)`.

## Gas Sponsorship (Paymaster)

Pass a `paymaster` config to `ZkapBuilder` to sponsor gas or accept ERC-20 payment:

```typescript
import { ZkapBuilder, PaymasterMode } from '@baerae/zkap-aa';

const builder = new ZkapBuilder({
  chainId: CHAIN.chainId,
  entryPoint: CHAIN.entryPoint,
  enUrl: CHAIN.rpcUrl,
  paymaster: {
    serverUrl: 'https://paymaster.example.com',
    paymasterAddress: '0xPaymasterContractAddress',
    chainId: CHAIN.chainId,
    mode: PaymasterMode.VERIFYING, // or PaymasterMode.ERC20
    // tokenAddress: '0x...'       // required for ERC20 mode
  },
});
```

`autoFillUserOp()` fetches and installs the paymaster signature itself when this config is present — do not call `applyBundlerPreVerificationGas()` on a sponsored op (see above).

## Reading account state

`AccountReader` reads a deployed ZkapAccount over plain JSON-RPC — no bundler, no server.

```typescript
import { AccountReader } from '@baerae/zkap-aa';

const reader = new AccountReader({ rpcUrl: CHAIN.rpcUrl, chainId: CHAIN.chainId });

await reader.isDeployed(WALLET_ADDRESS);   // false for a counterfactual address
await reader.getBalance(WALLET_ADDRESS);   // native balance in wei, as a string
await reader.getTxKeyList(WALLET_ADDRESS); // registered txKey slots
await reader.getMasterKeyInfo(WALLET_ADDRESS);

// WebAuthn keys registered for one relying party (rpIdHash = SHA-256 of the rpId)
await reader.findTxKeysByRpId(WALLET_ADDRESS, rpIdHash);
```

Passing `chainId` to the constructor is optional but worth it — it sets ethers' `staticNetwork` and skips the `eth_chainId` probe.

Note the asymmetry on an **undeployed** account: `getTxKeyList` returns `[]` rather than throwing, while `getMasterKeyInfo` throws `AaFetchError`. Call `isDeployed()` first if you need to tell "no keys" apart from "no wallet".

## Bundler Providers

```typescript
import { Erc4337BundlerProvider, BundlerClient } from '@baerae/zkap-aa';

// Any ERC-4337 JSON-RPC bundler (Pimlico, Alchemy, Stackup, self-hosted alto).
const provider = new Erc4337BundlerProvider({ rpcUrl: CHAIN.bundlerUrl });

// Pimlico / alto expect the unpacked v0.7+ shape — factory + factoryData instead of
// initCode, and individual gas fields instead of packed bytes32 values.
const pimlico = new Erc4337BundlerProvider({
  rpcUrl: 'https://public.pimlico.io/v2/11155111/rpc',
  usePimlicoFormat: true,
});

const bundlerClient = new BundlerClient(provider);
```

`Erc4337BundlerProvider` additionally exposes `estimateUserOpGas(packedUserOp, entryPoint)` for bundlers that implement `eth_estimateUserOperationGas`. It is not part of the `BundlerProvider` interface, so call it on the provider directly.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

[ISC](LICENSE) — © 2026 baerae-zkap
