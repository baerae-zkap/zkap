/**
 * An in-memory chain for AccountReader tests.
 *
 * Encodes and decodes with the REAL ethers coder so the tests pin the ABI
 * signatures the reader depends on — a mocked `Contract` would pass even if a
 * fragment drifted. Handlers answer per target address; Multicall3 is
 * emulated by decoding `aggregate3` and answering each sub-call.
 */
import { ethers } from "ethers";
import { AccountKeyWebAuthnABI, Multicall3ABI, ZkapAccountABI } from "../../types/abi";
import { PrimitiveAccountKeyTypes } from "../../types/AccountKey";
import { MULTICALL3_ADDRESS } from "../../reader/transport";
import type { EthCall } from "../../reader/transport";
import { originHashOf, rpIdHashOf } from "../../utils/webauthnKey";

/** What a handler returns for one call: hex data, a revert, or "this address has no code". */
export type Answer = string | { revert: true; data?: string } | "nocode";
export type Handler = (callData: string) => Answer;

/**
 * - `present` — Multicall3 works.
 * - `absent`  — `aggregate3` answers `0x` and `getCode` says no code (a chain without Multicall3).
 * - `lying`   — `aggregate3` answers `0x` but `getCode` shows code (a transport returning bogus data).
 * - `garbage` — `aggregate3` answers undecodable bytes.
 */
export type MulticallMode = "present" | "absent" | "lying" | "garbage";

export const multicallIface = new ethers.Interface(Multicall3ABI);
export const accountIface = new ethers.Interface(ZkapAccountABI);
export const webAuthnIface = new ethers.Interface(AccountKeyWebAuthnABI);
export const coder = ethers.AbiCoder.defaultAbiCoder();

/** Some bytecode — anything but "0x". */
export const CODE = "0x6080604052";
/** Solidity `Panic(0x32)` — array index out of bounds. */
export const PANIC_OOB = "0x4e487b71" + coder.encode(["uint256"], [0x32]).slice(2);

export function encodeAggregate3Results(results: { success: boolean; returnData: string }[]): string {
  return coder.encode(["(bool,bytes)[]"], [results.map((r) => [r.success, r.returnData])]);
}

export function decodeAggregate3Calls(data: string): { target: string; allowFailure: boolean; callData: string }[] {
  const [calls] = multicallIface.decodeFunctionData("aggregate3", data);
  return Array.from(calls as Iterable<unknown>).map((c) => {
    const [target, allowFailure, callData] = c as unknown as [string, boolean, string];
    return { target, allowFailure, callData };
  });
}

export interface FakeChain {
  call: EthCall;
  getCode: (address: string) => Promise<string>;
  /** Every request, in order. */
  sent: { to: string; data: string }[];
  /** How many of `sent` went to Multicall3. */
  multicallRequests: () => number;
}

export function fakeChain(
  handlers: Record<string, Handler>,
  opts: { multicall?: MulticallMode; multicallAddress?: string } = {},
): FakeChain {
  const mode = opts.multicall ?? "present";
  const multicallAddress = (opts.multicallAddress ?? MULTICALL3_ADDRESS).toLowerCase();
  const byAddress = new Map(Object.entries(handlers).map(([address, handler]) => [address.toLowerCase(), handler]));
  const sent: { to: string; data: string }[] = [];

  const answer = (to: string, data: string): Answer => byAddress.get(to.toLowerCase())?.(data) ?? "nocode";

  const call: EthCall = async ({ to, data }) => {
    sent.push({ to, data });

    if (to.toLowerCase() === multicallAddress) {
      if (mode === "absent" || mode === "lying") return "0x";
      if (mode === "garbage") return "0xdeadbeef";
      const results = decodeAggregate3Calls(data).map(({ target, callData }) => {
        const a = answer(target, callData);
        if (a === "nocode") return { success: true, returnData: "0x" };
        if (typeof a === "string") return { success: true, returnData: a };
        return { success: false, returnData: a.data ?? "0x" };
      });
      return encodeAggregate3Results(results);
    }

    const a = answer(to, data);
    if (a === "nocode") return "0x";
    if (typeof a === "string") return a;
    // What ethers' provider.call throws for a revert.
    throw Object.assign(new Error("execution reverted"), { code: "CALL_EXCEPTION", data: a.data ?? null });
  };

  const getCode = async (address: string): Promise<string> => {
    if (address.toLowerCase() === multicallAddress) return mode === "absent" ? "0x" : CODE;
    return byAddress.has(address.toLowerCase()) ? CODE : "0x";
  };

  return {
    call,
    getCode,
    sent,
    multicallRequests: () => sent.filter((s) => s.to.toLowerCase() === multicallAddress).length,
  };
}

