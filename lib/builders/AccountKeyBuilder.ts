import { ethers } from "ethers";
import {
  CompositeAccountKeyTypes,
  KeyInfo,
  KeyData,
  AddressKeyData,
  WebAuthnKeyData,
  OAuthRS256KeyData,
  ZkOAuthRS256KeyData,
  PrimitiveAccountKeyTypes,
  AddressKeyInfo,
  Secp256k1KeyInfo,
  Secp256r1KeyInfo,
  WebAuthnKeyInfo,
  OAuthRS256KeyInfo,
  ZkOAuthRS256KeyInfo,
} from "../types/AccountKey";
import crypto from "../utils/crypto";
/* Copied from @simplewebauthn/server/src/helpers/iso/isoCBOR.ts */
import * as tinyCbor from "@levischuck/tiny-cbor";

enum COSEKEYS {
  kty = 1,
  alg = 3,
  crv = -1,
  x = -2,
  y = -3,
  n = -1,
  e = -2,
}

enum COSEKTY {
  OKP = 1,
  EC2 = 2,
  RSA = 3,
}

enum COSEALG {
  ES256 = -7,
  EdDSA = -8,
  ES384 = -35,
  ES512 = -36,
  PS256 = -37,
  PS384 = -38,
  PS512 = -39,
  ES256K = -47,
  RS256 = -257,
  RS384 = -258,
  RS512 = -259,
  RS1 = -65535,
}

type COSEPublicKey = {
  // Getters
  get(key: COSEKEYS.kty): COSEKTY | undefined;
  get(key: COSEKEYS.alg): COSEALG | undefined;
  // Setters
  set(key: COSEKEYS.kty, value: COSEKTY): void;
  set(key: COSEKEYS.alg, value: COSEALG): void;
};

type COSEPublicKeyEC2 = COSEPublicKey & {
  // Getters
  get(key: COSEKEYS.crv): number | undefined;
  get(key: COSEKEYS.x): Uint8Array | undefined;
  get(key: COSEKEYS.y): Uint8Array | undefined;
  // Setters
  set(key: COSEKEYS.crv, value: number): void;
  set(key: COSEKEYS.x, value: Uint8Array): void;
  set(key: COSEKEYS.y, value: Uint8Array): void;
};

export class AccountKeyBuilder {
  private threshold: number;
  private keys: KeyInfo[];
  private encodedPrimitiveKeys: string;
  private encodedCompositeKey: string;

  constructor(threshold?: number, keys?: KeyInfo[]) {
    if (threshold === undefined || keys === undefined) {
      // do nothing
      this.threshold = 0;
      this.keys = [];
      this.encodedPrimitiveKeys = "";
      this.encodedCompositeKey = "";
    } else {
      // key 값 셋팅
      this.threshold = threshold;
      this.keys = keys;
      this.checkThreshold();
      // 각 key 에 대한 encodedPrimitiveKey 를 생성
      this.encodedPrimitiveKeys = this.setPrimitiveKey(
        this.threshold,
        this.keys
      );
      this.encodedCompositeKey = this.setCompositeKey(
        this.encodedPrimitiveKeys
      );
    }
  }

  getEncodedCompositeKey(): string {
    return this.encodedCompositeKey;
  }

  getEncodedPrimitiveKey(): string {
    return this.encodedPrimitiveKeys;
  }

  checkThreshold(): boolean {
    let weightSum = 0;
    for (const key of this.keys) {
      weightSum += key.weight;
    }
    if (weightSum < this.threshold) {
      throw new Error("Threshold is greater than the sum of weights");
    }
    return true;
  }

  /**
   * Decode and return the first item in a sequence of CBOR-encoded values
   *
   * @param input The CBOR data to decode
   * @param asObject (optional) Whether to convert any CBOR Maps into JavaScript Objects. Defaults to
   * `false`
   */
  private decodeCborFirstItem<Type>(input: Uint8Array): Type {
    // Make a copy so we don't mutate the original
    const _input = new Uint8Array(input);
    const decoded = tinyCbor.decodePartialCBOR(_input, 0) as [Type, number];

    const [first] = decoded;

    return first;
  }

  private isCOSEKty(kty: number | undefined): kty is COSEKTY {
    return Object.values(COSEKTY).indexOf(kty as COSEKTY) >= 0;
  }

  private isCOSEPublicKeyEC2(
    cosePublicKey: COSEPublicKey
  ): cosePublicKey is COSEPublicKeyEC2 {
    const kty = cosePublicKey.get(COSEKEYS.kty);
    return this.isCOSEKty(kty) && kty === COSEKTY.EC2;
  }

