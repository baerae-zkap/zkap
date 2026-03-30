import { TxKeyHelper } from "../TxKeyHelper";
import type { ExistingKeyEntry, WebAuthnNewKeyParams } from "../TxKeyHelper";
import type { TxKeyInfo } from "../../reader/AccountReader";
import { ethers } from "ethers";

// Mock AccountKeyBuilder to avoid real COSE decoding
jest.mock("../../builders/AccountKeyBuilder", () => {
  return {
    AccountKeyBuilder: jest.fn().mockImplementation(() => ({
      getEncodedWebAuthnKeyInitData: jest.fn().mockReturnValue(
        ethers.AbiCoder.defaultAbiCoder().encode(["bytes"], ["0x" + "dd".repeat(64)]),
      ),
    })),
  };
});

const MOCK_WEBAUTHN_IMPL = "0x" + "ab".repeat(20);

function makeNewKey(overrides?: Partial<WebAuthnNewKeyParams>): WebAuthnNewKeyParams {
  return {
    credentialPubkey: "0x" + "aa".repeat(77),
    credentialId: "test-credential-id",
    rpIdHash: "0x" + "bb".repeat(32),
    origin: "https://zkap.app",
    ...overrides,
  };
}

function makeExistingEntry(index: number): ExistingKeyEntry {
  return {
    logicContract: "0x" + index.toString().padStart(40, "0"),
    keyInitData: ethers.AbiCoder.defaultAbiCoder().encode(["bytes"], ["0x" + "cc".repeat(32)]),
    weight: 1,
  };
}

function makeTxKeyInfo(index: number, rpIdHash?: string): TxKeyInfo {
  return {
    index,
    logicContract: "0x" + index.toString().padStart(40, "0"),
    keyId: 1,
    keyType: "webauthn",
    webauthn: {
      x: "0x" + "11".repeat(32),
      y: "0x" + "22".repeat(32),
      credentialId: `cred-${index}`,
      allowedOriginHash: "0x" + "33".repeat(32),
      allowedRpIdHash: rpIdHash ?? "0x" + "44".repeat(32),
    },
  };
}

