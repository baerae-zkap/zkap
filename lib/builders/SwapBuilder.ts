import { SwapParams, SwapTxData } from "../types/Swap";
import { OneInchAggregator } from "./aggregators/OneInchAggregator";
import { ethers } from "ethers";

interface ISwapAggregator {
  checkAllowance(tokenAddress: string, walletAddress: string): Promise<string | null>;
  getApprovalTxData(tokenAddress: string, amount?: string): Promise<SwapTxData>;
  getSwapTxData(swapParams: SwapParams): Promise<SwapTxData>;
}

export class SwapBuilder {
  private aggregator: ISwapAggregator;
  private bundlerAddress: string;

  private static readonly AggregatorName = {
    ONEINCH: "1inch",
    UNISWAP: "uniswap",
    CURVE: "curve",
    BALANCER: "balancer",
  };

  constructor(
    aggregatorName: string,
    chainId: number,
    apiKey: string,
    bundlerAddress: string
  ) {
    if (!Number.isInteger(chainId) || chainId <= 0) {
      throw new Error(`SwapBuilder: chainId must be a positive integer, got ${chainId}`);
    }
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('SwapBuilder: apiKey must be a non-empty string');
    }
    if (!ethers.isAddress(bundlerAddress)) {
      throw new Error(`SwapBuilder: bundlerAddress is not a valid Ethereum address: "${bundlerAddress}"`);
    }
    this.bundlerAddress = bundlerAddress;

    switch (aggregatorName) {
      case SwapBuilder.AggregatorName.ONEINCH:
        this.aggregator = new OneInchAggregator(chainId, apiKey);
        break;
      default:
        throw new Error(
          `Unsupported aggregator: "${aggregatorName}". Supported: ${Object.values(SwapBuilder.AggregatorName).join(", ")}`
        );
    }
  }

  public async getSwapTxData({
    src,
    dst,
    amount,
    from,
    slippage = 0.01,
    disableEstimate = false,
    allowPartialFill = true,
  }: SwapParams): Promise<SwapTxData> {
    if (!ethers.isAddress(src)) {
      throw new Error(`SwapBuilder: src is not a valid Ethereum address: "${src}"`);
    }
    if (!ethers.isAddress(dst)) {
      throw new Error(`SwapBuilder: dst is not a valid Ethereum address: "${dst}"`);
    }
    if (!ethers.isAddress(from)) {
      throw new Error(`SwapBuilder: from is not a valid Ethereum address: "${from}"`);
    }
    const swapData = await this.aggregator.getSwapTxData({
      src: src,
      dst: dst,
      amount: amount,
      from: from,
      origin: this.bundlerAddress,
      slippage: slippage,
      disableEstimate: disableEstimate,
      allowPartialFill: allowPartialFill,
    });

    return swapData;
  }

  public async getApprovalTxData(
    token: string,
    amount: string
  ): Promise<SwapTxData> {
    const approvalData = await this.aggregator.getApprovalTxData(
      token,
      amount
    );

    return approvalData;
  }
}
