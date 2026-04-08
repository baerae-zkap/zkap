/**
 * Represents an ERC-4337 v0.7 UserOperation before packing.
 *
 * All numeric fields are hex-encoded strings (e.g. `"0x1"`) to avoid
 * JavaScript integer precision loss on large uint256 values.
 *
 * @example
 * const userOp: UserOperation = {
 *   sender: "0xAbCd...",
 *   nonce: "0x1",
 *   initCode: "0x",
 *   callData: "0x...",
 *   callGasLimit: "0x5208",
 *   verificationGasLimit: "0x186a0",
 *   preVerificationGas: "0xc350",
 *   maxFeePerGas: "0x3b9aca00",
 *   maxPriorityFeePerGas: "0x3b9aca00",
 *   paymaster: "0x0000...",
 *   paymasterData: "0x",
 *   paymasterVerificationGasLimit: "0x0",
 *   paymasterPostOpGasLimit: "0x0",
 *   signature: "0x",
 * };
 */
export interface UserOperation {
  /** The smart-account address that is sending this operation. */
  sender: string;
  /** Anti-replay nonce for the account (hex string). */
  nonce: string;
  /**
   * Factory calldata used to deploy the account if it does not yet exist.
   * Set to `"0x"` when the account is already deployed.
   */
  initCode: string;
  /** ABI-encoded calldata forwarded to the account's `execute` function. */
  callData: string;
  /** Gas limit for the account's execution phase (hex string). */
  callGasLimit: string;
  /** Gas limit for the account's signature-verification phase (hex string). */
  verificationGasLimit: string;
  /** Gas overhead charged before on-chain execution begins (hex string). */
  preVerificationGas: string;
  /** Maximum total gas price the sender is willing to pay (hex string, wei). */
  maxFeePerGas: string;
  /** Maximum priority fee (tip) per gas unit (hex string, wei). */
  maxPriorityFeePerGas: string;
  /**
   * Address of the paymaster that sponsors gas fees.
   * Set to `"0x0000000000000000000000000000000000000000"` when self-paying.
   */
  paymaster: string;
  /** Arbitrary data passed to the paymaster's `validatePaymasterUserOp`. */
  paymasterData: string;
  /** Gas limit for the paymaster's verification phase (hex string). */
  paymasterVerificationGasLimit: string;
  /** Gas limit for the paymaster's post-operation hook (hex string). */
  paymasterPostOpGasLimit: string;
  /** Signature over the UserOperation hash, validated by the account. */
  signature: string;
}

/**
 * A gas-optimised, ABI-packed form of {@link UserOperation} as submitted
 * to the ERC-4337 v0.7 EntryPoint contract.
 *
 * Several fields from the unpacked form are concatenated into single
 * `bytes32` values to reduce calldata costs.
 *
 * @example
 * const packed: PackedUserOperation = {
 *   sender: "0xAbCd...",
 *   nonce: "0x1",
 *   initCode: "0x",
 *   callData: "0x...",
 *   accountGasLimits: "0x...", // callGasLimit | verificationGasLimit
 *   preVerificationGas: "0xc350",
 *   gasFees: "0x...",          // maxFeePerGas | maxPriorityFeePerGas
 *   paymasterAndData: "0x",
 *   signature: "0x",
 * };
 */
export interface PackedUserOperation {
  /** The smart-account address that is sending this operation. */
  sender: string;
  /** Anti-replay nonce for the account (hex string). */
  nonce: string;
  /**
   * Factory calldata used to deploy the account if it does not yet exist.
   * Set to `"0x"` when the account is already deployed.
   */
  initCode: string;
  /** ABI-encoded calldata forwarded to the account's `execute` function. */
  callData: string;
  /**
   * `bytes32` packing of `verificationGasLimit` (high 128 bits) and
   * `callGasLimit` (low 128 bits).
   */
  accountGasLimits: string;
  /** Gas overhead charged before on-chain execution begins (hex string). */
  preVerificationGas: string;
  /**
   * `bytes32` packing of `maxPriorityFeePerGas` (high 128 bits) and
   * `maxFeePerGas` (low 128 bits).
   */
  gasFees: string;
  /**
   * Concatenation of paymaster address (20 bytes), paymaster verification
   * gas limit (16 bytes), paymaster post-op gas limit (16 bytes), and
   * arbitrary paymaster data. Set to `"0x"` when self-paying.
   */
  paymasterAndData: string;
  /** Signature over the PackedUserOperation hash, validated by the account. */
  signature: string;
}

/**
 * Pimlico v0.7/v0.8 JSON-RPC format for UserOperations.
 *
 * Unlike {@link PackedUserOperation}, this format:
 * - Uses separate `factory` and `factoryData` fields instead of `initCode`
 * - Uses individual gas fields instead of packed `accountGasLimits` and `gasFees`
 * - Uses individual paymaster fields instead of packed `paymasterAndData`
 *
 * This format is required when submitting UserOperations to Pimlico bundlers
 * via their standard ERC-4337 JSON-RPC interface.
 *
 * @example
 * ```ts
 * const pimlicoOp: PimlicoUserOperation = {
 *   sender: "0xAbCd...",
 *   nonce: "0x1",
 *   factory: "0x1234...",       // Optional: only for account deployment
 *   factoryData: "0x...",       // Optional: only for account deployment
 *   callData: "0x...",
 *   callGasLimit: "0x5208",
 *   verificationGasLimit: "0x186a0",
 *   preVerificationGas: "0xc350",
 *   maxFeePerGas: "0x3b9aca00",
 *   maxPriorityFeePerGas: "0x3b9aca00",
 *   signature: "0x...",
 * };
 * ```
 */
export interface PimlicoUserOperation {
  /** The smart-account address that is sending this operation. */
  sender: string;
  /** Anti-replay nonce for the account (hex string). */
  nonce: string;
  /**
   * Factory contract address used to deploy the account.
   * Only present when the account is being deployed (first UserOp).
   */
  factory?: string;
  /**
   * Calldata passed to the factory's `createAccount` method.
   * Only present when the account is being deployed (first UserOp).
   */
  factoryData?: string;
  /** ABI-encoded calldata forwarded to the account's `execute` function. */
  callData: string;
  /** Gas limit for the account's execution phase (hex string). */
  callGasLimit: string;
  /** Gas limit for the account's signature-verification phase (hex string). */
  verificationGasLimit: string;
  /** Gas overhead charged before on-chain execution begins (hex string). */
  preVerificationGas: string;
  /** Maximum total gas price the sender is willing to pay (hex string, wei). */
  maxFeePerGas: string;
  /** Maximum priority fee (tip) per gas unit (hex string, wei). */
  maxPriorityFeePerGas: string;
  /**
   * Address of the paymaster that sponsors gas fees.
   * Only present when using a paymaster.
   */
  paymaster?: string;
  /** Gas limit for the paymaster's verification phase (hex string). */
  paymasterVerificationGasLimit?: string;
  /** Gas limit for the paymaster's post-operation hook (hex string). */
  paymasterPostOpGasLimit?: string;
  /** Arbitrary data passed to the paymaster's `validatePaymasterUserOp`. */
  paymasterData?: string;
  /** Signature over the UserOperation hash, validated by the account. */
  signature: string;
}
