import { ethers } from "ethers";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";

export class AddressKeySigner implements IUserOpSigner {
  public readonly keyTypes: number[] = [PrimitiveAccountKeyTypes.keyAddress];
  private privateKeys: string[];

  constructor(privateKeys: string[]) {
    if (!Array.isArray(privateKeys) || privateKeys.length === 0) {
      throw new Error("AddressKeySigner: privateKeys must be a non-empty array");
    }
    for (let i = 0; i < privateKeys.length; i++) {
      try {
        new ethers.Wallet(privateKeys[i]);
      } catch {
        throw new Error(`AddressKeySigner: privateKeys[${i}] is not a valid private key`);
      }
    }
    this.privateKeys = privateKeys;
  }

  async signUserOpHash(userOpHash: string): Promise<string[]> {
    const signatures: string[] = [];
    for (const privateKey of this.privateKeys) {
      const wallet = new ethers.Wallet(privateKey);
      const sig = wallet.signingKey.sign(ethers.getBytes(userOpHash)).serialized;
      signatures.push(sig);
    }
    return signatures;
  }

  /**
   * Removes private key references from memory.
   * @note JavaScript strings are immutable, so only the reference can be removed.
   *       Call this after use to prevent reuse of sensitive key data.
   */
  destroy(): void {
    this.privateKeys = [];
  }
}
