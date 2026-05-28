/**
 * Paymaster Hash Spec — cross-check against ZkapPaymaster._getHash()
 *
 * These tests use the real `ethers` library (no module mocks) so the
 * cryptographic results are actual keccak256 outputs. They pin the
 * SDK-side `getUserOpHashForPaymaster()` to the on-chain
 * `ZkapPaymaster._getHash()` byte-for-byte.
 *
 * Why this matters
 * ----------------
 * Any divergence between SDK hash and on-chain `_getHash` produces a
 * paymaster signature that the contract will refuse, breaking 100% of
 * paymaster operations. The SDK previously included `entryPoint` in the
 * outer domain separator, which the contract does not — that bug is
 * fixed in `ZkapBuilder.getUserOpHashForPaymaster()` and this test
 * locks the regression out.
 *
 * Reference contract (BaseSingletonPaymaster._getHash):
 *
 *   bytes32 userOpHash = keccak256(abi.encode(
 *     userOp.sender,
 *     userOp.nonce,
 *     userOp.accountGasLimits,
 *     userOp.preVerificationGas,
 *     userOp.gasFees,
 *     keccak256(userOp.initCode),
 *     keccak256(userOp.callData),
 *     keccak256(userOp.paymasterAndData[:PAYMASTER_DATA_OFFSET + paymasterDataLength])
 *   ));
 *   return keccak256(abi.encode(userOpHash, block.chainid));
 *
 * Where:
 *   - PAYMASTER_DATA_OFFSET = 52 bytes (paymaster(20) + verifGas(16) + postOpGas(16))
 *   - paymasterDataLength (VERIFYING) = MODE_AND_ALLOW_ALL_BUNDLERS_LENGTH(1) + VERIFYING_PAYMASTER_DATA_LENGTH(12) = 13
 *   - paymasterDataLength (ERC20)     = MODE_AND_ALLOW_ALL_BUNDLERS_LENGTH(1) + ERC20_PAYMASTER_DATA_LENGTH(84)     = 85
 */

import { ethers } from "ethers";
import { ZkapBuilder } from "../ZkapBuilder";

const PAYMASTER_DATA_OFFSET = 52;
const VERIFYING_PAYMASTER_PREFIX_LENGTH = PAYMASTER_DATA_OFFSET + 13; // 65 bytes
const ERC20_PAYMASTER_PREFIX_LENGTH = PAYMASTER_DATA_OFFSET + 85;     // 137 bytes
const PAYMASTER_SIG_BYTES = 65;

/**
 * Reference implementation mirroring `ZkapPaymaster._getHash()` byte-for-byte.
 * Lives in the test file (not imported from production code) so divergence
 * between SDK and contract is detectable.
 */
function referenceContractHash(
  packed: {
    sender: string;
    nonce: string;
    initCode: string;
    callData: string;
    accountGasLimits: string;
    preVerificationGas: string;
    gasFees: string;
    paymasterAndData: string;
  },
  chainId: number,
  paymasterPrefixByteLength: number
): string {
  const slice = ethers.dataSlice(
    packed.paymasterAndData,
    0,
    paymasterPrefixByteLength
  );

  const innerEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "address",
      "uint256",
      "bytes32",
      "uint256",
      "bytes32",
      "bytes32",
      "bytes32",
      "bytes32",
    ],
    [
      packed.sender,
      packed.nonce,
      packed.accountGasLimits,
      packed.preVerificationGas,
      packed.gasFees,
      ethers.keccak256(packed.initCode),
      ethers.keccak256(packed.callData),
      ethers.keccak256(slice),
    ]
  );
  const userOpHash = ethers.keccak256(innerEncoded);

  const outerEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256"],
    [userOpHash, chainId]
  );
  return ethers.keccak256(outerEncoded);
}