  private decodeCredentialPublicKey(publicKey: Uint8Array): COSEPublicKey {
    const _decodeCredentialPublicKeyInternals = {
      stubThis: (value: COSEPublicKey) => value,
    };

    return _decodeCredentialPublicKeyInternals.stubThis(
      this.decodeCborFirstItem<COSEPublicKey>(publicKey)
    );
  }

  setCompositeKey(encodedKeys: string): string {
    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let encoded = abiCoder.encode(
      ["tuple(uint8,bytes)"],
      [[CompositeAccountKeyTypes.keyMultisig, encodedKeys]]
    );
    return encoded;
  }

  getDecodedCompositeKey(encoded: string): [number, string] {
    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let decoded = abiCoder.decode(["tuple(uint8,bytes)"], encoded);

    let decodedKeyType = decoded[0][0];
    let decodedEncodedKeys = decoded[0][1];
    return [decodedKeyType, decodedEncodedKeys];
  }

  setAddressKey(threshold: number, keyInfoList: AddressKeyInfo[]): string {
    // key 값 셋팅
    this.threshold = threshold;
    this.keys = keyInfoList.map((keyInfo) => ({
      keyType: PrimitiveAccountKeyTypes.keyAddress,
      weight: keyInfo.weight,
      keyData: { signerAddress: keyInfo.signerAddress },
    }));
    this.checkThreshold();
    // 각 key 에 대한 encodedPrimitiveKey 를 생성
    this.encodedPrimitiveKeys = this.setPrimitiveKey(this.threshold, this.keys);
    this.encodedCompositeKey = this.setCompositeKey(this.encodedPrimitiveKeys);
    return this.encodedCompositeKey;
  }

  setSecp256k1Key(threshold: number, keyInfoList: Secp256k1KeyInfo[]): string {
    // key 값 셋팅
    this.threshold = threshold;
    this.keys = keyInfoList.map((keyInfo) => ({
      keyType: PrimitiveAccountKeyTypes.keySecp256k1,
      weight: keyInfo.weight,
      keyData: { pubkey: keyInfo.pubkey },
    }));
    this.checkThreshold();
    // 각 key 에 대한 encodedPrimitiveKey 를 생성
    this.encodedPrimitiveKeys = this.setPrimitiveKey(this.threshold, this.keys);
    this.encodedCompositeKey = this.setCompositeKey(this.encodedPrimitiveKeys);
    return this.encodedCompositeKey;
  }

  setSecp256r1Key(threshold: number, keyInfoList: Secp256r1KeyInfo[]): string {
    // key 값 셋팅
    this.threshold = threshold;
    this.keys = keyInfoList.map((keyInfo) => ({
      keyType: PrimitiveAccountKeyTypes.keySecp256r1,
      weight: keyInfo.weight,
      keyData: { pubkey: keyInfo.pubkey },
    }));
    this.checkThreshold();
    // 각 key 에 대한 encodedPrimitiveKey 를 생성
    this.encodedPrimitiveKeys = this.setPrimitiveKey(this.threshold, this.keys);
    this.encodedCompositeKey = this.setCompositeKey(this.encodedPrimitiveKeys);
    return this.encodedCompositeKey;
  }

  setWebAuthnKey(threshold: number, keyInfoList: WebAuthnKeyInfo[]): string {
    // key 값 셋팅
    this.threshold = threshold;
    this.keys = keyInfoList.map((keyInfo) => ({
      keyType: PrimitiveAccountKeyTypes.keyWebAuthn,
      weight: keyInfo.weight,
      keyData: {
        credentialPubkey: keyInfo.credentialPubkey,
        credentialId: keyInfo.credentialId,
        rpIdHash: keyInfo.rpIdHash,
        origin: keyInfo.origin,
      },
    }));
    this.checkThreshold();
    // 각 key 에 대한 encodedPrimitiveKey 를 생성
    this.encodedPrimitiveKeys = this.setPrimitiveKey(this.threshold, this.keys);
    this.encodedCompositeKey = this.setCompositeKey(this.encodedPrimitiveKeys);
    return this.encodedCompositeKey;
  }

