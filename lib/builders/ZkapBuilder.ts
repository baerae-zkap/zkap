import { BaseAccountBuilder } from "./BaseAccountBuilder";
import { CallDataBuilder } from "./CallDataBuilder";
import {
  PrimitiveAccountKeyTypes,
  KeyInfo,
  CompositeAccountKeyTypes,
} from "../types/AccountKey";
import { AccountKeyBuilder } from "./AccountKeyBuilder";
import {
  ZkapAccountABIstring,
  ZkapAccountFactoryABIstring,
} from "../resources/abis";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { ethers } from "ethers";

// const ERC1967PROXY_CREATION_CODE =
//   "0x60806040526102a88038038061001481610168565b92833981016040828203126101645781516001600160a01b03811692909190838303610164576020810151906001600160401b03821161016457019281601f8501121561016457835161006e610069826101a1565b610168565b9481865260208601936020838301011161016457815f926020809301865e86010152823b15610152577f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc80546001600160a01b031916821790557fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b5f80a282511561013a575f8091610122945190845af43d15610132573d91610113610069846101a1565b9283523d5f602085013e6101bc565b505b604051608d908161021b8239f35b6060916101bc565b50505034156101245763b398979f60e01b5f5260045ffd5b634c9c8ce360e01b5f5260045260245ffd5b5f80fd5b6040519190601f01601f191682016001600160401b0381118382101761018d57604052565b634e487b7160e01b5f52604160045260245ffd5b6001600160401b03811161018d57601f01601f191660200190565b906101e057508051156101d157805190602001fd5b63d6bda27560e01b5f5260045ffd5b81511580610211575b6101f1575090565b639996b31560e01b5f9081526001600160a01b0391909116600452602490fd5b50803b156101e956fe60806040525f8073ffffffffffffffffffffffffffffffffffffffff7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc5416368280378136915af43d5f803e156053573d5ff35b3d5ffdfea26469706673582212204d5a42735b382b9656455f8cf6e20d00c3dc42b8251870be6293326a6a634eee64736f6c634300081c0033";

export class ZkapBuilder extends BaseAccountBuilder {
  protected factoryInterface: ethers.Interface = new ethers.Interface(
    ZkapAccountFactoryABIstring
  );
  private provider: ethers.JsonRpcProvider;
  private callContract: string;
  private callValue: ethers.BigNumberish;
  private callData: string;
  private callMethodId: string;
  private masterKeyInfo: [number, [number, KeyInfo[]]];
  private txKeyInfo: [number, [number, KeyInfo[]]];
  private userOpSigner: IUserOpSigner;
  private isCallFromEntryPoint: boolean;
  constructor(
    chainId: number,
    entryPoint: string,
    enUrl: string,
    userOpSigner?: IUserOpSigner
  ) {
    super(chainId, entryPoint);
    this.provider = new ethers.JsonRpcProvider(enUrl);
    this.userOpSigner = userOpSigner ?? {
      async signUserOpHash(userOpHash: string): Promise<string> {
        throw new Error("UserOpSigner is not set");
      },
    };
  }

  setMasterKeyInfo(encoded: string): this {
    const accountKeyBuilder = new AccountKeyBuilder();
    const [keyType, encodedKeys] =
      accountKeyBuilder.getDecodedCompositeKey(encoded);
    this.masterKeyInfo = [
      keyType,
      accountKeyBuilder.getDecodedPrimitiveKey(encodedKeys),
    ];
    return this;
  }

  getMasterKeyInfo(): [number, [number, KeyInfo[]]] {
    return this.masterKeyInfo;
  }

  setTxKeyInfo(encoded: string): this {
    const accountKeyBuilder = new AccountKeyBuilder();
    const [keyType, encodedKeys] =
      accountKeyBuilder.getDecodedCompositeKey(encoded);
    this.txKeyInfo = [
      keyType,
      accountKeyBuilder.getDecodedPrimitiveKey(encodedKeys),
    ];
    return this;
  }

  getTxKeyInfo(): [number, [number, KeyInfo[]]] {
    return this.txKeyInfo;
  }

