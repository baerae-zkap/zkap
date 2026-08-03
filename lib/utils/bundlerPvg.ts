import { ethers } from "ethers";
import { UserOperation } from "../types/UserOperation";

/**
 * `preVerificationGas` (PVG) calibration against the bundler's own requirement.
 *
 * WHY. PVG is the one gas field EntryPoint charges in FULL — `preOpGas` is
 * `measuredValidationGas + preVerificationGas`, so every unit declared above what
 * the bundler demands is paid and never refunded. Bundlers, in turn, reject a
 * UserOperation whose PVG is below their own floor. Guessing high (the historical
 * `estimate x 4`) is therefore a direct, permanent overpayment; guessing low costs
 * a submission.
 *
 * WHAT THIS IS. A faithful port of Pimlico alto's `calcExecutionPvgComponent`
 * (`alto/src/rpc/estimation/preVerificationGasCalculator.ts`), which is exactly the
 * value `eth_sendUserOperation` compares against:
 *
 *     requiredPvg = calcExecutionPvgComponent(userOp) + calcL2PvgComponent(userOp)
 *
 * `eth_estimateUserOperationGas` returns that same sum scaled by
 * `v7-pre-verification-gas-limit-multiplier` (default 110), which is how the port was
 * verified: for five op shapes on chain 1 and 11155111 the live endpoint returned
 * exactly `calcAltoRequiredPvg(...) * 1.10`.
 *
 * SCOPE / LIMITS.
 * - Only the EXECUTION component is computed. Chains alto classifies as `op-stack`,
 *   `arbitrum`, `mantle`, `etherlink`, `citrea` or `monad` add an L2 data-availability
 *   component that cannot be derived offline — on those chains do NOT use this value
 *   alone (pass the L2 part via `extraComponent`, or keep a conservative multiplier).
 *   Verified `chainType=default` (L2 component 0): Ethereum mainnet (1), Sepolia (11155111).
 * - Calibrated to alto. Another bundler implementation has a different floor.
 * - The op must be complete: dummy signature of the REAL signature's byte length,
 *   final `paymasterData` length, final `callData`, final `nonce`. alto overwrites the
 *   gas fields and the signature/paymasterData BYTES with 0xFF before counting, so only
 *   their LENGTHS matter — but a length that changes between calibration and submission
 *   invalidates the result.
 */

/** Selector of `IAccountExecute.executeUserOp` — alto prices this callData shape differently. */
const EXECUTE_USER_OP_SELECTOR = "0x8dd7712f";

/**
 * alto's `GasOverheads`, plus the two multipliers its 7623 branch unscales by.
 * Values mirror alto's defaults; Pimlico's public endpoints were measured to run
 * these unchanged on chains 1 and 11155111.
 */
export interface AltoGasOverheads {
  /** EIP-7623 tokens charged per non-zero calldata byte (zero bytes are 1). */
  tokensPerNonzeroByte: bigint;
  /** Gas overhead added to the whole `handleOps` bundle. */
  fixedGasOverhead: bigint;
  /** Intrinsic gas cost of a transaction on this chain. */
  transactionGasStipend: bigint;
  /** Per-UserOperation overhead on top of the per-bundle overhead. */
  perUserOp: bigint;
  /** Gas cost of one "token" (a zero calldata byte). */
  standardTokenGasCost: bigint;
  /** Expected bundle size the stipend and fixed overhead are split across. */
  expectedBundleSize: bigint;
  /** EIP-7623 floor gas cost per token. */
  floorPerTokenGasCost: bigint;
  /** Per-32-byte-word callData overhead, scaled by 1000 (9200 = 9.2). */
  perUserOpWordGasOverhead: bigint;
  /** Extra overhead when callData is an `executeUserOp` call. */
  executeUserOpGasOverhead: bigint;
  /** Extra per-word overhead for `executeUserOp`, scaled by 1000 (8200 = 8.2). */
  executeUserOpPerWordGasOverhead: bigint;
  /** Gas attributed to an EIP-7702 authorization. */
  eip7702AuthGas: bigint;
  /** alto's `v7-call-gas-limit-multiplier` (percent). */
  callGasLimitMultiplierPercent: bigint;
  /** alto's `v7-paymaster-post-op-gas-limit-multiplier` (percent). */
  paymasterPostOpGasLimitMultiplierPercent: bigint;
}

