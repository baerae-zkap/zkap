import { ZkapBuilder } from "./ZkapBuilder";
import { ZkapFactoryBuilder } from "./ZkapFactoryBuilder";
import { ethers } from "ethers";

export interface ZkapCreatorInfo {
  chainId: number;
  entryPoint: string;
  zkapFactory: string;
  enUrl: string;
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
  private _derivePromise: Promise<string> | null = null;
  constructor({
    chainId,
    entryPoint,
    zkapFactory,
    enUrl,
    salt,
    encodedMasterKey,
    encodedTxKey,
  }: ZkapCreatorInfo) {
    super({
      chainId,
      entryPoint,
      enUrl,
    });
    this.setInitCode(zkapFactory, salt, { encodedMasterKey, encodedTxKey });
    this.zkapFactory = zkapFactory;
    this.salt = salt;
    this.encodedMasterKey = encodedMasterKey;
    this.encodedTxKey = encodedTxKey;
    this.enUrl = enUrl;
  }

  async deriveZkapAddress(): Promise<string> {
    if (this.address !== ethers.ZeroAddress) return this.address;
    if (!this._derivePromise) {
      this._derivePromise = (async () => {
        const zkapFactory = new ZkapFactoryBuilder(this.zkapFactory, this.enUrl);
        const zkapAddress = await zkapFactory.calcAccountAddress(
          this.salt,
          this.encodedMasterKey,
          this.encodedTxKey
        );
        this.address = zkapAddress;
        this.setSender(zkapAddress);
        return zkapAddress;
      })().catch((err) => {
        this._derivePromise = null; // 실패 시 재시도 가능하게 초기화
        throw err;
      });
    }
    return this._derivePromise;
  }

}
