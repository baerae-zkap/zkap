import { ZkapBuilder } from "./ZkapBuilder";
import { ZkapFactoryBuilder } from "./ZkapFactoryBuilder";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { ethers } from "hardhat";

export interface ZkapCreatorInfo {
  chainId: number;
  entryPoint: string;
  keyFactory: string;
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
  private keyFactory: string;
  private salt: string;
  private encodedMasterKey: string;
  private encodedTxKey: string;
  private address: string = ethers.ZeroAddress;
  constructor({
    chainId,
    entryPoint,
    zkapFactory,
    keyFactory,
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
    this.setInitCode(
      zkapFactory,
      salt,
      keyFactory,
      encodedMasterKey,
      encodedTxKey
    );
    this.zkapFactory = zkapFactory;
    this.keyFactory = keyFactory;
    this.salt = salt;
    this.encodedMasterKey = encodedMasterKey;
    this.encodedTxKey = encodedTxKey;
    this.enUrl = enUrl;
  }

  async getZkapAddress(): Promise<string> {
    if (this.address != ethers.ZeroAddress) return this.address;
    const zkapFactory = new ZkapFactoryBuilder(this.zkapFactory, this.enUrl);
    const zkapAddress = await zkapFactory.calcAccountAddress(
      this.salt,
      this.keyFactory,
      this.encodedMasterKey,
      this.encodedTxKey
    );
    this.address = zkapAddress;
    return zkapAddress;
  }

  async completeUserOp(): Promise<this> {
    const zkapAddress = await this.getZkapAddress();
    this.setSender(zkapAddress);
    await super.completeUserOp();
    return this;
  }
}
