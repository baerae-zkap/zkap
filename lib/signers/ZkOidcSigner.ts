import { ethers } from "ethers";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";

export class ZkOidcSigner implements IUserOpSigner {
  public keyTypes: number[] = [PrimitiveAccountKeyTypes.keyZkOAuthRS256];
  private sharedInputs: string[] | undefined;
  private partialRhsList: string[] | undefined;
  private proofs: string[][] | undefined;

  /**
   * ZK proof 데이터 설정
   * @param data.sharedInputs - 7개 요소 배열
   *   - [0] hanchor: Anchor 해시
   *   - [1] h_ctx: Context 해시
   *   - [2] root: Merkle root
   *   - [3] h_sign_userop: UserOp 해시 (mod SNARK_SCALAR_FIELD)
   *   - [4] block_timestamp: 증명 생성 시점
   *   - [5] lhs: Left-hand side 합계
   *   - [6] h_aud_list: Audience 리스트 해시
   * @param data.partialRhsList - K개 요소: 각 proof의 partial_rhs
   * @param data.proofs - K x 8 배열: K개의 Groth16 증명
   */
  setProofData(data: {
    sharedInputs: string[];
    partialRhsList: string[];
    proofs: string[][];
  }): void {
    this.sharedInputs = data.sharedInputs;
    this.partialRhsList = data.partialRhsList;
    this.proofs = data.proofs;
  }

  async signUserOpHash(_userOpHash?: string): Promise<string[]> {
    if (!this.sharedInputs || !this.partialRhsList || !this.proofs) {
      throw new Error("sharedInputs, partialRhsList, and proofs must be set before signing");
    }

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = abiCoder.encode(
      ["uint256[7]", "uint256[]", "uint256[8][]"],
      [this.sharedInputs, this.partialRhsList, this.proofs]
    );

    return [encoded];
  }
}