  setOAuthRS256Key(
    threshold: number,
    keyInfoList: OAuthRS256KeyInfo[]
  ): string {
    // key 값 셋팅
    this.threshold = threshold;
    this.keys = keyInfoList.map((keyInfo) => ({
      keyType: PrimitiveAccountKeyTypes.keyOAuthRS256,
      weight: keyInfo.weight,
      keyData: {
        iss: keyInfo.iss,
        kid: keyInfo.kid,
        sub: keyInfo.sub,
        email: keyInfo.email,
        verifyEmail: keyInfo.verifyEmail,
        verifySub: keyInfo.verifySub,
      },
    }));
    this.checkThreshold();
    // 각 key 에 대한 encodedPrimitiveKey 를 생성
    this.encodedPrimitiveKeys = this.setPrimitiveKey(this.threshold, this.keys);
    this.encodedCompositeKey = this.setCompositeKey(this.encodedPrimitiveKeys);
    return this.encodedCompositeKey;
  }

  setZkOAuthRS256Key(
    threshold: number,
    keyInfoList: ZkOAuthRS256KeyInfo[]
  ): string {
    // key 값 셋팅
    this.threshold = threshold;
    this.keys = keyInfoList.map((keyInfo) => ({
      keyType: PrimitiveAccountKeyTypes.keyZkOAuthRS256,
      weight: keyInfo.weight,
      keyData: { userSpecificVk: keyInfo.userSpecificVk },
    }));
    this.checkThreshold();
    // 각 key 에 대한 encodedPrimitiveKey 를 생성
    this.encodedPrimitiveKeys = this.setPrimitiveKey(this.threshold, this.keys);
    this.encodedCompositeKey = this.setCompositeKey(this.encodedPrimitiveKeys);
    return this.encodedCompositeKey;
  }

  setPrimitiveKey(threshold: number, keys: KeyInfo[]): string {
    this.threshold = threshold;
    this.keys = keys;
    this.checkThreshold();

    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let encoded = abiCoder.encode(
      ["uint8", "tuple(uint8,uint8,bytes)[]"],
      [
        threshold,
        keys.map(({ keyType, weight, keyData }) => {
          let encodedKeyData: string;
          switch (keyType) {
            case PrimitiveAccountKeyTypes.keyAddress:
              encodedKeyData = this.getEncodedAddressKey(
                (keyData as AddressKeyData).signerAddress
              );
              break;
            case PrimitiveAccountKeyTypes.keyWebAuthn:
              const webAuthnData = keyData as WebAuthnKeyData;
              encodedKeyData = this.getEncodedWebAuthnKey(
                webAuthnData.credentialPubkey,
                webAuthnData.credentialId,
                webAuthnData.rpIdHash,
                webAuthnData.origin
              );
              break;
            case PrimitiveAccountKeyTypes.keyOAuthRS256:
              const oauthData = keyData as OAuthRS256KeyData;
              encodedKeyData = this.getEncodedOAuthKey(
                oauthData.iss,
                oauthData.kid,
                oauthData.sub,
                oauthData.email,
                oauthData.verifyEmail,
                oauthData.verifySub
              );
              break;
            case PrimitiveAccountKeyTypes.keyZkOAuthRS256:
              encodedKeyData = this.getEncodedZkOAuthRS256Key(
                (keyData as ZkOAuthRS256KeyData).userSpecificVk
              );
              break;
            default:
              throw new Error(`Unsupported key type: ${keyType}`);
          }
          return [keyType, weight, encodedKeyData];
        }),
      ]
    );
    return encoded;
  }

  getDecodedPrimitiveKey(encoded: string): [number, KeyInfo[]] {
    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let decoded = abiCoder.decode(
      ["uint8", "tuple(uint8,uint8,bytes)[]"],
      encoded
    );
    let decodedThreshold = decoded[0];
    let decodedKeys = decoded[1].map(
      ([keyType, weight, keyData]: [number, number, string]) => {
        let decodedKeyData: KeyData;
        switch (Number(keyType)) {
          case PrimitiveAccountKeyTypes.keyAddress:
            decodedKeyData = { signerAddress: keyData };
            break;
          case PrimitiveAccountKeyTypes.keyWebAuthn:
            const [pubkey, id, rpId, origin] = abiCoder.decode(
              ["tuple(uint256,uint256,string)", "bytes32", "bytes"],
              keyData
            );
            decodedKeyData = {
              credentialPubkey: pubkey.toString(),
              credentialId: id.toString(),
              rpIdHash: rpId.toString(),
              origin: origin.toString(),
            };
            break;
          case PrimitiveAccountKeyTypes.keyOAuthRS256:
            const [iss, sub, email, verifyEmail, verifySub] = abiCoder.decode(
              ["tuple(bytes,bytes,bytes,bool,bool)"],
              keyData
            );
            decodedKeyData = {
              iss: iss.toString(),
              kid: "",
              sub: sub.toString(),
              email: email.toString(),
              verifyEmail,
              verifySub,
            };
            break;
          case PrimitiveAccountKeyTypes.keyZkOAuthRS256:
            const [decodedKey] = abiCoder.decode(
              [
                "tuple((uint256,uint256,uint256,uint256) g2mu, (uint256,uint256,uint256,uint256) g2muX, (uint256,uint256,uint256,uint256) g2muZ, (uint256,uint256,uint256,uint256) vacc)",
              ],
              keyData
            );
            const vkArray = crypto.userSpecificVkToStringArray(decodedKey);
            decodedKeyData = {
              userSpecificVk: vkArray,
            };

            break;
          default:
            throw new Error(`Unsupported key type: ${keyType}`);
        }
        return {
          keyType,
          weight,
          keyData: decodedKeyData,
        };
      }
    );
    return [decodedThreshold, decodedKeys];
  }

