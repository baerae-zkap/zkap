/**
 * AccountReader tests — provider and call transports.
 *
 * No `ethers` module mock: the transport is injected and every response is
 * encoded with the real ethers coder (see lib/__tests__/helpers/fakeEthCall.ts).
 * The rpcUrl constructor path lives in AccountReader.rpcUrl.test.ts.
 */
import { ethers } from "ethers";
import { AccountReader } from "../AccountReader";
import { AaFetchError, AaFetchErrorCode, AaOperationError, AaOperationErrorCode } from "../../errors";
import { PrimitiveAccountKeyTypes } from "../../types/AccountKey";
import { MULTICALL3_ADDRESS } from "../transport";
import { originHashOf, rpIdHashOf } from "../../utils/webauthnKey";
import {
  decodeAggregate3Calls,
  fakeChain,
  fakeProvider,
  webauthnSlot,
  zkapAccount,
  X,
  Y,
} from "../../__tests__/helpers/fakeEthCall";
import type { Handler, SlotSpec } from "../../__tests__/helpers/fakeEthCall";

const ACCOUNT = "0x" + "11".repeat(20);
const WEBAUTHN_LOGIC = "0x" + "aa".repeat(20);
const ADDRESS_LOGIC = "0x" + "bb".repeat(20);
const VERIFIER = "0x" + "cc".repeat(20);

const RP_ID = "zkap.app";
const ORIGIN_IOS = "https://zkap.app";
const ORIGIN_ANDROID = "android:apk-key-hash:abc123";
const OTHER_RP_ID = "pay.ifez.app";
const OTHER_ORIGIN = "https://pay.ifez.app";

const KEY_TX = 1;

function readerFor(handlers: Record<string, Handler>, opts: Parameters<typeof fakeChain>[1] = {}) {
  const chain = fakeChain(handlers, opts);
  return { chain, reader: new AccountReader({ call: chain.call }) };
}

async function rejectsWith<T>(promise: Promise<T>, ctor: new (...args: never[]) => unknown, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ctor);
  await expect(promise).rejects.toMatchObject({ code });
}

