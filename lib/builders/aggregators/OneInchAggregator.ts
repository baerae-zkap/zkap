import { SwapParams } from "../../types/Swap";
export class OneInchAggregator {
  private BASE_URL = "https://api.1inch.dev/swap/v6.0/";
  private apiBaseUrl: string;
  private headers: Record<string, string>;
  // private headers: { Authorization: string; accept: string; content-type: string };

  constructor(chainId: number, apiKey: string) {
    this.apiBaseUrl = this.BASE_URL + chainId;
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      accept: "application/json",
    };
  }

  // Construct full API request URL
  apiRequestUrl(methodName, queryParams) {
    return (
      this.apiBaseUrl +
      methodName +
      "?" +
      new URLSearchParams(queryParams).toString()
    );
  }

  async checkAllowance(
    tokenAddress: string,
    walletAddress: string
  ): Promise<number | null> {
    const url = this.apiRequestUrl("/approve/allowance", {
      tokenAddress: tokenAddress,
      walletAddress: walletAddress,
    });

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Error fetching allowance: ${response.statusText}`);
      }

      const data = await response.json();
      return data.allowance || null; // allowance가 없으면 null 반환
    } catch (error) {
      console.error(error);
      return null; // 에러 발생 시 null 반환
    }
  }

  async getApprovalTxData(tokenAddress, amount) {
    try {
      const url = this.apiRequestUrl(
        "/approve/transaction",
        amount ? { tokenAddress, amount } : { tokenAddress }
      );

      const response = await fetch(url, {
        method: "GET",
        headers: new Headers(this.headers),
      });

      // 응답이 200-299 범위가 아닐 경우 예외 발생
      if (!response.ok) {
        throw new Error(
          `HTTP Error! Status: ${response.status} - ${response.statusText}`
        );
      }

      const transaction = await response.json();

      return {
        contractAddress: transaction.to,
        value: transaction.value,
        data: transaction.data,
      };
    } catch (error) {
      console.error("Error fetching approval transaction:", error);
      throw error; // 상위 호출자가 처리할 수 있도록 에러 다시 던지기
    }
  }

  async getSwapTxData(swapParams: SwapParams) {
    const url = this.apiRequestUrl("/swap", swapParams);

    // Fetch the swap transaction details from the API
    const response = await fetch(url, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      if (response.status === 400) {
        const errorData = await response.json();
        console.error("Error:", errorData);
        return {
          error: errorData,
        };
      }
      throw new Error(
        `HTTP Error! Status: ${response.status} - ${response.statusText}`
      );
    }

    const transaction = await response.json();

    return {
      contractAddress: transaction.tx.to,
      value: transaction.tx.value,
      data: transaction.tx.data,
    };
  }
}

export default OneInchAggregator;
