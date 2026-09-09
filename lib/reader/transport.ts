import { ethers } from "ethers";
import { Multicall3ABI } from "../types/abi";
import { AaFetchError, AaFetchErrorCode } from "../errors";
import type { ReadVia } from "./types";

/**
 * The one transport primitive the reader needs: an `eth_call` against `to`
 * with `data`, resolving to the returned hex.
 *
 * **Contract:** resolve only with what the node actually returned. A transport
 * failure, an HTTP error, or a JSON-RPC `error` object MUST throw — never
 * swallow them into `"0x"` or `""`. The reader interprets `"0x"` as "a
 * successful call to an address without code" (an undeployed account, or a
 * chain without Multicall3); a transport that returns `"0x"` on failure would
 * make a dead node look like a missing wallet. `ethers.Provider.call` and any
 * JSON-RPC proxy that throws on `error` satisfy this.
 */
export type EthCall = (params: { to: string; data: string }) => Promise<string>;

/** One sub-call of a Multicall3 `aggregate3` batch. */
export interface Call3 {
  target: string;
  allowFailure: boolean;
  callData: string;
}

/** One sub-result of a Multicall3 `aggregate3` batch. */
export interface Result3 {
  success: boolean;
  returnData: string;
}

/** Multicall3 — deployed at the same address on every major chain. */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

const multicallIface = new ethers.Interface(Multicall3ABI);

/** Adapt an ethers `Provider` to {@link EthCall}. */
export function ethCallFromProvider(provider: ethers.Provider): EthCall {
  return async ({ to, data }) => await provider.call({ to, data });
}

/**
 * Did this sub-call succeed with actual data? Empty `returnData` on success is
 * how a call to an address without code comes back, so it does not count.
 */
export function hasValue(result: Result3): boolean {
  return result.success && result.returnData !== "0x" && result.returnData.length > 2;
}

export interface BatchCallerOptions {
  call: EthCall;
  /**
   * `eth_getCode`, when the transport can do it (provider modes). Used once,
   * only if `aggregate3` answers `0x`, to tell "no Multicall3 on this chain"
   * from "the transport returned bogus empty data".
   */
  getCode?: (address: string) => Promise<string>;
  /** Multicall3 address; `false` disables batching and always calls per slot. */
  multicallAddress?: string | false;
  /**
   * Classifies an error thrown by `call` on the per-call fallback path as a
   * revert (end of list) rather than a transport failure. Defaults to
   * `ethers.isCallException`, which recognises ethers' errors; a raw JSON-RPC
   * proxy needs its own (only matters on chains without Multicall3).
   */
  isRevertError?: (err: unknown) => boolean;
  /** Surfaced as `AaFetchError.url` for diagnostics (rpcUrl mode). */
  url?: string;
}

/**
 * Executes a round of `eth_call`s as one Multicall3 `aggregate3` when the chain
 * has Multicall3, and as parallel individual calls otherwise. Both paths yield
 * the same `Result3[]`, so callers decode identically.
 */
export class BatchCaller {
  private readonly call: EthCall;
  private readonly getCode?: (address: string) => Promise<string>;
  private readonly multicallAddress: string | false;
  private readonly isRevertError: (err: unknown) => boolean;
  private readonly url?: string;
  private _multicallAvailable: boolean | undefined;

  constructor(opts: BatchCallerOptions) {
    this.call = opts.call;
    this.getCode = opts.getCode;
    this.multicallAddress = opts.multicallAddress === undefined ? MULTICALL3_ADDRESS : opts.multicallAddress;
    this.isRevertError = opts.isRevertError ?? ethers.isCallException;
    this.url = opts.url;
    this._multicallAvailable = this.multicallAddress === false ? false : undefined;
  }

  /** `undefined` until the first round; `false` once Multicall3 is known to be absent. */
  get multicallAvailable(): boolean | undefined {
    return this._multicallAvailable;
  }

