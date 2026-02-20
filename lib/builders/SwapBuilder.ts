import { SwapParams, SwapTxData } from "../types/Swap";
import { OneInchAggregator } from "./aggregators/OneInchAggregator";

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
