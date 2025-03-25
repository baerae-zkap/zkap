import { SwapParams } from "../types/Swap";
import { OneInchAggregator } from "./aggregators/OneInchAggregator";

export class SwapBuilder {
  private chainId: number;
  private apiKey: string;
  private aggregator: any;
  private bundlerAddress: string;

  private AggregatorName = {
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
    this.chainId = chainId;
    this.apiKey = apiKey;
    this.bundlerAddress = bundlerAddress;

    switch (aggregatorName) {
      case this.AggregatorName.ONEINCH:
        this.aggregator = new OneInchAggregator(this.chainId, this.apiKey);
        break;
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
  }: SwapParams): Promise<string> {
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
    sender: string,
    token: string,
    amount: string
  ): Promise<string> {
    const approvalData = await this.aggregator.getApprovalTxData(
      token,
      amount,
      sender
    );

    return approvalData;
  }
}
