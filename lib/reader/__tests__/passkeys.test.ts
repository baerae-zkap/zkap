/**
 * Pure classification tests — no transport involved.
 */
import { buildPasskeysResult, normalizeOptions } from "../passkeys";
import type { TxKeyInfo, TxKeySlots } from "../types";
import { AaOperationError, AaOperationErrorCode } from "../../errors";
import { originHashOf, rpIdHashOf } from "../../utils/webauthnKey";

const LOGIC = "0x" + "aa".repeat(20);
const RP_ID = "zkap.app";
const ORIGIN = "https://zkap.app";
const ORIGIN_ANDROID = "android:apk-key-hash:abc";
const OTHER_RP_ID = "pay.ifez.app";
const OTHER_ORIGIN = "https://pay.ifez.app";

function webauthn(index: number, credentialId: string, rpId: string, origin: string, coords = {}): TxKeyInfo {
  return {
    index,
    logicContract: LOGIC,
    keyId: index,
    keyType: "webauthn",
    webauthn: {
      x: "0x" + "12".repeat(32),
      y: "0x" + "34".repeat(32),
      credentialId,
      allowedOriginHash: originHashOf(origin),
      allowedRpIdHash: rpIdHashOf(rpId),
      ...coords,
    },
  };
}

function slots(keys: TxKeyInfo[], extra: Partial<TxKeySlots> = {}): TxKeySlots {
  return { deployed: true, keys, truncated: false, readVia: "multicall", ...extra };
}

describe("normalizeOptions", () => {
  it("returns empty lists for no options", () => {
    expect(normalizeOptions()).toEqual({ service: undefined, credentialId: undefined, knownRpIds: [], knownOrigins: [] });
  });

  it("precomputes hashes and turns a single origin into a list", () => {
    const n = normalizeOptions({
      service: { rpId: RP_ID, origins: ORIGIN },
      credentialId: "c",
      knownRpIds: [OTHER_RP_ID],
      knownOrigins: [OTHER_ORIGIN],
    });
    expect(n.service).toEqual({
      rpId: RP_ID,
      rpIdHash: rpIdHashOf(RP_ID),
      origins: [{ origin: ORIGIN, hash: originHashOf(ORIGIN) }],
    });
    expect(n.credentialId).toBe("c");
    expect(n.knownRpIds).toEqual([{ rpId: OTHER_RP_ID, hash: rpIdHashOf(OTHER_RP_ID) }]);
    expect(n.knownOrigins).toEqual([{ origin: OTHER_ORIGIN, hash: originHashOf(OTHER_ORIGIN) }]);
  });

  it.each([
    ["service.rpId", { service: { rpId: "", origins: ORIGIN } }],
    ["service.origins empty", { service: { rpId: RP_ID, origins: [] } }],
    ["service.origins entry", { service: { rpId: RP_ID, origins: [""] } }],
    ["credentialId", { credentialId: "" }],
    ["knownRpIds entry", { knownRpIds: [""] }],
    ["knownOrigins entry", { knownOrigins: [""] }],
  ])("rejects an empty %s with INPUT_INVALID", (_label, opts) => {
    expect(() => normalizeOptions(opts)).toThrow(AaOperationError);
    expect(() => normalizeOptions(opts)).toThrow(
      expect.objectContaining({ code: AaOperationErrorCode.INPUT_INVALID, operation: "get_passkeys" }),
    );
  });
});

