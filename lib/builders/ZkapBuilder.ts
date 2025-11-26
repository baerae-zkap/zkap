import { BaseAccountBuilder } from "./BaseAccountBuilder";
import { CallDataBuilder } from "./CallDataBuilder";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";
import {
  ZkapAccountABIstring,
  ZkapAccountFactoryABIstring,
} from "../resources/abis";
import { ethers } from "ethers";
import {
  PaymasterService,
  PaymasterServiceConfig,
} from "../utils/PaymasterService";

export interface ZkapAccountInfo {
  chainId: number;
  entryPoint: string;
  enUrl: string;
  /**
   * Paymaster 설정 (대납 기능 활성화)
   * 설정하면 autoFillUserOp에서 paymaster 관련 데이터를 자동으로 채움
   */
  paymaster?: PaymasterServiceConfig;
}

export class ZkapBuilder extends BaseAccountBuilder {
  protected factoryInterface: ethers.Interface = new ethers.Interface(
    ZkapAccountFactoryABIstring
  );
  protected provider: ethers.JsonRpcProvider;
  private signerKeyTypes: number[] | undefined;
  private paymasterService: PaymasterService | undefined;

  constructor({ chainId, entryPoint, enUrl, paymaster }: ZkapAccountInfo) {
    const provider = new ethers.JsonRpcProvider(enUrl);
    super(chainId, entryPoint, provider);
    this.provider = provider;

    // Paymaster 설정이 있으면 PaymasterService 인스턴스 생성
    if (paymaster) {
      const paymasterServiceConfig: PaymasterServiceConfig = {
        serverUrl: paymaster.serverUrl,
        paymasterAddress: paymaster.paymasterAddress,
        chainId: paymaster.chainId,
        mode: paymaster.mode,
      };
      this.paymasterService = new PaymasterService(paymasterServiceConfig);
      // Paymaster 주소 설정
      this.setPaymaster(paymaster.paymasterAddress);
    }
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

  updateUserOpCallDataForPaymasterERC20(
    dest: ethers.AddressLike,
    tokenAddress: ethers.AddressLike,
    value: ethers.BigNumberish
  ): this {
    if (!this.userOp.callData || this.userOp.callData === "0x") {
      throw new Error("Call data is not set");
    }

    const callData = this.userOp.callData as string;
    // callData 가 ZkapAccount의 execute 함수 호출인지 executeBatch 함수 호출인지 판단
    const iface = new ethers.Interface(ZkapAccountABIstring);
    const parsedTx = iface.parseTransaction({ data: callData });
    if (parsedTx?.name !== "execute" && parsedTx?.name !== "executeBatch") {
      throw new Error("Call data is not a valid ZkapAccount function call");
    }

    // function transfer(address to, uint256 value)  함수 호출하는 callData 생성
    const ERC20TransferABIstring =
      '[{"inputs": [{"internalType": "address", "name": "to", "type": "address"}, {"internalType": "uint256", "name": "value", "type": "uint256"}], "name": "transfer", "outputs": [{"internalType": "bool", "name": "", "type": "bool"}], "stateMutability": "nonpayable", "type": "function"}]';
    const erc20TransferCallData = new ethers.Interface(
      ERC20TransferABIstring
    ).encodeFunctionData("transfer", [dest, value]);

    if (parsedTx?.name === "execute") {
      // execute 함수 호출인 경우, 기존 excute 함수 호출 대신에 executeBatch 함수 호출하는 것으로 변경하고, ERC20 토큰을 paymaster account 에 전송하는 로직을 추가
      const userRequiredDest = parsedTx?.args[0];
      const userRequiredValue = parsedTx?.args[1];
      const userRequiredFunc = parsedTx?.args[2];

      const callDataBuilder = new CallDataBuilder(ZkapAccountABIstring);
      const callData = callDataBuilder.encode("executeBatch", [
        [tokenAddress, userRequiredDest],
        [0, userRequiredValue],
        [erc20TransferCallData, userRequiredFunc],
      ]);
      this.userOp.callData = callData;
    }
    if (parsedTx?.name === "executeBatch") {
      const userRequiredDestList = parsedTx?.args[0];
      const userRequiredValueList = parsedTx?.args[1];
      const userRequiredFuncList = parsedTx?.args[2];
      const callDataBuilder = new CallDataBuilder(ZkapAccountABIstring);
      const callData = callDataBuilder.encode("executeBatch", [
        [tokenAddress, ...userRequiredDestList],
        [0, ...userRequiredValueList],
        [erc20TransferCallData, ...userRequiredFuncList],
      ]);
      this.userOp.callData = callData;
    }

    return this;
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
    let verificationGasLimit = 25000n;

    // verification 할 때 필요한 gas 계산 -> 각 키 타입에 따라 필요한 gas 를 사전에 정의한 값으로 설정
    if (this.userOp.initCode !== "0x" && this.userOp.initCode !== undefined) {
      const zkapFactory = ethers.dataSlice(this.userOp.initCode, 0, 20);
      const callData = ethers.dataSlice(this.userOp.initCode, 20);
      const walletCreationGasLimit = await this.provider.estimateGas({
        to: zkapFactory,
        data: callData,
      });

      verificationGasLimit += BigInt(walletCreationGasLimit);
    }

    const keyTypes = this.signerKeyTypes ?? [];

    for (const keyType of keyTypes) {
      const ADDRESS_KEY_VALIDATION_GAS = 15000n;
      const WEB_AUTHN_KEY_VALIDATION_GAS = 470000n; // 측정시 약 45만 gas 소모
      const ZK_OAUTH_RS256_KEY_VALIDATION_GAS = 340000n;

      if (keyType === PrimitiveAccountKeyTypes.keyAddress) {
        verificationGasLimit += BigInt(ADDRESS_KEY_VALIDATION_GAS);
      } else if (keyType === PrimitiveAccountKeyTypes.keyWebAuthn) {
        verificationGasLimit += BigInt(WEB_AUTHN_KEY_VALIDATION_GAS);
      } else if (keyType === PrimitiveAccountKeyTypes.keyZkOAuthRS256) {
        verificationGasLimit += BigInt(ZK_OAUTH_RS256_KEY_VALIDATION_GAS);
      }
    }

    // make verificationGasLimit 20% more
    verificationGasLimit = (verificationGasLimit * BigInt(120)) / BigInt(100);

    this.userOp.verificationGasLimit = ethers.toBeHex(
      verificationGasLimit.toString()
    );

    // Paymaster가 설정되어 있으면 paymaster 관련 데이터 자동 채우기
    if (this.paymasterService) {
      await this.autoFillPaymasterData();
    }

    return this;
  }

  /**
   * Paymaster 관련 데이터를 자동으로 채웁니다.
   * PaymasterService가 설정되어 있을 때만 호출됩니다.
   */
  private async autoFillPaymasterData(): Promise<void> {
    if (!this.paymasterService) {
      // error throw
      throw new Error(
        "Paymaster service is not set. Please set a valid paymaster service."
      );
    }

    // Paymaster 검증 및 PostOp 가스 한도 설정
    this.userOp.paymasterVerificationGasLimit = ethers.toBeHex(
      this.paymasterService.estimatePaymasterVerificationGasLimit().toString()
    );
    this.userOp.paymasterPostOpGasLimit = ethers.toBeHex(
      this.paymasterService.estimatePaymasterPostOpGasLimit().toString()
    );

    // Paymaster 데이터 가져오기
    const userOp = this.getUserOp();
    const paymasterData = await this.paymasterService.getPaymasterData(userOp);
    this.setPaymasterData(paymasterData);
  }

  /**
   * Paymaster 설정을 변경합니다.
   * @param paymaster Paymaster 설정
   */
  setPaymasterConfig(paymaster: PaymasterServiceConfig): this {
    const paymasterServiceConfig: PaymasterServiceConfig = {
      serverUrl: paymaster.serverUrl,
      paymasterAddress: paymaster.paymasterAddress,
      chainId: this.chainId,
      mode: paymaster.mode,
    };
    this.paymasterService = new PaymasterService(paymasterServiceConfig);
    this.setPaymaster(paymaster.paymasterAddress);
    return this;
  }

  /**
   * Paymaster 설정을 제거합니다 (대납 기능 비활성화).
   */
  removePaymasterConfig(): this {
    this.paymasterService = undefined;
    this.setPaymaster(ethers.ZeroAddress);
    this.setPaymasterData("0x");
    this.setPaymasterVerificationGasLimit("0x00");
    this.setPaymasterPostOpGasLimit("0x00");
    return this;
  }

  // async completeUserOp(): Promise<this> {
  //   if (this.userOp.sender === ethers.ZeroAddress) {
  //     throw new Error("Required fields are missing");
  //   }
  //   if (!this.userOpSigner) {
  //     throw new Error("UserOpSigner is not set");
  //   }

  //   await this.autoFillUserOp();
  //   const userOpHash = this.getUserOpHash();
  //   const signature = await this.userOpSigner.signUserOpHash(userOpHash);
  //   this.setSignature([0], signature);

  //   return this;
  // }

  // async completeUserOpWithSigner(signer: IUserOpSigner): Promise<this> {
  //   if (!signer) {
  //     throw new Error("Signer is not set");
  //   }
  //   this.userOpSigner = signer;
  //   await this.autoFillUserOp();
  //   const userOpHash = this.getUserOpHash();
  //   const signature = await signer.signUserOpHash(userOpHash);
  //   this.setSignature([0], signature);
  //   return this;
  // }

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

    this.userOp.initCode = initCode;
    this.signerKeyTypes = [PrimitiveAccountKeyTypes.keyWebAuthn];
    return this;
  }

