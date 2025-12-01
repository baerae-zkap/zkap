import { ethers } from "ethers";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import cryptoUtils from "../utils/crypto";
import zkapAccountJson from "../types/abi/ZkapAccount.json";
import AccountKeyZkOAuthRS256VerifierJson from "../types/abi/AccountKeyZkOAuthRS256Verifier.json";
import poseidonMerkleTreeDirectoryJson from "../types/abi/PoseidonMerkleTreeDirectory.json";
import { JwkKey, JwtHeader } from "../types/jwk";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";

function decodeJwtHeader(token: string): JwtHeader {
  const [headerB64] = token.split(".");
  const headerJson = atob(headerB64);
  return JSON.parse(headerJson);
}

async function getGoogleOAuthPublicKey(kid: string): Promise<string> {
  try {
    const url = "https://www.googleapis.com/oauth2/v3/certs";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const keys: JwkKey[] = data.keys;

    // keys 에서 kid 에 대한 공개키 찾기
    const key = keys.find((key) => key.kid === kid);
    if (!key) {
      throw new Error("Public key not found");
    }
    return key.n;
  } catch (error) {
    console.error("Error fetching Google public keys:", error);
    throw error;
  }
}

async function getKakaoOAuthPublicKey(kid: string): Promise<string> {
  try {
    // kakao 는 curl --location --request GET "https://kauth.kakao.com/.well-known/jwks.json"  형태로 json 파일을 받아와서 사용
    const url = "https://kauth.kakao.com/.well-known/jwks.json";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const keys: JwkKey[] = data.keys;

    // keys 에서 kid 에 대한 공개키 찾기
    const key = keys.find((key) => key.kid === kid);
    if (!key) {
      throw new Error("Public key not found");
    }
    return key.n;
  } catch (error) {
    console.error("Error fetching Kakao public keys:", error);
    throw error;
  }
}

// TODO: @kaikookim naming 변경, simulator 기반으로 테스트를 위해 만들어 진 내용이고 추후 각 social login 에 맞게 수정 필요.
export class ZkPasskeySigner implements IUserOpSigner {
  public keyTypes: number[] = [PrimitiveAccountKeyTypes.keyZkOAuthRS256];
  private proofServerUrl: string;
  private zkapAddress: string;
  private provider: ethers.JsonRpcProvider;
  private zkapAccount: ethers.Contract | undefined;
  private zkOAuthRS256Verifier: ethers.Contract | undefined;
  private isInitialized: boolean = false;
  private anchor: string[] | undefined;
  private poseidonMerkleTreeDirectory: ethers.Contract | undefined;
  private poseidonMerkleTreeDirectoryAddress: string;
  private socialServices: string[];
  private idTokenGenerators: ((msgHash: string) => Promise<string>)[];
  private selector: boolean[] | undefined;
  private idTokens: string[] | undefined;

  constructor(
    proofServerUrl: string,
    enUrl: string,
    zkapAddress: string,
    socialServices: string[],
    idTokenGenerators: ((msgHash: string) => Promise<string>)[],
    poseidonMerkleTreeDirectoryAddress: string,
    zkapK: number,
    zkapN: number
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

    // idTokens : string[] = socialServices.length 만큼 초기화
    this.idTokens = Array(socialServices.length).fill("");
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
      AccountKeyZkOAuthRS256VerifierJson.abi,
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

    this.isInitialized = true;
  }

