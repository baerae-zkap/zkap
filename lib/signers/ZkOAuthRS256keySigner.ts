import { ethers } from "ethers";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { decodeJwtHeader, decodeJwtPayload } from "../utils/google";
import cryptoUtils from "../utils/crypto";
import zkapAccountJson from "../types/abi/ZkapAccount.json";
import accountKeyMultisigJson from "../types/abi/AccountKeyMultisig.json";
import zkOAuthRS256VerifierJson from "../types/abi/ZksnarkVerifier.json";
import * as googleOAuth from "../utils/google";
import { JwkKey } from "../types/jwk";

export class ZkOAuthRS256KeySigner implements IUserOpSigner {
  private idTokenGenerators: ((msgHash: string) => Promise<string>)[];
  private proofServerUrl: string;
  private zkapAddress: string;
  private provider: ethers.JsonRpcProvider;
  private zkapAccount: ethers.Contract | undefined;
  private accountKeyMultisig: ethers.Contract | undefined;
  private numOfKeys: number | undefined;
  private primitiveKeyInfo: [string, number, string[]][] | undefined;
  private isInitialized: boolean = false;

  constructor(
    proofServerUrl: string,
    enUrl: string,
    zkapAddress: string,
    idTokenGenerators: ((msgHash: string) => Promise<string>)[]
  ) {
    this.idTokenGenerators = idTokenGenerators;
    this.proofServerUrl = proofServerUrl;
    this.zkapAddress = zkapAddress;
    this.provider = new ethers.JsonRpcProvider(enUrl);
  }

  async init() {
    this.zkapAccount = new ethers.Contract(
      this.zkapAddress,
      zkapAccountJson.abi,
      this.provider
    );
    const masterKeyAddress = await this.zkapAccount.masterKey();
    this.accountKeyMultisig = new ethers.Contract(
      masterKeyAddress,
      accountKeyMultisigJson.abi,
      this.provider
    );
    const keyLength = await this.accountKeyMultisig.getKeyLength();
    const keys: [string, number, string[]][] = [];

    for (let i = 0; i < keyLength; i++) {
      const key = await this.accountKeyMultisig.getKey(i);
      const zkOAuthRS256Verifier = new ethers.Contract(
        key[0],
        zkOAuthRS256VerifierJson.abi,
        this.provider
      );
      const userVk = await zkOAuthRS256Verifier.getUserVk();
      const userVkArray = cryptoUtils.userSpecificVkToStringArray(userVk);
      keys.push([key[0], key[1], userVkArray]);
    }
    this.numOfKeys = Number(keyLength);
    this.primitiveKeyInfo = keys;

    // key length 와 idTokenGenerators 의 길이가 같은지 확인
    if (this.numOfKeys !== this.idTokenGenerators.length) {
      throw new Error(
        "key length 와 idTokenGenerators 의 길이가 같지 않습니다."
      );
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

    const signatures: string[] = [];
    for (let i = 0; i < this.numOfKeys!; i++) {
      const userVk = this.primitiveKeyInfo![i][2];
      const { proofArray, currentTime } = await this.getProof(
        idTokens[i],
        userVk
      );
      const signature = this.makeSignature(
        idTokens[i],
        proofArray,
        currentTime
      );
      signatures.push(signature);
    }

    return signatures;
  }

  private makeSignature(
    idToken: string,
    proofArray: BigInt[],
    currentTime: string
  ): string {
    const header = decodeJwtHeader(idToken);
    const payload = decodeJwtPayload(idToken);

    const bytesKid = ethers.hexlify(ethers.toUtf8Bytes(header.kid));
    const bytesIss = ethers.hexlify(ethers.toUtf8Bytes(payload.iss));

    // state 값 구하기
    const keys = ["email", "sub", "nonce", "exp"];
    const outOfCircuitHashSegment = cryptoUtils.getOutOfCircuitHashSegment(
      idToken,
      keys
    );
    const state = cryptoUtils.sha256Update(
      cryptoUtils.Utf8ToUint8Array(outOfCircuitHashSegment)
    );
    const stateArray = state.map((num: number) => num.toString());

    // inputs: [state(8), currentTime(1)]
    let inputs = [...stateArray, currentTime];

    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = abiCoder.encode(
      ["bytes", "bytes", "string[]", "uint256[]"],
      [bytesKid, bytesIss, inputs, proofArray]
    );

    return encoded;
  }

  private async getProof(
    idToken: string,
    userVk: string[]
  ): Promise<{ proofArray: BigInt[]; currentTime: string }> {
    try {
      console.log(
        "ZkOAuthRS256Signer >> getProof:: It takes about 30 seconds. Please wait..."
      );
      const header = decodeJwtHeader(idToken);
      let publicKey: JwkKey | null = null;

      if (!publicKey) {
        // TODO : 구글 서버에서 공개키 (n값) 받아오는 함수 구현
        publicKey = await googleOAuth.GetGoogleOAuthPublicKeyByKid(header.kid);
      }
      if (!publicKey) {
        // TODO : APPLE OAUTH 공개키 받아오는 함수 구현
      }
      if (!publicKey) {
        // TODO : Kakao OAUTH 공개키 받아오는 함수 구현
      }
      if (!publicKey) {
        // Test 용 public key
        publicKey = {
          e: "AQAB",
          n: process.env.TEST_PUBLIC_KEY_MODULUS!,
          alg: "RS256",
          kid: "test",
          kty: "RSA",
          use: "sig",
        };
      }
      if (!publicKey) {
        throw new Error("공개키를 찾을 수 없습니다.");
      }

      const response = await fetch(`${this.proofServerUrl}/proof`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jwt: idToken,
          userVk: userVk, // TODO : sdk zkapBuilder -> 온체인에서 key 값 받아오는 함수 구현
          publicKey: { e: publicKey.e, n: publicKey.n },
        }),
      });
      if (!response.ok) {
        throw new Error("Proof 요청 오류");
      }

      const data = await response.json();
      const currentTime = data.currentTime.toString();
      const proof = data.proof;
      const proofArray = proof.map((item: string) => item.toString());
      return { proofArray, currentTime };
    } catch (error) {
      console.error("Proof 요청 오류:", error);
      throw error;
    }
  }
}
