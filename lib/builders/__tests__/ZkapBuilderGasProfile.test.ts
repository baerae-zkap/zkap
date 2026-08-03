/**
 * Gas-profile behaviour of `autoFillUserOp` + `applyBundlerPreVerificationGas`,
 * exercised against REAL ethers ABI coding (the sibling ZkapBuilder.test.ts mocks
 * `AbiCoder`, so it cannot produce a decodable zk signature).
 *
 * Only the RPC surface is stubbed, on the JsonRpcProvider prototype.
 */
import { ethers } from "ethers";
import { ZkapBuilder, ZkapAccountInfo } from "../ZkapBuilder";
import { calcAltoRequiredPvg, calibrateBundlerPvg } from "../../utils/bundlerPvg";
import { createDummyZkSignature } from "../../utils/userOpUtils";

const ENTRY_POINT = "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108";
const SENDER = "0x" + "11".repeat(20);

const accountInfo: ZkapAccountInfo = {
  chainId: 11155111,
  entryPoint: ENTRY_POINT,
  enUrl: "http://127.0.0.1:8545",
};

/** updateTxKey(bytes) with a 512-byte payload — shape of a real passkey-management op. */
const CALL_DATA = "0x25d90741" + "ab".repeat(512);

describe("ZkapBuilder gas profile (real ABI coding)", () => {
  beforeEach(() => {
    jest
      .spyOn(ethers.JsonRpcProvider.prototype, "getCode")
      .mockResolvedValue("0x60006000f3"); // wallet already deployed
    jest
      .spyOn(ethers.JsonRpcProvider.prototype, "estimateGas")
      .mockResolvedValue(BigInt(21000));
    jest.spyOn(ethers.JsonRpcProvider.prototype, "getFeeData").mockResolvedValue({
      maxFeePerGas: BigInt(2_000_000_000),
      maxPriorityFeePerGas: BigInt(1_000_000),
      gasPrice: BigInt(2_000_000_000),
    } as ethers.FeeData);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const build = async (signature?: string): Promise<ZkapBuilder> => {
    const builder = new ZkapBuilder(accountInfo);
    builder.setSender(SENDER);
    builder.setNonce("0x1"); // pre-set so no EntryPoint.getNonce call is needed
    builder.setSignerKeyTypes([6]); // keyZkOAuthRS256
    builder.setCallData(CALL_DATA);
    if (signature) {
      builder.setSignature([0], [signature]);
    }
    await builder.autoFillUserOp();
    return builder;
  };

  describe("verificationGasLimit follows the zk proof count", () => {
    it("uses the 1-of-1 budget for a single-proof signature (wallet deploy)", async () => {
      const builder = await build(createDummyZkSignature(1));

      // (25,000 base + 400,000 single-proof) * 1.2
      expect(BigInt(builder.getUserOp().verificationGasLimit)).toBe(510_000n);
    });

    it("uses the 3-of-6 budget for a three-proof signature (key updates)", async () => {
      const builder = await build(createDummyZkSignature(3));

      // (25,000 base + 900,000 three-of-six) * 1.2
      expect(BigInt(builder.getUserOp().verificationGasLimit)).toBe(1_110_000n);
    });

    it("falls back to the 3-of-6 budget when the signature is not a zk proof", async () => {
      // autoFillUserOp installs its own opaque dummy when no signature is set.
      const builder = await build();

      expect(BigInt(builder.getUserOp().verificationGasLimit)).toBe(1_110_000n);
    });
  });

  describe("dummy zk signature byte length (preVerificationGas depends on it)", () => {
    // The bundler recomputes its PVG floor from the SUBMITTED signature length, while the
    // SPA freezes PVG against the dummy. These two numbers are what the on-chain ZKAP ops
    // carry (928B for the 1-of-1 deploy signature, 1568B for 3-of-6 key updates); if the
    // proof shape ever changes, this test must fail before a flow silently under-declares.
    it.each([
      [1, 928],
      [3, 1568],
    ])("proofCount %i encodes to %iB", (proofCount, expectedBytes) => {
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8[]", "bytes[]"],
        [[0], [createDummyZkSignature(proofCount)]]
      );

      expect(ethers.dataLength(encoded)).toBe(expectedBytes);
    });
  });

  describe("applyBundlerPreVerificationGas", () => {
    it("replaces the SDK estimate with the calibrated bundler floor", async () => {
      const builder = await build(createDummyZkSignature(3));
      const sdkEstimate = BigInt(builder.getUserOp().preVerificationGas);

      builder.applyBundlerPreVerificationGas();

      const applied = BigInt(builder.getUserOp().preVerificationGas);
      const required = calcAltoRequiredPvg(builder.getUserOp());

      expect(applied).toBe(calibrateBundlerPvg(builder.getUserOp()));
      expect(applied).toBeGreaterThan(required);
      expect(applied).not.toBe(sdkEstimate);
    });

    it("emits even-length hex (odd-length hex is rejected by gas setters downstream)", async () => {
      const builder = await build(createDummyZkSignature(3));

      builder.applyBundlerPreVerificationGas();

      const hex = builder.getUserOp().preVerificationGas;
      expect((hex.length - 2) % 2).toBe(0);
    });

    it("never lowers a preVerificationGas that is already higher", async () => {
      const builder = await build(createDummyZkSignature(3));
      builder.setPreVerificationGas(ethers.toBeHex(9_000_000));

      builder.applyBundlerPreVerificationGas();

      expect(BigInt(builder.getUserOp().preVerificationGas)).toBe(9_000_000n);
    });

    it("honours margin and L2 options", async () => {
      const builder = await build(createDummyZkSignature(3));
      const required = calcAltoRequiredPvg(builder.getUserOp(), {
        extraComponent: 50_000n,
      });

      builder.applyBundlerPreVerificationGas({
        marginPercent: 100n,
        marginAbsolute: 0n,
        extraComponent: 50_000n,
      });

      expect(BigInt(builder.getUserOp().preVerificationGas)).toBe(required);
    });
  });
});