export const ALTO_DEFAULT_OVERHEADS: AltoGasOverheads = {
  tokensPerNonzeroByte: 4n,
  fixedGasOverhead: 9830n,
  transactionGasStipend: 21000n,
  perUserOp: 7260n,
  standardTokenGasCost: 4n,
  expectedBundleSize: 1n,
  floorPerTokenGasCost: 10n,
  perUserOpWordGasOverhead: 9200n,
  executeUserOpGasOverhead: 1610n,
  executeUserOpPerWordGasOverhead: 8200n,
  eip7702AuthGas: 25000n,
  callGasLimitMultiplierPercent: 100n,
  paymasterPostOpGasLimitMultiplierPercent: 120n,
};

export interface AltoRequiredPvgOptions {
  /**
   * Whether the bundler prices this chain with the EIP-7623 calldata floor.
   *
   * `"max"` (default) computes both branches and takes the larger — the safe choice:
   * Pimlico was measured running `supportsEip7623 = false` on chains 1 / 11155111, but
   * enabling it can RAISE the requirement for ops with a small `callGasLimit` relative
   * to their calldata, so a flag flip would otherwise start rejecting submissions.
   */
  supportsEip7623?: boolean | "max";
  /** Override alto overheads (only needed if a bundler is known to run tuned values). */
  overheads?: Partial<AltoGasOverheads>;
  /** Set when the op carries an EIP-7702 authorization (adds `eip7702AuthGas`). */
  eip7702?: boolean;
  /**
   * L2 data-availability component to add, for chains where alto computes one
   * (`op-stack`, `arbitrum`, `mantle`, ...). Omit on `chainType=default` chains.
   */
  extraComponent?: bigint;
}

export interface CalibrateBundlerPvgOptions extends AltoRequiredPvgOptions {
  /** Percent applied to the requirement (default 110 — what alto's own estimator returns). */
  marginPercent?: bigint;
  /** Flat cushion added after the percentage (default 15000), absorbs overhead drift. */
  marginAbsolute?: bigint;
}

const FF = (byteLength: number): string =>
  byteLength > 0 ? "0x" + "ff".repeat(byteLength) : "0x";

const byteLength = (hex: string | undefined): number =>
  hex && hex !== "0x" ? ethers.dataLength(hex) : 0;

const hasRealPaymaster = (userOp: UserOperation): boolean =>
  !!userOp.paymaster &&
  userOp.paymaster !== "0x" &&
  ethers.isAddress(userOp.paymaster) &&
  userOp.paymaster !== ethers.ZeroAddress;

/** alto's `unscaleBigIntByPercent`. */
const unscaleByPercent = (value: bigint, percent: bigint): bigint =>
  percent === 0n ? value : (value * 100n) / percent;

const toBigInt = (hex: string | undefined): bigint =>
  hex && hex !== "0x" ? BigInt(hex) : 0n;

/**
 * ABI-encode the packed op the way alto does before counting EIP-7623 tokens:
 * gas fields, signature and paymaster gas-limits/data replaced with 0xFF
 * (`fillUserOpWithDummyData` + `toPackedUserOp`), as a SINGLE tuple parameter.
 *
 * Both details are load-bearing. Using the real bytes would count the zero bytes of
 * e.g. `paymasterVerificationGasLimit` as 1 token instead of 4 and UNDERSTATE the
 * requirement (→ submission rejected); encoding nine flat parameters instead of one
 * tuple drops the leading offset word (32 bytes = 32 tokens).
 */
function encodeDummyFilledPackedUserOp(userOp: UserOperation): Uint8Array {
  const paymasterAndData = hasRealPaymaster(userOp)
    ? ethers.concat([
        userOp.paymaster,
        FF(16), // paymasterVerificationGasLimit := maxUint128
        FF(16), // paymasterPostOpGasLimit      := maxUint128
        FF(byteLength(userOp.paymasterData)),
      ])
    : "0x";

  return ethers.getBytes(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["(address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes)"],
      [
        [
          userOp.sender,
          userOp.nonce,
          userOp.initCode && userOp.initCode !== "0x" ? userOp.initCode : "0x",
          userOp.callData && userOp.callData !== "0x" ? userOp.callData : "0x",
          FF(32), // accountGasLimits (verificationGasLimit | callGasLimit := maxUint128)
          ethers.MaxUint256, // preVerificationGas
          FF(32), // gasFees (maxPriorityFeePerGas | maxFeePerGas := maxUint128)
          paymasterAndData,
          FF(byteLength(userOp.signature)),
        ],
      ]
    )
  );
}

