import {
  AaCode,
  AaFetchErrorCode,
  AaFetchError,
  UserOpRevertError,
  type FetchService,
  type OperationType,
  type UserOpRevertPhase,
} from "../errors";
import { decodeContractError, extractHex } from "./revertDecoder";

// ---------------------------------------------------------------------------
// AA prefix → AaCode
// ---------------------------------------------------------------------------
const AA_PREFIX_TO_CODE: Readonly<Record<string, AaCode>> = {
  AA10: AaCode.AA10_SENDER_ALREADY_CONSTRUCTED,
  AA13: AaCode.AA13_INIT_CODE_FAILED,
  AA14: AaCode.AA14_INIT_CODE_MUST_RETURN_SENDER,
  AA15: AaCode.AA15_INIT_CODE_MUST_CREATE_SENDER,
  AA20: AaCode.AA20_NOT_DEPLOYED,
  AA21: AaCode.AA21_INSUFFICIENT_PREFUND,
  AA22: AaCode.AA22_EXPIRED_OR_NOT_DUE,
  AA23: AaCode.AA23_ACCOUNT_REVERTED,
  AA24: AaCode.AA24_SIGNATURE_ERROR,
  AA25: AaCode.AA25_INVALID_NONCE,
  AA31: AaCode.AA31_PAYMASTER_DEPOSIT_TOO_LOW,
  AA32: AaCode.AA32_PAYMASTER_EXPIRED_OR_NOT_DUE,
  AA33: AaCode.AA33_PAYMASTER_REVERTED,
  AA34: AaCode.AA34_PAYMASTER_SIGNATURE_ERROR,
  AA40: AaCode.AA40_OVER_VERIFICATION_GAS_LIMIT,
  AA41: AaCode.AA41_UNDER_VERIFICATION_GAS,
  AA50: AaCode.AA50_POST_OP_REVERTED,
  AA51: AaCode.AA51_PREFUND_BELOW_GAS_COST,
  AA90: AaCode.AA90_INVALID_BENEFICIARY,
  AA91: AaCode.AA91_FAILED_SEND_TO_BENEFICIARY,
  AA92: AaCode.AA92_INTERNAL_CALL_ONLY,
  AA93: AaCode.AA93_INVALID_PAYMASTER_AND_DATA,
  AA94: AaCode.AA94_GAS_VALUES_OVERFLOW,
  AA95: AaCode.AA95_OUT_OF_GAS,
};

/**
 * Extracts an AA prefix (AA##) from bundler text and maps it to an AaCode.
 * Returns undefined when no AA prefix is present (so the caller can treat it as a
 * channel/execution error). An AA prefix not in the catalog maps to AA_UNKNOWN.
 */
export function mapAaPrefix(text: string): AaCode | undefined {
  const match = text.match(/AA\d{2}/i);
  if (!match) return undefined;
  return AA_PREFIX_TO_CODE[match[0].toUpperCase()] ?? AaCode.UNKNOWN;
}

// ---------------------------------------------------------------------------
// AaCode → phase (lifecycle stage)
// ---------------------------------------------------------------------------
const CODE_TO_PHASE: Readonly<Record<AaCode, UserOpRevertPhase>> = {
  [AaCode.AA10_SENDER_ALREADY_CONSTRUCTED]: "factory",
  [AaCode.AA13_INIT_CODE_FAILED]: "factory",
  [AaCode.AA14_INIT_CODE_MUST_RETURN_SENDER]: "factory",
  [AaCode.AA15_INIT_CODE_MUST_CREATE_SENDER]: "factory",
  [AaCode.AA20_NOT_DEPLOYED]: "account_validation",
  [AaCode.AA21_INSUFFICIENT_PREFUND]: "account_validation",
  [AaCode.AA22_EXPIRED_OR_NOT_DUE]: "account_validation",
  [AaCode.AA23_ACCOUNT_REVERTED]: "account_validation",
  [AaCode.AA24_SIGNATURE_ERROR]: "account_validation",
  [AaCode.AA25_INVALID_NONCE]: "account_validation",
  [AaCode.AA40_OVER_VERIFICATION_GAS_LIMIT]: "account_validation",
  [AaCode.AA41_UNDER_VERIFICATION_GAS]: "account_validation",
  [AaCode.AA31_PAYMASTER_DEPOSIT_TOO_LOW]: "paymaster_validation",
  [AaCode.AA32_PAYMASTER_EXPIRED_OR_NOT_DUE]: "paymaster_validation",
  [AaCode.AA33_PAYMASTER_REVERTED]: "paymaster_validation",
  [AaCode.AA34_PAYMASTER_SIGNATURE_ERROR]: "paymaster_validation",
  [AaCode.AA50_POST_OP_REVERTED]: "post_op",
  [AaCode.AA51_PREFUND_BELOW_GAS_COST]: "post_op",
  [AaCode.AA90_INVALID_BENEFICIARY]: "unknown",
  [AaCode.AA91_FAILED_SEND_TO_BENEFICIARY]: "unknown",
  [AaCode.AA92_INTERNAL_CALL_ONLY]: "unknown",
  [AaCode.AA93_INVALID_PAYMASTER_AND_DATA]: "unknown",
  [AaCode.AA94_GAS_VALUES_OVERFLOW]: "unknown",
  [AaCode.AA95_OUT_OF_GAS]: "unknown",
  [AaCode.UNKNOWN]: "unknown",
};

