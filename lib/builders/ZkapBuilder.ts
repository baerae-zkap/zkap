import { BaseAccountBuilder } from "./BaseAccountBuilder";
import { CallDataBuilder } from "./CallDataBuilder";
import { PrimitiveAccountKeyTypes, KeyInfo } from "../types/AccountKey";
import { AccountKeyBuilder } from "./AccountKeyBuilder";
import {
  ZkapAccountABIstring,
  ZkapAccountFactoryABIstring,
} from "../resources/abis";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { ethers } from "ethers";

export interface ZkapAccountInfo {
  chainId: number;
  entryPoint: string;
  enUrl: string;
  txKeySigner?: IUserOpSigner;
  masterKeySigner?: IUserOpSigner;
}

export class ZkapBuilder extends BaseAccountBuilder {
  protected factoryInterface: ethers.Interface = new ethers.Interface(
    ZkapAccountFactoryABIstring
  );
  protected provider: ethers.JsonRpcProvider;
  private callContract: string | undefined;
  private callValue: ethers.BigNumberish | undefined;
  private callData: string | undefined;
  private callMethodId: string | undefined;
  // private masterKeyInfo: [number, [number, KeyInfo[]]] | undefined;
  private txKeyInfo: [number, KeyInfo[]] | undefined;
  private userOpSigner: IUserOpSigner | undefined;
  private isCallFromEntryPoint: boolean | undefined;
  private txKeySigner: IUserOpSigner | undefined;
  private masterKeySigner: IUserOpSigner | undefined;
  private txKeyTypes: number[] | undefined;
  constructor({
    chainId,
    entryPoint,
    enUrl,
    txKeySigner,
    masterKeySigner,
  }: ZkapAccountInfo) {
    const provider = new ethers.JsonRpcProvider(enUrl);
    super(chainId, entryPoint, provider);
    this.provider = provider;
    this.txKeySigner = txKeySigner ?? {
      async signUserOpHash(userOpHash: string): Promise<string[]> {
        throw new Error("TxKeySigner is not set");
      },
    };
    this.masterKeySigner = masterKeySigner ?? {
      async signUserOpHash(userOpHash: string): Promise<string[]> {
        throw new Error("MasterKeySigner is not set");
      },
    };
    this.userOpSigner = this.txKeySigner;
  }

  getTxKeyTypes(): number[] {
    if (!this.txKeyTypes) {
      throw new Error("Tx key types is not set");
    }
    return this.txKeyTypes;
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

  async autoFillUserOp(): Promise<this> {
    if (!this.provider) {
      throw new Error("Provider is not set. Please provide a valid RPC URL.");
    }
    if (!this.userOp.sender) {
      throw new Error("Sender is not set. Please set a valid sender.");
    }
    const feeData = await this.provider.getFeeData();
    if (!feeData || !feeData.gasPrice) {
      throw new Error("Failed to get fee data from provider");
    }
    if (this.userOp.nonce === undefined) {
      // nonce 값은 entryPoint 의 getNonce(sender, 0) 값으로 설정
      const entryPointContract = new ethers.Contract(
        this.entryPoint,
        ["function getNonce(address,uint192) view returns(uint256)"],
        this.provider
      );
      const nonce = await entryPointContract.getNonce(this.userOp.sender, 0);
      this.userOp.nonce = ethers.toBeHex(nonce.toString());
    }

    this.userOp.maxFeePerGas = this.userOp.maxPriorityFeePerGas =
      ethers.toBeHex(feeData.gasPrice.toString());

    this.userOp.callGasLimit = ethers.toBeHex("100000");
    this.userOp.preVerificationGas = ethers.toBeHex("25000"); // preVerificationGas 값은 25000으로 고정
    // TODO: @kaikookim 아래 코드는 임시로 설정한 값이므로, 추후 수정 필요
    // this.userOp.verificationGasLimit = ethers.toBeHex("0");
    this.userOp.verificationGasLimit = ethers.toBeHex("1500000");

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
      const keyTypes = this.getTxKeyTypes();

      for (const keyType of keyTypes) {
        const ADDRESS_KEY_VALIDATION_GAS = 400000;
        const WEB_AUTHN_KEY_VALIDATION_GAS = 1500000;
        const OAUTH_KEY_VALIDATION_GAS = 400000;
        const SECP256K1_KEY_VALIDATION_GAS = 400000;
        const SECP256R1_KEY_VALIDATION_GAS = 400000;
        const ZK_OAUTH_RS256_KEY_VALIDATION_GAS = 5000000;
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
        } else if (keyType === PrimitiveAccountKeyTypes.keyZkOAuthRS256) {
          this.userOp.verificationGasLimit = ethers.toBeHex(
            (
              BigInt(this.userOp.verificationGasLimit) +
              BigInt(ZK_OAUTH_RS256_KEY_VALIDATION_GAS)
            ).toString()
          );
        }
      }
    } else {
      // 지갑이 만들어져있는 상태에서 verification 할 때에는 verificationGasLimit 을 signature 의 길이에 비례하여 대략적으로 초기값을 설정
      // check signature length && length / 64 * 100000 을 this.userOp.verificationGasLimit 에 할당
      const signatureLength = this.userOp.signature?.length ?? 0 / 64;
      // this.userOp.verificationGasLimit = ethers.toBeHex(
      //   (signatureLength * 100000).toString()
      // );

      // TODO: @kaikookim verificationGasLimit 구하는 것을 pimlico 로직 참고해서 변경
      // this.userOp.verificationGasLimit = ethers.toBeHex((100000).toString());
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
      if (this.userOp.initCode !== "0x") {
        // initCode 가 있고, callData 가 없는 경우 기본으로 1000 으로 설정
        this.userOp.callGasLimit = ethers.toBeHex("1000");
      } else {
        throw new Error("Call data is not set. Please set a valid call data.");
      }
    }

