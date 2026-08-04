# basic-userop example

Sends a UserOperation from a deployed ZKAP smart wallet using an EOA private key.

## Setup

```bash
# In this directory: install example deps
cd examples/basic-userop
npm install

# Copy env file and fill in values
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|----------|-------------|
| `CHAIN_ID` | Chain ID of the target network |
| `RPC_URL` | JSON-RPC node endpoint — gas estimation and nonce reads |
| `BUNDLER_URL` | ERC-4337 bundler RPC endpoint (`send` only) — a different service from `RPC_URL` |
| `ENTRY_POINT` | EntryPoint contract address (v0.8) |
| `WALLET_ADDRESS` | Your ZKAP smart wallet address |
| `PRIVATE_KEY` | Private key registered on that wallet (testnet only) |
| `TO_ADDRESS` | Recipient address for the test transfer |
| `VALUE_WEI` | Amount in wei (default `0` — safe for dry-run) |
| `FACTORY_ADDRESS` | ZkapAccountFactory address (`derive` only) |
| `ADDRESS_KEY_LOGIC` | keyAddress verifier logic contract (`derive` only) |
| `AUD` / `SUB` | OAuth audience and subject (`derive` only) |

There is no chain registry — the SDK does not fetch any of this. Get the contract
addresses for your target chain from the team.

## Run

```bash
# Print the chain config and the wallet's on-chain state
node index.js info

# Print the counterfactual wallet address for AUD + SUB
node index.js derive

# Send a UserOp
node index.js send
```

## What it does

1. Reads chain configuration from `.env` — no registry lookup
2. Builds a `UserOperation` with `ZkapBuilder` (`setExecuteCallData` → `autoFillUserOp`)
3. Calibrates `preVerificationGas` to the bundler's floor via `applyBundlerPreVerificationGas()`
4. Signs it with `AddressKeySigner` (EOA private key)
5. Submits via `Erc4337BundlerProvider` + `BundlerClient` and waits for confirmation

## Notes

- `send` requires an already-**deployed** ZKAP wallet: `autoFillUserOp()` estimates
  `callGasLimit` on-chain, which is impossible before deployment. `derive` prints the
  counterfactual address; deploying it needs a `ZkapCreator`-built first UserOp.
- `VALUE_WEI=0` sends a zero-value call — useful for testing without needing testnet ETH.
- Never use a mainnet private key in `.env`. Use a dedicated testnet account.
