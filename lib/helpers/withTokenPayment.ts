import { ethers } from "ethers";
import { ZkapBuilder } from "../builders/ZkapBuilder";
import { PaymasterService, TokenPaymentResponse } from "../utils/PaymasterService";
import { AaOperationError, AaOperationErrorCode } from "../errors";

export type { TokenPaymentResponse };

export interface WithTokenPaymentOptions {
  /** Paymaster server base URL, e.g. "https://api.zkap.app" */
  paymasterServerUrl: string;
  /** Value of the X-Service-Key header */
  serviceKey: string;
  /** ERC-20 token address used for gas payment */
  tokenAddress: string;
  /** Optional idempotency key forwarded as Idempotency-Key header */
  idempotencyKey?: string;
}

/**
 * Computes the expected rewritten callData that the server should produce for
 * a token-payment flow.  Extracted as a pure static helper so both the
 * verification step and the actual rewrite use **identical logic**,
 * guaranteeing byte-level determinism.
 *
 * @param builder  Builder whose current callData is the original (pre-rewrite) value
 * @param treasury Paymaster treasury address returned by the server
 * @param tokenAddress ERC-20 token address
 * @param tokenAmount Token amount (as bigint)
 * @returns Hex-encoded rewritten callData
 */
export function computeRewrittenCallData(
  builder: ZkapBuilder,
  treasury: string,
  tokenAddress: string,
  tokenAmount: bigint
): string {
  // Clone current callData, apply rewrite on a scratch builder state, return result
  const originalCallData = builder.getUserOp().callData;

  // Build a minimal throw-away builder snapshot: reuse the same chainId/entryPoint
  // but we only need the callData transformation, so we create a minimal proxy.
  // We use the same builder instance temporarily then restore — but since
  // updateUserOpCallDataForPaymasterERC20 mutates `this.userOp.callData` in-place,
  // we must snapshot, apply, read, then restore.
  //
  // This is safe: all other fields are irrelevant for the callData computation.
  const saved = originalCallData;
  builder["userOp"].callData = originalCallData; // ensure original is set
  builder.updateUserOpCallDataForPaymasterERC20(treasury, tokenAddress, tokenAmount);
  const rewritten = builder["userOp"].callData as string;
  // Restore original callData
  builder["userOp"].callData = saved;

  return rewritten;
}

/**
 * High-level helper for Phase 2 TOKEN_PAYMENT flow.
 *
 * Steps:
 * 1. Extracts the unsigned UserOp from `builder`.
 * 2. POSTs to `/paymaster-v2/v1/sponsorship/token-payment`.
 * 3. Verifies the server's callData rewrite byte-for-byte against the SDK's
 *    own deterministic rewrite (trust boundary check).
 * 4. On success, patches the builder (callData + paymaster fields + gas limits).
 * 5. Returns `{ tokenAmount, treasury, sessionId }` for the UI.
 *
 * The caller is responsible for signing the UserOp after this call.
 *
 * @throws {Error} CALLDATA_REWRITE_MISMATCH if server callData differs from expected
 * @throws {AaFetchError} on HTTP / timeout / JSON parse failures
 * @throws {AaOperationError} if builder state is invalid
 */
export async function withTokenPayment(
  builder: ZkapBuilder,
  options: WithTokenPaymentOptions
): Promise<{ tokenAmount: string; treasury: string; sessionId: string }> {
  if (!ethers.isAddress(options.tokenAddress)) {
    throw new AaOperationError({
      code: AaOperationErrorCode.INPUT_INVALID_ADDRESS,
      operation: "with_token_payment",
      message: `withTokenPayment: tokenAddress is not a valid Ethereum address: "${options.tokenAddress}"`,
    });
  }

  // 1. Snapshot the current (original, pre-rewrite) UserOp
  const currentUserOp = builder.getUserOp();

  // 2. Call the paymaster server
  const service = new PaymasterService({
    serverUrl: options.paymasterServerUrl,
    paymasterAddress: ethers.ZeroAddress, // placeholder; real address comes from server response
    chainId: builder["chainId"] as number,
    mode: 1, // PaymasterMode.ERC20
    tokenAddress: options.tokenAddress,
  });

  const serverResponse: TokenPaymentResponse = await service.sponsorTokenPayment(
    {
      chainId: builder["chainId"] as number,
      userOp: currentUserOp,
      tokenAddress: options.tokenAddress,
    },
    {
      serviceKey: options.serviceKey,
      idempotencyKey: options.idempotencyKey,
    }
  );

  // 3. Byte-level verification: SDK independently computes the expected callData
  //    rewrite and compares it to what the server returned.
  const expectedCallData = computeRewrittenCallData(
    builder,
    serverResponse.treasury,
    options.tokenAddress,
    BigInt(serverResponse.tokenAmount)
  );

  if (
    expectedCallData.toLowerCase() !==
    serverResponse.rewrittenUserOp.callData.toLowerCase()
  ) {
    throw new Error(
      `CALLDATA_REWRITE_MISMATCH: server rewrite differs from SDK expectation. ` +
        `Refuse to sign. server=${serverResponse.rewrittenUserOp.callData}, expected=${expectedCallData}`
    );
  }

  // 4. Verification passed — patch the builder
  // setCallData requires signerKeyTypes to be set; use the internal field directly
  // since callData rewrite preserves the same signer context.
  builder["userOp"].callData = serverResponse.rewrittenUserOp.callData;
  builder.setPaymaster(serverResponse.paymaster);
  builder.setPaymasterData(serverResponse.paymasterData);
  builder.setPaymasterVerificationGasLimit(
    ethers.toBeHex(BigInt(serverResponse.paymasterVerificationGasLimit))
  );
  builder.setPaymasterPostOpGasLimit(
    ethers.toBeHex(BigInt(serverResponse.paymasterPostOpGasLimit))
  );
  // Apply server gas re-estimates
  builder.setCallGasLimit(
    ethers.toBeHex(BigInt(serverResponse.rewrittenUserOp.callGasLimit))
  );
  builder.setVerificationGasLimit(
    ethers.toBeHex(BigInt(serverResponse.rewrittenUserOp.verificationGasLimit))
  );
  builder.setPreVerificationGas(
    ethers.toBeHex(BigInt(serverResponse.rewrittenUserOp.preVerificationGas))
  );

  // 5. Return metadata for the UI
  return {
    tokenAmount: serverResponse.tokenAmount,
    treasury: serverResponse.treasury,
    sessionId: serverResponse.sessionId,
  };
}
