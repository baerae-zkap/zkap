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

  private async setInitialGasInfo(): Promise<this> {
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

    // verification 할 때 필요한 gas 계산 -> 각 키 타입에 따라 필요한 gas 를 사전에 정의한 값으로 설정
    if (this.userOp.initCode !== "0x" && this.userOp.initCode !== undefined) {
      const zkapFactory = ethers.dataSlice(this.userOp.initCode, 0, 20);
      const callData = ethers.dataSlice(this.userOp.initCode, 20);
      const walletCreationGasLimit = await this.provider.estimateGas({
        to: zkapFactory,
        data: callData,
      });

      this.userOp.verificationGasLimit = BigInt(
        walletCreationGasLimit
      ).toString();
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
              (
                BigInt(this.userOp.verificationGasLimit) +
                BigInt(ADDRESS_KEY_VALIDATION_GAS)
              ).toString()
            );
          } else if (keyType === PrimitiveAccountKeyTypes.keyWebAuthn) {
            this.userOp.verificationGasLimit = ethers.toBeHex(
              (
                BigInt(this.userOp.verificationGasLimit) +
                BigInt(WEB_AUTHN_KEY_VALIDATION_GAS)
              ).toString()
            );
          } else if (keyType === PrimitiveAccountKeyTypes.keyOAuthRS256) {
            this.userOp.verificationGasLimit = ethers.toBeHex(
              (
                BigInt(this.userOp.verificationGasLimit) +
                BigInt(OAUTH_KEY_VALIDATION_GAS)
              ).toString()
            );
          } else if (keyType === PrimitiveAccountKeyTypes.keySecp256k1) {
            this.userOp.verificationGasLimit = ethers.toBeHex(
              (
                BigInt(this.userOp.verificationGasLimit) +
                BigInt(SECP256K1_KEY_VALIDATION_GAS)
              ).toString()
            );
          } else if (keyType === PrimitiveAccountKeyTypes.keySecp256r1) {
            this.userOp.verificationGasLimit = ethers.toBeHex(
              (
                BigInt(this.userOp.verificationGasLimit) +
                BigInt(SECP256R1_KEY_VALIDATION_GAS)
              ).toString()
            );
          }
        }
      } else {
        throw new Error("Invalid key type");
      }
    } else {
      // 지갑이 만들어져있는 상태에서 verification 할 때에는 verificationGasLimit 을 signature 의 길이에 비례하여 대략적으로 초기값을 설정
      // check signature length && length / 64 * 100000 을 this.userOp.verificationGasLimit 에 할당
      const signatureLength = this.userOp.signature?.length ?? 0 / 64;
      this.userOp.verificationGasLimit = ethers.toBeHex(
        (signatureLength * 100000).toString()
      );
    }

    // set callGasLimit
    if (
      this.userOp.callData !== "0x" &&
      typeof this.userOp.callData === "string"
    ) {
      // ZKap 시나리오 상 지갑을 만들면서 바로 staking 하는 시나리오. 지갑에 잔고가 있기 전에 userOp를 만들어야 해서 아래 코드로 처리.
      // submit(address) : 0xa1903eab
      if (this.userOp.initCode !== "0x" && this.callMethodId === "0xa1903eab") {
        this.userOp.callGasLimit = ethers.toBeHex("110000");
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
      }
    } else {
      throw new Error("Call data is not set. Please set a valid call data.");
    }

    return this;
  }

  private async finalizeUserOp(): Promise<this> {
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
        throw new Error("Error estimating gas: " + error);
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
