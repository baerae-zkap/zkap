import { UserOperation } from "../types/UserOperation";
import { ethers } from "ethers";

export enum PaymasterMode {
  // NONE = 0,
  VERIFYING = 0,
  ERC20 = 1,
}

export interface PaymasterServiceConfig {
  /**
   * Paymaster 서버 URL (예: "http://127.0.0.1:3000")
   */
  serverUrl: string;
  /**
   * Paymaster 컨트랙트 주소
   */
  paymasterAddress: string;
  /**
   * Chain ID
   */
  chainId: number;

  mode: PaymasterMode;

  /**
   * ERC20 모드에서 사용할 토큰 주소.
   * PaymasterMode.ERC20 일 때 필수.
   */
  tokenAddress?: string;
}

export interface PaymasterDataResponse {
  userOp: {
    paymasterData: string;
  };
}

// Empirically measured gas limits for each paymaster mode
const VERIFYING_PAYMASTER_VERIFICATION_GAS = 27000n;
const VERIFYING_PAYMASTER_POST_OP_GAS = 0n;
const ERC20_PAYMASTER_VERIFICATION_GAS = 40000n;
const ERC20_PAYMASTER_POST_OP_GAS = 100000n;

/**
 * Paymaster 서비스 클래스
 * Paymaster 서버와 통신하여 paymaster 데이터를 가져옵니다.
 */
export class PaymasterService {
  private static readonly FETCH_TIMEOUT_MS = 30_000;
  private config: PaymasterServiceConfig;
  private static isValidMode(mode: number): mode is PaymasterMode {
    return mode === PaymasterMode.VERIFYING || mode === PaymasterMode.ERC20;
  }