/** Builds a paymasterAndData hex string of the given mode with a placeholder signature. */
function buildPaymasterAndData(opts: {
  paymaster: string;
  verifGasLimit: bigint;
  postOpGasLimit: bigint;
  combinedByte: number; // (mode << 1) | allowAllBundlersFlag
  validUntil: number;
  validAfter: number;
  erc20?: { token: string; tokenAmount: bigint; treasury: string };
  signature: string; // 64 or 65 bytes hex
}): string {
  const header = ethers.concat([
    opts.paymaster,
    ethers.zeroPadValue(ethers.toBeHex(opts.verifGasLimit), 16),
    ethers.zeroPadValue(ethers.toBeHex(opts.postOpGasLimit), 16),
  ]);
  const combined = ethers.toBeHex(opts.combinedByte, 1);
  const validUntil = ethers.zeroPadValue(ethers.toBeHex(opts.validUntil), 6);
  const validAfter = ethers.zeroPadValue(ethers.toBeHex(opts.validAfter), 6);
  let body = ethers.concat([combined, validUntil, validAfter]);
  if (opts.erc20) {
    body = ethers.concat([
      body,
      opts.erc20.token,
      ethers.zeroPadValue(ethers.toBeHex(opts.erc20.tokenAmount), 32),
      opts.erc20.treasury,
    ]);
  }
  return ethers.concat([header, body, opts.signature]);
}

