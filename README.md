# @baerae-zkap/zkap-aa

[![npm version](https://img.shields.io/npm/v/@baerae-zkap/zkap-aa)](https://www.npmjs.com/package/@baerae-zkap/zkap-aa)
[![CI](https://github.com/baerae-zkap/zkap-aa/actions/workflows/dev-pr-ci.yml/badge.svg)](https://github.com/baerae-zkap/zkap-aa/actions)
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
npm install @baerae-zkap/zkap-aa
```

Requires Node.js >= 18.

## Quick Start

> **Prerequisites:** ZKAP wallets are ERC-4337 smart contract wallets. You need a wallet address before you can send UserOps.
> - **OAuth flow (Google / Kakao):** derive your address with `helper.deriveAddress({ aud, sub, chainId })` — see step 3 below.
> - **EOA flow (testing):** use `ZkapCreator` to deploy a new wallet with a private key as the master key, or contact the team to provision a testnet wallet.
> - The first UserOp sent to a counterfactual address will automatically deploy the wallet on-chain via `initCode`.

### 1. Discover supported chains

```typescript
import { ChainRegistry } from '@baerae-zkap/zkap-aa';

const registry = new ChainRegistry();
const chains = await registry.getSupportedChains();
console.log(chains.map(c => `${c.name} (${c.chainId})`));
```

### 2. Send a transaction (EOA signer)

`WalletHelper.sendTransaction` handles the full UserOp lifecycle in one call:

```typescript
import {
  ChainRegistry,
  BundlerClient,
  ZkapBundlerProvider,
  WalletHelper,
  AddressKeySigner,
} from '@baerae-zkap/zkap-aa';

const CHAIN_ID = 11155111; // use a chainId from getSupportedChains()
const WALLET_ADDRESS = '0xYourZkapWalletAddress';
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const registry = new ChainRegistry();
const bundlerClient = new BundlerClient(new ZkapBundlerProvider());
const helper = new WalletHelper({ chainRegistry: registry, bundlerClient });

const signer = new AddressKeySigner([PRIVATE_KEY]);

const { userOpHash, receipt } = await helper.sendTransaction({
  sender: WALLET_ADDRESS,
  to: '0xRecipientAddress',
  value: '1000000000000000', // 0.001 ETH in wei
  chainId: CHAIN_ID,
  signer,
});

console.log('Submitted:', userOpHash);
const result = await receipt;
console.log('Confirmed in tx:', result.receipt.transactionHash);
```

### 3. Derive a counterfactual wallet address

Before a wallet is deployed, its address is deterministic from the user's identity:

```typescript
const address = await helper.deriveAddress({
  aud: 'your-google-client-id',
  sub: 'user-subject-from-provider',
  chainId: CHAIN_ID,
});
console.log('Wallet address:', address);
```

## Signers

### AddressKeySigner

Signs with one or more EOA private keys. Useful for testing or server-side flows.

```typescript
import { AddressKeySigner } from '@baerae-zkap/zkap-aa';

const signer = new AddressKeySigner([privateKey]);
```

### PasskeySigner

Signs with a WebAuthn credential. Provide a `verifyWithPasskey` callback that calls
`navigator.credentials.get` and returns the assertion response.

```typescript
import { PasskeySigner } from '@baerae-zkap/zkap-aa';

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

### ZkOAuthSigner

Signs using a ZK proof of a Google or Kakao OAuth JWT. The user's identity is never
revealed on-chain — the proof shows they hold a valid token without exposing it.

> Supported providers: `"google"` and `"kakao"` only. Currently `zkapK=1` (single-provider).

```typescript
import { ZkOAuthSigner } from '@baerae-zkap/zkap-aa';

const chainConfig = await registry.getChainConfig(CHAIN_ID);

const signer = new ZkOAuthSigner(
  'https://your-proof-server.example.com', // ZK proof server URL (must be HTTPS)
  chainConfig.rpcUrl,
  walletAddress,
  ['google'],                               // socialServices: one entry per slot
  [async (msgHash) => fetchIdToken()],      // idTokenGenerators: one per provider
  chainConfig.contracts.poseidonMerkleTreeDirectory,
  1,  // zkapK: proof threshold (must be 1)
  1   // zkapN: number of providers
);

// Prepare the ZK proof before signing
await signer.prepareIdToken(msgHash);
```

## WalletHelper API

`WalletHelper` is the recommended high-level interface.

```typescript
const helper = new WalletHelper({ chainRegistry, bundlerClient });
```

| Method | Description |
|--------|-------------|
| `deriveAddress({ aud, sub, chainId })` | Counterfactual address from OAuth identity |
| `sendTransaction({ sender, to, value, data?, signer, chainId })` | Single-call UserOp |
| `sendBatchTransaction({ sender, transactions, signer, chainId })` | Batch UserOp |
| `WalletHelper.computeSalt(aud, sub)` | Raw keccak256 salt for address derivation |

Both send methods return `{ userOpHash: string; receipt: Promise<UserOpReceipt> }`.

## Low-level: ZkapBuilder

For direct control over UserOperation construction:

```typescript
import { ZkapBuilder, BundlerClient, ZkapBundlerProvider } from '@baerae-zkap/zkap-aa';

const chainConfig = await registry.getChainConfig(CHAIN_ID);

const builder = new ZkapBuilder({
  chainId: CHAIN_ID,
  entryPoint: chainConfig.entryPoint,
  enUrl: chainConfig.rpcUrl,
});

builder
  .setSender(walletAddress)
  .setExecuteCallData(to, value, data, signer.keyTypes);

await builder.autoFillUserOp(); // estimates gas, sets nonce

const userOpHash = builder.getUserOpHash();
const signatures = await signer.signUserOpHash(userOpHash);
builder.setSignature([0], signatures);

const packedUserOp = builder.getPackedUserOp();
const bundlerClient = new BundlerClient(new ZkapBundlerProvider());
const submittedHash = await bundlerClient.submitUserOp(packedUserOp, chainConfig.entryPoint);
const receipt = await bundlerClient.waitForReceipt(submittedHash);
```

## Gas Sponsorship (Paymaster)

Pass a `paymaster` config to `ZkapBuilder` to sponsor gas or accept ERC-20 payment:

```typescript
import { ZkapBuilder, PaymasterMode } from '@baerae-zkap/zkap-aa';

const builder = new ZkapBuilder({
  chainId: CHAIN_ID,
  entryPoint: chainConfig.entryPoint,
  enUrl: chainConfig.rpcUrl,
  paymaster: {
    serverUrl: 'https://paymaster.example.com',
    paymasterAddress: '0xPaymasterContractAddress',
    chainId: CHAIN_ID,
    mode: PaymasterMode.VERIFYING, // or PaymasterMode.ERC20
    // tokenAddress: '0x...'       // required for ERC20 mode
  },
});
```

## Chain Registry

`ChainRegistry` fetches contract addresses, RPC URLs, and bundler endpoints from the
ZKAP API (`https://api.zkap.app`). Results are cached for 5 minutes by default.

```typescript
import { ChainRegistry } from '@baerae-zkap/zkap-aa';

// Default API endpoint
const registry = new ChainRegistry();

// Custom API endpoint or cache TTL
const registry = new ChainRegistry({
  apiUrl: 'https://your-api.example.com',
  cacheTtlMs: 60_000,
});

const chainConfig = await registry.getChainConfig(chainId);
// { chainId, name, rpcUrl, entryPoint, zkapFactory, bundlerUrl, contracts }

registry.refresh(); // clear cache and force re-fetch
```

## Bundler Providers

```typescript
import { ZkapBundlerProvider, Erc4337BundlerProvider, BundlerClient } from '@baerae-zkap/zkap-aa';

// ZKAP hosted bundler (default: https://bundler.zkap.app)
const provider = new ZkapBundlerProvider();
const provider = new ZkapBundlerProvider({ baseUrl: 'https://your-bundler.example.com' });

// Any ERC-4337 compatible bundler RPC endpoint
const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com/rpc' });

const bundlerClient = new BundlerClient(provider);
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

[ISC](LICENSE) — © 2026 baerae-zkap