    return this;
  }

  private async finalizeUserOp(): Promise<this> {
    if (!this.userOpSigner) {
      throw new Error("UserOpSigner is not set");
    }
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
        // TODO: @kaikookim 아래 주석 처리된 verificationGasLimit 설정해주는 부분은 원래 들어가야하나, paymaster signature 만드는 과정에서 데이터가 트러져서 일단 주석처리 해놓음
        // 주석처리된 로직 반영 필요
        // this.userOp.verificationGasLimit = ethers.toBeHex(
        //   ((BigInt(estimatedGas) * BigInt(120)) / BigInt(100)).toString()
        // );
      } catch (error) {
        throw new Error("Error estimating gas: " + error);
      }
      const newUserOpHash = this.getUserOpHash();
      // TODO : (keyIndexList, keySignatureList) = abi.decode(userOp.signature,(uint8[], bytes[])); 형태로 인코딩 하기
      const signature = await this.userOpSigner.signUserOpHash(newUserOpHash);
      this.setSignature([0], signature);
      return this;
    }
  }

  async completeUserOp(): Promise<this> {
    if (this.userOp.sender === ethers.ZeroAddress) {
      throw new Error("Required fields are missing");
    }
    if (!this.userOpSigner) {
      throw new Error("UserOpSigner is not set");
    }

    await this.autoFillUserOp(); // TODO : 각 키 타입마다 필요한 gas 량 측정하여 초기값 설정
    const userOpHash = this.getUserOpHash();
    const signature = await this.userOpSigner.signUserOpHash(userOpHash);
    this.setSignature([0], signature);

    // await this.finalizeUserOp(); // TODO : 이 부분으로 정교하게 맞추는 부분은 제거.
    return this;
  }

  setInitCode(
    zkapFactory: string,
    salt: ethers.BigNumberish,
    encodedMasterKey: string,
    encodedTxKey: string
  ): this {
    const callDataBuilder = new CallDataBuilder(ZkapAccountFactoryABIstring);

    const callData = callDataBuilder.encode("createAccount", [
      salt,
      encodedMasterKey,
      encodedTxKey,
    ]);

    const initCode = ethers.concat([zkapFactory, callData]);

    this.setTxKeyTypes(encodedTxKey);

    this.userOp.initCode = initCode;
    return this;
  }

  setRawInitCode(initCode: string): this {
    this.userOp.initCode = initCode;
    return this;
  }

  setTxKeyTypes(encodedKey: string): this {
    const accountKeyBuilder = new AccountKeyBuilder();
    const keyTypes = accountKeyBuilder.getDecodedKeyTypes(encodedKey);
    this.txKeyTypes = keyTypes;
    return this;
  }

  setSignature(keyIndexList: number[], keySignatureList: string[]): this {
    const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();

    this.userOp.signature = defaultAbiCoder.encode(
      ["uint8[]", "bytes[]"],
      [keyIndexList, keySignatureList]
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
    this.userOpSigner = this.masterKeySigner;
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
    this.userOpSigner = this.masterKeySigner;
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
    this.userOpSigner = this.txKeySigner;
    return this;
  }

  setExecuteBatchCallData(
    contractAddresses: string[],
    values: ethers.BigNumberish[],
    data: string[]
  ): this {
    const callDataBuilder = new CallDataBuilder(ZkapAccountABIstring);
    const useropCallData = callDataBuilder.encode("executeBatch", [
      contractAddresses,
      values,
      data,
    ]);
    this.callContract = this.userOp.sender;
    // values 의 합계를 계산
    const callValue = 0;
    this.callValue = callValue;
    this.callData = useropCallData;
    this.callMethodId = useropCallData.slice(0, 10);

    this.isCallFromEntryPoint = true;

    this.userOp.callData = useropCallData;
    this.userOpSigner = this.txKeySigner;
    return this;
  }

  getUserOpHashForPaymaster(): string {
    const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();

    const userOpHash = ethers.keccak256(
      this.encodeUserOpForPaymaster(this.getPackedUserOp())
    );

    const enc = defaultAbiCoder.encode(
      ["bytes32", "uint256"],
      [userOpHash, this.chainId]
    );
    const userOpHashForPaymaster = ethers.keccak256(enc);
    return userOpHashForPaymaster;
  }

  // TODO: @kaikookim 아래 함수는 검증되지 않은 함수이므로, 테스트 후 사용해야 함
  // setFeeDelegatedUserOpCallData
  setFeeDelegatedUserOpCallData(erc20Token: string, treasury: string): this {
    if (!this.userOp.callData || this.userOp.callData === "0x") {
      throw new Error(
        "Call data is not set. Please set a valid call data first."
      );
    }

    const callDataBuilder = new CallDataBuilder(ZkapAccountABIstring);

    // execute 함수의 selector: 0xb61d27f6
    const executeSelector = "0xb61d27f6";
    // executeBatch 함수의 selector: 0x47e1da2a
    const executeBatchSelector = "0x47e1da2a";

    const currentCallData = this.userOp.callData;
    const selector = currentCallData.slice(0, 10);

    if (selector === executeSelector) {
      // execute 함수 호출인 경우
      try {
        const decoded = callDataBuilder.decode("execute", currentCallData);
        const [dest, value, func] = decoded;

        // ERC20 토큰 전송을 위한 callData 생성 (transfer(address,uint256) selector: 0xa9059cbb)
        const erc20TransferCallData = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint256"],
          [treasury, value]
        );
        const erc20TransferCallDataWithSelector =
          "0xa9059cbb" + erc20TransferCallData.slice(2);

        // execute 함수를 호출하되, ERC20 토큰 전송으로 변경
        const newCallData = callDataBuilder.encode("execute", [
          erc20Token,
          "0", // value는 0으로 설정 (ERC20 전송이므로)
          erc20TransferCallDataWithSelector,
        ]);

        this.userOp.callData = newCallData;
        this.callContract = erc20Token;
        this.callValue = "0";
        this.callData = erc20TransferCallDataWithSelector;
      } catch (error) {
        throw new Error(`Failed to decode execute call data: ${error}`);
      }
    } else if (selector === executeBatchSelector) {
      // executeBatch 함수 호출인 경우
      try {
        const decoded = callDataBuilder.decode("executeBatch", currentCallData);
        const [dest, values, funcs] = decoded;

        // 각 함수 호출을 ERC20 토큰 전송으로 변경
        const newDest: string[] = [];
        const newValues: string[] = [];
        const newFuncs: string[] = [];

        for (let i = 0; i < dest.length; i++) {
          newDest.push(erc20Token);
          newValues.push("0"); // value는 0으로 설정

          // 원래 함수 호출의 value를 ERC20 전송량으로 사용
          const erc20TransferCallData =
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256"],
              [treasury, values[i]]
            );
          const erc20TransferCallDataWithSelector =
            "0xa9059cbb" + erc20TransferCallData.slice(2);
          newFuncs.push(erc20TransferCallDataWithSelector);
        }

        const newCallData = callDataBuilder.encode("executeBatch", [
          newDest,
          newValues,
          newFuncs,
        ]);

        this.userOp.callData = newCallData;
        this.callContract = erc20Token;
        this.callValue = "0";
        this.callData = newFuncs[0]; // 첫 번째 함수 호출을 기본으로 설정
      } catch (error) {
        throw new Error(`Failed to decode executeBatch call data: ${error}`);
      }
    } else {
      throw new Error(
        "Current call data is not calling execute or executeBatch function"
      );
    }

    return this;
  }
}
