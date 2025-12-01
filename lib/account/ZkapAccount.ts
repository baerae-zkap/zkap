import { BaseAccount } from "./BaseAccount";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { ethers } from "ethers";
import EntryPoint from "../types/abi/EntryPoint.json";
import { PackedUserOperation } from "../types/UserOperation";

export class ZkapAccount extends BaseAccount {
  private signer: IUserOpSigner;
  private provider: ethers.JsonRpcProvider;
  private entryPoint: ethers.Contract;

  constructor(
    address: string,
    signer: IUserOpSigner,
    enUrl: string,
    entryPointAddress: string
  ) {
    super(address);
    this.signer = signer;
    this.provider = new ethers.JsonRpcProvider(enUrl);
    this.entryPoint = new ethers.Contract(
      entryPointAddress,
      EntryPoint.abi,
      this.provider
    );
  }

  async signUserOpHash(opHash: string): Promise<string[]> {
    try {
      const signedOp = await this.signer.signUserOpHash(opHash);
      return signedOp;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async getNonce(): Promise<number> {
    const nonce = await this.entryPoint.getNonce(this.address, 0);
    return nonce;
  }

  async sendTransaction(userOp: PackedUserOperation): Promise<string> {
    throw new Error("Method not implemented.");
  }
}
