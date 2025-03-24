export interface SwapParams {
  src: string; // Token address of the source token (1INCH)
  dst: string; // Token address of the destination token (DAI)
  amount: string; // Amount of source token to swap (in wei, as a string to prevent precision loss)
  from: string; // Wallet address of the sender
  slippage: number; // Maximum acceptable slippage percentage
  disableEstimate: boolean; // Whether to disable estimation
  allowPartialFill: boolean; // Whether partial fill of the order is allowed
}
