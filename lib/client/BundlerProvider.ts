import type { PackedUserOperation, PimlicoUserOperation, PimlicoGasEstimate } from "../types/UserOperation";
import type { BundlerProvider, UserOpReceipt, UserOpStatus } from "./types";
import { BundlerError } from "./types";
import { toPimlicoFormat } from "../utils/userOpUtils";

// ---------------------------------------------------------------------------
// Helper: classify bundler error codes from error messages
// ---------------------------------------------------------------------------
function classifyBundlerError(message: string): BundlerError {
  const lower = message.toLowerCase();
  if (lower.includes("aa21")) {
    return new BundlerError(message, "AA21_INSUFFICIENT_FUNDS", false);
  }
  if (lower.includes("aa25")) {
    return new BundlerError(message, "AA25_NONCE_ERROR", false);
  }
  if (lower.includes("aa40") || lower.includes("aa41") || lower.includes("aa31") || lower.includes("aa32")) {
    return new BundlerError(message, "AA40_PAYMASTER_ERROR", false);
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("econnrefused")) {
    return new BundlerError(message, "NETWORK_ERROR", true);
  }
  return new BundlerError(message, "BUNDLER_REJECTED", false);
}

/**
 * Normalize hex string to even length for ethers.js compatibility.
 * Pimlico may return odd-length hex strings like "0x203ef" (5 chars).
 * ethers.js expects even-length hex (valid bytes), so we pad.
 */
function normalizeHex(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const padded = clean.length % 2 === 0 ? clean : "0" + clean;
  return "0x" + padded;
}

// ---------------------------------------------------------------------------
// ZkapBundlerProvider — uses ZKAP Server custom endpoints
// ---------------------------------------------------------------------------
/**
 * {@link BundlerProvider} implementation that communicates with the ZKAP bundler
 * via ZKAP Server's proprietary REST endpoints.
 *
 * Use this provider when submitting UserOperations through the ZKAP platform.
 * For standard ERC-4337 JSON-RPC bundlers, use {@link Erc4337BundlerProvider} instead.
 *
 * @example
 * ```ts
 * const provider = new ZkapBundlerProvider({ baseUrl: "https://api.zkap.app" });
 * const client = new BundlerClient(provider);
 * ```
 */
export class ZkapBundlerProvider implements BundlerProvider {
  private readonly baseUrl: string;

  /**
   * @param config.baseUrl - Base URL of the ZKAP API server (default: `"https://api.zkap.app"`).
   *   Trailing slashes are stripped automatically.
   */
  constructor(config?: { baseUrl?: string }) {
    this.baseUrl = (config && config.baseUrl) ? config.baseUrl.replace(/\/$/, "") : "https://api.zkap.app";
  }

  /**
   * Submit a packed UserOperation via the ZKAP direct-submit endpoint.
   *
   * @param userOp - The fully constructed and signed packed UserOperation.
   * @param _entryPoint - Unused by this provider; the ZKAP server resolves the EntryPoint internally.
   * @returns The UserOperation hash assigned by the bundler.
   * @throws {@link BundlerError} on network failure or if the bundler rejects the operation.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async submitUserOp(userOp: PackedUserOperation, _entryPoint: string): Promise<string> {
    const url = `${this.baseUrl}/api/v1/bundler/submit-direct`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userOp }),
      });
    } catch (err) {
      throw new BundlerError(
        `Network error submitting UserOp: ${err instanceof Error ? err.message : String(err)}`,
        "NETWORK_ERROR",
        true
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw classifyBundlerError(`Bundler rejected UserOp (${res.status}): ${body}`);
    }

    const data = await res.json();
    if (!data.userOpHash) {
      throw new BundlerError("Bundler response missing userOpHash", "BUNDLER_REJECTED", false);
    }
    return data.userOpHash as string;
  }

  /**
   * Query the status of a UserOperation from the ZKAP status endpoint.
   *
   * @param userOpHash - The hash returned by {@link submitUserOp}.
   * @returns The current {@link UserOpStatus}.
   * @throws {@link BundlerError} on network failure.
   */
  async getStatus(userOpHash: string): Promise<UserOpStatus> {
    const url = `${this.baseUrl}/api/v1/bundler/status/${userOpHash}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new BundlerError(
        `Network error fetching status: ${err instanceof Error ? err.message : String(err)}`,
        "NETWORK_ERROR",
        true
      );
    }

    if (res.status === 404) {
      return "not_found";
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new BundlerError(`Status fetch failed (${res.status}): ${body}`, "NETWORK_ERROR", true);
    }

    const data = await res.json();
    const status = (data.status as string || "").toLowerCase();

    if (status === "included" || status === "confirmed" || status === "success") return "included";
    if (status === "failed" || status === "reverted") return "failed";
    if (status === "pending" || status === "submitted") return "pending";
    return "not_found";
  }

  /**
   * Retrieve the execution receipt for a finalized UserOperation from the ZKAP status endpoint.
   *
   * @param userOpHash - The hash returned by {@link submitUserOp}.
   * @returns The {@link UserOpReceipt}, or `null` if the operation is not yet finalized or the
   *   request fails.
   */
  async getReceipt(userOpHash: string): Promise<UserOpReceipt | null> {
    const url = `${this.baseUrl}/api/v1/bundler/status/${userOpHash}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      return null;
    }

