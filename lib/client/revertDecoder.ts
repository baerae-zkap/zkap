import { ethers } from "ethers";

import { EntryPointABI, ZkapAccountABI, ZkapPaymasterABI } from "../types/abi";
import type { DecodedContractError } from "../errors";

/**
 * Decodes revert bytes into a contract custom-error name + args.
 *
 * Combines the error fragments the SDK ships (EntryPoint + ZkapAccount +
 * ZkapPaymaster). ethers adds the standard `Error(string)` / `Panic(uint256)`
 * fragments automatically, so those decode too. Selectors are deterministic
 * (`keccak(signature)[:4]`), so this matches the deployed bytecode.
 *
 * Verified against real Base Sepolia receipts: `Error("ERC20: transfer amount
 * exceeds balance")`, OZ `FailedCall`, and unknown target selectors (→ undefined).
 */
const errorInterface = new ethers.Interface(
  [...EntryPointABI, ...ZkapAccountABI, ...ZkapPaymasterABI].filter(
    (f: { type?: string }) => f.type === "error",
  ),
);

/** EntryPoint interface for event-log parsing (UserOperationRevertReason). */
const entryPointInterface = new ethers.Interface(EntryPointABI);

/**
 * Make decoded error args JSON-safe. ethers returns `bigint` for uint args, which
 * would make `JSON.stringify(error)` throw — so BigInts (and nested objects) are
 * stringified. JSON-safe primitives are kept as-is.
 */
function jsonSafeArgs(args: ReadonlyArray<unknown>): unknown[] {
  return args.map((a) => {
    if (typeof a === "bigint") return a.toString();
    if (typeof a === "object" && a !== null) return String(a);
    return a;
  });
}

/** Returns the value as a 0x-prefixed hex string if it looks like revert data, else undefined. */
export function extractHex(data: unknown): `0x${string}` | undefined {
  if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) {
    return data as `0x${string}`;
  }
  // Some bundlers nest the hex under error.data.data / .revertData.
  if (data && typeof data === "object") {
    const nested = (data as { data?: unknown; revertData?: unknown });
    return extractHex(nested.data) ?? extractHex(nested.revertData);
  }
  return undefined;
}

/**
 * Best-effort decode of revert bytes. Returns undefined for empty input or a
 * selector the SDK does not know (the caller preserves the raw bytes + selector
 * so the consumer can decode with their own target ABI).
 *
 * Unwraps EntryPoint `FailedOpWithRevert(opIndex, reason, inner)` one level to
 * recover the actual contract error carried in `inner`.
 */
export function decodeContractError(data?: string): DecodedContractError | undefined {
  if (!data || data === "0x") return undefined;
  let outer: ethers.ErrorDescription | null;
  try {
    outer = errorInterface.parseError(data);
  } catch {
    return undefined; // unknown selector
  }
  if (!outer) return undefined;
  if (outer.name === "FailedOpWithRevert") {
    const inner = outer.args[2] as string;
    try {
      const decodedInner = errorInterface.parseError(inner);
      if (decodedInner) return { name: decodedInner.name, args: jsonSafeArgs(decodedInner.args) };
    } catch {
      // inner not decodable — fall through to the outer (FailedOpWithRevert)
    }
  }
  return { name: outer.name, args: jsonSafeArgs(outer.args) };
}

type EventLog = { topics: ReadonlyArray<string>; data: string };

/**
 * Extracts the execution-revert reason bytes from a UserOp receipt's logs by
 * parsing the EntryPoint `UserOperationRevertReason` event. A top-level `reason`
 * field (some bundlers expose it) takes precedence. Returns undefined when the
 * op succeeded or no revert reason is present.
 */
export function extractExecutionRevert(
  logs: ReadonlyArray<EventLog> | undefined,
  topLevelReason?: string,
): string | undefined {
  if (typeof topLevelReason === "string" && topLevelReason !== "0x") return topLevelReason;
  for (const log of logs ?? []) {
    let parsed;
    try {
      parsed = entryPointInterface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue; // not an EntryPoint event
    }
    if (parsed && parsed.name === "UserOperationRevertReason") {
      return parsed.args.revertReason as string;
    }
  }
  return undefined;
}
