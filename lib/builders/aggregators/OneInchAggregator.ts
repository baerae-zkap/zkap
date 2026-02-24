import { ethers } from "ethers";
import { SwapParams, SwapTxData } from "../../types/Swap";
export class OneInchAggregator {
  private BASE_URL = "https://api.1inch.dev/swap/v6.0/";
  private apiBaseUrl: string;
  private apiKey: string;
  private static readonly FETCH_TIMEOUT_MS = 30000; // 30 seconds

  constructor(chainId: number, apiKey: string) {
    this.apiBaseUrl = this.BASE_URL + chainId;
    const url = new URL(this.apiBaseUrl);
    if (url.protocol !== "https:") {
      throw new Error("OneInchAggregator requires HTTPS");
    }
    this.apiKey = apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      accept: "application/json",
    };
  }

  // Construct full API request URL
  apiRequestUrl(methodName: string, queryParams: Record<string, string>): string {
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
  ): Promise<string | null> {
    const url = this.apiRequestUrl("/approve/allowance", { tokenAddress, walletAddress });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OneInchAggregator.FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { method: "GET", headers: this.getHeaders(), signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Error fetching allowance: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.allowance ?? null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${OneInchAggregator.FETCH_TIMEOUT_MS}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getApprovalTxData(tokenAddress: string, amount?: string): Promise<SwapTxData> {
    const url = this.apiRequestUrl(
      "/approve/transaction",
      amount ? { tokenAddress, amount } : { tokenAddress }
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OneInchAggregator.FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: new Headers(this.getHeaders()),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `HTTP Error! Status: ${response.status} - ${response.statusText}`
        );
      }

      const transaction = await response.json();

      const approvalTo = transaction.to;
      const approvalData = transaction.data;
      if (!approvalTo || !ethers.isAddress(approvalTo)) {
        throw new Error(`Invalid approval response: 'to' is not a valid address: ${approvalTo}`);
      }
      if (typeof approvalData !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(approvalData)) {
        throw new Error('Invalid approval response: data is not valid hex');
      }
      return {
        contractAddress: approvalTo,
        value: String(transaction.value ?? '0'),
        data: approvalData,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${OneInchAggregator.FETCH_TIMEOUT_MS}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getSwapTxData(swapParams: SwapParams): Promise<SwapTxData> {
    // Filter undefined values and convert to strings for URL params
    const stringParams: Record<string, string> = Object.fromEntries(
      Object.entries(swapParams)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    const url = this.apiRequestUrl("/swap", stringParams);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OneInchAggregator.FETCH_TIMEOUT_MS);
    try {
      // Fetch the swap transaction details from the API
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 400) {
          const errorData = await response.json();
          throw new Error(`1inch API error (400): ${JSON.stringify(errorData)}`);
        }
        throw new Error(
          `HTTP Error! Status: ${response.status} - ${response.statusText}`
        );
      }

      const transaction = await response.json();

      const swapTo = transaction.tx?.to;
      const swapData = transaction.tx?.data;
      if (!swapTo || !ethers.isAddress(swapTo)) {
        throw new Error(`Invalid swap response: 'to' is not a valid address: ${swapTo}`);
      }
      if (typeof swapData !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(swapData)) {
        throw new Error('Invalid swap response: data is not valid hex');
      }
      return {
        contractAddress: swapTo,
        value: String(transaction.tx?.value ?? '0'),
        data: swapData,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${OneInchAggregator.FETCH_TIMEOUT_MS}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default OneInchAggregator;
