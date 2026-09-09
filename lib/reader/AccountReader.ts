import { ethers } from "ethers";
import { AccountKeyWebAuthnABI, ZkapAccountABI } from "../types/abi";
import { AaFetchError, AaFetchErrorCode, AaOperationError, AaOperationErrorCode } from "../errors";
import { BatchCaller, ethCallFromProvider, hasValue } from "./transport";
import type { Call3, EthCall, Result3 } from "./transport";
import { buildPasskeysResult, normalizeOptions } from "./passkeys";
import type { GetPasskeysOptions, PasskeysResult } from "./passkeys";
import { keyTypeFromPrimitive } from "./types";
import type { KeyType, MasterKeyInfo, TxKeyInfo, TxKeySlots, WebAuthnKeyData } from "./types";

// Re-exported so existing `import … from "./reader/AccountReader"` paths keep resolving.
export type { KeyType, WebAuthnKeyData, TxKeyInfo, MasterKeyInfo, TxKeySlots, ReadVia } from "./types";

/** Tuning knobs shared by every transport mode. */
export interface AccountReaderOptions {
  /** Multicall3 address; `false` disables batching. Default: the canonical address. */
  multicallAddress?: string | false;
  /**
   * How many txKey slots to read (default 5, the WebAuthn singleton's per-account
   * cap). The account contract has its own limit; this exists for forward
   * compatibility only. Integer ≥ 1.
   */
  maxTxKeys?: number;
  /** See {@link BatchCallerOptions.isRevertError}. Only matters on chains without Multicall3. */
  isRevertError?: (err: unknown) => boolean;
}

/**
 * Exactly one transport:
 * - `{ rpcUrl, chainId? }` — the reader builds an ethers `JsonRpcProvider` (original behaviour).
 * - `{ provider }` — any ethers `Provider` (e.g. `BrowserProvider`, a shared `JsonRpcProvider`).
 * - `{ call }` — a bare `eth_call` function (proxy / relay). `isDeployed` and
 *   `getBalance` are unavailable in this mode; use `readTxKeySlots().deployed`.
 */
export type AccountReaderConfig = AccountReaderOptions &
  (
    | { rpcUrl: string; chainId?: number }
    | { provider: ethers.Provider }
    | { call: EthCall }
  );

const DEFAULT_MAX_TX_KEYS = 5;
/** `IAccountKey.KeyPurpose.Tx` */
const KEY_PURPOSE_TX = 1;
const READ_TX_KEYS = "read_tx_keys";

const accountIface = new ethers.Interface(ZkapAccountABI);
// `keyType()` is common to every key logic contract; the WebAuthn ABI carries it too.
const webAuthnIface = new ethers.Interface(AccountKeyWebAuthnABI);

// Minimal ABI fragments for getMasterKeyInfo
const ZKAP_ACCOUNT_ABI = [
  "function txKeyList(uint256 index) view returns (address logic, uint256 keyId)",
  "function txKeyThreshold() view returns (uint8)",
  "function masterKeyThreshold() view returns (uint8)",
  "function txKeyWeightList(uint256 index) view returns (uint8)",
  "function masterKeyList(uint256 index) view returns (address logic, uint256 keyId)",
];

// ZkOAuth verifier ABI
const ZK_OAUTH_VERIFIER_ABI = [
  "function getAnchor(uint256 keyId) view returns (uint256[] anchor)",
  "function getData(uint256 keyId) view returns (uint256 n, uint256 k, uint256 hAudList, uint256[] anchor)",
];

/**
 * Read-only utility for inspecting on-chain state of a deployed ZkapAccount.
 *
 * txKey reads go through Multicall3 — two `eth_call`s for any number of keys —
 * and fall back to parallel individual calls on chains without it. A transport
 * failure throws `AaFetchError`; an empty result always means "no keys", never
 * "the node did not answer".
 *
 * @example
 * ```ts
 * const reader = new AccountReader({ rpcUrl: "https://arb1.arbitrum.io/rpc", chainId: 42161 });
 * const { deployed, mine, myService } = await reader.getPasskeys(account, {
 *   service: { rpId: "zkap.app", origins: ["https://zkap.app", "android:apk-key-hash:…"] },
 *   credentialId: localPasskeyId,
 * });
 * ```
 */