/** An `ethers.Provider` stand-in backed by a {@link FakeChain}. */
export function fakeProvider(chain: FakeChain, balance = BigInt(0)): ethers.Provider {
  return {
    call: (tx: { to?: unknown; data?: unknown }) => chain.call({ to: tx.to as string, data: tx.data as string }),
    getCode: chain.getCode,
    getBalance: async () => balance,
  } as unknown as ethers.Provider;
}

// ---------------------------------------------------------------------------
// ZkapAccount + key logic emulation
// ---------------------------------------------------------------------------

export interface KeyDataSpec {
  x: string;
  y: string;
  credentialId: string;
  originHash: string;
  rpIdHash: string;
}

export interface SlotSpec {
  logic: string;
  keyId: number;
  /** `PrimitiveAccountKeyTypes` value (default WebAuthn), or how `keyType()` misbehaves. */
  keyType?: number | "revert" | "garbage";
  /** `getKeyData` answer; omitted = revert (non-WebAuthn logic). */
  keyData?: KeyDataSpec | "revert" | "garbage";
}

export const X = "0x" + "12".repeat(32);
export const Y = "0x" + "34".repeat(32);

/** A WebAuthn slot whose hashes are derived from a plaintext rpId/origin. */
export function webauthnSlot(spec: {
  logic: string;
  keyId: number;
  credentialId: string;
  rpId: string;
  origin: string;
  x?: string;
  y?: string;
}): SlotSpec {
  return {
    logic: spec.logic,
    keyId: spec.keyId,
    keyType: PrimitiveAccountKeyTypes.keyWebAuthn,
    keyData: {
      x: spec.x ?? X,
      y: spec.y ?? Y,
      credentialId: spec.credentialId,
      originHash: originHashOf(spec.origin),
      rpIdHash: rpIdHashOf(spec.rpId),
    },
  };
}

const txKeyListSelector = accountIface.getFunction("txKeyList")!.selector;
const keyTypeSelector = webAuthnIface.getFunction("keyType")!.selector;
const getKeyDataSelector = webAuthnIface.getFunction("getKeyData")!.selector;

/**
 * Handlers for a deployed ZkapAccount with the given txKey slots, plus one
 * handler per distinct key logic contract. `txKeyList(i)` reverts past the
 * last slot, like the real array getter.
 */
export function zkapAccount(
  account: string,
  slots: SlotSpec[],
  opts: { zeroAt?: number; garbageAt?: number } = {},
): Record<string, Handler> {
  const handlers: Record<string, Handler> = {};

  handlers[account] = (data) => {
    if (!data.startsWith(txKeyListSelector)) return { revert: true };
    const [index] = accountIface.decodeFunctionData("txKeyList", data);
    const i = Number(index);
    if (opts.garbageAt === i) return "0x1234";
    if (opts.zeroAt === i) return accountIface.encodeFunctionResult("txKeyList", [ethers.ZeroAddress, 0]);
    if (i < slots.length) return accountIface.encodeFunctionResult("txKeyList", [slots[i].logic, slots[i].keyId]);
    return { revert: true, data: PANIC_OOB };
  };

  const logics = [...new Set(slots.map((s) => s.logic.toLowerCase()))];
  for (const logic of logics) {
    const specs = slots.filter((s) => s.logic.toLowerCase() === logic);
    handlers[logic] = (data) => {
      if (data.startsWith(keyTypeSelector)) {
        const keyType = specs[0].keyType ?? PrimitiveAccountKeyTypes.keyWebAuthn;
        if (keyType === "revert") return { revert: true };
        if (keyType === "garbage") return "0x12";
        return coder.encode(["uint8"], [keyType]);
      }
      if (data.startsWith(getKeyDataSelector)) {
        const [, , keyId] = webAuthnIface.decodeFunctionData("getKeyData", data);
        const keyData = specs.find((s) => s.keyId === Number(keyId))?.keyData;
        if (keyData === undefined || keyData === "revert") return { revert: true };
        if (keyData === "garbage") return "0xabcdef";
        return webAuthnIface.encodeFunctionResult("getKeyData", [
          keyData.x,
          keyData.y,
          keyData.credentialId,
          keyData.originHash,
          keyData.rpIdHash,
        ]);
      }
      return { revert: true };
    };
  }

  return handlers;
}