describe("buildPasskeysResult", () => {
  it("passes deployed / truncated / readVia / txKeys through and counts every slot", () => {
    const keys = [webauthn(0, "a", RP_ID, ORIGIN), { index: 1, logicContract: LOGIC, keyId: 1, keyType: "address" as const }];
    const result = buildPasskeysResult(slots(keys, { truncated: true, readVia: "direct" }));
    expect(result.deployed).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.readVia).toBe("direct");
    expect(result.txKeys).toBe(keys);
    expect(result.total).toBe(2);
    expect(result.passkeys).toHaveLength(1);
  });

  it("reports an undeployed account as empty", () => {
    const result = buildPasskeysResult({ deployed: false, keys: [], truncated: false, readVia: "multicall" });
    expect(result.deployed).toBe(false);
    expect(result.total).toBe(0);
    expect(result.passkeys).toEqual([]);
    expect(result.mine).toBeUndefined();
  });

  it("lists WebAuthn slots without readable key data under unreadable", () => {
    const keys: TxKeyInfo[] = [
      webauthn(0, "a", RP_ID, ORIGIN),
      { index: 1, logicContract: LOGIC, keyId: 1, keyType: "webauthn" },
    ];
    const result = buildPasskeysResult(slots(keys));
    expect(result.passkeys.map((k) => k.index)).toEqual([0]);
    expect(result.unreadable).toEqual([1]);
  });

  it("applies the strict rpId AND origin rule", () => {
    const keys = [
      webauthn(0, "ios", RP_ID, ORIGIN),
      webauthn(1, "android", RP_ID, ORIGIN_ANDROID),
      webauthn(2, "beta", RP_ID, "https://beta.zkap.app"),
      webauthn(3, "foreign", OTHER_RP_ID, OTHER_ORIGIN),
    ];
    const result = buildPasskeysResult(slots(keys), {
      service: { rpId: RP_ID, origins: [ORIGIN, ORIGIN_ANDROID] },
      credentialId: "android",
      knownRpIds: [OTHER_RP_ID],
      knownOrigins: [OTHER_ORIGIN],
    });

    expect(result.myService.map((k) => k.credentialId)).toEqual(["ios", "android"]);
    expect(result.sameRpIdOtherOrigin.map((k) => k.credentialId)).toEqual(["beta"]);
    expect(result.otherServices.map((k) => k.credentialId)).toEqual(["foreign"]);
    expect(result.mine?.credentialId).toBe("android");
    expect(result.mine?.origin).toBe(ORIGIN_ANDROID);

    const foreign = result.otherServices[0];
    expect(foreign).toMatchObject({
      rpIdMatches: false,
      originMatches: false,
      isMyService: false,
      isMine: false,
      rpId: OTHER_RP_ID,
      origin: OTHER_ORIGIN,
    });
    expect(result.sameRpIdOtherOrigin[0]).toMatchObject({ rpIdMatches: true, originMatches: false, rpId: RP_ID });
    expect(result.sameRpIdOtherOrigin[0].origin).toBeUndefined();
  });

  it("without a service leaves flags undefined, buckets empty, and still resolves isMine", () => {
    const result = buildPasskeysResult(slots([webauthn(0, "a", RP_ID, ORIGIN)]), { credentialId: "a" });
    const [key] = result.passkeys;
    expect(key.rpIdMatches).toBeUndefined();
    expect(key.originMatches).toBeUndefined();
    expect(key.isMyService).toBe(false);
    expect(key.isMine).toBe(true);
    expect(key.rpId).toBeUndefined();
    expect(result.mine).toBe(key);
    expect(result.myService).toEqual([]);
    expect(result.sameRpIdOtherOrigin).toEqual([]);
    expect(result.otherServices).toEqual([]);
  });

  it("normalizes hashes and coordinates that arrive uppercase or with stripped zeros", () => {
    const key = webauthn(0, "a", RP_ID, ORIGIN, {
      x: "0x1",
      y: "0xFF",
      allowedRpIdHash: rpIdHashOf(RP_ID).toUpperCase().replace("0X", "0x"),
      allowedOriginHash: originHashOf(ORIGIN).slice(2).toUpperCase(),
    });
    const [pk] = buildPasskeysResult(slots([key]), { service: { rpId: RP_ID, origins: ORIGIN } }).passkeys;
    expect(pk.isMyService).toBe(true);
    expect(pk.rpIdHash).toBe(rpIdHashOf(RP_ID));
    expect(pk.originHash).toBe(originHashOf(ORIGIN));
    expect(pk.publicKey.x).toBe("0x" + "1".padStart(64, "0"));
    expect(pk.publicKey.y).toBe("0x" + "ff".padStart(64, "0"));
    expect(pk.publicKey.cose).toBe(`0xa5010203262001215820${"1".padStart(64, "0")}225820${"ff".padStart(64, "0")}`);
  });

  it("validates options itself", () => {
    expect(() => buildPasskeysResult(slots([]), { credentialId: "" })).toThrow(
      expect.objectContaining({ code: AaOperationErrorCode.INPUT_INVALID }),
    );
  });
});
