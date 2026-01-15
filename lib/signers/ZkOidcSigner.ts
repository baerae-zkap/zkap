import { ethers } from "ethers";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";

export class ZkOidcSigner implements IUserOpSigner {
  public keyTypes: number[] = [PrimitiveAccountKeyTypes.keyZkOAuthRS256];
  private proof: string[] | undefined;
  private publicInputs: string[] | undefined;

  setProofAndPublicInput(proof: string[], publicInputs: string[]) {
    this.proof = proof;
    this.publicInputs = publicInputs;
  }

  async signUserOpHash(_userOpHash?: string): Promise<string[]> {
    if (!this.proof || !this.publicInputs) {
      throw new Error("proof and publicInputs must be set before signing");
    }

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = abiCoder.encode(
      ["uint256[8]", "uint256[8]"],
      [this.publicInputs, this.proof]
    );

    return [encoded];
  }
}
