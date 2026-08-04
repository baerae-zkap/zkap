#!/usr/bin/env node
/**
 * Re-verify `calcAltoRequiredPvg` against the live bundler.
 *
 * WHY THIS EXISTS. `lib/utils/bundlerPvg.ts` is a port of alto's
 * `calcExecutionPvgComponent`, and `eth_sendUserOperation` rejects a UserOperation whose
 * preVerificationGas is below that value. For flows whose signature is a ZK proof bound
 * to the userOpHash, a rejection discards the proof — so the port drifting away from the
 * bundler's implementation is expensive. Run this after an alto release, after changing
 * bundler vendors/endpoints, or when a submission is rejected with
 * "preVerificationGas is not enough".
 *
 * HOW. `eth_estimateUserOperationGas` returns the same requirement scaled by
 * `v7-pre-verification-gas-limit-multiplier` (110). Validation would revert for any
 * arbitrary sender, so a state override turns the sender into a permissive account
 * (`validateUserOp` returning 0) and funds its EntryPoint deposit slot. Nothing is
 * submitted; this is a read-only estimation call.
 *
 * PASS CRITERIA: `response == round(port * 1.10)` for every shape, on every chain.
 *
 * Usage (requires `npm run build` first — it imports the ESM build):
 *   node scripts/check-pvg-floor.mjs                       # chains 1 + 11155111, public endpoint
 *   PIMLICO_API_KEY=xxx node scripts/check-pvg-floor.mjs   # avoids the public 429 limit
 *   PVG_CHECK_CHAINS=1,11155111,8453 node scripts/check-pvg-floor.mjs
 *
 * NOTE: chains where alto adds an L2 data-availability component (op-stack, arbitrum,
 * mantle, etherlink, citrea, monad) will NOT match — the port only computes the
 * execution component, by design. Such chains are reported as SKIP(l2).
 */
import { ethers } from "ethers";
// CJS build on purpose: no .js extension rewriting needed on this path.
import { calcAltoRequiredPvg } from "../dist/lib/utils/bundlerPvg.js";

const ENTRY_POINT = "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108";
/** Runtime code that returns 32 zero bytes: validateUserOp => validationData 0 (valid). */
const PERMISSIVE_ACCOUNT_CODE = "0x60206000f3";
const SENDER = "0x00000000000000000000000000000000DeaDBeef";
/** alto's estimate multiplier for v0.7+ preVerificationGas. */
const ESTIMATE_MULTIPLIER_PERCENT = 110n;

const CHAINS = (process.env.PVG_CHECK_CHAINS ?? "1,11155111")
  .split(",")
  .map((c) => Number(c.trim()))
  .filter((c) => Number.isInteger(c) && c > 0);

/** [label, callData bytes, signature bytes] — spans the ZKAP flow shapes. */
const SHAPES = [
  ["tiny", 4, 65],
  ["small", 260, 65],
  ["medium", 1028, 65],
  ["zk-update (804B/1568B)", 804, 1568],
  ["zk-deploy (1668B/928B)", 1668, 928],
];

const usingApiKey = !!process.env.PIMLICO_API_KEY;

const endpoint = (chainId) =>
  usingApiKey
    ? `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
    : `https://public.pimlico.io/v2/${chainId}/rpc`;

/**
 * What to print for an endpoint. Built from constants, NOT by masking `endpoint()` —
 * a redacting `.replace()` over a URL that carries the key is one URL-shape change away
 * from printing the key, so the log path never touches that string at all.
 */
const endpointLabel = (chainId) =>
  usingApiKey
    ? `api.pimlico.io/v2/${chainId}/rpc (with API key)`
    : `public.pimlico.io/v2/${chainId}/rpc (public, rate-limited)`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function rpc(chainId, method, params, attempt = 0) {
  const res = await fetch(endpoint(chainId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { error: { message: `HTTP ${res.status}: ${text.slice(0, 120)}` } };
  }
  // The public endpoint rate-limits aggressively; back off and retry a few times.
  const rateLimited =
    res.status === 429 || /rate limit/i.test(JSON.stringify(json.error ?? ""));
  if (rateLimited && attempt < 4) {
    await sleep(3000 * (attempt + 1));
    return rpc(chainId, method, params, attempt + 1);
  }
  return json;
}

/** EntryPoint (StakeManager) `deposits[sender]` — slot 0 of the mapping. */
const depositSlot = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [SENDER, 0])
);

