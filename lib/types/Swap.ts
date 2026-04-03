/**
 * Input parameters for a token swap routed through the 1inch Aggregation
 * Protocol. Pass this to the swap helper to obtain a {@link SwapTxData}
 * object ready for inclusion in a UserOperation.
 *
 * @example
 * const params: SwapParams = {
 *   src: "0x111111111117dC0aa78b770fA6A738034120C302", // 1INCH token
 *   dst: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI token
 *   amount: "1000000000000000000", // 1 token in wei
 *   from: "0xYourSmartAccountAddress",
 *   slippage: 0.01,
 * };
 */
export interface SwapParams {
  /** Token address of the source token to swap from (e.g. 1INCH). */
  src: string; // Token address of the source token (1INCH)
  /** Token address of the destination token to receive (e.g. DAI). */
  dst: string; // Token address of the destination token (DAI)
  /**
   * Amount of source token to swap, expressed in the token's smallest unit
   * (wei for 18-decimal tokens). Passed as a string to avoid precision loss.
   */
  amount: string; // Amount of source token to swap (in wei, as a string to prevent precision loss)
  /** Wallet (smart-account) address that initiates the swap. */
  from: string; // Wallet address of the sender
  /**
   * Maximum acceptable price slippage as a decimal fraction.
   * For example, `0.01` allows up to 1% slippage. Valid range: `0.0`–`1.0`.
   * Defaults to a conservative value when omitted.
   */
  slippage?: number; // Maximum acceptable slippage as a decimal fraction (e.g., 0.01 = 1%). Range: 0.0–1.0
  /**
   * When `true`, skips the 1inch estimation step. Useful for gas-limit
   * overrides or testing; not recommended in production.
   */
  disableEstimate?: boolean; // Whether to disable estimation
  /**
   * When `true`, allows the swap to be partially filled if full liquidity
   * is unavailable at the requested price.
   */
  allowPartialFill?: boolean; // Whether partial fill of the order is allowed
  /**
   * Optional referral address forwarded to 1inch, e.g. the bundler address,
   * used for fee tracking or attribution.
   */
  origin?: string; // Referral address passed to 1inch (e.g. bundler address)
}

/**
 * Transaction data returned by the 1inch swap API, ready to be encoded
 * into a UserOperation's `callData`.
 *
 * @example
 * const tx: SwapTxData = {
 *   contractAddress: "0x1111111254EEB25477B68fb85Ed929f73A960582",
 *   value: "0",
 *   data: "0x...",
 * };
 */
export interface SwapTxData {
  /** Address of the 1inch router contract to call. */
  contractAddress: string;
  /** Native token value (in wei) to attach to the swap call; `"0"` for ERC-20 swaps. */
  value: string;
  /** ABI-encoded calldata for the 1inch router's swap function. */
  data: string;
}