export class AccountReader {
  private readonly provider?: ethers.Provider;
  private readonly rpcUrl?: string;
  private readonly ethCall: EthCall;
  private readonly batch: BatchCaller;
  private readonly runner: ethers.ContractRunner;
  private readonly maxTxKeys: number;

  constructor(config: AccountReaderConfig) {
    const c = config as AccountReaderOptions & {
      rpcUrl?: string;
      chainId?: number;
      provider?: ethers.Provider;
      call?: EthCall;
    };

    const transports = [c.rpcUrl !== undefined, c.provider !== undefined, c.call !== undefined].filter(Boolean).length;
    if (transports === 0) {
      throw new AaOperationError({
        code: AaOperationErrorCode.CONFIG_REQUIRED_FIELD_MISSING,
        operation: "account_reader",
        message: "AccountReader: one of rpcUrl, provider or call is required",
      });
    }
    if (transports > 1) {
      throw new AaOperationError({
        code: AaOperationErrorCode.INPUT_INVALID,
        operation: "account_reader",
        message: "AccountReader: rpcUrl, provider and call are mutually exclusive — pass exactly one",
      });
    }

    const maxTxKeys = c.maxTxKeys ?? DEFAULT_MAX_TX_KEYS;
    if (!Number.isInteger(maxTxKeys) || maxTxKeys < 1) {
      throw new AaOperationError({
        code: AaOperationErrorCode.INPUT_OUT_OF_RANGE,
        operation: "account_reader",
        message: `AccountReader: maxTxKeys must be an integer >= 1 (got ${maxTxKeys})`,
      });
    }
    this.maxTxKeys = maxTxKeys;

    if (c.call !== undefined) {
      this.ethCall = c.call;
    } else {
      const provider =
        c.provider ??
        new ethers.JsonRpcProvider(c.rpcUrl, undefined, {
          staticNetwork: c.chainId ? ethers.Network.from(c.chainId) : true,
        });
      this.provider = provider;
      this.rpcUrl = c.rpcUrl;
      this.ethCall = ethCallFromProvider(provider);
    }

    const provider = this.provider;
    this.batch = new BatchCaller({
      call: this.ethCall,
      getCode: provider ? (address) => provider.getCode(address) : undefined,
      multicallAddress: c.multicallAddress,
      isRevertError: c.isRevertError,
      url: this.rpcUrl,
    });
    // Lets ethers.Contract run view calls over the injected transport without a Provider.
    this.runner = {
      provider: null,
      call: (tx) => this.ethCall({ to: tx.to as string, data: tx.data as string }),
    };
  }

  /**
   * Check whether a ZkapAccount has been deployed on-chain.
   *
   * Needs `rpcUrl` or `provider` (`eth_getCode`). In `call` mode use
   * {@link readTxKeySlots} / {@link getPasskeys} — they report `deployed` for free.
   *
   * @param address - The counterfactual or deployed account address.
   * @returns `true` if the account has deployed bytecode; `false` if it is still counterfactual.
   */
  async isDeployed(address: string): Promise<boolean> {
    const code = await this.requireProvider("is_deployed", "isDeployed").getCode(address);
    return code !== "0x";
  }

  /**
   * Return the native token balance of the account. Needs `rpcUrl` or `provider`.
   *
   * @param address - The account address to query.
   * @returns The balance in wei as a decimal string.
   */
  async getBalance(address: string): Promise<string> {
    const balance = await this.requireProvider("get_balance", "getBalance").getBalance(address);
    return balance.toString();
  }