  constructor(config: PaymasterServiceConfig) {
    let url: URL;
    try {
      url = new URL(config.serverUrl);
    } catch {
      throw new Error(`PaymasterService: serverUrl is not a valid URL: "${config.serverUrl}"`);
    }
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('PaymasterService serverUrl must use HTTPS. HTTP is only allowed for localhost.');
    }
    if (!ethers.isAddress(config.paymasterAddress)) {
      throw new Error(`PaymasterService: paymasterAddress is not a valid Ethereum address: "${config.paymasterAddress}"`);
    }
    if (!PaymasterService.isValidMode(config.mode)) {
      throw new Error(`PaymasterService: unsupported mode: ${config.mode}`);
    }
    if (config.mode === PaymasterMode.ERC20) {
      if (!config.tokenAddress) {
        throw new Error('PaymasterService: tokenAddress is required for ERC20 mode');
      }
      if (!ethers.isAddress(config.tokenAddress)) {
        throw new Error(`PaymasterService: tokenAddress is not a valid Ethereum address: "${config.tokenAddress}"`);
      }
    }
    this.config = Object.freeze({ ...config });
  }

  private requestCounter = 0;

  private getRequestId(): number {
    return ++this.requestCounter;
  }

  async getPaymasterData(userOp: UserOperation): Promise<string> {
    if (this.config.mode === PaymasterMode.VERIFYING) {
      return this.getPaymasterDataVerifying(userOp);
    } else if (this.config.mode === PaymasterMode.ERC20) {
      return this.getPaymasterDataErc20(userOp);
    }
    throw new Error("Invalid paymaster mode");
  }

  /**
   * Paymaster 서버에 RPC 요청을 보내고 paymasterData를 반환합니다.
   * @param endpoint 요청 경로 (예: "/paymaster/get-paymaster-data")
   * @param params RPC params 배열
   * @returns paymasterData 문자열
   */
  private async requestPaymasterData(
    endpoint: string,
    params: unknown[]
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PaymasterService.FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${this.config.serverUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "pm_getPaymasterData",
          params,
          id: this.getRequestId(),
        }),
      });
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error(`Paymaster request timed out after ${PaymasterService.FETCH_TIMEOUT_MS}ms`);
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      let responseText = "";
      try {
        responseText = await response.text();
      } catch {
        // ignore body read failures
      }
      throw new Error(
        `Paymaster data request failed: ${response.status} ${response.statusText}${responseText ? `: ${responseText}` : ""}`
      );
    }
    let data: { result?: PaymasterDataResponse; error?: unknown };
    try {
      data = await response.json();
    } catch (jsonError) {
      throw new Error(
        `Paymaster data error: invalid JSON response (${jsonError instanceof Error ? jsonError.message : String(jsonError)})`
      );
    }
    if (data.error) {
      const errMsg = (typeof data.error === 'object' && data.error !== null && 'message' in data.error)
        ? (data.error as { message: string }).message
        : JSON.stringify(data.error);
      throw new Error(`Paymaster data error: ${errMsg}`);
    }
    if (!data.result) {
      throw new Error("Paymaster data error: result is not found");
    }
    if (!data.result.userOp || typeof data.result.userOp !== "object") {
      throw new Error("Paymaster data error: result.userOp is not found");
    }
    const paymasterData = data.result.userOp.paymasterData;
    if (typeof paymasterData !== "string" || !/^0x([0-9a-fA-F]{2})*$/.test(paymasterData)) {
      throw new Error(`Invalid paymasterData format: expected 0x-prefixed even-length hex string, got ${typeof paymasterData === "string" ? JSON.stringify(paymasterData.substring(0, 20)) : typeof paymasterData}`);
    }
    return paymasterData;
  }

  private buildUserOpParams(userOp: UserOperation): object {
    return {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: userOp.initCode,
      callData: userOp.callData,
      callGasLimit: userOp.callGasLimit,
      verificationGasLimit: userOp.verificationGasLimit,
      preVerificationGas: userOp.preVerificationGas,
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
      maxFeePerGas: userOp.maxFeePerGas,
      paymaster: userOp.paymaster,
      paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit,
    };
  }

  /**
   * Paymaster 데이터를 가져옵니다.
   * @param userOp UserOperation 객체
   * @returns Paymaster 데이터
   */
  async getPaymasterDataVerifying(userOp: UserOperation): Promise<string> {
    return this.requestPaymasterData(
      "/paymaster/get-paymaster-data",
      [
        this.buildUserOpParams(userOp),
        this.config.paymasterAddress,
        this.config.chainId.toString(),
      ]
    );
  }

  async getPaymasterDataErc20(userOp: UserOperation): Promise<string> {
    if (!this.config.tokenAddress) {
      throw new Error("tokenAddress is required for ERC20 paymaster mode");
    }
    return this.requestPaymasterData(
      "/paymaster/get-paymaster-data-erc20",
      [
        this.buildUserOpParams(userOp),
        this.config.paymasterAddress,
        this.config.chainId.toString(),
        this.config.tokenAddress,
      ]
    );
  }

  /**
   * Paymaster 검증 가스 한도를 추정합니다.
   * @returns Paymaster 검증 가스 한도
   */
  estimatePaymasterVerificationGasLimit(): bigint {
    if (this.config.mode === PaymasterMode.VERIFYING) {
      return VERIFYING_PAYMASTER_VERIFICATION_GAS;
    } else if (this.config.mode === PaymasterMode.ERC20) {
      return ERC20_PAYMASTER_VERIFICATION_GAS;
    }
    throw new Error("Invalid paymaster mode");
  }

  /**
   * Paymaster PostOp 가스 한도를 추정합니다.
   * @returns Paymaster PostOp 가스 한도
   */
  estimatePaymasterPostOpGasLimit(): bigint {
    if (this.config.mode === PaymasterMode.VERIFYING) {
      return VERIFYING_PAYMASTER_POST_OP_GAS;
    } else if (this.config.mode === PaymasterMode.ERC20) {
      return ERC20_PAYMASTER_POST_OP_GAS;
    }
    throw new Error("Invalid paymaster mode");
  }
  getConfig(): Readonly<PaymasterServiceConfig> {
    return { ...this.config };
  }
}
