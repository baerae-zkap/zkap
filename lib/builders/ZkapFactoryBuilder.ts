import { ethers } from "ethers";
import { ZkapAccountFactoryABI } from "../types/abi";

export class ZkapFactoryBuilder {
  private provider: ethers.JsonRpcProvider;
  private accountFactory: ethers.Contract;

  constructor(address: string, enUrl: string) {
    if (!ethers.isAddress(address)) {
      throw new Error(`ZkapFactoryBuilder: invalid contract address: "${address}"`);
    }
    try {
      new URL(enUrl);
    } catch {
      throw new Error(`Invalid enUrl: "${enUrl}". Must be a valid URL.`);
    }
    this.provider = new ethers.JsonRpcProvider(enUrl);
    this.accountFactory = new ethers.Contract(
      address,
      ZkapAccountFactoryABI,
      this.provider
    );
  }

  async calcAccountAddress(
    salt: string,
    encodedMasterKey: string,
    encodedTxKey: string
  ): Promise<string> {
    const address = await this.accountFactory.calcAccountAddress(
      salt,
      encodedMasterKey,
      encodedTxKey
    );
    return address;
  }
}