  /**
   * Read the account's txKey slots in at most two round trips, regardless of
   * how many keys are registered.
   *
   * Round 1 asks `txKeyList(0..maxTxKeys)`; round 2 asks each slot's logic
   * contract for `keyType()` and `getKeyData(Tx, account, keyId)`. An
   * undeployed account is detected from round 1 alone.
   *
   * @throws `AaOperationError` (`INPUT_INVALID_ADDRESS`) for a malformed address.
   * @throws `AaFetchError` (`TRANSPORT`) when the node cannot be reached, or
   *   (`RESPONSE_SHAPE`) when it answers with undecodable data.
   */
  async readTxKeySlots(address: string): Promise<TxKeySlots> {
    if (!ethers.isAddress(address)) {
      throw new AaOperationError({
        code: AaOperationErrorCode.INPUT_INVALID_ADDRESS,
        operation: READ_TX_KEYS,
        message: `AccountReader: invalid account address "${address}"`,
      });
    }

    // One extra slot past the window tells us whether the list continues.
    const slotCalls: Call3[] = Array.from({ length: this.maxTxKeys + 1 }, (_, index) => ({
      target: address,
      allowFailure: true,
      callData: accountIface.encodeFunctionData("txKeyList", [index]),
    }));
    const round1 = await this.batch.batch(slotCalls, READ_TX_KEYS);

    // A call to an address without code succeeds with empty data.
    const first = round1.results[0];
    if (first.success && first.returnData === "0x") {
      return { deployed: false, keys: [], truncated: false, readVia: round1.via };
    }

    const slots: { index: number; logic: string; keyId: bigint }[] = [];
    for (let index = 0; index < this.maxTxKeys; index++) {
      const result = round1.results[index];
      // Out-of-range slots revert; the list is filled from the front.
      if (!hasValue(result)) break;
      const [logic, keyId] = this.decodeSlot(result.returnData);
      if (!logic || logic === ethers.ZeroAddress) break;
      slots.push({ index, logic, keyId });
    }
    const truncated = slots.length === this.maxTxKeys && hasValue(round1.results[this.maxTxKeys]);

    if (slots.length === 0) {
      return { deployed: true, keys: [], truncated, readVia: round1.via };
    }

    const detailCalls: Call3[] = slots.flatMap(({ logic, keyId }) => [
      { target: logic, allowFailure: true, callData: webAuthnIface.encodeFunctionData("keyType") },
      {
        target: logic,
        allowFailure: true,
        callData: webAuthnIface.encodeFunctionData("getKeyData", [KEY_PURPOSE_TX, address, keyId]),
      },
    ]);
    const round2 = await this.batch.batch(detailCalls, READ_TX_KEYS);

    const keys = slots.map((slot, position): TxKeyInfo => {
      const keyType = this.decodeKeyType(round2.results[position * 2]);
      const info: TxKeyInfo = {
        index: slot.index,
        logicContract: slot.logic,
        keyId: Number(slot.keyId),
        keyType,
      };
      if (keyType === "webauthn") {
        const webauthn = this.decodeKeyData(round2.results[position * 2 + 1]);
        if (webauthn) info.webauthn = webauthn;
      }
      return info;
    });

    return { deployed: true, keys, truncated, readVia: round1.via };
  }

  /**
   * Read all transaction key slots from a deployed ZkapAccount.
   *
   * Returns `[]` for an undeployed account (see {@link readTxKeySlots} to tell
   * that apart from "deployed with no keys"). Throws `AaFetchError` when the
   * node cannot be read — an empty array never means the RPC failed.
   *
   * @param address - Address of the ZkapAccount.
   * @returns One {@link TxKeyInfo} per occupied key slot.
   */
  async getTxKeyList(address: string): Promise<TxKeyInfo[]> {
    return (await this.readTxKeySlots(address)).keys;
  }

  /**
   * Read the WebAuthn (passkey) txKeys and classify them for the calling
   * service — see {@link GetPasskeysOptions} and {@link PasskeysResult}.
   *
   * Option validation happens before any RPC.
   */
  async getPasskeys(address: string, opts?: GetPasskeysOptions): Promise<PasskeysResult> {
    normalizeOptions(opts);
    const slots = await this.readTxKeySlots(address);
    return buildPasskeysResult(slots, opts);
  }

  /**
   * Find txKeys matching the given rpIdHash (SHA-256 of rpId).
   * Returns all WebAuthn keys whose allowedRpIdHash matches.
   *
   * @see getPasskeys — resolves rpId/origin for you and classifies every key.
   */
  async findTxKeysByRpId(address: string, rpIdHash: string): Promise<TxKeyInfo[]> {
    const keys = await this.getTxKeyList(address);
    return keys.filter(
      (k) =>
        k.keyType === "webauthn" &&
        k.webauthn?.allowedRpIdHash?.toLowerCase() === rpIdHash.toLowerCase(),
    );
  }