    if (!res.ok) return null;

    const data = await res.json() as Record<string, unknown>;
    const status = ((data.status as string) || "").toLowerCase();
    const isSuccess = status === "included" || status === "confirmed" || status === "success";
    const isFailed = status === "failed" || status === "reverted";
    if (!isSuccess && !isFailed) return null;

    return {
      userOpHash,
      txHash: (data.bundleHash as string) || (data.txHash as string) || "",
      blockNumber: Number(data.blockNumber || 0),
      success: isSuccess,
      actualGasCost: String(data.actualGasCost || "0"),
      actualGasUsed: String(data.actualGasUsed || "0"),
    };
  }
}

// ---------------------------------------------------------------------------
// Erc4337BundlerProvider — uses standard ERC-4337 JSON-RPC
// ---------------------------------------------------------------------------

/**
 * Configuration options for {@link Erc4337BundlerProvider}.
 */
export interface Erc4337BundlerProviderConfig {
  /** JSON-RPC endpoint URL of the ERC-4337 bundler. */
  rpcUrl: string;
  /**
   * When `true`, converts PackedUserOperation to Pimlico v0.7/v0.8 format
   * before sending. The Pimlico format uses separate `factory`/`factoryData`
   * fields instead of `initCode`, and individual gas/paymaster fields instead
   * of packed bytes32 values.
   *
   * @default false
   */
  usePimlicoFormat?: boolean;
}

/**
 * {@link BundlerProvider} implementation that communicates with any standard
 * ERC-4337 JSON-RPC bundler (e.g. Stackup, Pimlico, Alchemy).
 *
 * Uses `eth_sendUserOperation` and `eth_getUserOperationReceipt` as defined in
 * the ERC-4337 specification.
 *
 * @example
 * ```ts
 * // Standard bundler (packed format)
 * const provider = new Erc4337BundlerProvider({ rpcUrl: "https://your-bundler-rpc" });
 *
 * // Pimlico bundler (unpacked format with factory/factoryData)
 * const pimlicoProvider = new Erc4337BundlerProvider({
 *   rpcUrl: "https://public.pimlico.io/v2/421614/rpc",
 *   usePimlicoFormat: true,
 * });
 * ```
 */
export class Erc4337BundlerProvider implements BundlerProvider {
  private readonly rpcUrl: string;
  private readonly usePimlicoFormat: boolean;
  private reqId = 0;

  /**
   * @param config - Provider configuration options.
   */
  constructor(config: Erc4337BundlerProviderConfig) {
    this.rpcUrl = config.rpcUrl;
    this.usePimlicoFormat = config.usePimlicoFormat ?? false;
  }

