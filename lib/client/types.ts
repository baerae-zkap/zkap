import type { PackedUserOperation } from "../types/UserOperation";

export type { PackedUserOperation };

export type UserOpStatus =
  | "pending"
  | "included"
  | "failed"
  | "not_found";

export interface UserOpReceipt {
  userOpHash: string;
  txHash: string;
  blockNumber: number;
  success: boolean;
  actualGasCost: string;
  actualGasUsed: string;
}

export interface BundlerProvider {
  submitUserOp(userOp: PackedUserOperation, entryPoint: string): Promise<string>;
  getStatus(userOpHash: string): Promise<UserOpStatus>;
  getReceipt(userOpHash: string): Promise<UserOpReceipt | null>;
}

export type BundlerErrorCode =
  | "AA21_INSUFFICIENT_FUNDS"
  | "AA25_NONCE_ERROR"
  | "AA40_PAYMASTER_ERROR"
  | "BUNDLER_TIMEOUT"
  | "BUNDLER_REJECTED"
  | "NETWORK_ERROR";

export class BundlerError extends Error {
  code: BundlerErrorCode;
  retryable: boolean;

  constructor(message: string, code: BundlerErrorCode, retryable = false) {
    super(message);
    this.name = "BundlerError";
    this.code = code;
    this.retryable = retryable;
  }
}
