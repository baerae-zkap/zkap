import { ethers } from "ethers";
import { normalizeBytes32, originHashOf, rpIdHashOf, toCosePublicKey, toJwkPublicKey } from "../webauthnKey";
import { AaOperationError, AaOperationErrorCode } from "../../errors";

describe("normalizeBytes32", () => {
  it("pads, lowercases and prefixes", () => {
    expect(normalizeBytes32("0x1")).toBe("0x" + "1".padStart(64, "0"));
    expect(normalizeBytes32("FF")).toBe("0x" + "ff".padStart(64, "0"));
    expect(normalizeBytes32("0x" + "ab".repeat(32))).toBe("0x" + "ab".repeat(32));
  });

  it.each([
    ["empty", ""],
    ["just the prefix", "0x"],
    ["non-hex", "zz"],
    ["more than 32 bytes", "0x" + "a".repeat(65)],
  ])("rejects %s with INPUT_INVALID_FORMAT", (_label, input) => {
    expect(() => normalizeBytes32(input)).toThrow(AaOperationError);
    expect(() => normalizeBytes32(input)).toThrow(
      expect.objectContaining({ code: AaOperationErrorCode.INPUT_INVALID_FORMAT, operation: "normalize_bytes32" }),
    );
  });
});

describe("rpIdHashOf / originHashOf", () => {
  it("rpIdHashOf is SHA-256 of the UTF-8 rpId (WebAuthn rpIdHash)", () => {
    // sha256("example.com") — the WebAuthn spec's own example rpId
    expect(rpIdHashOf("example.com")).toBe("0xa379a6f6eeafb9a55e378c118034e2751e682fab9f2d30ab13d2125586ce1947");
    expect(rpIdHashOf("zkap.app")).toBe(ethers.sha256(ethers.toUtf8Bytes("zkap.app")));
  });

  it("originHashOf is keccak256 of the UTF-8 origin — what AccountKeyWebAuthn.register stores", () => {
    expect(originHashOf("https://zkap.app")).toBe(ethers.id("https://zkap.app"));
    expect(originHashOf("https://zkap.app")).not.toBe(ethers.sha256(ethers.toUtf8Bytes("https://zkap.app")));
  });
});

describe("toCosePublicKey", () => {
  // Bytes a real registration stored (COSE from the authenticator); rebuilding
  // from coordinates must reproduce the same layout so storage, assertion
  // verification and re-registration keep one format.
  const X = "0x80bff5fe3ac18ded2655d301874c07d1b381f65d1f28bb7106be5a4a2378b73f";
  const Y = "0x93a0e8215c81b578bfa9335db2860a1a897581ae70e1375a634045490f1472b2";
  const STORED = `0xa5010203262001215820${X.slice(2)}225820${Y.slice(2)}`;

  it("rebuilds the COSE ES256 layout from coordinates", () => {
    const cose = toCosePublicKey({ x: X, y: Y });
    expect(cose).toBe(STORED);
    expect(ethers.getBytes(cose)).toHaveLength(77);
    expect(cose.startsWith("0xa5010203262001215820")).toBe(true);
    expect(cose.slice(2 + 20 + 64, 2 + 20 + 64 + 6)).toBe("225820");
  });

  it("pads coordinates whose leading zeros were stripped", () => {
    expect(toCosePublicKey({ x: "0x1", y: "0xff" })).toBe(
      `0xa5010203262001215820${"1".padStart(64, "0")}225820${"ff".padStart(64, "0")}`,
    );
  });

  it("accepts coordinates without the hex prefix", () => {
    expect(toCosePublicKey({ x: "aa", y: "bb" })).toBe(toCosePublicKey({ x: "0xaa", y: "0xbb" }));
  });

  it.each([
    ["empty", ""],
    ["non-hex", "zz"],
    ["more than 32 bytes", "0x" + "a".repeat(65)],
  ])("rejects %s coordinates", (_label, coordinate) => {
    expect(() => toCosePublicKey({ x: coordinate, y: "aa" })).toThrow(AaOperationError);
    expect(() => toCosePublicKey({ x: "aa", y: coordinate })).toThrow(AaOperationError);
  });
});

describe("toJwkPublicKey", () => {
  const X = "0x" + "12".repeat(32);
  const Y = "0x1";

  it("produces an EC P-256 JWK with unpadded base64url coordinates", () => {
    const jwk = toJwkPublicKey({ x: X, y: Y });
    expect(jwk.kty).toBe("EC");
    expect(jwk.crv).toBe("P-256");
    for (const v of [jwk.x, jwk.y]) {
      expect(v).not.toMatch(/[=+/]/);
      expect(Buffer.from(v, "base64url")).toHaveLength(32);
    }
    expect(Buffer.from(jwk.x, "base64url").toString("hex")).toBe(X.slice(2));
    expect(Buffer.from(jwk.y, "base64url").toString("hex")).toBe("1".padStart(64, "0"));
  });

  it("propagates coordinate validation errors", () => {
    expect(() => toJwkPublicKey({ x: "", y: Y })).toThrow(AaOperationError);
  });
});
