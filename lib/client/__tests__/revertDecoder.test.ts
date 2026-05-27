import receiptsJson from "./fixtures/revert-receipts.json";
import { decodeContractError, extractExecutionRevert } from "../revertDecoder";

/**
 * End-to-end revert decode against REAL Base Sepolia receipts (captured from the
 * 4 reverted UserOps below). Validates the actual on-chain path:
 *   receipt logs → extractExecutionRevert → decodeContractError
 * — not just hand-built/ABI-encoded fixtures. RPC used to capture: sepolia.base.org.
 */
type RevertFixture = {
  txHash: string;
  note: string;
  success: boolean;
  revertReason: string;
  expect: { name: string; args: unknown[] } | null;
  logs: { topics: string[]; data: string }[];
};

const fixtures = receiptsJson as RevertFixture[];

describe("revertDecoder against real Base Sepolia receipts", () => {
  it("has 4 captured reverted-UserOp fixtures", () => {
    expect(fixtures).toHaveLength(4);
    expect(fixtures.every((f) => f.success === false)).toBe(true);
  });

  it.each(fixtures)("extractExecutionRevert + decodeContractError — $note", (fx) => {
    // 1) pull the revert reason out of the real receipt logs
    const reason = extractExecutionRevert(fx.logs);
    expect(reason).toBe(fx.revertReason);

    // 2) decode it
    const decoded = decodeContractError(reason);
    if (fx.expect === null) {
      // unknown target selector → SDK can't decode; caller keeps raw + selector
      expect(decoded).toBeUndefined();
    } else {
      expect(decoded).toEqual(fx.expect);
    }

    // 3) whatever we produce must stay JSON-safe
    expect(() => JSON.stringify({ reason, decoded })).not.toThrow();
  });
});