/**
 * The bundler's `preVerificationGas` floor for this op — the value
 * `eth_sendUserOperation` rejects below. See the file header for how it was verified.
 *
 * @param userOp complete UserOperation (dummy signature must have the real signature's length)
 */
export function calcAltoRequiredPvg(
  userOp: UserOperation,
  options: AltoRequiredPvgOptions = {}
): bigint {
  const oh = { ...ALTO_DEFAULT_OVERHEADS, ...options.overheads };
  const bundleSize = oh.expectedBundleSize > 0n ? oh.expectedBundleSize : 1n;

  const encoded = encodeDummyFilledPackedUserOp(userOp);
  let tokenCount = 0n;
  for (const byte of encoded) {
    tokenCount += byte === 0 ? 1n : oh.tokensPerNonzeroByte;
  }
  const wordCount = BigInt(Math.floor((encoded.length + 31) / 32));

  const callData = userOp.callData;
  const callDataLength = byteLength(callData);
  let perUserOpOverhead = oh.perUserOp;
  if (options.eip7702) {
    perUserOpOverhead += oh.eip7702AuthGas;
  }
  let callDataOverhead = 0n;
  if (
    callDataLength >= 4 &&
    ethers.dataSlice(callData, 0, 4) === EXECUTE_USER_OP_SELECTOR
  ) {
    perUserOpOverhead +=
      oh.executeUserOpGasOverhead +
      (oh.executeUserOpPerWordGasOverhead * wordCount) / 1000n;
  } else {
    callDataOverhead =
      (BigInt(Math.ceil(callDataLength / 32)) * oh.perUserOpWordGasOverhead) /
      1000n;
  }

  const userOpSpecificOverhead = perUserOpOverhead + callDataOverhead;
  const shareOfBundleCost = oh.fixedGasOverhead / bundleSize;
  const shareOfStipend = oh.transactionGasStipend / bundleSize;

  // alto's getUserOpGasUsed: the gas it knows will be paid during validation.
  const calculatedGasUsed =
    (unscaleByPercent(
      toBigInt(userOp.callGasLimit),
      oh.callGasLimitMultiplierPercent
    ) +
      unscaleByPercent(
        toBigInt(userOp.paymasterPostOpGasLimit),
        oh.paymasterPostOpGasLimitMultiplierPercent
      )) /
    10n;

  const withoutEip7623 =
    oh.standardTokenGasCost * tokenCount +
    shareOfStipend +
    shareOfBundleCost +
    userOpSpecificOverhead;

  // EIP-7623 branch: stipend + max(standardCost, floorCost) - calculatedGasUsed,
  // where standardCost already contains calculatedGasUsed (so it cancels unless the
  // calldata floor dominates).
  const standardCost =
    oh.standardTokenGasCost * tokenCount +
    shareOfBundleCost +
    userOpSpecificOverhead +
    calculatedGasUsed;
  const floorCost = oh.floorPerTokenGasCost * tokenCount;
  const withEip7623 =
    shareOfStipend +
    (standardCost > floorCost ? standardCost : floorCost) -
    calculatedGasUsed;

  const mode = options.supportsEip7623 ?? "max";
  let required: bigint;
  if (mode === true) {
    required = withEip7623;
  } else if (mode === false) {
    required = withoutEip7623;
  } else {
    required = withEip7623 > withoutEip7623 ? withEip7623 : withoutEip7623;
  }

  return required + (options.extraComponent ?? 0n);
}

/**
 * `calcAltoRequiredPvg` plus a safety margin: `requirement * marginPercent/100 + marginAbsolute`.
 *
 * The default (110% + 15,000) is what alto's own `eth_estimateUserOperationGas` would
 * hand a dapp (110%) plus a flat cushion for bundler-version drift in the fixed
 * overheads. Raise it when a rejected submission is expensive to retry — e.g. when the
 * signature is a ZK proof bound to the userOpHash, so a rejection discards the proof.
 */
export function calibrateBundlerPvg(
  userOp: UserOperation,
  options: CalibrateBundlerPvgOptions = {}
): bigint {
  const required = calcAltoRequiredPvg(userOp, options);
  const marginPercent = options.marginPercent ?? 110n;
  const marginAbsolute = options.marginAbsolute ?? 15000n;

  return (required * marginPercent) / 100n + marginAbsolute;
}
