import { UserOperation } from "../types/UserOperation";

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
}

export interface PaymasterDataResponse {
  userOp: {
    paymasterData: string;
  };
}

/**
 * Paymaster 서비스 클래스
 * Paymaster 서버와 통신하여 paymaster 데이터를 가져옵니다.
 */
export class PaymasterService {
  private config: PaymasterServiceConfig;

  constructor(config: PaymasterServiceConfig) {
    this.config = config;
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
   * Paymaster 데이터를 가져옵니다.
   * @param userOp UserOperation 객체
   * @returns Paymaster 데이터
   */
  // TODO : backend 에서 정의한 API로 수정
  async getPaymasterDataVerifying(userOp: UserOperation): Promise<string> {
    const response = await fetch(
      `${this.config.serverUrl}/paymaster/get-paymaster-data`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "pm_getPaymasterData",
          params: [
            {
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
              paymasterVerificationGasLimit:
                userOp.paymasterVerificationGasLimit,
              paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit,
            },
            this.config.paymasterAddress,
            this.config.chainId.toString(),
          ],
          id: Date.now(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Paymaster data request failed: ${response.status} ${response.statusText}`
      );
    }

    const data: { result?: PaymasterDataResponse; error?: any } =
      await response.json();

    if (data.error) {
      throw new Error(`Paymaster data error: ${data.error.message}`);
    }

    if (!data.result) {
      throw new Error("Paymaster data error: result is not found");
    }

    return data.result.userOp.paymasterData;
  }

  async getPaymasterDataErc20(userOp: UserOperation): Promise<string> {
    const response = await fetch(
      `${this.config.serverUrl}/paymaster/get-paymaster-data-erc20`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "pm_getPaymasterData",
          params: [
            {
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
              paymasterVerificationGasLimit:
                userOp.paymasterVerificationGasLimit,
              paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit,
            },
            this.config.paymasterAddress,
            this.config.chainId.toString(),
            "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          ],
          id: Date.now(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Paymaster data request failed: ${response.status} ${response.statusText}`
      );
    }

    const data: { result?: PaymasterDataResponse; error?: any } =
      await response.json();

    if (data.error) {
      throw new Error(`Paymaster data error: ${data.error.message}`);
    }

    if (!data.result) {
      throw new Error("Paymaster data error: result is not found");
    }

    return data.result.userOp.paymasterData;
  }

  /**
   * Paymaster 검증 가스 한도를 추정합니다.
   * 기본적으로 verificationGasLimit과 동일한 값을 사용합니다.
   * @param verificationGasLimit 검증 가스 한도
   * @returns Paymaster 검증 가스 한도
   */
  estimatePaymasterVerificationGasLimit(): bigint {
    if (this.config.mode === PaymasterMode.VERIFYING) {
      return 27000n;
    } else if (this.config.mode === PaymasterMode.ERC20) {
      // TODO : calculate gas limit
      return 40000n;
    }
    throw new Error("Invalid paymaster mode");
  }

  /**
   * Paymaster PostOp 가스 한도를 추정합니다.
   * 기본적으로 verificationGasLimit과 동일한 값을 사용합니다.
   * @param verificationGasLimit 검증 가스 한도
   * @returns Paymaster PostOp 가스 한도
   */
  estimatePaymasterPostOpGasLimit(): bigint {
    if (this.config.mode === PaymasterMode.VERIFYING) {
      return 0n;
    } else if (this.config.mode === PaymasterMode.ERC20) {
      // TODO : calculate gas limit
      return 100000n;
    }
    throw new Error("Invalid paymaster mode");
  }
  getConfig(): PaymasterServiceConfig {
    return this.config;
  }
}
