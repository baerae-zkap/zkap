/**
 * basic-userop: send a UserOperation from a ZKAP smart wallet
 *
 * Usage:
 *   node index.js info     — print chain config and wallet state
 *   node index.js derive   — print the counterfactual wallet address
 *   node index.js send     — send a UserOp (reads .env)
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

const { ethers } = require('ethers');
const {
  ZkapBuilder,
  ZkapCreator,
  AccountKeyBuilder,
  AccountReader,
  BundlerClient,
  Erc4337BundlerProvider,
  AddressKeySigner,
  PrimitiveAccountKeyTypes,
  computeSalt,
} = require('@baerae/zkap-aa');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not set in .env`);
  return value;
}

// There is no chain registry — you supply the config. Every command reads from here.
function loadChain() {
  return {
    chainId: Number(requireEnv('CHAIN_ID')),
    rpcUrl: requireEnv('RPC_URL'),
    entryPoint: requireEnv('ENTRY_POINT'),
    bundlerUrl: process.env.BUNDLER_URL,
    zkapFactory: process.env.FACTORY_ADDRESS,
    addressKeyLogic: process.env.ADDRESS_KEY_LOGIC,
  };
}

async function info() {
  const chain = loadChain();
  const wallet = requireEnv('WALLET_ADDRESS');

  console.log('Chain config (from .env):');
  console.log(`  chainId:     ${chain.chainId}`);
  console.log(`  rpcUrl:      ${chain.rpcUrl}`);
  console.log(`  entryPoint:  ${chain.entryPoint}`);
  console.log(`  bundlerUrl:  ${chain.bundlerUrl || '(not set)'}`);
  console.log(`  zkapFactory: ${chain.zkapFactory || '(not set)'}`);

  const reader = new AccountReader({ rpcUrl: chain.rpcUrl, chainId: chain.chainId });
  const deployed = await reader.isDeployed(wallet);
  const balance = await reader.getBalance(wallet);

  console.log(`\nWallet ${wallet}`);
  console.log(`  deployed: ${deployed}`);
  console.log(`  balance:  ${ethers.formatEther(balance)} ETH`);

  // getTxKeyList returns [] for an undeployed account rather than throwing, so
  // check isDeployed first — otherwise "0 keys" also means "wrong RPC_URL".
  if (!deployed) {
    console.log('  txKeys:   not deployed — no key slots yet');
    return;
  }

  const txKeys = await reader.getTxKeyList(wallet);
  console.log(`  txKeys:   ${txKeys.length}`);
  txKeys.forEach(k => console.log(`    [${k.index}] ${k.keyType} @ ${k.logicContract}`));
}

async function derive() {
  const chain = loadChain();
  if (!chain.zkapFactory) throw new Error('FACTORY_ADDRESS not set in .env');
  if (!chain.addressKeyLogic) throw new Error('ADDRESS_KEY_LOGIC not set in .env');

  const aud = requireEnv('AUD');
  const sub = requireEnv('SUB');
  const privateKey = requireEnv('PRIVATE_KEY');

  // A ZKAP address is CREATE2(salt, encodedMasterKey, encodedTxKey) — it depends on
  // the key material the wallet will be DEPLOYED with, not on (aud, sub) alone.
  // Derive with exactly the inputs you will deploy with, or you fund an address the
  // deploy never targets.
  const salt = computeSalt(aud, sub);

  const signerAddress = new ethers.Wallet(privateKey).address;
  const encodedMasterKey = new AccountKeyBuilder(1, [
    {
      keyType: PrimitiveAccountKeyTypes.keyAddress,
      logicContract: chain.addressKeyLogic,
      weight: 1,
      keyData: { signerAddress },
    },
  ]).getEncodedKey();

  const creator = new ZkapCreator({
    chainId: chain.chainId,
    entryPoint: chain.entryPoint,
    zkapFactory: chain.zkapFactory,
    enUrl: chain.rpcUrl,
    salt,
    encodedMasterKey,
    encodedTxKey: '0x', // no separate transaction key on this wallet
  });

  const address = await creator.deriveZkapAddress();

  console.log('salt:             ', salt);
  console.log('master key signer:', signerAddress);
  console.log('wallet address:   ', address);
  console.log('\nSet WALLET_ADDRESS to this value in .env.');
  console.log('The wallet is not deployed yet — its first UserOp must carry initCode,');
  console.log('which this ZkapCreator instance already has set. `send` below assumes an');
  console.log('already-deployed wallet.');
}

async function send() {
  const chain = loadChain();
  if (!chain.bundlerUrl) throw new Error('BUNDLER_URL not set in .env');

  const privateKey = requireEnv('PRIVATE_KEY');
  const sender = requireEnv('WALLET_ADDRESS');
  const to = requireEnv('TO_ADDRESS');
  const value = process.env.VALUE_WEI || '0';

  const signer = new AddressKeySigner([privateKey]);

  console.log(`Sending UserOp on chain ${chain.chainId}...`);
  console.log(`  from:  ${sender}`);
  console.log(`  to:    ${to}`);
  console.log(`  value: ${value} wei`);

  const builder = new ZkapBuilder({
    chainId: chain.chainId,
    entryPoint: chain.entryPoint,
    enUrl: chain.rpcUrl,
  });

  builder
    .setSender(sender)
    .setExecuteCallData(to, value, '0x', signer.keyTypes);

  // Fills nonce, gas limits and fee fields from the RPC endpoint.
  await builder.autoFillUserOp();

  // Trim preVerificationGas to the bundler's real floor (+ margin). Must run after
  // autoFillUserOp() and before getUserOpHash() — PVG is part of the hash.
  builder.applyBundlerPreVerificationGas();

  const userOpHash = builder.getUserOpHash();
  const signatures = await signer.signUserOpHash(userOpHash);
  builder.setSignature(signer.keyTypes.map((_, i) => i), signatures);

  // The BUNDLER endpoint, not RPC_URL — these are different services.
  const bundlerClient = new BundlerClient(
    new Erc4337BundlerProvider({ rpcUrl: chain.bundlerUrl, usePimlicoFormat: true })
  );

  const submittedHash = await bundlerClient.submitUserOp(
    builder.getPackedUserOp(),
    chain.entryPoint
  );

  console.log('\nSubmitted UserOpHash:', submittedHash);
  console.log('Waiting for on-chain confirmation...');

  const receipt = await bundlerClient.waitForReceipt(submittedHash);
  console.log(receipt.success ? 'Confirmed!' : 'Included, but execution reverted.');
  console.log('  tx hash: ', receipt.txHash);
  console.log('  block:   ', receipt.blockNumber);
  console.log('  gas cost:', receipt.actualGasCost, 'wei');
  if (!receipt.success) {
    console.log('  revert:  ', receipt.contractError?.name || receipt.revertReason || '(unknown)');
  }
}

const command = process.argv[2] || 'help';

const commands = { info, derive, send };

if (commands[command]) {
  commands[command]().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
} else {
  console.log('Usage: node index.js <info|derive|send>');
}
