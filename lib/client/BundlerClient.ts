import type { PackedUserOperation } from "../types/UserOperation";
import type { BundlerProvider, UserOpReceipt, UserOpStatus } from "./types";
import { BundlerError } from "./types";

const DEFAULT_POLL_INTERVAL = 2000;
const DEFAULT_TIMEOUT = 60000;

export class BundlerClient {
  private readonly provider: BundlerProvider;

  constructor(provider: BundlerProvider) {
    this.provider = provider;
  }

  async submitUserOp(userOp: PackedUserOperation, entryPoint: string): Promise<string> {
    return this.provider.submitUserOp(userOp, entryPoint);
  }

  async getStatus(userOpHash: string): Promise<UserOpStatus> {
    return this.provider.getStatus(userOpHash);
  }

  async waitForReceipt(
    userOpHash: string,
    options?: { pollInterval?: number; timeout?: number }
  ): Promise<UserOpReceipt> {
    const pollInterval = (options && options.pollInterval) ? options.pollInterval : DEFAULT_POLL_INTERVAL;
    const timeout = (options && options.timeout) ? options.timeout : DEFAULT_TIMEOUT;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const status = await this.provider.getStatus(userOpHash);

      if (status === "included") {
        const receipt = await this.provider.getReceipt(userOpHash);
        return receipt ?? this._buildReceipt(userOpHash, true);
      }

      if (status === "failed") {
        const receipt = await this.provider.getReceipt(userOpHash);
        return receipt ?? this._buildReceipt(userOpHash, false);
      }

      // "pending" or "not_found" — keep polling
      await this._sleep(pollInterval);
    }

    throw new BundlerError(
      `UserOp ${userOpHash} not confirmed within ${timeout}ms`,
      "BUNDLER_TIMEOUT",
      false
    );
  }

  private _buildReceipt(userOpHash: string, success: boolean): UserOpReceipt {
    return {
      userOpHash,
      txHash: "",
      blockNumber: 0,
      success,
      actualGasCost: "0",
      actualGasUsed: "0",
    };
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