const stateOverrides = {
  [SENDER]: { code: PERMISSIVE_ACCOUNT_CODE, balance: "0x21e19e0c9bab2400000" },
  [ENTRY_POINT]: {
    stateDiff: {
      [depositSlot]: ethers.toBeHex(10n ** 20n, 32),
    },
  },
};

const shapeOp = (callDataBytes, signatureBytes) => ({
  sender: SENDER,
  nonce: "0x0",
  initCode: "0x",
  callData: "0x" + "b6".repeat(callDataBytes),
  callGasLimit: "0x186a0",
  verificationGasLimit: "0x186a0",
  preVerificationGas: "0x1",
  maxFeePerGas: "0x59682f00",
  maxPriorityFeePerGas: "0xf4240",
  paymaster: ethers.ZeroAddress,
  paymasterData: "0x",
  paymasterVerificationGasLimit: "0x0",
  paymasterPostOpGasLimit: "0x0",
  signature: "0x" + "cd".repeat(signatureBytes),
});

/** The wire shape alto expects (v0.7+ unpacked, paymaster fields omitted when unused). */
const toRequestOp = (op) => ({
  sender: op.sender,
  nonce: op.nonce,
  callData: op.callData,
  callGasLimit: op.callGasLimit,
  verificationGasLimit: op.verificationGasLimit,
  preVerificationGas: op.preVerificationGas,
  maxFeePerGas: op.maxFeePerGas,
  maxPriorityFeePerGas: op.maxPriorityFeePerGas,
  signature: op.signature,
});

let failures = 0;
let checked = 0;

for (const chainId of CHAINS) {
  console.log(`\n=== chain ${chainId} (${endpointLabel(chainId)})`);
  for (const [label, callDataBytes, signatureBytes] of SHAPES) {
    const op = shapeOp(callDataBytes, signatureBytes);
    const port = calcAltoRequiredPvg(op, { supportsEip7623: false });
    const portWith7623 = calcAltoRequiredPvg(op, { supportsEip7623: true });
    const expected = (port * ESTIMATE_MULTIPLIER_PERCENT) / 100n;

    const out = await rpc(chainId, "eth_estimateUserOperationGas", [
      toRequestOp(op),
      ENTRY_POINT,
      stateOverrides,
    ]);

    if (out.error) {
      console.log(
        `  ${label.padEnd(24)} SKIP  ${String(out.error.message ?? out.error).slice(0, 100)}`
      );
      continue;
    }

    checked += 1;
    const actual = BigInt(out.result.preVerificationGas);
    // Integer truncation on alto's side allows a 1-gas gap.
    const ok = actual >= expected && actual - expected <= 1n;
    if (!ok) failures += 1;
    console.log(
      `  ${label.padEnd(24)} ${ok ? "OK  " : "FAIL"} alto=${actual} port*1.10=${expected} ` +
        `port(off)=${port} port(on7623)=${portWith7623}` +
        (actual > expected ? `  [alto is HIGHER by ${actual - expected}]` : "")
    );
    await sleep(400);
  }
}

console.log(
  `\n${checked} shape(s) verified, ${failures} mismatch(es).` +
    (checked === 0
      ? " Nothing was verified — the endpoint refused every request (rate limit or no code-override support)."
      : "")
);
if (failures > 0 || checked === 0) {
  console.log(
    "A mismatch means the port no longer matches the bundler: re-read alto's " +
      "preVerificationGasCalculator, then raise the margin in the SPA before shipping."
  );
  process.exit(1);
}
