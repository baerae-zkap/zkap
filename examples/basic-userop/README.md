# basic-userop example

Sends a UserOperation from a deployed ZKAP smart wallet using an EOA private key.

## Setup

```bash
# From repo root: install SDK
npm install

npm run build

# In this directory: install example deps
cd examples/basic-userop
npm install

# Copy env file and fill in values
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|----------|-------------|
| `CHAIN_ID` | Chain ID (run `node index.js chains` to list options) |
| `WALLET_ADDRESS` | Your deployed ZKAP smart wallet address |
| `PRIVATE_KEY` | Private key registered on that wallet (testnet only) |
| `TO_ADDRESS` | Recipient address for the test transfer |
| `VALUE_WEI` | Amount in wei (default `0` — safe for dry-run) |

## Run

```bash
# List supported chains and their chain IDs
node index.js chains

# Send a UserOp
node index.js send
```

## What it does

1. Reads chain configuration from the ZKAP API (`ChainRegistry`)
2. Builds a `UserOperation` via `WalletHelper.sendTransaction`
3. Signs it with `AddressKeySigner` (EOA private key)
4. Submits via the ZKAP bundler and waits for on-chain confirmation

## Notes

- This example requires a **deployed** ZKAP wallet. If your wallet isn't deployed yet, the first UserOp will include `initCode` to deploy it.
- `VALUE_WEI=0` sends a zero-value call — useful for testing without needing testnet ETH.
- Never use a mainnet private key in `.env`. Use a dedicated testnet account.
