import { ethers } from "ethers";
import { CompositeAccountKeyTypes, KeyInfo } from "../types/AccountKey";
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
  /**
   * Decode and return the first item in a sequence of CBOR-encoded values
   *
   * @param input The CBOR data to decode
   * @param asObject (optional) Whether to convert any CBOR Maps into JavaScript Objects. Defaults to
   * `false`
   */
  decodeCborFirstItem<Type>(input: Uint8Array): Type {
    // Make a copy so we don't mutate the original
    const _input = new Uint8Array(input);
    const decoded = tinyCbor.decodePartialCBOR(_input, 0) as [Type, number];

    const [first] = decoded;

    return first;
  }

  isCOSEKty(kty: number | undefined): kty is COSEKTY {
    return Object.values(COSEKTY).indexOf(kty as COSEKTY) >= 0;
  }

  isCOSEPublicKeyEC2(
    cosePublicKey: COSEPublicKey
  ): cosePublicKey is COSEPublicKeyEC2 {
    const kty = cosePublicKey.get(COSEKEYS.kty);
    return this.isCOSEKty(kty) && kty === COSEKTY.EC2;
  }

  decodeCredentialPublicKey(publicKey: Uint8Array): COSEPublicKey {
    const _decodeCredentialPublicKeyInternals = {
      stubThis: (value: COSEPublicKey) => value,
    };

    return _decodeCredentialPublicKeyInternals.stubThis(
      this.decodeCborFirstItem<COSEPublicKey>(publicKey)
    );
  }

  getEncodedCompositeKey(encodedKeys: string): string {
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
  getEncodedPrimitiveKey(threshold: number, keys: KeyInfo[]): string {
    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let encoded = abiCoder.encode(
      ["uint8", "tuple(uint8,uint8,bytes)[]"],
      [
        threshold,
        keys.map(({ keyType, weight, keyData }) => [keyType, weight, keyData]),
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
    let decodedKeys = decoded[1].map(([keyType, weight, keyData]) => ({
      keyType: keyType,
      weight: weight,
      keyData: keyData,
    }));
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
  getEncodedZkGroth16Key(userSpecificVk: string[]): string {
    if (userSpecificVk.length !== 16) {
      throw new Error("userSpecificVk must be 16 elements");
    }
    // userSpecificVk 16개 들어있는 배열을 4개씩 묶어서 배열로 만들기
    const userSpecificVkArray = [
      userSpecificVk.slice(0, 4),
      userSpecificVk.slice(4, 8),
      userSpecificVk.slice(8, 12),
      userSpecificVk.slice(12, 16),
    ];

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
