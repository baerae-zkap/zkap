import { BaseAccountBuilder } from "./BaseAccountBuilder";
import { CallDataBuilder } from "./CallDataBuilder";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";
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
  private userOpSigner: IUserOpSigner | undefined;
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

  private async estimateCallGasLimit(): Promise<string> {
    // sender 주소에 코드가 있는지 확인하여 배포 여부를 판단
    const code = await this.provider.getCode(this.userOp.sender as string);

    if (code !== "0x") {
      // 지갑이 이미 배포된 경우
      const callGasLimit = await this.provider.estimateGas({
        from: this.entryPoint,
        to: this.userOp.sender,
        data: this.userOp.callData,
        // callValue가 정의되지 않은 경우를 대비하여 기본값 0을 사용합니다.
        value: (this.userOp as any).callValue || ethers.parseEther("0"),
      });
      return ethers.toBeHex(callGasLimit.toString());
    } else {
      // 지갑이 생성되어 있지 않고 initCode가 없으면 잘못된 시나리오
      if (!this.userOp.initCode || this.userOp.initCode === "0x") {
        throw new Error("Wallet not deployed and no initCode provided");
      }

      // initCode는 있지만 callData가 없는 경우 (지갑 생성만)
      if (!this.userOp.callData || this.userOp.callData === "0x") {
        return ethers.toBeHex("1000"); // 최소한의 가스만 설정
      }

      // initCode와 callData가 모두 있는 경우
      const callData = this.userOp.callData as string;
      const iface = new ethers.Interface(ZkapAccountABIstring);

      try {
        const parsedTx = iface.parseTransaction({ data: callData });
        const GAS_BUFFER = BigInt(25000); // 지갑 실행 로직 오버헤드 및 변동성을 위한 보정 계수

        switch (parsedTx?.name) {
          case "execute": {
            const { dest, value, func } = parsedTx.args;
            const gasEstimate = await this.provider.estimateGas({
              from: this.userOp.sender,
              to: dest,
              data: func,
              value: value,
            });
            return ethers.toBeHex((gasEstimate + GAS_BUFFER).toString());
          }

          case "executeBatch": {
            const { dest, value, func } = parsedTx.args;

            if (dest.length === 0) {
              return ethers.toBeHex(GAS_BUFFER.toString()); // 실행할 것이 없으면 버퍼만 반환
            }

            const estimationPromises = dest.map((dest: string, i: number) =>
              this.provider.estimateGas({
                from: this.userOp.sender,
                to: dest,
                data: func[i],
                value: value[i],
              })
            );

            const estimates = await Promise.all(estimationPromises);
            const totalGas = estimates.reduce(
              (acc, val) => BigInt(acc) + BigInt(val),
              BigInt(0)
            );

            return ethers.toBeHex((totalGas + GAS_BUFFER).toString());
          }

          default:
            // 지원하지 않는 함수일 경우, 에러를 던져 수동 처리를 유도합니다.
            throw new Error(
              `Unsupported function for gas estimation: ${parsedTx?.name}`
            );
        }
      } catch (error) {
        // 파싱 실패 (예: ABI에 없는 함수)
        console.error("Failed to parse callData for gas estimation:", error);
        throw new Error(
          "callData could not be parsed. Manual callGasLimit required."
        );
      }
    }
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

    this.userOp.callGasLimit = await this.estimateCallGasLimit();

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

    return this;
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
    if (!this.userOp.sender) {
      throw new Error("Sender is not set");
    }
    this.userOpSigner = this.masterKeySigner;
    return this;
  }

  setUpdateMasterKeyCallData(encoded: string): this {
    const callDataBuilder = new CallDataBuilder(ZkapAccountABIstring);
    const callData = callDataBuilder.encode("updateMasterKey", [encoded]);
    this.userOp.callData = callData;
    if (!this.userOp.sender) {
      throw new Error("Sender is not set");
    }
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
}
