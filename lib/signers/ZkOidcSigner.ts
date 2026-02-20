import { ethers } from "ethers";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";
import { BN254_FR } from "../utils/crypto";

function validateBN254Field(value: string, label: string): void {
  const val = BigInt(value);
  if (val < 0n || val >= BN254_FR) {
    throw new Error(`${label} is out of BN254 scalar field range: ${value}`);
  }
}

export class ZkOidcSigner implements IUserOpSigner {
  public readonly keyTypes: number[] = [PrimitiveAccountKeyTypes.keyZkOAuthRS256];
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
    if (!Array.isArray(data.sharedInputs) || data.sharedInputs.length !== 7) {
      throw new Error(`setProofData: sharedInputs must be an array of 7 elements, got ${data.sharedInputs?.length}`);
    }
    for (let i = 0; i < data.sharedInputs.length; i++) {
      if (typeof data.sharedInputs[i] !== 'string' || !/^\d+$/.test(data.sharedInputs[i])) {
        throw new Error(`setProofData: sharedInputs[${i}] must be a numeric string, got ${JSON.stringify(data.sharedInputs[i])}`);
      }
      validateBN254Field(data.sharedInputs[i], `sharedInputs[${i}]`);
    }
    if (!Array.isArray(data.partialRhsList)) {
      throw new Error("setProofData: partialRhsList must be an array");
    }
    if (!Array.isArray(data.proofs) || data.proofs.length === 0) {
      throw new Error("setProofData: proofs must be a non-empty array");
    }
    if (data.partialRhsList.length !== data.proofs.length) {
      throw new Error(`setProofData: partialRhsList.length (${data.partialRhsList.length}) must equal proofs.length (${data.proofs.length})`);
    }
    for (let i = 0; i < data.proofs.length; i++) {
      if (!Array.isArray(data.proofs[i]) || data.proofs[i].length !== 8) {
        throw new Error(`setProofData: proofs[${i}] must be an array of 8 elements, got ${data.proofs[i]?.length}`);
      }
    }
    // BN254 scalar field 범위 검증
    for (let i = 0; i < data.partialRhsList.length; i++) {
      validateBN254Field(data.partialRhsList[i], `partialRhsList[${i}]`);
    }
    for (let i = 0; i < data.proofs.length; i++) {
      for (let j = 0; j < data.proofs[i].length; j++) {
        validateBN254Field(data.proofs[i][j], `proofs[${i}][${j}]`);
      }
    }
    this.sharedInputs = data.sharedInputs;
    this.partialRhsList = data.partialRhsList;
    this.proofs = data.proofs;
  }

  async signUserOpHash(userOpHash: string): Promise<string[]> {
    if (!this.sharedInputs || !this.partialRhsList || !this.proofs) {
      throw new Error("sharedInputs, partialRhsList, and proofs must be set before signing");
    }

    if (typeof userOpHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(userOpHash)) {
      throw new Error(`signUserOpHash: userOpHash must be a 0x-prefixed 32-byte hex string (66 chars), got: ${userOpHash}`);
    }

    // userOpHash와 sharedInputs[3] 바인딩 검증
    // sharedInputs[3] == userOpHash mod BN254_FR
    const expectedHSignUserOp = (BigInt(userOpHash) % BN254_FR).toString();
    if (this.sharedInputs[3] !== expectedHSignUserOp) {
      throw new Error(
        `signUserOpHash: proof does not match userOpHash. sharedInputs[3] must equal userOpHash mod SNARK_SCALAR_FIELD`
      );
    }

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = abiCoder.encode(
      ["uint256[7]", "uint256[]", "uint256[8][]"],
      [this.sharedInputs, this.partialRhsList, this.proofs]
    );

    return [encoded];
  }

  /**
   * 메모리에서 ZK proof 데이터 참조를 제거합니다.
   * @note 민감한 증명 데이터 재사용을 방지하기 위해 사용 후 호출하세요.
   */
  destroy(): void {
    this.sharedInputs = undefined;
    this.partialRhsList = undefined;
    this.proofs = undefined;
  }
}