  getEncodedAddressKey(signerAddress: string): string {
    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let encoded = abiCoder.encode(["address"], [signerAddress]);
    return encoded;
  }

  getEncodedWebAuthnKey(
    credentialPubkey: string,
    credentialId: string,
    rpIdHash: string,
    origin: string
  ): string {
    let pubkey = this.decodeCredentialPublicKey(
      ethers.getBytes(credentialPubkey)
    );
    if (!this.isCOSEPublicKeyEC2(pubkey)) {
      throw new Error("Not EC2");
    }
    let x = (pubkey as COSEPublicKeyEC2).get(COSEKEYS.x) as Uint8Array;
    let y = (pubkey as COSEPublicKeyEC2).get(COSEKEYS.y) as Uint8Array;
    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let encoded = abiCoder.encode(
      ["tuple(uint256,uint256,string)", "bytes32", "bytes"],
      [
        [
          ethers.hexlify(ethers.getBytes(x)),
          ethers.hexlify(ethers.getBytes(y)),
          credentialId,
        ],
        ethers.hexlify(ethers.getBytes(rpIdHash)),
        ethers.hexlify(ethers.toUtf8Bytes(origin)),
      ]
    );

    return encoded;
  }

  getEncodedOAuthKey(
    iss: string,
    kid: string,
    sub: string,
    email: string,
    verifyEmail: boolean,
    verifySub: boolean
  ): string {
    let key = {
      issuer: ethers.hexlify(ethers.toUtf8Bytes(iss)),
      subToVerify: ethers.hexlify(ethers.toUtf8Bytes(sub)),
      emailToVerify: ethers.hexlify(ethers.toUtf8Bytes(email)),
      verifyEmail,
      verifySub,
    };

    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let encoded = abiCoder.encode(
      ["tuple(bytes,bytes,bytes,bool,bool)"],
      [
        [
          key.issuer,
          key.subToVerify,
          key.emailToVerify,
          key.verifyEmail,
          key.verifySub,
        ],
      ]
    );
    return encoded;
  }

  getEncodedSecp256k1Key(pubkey: string): string {
    let x = ethers.hexlify(ethers.getBytes(pubkey).slice(1, 33));
    let y = ethers.hexlify(ethers.getBytes(pubkey).slice(33, 65));

    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let encoded = abiCoder.encode(["uint256", "uint256"], [x, y]);
    return encoded;
  }

  getEncodedSecp256r1Key(pubkey: string): string {
    let x = ethers.hexlify(ethers.getBytes(pubkey).slice(1, 33));
    let y = ethers.hexlify(ethers.getBytes(pubkey).slice(33, 65));

    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let encoded = abiCoder.encode(["uint256", "uint256"], [x, y]);
    return encoded;
  }

  getEncodedZkOAuthRS256Key(userSpecificVk: string[]): string {
    if (userSpecificVk.length !== 16) {
      throw new Error("userSpecificVk must be 16 elements");
    }

    const userSpecificVkArray = crypto.userSpecificVkParser(userSpecificVk);

    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let encoded = abiCoder.encode(
      [
        "tuple((uint256,uint256,uint256,uint256) g2mu, (uint256,uint256,uint256,uint256) g2muX, (uint256,uint256,uint256,uint256) g2muZ, (uint256,uint256,uint256,uint256) vacc)",
      ],
      [userSpecificVkArray]
    );
    return encoded;
  }
}
