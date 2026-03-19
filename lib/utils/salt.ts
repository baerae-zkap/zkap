import { ethers } from "ethers";

/**
 * Computes the deterministic salt for a ZKAP wallet address.
 * Matches the on-chain: keccak256(abi.encode(string aud, string sub))
 */
export function computeSalt(aud: string, sub: string): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "string"],
      [aud, sub]
    )
  );
}
