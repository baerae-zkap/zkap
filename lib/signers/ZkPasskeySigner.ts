import { ethers } from "ethers";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import cryptoUtils from "../utils/crypto";
import zkapAccountJson from "../types/abi/ZkapAccount.json";
import AccountKeyZkOAuthRS256Verifier3 from "../types/abi/AccountKeyZkOAuthRS256Verifier3.json";
import poseidonMerkleTreeDirectoryJson from "../types/abi/PoseidonMerkleTreeDirectory.json";

// TODO: @kaikookim naming 변경, simulator 기반으로 테스트를 위해 만들어 진 내용이고 추후 각 social login 에 맞게 수정 필요.
export class ZkPasskeySigner implements IUserOpSigner {
  private proofServerUrl: string;
  private zkapAddress: string;
  private provider: ethers.JsonRpcProvider;
  private zkapAccount: ethers.Contract | undefined;
  private zkOAuthRS256Verifier: ethers.Contract | undefined;
  private isInitialized: boolean = false;
  private anchor: string[] | undefined;
  private poseidonMerkleTreeDirectory: ethers.Contract | undefined;
  private poseidonMerkleTreeDirectoryAddress: string;
  private merklePaths: string[][] | undefined;
  private root: string | undefined;
  private leafIndices: number[] | undefined;
  private jwtPks: string[] | undefined;
  private socialServices: string[];
  private idTokenGenerators: ((msgHash: string) => Promise<string>)[];
  private selector: boolean[] | undefined;

  private LEAF_IDX_GOOGLE = 0;
  private LEAF_IDX_KAKAO = 1;

  constructor(
    proofServerUrl: string,
    enUrl: string,
    zkapAddress: string,
    socialServices: string[],
    idTokenGenerators: ((msgHash: string) => Promise<string>)[],
    poseidonMerkleTreeDirectoryAddress: string,
    zkapK: number,
    zkapN: number,
    jwtPks: string[] | undefined // 실제로 key n 값은 각 social service 에서 제공하는 url 에서 kid 에 대한 n 값을 받아야 함. 여기에서는 일단 편의를 위해 넣음. google, kakao 순서로 넣음.
  ) {
    this.socialServices = socialServices;
    this.idTokenGenerators = idTokenGenerators;
    this.proofServerUrl = proofServerUrl;
    this.zkapAddress = zkapAddress;
    this.provider = new ethers.JsonRpcProvider(enUrl);
    this.poseidonMerkleTreeDirectoryAddress =
      poseidonMerkleTreeDirectoryAddress;
    this.selector = [
      ...Array(zkapK).fill(true),
      ...Array(zkapN - zkapK).fill(false),
    ];

    if (socialServices.length !== idTokenGenerators.length) {
      throw new Error("socialServices.length !== idTokenGenerators.length");
    }
    // 추후 각 social service 에서 제공하는 url 에서 kid 에 대한 n 값을 넣는 코드로 변경. 테스트를 위해 생성시 받는 것으로 일단 구현
    {
      if (jwtPks) {
        if (jwtPks.length !== socialServices.length) {
          throw new Error("jwtPks.length !== socialServices.length");
        }
        if (jwtPks.length == 1) {
          this.jwtPks = [...jwtPks, ...jwtPks];
        } else if (jwtPks.length == 2) {
          this.jwtPks = jwtPks;
        } else {
          throw new Error("jwtPks.length is not 1 or 2");
        }
      }
    }
  }

  async init() {
    this.zkapAccount = new ethers.Contract(
      this.zkapAddress,
      zkapAccountJson.abi,
      this.provider
    );
    const masterKeyAddress = await this.zkapAccount.masterKeyList(0);

    this.zkOAuthRS256Verifier = new ethers.Contract(
      masterKeyAddress,
      AccountKeyZkOAuthRS256Verifier3.abi,
      this.provider
    );
    // 스마트 컨트랙트로부터 앵커 가져오기
    {
      const anchor = await this.zkOAuthRS256Verifier.getTag();
      const anchorUint = anchor.map((x: bigint) => x.toString());
      this.anchor = anchorUint;
    }

    this.poseidonMerkleTreeDirectory = new ethers.Contract(
      this.poseidonMerkleTreeDirectoryAddress,
      poseidonMerkleTreeDirectoryJson.abi,
      this.provider
    );

    // 스마트 컨트랙트로부터 머클패스, 루트 가져오기. 및 leafIdxs 설정
    {
      const pathGoogle = await this.poseidonMerkleTreeDirectory.getMerklePath(
        this.LEAF_IDX_GOOGLE
      );
      const pathKakao = await this.poseidonMerkleTreeDirectory.getMerklePath(
        this.LEAF_IDX_KAKAO
      );

      const pathUintGoogle = pathGoogle.map((x: string) =>
        ethers.toBigInt(x).toString()
      );
      const pathUintKakao = pathKakao.map((x: string) =>
        ethers.toBigInt(x).toString()
      );

      let rootHex = await this.poseidonMerkleTreeDirectory.getRoot();
      let rootDecimal = ethers.toBigInt(rootHex).toString();

      this.root = rootDecimal;
      if (this.socialServices.length == 1) {
        this.leafIndices = [this.LEAF_IDX_GOOGLE, this.LEAF_IDX_GOOGLE];
        this.merklePaths = [pathUintGoogle, pathUintGoogle];
      } else if (this.socialServices.length == 2) {
        this.leafIndices = [this.LEAF_IDX_GOOGLE, this.LEAF_IDX_KAKAO];
        this.merklePaths = [pathUintGoogle, pathUintKakao];
      } else {
        throw new Error("socialServices.length is not 1 or 2");
      }
    }

    this.isInitialized = true;
  }

  async signUserOpHash(userOpHash: string): Promise<string[]> {
    if (!this.isInitialized) {
      await this.init();
    }
    const signedUserOpHash = cryptoUtils.getSignedMessageHash(userOpHash);
    const idTokens = await Promise.all(
      this.idTokenGenerators.map((generator) => generator(signedUserOpHash))
    );

    let signatures: string[] = [];
    let proofAndPublicInput: { proof: string[]; publicInputs: string[] };

    // 3. jwt 정보 및 증명에 필요한 정보 생성.
    {
      let tokens = Array();
      if (idTokens.length == 1) {
        tokens.push(...idTokens);
        tokens.push(...idTokens);
      } else if (idTokens.length == 2) {
        tokens.push(...idTokens);
      } else {
        console.error("idTokens.length is not 1 or 2");
        throw new Error("idTokens.length is not 1 or 2");
      }

      const now = Math.floor(Date.now() / 1000);
      const exp = now.toString();
      {
        const response = await fetch(`${this.proofServerUrl}/proof2`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            anchor: this.anchor,
            selector: this.selector,
            jwts: tokens,
            root: this.root,
            leafIndices: this.leafIndices,
            merklePaths: this.merklePaths,
            jwtPks: this.jwtPks,
            exp: exp,
          }),
        });

        proofAndPublicInput = await response.json();
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const encoded = abiCoder.encode(
          ["uint256[8]", "uint256[8]"],
          [proofAndPublicInput.publicInputs, proofAndPublicInput.proof]
        );
        signatures.push(encoded);
      }
    }

    return signatures;
  }
}
