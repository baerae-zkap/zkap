import { ethers } from "ethers";
import { ZkapAccountFactoryABI } from "../types/abi";

export class ZkapFactoryBuilder {
  private provider: ethers.JsonRpcProvider;
  private accountFactory: ethers.Contract;

  constructor(address: string, enUrl: string) {
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
  ) {
    const address = await this.accountFactory.calcAccountAddress(
      salt,
      encodedMasterKey,
      encodedTxKey
    );
    return address;
  }
}