  /**
   * Read the master key configuration from a deployed ZkapAccount.
   *
   * Queries `masterKeyList(0)` to obtain the verifier address and key ID, then
   * attempts to read anchor data via `getData` or `getAnchor` to determine whether
   * the account uses a 3-of-3 threshold scheme.
   *
   * @param address - Address of the deployed ZkapAccount.
   * @returns A {@link MasterKeyInfo} describing the threshold, key count, anchor values,
   *   and verifier contract address.
   * @throws `AaFetchError` if `masterKeyList(0)` cannot be read.
   */
  async getMasterKeyInfo(address: string): Promise<MasterKeyInfo> {
    const account = new ethers.Contract(address, ZKAP_ACCOUNT_ABI, this.runner);

    let logic: string;
    let keyId: bigint;
    try {
      const entry = await account.masterKeyList(0);
      logic = entry[0] as string;
      keyId = entry[1] as bigint;
    } catch (err) {
      throw new AaFetchError({
        code: AaFetchErrorCode.TRANSPORT,
        operation: "get_master_key_info",
        service: "rpc",
        url: this.rpcUrl,
        method: "POST",
        cause: err,
        message: `AccountReader: failed to read masterKeyList(0) for ${address}`,
      });
    }

    let threshold = 1;
    try {
      const t = await account.masterKeyThreshold();
      threshold = Number(t);
    } catch {
      // ignore, default 1
    }

    // Count master keys and detect 3-of-3
    let keyCount = 1;
    const anchorList: string[] = [];
    // Attempt to read anchor data from the verifier
    try {
      const verifierContract = new ethers.Contract(logic, ZK_OAUTH_VERIFIER_ABI, this.runner);
      const data = await verifierContract.getData(keyId);
      const anchor: bigint[] = data[3];
      for (const a of anchor) {
        anchorList.push(a.toString());
      }
      // Infer 3-of-3 from anchor count
      if (anchor.length >= 3) {
        keyCount = 3;
      }
    } catch {
      // Verifier doesn't support getData, try getAnchor
      try {
        const verifierContract = new ethers.Contract(logic, ZK_OAUTH_VERIFIER_ABI, this.runner);
        const anchor: bigint[] = await verifierContract.getAnchor(keyId);
        for (const a of anchor) {
          anchorList.push(a.toString());
        }
        if (anchor.length >= 3) {
          keyCount = 3;
        }
      } catch {
        // Not available
      }
    }

    return {
      threshold,
      keyCount,
      is3of3: keyCount >= 3,
      anchor: anchorList,
      verifierAddress: logic,
    };
  }

  private requireProvider(operation: string, method: string): ethers.Provider {
    if (!this.provider) {
      throw new AaOperationError({
        code: AaOperationErrorCode.CONFIG_REQUIRED_FIELD_MISSING,
        operation,
        message:
          `AccountReader: ${method} needs rpcUrl or provider — a call-only transport has no ` +
          "eth_getCode / eth_getBalance. Use readTxKeySlots().deployed instead.",
      });
    }
    return this.provider;
  }

  private decodeSlot(returnData: string): [string, bigint] {
    try {
      const decoded = accountIface.decodeFunctionResult("txKeyList", returnData);
      return [decoded[0] as string, decoded[1] as bigint];
    } catch (err) {
      throw new AaFetchError({
        code: AaFetchErrorCode.RESPONSE_SHAPE,
        operation: READ_TX_KEYS,
        service: "rpc",
        url: this.rpcUrl,
        method: "POST",
        rawResponse: returnData,
        cause: err,
        message: "AccountReader: txKeyList returned undecodable data",
      });
    }
  }

  private decodeKeyType(result: Result3): KeyType {
    if (!hasValue(result)) return "unknown";
    try {
      const [keyType] = webAuthnIface.decodeFunctionResult("keyType", result.returnData);
      return keyTypeFromPrimitive(Number(keyType));
    } catch {
      return "unknown";
    }
  }

  private decodeKeyData(result: Result3): WebAuthnKeyData | undefined {
    if (!hasValue(result)) return undefined;
    try {
      const d = webAuthnIface.decodeFunctionResult("getKeyData", result.returnData);
      return {
        x: d[0] as string,
        y: d[1] as string,
        credentialId: d[2] as string,
        allowedOriginHash: d[3] as string,
        allowedRpIdHash: d[4] as string,
      };
    } catch {
      return undefined;
    }
  }
}
