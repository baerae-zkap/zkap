/**
 * withTokenPayment helper — unit tests
 *
 * All network calls are mocked. The builder stub uses the real
 * computeRewrittenCallData path by making updateUserOpCallDataForPaymasterERC20
 * mutate the builder's userOp.callData to the expected value.
 */

import { ethers } from "ethers";
import { withTokenPayment } from "../withTokenPayment";
import type { WithTokenPaymentOptions } from "../withTokenPayment";
import type { TokenPaymentResponse } from "../../utils/PaymasterService";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_PAYMASTER_URL = "https://paymaster.test";
const MOCK_SERVICE_KEY = "sk-test-1234";
const MOCK_TOKEN_ADDRESS = "0x" + "aa".repeat(20);
const MOCK_PAYMASTER_ADDRESS = "0x" + "bb".repeat(20);
const MOCK_TREASURY = "0x" + "cc".repeat(20);
const MOCK_SESSION_ID = "sess_abc123";
const MOCK_TOKEN_AMOUNT = "1000000000000000000"; // 1e18
const MOCK_ORIGINAL_CALL_DATA = "0x" + "11".repeat(32);
const MOCK_REWRITTEN_CALL_DATA = "0x" + "22".repeat(64);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSponsorTokenPayment = jest.fn();

jest.mock("../../utils/PaymasterService", () => {
  return {
    PaymasterService: jest.fn().mockImplementation(() => ({
      sponsorTokenPayment: mockSponsorTokenPayment,
    })),
    PaymasterMode: { VERIFYING: 0, ERC20: 1 },
  };
});

// ---------------------------------------------------------------------------
// Builder stub helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal ZkapBuilder-shaped stub.
 *
 * updateUserOpCallDataForPaymasterERC20 is implemented to mutate
 * userOp.callData to MOCK_REWRITTEN_CALL_DATA (mimicking the real method),
 * so computeRewrittenCallData inside withTokenPayment produces the same value
 * as what the server returns in happy-path tests.
 */
function makeBuilderStub(overrides?: {
  updateUserOpCallDataForPaymasterERC20?: jest.Mock;
}) {
  const stub = {
    chainId: 1,
    userOp: {
      callData: MOCK_ORIGINAL_CALL_DATA,
      sender: "0x" + "dd".repeat(20),
      nonce: "0x1",
      initCode: "0x",
      callGasLimit: "0x5208",
      verificationGasLimit: "0x186a0",
      preVerificationGas: "0xc350",
      maxFeePerGas: "0x3b9aca00",
      maxPriorityFeePerGas: "0x3b9aca00",
      paymaster: ethers.ZeroAddress,
      paymasterData: "0x",
      paymasterVerificationGasLimit: "0x00",
      paymasterPostOpGasLimit: "0x00",
      signature: "0x",
    } as Record<string, unknown>,
    getUserOp: jest.fn(),
    setPaymaster: jest.fn().mockReturnThis(),
    setPaymasterData: jest.fn().mockReturnThis(),
    setPaymasterVerificationGasLimit: jest.fn().mockReturnThis(),
    setPaymasterPostOpGasLimit: jest.fn().mockReturnThis(),
    setCallGasLimit: jest.fn().mockReturnThis(),
    setVerificationGasLimit: jest.fn().mockReturnThis(),
    setPreVerificationGas: jest.fn().mockReturnThis(),
    // Default: mutates callData to MOCK_REWRITTEN_CALL_DATA (happy-path behaviour)
    updateUserOpCallDataForPaymasterERC20:
      overrides?.updateUserOpCallDataForPaymasterERC20 ??
      jest.fn().mockImplementation(function (this: typeof stub) {
        stub.userOp.callData = MOCK_REWRITTEN_CALL_DATA;
        return stub;
      }),
  };
  stub.getUserOp.mockReturnValue(stub.userOp);
  return stub;
}

