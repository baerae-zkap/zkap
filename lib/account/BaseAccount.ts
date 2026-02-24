import { ethers } from "ethers";
import { PackedUserOperation } from "../types/UserOperation";

export abstract class BaseAccount {
  protected address: string;

  constructor(address: string) {
    if (!ethers.isAddress(address)) {
      throw new Error(`Invalid account address: "${address}"`);
    }
    this.address = address;
  }

  abstract signUserOpHash(userOpHash: string): Promise<string[]>;
  abstract sendTransaction(userOp: PackedUserOperation): Promise<string>;
  abstract getNonce(nonceKey?: bigint): Promise<bigint>;

  getAddress(): string {
    return this.address;
  }
}
