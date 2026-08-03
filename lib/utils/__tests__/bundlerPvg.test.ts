import { ethers } from "ethers";
import {
  ALTO_DEFAULT_OVERHEADS,
  calcAltoRequiredPvg,
  calibrateBundlerPvg,
} from "../bundlerPvg";
import { UserOperation } from "../../types/UserOperation";
import { REAL_USER_OP_VECTORS } from "./fixtures/realUserOps";

/**
 * Golden vectors are anchored OUTSIDE this repo.
 *
 * Pimlico's public alto (`https://public.pimlico.io/v2/{1,11155111}/rpc`) was asked for
 * its own `preVerificationGas` via `eth_estimateUserOperationGas` with a state override
 * that turns the sender into a permissive account (`validateUserOp => 0`), so validation
 * could not revert. For every shape below the endpoint returned
 * `calcAltoRequiredPvg(op, { supportsEip7623: false }) * 1.10` exactly — 1.10 being
 * alto's `v7-pre-verification-gas-limit-multiplier`, applied only to the ESTIMATE.
 * `eth_sendUserOperation` compares against the unscaled value, which is what these
 * expectations record.
 *
 * Both chains answered identically, which also pins: default overheads, L2 component 0
 * (`chainType=default`), and `supportsEip7623 = false` in Pimlico's config.
 *
 * Re-verify with `scripts/check-pvg-floor.mjs` after an alto release.
 */
const LIVE_ANCHOR_SENDER = "0x00000000000000000000000000000000DeaDBeef";