function makeServerResponse(overrides?: Partial<TokenPaymentResponse>): TokenPaymentResponse {
  return {
    rewrittenUserOp: {
      callData: MOCK_REWRITTEN_CALL_DATA,
      callGasLimit: "0x8000",
      verificationGasLimit: "0x30000",
      preVerificationGas: "0xe000",
      maxFeePerGas: "0x3b9aca00",
      maxPriorityFeePerGas: "0x3b9aca00",
      paymasterVerificationGasLimit: "0xa000",
      paymasterPostOpGasLimit: "0x20000",
    },
    paymaster: MOCK_PAYMASTER_ADDRESS,
    paymasterData: "0x" + "ee".repeat(78),
    paymasterVerificationGasLimit: "0xa000",
    paymasterPostOpGasLimit: "0x20000",
    validUntil: 9999999999,
    validAfter: 0,
    treasury: MOCK_TREASURY,
    tokenAmount: MOCK_TOKEN_AMOUNT,
    sessionId: MOCK_SESSION_ID,
    ...overrides,
  };
}

function makeOptions(overrides?: Partial<WithTokenPaymentOptions>): WithTokenPaymentOptions {
  return {
    paymasterServerUrl: MOCK_PAYMASTER_URL,
    serviceKey: MOCK_SERVICE_KEY,
    tokenAddress: MOCK_TOKEN_ADDRESS,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("withTokenPayment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Happy path
  // -------------------------------------------------------------------------
  it("happy path: SDK verify passes → builder fields updated, returns tokenAmount/treasury/sessionId", async () => {
    const builder = makeBuilderStub();
    const serverResponse = makeServerResponse();
    mockSponsorTokenPayment.mockResolvedValueOnce(serverResponse);

    const result = await withTokenPayment(
      builder as unknown as import("../../builders/ZkapBuilder").ZkapBuilder,
      makeOptions()
    );

    // Returns correct metadata
    expect(result).toEqual({
      tokenAmount: MOCK_TOKEN_AMOUNT,
      treasury: MOCK_TREASURY,
      sessionId: MOCK_SESSION_ID,
    });

    // Builder fields patched
    expect(builder.setPaymaster).toHaveBeenCalledWith(MOCK_PAYMASTER_ADDRESS);
    expect(builder.setPaymasterData).toHaveBeenCalledWith(serverResponse.paymasterData);
    expect(builder.setPaymasterVerificationGasLimit).toHaveBeenCalledWith(
      ethers.toBeHex(BigInt(serverResponse.paymasterVerificationGasLimit))
    );
    expect(builder.setPaymasterPostOpGasLimit).toHaveBeenCalledWith(
      ethers.toBeHex(BigInt(serverResponse.paymasterPostOpGasLimit))
    );
    expect(builder.setCallGasLimit).toHaveBeenCalledWith(
      ethers.toBeHex(BigInt(serverResponse.rewrittenUserOp.callGasLimit))
    );
    expect(builder.setVerificationGasLimit).toHaveBeenCalledWith(
      ethers.toBeHex(BigInt(serverResponse.rewrittenUserOp.verificationGasLimit))
    );
    expect(builder.setPreVerificationGas).toHaveBeenCalledWith(
      ethers.toBeHex(BigInt(serverResponse.rewrittenUserOp.preVerificationGas))
    );

    // callData on userOp was updated to the server's rewritten value
    expect(builder.userOp.callData).toBe(MOCK_REWRITTEN_CALL_DATA);
  });

  // -------------------------------------------------------------------------
  // 2. CALLDATA_REWRITE_MISMATCH: server tampers with callData
  // -------------------------------------------------------------------------
  it("throws CALLDATA_REWRITE_MISMATCH when server callData differs from SDK expectation", async () => {
    const TAMPERED_CALL_DATA = "0xdeadbeef";
    // Server returns a different callData than what the SDK produces
    const serverResponse = makeServerResponse({
      rewrittenUserOp: {
        callData: TAMPERED_CALL_DATA,
        callGasLimit: "0x8000",
        verificationGasLimit: "0x30000",
        preVerificationGas: "0xe000",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x3b9aca00",
        paymasterVerificationGasLimit: "0xa000",
        paymasterPostOpGasLimit: "0x20000",
      },
    });
    // SDK's own rewrite produces MOCK_REWRITTEN_CALL_DATA ≠ TAMPERED_CALL_DATA
    const builder = makeBuilderStub(); // updateUserOpCallDataForPaymasterERC20 → MOCK_REWRITTEN_CALL_DATA
    mockSponsorTokenPayment.mockResolvedValueOnce(serverResponse);

    await expect(
      withTokenPayment(
        builder as unknown as import("../../builders/ZkapBuilder").ZkapBuilder,
        makeOptions()
      )
    ).rejects.toThrow("CALLDATA_REWRITE_MISMATCH");

    // Builder must NOT have been patched with paymaster fields
    expect(builder.setPaymaster).not.toHaveBeenCalled();
    expect(builder.setPaymasterData).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. Server error (4xx / 5xx) propagates
  // -------------------------------------------------------------------------
  it("propagates server error responses (4xx/5xx)", async () => {
    const builder = makeBuilderStub();
    const serverError = new Error("ZKAP_AA_FETCH_HTTP_STATUS: 401 Unauthorized");
    mockSponsorTokenPayment.mockRejectedValueOnce(serverError);

    await expect(
      withTokenPayment(
        builder as unknown as import("../../builders/ZkapBuilder").ZkapBuilder,
        makeOptions()
      )
    ).rejects.toThrow("ZKAP_AA_FETCH_HTTP_STATUS");
  });

  // -------------------------------------------------------------------------
  // 4. tokenAmount and treasury returned accurately
  // -------------------------------------------------------------------------
  it("returns correct tokenAmount and treasury from server response", async () => {
    const builder = makeBuilderStub();
    const customAmount = "500000000000000000"; // 0.5e18
    const customTreasury = "0x" + "ff".repeat(20);
    const serverResponse = makeServerResponse({
      tokenAmount: customAmount,
      treasury: customTreasury,
    });
    mockSponsorTokenPayment.mockResolvedValueOnce(serverResponse);

    const result = await withTokenPayment(
      builder as unknown as import("../../builders/ZkapBuilder").ZkapBuilder,
      makeOptions()
    );

    expect(result.tokenAmount).toBe(customAmount);
    expect(result.treasury).toBe(customTreasury);
    expect(result.sessionId).toBe(MOCK_SESSION_ID);
  });

  // -------------------------------------------------------------------------
  // 5. Headers: X-Service-Key and Idempotency-Key are forwarded
  // -------------------------------------------------------------------------
  it("forwards X-Service-Key and Idempotency-Key to PaymasterService.sponsorTokenPayment", async () => {
    const builder = makeBuilderStub();
    const serverResponse = makeServerResponse();
    mockSponsorTokenPayment.mockResolvedValueOnce(serverResponse);

    const idempotencyKey = "idem-key-xyz";
    await withTokenPayment(
      builder as unknown as import("../../builders/ZkapBuilder").ZkapBuilder,
      makeOptions({ idempotencyKey })
    );

    expect(mockSponsorTokenPayment).toHaveBeenCalledWith(
      expect.objectContaining({ tokenAddress: MOCK_TOKEN_ADDRESS }),
      expect.objectContaining({
        serviceKey: MOCK_SERVICE_KEY,
        idempotencyKey,
      })
    );
  });

  // -------------------------------------------------------------------------
  // 6. Invalid tokenAddress throws early
  // -------------------------------------------------------------------------
  it("throws AaOperationError for invalid tokenAddress before any network call", async () => {
    const builder = makeBuilderStub();

    await expect(
      withTokenPayment(
        builder as unknown as import("../../builders/ZkapBuilder").ZkapBuilder,
        makeOptions({ tokenAddress: "not-an-address" })
      )
    ).rejects.toThrow("tokenAddress is not a valid Ethereum address");

    expect(mockSponsorTokenPayment).not.toHaveBeenCalled();
  });
});