describe("Paymaster Hash Spec — cross-check against ZkapPaymaster._getHash()", () => {
  const FIXED = {
    chainId: 84532,
    entryPoint: "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108",
    sender: "0x1111111111111111111111111111111111111111",
    paymaster: "0x2222222222222222222222222222222222222222",
    treasury: "0x3333333333333333333333333333333333333333",
    token: "0x4444444444444444444444444444444444444444",
  };

  function makeBuilder(): ZkapBuilder {
    // enUrl is required for constructor URL validation; no RPC call is made
    // by `getUserOpHashForPaymaster` itself, so a placeholder URL is safe.
    return new ZkapBuilder({
      chainId: FIXED.chainId,
      entryPoint: FIXED.entryPoint,
      enUrl: "http://localhost:8545",
    });
  }

  it("VERIFYING mode: SDK getUserOpHashForPaymaster matches contract _getHash byte-for-byte", () => {
    const dummySig = "0x" + "11".repeat(PAYMASTER_SIG_BYTES);
    const paymasterAndData = buildPaymasterAndData({
      paymaster: FIXED.paymaster,
      verifGasLimit: 27000n,
      postOpGasLimit: 5000n,
      combinedByte: 0x01, // VERIFYING_MODE=0, allowAllBundlersFlag=1
      validUntil: 1_900_000_000,
      validAfter: 0,
      signature: dummySig,
    });

    const builder = makeBuilder()
      .setSender(FIXED.sender)
      .setNonce(ethers.toBeHex(7n))
      .setSignerKeyTypes([4]) // keyWebAuthn — required before setCallData
      .setCallData("0xdeadbeef")
      .setCallGasLimit(ethers.toBeHex(100000n))
      .setVerificationGasLimit(ethers.toBeHex(200000n))
      .setPreVerificationGas(ethers.toBeHex(50000n))
      .setMaxFeePerGas(ethers.toBeHex(1_000_000_000n))
      .setMaxPriorityFeePerGas(ethers.toBeHex(1_000_000_000n))
      .setPaymaster(FIXED.paymaster)
      .setPaymasterVerificationGasLimit(ethers.toBeHex(27000n))
      .setPaymasterPostOpGasLimit(ethers.toBeHex(5000n))
      .setPaymasterData("0x" + paymasterAndData.slice(2 + 52 * 2)); // strip header bytes from full paymasterAndData

    const sdkHash = builder.getUserOpHashForPaymaster();

    const packed = builder.getPackedUserOp();
    const referenceHash = referenceContractHash(
      packed,
      FIXED.chainId,
      VERIFYING_PAYMASTER_PREFIX_LENGTH
    );

    expect(sdkHash).toBe(referenceHash);
    expect(sdkHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("ERC20 mode: SDK getUserOpHashForPaymaster matches contract _getHash byte-for-byte", () => {
    const dummySig = "0x" + "22".repeat(PAYMASTER_SIG_BYTES);
    const paymasterAndData = buildPaymasterAndData({
      paymaster: FIXED.paymaster,
      verifGasLimit: 40000n,
      postOpGasLimit: 5000n,
      combinedByte: 0x03, // ERC20_MODE=1, allowAllBundlersFlag=1
      validUntil: 1_900_000_000,
      validAfter: 0,
      erc20: {
        token: FIXED.token,
        tokenAmount: 123_456n,
        treasury: FIXED.treasury,
      },
      signature: dummySig,
    });

    const builder = makeBuilder()
      .setSender(FIXED.sender)
      .setNonce(ethers.toBeHex(42n))
      .setSignerKeyTypes([4]) // keyWebAuthn — required before setCallData
      .setCallData("0xfeedface")
      .setCallGasLimit(ethers.toBeHex(150000n))
      .setVerificationGasLimit(ethers.toBeHex(200000n))
      .setPreVerificationGas(ethers.toBeHex(60000n))
      .setMaxFeePerGas(ethers.toBeHex(2_000_000_000n))
      .setMaxPriorityFeePerGas(ethers.toBeHex(1_000_000_000n))
      .setPaymaster(FIXED.paymaster)
      .setPaymasterVerificationGasLimit(ethers.toBeHex(40000n))
      .setPaymasterPostOpGasLimit(ethers.toBeHex(5000n))
      .setPaymasterData("0x" + paymasterAndData.slice(2 + 52 * 2));

    const sdkHash = builder.getUserOpHashForPaymaster();

    const packed = builder.getPackedUserOp();
    const referenceHash = referenceContractHash(
      packed,
      FIXED.chainId,
      ERC20_PAYMASTER_PREFIX_LENGTH
    );

    expect(sdkHash).toBe(referenceHash);
  });

  it("Outer domain separator MUST NOT include entryPoint address", () => {
    // Regression guard: an older SDK build mixed entryPoint into the outer
    // keccak which diverged from the contract. If a future refactor re-introduces
    // entryPoint here, this test will catch it.
    const dummySig = "0x" + "33".repeat(PAYMASTER_SIG_BYTES);
    const paymasterAndData = buildPaymasterAndData({
      paymaster: FIXED.paymaster,
      verifGasLimit: 27000n,
      postOpGasLimit: 5000n,
      combinedByte: 0x01,
      validUntil: 1_900_000_000,
      validAfter: 0,
      signature: dummySig,
    });

    const builder = makeBuilder()
      .setSender(FIXED.sender)
      .setNonce(ethers.toBeHex(1n))
      .setSignerKeyTypes([4]) // keyWebAuthn — required before setCallData
      .setCallData("0xabcd")
      .setCallGasLimit(ethers.toBeHex(100000n))
      .setVerificationGasLimit(ethers.toBeHex(200000n))
      .setPreVerificationGas(ethers.toBeHex(50000n))
      .setMaxFeePerGas(ethers.toBeHex(1_000_000_000n))
      .setMaxPriorityFeePerGas(ethers.toBeHex(1_000_000_000n))
      .setPaymaster(FIXED.paymaster)
      .setPaymasterVerificationGasLimit(ethers.toBeHex(27000n))
      .setPaymasterPostOpGasLimit(ethers.toBeHex(5000n))
      .setPaymasterData("0x" + paymasterAndData.slice(2 + 52 * 2));

    const sdkHash = builder.getUserOpHashForPaymaster();

    // Buggy variant: includes entryPoint in outer domain
    const packed = builder.getPackedUserOp();
    const slice = ethers.dataSlice(
      packed.paymasterAndData,
      0,
      VERIFYING_PAYMASTER_PREFIX_LENGTH
    );
    const innerEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "address",
        "uint256",
        "bytes32",
        "uint256",
        "bytes32",
        "bytes32",
        "bytes32",
        "bytes32",
      ],
      [
        packed.sender,
        packed.nonce,
        packed.accountGasLimits,
        packed.preVerificationGas,
        packed.gasFees,
        ethers.keccak256(packed.initCode),
        ethers.keccak256(packed.callData),
        ethers.keccak256(slice),
      ]
    );
    const userOpHash = ethers.keccak256(innerEncoded);
    const buggyOuter = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256"],
      [userOpHash, FIXED.entryPoint, FIXED.chainId]
    );
    const buggyHash = ethers.keccak256(buggyOuter);

    expect(sdkHash).not.toBe(buggyHash);
  });

  it("is deterministic — same input produces same hash across multiple calls", () => {
    const dummySig = "0x" + "44".repeat(PAYMASTER_SIG_BYTES);
    const paymasterAndData = buildPaymasterAndData({
      paymaster: FIXED.paymaster,
      verifGasLimit: 27000n,
      postOpGasLimit: 5000n,
      combinedByte: 0x01,
      validUntil: 1_900_000_000,
      validAfter: 0,
      signature: dummySig,
    });

    function build() {
      return makeBuilder()
        .setSender(FIXED.sender)
        .setNonce(ethers.toBeHex(99n))
        .setSignerKeyTypes([4])
        .setCallData("0xcafe")
        .setCallGasLimit(ethers.toBeHex(100000n))
        .setVerificationGasLimit(ethers.toBeHex(200000n))
        .setPreVerificationGas(ethers.toBeHex(50000n))
        .setMaxFeePerGas(ethers.toBeHex(1_000_000_000n))
        .setMaxPriorityFeePerGas(ethers.toBeHex(1_000_000_000n))
        .setPaymaster(FIXED.paymaster)
        .setPaymasterVerificationGasLimit(ethers.toBeHex(27000n))
        .setPaymasterPostOpGasLimit(ethers.toBeHex(5000n))
        .setPaymasterData("0x" + paymasterAndData.slice(2 + 52 * 2));
    }

    const h1 = build().getUserOpHashForPaymaster();
    const h2 = build().getUserOpHashForPaymaster();
    const h3 = build().getUserOpHashForPaymaster();

    expect(h1).toBe(h2);
    expect(h2).toBe(h3);
  });

  it("changes when chainId changes (cross-chain replay protection)", () => {
    const dummySig = "0x" + "55".repeat(PAYMASTER_SIG_BYTES);
    const paymasterAndData = buildPaymasterAndData({
      paymaster: FIXED.paymaster,
      verifGasLimit: 27000n,
      postOpGasLimit: 5000n,
      combinedByte: 0x01,
      validUntil: 1_900_000_000,
      validAfter: 0,
      signature: dummySig,
    });

    function buildOn(chainId: number) {
      return new ZkapBuilder({
        chainId,
        entryPoint: FIXED.entryPoint,
        enUrl: "http://localhost:8545",
      })
        .setSender(FIXED.sender)
        .setNonce(ethers.toBeHex(1n))
        .setSignerKeyTypes([4])
        .setCallData("0xabcd")
        .setCallGasLimit(ethers.toBeHex(100000n))
        .setVerificationGasLimit(ethers.toBeHex(200000n))
        .setPreVerificationGas(ethers.toBeHex(50000n))
        .setMaxFeePerGas(ethers.toBeHex(1_000_000_000n))
        .setMaxPriorityFeePerGas(ethers.toBeHex(1_000_000_000n))
        .setPaymaster(FIXED.paymaster)
        .setPaymasterVerificationGasLimit(ethers.toBeHex(27000n))
        .setPaymasterPostOpGasLimit(ethers.toBeHex(5000n))
        .setPaymasterData("0x" + paymasterAndData.slice(2 + 52 * 2))
        .getUserOpHashForPaymaster();
    }

    const hashBaseSepolia = buildOn(84532);
    const hashKaiaKairos = buildOn(1001);
    const hashArbitrumSepolia = buildOn(421614);

    expect(hashBaseSepolia).not.toBe(hashKaiaKairos);
    expect(hashKaiaKairos).not.toBe(hashArbitrumSepolia);
    expect(hashBaseSepolia).not.toBe(hashArbitrumSepolia);
  });

  it("changes when any committed userOp field changes (mutation guard)", () => {
    const dummySig = "0x" + "66".repeat(PAYMASTER_SIG_BYTES);
    const paymasterAndData = buildPaymasterAndData({
      paymaster: FIXED.paymaster,
      verifGasLimit: 27000n,
      postOpGasLimit: 5000n,
      combinedByte: 0x01,
      validUntil: 1_900_000_000,
      validAfter: 0,
      signature: dummySig,
    });
    const paymasterDataStripped = "0x" + paymasterAndData.slice(2 + 52 * 2);

    function base() {
      return makeBuilder()
        .setSender(FIXED.sender)
        .setNonce(ethers.toBeHex(5n))
        .setSignerKeyTypes([4])
        .setCallData("0xbeef")
        .setCallGasLimit(ethers.toBeHex(100000n))
        .setVerificationGasLimit(ethers.toBeHex(200000n))
        .setPreVerificationGas(ethers.toBeHex(50000n))
        .setMaxFeePerGas(ethers.toBeHex(1_000_000_000n))
        .setMaxPriorityFeePerGas(ethers.toBeHex(1_000_000_000n))
        .setPaymaster(FIXED.paymaster)
        .setPaymasterVerificationGasLimit(ethers.toBeHex(27000n))
        .setPaymasterPostOpGasLimit(ethers.toBeHex(5000n))
        .setPaymasterData(paymasterDataStripped);
    }

    const baseHash = base().getUserOpHashForPaymaster();

    // Different sender
    const senderHash = base()
      .setSender("0x" + "AB".repeat(20))
      .getUserOpHashForPaymaster();
    expect(senderHash).not.toBe(baseHash);

    // Different nonce
    const nonceHash = base()
      .setNonce(ethers.toBeHex(6n))
      .getUserOpHashForPaymaster();
    expect(nonceHash).not.toBe(baseHash);

    // Different callData
    const callDataHash = base()
      .setCallData("0xfeedface")
      .getUserOpHashForPaymaster();
    expect(callDataHash).not.toBe(baseHash);

    // Different callGasLimit (affects accountGasLimits)
    const callGasHash = base()
      .setCallGasLimit(ethers.toBeHex(200000n))
      .getUserOpHashForPaymaster();
    expect(callGasHash).not.toBe(baseHash);

    // Different verificationGasLimit (affects accountGasLimits)
    const verifGasHash = base()
      .setVerificationGasLimit(ethers.toBeHex(300000n))
      .getUserOpHashForPaymaster();
    expect(verifGasHash).not.toBe(baseHash);

    // Different preVerificationGas
    const preVerifHash = base()
      .setPreVerificationGas(ethers.toBeHex(60000n))
      .getUserOpHashForPaymaster();
    expect(preVerifHash).not.toBe(baseHash);

    // Different maxFeePerGas (affects gasFees)
    const maxFeeHash = base()
      .setMaxFeePerGas(ethers.toBeHex(2_000_000_000n))
      .getUserOpHashForPaymaster();
    expect(maxFeeHash).not.toBe(baseHash);

    // Different paymasterVerificationGasLimit (part of paymasterAndData hashed slice)
    const pmVerifHash = base()
      .setPaymasterVerificationGasLimit(ethers.toBeHex(40000n))
      .getUserOpHashForPaymaster();
    expect(pmVerifHash).not.toBe(baseHash);

    // Different paymasterPostOpGasLimit (part of paymasterAndData hashed slice)
    const pmPostHash = base()
      .setPaymasterPostOpGasLimit(ethers.toBeHex(10000n))
      .getUserOpHashForPaymaster();
    expect(pmPostHash).not.toBe(baseHash);

    // Different paymasterData (combinedByte / validUntil / validAfter portion)
    const altPaymasterAndData = buildPaymasterAndData({
      paymaster: FIXED.paymaster,
      verifGasLimit: 27000n,
      postOpGasLimit: 5000n,
      combinedByte: 0x01,
      validUntil: 1_900_000_001, // changed by 1 second
      validAfter: 0,
      signature: dummySig,
    });
    const pmDataHash = base()
      .setPaymasterData("0x" + altPaymasterAndData.slice(2 + 52 * 2))
      .getUserOpHashForPaymaster();
    expect(pmDataHash).not.toBe(baseHash);
  });

  it("signature portion of paymasterAndData is excluded from the hash", () => {
    const baseAndData = buildPaymasterAndData({
      paymaster: FIXED.paymaster,
      verifGasLimit: 27000n,
      postOpGasLimit: 5000n,
      combinedByte: 0x01,
      validUntil: 1_900_000_000,
      validAfter: 0,
      signature: "0x" + "AA".repeat(PAYMASTER_SIG_BYTES),
    });

    const altSig = buildPaymasterAndData({
      paymaster: FIXED.paymaster,
      verifGasLimit: 27000n,
      postOpGasLimit: 5000n,
      combinedByte: 0x01,
      validUntil: 1_900_000_000,
      validAfter: 0,
      signature: "0x" + "BB".repeat(PAYMASTER_SIG_BYTES),
    });

    function build(paymasterAndData: string) {
      return makeBuilder()
        .setSender(FIXED.sender)
        .setNonce(ethers.toBeHex(7n))
        .setSignerKeyTypes([4])
        .setCallData("0xdeadbeef")
        .setCallGasLimit(ethers.toBeHex(100000n))
        .setVerificationGasLimit(ethers.toBeHex(200000n))
        .setPreVerificationGas(ethers.toBeHex(50000n))
        .setMaxFeePerGas(ethers.toBeHex(1_000_000_000n))
        .setMaxPriorityFeePerGas(ethers.toBeHex(1_000_000_000n))
        .setPaymaster(FIXED.paymaster)
        .setPaymasterVerificationGasLimit(ethers.toBeHex(27000n))
        .setPaymasterPostOpGasLimit(ethers.toBeHex(5000n))
        .setPaymasterData("0x" + paymasterAndData.slice(2 + 52 * 2))
        .getUserOpHashForPaymaster();
    }

    expect(build(baseAndData)).toBe(build(altSig));
  });
});
