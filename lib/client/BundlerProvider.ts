import type { PackedUserOperation } from "../types/UserOperation";
import type { BundlerProvider, UserOpReceipt, UserOpStatus } from "./types";
import { BundlerError } from "./types";

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

// ---------------------------------------------------------------------------
// ZkapBundlerProvider — uses ZKAP Server custom endpoints
// ---------------------------------------------------------------------------
export class ZkapBundlerProvider implements BundlerProvider {
  private readonly baseUrl: string;

  constructor(config?: { baseUrl?: string }) {
    this.baseUrl = (config && config.baseUrl) ? config.baseUrl.replace(/\/$/, "") : "https://api.zkap.app";
  }

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
export class Erc4337BundlerProvider implements BundlerProvider {
  private readonly rpcUrl: string;
  private reqId = 0;

  constructor(config: { rpcUrl: string }) {
    this.rpcUrl = config.rpcUrl;
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

  async submitUserOp(userOp: PackedUserOperation, entryPoint: string): Promise<string> {
    const result = await this.rpcCall("eth_sendUserOperation", [userOp, entryPoint]);
    return result as string;
  }

  async getStatus(userOpHash: string): Promise<UserOpStatus> {
    const receipt = await this.rpcCall("eth_getUserOperationReceipt", [userOpHash]) as UserOpReceipt | null;
    if (!receipt) return "not_found";
    if (receipt.success) return "included";
    return "failed";
  }

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
}
