/**
 * Interface for signing ERC-4337 UserOperation hashes.
 *
 * Implement this interface to provide a custom signing strategy (e.g. EOA private key,
 * WebAuthn passkey, or ZK-based OAuth). The SDK uses the returned signatures to
 * populate the `signature` field of a `PackedUserOperation`.
 *
 * @example
 * ```ts
 * class MySigner implements IUserOpSigner {
 *   readonly keyTypes = [PrimitiveAccountKeyTypes.keyAddress];
 *
 *   async signUserOpHash(userOpHash: string): Promise<string[]> {
 *     return [await wallet.signMessage(ethers.getBytes(userOpHash))];
 *   }
 * }
 * ```
 */
export interface IUserOpSigner {
  /**
   * The account key type identifiers this signer handles.
   * Values correspond to `PrimitiveAccountKeyTypes` enum entries.
   */
  readonly keyTypes: number[];

  /**
   * Signs a UserOperation hash and returns one or more encoded signatures.
   *
   * @param userOpHash - The 32-byte hex hash of the packed UserOperation.
   * @returns An array of ABI-encoded signature strings, one per signing key.
   * @throws If the signing operation fails or the hash is malformed.
   */
  signUserOpHash(userOpHash: string): Promise<string[]>;
}
