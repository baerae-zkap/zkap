import { ethers } from "ethers";
import { AaOperationError, AaOperationErrorCode } from "../errors";

export const MAX_WALLET_INDEX = 255;

/**
 * Computes the deterministic salt for a ZKAP wallet address.
 *
 * This is the **canonical** implementation of salt derivation for the ZKAP
 * protocol. Import it rather than re-implementing the ABI encoding — the salt
 * determines the wallet address, so a mismatch strands funds.
 *
 * Two derivation paths, selected by `walletIndex`:
 * - `walletIndex` omitted, `undefined`, or `0`:
 *   `keccak256(abi.encode(string aud, string sub))` — matches the pre-existing
 *   on-chain derivation. This is "wallet index 0", the default wallet for a
 *   given social-login identity.
 * - `walletIndex` an integer in `[1, 255]`:
 *   `keccak256(abi.encode(string aud, string sub, string walletIndex))`, where
 *   the third ABI slot carries the decimal-string form of `walletIndex`. This
 *   lets a single (aud, sub) social identity derive up to 255 additional,
 *   independent wallet addresses.
 *
 * ABI slot 3 is reserved for the walletIndex decimal string ("1".."255",
 * extensible upward). Any future derivation parameter MUST occupy slot 4+,
 * never reuse slot 3.
 *
 * `walletIndex` must be a non-negative integer `<= 255` when provided
 * (`Number.isInteger` — non-integers, negatives, and non-numbers all throw).
 * `undefined` is the only value that selects the 2-arg path implicitly; `0`
 * selects it explicitly. There is no `??`-style coalescing here — `null` is
 * rejected rather than silently treated as `undefined` or `0`.
 */
export function computeSalt(
  aud: string,
  sub: string,
  walletIndex?: number
): string {
  if (walletIndex === undefined) {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string"],
        [aud, sub]
      )
    );
  }

  if (
    !Number.isInteger(walletIndex) ||
    walletIndex < 0 ||
    walletIndex > MAX_WALLET_INDEX
  ) {
    throw new AaOperationError({
      code: AaOperationErrorCode.INPUT_OUT_OF_RANGE,
      operation: "compute_salt",
      message: `Invalid walletIndex: ${String(walletIndex)}. Must be an integer in [0, ${MAX_WALLET_INDEX}].`,
    });
  }

  if (walletIndex === 0) {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string"],
        [aud, sub]
      )
    );
  }

  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "string", "string"],
      [aud, sub, String(walletIndex)]
    )
  );
}
