import { ethers } from "ethers";
import { ZkapAccountFactoryABIstring } from "../resources/abis";

export class ZkapFactoryBuilder {
  private provider: ethers.JsonRpcProvider;
  private accountFactory: ethers.Contract;

  constructor(address: string, enUrl: string) {
    this.provider = new ethers.JsonRpcProvider(enUrl);
    this.accountFactory = new ethers.Contract(
      address,
      ZkapAccountFactoryABIstring,
      this.provider
    );
  }

  async calcAccountAddress(
    salt: string,
    compositeAccountKeyFactoryAddress: string,
    encodedMasterKey: string,
    encodedTxKey: string
  ) {
    const address = await this.accountFactory.calcAccountAddress(
      salt,
      compositeAccountKeyFactoryAddress,
      encodedMasterKey,
      encodedTxKey
    );

    return address;
  }
}