const anchorOp = (callDataBytes: number, signatureBytes: number): UserOperation => ({
  sender: LIVE_ANCHOR_SENDER,
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

/** [callData bytes, signature bytes, alto's required PVG, alto's estimate response] */
const LIVE_ANCHORS: Array<[number, number, bigint, bigint]> = [
  [4, 65, 42563n, 46819n],
  [260, 65, 46744n, 51418n],
  [1028, 65, 59253n, 65178n],
  [804, 1568, 79541n, 87495n],
  [1668, 928, 83361n, 91697n],
];

describe("calcAltoRequiredPvg — live-anchored vectors", () => {
  it.each(LIVE_ANCHORS)(
    "callData %iB / signature %iB requires %i gas",
    (callDataBytes, signatureBytes, required) => {
      expect(
        calcAltoRequiredPvg(anchorOp(callDataBytes, signatureBytes), {
          supportsEip7623: false,
        })
      ).toBe(required);
    }
  );

  it.each(LIVE_ANCHORS)(
    "callData %iB / signature %iB reproduces alto's estimate response (x1.10)",
    (callDataBytes, signatureBytes, required, estimateResponse) => {
      // alto scales the estimate by v7-pre-verification-gas-limit-multiplier = 110.
      // Integer truncation on their side accounts for the 1-gas gap.
      const scaled = (required * 110n) / 100n;
      expect(estimateResponse - scaled).toBeLessThanOrEqual(1n);
      expect(estimateResponse).toBeGreaterThanOrEqual(scaled);
    }
  );
});

describe("calcAltoRequiredPvg — real ZKAP flow ops (Sepolia, EntryPoint v0.8)", () => {
  /** requirement (7623 off), requirement ("max"), calibrated with the shipped default margin */
  const EXPECTED: Record<string, [bigint, bigint, bigint]> = {
    "create-wallet (sponsored)": [76673n, 76673n, 99340n],
    "create-wallet (user-paid)": [74497n, 74497n, 96946n],
    "recovery-update (sponsored)": [75021n, 75021n, 97523n],
    "recovery-update (user-paid)": [72785n, 72785n, 95063n],
    "passkey-management (sponsored)": [75331n, 95105n, 119615n],
    "passkey-management (user-paid)": [73107n, 89545n, 113499n],
  };

  it("covers every flow the SPA freezes gas for", () => {
    expect(REAL_USER_OP_VECTORS.map((v) => v.label).sort()).toEqual(
      Object.keys(EXPECTED).sort()
    );
  });

  it.each(REAL_USER_OP_VECTORS)("$label", ({ label, userOp, declaredOnChainPvg }) => {
    const [off, max, calibrated] = EXPECTED[label];

    expect(calcAltoRequiredPvg(userOp, { supportsEip7623: false })).toBe(off);
    expect(calcAltoRequiredPvg(userOp)).toBe(max);
    expect(calibrateBundlerPvg(userOp)).toBe(calibrated);

    // The calibrated value must clear the requirement under EITHER 7623 setting…
    expect(calibrated).toBeGreaterThan(max);
    // …and still be far below what the old "x4" policy submitted.
    expect(calibrated).toBeLessThan(BigInt(declaredOnChainPvg) / 2n);
  });

  it("passkey-management is the case where the EIP-7623 floor dominates", () => {
    // Its callGasLimit is small relative to its calldata, so `calculatedGasUsed` no
    // longer cancels and the floor branch wins — this is why the default is "max".
    const op = REAL_USER_OP_VECTORS.find((v) =>
      v.label.startsWith("passkey-management (sponsored)")
    )!.userOp;

    expect(calcAltoRequiredPvg(op, { supportsEip7623: true })).toBeGreaterThan(
      calcAltoRequiredPvg(op, { supportsEip7623: false })
    );
  });
});

describe("calcAltoRequiredPvg — branches", () => {
  const base = anchorOp(100, 65);

  it('"max" picks the larger of the two EIP-7623 branches', () => {
    const on = calcAltoRequiredPvg(base, { supportsEip7623: true });
    const off = calcAltoRequiredPvg(base, { supportsEip7623: false });
    const max = calcAltoRequiredPvg(base, { supportsEip7623: "max" });

    expect(max).toBe(on > off ? on : off);
    expect(calcAltoRequiredPvg(base)).toBe(max);
  });

  it("a larger callGasLimit lowers the requirement only in the floor regime", () => {
    // In the floor regime `calculatedGasUsed` (callGasLimit/10) is subtracted.
    const floorOp: UserOperation = { ...base, callData: "0x" + "b6".repeat(4000) };
    const small = calcAltoRequiredPvg(
      { ...floorOp, callGasLimit: "0x2710" },
      { supportsEip7623: true }
    );
    const large = calcAltoRequiredPvg(
      { ...floorOp, callGasLimit: "0x1e8480" },
      { supportsEip7623: true }
    );

    expect(large).toBeLessThan(small);
    // The non-7623 branch ignores callGasLimit entirely.
    expect(
      calcAltoRequiredPvg({ ...floorOp, callGasLimit: "0x2710" }, { supportsEip7623: false })
    ).toBe(
      calcAltoRequiredPvg({ ...floorOp, callGasLimit: "0x1e8480" }, { supportsEip7623: false })
    );
  });

  it("a real paymaster raises the requirement (its 0xFF gas-limits are 4-token bytes)", () => {
    const sponsored: UserOperation = {
      ...base,
      paymaster: "0xc5503c484f783a97164ef2bD8ee6C76c9c09e4BB",
      paymasterVerificationGasLimit: "0x6978",
      paymasterPostOpGasLimit: "0x0",
      paymasterData: "0x" + "ff".repeat(78),
    };

    expect(calcAltoRequiredPvg(sponsored)).toBeGreaterThan(calcAltoRequiredPvg(base));
  });

  it.each([
    ["0x", "empty paymaster field"],
    [ethers.ZeroAddress, "zero address"],
    ["not-an-address", "malformed address"],
  ])("treats %s as unsponsored (%s)", (paymaster) => {
    const op: UserOperation = {
      ...base,
      paymaster,
      paymasterData: "0x" + "ff".repeat(78),
    };

    expect(calcAltoRequiredPvg(op)).toBe(calcAltoRequiredPvg(base));
  });

  it("prices executeUserOp callData with the per-word branch", () => {
    const executeUserOp: UserOperation = {
      ...base,
      callData: "0x8dd7712f" + "b6".repeat(96),
    };
    const plain: UserOperation = {
      ...base,
      callData: "0xdeadbeef" + "b6".repeat(96),
    };

    expect(calcAltoRequiredPvg(executeUserOp, { supportsEip7623: false })).not.toBe(
      calcAltoRequiredPvg(plain, { supportsEip7623: false })
    );
  });

  it("adds eip7702AuthGas for EIP-7702 ops", () => {
    expect(
      calcAltoRequiredPvg(base, { supportsEip7623: false, eip7702: true })
    ).toBe(
      calcAltoRequiredPvg(base, { supportsEip7623: false }) +
        ALTO_DEFAULT_OVERHEADS.eip7702AuthGas
    );
  });

  it("adds the L2 component verbatim", () => {
    expect(calcAltoRequiredPvg(base, { extraComponent: 12345n })).toBe(
      calcAltoRequiredPvg(base) + 12345n
    );
  });

  it("handles empty callData and empty signature", () => {
    const bare: UserOperation = { ...base, callData: "0x", signature: "0x" };

    expect(calcAltoRequiredPvg(bare)).toBeGreaterThan(0n);
    expect(calcAltoRequiredPvg(bare)).toBeLessThan(calcAltoRequiredPvg(base));
  });

  it("accepts overhead overrides and never divides by a zero bundle size", () => {
    const tuned = calcAltoRequiredPvg(base, {
      supportsEip7623: false,
      overheads: { perUserOp: 0n, expectedBundleSize: 0n },
    });

    expect(tuned).toBe(
      calcAltoRequiredPvg(base, { supportsEip7623: false }) -
        ALTO_DEFAULT_OVERHEADS.perUserOp
    );
  });

  it("splits the stipend and bundle overhead across a larger expected bundle", () => {
    expect(
      calcAltoRequiredPvg(base, {
        supportsEip7623: false,
        overheads: { expectedBundleSize: 2n },
      })
    ).toBeLessThan(calcAltoRequiredPvg(base, { supportsEip7623: false }));
  });

  it("treats a zero multiplier as identity when unscaling", () => {
    const floorOp: UserOperation = {
      ...base,
      callData: "0x" + "b6".repeat(4000),
      callGasLimit: "0x1e8480",
    };

    expect(
      calcAltoRequiredPvg(floorOp, {
        supportsEip7623: true,
        overheads: { callGasLimitMultiplierPercent: 0n },
      })
    ).toBe(
      calcAltoRequiredPvg(floorOp, {
        supportsEip7623: true,
        overheads: { callGasLimitMultiplierPercent: 100n },
      })
    );
  });

  it("counts paymasterPostOpGasLimit in the floor regime", () => {
    const floorOp: UserOperation = {
      ...base,
      callData: "0x" + "b6".repeat(4000),
      paymaster: "0xc5503c484f783a97164ef2bD8ee6C76c9c09e4BB",
      paymasterData: "0x",
      paymasterPostOpGasLimit: "0x186a0",
    };

    expect(calcAltoRequiredPvg(floorOp, { supportsEip7623: true })).toBeLessThan(
      calcAltoRequiredPvg(
        { ...floorOp, paymasterPostOpGasLimit: "0x0" },
        { supportsEip7623: true }
      )
    );
  });
});

describe("calibrateBundlerPvg", () => {
  const op = anchorOp(100, 65);

  it("defaults to requirement x1.10 + 15000", () => {
    const required = calcAltoRequiredPvg(op);

    expect(calibrateBundlerPvg(op)).toBe((required * 110n) / 100n + 15000n);
  });

  it("honours explicit margins", () => {
    const required = calcAltoRequiredPvg(op, { supportsEip7623: false });

    expect(
      calibrateBundlerPvg(op, {
        supportsEip7623: false,
        marginPercent: 100n,
        marginAbsolute: 0n,
      })
    ).toBe(required);
  });
});