  setRawInitCode(initCode: string): this {
    this.userOp.initCode = initCode;
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
    this.signerKeyTypes = [PrimitiveAccountKeyTypes.keyZkOAuthRS256];
    return this;
  }

  setUpdateMasterKeyCallData(encoded: string): this {
    const callDataBuilder = new CallDataBuilder(ZkapAccountABIstring);
    const callData = callDataBuilder.encode("updateMasterKey", [encoded]);
    this.userOp.callData = callData;
    if (!this.userOp.sender) {
      throw new Error("Sender is not set");
    }
    this.signerKeyTypes = [PrimitiveAccountKeyTypes.keyZkOAuthRS256];
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
    this.signerKeyTypes = [PrimitiveAccountKeyTypes.keyWebAuthn];
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
    this.signerKeyTypes = [PrimitiveAccountKeyTypes.keyWebAuthn];
    return this;
  }

  setCallData(callData: string): this {
    // if this.signerKeyTypes is not set, throw an error
    if (
      !this.signerKeyTypes ||
      this.signerKeyTypes.length === 0 ||
      this.signerKeyTypes.includes(0)
    ) {
      throw new Error(
        "Signer key types are not set. Please set a valid signer key types."
      );
    }
    super.setCallData(callData);
    return this;
  }

  setSignerKeyTypes(keyTypes: number[]): this {
    this.signerKeyTypes = keyTypes;
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