describe("TxKeyHelper", () => {
  describe("buildAddTxKeyEncoding", () => {
    it("encodes existing entries + new key", () => {
      const existing = [makeExistingEntry(0), makeExistingEntry(1)];
      const result = TxKeyHelper.buildAddTxKeyEncoding(existing, makeNewKey(), MOCK_WEBAUTHN_IMPL);

      expect(result).toBeDefined();
      expect(result.startsWith("0x")).toBe(true);

      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint8", "address[]", "bytes[]", "uint8[]"],
        result,
      );
      expect(decoded[0]).toBe(1n); // threshold
      expect(decoded[1]).toHaveLength(3); // 2 existing + 1 new
      expect(decoded[2]).toHaveLength(3);
      expect(decoded[3]).toHaveLength(3);
    });

    it("throws when exceeding MAX_TX_KEYS (5)", () => {
      const existing = Array.from({ length: 5 }, (_, i) => makeExistingEntry(i));
      expect(() =>
        TxKeyHelper.buildAddTxKeyEncoding(existing, makeNewKey(), MOCK_WEBAUTHN_IMPL),
      ).toThrow(/exceed maximum of 5/);
    });

    it("works with 0 existing keys (first key)", () => {
      const result = TxKeyHelper.buildAddTxKeyEncoding([], makeNewKey(), MOCK_WEBAUTHN_IMPL);
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint8", "address[]", "bytes[]", "uint8[]"],
        result,
      );
      expect(decoded[1]).toHaveLength(1);
    });

    it("works with 4 existing keys (reaches max)", () => {
      const existing = Array.from({ length: 4 }, (_, i) => makeExistingEntry(i));
      const result = TxKeyHelper.buildAddTxKeyEncoding(existing, makeNewKey(), MOCK_WEBAUTHN_IMPL);
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint8", "address[]", "bytes[]", "uint8[]"],
        result,
      );
      expect(decoded[1]).toHaveLength(5);
    });

    it("uses custom threshold when provided", () => {
      const result = TxKeyHelper.buildAddTxKeyEncoding(
        [makeExistingEntry(0)],
        makeNewKey(),
        MOCK_WEBAUTHN_IMPL,
        2,
      );
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint8", "address[]", "bytes[]", "uint8[]"],
        result,
      );
      expect(decoded[0]).toBe(2n);
    });

    it("throws when threshold exceeds total key count", () => {
      expect(() =>
        TxKeyHelper.buildAddTxKeyEncoding([makeExistingEntry(0)], makeNewKey(), MOCK_WEBAUTHN_IMPL, 5),
      ).toThrow(/threshold.*exceeds total key count/);
    });

    it("preserves existing key logic contracts and adds new at end", () => {
      const existing = [makeExistingEntry(1), makeExistingEntry(2)];
      const result = TxKeyHelper.buildAddTxKeyEncoding(existing, makeNewKey(), MOCK_WEBAUTHN_IMPL);
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint8", "address[]", "bytes[]", "uint8[]"],
        result,
      );
      const addresses = decoded[1] as string[];
      expect(addresses[0].toLowerCase()).toBe(existing[0].logicContract.toLowerCase());
      expect(addresses[1].toLowerCase()).toBe(existing[1].logicContract.toLowerCase());
      expect(addresses[2].toLowerCase()).toBe(MOCK_WEBAUTHN_IMPL.toLowerCase());
    });
  });

  describe("buildReplaceTxKeyByRpId", () => {
    const targetRpIdHash = "0x" + "ff".repeat(32);
    const otherRpIdHash = "0x" + "ee".repeat(32);
    const originResolver = () => "https://zkap.app";

    it("replaces the matching key and preserves others", () => {
      const existingKeys = [
        makeTxKeyInfo(0, otherRpIdHash),
        makeTxKeyInfo(1, targetRpIdHash),
        makeTxKeyInfo(2, otherRpIdHash),
      ];
      const result = TxKeyHelper.buildReplaceTxKeyByRpId(
        existingKeys, targetRpIdHash, makeNewKey(), originResolver, MOCK_WEBAUTHN_IMPL,
      );
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint8", "address[]", "bytes[]", "uint8[]"],
        result,
      );
      expect(decoded[1]).toHaveLength(3);
      const addresses = decoded[1] as string[];
      expect(addresses[1].toLowerCase()).toBe(MOCK_WEBAUTHN_IMPL.toLowerCase());
    });

    it("throws when no matching rpIdHash found", () => {
      const existingKeys = [makeTxKeyInfo(0, otherRpIdHash)];
      expect(() =>
        TxKeyHelper.buildReplaceTxKeyByRpId(
          existingKeys, targetRpIdHash, makeNewKey(), originResolver, MOCK_WEBAUTHN_IMPL,
        ),
      ).toThrow(/No txKey found matching rpIdHash/);
    });

    it("case-insensitive rpIdHash matching", () => {
      const existingKeys = [makeTxKeyInfo(0, targetRpIdHash.toUpperCase())];
      expect(() =>
        TxKeyHelper.buildReplaceTxKeyByRpId(
          existingKeys, targetRpIdHash.toLowerCase(), makeNewKey(), originResolver, MOCK_WEBAUTHN_IMPL,
        ),
      ).not.toThrow();
    });

    it("throws when multiple keys match the same rpIdHash", () => {
      const existingKeys = [
        makeTxKeyInfo(0, targetRpIdHash),
        makeTxKeyInfo(1, targetRpIdHash),
      ];
      expect(() =>
        TxKeyHelper.buildReplaceTxKeyByRpId(
          existingKeys, targetRpIdHash, makeNewKey(), originResolver, MOCK_WEBAUTHN_IMPL,
        ),
      ).toThrow(/Multiple txKeys/);
    });

    it("throws when non-WebAuthn key encountered", () => {
      const existingKeys: TxKeyInfo[] = [
        { index: 0, logicContract: "0x" + "00".repeat(20), keyId: 1, keyType: "address" },
        makeTxKeyInfo(1, targetRpIdHash),
      ];
      expect(() =>
        TxKeyHelper.buildReplaceTxKeyByRpId(
          existingKeys, targetRpIdHash, makeNewKey(), originResolver, MOCK_WEBAUTHN_IMPL,
        ),
      ).toThrow(/Non-WebAuthn key/);
    });

    it("throws when originResolver returns empty string", () => {
      const emptyResolver = () => "";
      const existingKeys = [
        makeTxKeyInfo(0, otherRpIdHash),
        makeTxKeyInfo(1, targetRpIdHash),
      ];
      expect(() =>
        TxKeyHelper.buildReplaceTxKeyByRpId(
          existingKeys, targetRpIdHash, makeNewKey(), emptyResolver, MOCK_WEBAUTHN_IMPL,
        ),
      ).toThrow(/originResolver returned empty/);
    });

    it("calls originResolver only for preserved keys", () => {
      const mockResolver = jest.fn().mockReturnValue("https://other-app.com");
      const existingKeys = [
        makeTxKeyInfo(0, otherRpIdHash),
        makeTxKeyInfo(1, targetRpIdHash),
      ];
      TxKeyHelper.buildReplaceTxKeyByRpId(
        existingKeys, targetRpIdHash, makeNewKey(), mockResolver, MOCK_WEBAUTHN_IMPL,
      );
      expect(mockResolver).toHaveBeenCalledTimes(1);
      // originResolver receives allowedOriginHash (not rpIdHash)
      expect(mockResolver).toHaveBeenCalledWith("0x" + "33".repeat(32));
    });
  });

  describe("txKeyInfoToEntry", () => {
    it("converts TxKeyInfo to ExistingKeyEntry", () => {
      const key = makeTxKeyInfo(0);
      const entry = TxKeyHelper.txKeyInfoToEntry(key, "https://zkap.app");
      expect(entry.logicContract).toBe(key.logicContract);
      expect(entry.weight).toBe(1);
      expect(entry.keyInitData).toBeDefined();
      expect(entry.keyInitData.startsWith("0x")).toBe(true);
    });

    it("throws for non-WebAuthn keys", () => {
      const key: TxKeyInfo = {
        index: 0,
        logicContract: "0x" + "00".repeat(20),
        keyId: 1,
        keyType: "address",
      };
      expect(() => TxKeyHelper.txKeyInfoToEntry(key, "https://zkap.app")).toThrow(
        /Only WebAuthn keys are supported/,
      );
    });
  });
});