  private async rpcCall(method: string, params: unknown[]): Promise<unknown> {
    const id = ++this.reqId;
    let res: Response;
    try {
      res = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      });
    } catch (err) {
      throw new BundlerError(
        `Network error calling ${method}: ${err instanceof Error ? err.message : String(err)}`,
        "NETWORK_ERROR",
        true
      );
    }

    const json = await res.json();
    if (json.error) {
      const msg = json.error.message || JSON.stringify(json.error);
      throw classifyBundlerError(msg);
    }
    return json.result;
  }

  /**
   * Submit a packed UserOperation via `eth_sendUserOperation`.
   *
   * When `usePimlicoFormat` is enabled, the packed UserOperation is automatically
   * converted to Pimlico's expected format (with `factory`/`factoryData` instead
   * of `initCode`) before submission.
   *
   * @param userOp - The fully constructed and signed packed UserOperation.
   * @param entryPoint - Address of the ERC-4337 EntryPoint contract.
   * @returns The UserOperation hash assigned by the bundler.
   * @throws {@link BundlerError} if the bundler rejects the operation or a network error occurs.
   */
  async submitUserOp(userOp: PackedUserOperation, entryPoint: string): Promise<string> {
    // Convert to Pimlico format if enabled
    const opToSend: PackedUserOperation | PimlicoUserOperation = this.usePimlicoFormat
      ? toPimlicoFormat(userOp)
      : userOp;

    const result = await this.rpcCall("eth_sendUserOperation", [opToSend, entryPoint]);
    return result as string;
  }

  /**
   * Query the status of a UserOperation via `eth_getUserOperationReceipt`.
   *
   * @param userOpHash - The hash returned by {@link submitUserOp}.
   * @returns `"included"` if the receipt indicates success, `"failed"` if reverted,
   *   or `"not_found"` if the bundler has no record yet.
   * @throws {@link BundlerError} on network failure.
   */
  async getStatus(userOpHash: string): Promise<UserOpStatus> {
    const receipt = await this.rpcCall("eth_getUserOperationReceipt", [userOpHash]) as UserOpReceipt | null;
    if (!receipt) return "not_found";
    if (receipt.success) return "included";
    return "failed";
  }

  /**
   * Retrieve the execution receipt via `eth_getUserOperationReceipt`.
   *
   * @param userOpHash - The hash returned by {@link submitUserOp}.
   * @returns The normalized {@link UserOpReceipt}, or `null` if not yet available.
   * @throws {@link BundlerError} on network failure.
   */
  async getReceipt(userOpHash: string): Promise<UserOpReceipt | null> {
    const raw = await this.rpcCall("eth_getUserOperationReceipt", [userOpHash]) as Record<string, unknown> | null;
    if (!raw) return null;

    return {
      userOpHash,
      txHash: (raw.transactionHash as string) || (raw.txHash as string) || "",
      blockNumber: Number(raw.blockNumber || 0),
      success: Boolean(raw.success),
      actualGasCost: String(raw.actualGasCost || "0"),
      actualGasUsed: String(raw.actualGasUsed || "0"),
    };
  }

  /**
   * Estimate gas for a UserOperation via `eth_estimateUserOperationGas`.
   *
   * This method is specific to ERC-4337 bundlers that support gas estimation (e.g., Pimlico).
   * When `usePimlicoFormat` is enabled, the packed UserOperation is automatically
   * converted to Pimlico's expected format before submission.
   *
   * **Note**: This method is only available on {@link Erc4337BundlerProvider}, not on the
   * {@link BundlerProvider} interface, as not all bundlers support gas estimation.
   *
   * @param userOp - The packed UserOperation to estimate gas for. Should have dummy signature set.
   * @param entryPoint - Address of the ERC-4337 EntryPoint contract.
   * @returns Gas estimates from the bundler.
   * @throws {@link BundlerError} if the bundler rejects the estimation or a network error occurs.
   *
   * @example
   * ```ts
   * const provider = new Erc4337BundlerProvider({
   *   rpcUrl: "https://public.pimlico.io/v2/421614/rpc",
   *   usePimlicoFormat: true,
   * });
   *
   * // After autoFillUserOp(), get more accurate estimates from Pimlico
   * const estimate = await provider.estimateUserOpGas(packed, entryPoint);
   * builder.setPreVerificationGas(estimate.preVerificationGas);
   * builder.setVerificationGasLimit(estimate.verificationGasLimit);
   * builder.setCallGasLimit(estimate.callGasLimit);
   * ```
   */
  async estimateUserOpGas(
    userOp: PackedUserOperation,
    entryPoint: string
  ): Promise<PimlicoGasEstimate> {
    const opToSend: PackedUserOperation | PimlicoUserOperation = this.usePimlicoFormat
      ? toPimlicoFormat(userOp)
      : userOp;

    const result = await this.rpcCall("eth_estimateUserOperationGas", [opToSend, entryPoint]) as Record<string, string>;
    return {
      preVerificationGas: normalizeHex(result.preVerificationGas),
      verificationGasLimit: normalizeHex(result.verificationGasLimit),
      callGasLimit: normalizeHex(result.callGasLimit),
      paymasterVerificationGasLimit: result.paymasterVerificationGasLimit
        ? normalizeHex(result.paymasterVerificationGasLimit)
        : undefined,
      paymasterPostOpGasLimit: result.paymasterPostOpGasLimit
        ? normalizeHex(result.paymasterPostOpGasLimit)
        : undefined,
    };
  }
}
