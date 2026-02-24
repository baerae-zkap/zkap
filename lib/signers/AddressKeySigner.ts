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
   * 메모리에서 개인키 참조를 제거합니다.
   * @note JavaScript 문자열은 불변이므로 참조 제거만 가능합니다.
   *       민감한 키 재사용을 방지하기 위해 사용 후 호출하세요.
   */
  destroy(): void {
    this.privateKeys = [];
  }
}
