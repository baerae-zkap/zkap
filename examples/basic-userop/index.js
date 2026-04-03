/**
 * basic-userop: send a UserOperation from a ZKAP smart wallet
 *
 * Usage:
 *   node index.js chains          — list supported chains
 *   node index.js send            — send a UserOp (reads .env)
 *   node index.js derive          — print counterfactual wallet address
 *
 * Requires: cp .env.example .env && fill in values
 */

const path = require('path');
require('fs').existsSync(path.join(__dirname, '.env')) &&
  require('fs').readFileSync(path.join(__dirname, '.env'), 'utf8')
    .split('\n')
    .forEach(line => {
      const [k, ...v] = line.replace(/#.*/, '').trim().split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    });

const {
  ChainRegistry,
  BundlerClient,
  ZkapBundlerProvider,
  WalletHelper,
  AddressKeySigner,
} = require('@baerae-zkap/zkap');

const registry = new ChainRegistry();
const bundlerClient = new BundlerClient(new ZkapBundlerProvider());
const helper = new WalletHelper({ chainRegistry: registry, bundlerClient });

async function listChains() {
  const chains = await registry.getSupportedChains();
  if (chains.length === 0) {
    console.log('No supported chains found.');
    return;
  }
  console.log('Supported chains:');
  chains.forEach(c => console.log(`  ${c.chainId.toString().padEnd(10)} ${c.name}`));
}

async function deriveAddress() {
  const { WALLET_ADDRESS, CHAIN_ID } = process.env;
  if (!CHAIN_ID) throw new Error('CHAIN_ID not set in .env');

  // Derive address from AUD + SUB (requires OAuth identity).
  // If you already have a deployed wallet, skip this and use WALLET_ADDRESS directly.
  console.log('Tip: set AUD and SUB in .env to derive address from OAuth identity.');
  console.log('     For now, your deployed wallet is:', WALLET_ADDRESS || '(not set)');
}

async function send() {
  const {
    PRIVATE_KEY,
    WALLET_ADDRESS,
    CHAIN_ID,
    TO_ADDRESS,
    VALUE_WEI = '0',
  } = process.env;

  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY not set in .env');
  if (!WALLET_ADDRESS) throw new Error('WALLET_ADDRESS not set in .env');
  if (!CHAIN_ID) throw new Error('CHAIN_ID not set in .env');
  if (!TO_ADDRESS) throw new Error('TO_ADDRESS not set in .env');

  const chainId = Number(CHAIN_ID);
  const signer = new AddressKeySigner([PRIVATE_KEY]);

  console.log(`Sending UserOp on chain ${chainId}...`);
  console.log(`  from: ${WALLET_ADDRESS}`);
  console.log(`  to:   ${TO_ADDRESS}`);
  console.log(`  value: ${VALUE_WEI} wei`);

  const { userOpHash, receipt } = await helper.sendTransaction({
    sender: WALLET_ADDRESS,
    to: TO_ADDRESS,
    value: VALUE_WEI,
    chainId,
    signer,
  });

  console.log('\nSubmitted UserOpHash:', userOpHash);
  console.log('Waiting for on-chain confirmation...');

  const result = await receipt;
  console.log('Confirmed!');
  console.log('  tx hash:', result.receipt.transactionHash);
  console.log('  block:  ', result.receipt.blockNumber);
}

const command = process.argv[2] || 'help';

const commands = { chains: listChains, send, derive: deriveAddress };

if (commands[command]) {
  commands[command]().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
} else {
  console.log('Usage: node index.js <chains|send|derive>');
}
