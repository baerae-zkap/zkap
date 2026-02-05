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
  private encodedKey: string;

  constructor(threshold?: number, keys?: KeyInfo[]) {
    if (threshold === undefined || keys === undefined) {
      // do nothing
      this.threshold = 0;
      this.keys = [];
      this.encodedKey = "";
    } else {
      // key 값 셋팅
      this.threshold = threshold;
      this.keys = keys;
      this.checkThreshold();

      this.encodedKey = this.setEncodedKeyData(this.threshold, this.keys);
    }
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

  encodeCall(
    contractInterface: ethers.Interface,
    functionName: string,
    args: any[]
  ): string {
    // 함수 시그니처와 인자를 인코딩
    return contractInterface.encodeFunctionData(functionName, args);
  }

  // decodeZkOAuthRS256KeyInitData(encodedData: string): {
  //   n: number;
  //   k: number;
  //   commitment: string[];
  //   poseidonMerkleTreeDirectory: string;
  // } {
  //   const AccountKeyZkOAuthRS256VerifierABI = [
  //     "function initialize(bytes encoded, address _poseidonMerkleTreeDirectory) external",
  //   ];

  //   const contractInterface = new ethers.Interface(
  //     AccountKeyZkOAuthRS256VerifierABI
  //   );

  //   // encodedData 디코딩
  //   const decodedData = contractInterface.parseTransaction({
  //     data: encodedData,
  //   });

  //   if (!decodedData) {
  //     throw new Error("Failed to decode transaction data");
  //   }

  //   // args에서 파라미터 추출
  //   const [encoded, poseidonMerkleTreeDirectory] = decodedData.args;

  //   const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  //   const [n, k, commitment] = abiCoder.decode(
  //     ["uint256", "uint256", "uint256[]"],
  //     encoded
  //   );

  //   return {
  //     n,
  //     k,
  //     commitment,
  //     poseidonMerkleTreeDirectory,
  //   };
  // }

  // decodeAddressKeyInitData(encodedData: string): {
  //   signerAddress: string;
  // } {
  //   const AccountKeyAddressABI = [
  //     "function initialize(address signer) external",
  //   ];

  //   const contractInterface = new ethers.Interface(AccountKeyAddressABI);

  //   const decodedData = contractInterface.parseTransaction({
  //     data: encodedData,
  //   });

  //   if (!decodedData) {
  //     throw new Error("Failed to decode transaction data");
  //   }

  //   const [signerAddress] = decodedData.args;

  //   return {
  //     signerAddress,
  //   };
  // }

  // decodeWebAuthnKeyInitData(encodedData: string): {
  //   x: string;
  //   y: string;
  //   credentialId: string;
  //   rpIdHash: string;
  //   origin: string;
  // } {
  //   const AccountKeyWebAuthnABI = [
  //     "function initialize(bytes encoded, bytes32 rpIdHash, bytes memory origin) external",
  //   ];

  //   const contractInterface = new ethers.Interface(AccountKeyWebAuthnABI);

  //   const decodedData = contractInterface.parseTransaction({
  //     data: encodedData,
  //   });

  //   if (!decodedData) {
  //     throw new Error("Failed to decode transaction data");
  //   }

  //   const [encoded, rpIdHash, origin] = decodedData.args;

  //   const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  //   const [x, y, credentialId] = abiCoder.decode(
  //     ["tuple(uint256,uint256,string)", "bytes32", "bytes"],
  //     encoded
  //   );

  //   return {
  //     x,
  //     y,
  //     credentialId,
  //     rpIdHash,
  //     origin,
  //   };
  // }

  getDecodedKeyTypes(encoded: string): number[] {
    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const [threshold, logicList, initDataList, weightList] = abiCoder.decode(
      ["uint8", "address[]", "bytes[]", "uint8[]"],
      encoded
    );

    const SELECTORS = {
      keyAddress: "0xc4d66de8",
      keyWebAuthn: "0x5fca9cbd",
      keyZkOAuthRS256: "0x660b88ee",
    };

    const keyTypes: number[] = [];

    for (let i = 0; i < initDataList.length; i++) {
      const selector = initDataList[i].slice(0, 10);
      if (selector === SELECTORS.keyAddress) {
        keyTypes.push(PrimitiveAccountKeyTypes.keyAddress);
      } else if (selector === SELECTORS.keyWebAuthn) {
        keyTypes.push(PrimitiveAccountKeyTypes.keyWebAuthn);
      } else if (selector === SELECTORS.keyZkOAuthRS256) {
        keyTypes.push(PrimitiveAccountKeyTypes.keyZkOAuthRS256);
      } else {
        throw new Error(`Unsupported key type: ${selector}`);
      }
    }
    return keyTypes;
  }

  // getDecodedKeyData(encoded: string): [number, KeyInfo[]] {
  //   let abiCoder = ethers.AbiCoder.defaultAbiCoder();
  //   const [threshold, logicList, initDataList, weightList] = abiCoder.decode(
  //     ["uint8", "address[]", "bytes[]", "uint8[]"],
  //     encoded
  //   );

  //   const SELECTORS = {
  //     keyAddress: "0xc4d66de8",
  //     keyWebAuthn: "0x5fca9cbd",
  //     keyZkOAuthRS256: "0x660b88ee",
  //   };

  //   const keyInfoList: KeyInfo[] = [];

  //   for (let i = 0; i < logicList.length; i++) {
  //     const selector = initDataList[i].slice(0, 10);
  //     if (selector === SELECTORS.keyAddress) {
  //       const decodedData = this.decodeAddressKeyInitData(initDataList[i]);
  //       keyInfoList.push({
  //         keyType: PrimitiveAccountKeyTypes.keyAddress,
  //         logicContract: logicList[i],
  //         weight: weightList[i],
  //         // // ex. 0xc4d66de8000000000000000000000000698bef3def503e2474f9f948b1b95b59cea64364
  //         // // initDataList[i] 의 끝에서부터 40자리 문자열을 추출
  //         // keyData: {
  //         //   signerAddress: "0x" + initDataList[i].slice(-40),
  //         // },
  //         keyData: {
  //           signerAddress: decodedData.signerAddress,
  //         },
  //       });
  //     } else if (selector === SELECTORS.keyWebAuthn) {
  //       const decodedData = this.decodeWebAuthnKeyInitData(initDataList[i]);
  //       keyInfoList.push({
  //         keyType: PrimitiveAccountKeyTypes.keyWebAuthn,
  //         logicContract: logicList[i],
  //         weight: weightList[i],
  //         keyData: {
  //           // TODO: data slice 영역 변경
  //           x: decodedData.x,
  //           y: decodedData.y,
  //           credentialId: decodedData.credentialId,
  //           rpIdHash: decodedData.rpIdHash,
  //           origin: decodedData.origin,
  //         },
  //       });
  //     } else if (selector === SELECTORS.keyZkOAuthRS256) {
  //       const decodedData = this.decodeZkOAuthRS256KeyInitData(initDataList[i]);
  //       keyInfoList.push({
  //         keyType: PrimitiveAccountKeyTypes.keyZkOAuthRS256,
  //         logicContract: logicList[i],
  //         weight: weightList[i],
  //         keyData: {
  //           n: decodedData.n,
  //           k: decodedData.k,
  //           commitment: decodedData.commitment,
  //           poseidonMerkleTreeDirectory:
  //             decodedData.poseidonMerkleTreeDirectory,
  //         },
  //       });
  //     }
  //   }

  //   return [threshold, keyInfoList];
  //   // return [threshold, logicList, initDataList, weightList];
  // }

  getEncodedKey(): string {
    return this.encodedKey;
  }

  getEncodedZkOAuthRS256KeyInitData(
    zkOAuthRS256KeyData: ZkOAuthRS256KeyData
  ): string {
    const commitment = zkOAuthRS256KeyData.commitment;
    const n = zkOAuthRS256KeyData.n;
    const k = zkOAuthRS256KeyData.k;
    const hAudList = zkOAuthRS256KeyData.hAudList;
    const poseidonMerkleTreeDirectory =
      zkOAuthRS256KeyData.poseidonMerkleTreeDirectory;

    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let encoded = abiCoder.encode(
      ["uint256", "uint256", "uint256", "uint256[]"],
      [n, k, hAudList, commitment]
    );

    // let encoded = this.getEncodedCommitment(commitment);
    const AccountKeyZkOAuthRS256Verifier3ABI = [
      "function initialize(bytes encoded, address _poseidonMerkleTreeDirectory) external",
    ];

    const contractInterface = new ethers.Interface(
      AccountKeyZkOAuthRS256Verifier3ABI
    );

    // 인코딩
    const encodedData = this.encodeCall(contractInterface, "initialize", [
      encoded,
      poseidonMerkleTreeDirectory,
    ]);

    return encodedData;
  }

  getEncodedAddressKeyInitData(addressKeyData: AddressKeyData): string {
    const AccountKeyAddressABI = [
      "function initialize(address signer) external",
    ];

    const contractInterface = new ethers.Interface(AccountKeyAddressABI);

    const encodedData = this.encodeCall(contractInterface, "initialize", [
      addressKeyData.signerAddress,
    ]);

    return encodedData;
  }

  getEncodedWebAuthnKeyInitData(webAuthnKeyData: WebAuthnKeyData): string {
    const credentialPubkey = webAuthnKeyData.credentialPubkey;
    const credentialId = webAuthnKeyData.credentialId;

    const pubkey = this.decodeCredentialPublicKey(
      ethers.getBytes(credentialPubkey)
    );
    if (!this.isCOSEPublicKeyEC2(pubkey)) {
      throw new Error("Not EC2");
    }
    const x = (pubkey as COSEPublicKeyEC2).get(COSEKEYS.x) as Uint8Array;
    const y = (pubkey as COSEPublicKeyEC2).get(COSEKEYS.y) as Uint8Array;

    let abiCoder = ethers.AbiCoder.defaultAbiCoder();

    const encodedWebAuthnKey = abiCoder.encode(
      ["tuple(uint256,uint256,string)"],
      [
        [
          ethers.hexlify(ethers.getBytes(x)),
          ethers.hexlify(ethers.getBytes(y)),
          credentialId,
        ],
      ]
    );

    const AccountKeyWebAuthnABI = [
      "function initialize(bytes encoded, bytes32 rpIdHash, bytes memory origin) external",
    ];

    const contractInterface = new ethers.Interface(AccountKeyWebAuthnABI);

    const encodedData = this.encodeCall(contractInterface, "initialize", [
      encodedWebAuthnKey,
      ethers.hexlify(ethers.getBytes(webAuthnKeyData.rpIdHash)),
      ethers.hexlify(ethers.toUtf8Bytes(webAuthnKeyData.origin)),
    ]);

    return encodedData;
  }

  setEncodedKeyData(threshold: number, keyInfoList: KeyInfo[]): string {
    // 각 리스트를 분리해서 준비
    const logicList: string[] = [];
    const keyInitDataList: string[] = [];
    const weightList: number[] = [];
    let abiCoder = ethers.AbiCoder.defaultAbiCoder();

    // KeyInfo 리스트를 순회하면서 각 리스트에 데이터 추가
    for (const keyInfo of keyInfoList) {
      logicList.push(keyInfo.logicContract);
      weightList.push(keyInfo.weight);
      let keyInitData = "";
      if (keyInfo.keyType === PrimitiveAccountKeyTypes.keyZkOAuthRS256) {
        const zkOAuthRS256KeyData = keyInfo.keyData as ZkOAuthRS256KeyData;
        keyInitData =
          this.getEncodedZkOAuthRS256KeyInitData(zkOAuthRS256KeyData);
      } else if (keyInfo.keyType === PrimitiveAccountKeyTypes.keyAddress) {
        const addressKeyData = keyInfo.keyData as AddressKeyData;
        keyInitData = this.getEncodedAddressKeyInitData(addressKeyData);
      } else if (keyInfo.keyType === PrimitiveAccountKeyTypes.keyWebAuthn) {
        const webAuthnKeyData = keyInfo.keyData as WebAuthnKeyData;
        keyInitData = this.getEncodedWebAuthnKeyInitData(webAuthnKeyData);
      } else {
        throw new Error(`Unsupported key type: ${keyInfo.keyType}`);
      }
      keyInitDataList.push(keyInitData);
    }

    let encoded = abiCoder.encode(
      ["uint8", "address[]", "bytes[]", "uint8[]"],
      [threshold, logicList, keyInitDataList, weightList]
    );

    return encoded;
  }

  setEncodedInitData(threshold: number, keyInfoList: KeyInfo[]): string {
    // 각 리스트를 분리해서 준비
    const logicList: string[] = [];
    const initDataList: string[] = [];
    const weightList: number[] = [];
    let abiCoder = ethers.AbiCoder.defaultAbiCoder();

    // KeyInfo 리스트를 순회하면서 각 리스트에 데이터 추가
    for (const keyInfo of keyInfoList) {
      logicList.push(keyInfo.logicContract);
      weightList.push(keyInfo.weight);

      if (keyInfo.keyType === PrimitiveAccountKeyTypes.keyZkOAuthRS256) {
        const zkOAuthRS256KeyData = keyInfo.keyData as ZkOAuthRS256KeyData;
        const n = zkOAuthRS256KeyData.n;
        const k = zkOAuthRS256KeyData.k;
        const hAudList = zkOAuthRS256KeyData.hAudList;
        const commitment = zkOAuthRS256KeyData.commitment;
        const poseidonMerkleTreeDirectory =
          zkOAuthRS256KeyData.poseidonMerkleTreeDirectory;

        let abiCoder = ethers.AbiCoder.defaultAbiCoder();
        let encoded = abiCoder.encode(
          ["uint256", "uint256", "uint256", "uint256[]"],
          [n, k, hAudList, commitment]
        );

        const AccountKeyZkOAuthRS256Verifier3ABI = [
          "function initialize(address owner, bytes encoded, address _poseidonMerkleTreeDirectory) external",
        ];

        const contractInterface = new ethers.Interface(
          AccountKeyZkOAuthRS256Verifier3ABI
        );

        // 인코딩
        const encodedData = this.encodeCall(contractInterface, "initialize", [
          keyInfo.logicContract,
          encoded,
          poseidonMerkleTreeDirectory,
        ]);
        initDataList.push(encodedData);
      } else if (keyInfo.keyType === PrimitiveAccountKeyTypes.keyAddress) {
        const AccountKeyAddressABI = [
          "function initialize(address owner, address signer) external",
        ];

        const contractInterface = new ethers.Interface(AccountKeyAddressABI);

        // 인코딩
        const encodedData = this.encodeCall(contractInterface, "initialize", [
          keyInfo.logicContract,
          (keyInfo.keyData as AddressKeyData).signerAddress,
        ]);
        initDataList.push(encodedData);
      } else {
        throw new Error(`Unsupported key type: ${keyInfo.keyType}`);
      }
    }

    let encoded = abiCoder.encode(
      ["uint8", "address[]", "bytes[]", "uint8[]"],
      [threshold, logicList, initDataList, weightList]
    );

    return encoded;
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

  // setAddressKey(threshold: number, keyInfoList: AddressKeyInfo[]): string {
  //   // key 값 셋팅
  //   this.threshold = threshold;
  //   this.keys = keyInfoList.map((keyInfo) => ({
  //     keyType: PrimitiveAccountKeyTypes.keyAddress,
  //     weight: keyInfo.weight,
  //     keyData: { signerAddress: keyInfo.signerAddress },
  //   }));
  //   this.checkThreshold();
  //   // 각 key 에 대한 encodedPrimitiveKey 를 생성
  //   this.encodedPrimitiveKeys = this.setPrimitiveKey(this.threshold, this.keys);
  //   this.encodedCompositeKey = this.setCompositeKey(this.encodedPrimitiveKeys);
  //   return this.encodedCompositeKey;
  // }

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
    // TODO: 동작 검증 필요
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

  getEncodedCommitment(commitment: string[]): string {
    let abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let encoded = abiCoder.encode(["uint256[]"], [commitment]);
    return encoded;
  }
}