export function aaCodeToPhase(code: AaCode): UserOpRevertPhase {
  return CODE_TO_PHASE[code] ?? "unknown";
}

// ---------------------------------------------------------------------------
// fetch() throw → TRANSPORT / TIMEOUT
// ---------------------------------------------------------------------------
export function makeFetchTransportError(
  err: unknown,
  ctx: { service: FetchService; url: string; method: "GET" | "POST"; operation: OperationType },
): AaFetchError {
  const isTimeout = err instanceof DOMException && err.name === "AbortError";
  return new AaFetchError({
    code: isTimeout ? AaFetchErrorCode.TIMEOUT : AaFetchErrorCode.TRANSPORT,
    cause: err,
    service: ctx.service,
    url: ctx.url,
    method: ctx.method,
    operation: ctx.operation,
  });
}

// ---------------------------------------------------------------------------
// classifyBundlerError — 3-way, always returns an error, always preserves raw
// ---------------------------------------------------------------------------
export interface ClassifyBundlerErrorOpts {
  /** Text to scan for an AA prefix (JSON-RPC error.message or REST body). */
  text: string;
  /** JSON-RPC error.data (revert bytes), when present. */
  data?: unknown;
  /** HTTP status, when the failure came with one (REST !res.ok). */
  httpStatus?: number;
  /** Pre-stringified original response — always preserved. */
  raw: string;
  operation: OperationType;
  service: FetchService;
  url: string;
  method: "GET" | "POST";
}

/**
 * Classifies a bundler error response. Each provider extracts the normalized
 * fields from its own transport; the rules live here.
 *
 *  1. AA prefix present        → UserOpRevertError (validation, AaCode + phase)
 *  2. no AA but revert data    → UserOpRevertError (execution, AA_UNKNOWN)
 *  3. otherwise                → AaFetchError (channel)
 *
 * Raw is preserved in every branch (rawBundlerError / rawResponse).
 */
export function classifyBundlerError(opts: ClassifyBundlerErrorOpts): UserOpRevertError | AaFetchError {
  const revertData = extractHex(opts.data);

  // 1) AA prefix → validation-phase rejection
  const aa = mapAaPrefix(opts.text);
  if (aa) {
    return new UserOpRevertError({
      code: aa,
      phase: aaCodeToPhase(aa),
      operation: opts.operation,
      contractError: decodeContractError(revertData),
      rawRevertData: revertData,
      rawBundlerError: opts.raw,
      message: opts.text,
    });
  }

  // 2) no AA prefix but revert data/reason present → execution-phase revert
  const looksLikeRevert = !!revertData || /reverted|execution reverted/i.test(opts.text);
  if (looksLikeRevert) {
    return new UserOpRevertError({
      code: AaCode.UNKNOWN,
      phase: "execution",
      operation: opts.operation,
      contractError: decodeContractError(revertData),
      rawRevertData: revertData,
      rawBundlerError: opts.raw,
      message: opts.text || "Execution reverted",
    });
  }

  // 3) genuine channel / response problem
  return new AaFetchError({
    // 4xx vs 5xx distinction is preserved on httpStatus; the consumer decides retry policy.
    code: opts.httpStatus != null ? AaFetchErrorCode.HTTP_STATUS : AaFetchErrorCode.RESPONSE_SHAPE,
    httpStatus: opts.httpStatus,
    service: opts.service,
    url: opts.url,
    method: opts.method,
    operation: opts.operation,
    rawResponse: opts.raw,
    message: opts.httpStatus != null ? `Bundler returned HTTP ${opts.httpStatus}` : "Unexpected bundler response",
  });
}