  getRequiredPrefund(): string {
    if (
      !this.userOp.verificationGasLimit ||
      !this.userOp.callGasLimit ||
      !this.userOp.paymasterVerificationGasLimit ||
      !this.userOp.paymasterPostOpGasLimit ||
      !this.userOp.preVerificationGas ||
      !this.userOp.maxFeePerGas
    ) {
      throw new Error(
        "Verification gas limit and call gas limit are not set. Please set a valid gas limit."
      );
    }
    const requiredGas =
      BigInt(this.userOp.verificationGasLimit) +
      BigInt(this.userOp.callGasLimit) +
      BigInt(this.userOp.paymasterVerificationGasLimit) +
      BigInt(this.userOp.paymasterPostOpGasLimit) +
      BigInt(this.userOp.preVerificationGas);

    return ethers.toBeHex(
      (requiredGas * BigInt(this.userOp.maxFeePerGas)).toString()
    );
  }

  async setInitialGasInfo(): Promise<this> {
    if (!this.provider) {
      throw new Error("Provider is not set. Please provide a valid RPC URL.");
    }
    const feeData = await this.provider.getFeeData();
    if (!feeData || !feeData.gasPrice) {
      throw new Error("Failed to get fee data from provider");
    }
    this.userOp.maxFeePerGas = this.userOp.maxPriorityFeePerGas =
      ethers.toBeHex(feeData.gasPrice.toString());

    this.userOp.callGasLimit = ethers.toBeHex("0");
    this.userOp.preVerificationGas = ethers.toBeHex("25000"); // preVerificationGas 값은 25000으로 고정
    this.userOp.verificationGasLimit = ethers.toBeHex("0");

    // set callGasLimit
    if (
      this.userOp.callData !== "0x" &&
      typeof this.userOp.callData === "string"
    ) {
      // ZKap 시나리오 상 지갑을 만들면서 바로 staking 하는 시나리오. 지갑에 잔고가 있기 전에 userOp를 만들어야 해서 아래 코드로 처리.
      // submit(address) : 0xa1903eab
      if (this.userOp.initCode !== "0x" && this.callMethodId === "0xa1903eab") {
        this.userOp.callGasLimit = ethers.toBeHex("110000");
        // verification 할 때 필요한 gas 계산 -> 각 키 타입에 따라 필요한 gas 를 사전에 정의한 값으로 설정
        const [keyType, [_, keys]] = this.getTxKeyInfo();
        if (Number(keyType) === CompositeAccountKeyTypes.keyMultisig) {
          for (const key of keys) {
            const ADDRESS_KEY_VALIDATION_GAS = 400000;
            const WEB_AUTHN_KEY_VALIDATION_GAS = 400000;
            const OAUTH_KEY_VALIDATION_GAS = 400000;
            const SECP256K1_KEY_VALIDATION_GAS = 400000;
            const SECP256R1_KEY_VALIDATION_GAS = 400000;
            const keyType = Number(key.keyType);
            if (keyType === PrimitiveAccountKeyTypes.keyAddress) {
              this.userOp.verificationGasLimit = ethers.toBeHex(
                BigInt(ADDRESS_KEY_VALIDATION_GAS).toString()
              );
            } else if (keyType === PrimitiveAccountKeyTypes.keyWebAuthn) {
              this.userOp.verificationGasLimit = ethers.toBeHex(
                BigInt(WEB_AUTHN_KEY_VALIDATION_GAS).toString()
              );
            } else if (keyType === PrimitiveAccountKeyTypes.keyOAuthRS256) {
              this.userOp.verificationGasLimit = ethers.toBeHex(
                BigInt(OAUTH_KEY_VALIDATION_GAS).toString()
              );
            } else if (keyType === PrimitiveAccountKeyTypes.keySecp256k1) {
              this.userOp.verificationGasLimit = ethers.toBeHex(
                BigInt(SECP256K1_KEY_VALIDATION_GAS).toString()
              );
            } else if (keyType === PrimitiveAccountKeyTypes.keySecp256r1) {
              this.userOp.verificationGasLimit = ethers.toBeHex(
                BigInt(SECP256R1_KEY_VALIDATION_GAS).toString()
              );
            }
          }
        } else {
          throw new Error("Invalid key type");
        }
      } else {
        let callGasLimit;
        if (this.isCallFromEntryPoint) {
          callGasLimit = await this.provider.estimateGas({
            from: this.entryPoint,
            to: this.callContract,
            data: this.callData,
            value: this.callValue,
          });
        } else {
          callGasLimit = await this.provider.estimateGas({
            from: this.userOp.sender,
            to: this.callContract,
            data: this.callData,
            value: this.callValue,
          });
        }
        this.userOp.callGasLimit = ethers.toBeHex(callGasLimit);
        // check signature length && length / 64 * 100000 을 this.userOp.verificationGasLimit 에 할당
        const signatureLength = this.userOp.signature?.length ?? 0 / 64;
        this.userOp.verificationGasLimit = ethers.toBeHex(
          (signatureLength * 100000).toString()
        );
      }
    } else {
      throw new Error("Call data is not set. Please set a valid call data.");
    }

    return this;
  }