  async batch(calls: Call3[], operation: string): Promise<{ results: Result3[]; via: ReadVia }> {
    const multicallAddress = this.multicallAddress;
    if (multicallAddress !== false && this._multicallAvailable !== false) {
      const raw = await this.send(
        {
          to: multicallAddress,
          data: multicallIface.encodeFunctionData("aggregate3", [
            calls.map((c) => [c.target, c.allowFailure, c.callData]),
          ]),
        },
        operation,
      );
      // Check for "no code here" BEFORE decoding: ethers throws the same
      // BAD_DATA for "0x" as for a corrupt payload, so a catch could not tell
      // an absent Multicall3 from a broken transport.
      if (raw !== "0x") {
        this._multicallAvailable = true;
        return { results: this.decodeAggregate3(raw, calls.length, operation), via: "multicall" };
      }
      await this.confirmMulticallAbsent(multicallAddress, raw, operation);
    }
    return { results: await this.direct(calls, operation), via: "direct" };
  }

  private async send(params: { to: string; data: string }, operation: string): Promise<string> {
    try {
      return await this.call(params);
    } catch (err) {
      throw this.transportError(operation, err, `AccountReader: eth_call to ${params.to} failed`);
    }
  }

  private async confirmMulticallAbsent(multicallAddress: string, raw: string, operation: string): Promise<void> {
    if (this.getCode) {
      let code: string;
      try {
        code = await this.getCode(multicallAddress);
      } catch (err) {
        throw this.transportError(operation, err, `AccountReader: eth_getCode for Multicall3 at ${multicallAddress} failed`);
      }
      if (code !== "0x") {
        throw new AaFetchError({
          code: AaFetchErrorCode.RESPONSE_SHAPE,
          operation,
          service: "rpc",
          url: this.url,
          method: "POST",
          rawResponse: raw,
          message:
            `AccountReader: Multicall3 at ${multicallAddress} has code but aggregate3 returned empty data — ` +
            "the transport returned a bogus result",
        });
      }
    }
    this._multicallAvailable = false;
  }

  private decodeAggregate3(raw: string, expected: number, operation: string): Result3[] {
    let entries: unknown[];
    try {
      const [decoded] = multicallIface.decodeFunctionResult("aggregate3", raw);
      entries = Array.from(decoded as Iterable<unknown>);
    } catch (err) {
      throw this.shapeError(operation, raw, err, "AccountReader: aggregate3 returned undecodable data");
    }
    if (entries.length !== expected) {
      throw this.shapeError(
        operation,
        raw,
        undefined,
        `AccountReader: aggregate3 returned ${entries.length} results for ${expected} calls`,
      );
    }
    return entries.map((entry) => {
      const [success, returnData] = entry as unknown as [boolean, string];
      return { success, returnData };
    });
  }

  private async direct(calls: Call3[], operation: string): Promise<Result3[]> {
    return await Promise.all(
      calls.map(async (c): Promise<Result3> => {
        try {
          return { success: true, returnData: await this.call({ to: c.target, data: c.callData }) };
        } catch (err) {
          if (this.isRevertError(err)) {
            const data = (err as { data?: unknown }).data;
            return { success: false, returnData: typeof data === "string" ? data : "0x" };
          }
          throw this.transportError(operation, err, `AccountReader: eth_call to ${c.target} failed`);
        }
      }),
    );
  }

  private transportError(operation: string, cause: unknown, message: string): AaFetchError {
    return new AaFetchError({
      code: AaFetchErrorCode.TRANSPORT,
      operation,
      service: "rpc",
      url: this.url,
      method: "POST",
      cause,
      message,
    });
  }

  private shapeError(operation: string, raw: string, cause: unknown, message: string): AaFetchError {
    return new AaFetchError({
      code: AaFetchErrorCode.RESPONSE_SHAPE,
      operation,
      service: "rpc",
      url: this.url,
      method: "POST",
      rawResponse: raw,
      cause,
      message,
    });
  }
}
