import { ethers } from "ethers";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import cryptoUtils from "../utils/crypto";
import zkapAccountJson from "../types/abi/ZkapAccount.json";
import AccountKeyZkOAuthRS256Verifier3 from "../types/abi/AccountKeyZkOAuthRS256Verifier3.json";
import poseidonMerkleTreeDirectoryJson from "../types/abi/PoseidonMerkleTreeDirectory.json";
import { JwkKey, JwtHeader } from "../types/jwk";

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
      // for test
      console.log("Google public key not found for kid: ", kid);
      console.log("Using test public key");
      return "vLzd_VDnr8zt9pHfSkO3G0pUlaGJbYkIXXhma9-R9oETx2u0eZ-bSblq71FlA-PWLdjOW1SYtOngVZT5ZxJQ8FRFQolE8YzgByHifgo16ogEmeKdCIlCLd48IETTMOo093BLa2BzDygm8xBcpV_yqlxTUHdw2RH4vf5uulzbHcbdTf94I_DMlNUQX_yTmB8mu3GmDT-1xpL90iVEybjNWEcIrhWGHYqEFkKeBU1hvPf038Lts07eKiBKZWjo7-ZESCPNmdPvVkx29GuIBlwXp3824TB0DR0nhhFncXDuVzxDAUFSrnM0JwPa4ZX4M_xHdtUuk4Bp46wj_kb44jO4yw";
      // throw new Error("Public key not found");
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
  private socialServices: string[];
  private idTokenGenerators: ((msgHash: string) => Promise<string>)[];
  private selector: boolean[] | undefined;

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

    const kids = idTokens.map((idToken) => {
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

    if (!this.poseidonMerkleTreeDirectory) {
      throw new Error("poseidonMerkleTreeDirectory is not initialized");
    }
    const rootHex = await this.poseidonMerkleTreeDirectory.getRoot();
    this.root = ethers.toBigInt(rootHex).toString();

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

    this.leafIndices = results.map((r) => r.leafIndex as number);
    this.merklePaths = results.map((r) => r.pathUint);

    if (this.leafIndices && this.merklePaths && this.leafIndices.length == 1) {
      this.leafIndices = [this.leafIndices[0], this.leafIndices[0]];
      this.merklePaths = [this.merklePaths[0], this.merklePaths[0]];
    } else {
      console.log("leafIndices: ", this.leafIndices);
      console.log("merklePaths: ", this.merklePaths);
      throw new Error("leafIndices or merklePaths is not set");
    }

    {
      // TODO: @kaikookim idTokens 설정을 K 값에 맞게 할당 하도록 변경
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
      let adjustedJwtPks = Array();
      if (jwtPks.length == 1) {
        adjustedJwtPks.push(...jwtPks);
        adjustedJwtPks.push(...jwtPks);
      } else if (jwtPks.length == 2) {
        adjustedJwtPks.push(...jwtPks);
      } else {
        throw new Error("jwtPks.length is not 1 or 2");
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
            jwtPks: adjustedJwtPks,
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