  async finalizeUserOp(): Promise<this> {
    // verificationGasLimit 정확한 값으로 업데이트
    if (
      typeof this.userOp.initCode === "string" &&
      this.userOp.initCode !== "0x"
    ) {
      // initCode 있는 경우 verificationGasLimit 을 추가로 진행 대신 초기 셋팅 값 사용
      return this;
    } else {
      const callDataBuilder = new CallDataBuilder(ZkapAccountABIstring);
      const callData = callDataBuilder.encode("validateUserOp", [
        this.getPackedUserOp(),
        this.getUserOpHash(),
        ethers.parseEther("0.000001"),
      ]);

      let estimatedGas;
      try {
        estimatedGas = await this.provider.estimateGas({
          from: this.entryPoint,
          to: this.userOp.sender,
          data: callData,
        });

        this.userOp.verificationGasLimit = ethers.toBeHex(
          ((BigInt(estimatedGas) * BigInt(120)) / BigInt(100)).toString()
        );
      } catch (error) {
        console.error("Error estimating gas:", error);
      }
      const newUserOpHash = this.getUserOpHash();
      const signature = await this.userOpSigner.signUserOpHash(newUserOpHash);
      this.setSignature([signature]);
      return this;
    }
  }

  async completeUserOp(): Promise<this> {
    if (
      this.userOp.sender === ethers.ZeroAddress ||
      this.userOp.nonce === "" ||
      this.userOp.callData === "0x"
    ) {
      throw new Error("Required fields are missing");
    }
    if (!this.userOpSigner) {
      throw new Error("UserOpSigner is not set");
    }

    await this.setInitialGasInfo();
    const userOpHash = this.getUserOpHash();
    const signature = await this.userOpSigner.signUserOpHash(userOpHash);
    this.setSignature([signature]);

    await this.finalizeUserOp();
    return this;
  }

  setInitCode(
    zkapFactory: string,
    salt: ethers.BigNumberish,
    compositeAccountKeyfactory: string,
    encodedMasterKey: string,
    encodedTxKey: string
  ): this {
    const callDataBuilder = new CallDataBuilder(ZkapAccountFactoryABIstring);
    const callData = callDataBuilder.encode("createAccount", [
      salt,
      compositeAccountKeyfactory,
      encodedMasterKey,
      encodedTxKey,
    ]);

    const initCode = ethers.concat([zkapFactory, callData]);
    this.setMasterKeyInfo(encodedMasterKey);
    this.setTxKeyInfo(encodedTxKey);

    this.userOp.initCode = initCode;
    return this;
  }

  setSignature(signatureArray: string[]): this {
    const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();

    this.userOp.signature = defaultAbiCoder.encode(
      ["bytes[]"],
      [signatureArray]
    );
    return this;
  }

  setUpdateTxKeyCallData(encoded: string): this {
    const callDataBuilder = new CallDataBuilder(ZkapAccountABIstring);
    const callData = callDataBuilder.encode("updateTxKey", [encoded]);
    this.userOp.callData = callData;
    if (this.userOp.sender) {
      this.callContract = this.userOp.sender;
      this.callValue = ethers.parseEther("0");
      this.callData = callData;
    } else {
      throw new Error("Sender is not set");
    }
    this.isCallFromEntryPoint = true;
    return this;
  }

  setUpdateMasterKeyCallData(encoded: string): this {
    const callDataBuilder = new CallDataBuilder(ZkapAccountABIstring);
    const callData = callDataBuilder.encode("updateMasterKey", [encoded]);
    this.userOp.callData = callData;
    if (this.userOp.sender) {
      this.callContract = this.userOp.sender;
      this.callValue = ethers.parseEther("0");
      this.callData = callData;
    } else {
      throw new Error("Sender is not set");
    }
    this.isCallFromEntryPoint = true;
    return this;
  }

  setExecuteCallData(
    contractAddress: string,
    value: ethers.BigNumberish,
    data: string
  ): this {
    const callDataBuilder = new CallDataBuilder(ZkapAccountABIstring);
    const useropCallData = callDataBuilder.encode("execute", [
      contractAddress,
      value,
      data,
    ]);
    this.callContract = contractAddress;
    this.callValue = value;
    this.callData = data;
    this.callMethodId = data && data.length > 0 ? data.slice(0, 10) : "";

    this.userOp.callData = useropCallData;
    return this;
  }
}
