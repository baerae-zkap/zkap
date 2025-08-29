import { ZkapBuilder } from "./ZkapBuilder";
import { ZkapFactoryBuilder } from "./ZkapFactoryBuilder";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { ethers } from "ethers";

export interface ZkapCreatorInfo {
  chainId: number;
  entryPoint: string;
  zkapFactory: string;
  enUrl: string;
  txKeySigner: IUserOpSigner;
  salt: string;
  encodedMasterKey: string;
  encodedTxKey: string;
}

export class ZkapCreator extends ZkapBuilder {
  private zkapFactory: string;
  private enUrl: string;
  private salt: string;
  private encodedMasterKey: string;
  private encodedTxKey: string;
  private address: string = ethers.ZeroAddress;
  constructor({
    chainId,
    entryPoint,
    zkapFactory,
    enUrl,
    txKeySigner,
    salt,
    encodedMasterKey,
    encodedTxKey,
  }: ZkapCreatorInfo) {
    super({
      chainId,
      entryPoint,
      enUrl,
      txKeySigner,
    });
    this.setInitCode(zkapFactory, salt, encodedMasterKey, encodedTxKey);
    this.zkapFactory = zkapFactory;
    this.salt = salt;
    this.encodedMasterKey = encodedMasterKey;
    this.encodedTxKey = encodedTxKey;
    this.enUrl = enUrl;
  }

  async deriveZkapAddress(): Promise<string> {
    if (this.address != ethers.ZeroAddress) return this.address;
    const zkapFactory = new ZkapFactoryBuilder(this.zkapFactory, this.enUrl);
    const zkapAddress = await zkapFactory.calcAccountAddress(
      this.salt,
      this.encodedMasterKey,
      this.encodedTxKey
    );
    this.address = zkapAddress;
    this.setSender(zkapAddress);
    return zkapAddress;
  }

  async completeUserOp(): Promise<this> {
    await this.deriveZkapAddress();
    await super.completeUserOp();
    return this;
  }
}
