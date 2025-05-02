import { ethers } from "ethers";
import { IUserOpSigner } from "../utils/IUserOpSigner";

export class AddressKeySigner implements IUserOpSigner {
  private privateKeys: string[];

  constructor(privateKeys: string[]) {
    this.privateKeys = privateKeys;
  }

  async signUserOpHash(userOpHash: string): Promise<string[]> {
    const signatures: string[] = [];
    for (const privateKey of this.privateKeys) {
      const wallet = new ethers.Wallet(privateKey);
      const sig = await wallet.signMessage(ethers.getBytes(userOpHash));
      signatures.push(sig);
    }
    return signatures;
  }
}