  async getSignatures(
    idTokens: string[],
    jwtPks: string[],
    leafIndices: number[],
    merklePaths: string[][]
  ): Promise<string[]> {
    if (!this.poseidonMerkleTreeDirectory) {
      throw new Error("poseidonMerkleTreeDirectory is not initialized");
    }

    const rootHex = await this.poseidonMerkleTreeDirectory.getRoot();
    const root = ethers.toBigInt(rootHex).toString();

    let adjustedIdTokens: string[] = [];
    let adjustedPublicKeys: string[] = [];
    let adjustedLeafIndices: number[] = [];
    let adjustedMerklePaths: string[][] = [];
    let signatures: string[] = [];
    let proofAndPublicInput: { proof: string[]; publicInputs: string[] };

    if (idTokens!.length == 1) {
      adjustedIdTokens = [idTokens[0], idTokens[0], idTokens[0]];
      adjustedPublicKeys = [jwtPks[0], jwtPks[0], jwtPks[0]];
      adjustedLeafIndices = [leafIndices[0], leafIndices[0], leafIndices[0]];
      adjustedMerklePaths = [merklePaths[0], merklePaths[0], merklePaths[0]];
    } else if (idTokens!.length == 2) {
      adjustedIdTokens = [idTokens[0], idTokens[0], idTokens[1]];
      adjustedPublicKeys = [jwtPks[0], jwtPks[0], jwtPks[1]];
      adjustedLeafIndices = [leafIndices[0], leafIndices[0], leafIndices[1]];
      adjustedMerklePaths = [merklePaths[0], merklePaths[0], merklePaths[1]];
    } else if (idTokens!.length == 3) {
      adjustedIdTokens = [...idTokens];
      adjustedPublicKeys = [...jwtPks];
      adjustedLeafIndices = [...leafIndices];
      adjustedMerklePaths = [...merklePaths];
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
          jwts: adjustedIdTokens,
          root: root,
          leafIndices: adjustedLeafIndices,
          merklePaths: adjustedMerklePaths,
          jwtPks: adjustedPublicKeys,
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
    return signatures;
  }

  async prepareIdToken(userOpHash: string, index: number): Promise<string[]> {
    if (!(index < this.idTokens!.length))
      throw new Error("index is out of range");
    if (!this.isInitialized) {
      await this.init();
    }
    const signedUserOpHash = cryptoUtils.getSignedMessageHash(userOpHash);
    if (!this.idTokenGenerators[index])
      throw new Error("idTokenGenerator undefined");
    const idToken = await this.idTokenGenerators[index](signedUserOpHash);
    if (!idToken) throw new Error("idToken is undefined");

    this.idTokens![index] = idToken;
    return this.idTokens!;
  }

  async signUserOpHash(userOpHash?: string): Promise<string[]> {
    // this.idTokens 가 모두 초기화 되어 있는지 확인
    if (!this.idTokens) throw new Error("idTokens is undefined");
    for (const idToken of this.idTokens) {
      if (idToken === "") throw new Error("idToken is not initialized");
    }

    const kids = this.idTokens.map((idToken) => {
      const header = decodeJwtHeader(idToken);
      return header.kid;
    });

    const jwtPks = await Promise.all(
      this.socialServices.map(async (service, index) => {
        if (service === "google") {
          return await getGoogleOAuthPublicKey(kids[index]);
        } else if (service === "kakao") {
          return await getKakaoOAuthPublicKey(kids[index]);
        } else {
          throw new Error("Invalid service");
        }
      })
    );

    const results = await Promise.all(
      jwtPks.map(async (jwtPk) => {
        const jwtHash = ethers.toBeHex(
          ethers.sha256(ethers.toUtf8Bytes(jwtPk)),
          32
        );
        const leafIndex =
          await this.poseidonMerkleTreeDirectory!.getLeafIndexByPubkeyHash(
            jwtHash
          );
        const path = await this.poseidonMerkleTreeDirectory!.getMerklePath(
          leafIndex
        );

        const pathUint = path.map((x: string) => ethers.toBigInt(x).toString());

        return { leafIndex: parseInt(leafIndex), pathUint };
      })
    );

    const leafIndices = results.map((r) => r.leafIndex as number);
    const merklePaths = results.map((r) => r.pathUint);

    return this.getSignatures(this.idTokens!, jwtPks, leafIndices, merklePaths);
  }
}