describe("AccountReader", () => {
  describe("constructor", () => {
    it("accepts a provider", () => {
      const chain = fakeChain({});
      expect(() => new AccountReader({ provider: fakeProvider(chain) })).not.toThrow();
    });

    it("accepts a bare eth_call function", () => {
      const chain = fakeChain({});
      expect(() => new AccountReader({ call: chain.call })).not.toThrow();
    });

    it("rejects a config with no transport", () => {
      expect(() => new AccountReader({} as never)).toThrow(AaOperationError);
      expect(() => new AccountReader({} as never)).toThrow(
        expect.objectContaining({ code: AaOperationErrorCode.CONFIG_REQUIRED_FIELD_MISSING }),
      );
    });

    it("rejects more than one transport", () => {
      const chain = fakeChain({});
      expect(() => new AccountReader({ call: chain.call, provider: fakeProvider(chain) } as never)).toThrow(
        expect.objectContaining({ code: AaOperationErrorCode.INPUT_INVALID }),
      );
    });

    it.each([0, 1.5, -1])("rejects maxTxKeys=%p", (maxTxKeys) => {
      const chain = fakeChain({});
      expect(() => new AccountReader({ call: chain.call, maxTxKeys })).toThrow(
        expect.objectContaining({ code: AaOperationErrorCode.INPUT_OUT_OF_RANGE }),
      );
    });
  });

  describe("isDeployed / getBalance", () => {
    it("isDeployed reads eth_getCode through the provider", async () => {
      const chain = fakeChain(zkapAccount(ACCOUNT, []));
      const reader = new AccountReader({ provider: fakeProvider(chain) });
      expect(await reader.isDeployed(ACCOUNT)).toBe(true);
      expect(await reader.isDeployed("0x" + "99".repeat(20))).toBe(false);
    });

    it("getBalance returns the balance as a decimal string", async () => {
      const chain = fakeChain({});
      const reader = new AccountReader({ provider: fakeProvider(chain, BigInt("1000000000000000000")) });
      expect(await reader.getBalance(ACCOUNT)).toBe("1000000000000000000");
      const zero = new AccountReader({ provider: fakeProvider(chain, BigInt(0)) });
      expect(await zero.getBalance(ACCOUNT)).toBe("0");
    });

    it("both throw CONFIG_REQUIRED_FIELD_MISSING in call-only mode", async () => {
      const { reader } = readerFor({});
      await rejectsWith(reader.isDeployed(ACCOUNT), AaOperationError, AaOperationErrorCode.CONFIG_REQUIRED_FIELD_MISSING);
      await expect(reader.isDeployed(ACCOUNT)).rejects.toMatchObject({ operation: "is_deployed" });
      await rejectsWith(reader.getBalance(ACCOUNT), AaOperationError, AaOperationErrorCode.CONFIG_REQUIRED_FIELD_MISSING);
      await expect(reader.getBalance(ACCOUNT)).rejects.toMatchObject({ operation: "get_balance" });
    });
  });

  describe("readTxKeySlots / getTxKeyList", () => {
    it("reports an undeployed account from round 1 alone", async () => {
      const { chain, reader } = readerFor({}); // nothing deployed anywhere
      const slots = await reader.readTxKeySlots(ACCOUNT);
      expect(slots).toEqual({ deployed: false, keys: [], truncated: false, readVia: "multicall" });
      expect(chain.sent).toHaveLength(1);
      expect(await reader.getTxKeyList(ACCOUNT)).toEqual([]);
    });

    it("reports a deployed account with no keys in one round", async () => {
      const { chain, reader } = readerFor(zkapAccount(ACCOUNT, []));
      const slots = await reader.readTxKeySlots(ACCOUNT);
      expect(slots).toEqual({ deployed: true, keys: [], truncated: false, readVia: "multicall" });
      expect(chain.sent).toHaveLength(1);
    });

    it("reads one WebAuthn key in two round trips", async () => {
      const { chain, reader } = readerFor(
        zkapAccount(ACCOUNT, [
          webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 7, credentialId: "cred-a", rpId: RP_ID, origin: ORIGIN_IOS }),
        ]),
      );
      const keys = await reader.getTxKeyList(ACCOUNT);

      expect(chain.sent).toHaveLength(2);
      expect(keys).toEqual([
        {
          index: 0,
          logicContract: ethers.getAddress(WEBAUTHN_LOGIC),
          keyId: 7,
          keyType: "webauthn",
          webauthn: {
            x: X,
            y: Y,
            credentialId: "cred-a",
            allowedOriginHash: originHashOf(ORIGIN_IOS),
            allowedRpIdHash: rpIdHashOf(RP_ID),
          },
        },
      ]);
    });

    it("round 1 asks maxTxKeys+1 slots of the account, all allowFailure; round 2 asks the logic contract", async () => {
      const { chain, reader } = readerFor(
        zkapAccount(ACCOUNT, [
          webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 7, credentialId: "cred-a", rpId: RP_ID, origin: ORIGIN_IOS }),
        ]),
      );
      await reader.getTxKeyList(ACCOUNT);

      expect(chain.sent[0].to).toBe(MULTICALL3_ADDRESS);
      const round1 = decodeAggregate3Calls(chain.sent[0].data);
      expect(round1).toHaveLength(6);
      expect(round1.every((c) => c.allowFailure)).toBe(true);
      expect(round1.every((c) => c.target.toLowerCase() === ACCOUNT)).toBe(true);

      const round2 = decodeAggregate3Calls(chain.sent[1].data);
      expect(round2).toHaveLength(2);
      expect(round2.every((c) => c.target.toLowerCase() === WEBAUTHN_LOGIC)).toBe(true);
      const getKeyDataIface = new ethers.Interface([
        "function getKeyData(uint8 purpose, address account, uint256 keyId)",
      ]);
      const [purpose, account, keyId] = getKeyDataIface.decodeFunctionData("getKeyData", round2[1].callData);
      expect(Number(purpose)).toBe(KEY_TX);
      expect(account.toLowerCase()).toBe(ACCOUNT);
      expect(Number(keyId)).toBe(7);
    });

    it("still takes two round trips for three keys", async () => {
      const { chain, reader } = readerFor(
        zkapAccount(ACCOUNT, [
          webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 0, credentialId: "a", rpId: RP_ID, origin: ORIGIN_IOS }),
          webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 1, credentialId: "b", rpId: RP_ID, origin: ORIGIN_ANDROID }),
          webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 2, credentialId: "c", rpId: OTHER_RP_ID, origin: OTHER_ORIGIN }),
        ]),
      );
      const keys = await reader.getTxKeyList(ACCOUNT);
      expect(chain.sent).toHaveLength(2);
      expect(keys.map((k) => k.webauthn?.credentialId)).toEqual(["a", "b", "c"]);
      expect(keys.map((k) => k.index)).toEqual([0, 1, 2]);
    });

    it.each([
      [PrimitiveAccountKeyTypes.keyAddress, "address"],
      [PrimitiveAccountKeyTypes.keySecp256k1, "secp256k1"],
      [PrimitiveAccountKeyTypes.keySecp256r1, "secp256r1"],
      [PrimitiveAccountKeyTypes.keyOAuthRS256, "oauthRs256"],
      [PrimitiveAccountKeyTypes.keyZkOAuthRS256, "zkOAuth"],
      [99, "unknown"],
    ])("maps keyType() %p to %p without webauthn data", async (primitive, expected) => {
      const { reader } = readerFor(zkapAccount(ACCOUNT, [{ logic: ADDRESS_LOGIC, keyId: 0, keyType: primitive }]));
      const [key] = await reader.getTxKeyList(ACCOUNT);
      expect(key.keyType).toBe(expected);
      expect(key.webauthn).toBeUndefined();
    });

    it("treats a reverting or undecodable keyType() as unknown", async () => {
      const reverting = readerFor(zkapAccount(ACCOUNT, [{ logic: ADDRESS_LOGIC, keyId: 0, keyType: "revert" }]));
      expect((await reverting.reader.getTxKeyList(ACCOUNT))[0].keyType).toBe("unknown");

      const garbage = readerFor(zkapAccount(ACCOUNT, [{ logic: ADDRESS_LOGIC, keyId: 0, keyType: "garbage" }]));
      expect((await garbage.reader.getTxKeyList(ACCOUNT))[0].keyType).toBe("unknown");
    });

    it("leaves webauthn undefined when getKeyData reverts or is undecodable", async () => {
      const webauthn = PrimitiveAccountKeyTypes.keyWebAuthn;
      const reverting = readerFor(
        zkapAccount(ACCOUNT, [{ logic: WEBAUTHN_LOGIC, keyId: 0, keyType: webauthn, keyData: "revert" }]),
      );
      const [k1] = await reverting.reader.getTxKeyList(ACCOUNT);
      expect(k1.keyType).toBe("webauthn");
      expect(k1.webauthn).toBeUndefined();

      const garbage = readerFor(
        zkapAccount(ACCOUNT, [{ logic: WEBAUTHN_LOGIC, keyId: 0, keyType: webauthn, keyData: "garbage" }]),
      );
      const [k2] = await garbage.reader.getTxKeyList(ACCOUNT);
      expect(k2.webauthn).toBeUndefined();
    });

    it("stops at a zero-address sentinel", async () => {
      const { reader } = readerFor(
        zkapAccount(
          ACCOUNT,
          [
            webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 0, credentialId: "a", rpId: RP_ID, origin: ORIGIN_IOS }),
            webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 1, credentialId: "b", rpId: RP_ID, origin: ORIGIN_IOS }),
          ],
          { zeroAt: 1 },
        ),
      );
      const slots = await reader.readTxKeySlots(ACCOUNT);
      expect(slots.keys).toHaveLength(1);
      expect(slots.truncated).toBe(false);
    });

    it("honours maxTxKeys for the round-1 window", async () => {
      const chain = fakeChain(
        zkapAccount(ACCOUNT, [
          webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 0, credentialId: "a", rpId: RP_ID, origin: ORIGIN_IOS }),
        ]),
      );
      const reader = new AccountReader({ call: chain.call, maxTxKeys: 2 });
      await reader.getTxKeyList(ACCOUNT);
      expect(decodeAggregate3Calls(chain.sent[0].data)).toHaveLength(3);
    });

    it("reads the default window of 5 and reports whether the list continues", async () => {
      const five: SlotSpec[] = Array.from({ length: 5 }, (_, i) =>
        webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: i, credentialId: `c${i}`, rpId: RP_ID, origin: ORIGIN_IOS }),
      );
      const exact = readerFor(zkapAccount(ACCOUNT, five));
      const exactSlots = await exact.reader.readTxKeySlots(ACCOUNT);
      expect(exactSlots.keys).toHaveLength(5);
      expect(exactSlots.truncated).toBe(false);

      const six = [
        ...five,
        webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 5, credentialId: "c5", rpId: RP_ID, origin: ORIGIN_IOS }),
      ];
      const over = readerFor(zkapAccount(ACCOUNT, six));
      const overSlots = await over.reader.readTxKeySlots(ACCOUNT);
      expect(overSlots.keys).toHaveLength(5);
      expect(overSlots.truncated).toBe(true);
      // The 6th slot is only probed, never detailed.
      expect(decodeAggregate3Calls(over.chain.sent[1].data)).toHaveLength(10);
    });

    it("throws RESPONSE_SHAPE when a slot answers undecodable data", async () => {
      const { reader } = readerFor(
        zkapAccount(
          ACCOUNT,
          [webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 0, credentialId: "a", rpId: RP_ID, origin: ORIGIN_IOS })],
          { garbageAt: 0 },
        ),
      );
      await rejectsWith(reader.getTxKeyList(ACCOUNT), AaFetchError, AaFetchErrorCode.RESPONSE_SHAPE);
    });

    it("rejects a malformed address before any RPC", async () => {
      const { chain, reader } = readerFor({});
      await rejectsWith(reader.getTxKeyList("not-an-address"), AaOperationError, AaOperationErrorCode.INPUT_INVALID_ADDRESS);
      expect(chain.sent).toHaveLength(0);
    });

    it("throws TRANSPORT when the transport fails — never an empty list", async () => {
      const cause = new Error("ECONNRESET");
      const reader = new AccountReader({
        call: async () => {
          throw cause;
        },
      });
      const promise = reader.getTxKeyList(ACCOUNT);
      await rejectsWith(promise, AaFetchError, AaFetchErrorCode.TRANSPORT);
      await expect(promise).rejects.toMatchObject({ service: "rpc", method: "POST", url: undefined, cause });
    });
  });

  describe("getPasskeys", () => {
    const service = { rpId: RP_ID, origins: [ORIGIN_IOS, ORIGIN_ANDROID] };

    function mixedAccount(): Record<string, Handler> {
      return zkapAccount(ACCOUNT, [
        // 0: my service, iOS origin — and my device
        webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 0, credentialId: "mine", rpId: RP_ID, origin: ORIGIN_IOS }),
        // 1: my service, Android origin
        webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 1, credentialId: "android", rpId: RP_ID, origin: ORIGIN_ANDROID }),
        // 2: my rpId but an origin I did not list
        webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 2, credentialId: "web", rpId: RP_ID, origin: "https://beta.zkap.app" }),
        // 3: another service
        webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 3, credentialId: "foreign", rpId: OTHER_RP_ID, origin: OTHER_ORIGIN }),
        // 4: not a passkey at all
        { logic: ADDRESS_LOGIC, keyId: 0, keyType: PrimitiveAccountKeyTypes.keyAddress },
      ]);
    }

    it("returns an empty, deployed:false result for an undeployed account", async () => {
      const { reader } = readerFor({});
      const result = await reader.getPasskeys(ACCOUNT, { service, credentialId: "mine" });
      expect(result).toEqual({
        deployed: false,
        truncated: false,
        readVia: "multicall",
        total: 0,
        txKeys: [],
        passkeys: [],
        unreadable: [],
        myService: [],
        sameRpIdOtherOrigin: [],
        otherServices: [],
      });
    });

    it("classifies keys strictly by rpId AND origin, with per-platform origins", async () => {
      const { reader } = readerFor(mixedAccount());
      const result = await reader.getPasskeys(ACCOUNT, { service, credentialId: "mine", knownRpIds: [OTHER_RP_ID] });

      expect(result.deployed).toBe(true);
      expect(result.total).toBe(5);
      expect(result.passkeys).toHaveLength(4);
      expect(result.unreadable).toEqual([]);

      expect(result.myService.map((k) => k.credentialId)).toEqual(["mine", "android"]);
      expect(result.sameRpIdOtherOrigin.map((k) => k.credentialId)).toEqual(["web"]);
      expect(result.otherServices.map((k) => k.credentialId)).toEqual(["foreign"]);

      const mine = result.mine!;
      expect(mine.index).toBe(0);
      expect(mine.isMine).toBe(true);
      expect(mine.isMyService).toBe(true);
      expect(mine.rpIdMatches).toBe(true);
      expect(mine.originMatches).toBe(true);
      expect(mine.rpId).toBe(RP_ID);
      expect(mine.origin).toBe(ORIGIN_IOS);

      const android = result.myService[1];
      expect(android.origin).toBe(ORIGIN_ANDROID);
      expect(android.isMine).toBe(false);

      const web = result.sameRpIdOtherOrigin[0];
      expect(web.rpIdMatches).toBe(true);
      expect(web.originMatches).toBe(false);
      expect(web.isMyService).toBe(false);
      expect(web.rpId).toBe(RP_ID);
      expect(web.origin).toBeUndefined();

      const foreign = result.otherServices[0];
      expect(foreign.rpIdMatches).toBe(false);
      expect(foreign.rpId).toBe(OTHER_RP_ID); // labelled via knownRpIds
      expect(foreign.origin).toBeUndefined();

      expect(result.passkeys.filter((k) => k.isMine)).toHaveLength(1);
      expect(result.myService.length + result.sameRpIdOtherOrigin.length + result.otherServices.length).toBe(
        result.passkeys.length,
      );
    });

    it("accepts a single origin string and labels foreign origins via knownOrigins", async () => {
      const { reader } = readerFor(mixedAccount());
      const result = await reader.getPasskeys(ACCOUNT, {
        service: { rpId: RP_ID, origins: ORIGIN_IOS },
        knownOrigins: [OTHER_ORIGIN],
      });
      expect(result.myService.map((k) => k.credentialId)).toEqual(["mine"]);
      expect(result.sameRpIdOtherOrigin.map((k) => k.credentialId)).toEqual(["android", "web"]);
      expect(result.otherServices[0].origin).toBe(OTHER_ORIGIN);
      expect(result.otherServices[0].rpId).toBeUndefined();
      expect(result.mine).toBeUndefined();
    });

    it("without a service, leaves match flags undefined and the buckets empty", async () => {
      const { reader } = readerFor(mixedAccount());
      const result = await reader.getPasskeys(ACCOUNT);
      expect(result.passkeys).toHaveLength(4);
      for (const key of result.passkeys) {
        expect(key.rpIdMatches).toBeUndefined();
        expect(key.originMatches).toBeUndefined();
        expect(key.isMyService).toBe(false);
        expect(key.isMine).toBe(false);
      }
      expect(result.myService).toEqual([]);
      expect(result.sameRpIdOtherOrigin).toEqual([]);
      expect(result.otherServices).toEqual([]);
      expect(result.mine).toBeUndefined();
    });

    it("exposes every public-key format and the raw slots", async () => {
      const { reader } = readerFor(mixedAccount());
      const result = await reader.getPasskeys(ACCOUNT);
      const key = result.passkeys[0];
      expect(key.publicKey.x).toBe(X);
      expect(key.publicKey.y).toBe(Y);
      expect(key.publicKey.cose).toBe(`0xa5010203262001215820${X.slice(2)}225820${Y.slice(2)}`);
      expect(key.publicKey.jwk).toEqual({
        kty: "EC",
        crv: "P-256",
        x: Buffer.from(X.slice(2), "hex").toString("base64url"),
        y: Buffer.from(Y.slice(2), "hex").toString("base64url"),
      });
      expect(key.rpIdHash).toBe(rpIdHashOf(RP_ID));
      expect(key.originHash).toBe(originHashOf(ORIGIN_IOS));
      expect(result.txKeys).toEqual(await reader.getTxKeyList(ACCOUNT));
    });

    it("lists a WebAuthn slot whose key data could not be read under unreadable", async () => {
      const { reader } = readerFor(
        zkapAccount(ACCOUNT, [
          webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 0, credentialId: "ok", rpId: RP_ID, origin: ORIGIN_IOS }),
          { logic: WEBAUTHN_LOGIC, keyId: 1, keyType: PrimitiveAccountKeyTypes.keyWebAuthn, keyData: "revert" },
        ]),
      );
      const result = await reader.getPasskeys(ACCOUNT, { service });
      expect(result.passkeys.map((k) => k.credentialId)).toEqual(["ok"]);
      expect(result.unreadable).toEqual([1]);
      expect(result.total).toBe(2);
    });

    it("passes truncated and readVia through", async () => {
      const six: SlotSpec[] = Array.from({ length: 6 }, (_, i) =>
        webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: i, credentialId: `c${i}`, rpId: RP_ID, origin: ORIGIN_IOS }),
      );
      const { reader } = readerFor(zkapAccount(ACCOUNT, six), { multicall: "absent" });
      const result = await reader.getPasskeys(ACCOUNT);
      expect(result.truncated).toBe(true);
      expect(result.readVia).toBe("direct");
    });

    it.each([
      ["empty rpId", { service: { rpId: "", origins: ORIGIN_IOS } }],
      ["empty origins", { service: { rpId: RP_ID, origins: [] } }],
      ["empty origin entry", { service: { rpId: RP_ID, origins: [ORIGIN_IOS, ""] } }],
      ["empty credentialId", { credentialId: "" }],
      ["empty knownRpIds entry", { knownRpIds: [""] }],
      ["empty knownOrigins entry", { knownOrigins: [""] }],
    ])("rejects %s before any RPC", async (_label, opts) => {
      const { chain, reader } = readerFor(mixedAccount());
      await rejectsWith(reader.getPasskeys(ACCOUNT, opts), AaOperationError, AaOperationErrorCode.INPUT_INVALID);
      expect(chain.sent).toHaveLength(0);
    });
  });

  describe("findTxKeysByRpId", () => {
    const slot = (keyId: number, credentialId: string, rpId: string, origin = ORIGIN_IOS) =>
      webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId, credentialId, rpId, origin });

    it("returns matching webauthn keys by rpIdHash", async () => {
      const { reader } = readerFor(zkapAccount(ACCOUNT, [slot(0, "cred-1", RP_ID)]));
      const keys = await reader.findTxKeysByRpId(ACCOUNT, rpIdHashOf(RP_ID));
      expect(keys).toHaveLength(1);
      expect(keys[0].webauthn!.credentialId).toBe("cred-1");
    });

    it("returns an empty array when no rpIdHash matches", async () => {
      const { reader } = readerFor(zkapAccount(ACCOUNT, [slot(0, "cred-1", OTHER_RP_ID)]));
      expect(await reader.findTxKeysByRpId(ACCOUNT, rpIdHashOf(RP_ID))).toHaveLength(0);
    });

    it("returns multiple matching keys", async () => {
      const { reader } = readerFor(zkapAccount(ACCOUNT, [slot(0, "cred-1", RP_ID), slot(1, "cred-2", RP_ID)]));
      const keys = await reader.findTxKeysByRpId(ACCOUNT, rpIdHashOf(RP_ID));
      expect(keys.map((k) => k.webauthn!.credentialId)).toEqual(["cred-1", "cred-2"]);
    });

    it("filters out non-webauthn keys", async () => {
      const { reader } = readerFor(
        zkapAccount(ACCOUNT, [
          { logic: ADDRESS_LOGIC, keyId: 0, keyType: PrimitiveAccountKeyTypes.keyAddress },
          slot(1, "cred-webauthn", RP_ID),
        ]),
      );
      const keys = await reader.findTxKeysByRpId(ACCOUNT, rpIdHashOf(RP_ID));
      expect(keys).toHaveLength(1);
      expect(keys[0].webauthn!.credentialId).toBe("cred-webauthn");
    });

    it("matches rpIdHash case-insensitively", async () => {
      const { reader } = readerFor(zkapAccount(ACCOUNT, [slot(0, "cred-1", RP_ID)]));
      expect(await reader.findTxKeysByRpId(ACCOUNT, rpIdHashOf(RP_ID).toUpperCase().replace("0X", "0x"))).toHaveLength(1);
    });

    it("returns an empty array when no keys exist", async () => {
      const { reader } = readerFor(zkapAccount(ACCOUNT, []));
      expect(await reader.findTxKeysByRpId(ACCOUNT, rpIdHashOf(RP_ID))).toHaveLength(0);
    });
  });

  describe("getMasterKeyInfo (over the injected transport)", () => {
    const accountIface = new ethers.Interface([
      "function masterKeyList(uint256 index) view returns (address logic, uint256 keyId)",
      "function masterKeyThreshold() view returns (uint8)",
      "function txKeyThreshold() view returns (uint8)",
    ]);
    const verifierIface = new ethers.Interface([
      "function getAnchor(uint256 keyId) view returns (uint256[] anchor)",
      "function getData(uint256 keyId) view returns (uint256 n, uint256 k, uint256 hAudList, uint256[] anchor)",
    ]);
    const sel = (iface: ethers.Interface, name: string) => iface.getFunction(name)!.selector;

    type MasterSpec = {
      masterKeyList?: [string, number] | "revert";
      threshold?: number | "revert";
      getData?: bigint[] | "revert";
      getAnchor?: bigint[] | "revert";
    };

    function masterHandlers(spec: MasterSpec): { handlers: Record<string, Handler>; calls: string[] } {
      const calls: string[] = [];
      const handlers: Record<string, Handler> = {
        [ACCOUNT]: (data) => {
          if (data.startsWith(sel(accountIface, "masterKeyList"))) {
            calls.push("masterKeyList");
            const v = spec.masterKeyList ?? [VERIFIER, 0];
            return v === "revert" ? { revert: true } : accountIface.encodeFunctionResult("masterKeyList", v);
          }
          if (data.startsWith(sel(accountIface, "masterKeyThreshold"))) {
            calls.push("masterKeyThreshold");
            const v = spec.threshold ?? 1;
            return v === "revert" ? { revert: true } : accountIface.encodeFunctionResult("masterKeyThreshold", [v]);
          }
          if (data.startsWith(sel(accountIface, "txKeyThreshold"))) {
            calls.push("txKeyThreshold");
            return accountIface.encodeFunctionResult("txKeyThreshold", [1]);
          }
          return { revert: true };
        },
        [VERIFIER]: (data) => {
          if (data.startsWith(sel(verifierIface, "getData"))) {
            calls.push("getData");
            const v = spec.getData ?? "revert";
            return v === "revert"
              ? { revert: true }
              : verifierIface.encodeFunctionResult("getData", [17, 6, 0, v]);
          }
          if (data.startsWith(sel(verifierIface, "getAnchor"))) {
            calls.push("getAnchor");
            const v = spec.getAnchor ?? "revert";
            return v === "revert" ? { revert: true } : verifierIface.encodeFunctionResult("getAnchor", [v]);
          }
          return { revert: true };
        },
      };
      return { handlers, calls };
    }

    it("reads masterKeyThreshold (not txKeyThreshold)", async () => {
      const { handlers, calls } = masterHandlers({ threshold: 1 });
      const { reader } = readerFor(handlers);
      const info = await reader.getMasterKeyInfo(ACCOUNT);
      expect(info.threshold).toBe(1);
      expect(calls).toContain("masterKeyThreshold");
      expect(calls).not.toContain("txKeyThreshold");
      expect(info.verifierAddress.toLowerCase()).toBe(VERIFIER);
    });

    it("is3of3 follows the anchor count from getData", async () => {
      const three = masterHandlers({ threshold: 3, getData: [BigInt(1), BigInt(2), BigInt(3)] });
      const infoThree = await readerFor(three.handlers).reader.getMasterKeyInfo(ACCOUNT);
      expect(infoThree.threshold).toBe(3);
      expect(infoThree.keyCount).toBe(3);
      expect(infoThree.is3of3).toBe(true);

      const two = masterHandlers({ threshold: 1, getData: [BigInt(111), BigInt(222)] });
      const infoTwo = await readerFor(two.handlers).reader.getMasterKeyInfo(ACCOUNT);
      expect(infoTwo.anchor).toEqual(["111", "222"]);
      expect(infoTwo.is3of3).toBe(false);
    });

    it("falls back to getAnchor when getData reverts", async () => {
      const { handlers } = masterHandlers({ getData: "revert", getAnchor: [BigInt(10), BigInt(20), BigInt(30)] });
      const info = await readerFor(handlers).reader.getMasterKeyInfo(ACCOUNT);
      expect(info.anchor).toEqual(["10", "20", "30"]);
      expect(info.keyCount).toBe(3);
    });

    it("defaults when neither anchor accessor nor threshold is available", async () => {
      const { handlers } = masterHandlers({ threshold: "revert", getData: "revert", getAnchor: "revert" });
      const info = await readerFor(handlers).reader.getMasterKeyInfo(ACCOUNT);
      expect(info).toEqual({
        threshold: 1,
        keyCount: 1,
        is3of3: false,
        anchor: [],
        verifierAddress: ethers.getAddress(VERIFIER),
      });
    });

    it("throws TRANSPORT when masterKeyList(0) cannot be read", async () => {
      const { handlers } = masterHandlers({ masterKeyList: "revert" });
      const promise = readerFor(handlers).reader.getMasterKeyInfo(ACCOUNT);
      await rejectsWith(promise, AaFetchError, AaFetchErrorCode.TRANSPORT);
      await expect(promise).rejects.toThrow("AccountReader: failed to read masterKeyList(0)");
    });
  });

  describe("without Multicall3", () => {
    const oneKey = () =>
      zkapAccount(ACCOUNT, [
        webauthnSlot({ logic: WEBAUTHN_LOGIC, keyId: 7, credentialId: "cred-a", rpId: RP_ID, origin: ORIGIN_IOS }),
      ]);

    it("provider mode: confirms absence with eth_getCode, then reads per call with the same result", async () => {
      const present = fakeChain(oneKey());
      const expected = await new AccountReader({ provider: fakeProvider(present) }).readTxKeySlots(ACCOUNT);

      const absent = fakeChain(oneKey(), { multicall: "absent" });
      const reader = new AccountReader({ provider: fakeProvider(absent) });
      const slots = await reader.readTxKeySlots(ACCOUNT);

      expect(slots).toEqual({ ...expected, readVia: "direct" });
      expect(expected.readVia).toBe("multicall");
      expect(absent.multicallRequests()).toBe(1);
      // 6 slot probes + 2 detail calls, all direct
      expect(absent.sent).toHaveLength(1 + 6 + 2);

      // Absence is remembered: no further aggregate3 attempts.
      await reader.readTxKeySlots(ACCOUNT);
      expect(absent.multicallRequests()).toBe(1);
    });

    it("call-only mode: falls back without eth_getCode", async () => {
      const absent = fakeChain(oneKey(), { multicall: "absent" });
      const reader = new AccountReader({ call: absent.call });
      const slots = await reader.readTxKeySlots(ACCOUNT);
      expect(slots.readVia).toBe("direct");
      expect(slots.keys[0].webauthn?.credentialId).toBe("cred-a");
    });

    it("provider mode: a transport that answers 0x for a present Multicall3 is rejected as RESPONSE_SHAPE", async () => {
      const lying = fakeChain(oneKey(), { multicall: "lying" });
      const reader = new AccountReader({ provider: fakeProvider(lying) });
      await rejectsWith(reader.readTxKeySlots(ACCOUNT), AaFetchError, AaFetchErrorCode.RESPONSE_SHAPE);
    });

    it("multicallAddress:false never touches Multicall3", async () => {
      const chain = fakeChain(oneKey());
      const reader = new AccountReader({ call: chain.call, multicallAddress: false });
      const slots = await reader.readTxKeySlots(ACCOUNT);
      expect(slots.readVia).toBe("direct");
      expect(chain.multicallRequests()).toBe(0);
    });

    it("a custom multicallAddress is used as the aggregate3 target", async () => {
      const custom = "0x" + "77".repeat(20);
      const chain = fakeChain(oneKey(), { multicallAddress: custom });
      const reader = new AccountReader({ call: chain.call, multicallAddress: custom });
      const slots = await reader.readTxKeySlots(ACCOUNT);
      expect(slots.readVia).toBe("multicall");
      expect(chain.sent[0].to).toBe(custom);
    });

    it("garbage from aggregate3 is RESPONSE_SHAPE", async () => {
      const chain = fakeChain(oneKey(), { multicall: "garbage" });
      const reader = new AccountReader({ call: chain.call });
      await rejectsWith(reader.readTxKeySlots(ACCOUNT), AaFetchError, AaFetchErrorCode.RESPONSE_SHAPE);
    });
  });
});
