import { BaseAccountBuilder } from "./BaseAccountBuilder";
import { CallDataBuilder } from "./CallDataBuilder";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";
import { UserOperation } from "../types/UserOperation";
import {
  ERC20ABI,
  ZkapAccountABI,
  ZkapAccountFactoryABI,
} from "../types/abi";
import { ethers } from "ethers";
import {
  PaymasterService,
  PaymasterServiceConfig,
} from "../utils/PaymasterService";

type BatchCallArg = { target: string; value: bigint; data: string };

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
  // GAS_BUFFER: covers wallet execute() dispatch overhead and nonce SSTORE
  // for contracts not yet deployed, empirically measured
  static readonly GAS_BUFFER = BigInt(25000);

  static readonly ADDRESS_KEY_VALIDATION_GAS = 15000n;
  static readonly SECP256K1_KEY_VALIDATION_GAS = 15000n;  // secp256k1 ECDSA, ecrecover 수준
  static readonly SECP256R1_KEY_VALIDATION_GAS = 470000n; // P-256 ECDSA, WebAuthn과 유사
  static readonly WEB_AUTHN_KEY_VALIDATION_GAS = 470000n; // 측정시 약 45만 gas 소모
  static readonly OAUTH_RS256_KEY_VALIDATION_GAS = 350000n; // RSA-2048 서명 검증
  static readonly ZK_OAUTH_RS256_KEY_VALIDATION_GAS = 1000000n; // 신규 컨트랙트 측정값 기준, 여유분 포함 (구 컨트랙트: ~340000)

  protected factoryInterface: ethers.Interface = new ethers.Interface(
    ZkapAccountFactoryABI
  );
  protected provider: ethers.JsonRpcProvider;
  private signerKeyTypes: number[] | undefined;
  private paymasterService: PaymasterService | undefined;

  constructor({ chainId, entryPoint, enUrl, paymaster }: ZkapAccountInfo) {
    try {
      new URL(enUrl);
    } catch {
      throw new Error(`Invalid enUrl: "${enUrl}". Must be a valid URL.`);
    }
    const provider = new ethers.JsonRpcProvider(enUrl);
    super(chainId, entryPoint, provider);
    this.provider = provider;

    // Paymaster 설정이 있으면 PaymasterService 인스턴스 생성
    if (paymaster) {
      const paymasterServiceConfig: PaymasterServiceConfig = {
        serverUrl: paymaster.serverUrl,
        paymasterAddress: paymaster.paymasterAddress,
        chainId: this.chainId,
        mode: paymaster.mode,
        tokenAddress: paymaster.tokenAddress,
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
        "Required gas fields not set: verificationGasLimit, callGasLimit, paymasterVerificationGasLimit, paymasterPostOpGasLimit, preVerificationGas, and maxFeePerGas must all be set."
      );
    }
    const requiredGas =
      BigInt(this.userOp.verificationGasLimit) +
      BigInt(this.userOp.callGasLimit) +
      BigInt(this.userOp.paymasterVerificationGasLimit) +
      BigInt(this.userOp.paymasterPostOpGasLimit) +
      BigInt(this.userOp.preVerificationGas);

    return ethers.toBeHex(
      requiredGas * BigInt(this.userOp.maxFeePerGas)
    );
  }

  private normalizeExecuteBatchArgs(parsedTx: ethers.TransactionDescription): {
    destList: string[];
    valueList: bigint[];
    funcList: string[];
  } {
    if (parsedTx.fragment.inputs.length === 1) {
      // 신 스타일: executeBatch({address target, uint256 value, bytes data}[] calls)
      const calls = parsedTx.args[0];
      return {
        destList: calls.map((c: BatchCallArg) => c.target),
        valueList: calls.map((c: BatchCallArg) => c.value),
        funcList: calls.map((c: BatchCallArg) => c.data),
      };
    } else {
      // 구 스타일: executeBatch(address[] dest, uint256[] value, bytes[] func)
      // @deprecated 이 분기는 구버전 ZkapAccount 컨트랙트와의 하위 호환을 위해 유지됩니다.
      //             신규 컨트랙트는 단일 배열 인자(BatchCallArg[]) 형식을 사용합니다.
      return {
        destList: parsedTx.args[0],
        valueList: parsedTx.args[1],
        funcList: parsedTx.args[2],
      };
    }
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
        value: ethers.parseEther("0"),
      });
      return ethers.toBeHex(callGasLimit + ZkapBuilder.GAS_BUFFER);
    } else {
      // 지갑이 생성되어 있지 않고 initCode가 없으면 잘못된 시나리오
      if (!this.userOp.initCode || this.userOp.initCode === "0x") {
        throw new Error("Wallet not deployed and no initCode provided");
      }

      // initCode는 있지만 callData가 없는 경우 (지갑 생성만)
      if (!this.userOp.callData || this.userOp.callData === "0x") {
        const WALLET_CREATION_ONLY_CALL_GAS = 1000n; // 지갑 생성만 할 때 최소 callGasLimit
        return ethers.toBeHex(WALLET_CREATION_ONLY_CALL_GAS);
      }

      // initCode와 callData가 모두 있는 경우
      const callData = this.userOp.callData as string;
      const iface = new ethers.Interface(ZkapAccountABI);

      try {
        const parsedTx = iface.parseTransaction({ data: callData });
        if (!parsedTx) {
          throw new Error("callData could not be parsed. Manual callGasLimit required.");
        }
        switch (parsedTx.name) {
          case "execute": {
            const { dest, value, func } = parsedTx.args;
            const gasEstimate = await this.provider.estimateGas({
              from: this.entryPoint,
              to: dest,
              data: func,
              value: value,
            });
            return ethers.toBeHex(gasEstimate + ZkapBuilder.GAS_BUFFER);
          }

          case "executeBatch": {
            const { destList, valueList, funcList } = this.normalizeExecuteBatchArgs(parsedTx);

            if (destList.length === 0) {
              return ethers.toBeHex(ZkapBuilder.GAS_BUFFER); // 실행할 것이 없으면 버퍼만 반환
            }

            const estimationPromises = destList.map((d: string, i: number) =>
              this.provider.estimateGas({
                from: this.entryPoint,
                to: d,
                data: funcList[i],
                value: valueList[i],
              })
            );

            const estimates = await Promise.all(estimationPromises);
            const totalGas = estimates.reduce(
              (acc, val) => BigInt(acc) + BigInt(val),
              BigInt(0)
            );

            return ethers.toBeHex(totalGas + ZkapBuilder.GAS_BUFFER);
          }

          case "updateKeys": {
            // updateKeys(bytes encodedMasterKey, bytes encodedTxKey)
            // Called with initCode during wallet creation - wallet not yet deployed
            // Cannot use on-chain estimateGas, use fixed value
            const UPDATE_KEYS_GAS = BigInt(2000000);
            return ethers.toBeHex((UPDATE_KEYS_GAS + ZkapBuilder.GAS_BUFFER).toString());
          }

          case "updateMasterKey": {
            // updateMasterKey(bytes encoded)
            // Fallback for cases with initCode (already deployed wallets handled above)
            const UPDATE_MASTER_KEY_GAS = BigInt(1000000);
            return ethers.toBeHex((UPDATE_MASTER_KEY_GAS + ZkapBuilder.GAS_BUFFER).toString());
          }

          case "updateTxKey": {
            // updateTxKey(bytes encoded)
            const UPDATE_TX_KEY_GAS = BigInt(1000000);
            return ethers.toBeHex((UPDATE_TX_KEY_GAS + ZkapBuilder.GAS_BUFFER).toString());
          }

          default:
            // 지원하지 않는 함수일 경우, 에러를 던져 수동 처리를 유도합니다.
            throw new Error(
              `Unsupported function for gas estimation: ${parsedTx.name}`
            );
        }
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        const original = typeof error === 'string' ? error : JSON.stringify(error);
        throw new Error(`callData could not be parsed. Manual callGasLimit required. Original: ${original}`);
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
    const iface = new ethers.Interface(ZkapAccountABI);
    const parsedTx = iface.parseTransaction({ data: callData });
    if (parsedTx?.name !== "execute" && parsedTx?.name !== "executeBatch") {
      throw new Error(`Call data is not a valid ZkapAccount function call. Expected 'execute' or 'executeBatch', but found '${parsedTx?.name}'.`);
    }

    // function transfer(address to, uint256 value)  함수 호출하는 callData 생성
    const erc20TransferCallData = new ethers.Interface(
      ERC20ABI
    ).encodeFunctionData("transfer", [dest, value]);

    if (parsedTx?.name === "execute") {
      // execute 함수 호출인 경우, 기존 excute 함수 호출 대신에 executeBatch 함수 호출하는 것으로 변경하고, ERC20 토큰을 paymaster account 에 전송하는 로직을 추가
      const userRequiredDest = parsedTx?.args[0];
      const userRequiredValue = parsedTx?.args[1];
      const userRequiredFunc = parsedTx?.args[2];

      const callDataBuilder = new CallDataBuilder(ZkapAccountABI);
      const callData = callDataBuilder.encode("executeBatch(address[],uint256[],bytes[])", [
        [tokenAddress, userRequiredDest],
        [0, userRequiredValue],
        [erc20TransferCallData, userRequiredFunc],
      ]);
      this.userOp.callData = callData;
    } else if (parsedTx?.name === "executeBatch") {
      const { destList: userRequiredDestList, valueList: userRequiredValueList, funcList: userRequiredFuncList } = this.normalizeExecuteBatchArgs(parsedTx);
      const callDataBuilder = new CallDataBuilder(ZkapAccountABI);
      const callData = callDataBuilder.encode("executeBatch(address[],uint256[],bytes[])", [
        [tokenAddress, ...userRequiredDestList],
        [0, ...userRequiredValueList],
        [erc20TransferCallData, ...userRequiredFuncList],
      ]);
      this.userOp.callData = callData;
    }

    return this;
  }

  /**
   * UserOperation의 가스 필드(nonce, callGasLimit, verificationGasLimit, preVerificationGas, maxFeePerGas 등)를 자동으로 채웁니다.
   * Paymaster가 설정된 경우 paymasterData도 함께 채워집니다.
   *
   * @warning 이 메서드는 인스턴스당 한 번만 호출해야 합니다. 재호출 시 가스 추정값이 달라질 수 있습니다.
   *          새 UserOp가 필요하면 새 ZkapBuilder 인스턴스를 생성하세요.
   */
  async autoFillUserOp(nonceKey?: bigint): Promise<this> {
    /* istanbul ignore next */
    if (!this.provider) {
      throw new Error("Provider is not set. Please provide a valid RPC URL.");
    }
    if (
      !this.userOp.sender ||
      !ethers.isAddress(this.userOp.sender) ||
      this.userOp.sender === ethers.ZeroAddress
    ) {
      throw new Error("Sender is not set or invalid. Please set a non-zero Ethereum address.");
    }
    if (!ethers.isAddress(this.entryPoint) || this.entryPoint === ethers.ZeroAddress) {
      throw new Error("EntryPoint is invalid. Please provide a valid non-zero EntryPoint address.");
    }
    if (!this.signerKeyTypes || this.signerKeyTypes.length === 0) {
      throw new Error("signerKeyTypes is not set. Call setSignerKeyTypes() before autoFillUserOp()");
    }
    const feeData = await this.provider.getFeeData();
    if (!feeData) {
      throw new Error("Failed to get fee data from provider");
    }
    const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? feeData.gasPrice;
    /* istanbul ignore next */
    if (!maxFeePerGas || !maxPriorityFeePerGas) {
      throw new Error("Failed to get fee data from provider");
    }
    if (this.userOp.nonce === undefined) {
      // nonce 값은 entryPoint 의 getNonce(sender, nonceKey) 값으로 설정
      const entryPointContract = new ethers.Contract(
        this.entryPoint,
        ["function getNonce(address,uint192) view returns(uint256)"],
        this.provider
      );
      const nonce = await entryPointContract.getNonce(this.userOp.sender, nonceKey ?? 0n);
      this.userOp.nonce = ethers.toBeHex(nonce);
    }

    this.userOp.maxFeePerGas = ethers.toBeHex(maxFeePerGas);
    this.userOp.maxPriorityFeePerGas = ethers.toBeHex(maxPriorityFeePerGas);

    const estimatedCallGas = await this.estimateCallGasLimit();
    const estimatedCallGasBigInt = BigInt(estimatedCallGas);
    const MIN_CALL_GAS_LIMIT = 21000n;
    this.userOp.callGasLimit = ethers.toBeHex(
      estimatedCallGasBigInt < MIN_CALL_GAS_LIMIT ? MIN_CALL_GAS_LIMIT : estimatedCallGasBigInt
    );

    // preVerificationGas 계산에 packUserOp가 필요하므로 verificationGasLimit 임시값 설정
    if (!this.userOp.verificationGasLimit) {
      this.userOp.verificationGasLimit = ethers.toBeHex("1500000");
    }

    // [PATCH] Set defaults for fields needed by calculatePreVerificationGas → packUserOp → encodeUserOp
    if (!this.userOp.preVerificationGas) {
      this.userOp.preVerificationGas = "0x00";
    }
    if (!this.userOp.signature) {
      this.userOp.signature = "0x";
    }
    const preVerificationGas = this.calculatePreVerificationGas(
      this.userOp as UserOperation
    );
    this.userOp.preVerificationGas = ethers.toBeHex(preVerificationGas);
    let verificationGasLimit = 25000n;

    // verification 할 때 필요한 gas 계산 -> 각 키 타입에 따라 필요한 gas 를 사전에 정의한 값으로 설정
    if (this.userOp.initCode !== "0x" && this.userOp.initCode !== undefined) {
      const zkapFactory = ethers.dataSlice(this.userOp.initCode, 0, 20);
      const callData = ethers.dataSlice(this.userOp.initCode, 20);
      const walletCreationGasLimit = await this.provider.estimateGas({
        to: zkapFactory,
        data: callData,
        from: this.entryPoint,  // EntryPoint가 factory를 호출하므로
      });

      verificationGasLimit += BigInt(walletCreationGasLimit);
    }

    const keyTypes = this.signerKeyTypes;

    for (const keyType of keyTypes) {
      if (keyType === PrimitiveAccountKeyTypes.keyAddress) {
        verificationGasLimit += ZkapBuilder.ADDRESS_KEY_VALIDATION_GAS;
      } else if (keyType === PrimitiveAccountKeyTypes.keySecp256k1) {
        verificationGasLimit += ZkapBuilder.SECP256K1_KEY_VALIDATION_GAS;
      } else if (keyType === PrimitiveAccountKeyTypes.keySecp256r1) {
        verificationGasLimit += ZkapBuilder.SECP256R1_KEY_VALIDATION_GAS;
      } else if (keyType === PrimitiveAccountKeyTypes.keyWebAuthn) {
        verificationGasLimit += ZkapBuilder.WEB_AUTHN_KEY_VALIDATION_GAS;
      } else if (keyType === PrimitiveAccountKeyTypes.keyOAuthRS256) {
        verificationGasLimit += ZkapBuilder.OAUTH_RS256_KEY_VALIDATION_GAS;
      } else if (keyType === PrimitiveAccountKeyTypes.keyZkOAuthRS256) {
        verificationGasLimit += ZkapBuilder.ZK_OAUTH_RS256_KEY_VALIDATION_GAS;
      }
    }

    // make verificationGasLimit 20% more
    verificationGasLimit = (verificationGasLimit * ZkapBuilder.GAS_ESTIMATE_MULTIPLIER) / ZkapBuilder.GAS_ESTIMATE_DIVISOR;

    this.userOp.verificationGasLimit = ethers.toBeHex(verificationGasLimit);

    // Paymaster가 설정되어 있으면 paymaster 관련 데이터 자동 채우기
    if (this.paymasterService) {
      const MAX_PAYMASTER_PASSES = 3;
      for (let pass = 0; pass < MAX_PAYMASTER_PASSES; pass++) {
        await this.autoFillPaymasterData();
        const newPvg = this.calculatePreVerificationGas(this.userOp as UserOperation);
        const newPvgHex = ethers.toBeHex(newPvg);
        if (newPvgHex === this.userOp.preVerificationGas) {
          break; // preVerificationGas가 수렴됨
        }
        this.userOp.preVerificationGas = newPvgHex;
      }
    }

    return this;
  }

  /**
   * Paymaster 관련 데이터를 자동으로 채웁니다.
   * PaymasterService가 설정되어 있을 때만 호출됩니다.
   */
  private async autoFillPaymasterData(): Promise<void> {
    /* istanbul ignore next */
    if (!this.paymasterService) {
      // error throw
      throw new Error(
        "Paymaster service is not set. Please set a valid paymaster service."
      );
    }

    // Paymaster 검증 및 PostOp 가스 한도 설정
    this.userOp.paymasterVerificationGasLimit = ethers.toBeHex(
      this.paymasterService.estimatePaymasterVerificationGasLimit()
    );
    this.userOp.paymasterPostOpGasLimit = ethers.toBeHex(
      this.paymasterService.estimatePaymasterPostOpGasLimit()
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
      tokenAddress: paymaster.tokenAddress,
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

  setInitCode(
    zkapFactory: string,
    salt: ethers.BigNumberish,
    keys: { encodedMasterKey: string; encodedTxKey: string }
  ): this {
    if (!ethers.isAddress(zkapFactory)) {
      throw new Error(`setInitCode: invalid factory address: "${zkapFactory}"`);
    }
    const { encodedMasterKey, encodedTxKey } = keys;
    const callDataBuilder = new CallDataBuilder(ZkapAccountFactoryABI);

    const callData = callDataBuilder.encode("createAccount", [
      salt,
      encodedMasterKey,
      encodedTxKey,
    ]);

    const initCode = ethers.concat([zkapFactory, callData]);

    this.userOp.initCode = initCode;
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

  /**
   * tx key 업데이트 callData를 설정합니다.
   * @param encoded 인코딩된 키 데이터
   * @warning 이 메서드는 signerKeyTypes를 keyZkOAuthRS256으로 강제 설정합니다.
   *          이전에 setSignerKeyTypes()로 설정한 값은 무효화됩니다.
   *          키 업데이트 트랜잭션은 항상 ZK-OAuth RS256 서명이 필요합니다.
   */
  setUpdateTxKeyCallData(encoded: string): this {
    if (!this.userOp.sender) {
      throw new Error("Sender is not set");
    }
    const callDataBuilder = new CallDataBuilder(ZkapAccountABI);
    const callData = callDataBuilder.encode("updateTxKey", [encoded]);
    this.setCallDataInternal(callData);
    // 이 메서드는 키 업데이트 트랜잭션 전용이므로 signerKeyTypes를 keyZkOAuthRS256으로 강제 덮어씁니다.
    // 이전에 setSignerKeyTypes()로 설정한 값은 무효화됩니다.
    this.signerKeyTypes = [PrimitiveAccountKeyTypes.keyZkOAuthRS256];
    return this;
  }

  /**
   * master key 업데이트 callData를 설정합니다.
   * @param encoded 인코딩된 키 데이터
   * @warning 이 메서드는 signerKeyTypes를 keyZkOAuthRS256으로 강제 설정합니다.
   *          이전에 setSignerKeyTypes()로 설정한 값은 무효화됩니다.
   *          키 업데이트 트랜잭션은 항상 ZK-OAuth RS256 서명이 필요합니다.
   */
  setUpdateMasterKeyCallData(encoded: string): this {
    if (!this.userOp.sender) {
      throw new Error("Sender is not set");
    }
    const callDataBuilder = new CallDataBuilder(ZkapAccountABI);
    const callData = callDataBuilder.encode("updateMasterKey", [encoded]);
    this.setCallDataInternal(callData);
    // 이 메서드는 키 업데이트 트랜잭션 전용이므로 signerKeyTypes를 keyZkOAuthRS256으로 강제 덮어씁니다.
    // 이전에 setSignerKeyTypes()로 설정한 값은 무효화됩니다.
    this.signerKeyTypes = [PrimitiveAccountKeyTypes.keyZkOAuthRS256];
    return this;
  }

  /**
   * master key와 tx key를 동시에 업데이트하는 callData를 설정합니다.
   * @param encodedMasterKey 인코딩된 master key 데이터
   * @param encodedTxKey 인코딩된 tx key 데이터
   * @warning 이 메서드는 signerKeyTypes를 keyZkOAuthRS256으로 강제 설정합니다.
   *          이전에 setSignerKeyTypes()로 설정한 값은 무효화됩니다.
   *          키 업데이트 트랜잭션은 항상 ZK-OAuth RS256 서명이 필요합니다.
   */
  setUpdateKeysCallData(keys: { encodedMasterKey: string; encodedTxKey: string }): this {
    const { encodedMasterKey, encodedTxKey } = keys;
    if (!this.userOp.sender) {
      throw new Error("Sender is not set");
    }
    const callDataBuilder = new CallDataBuilder(ZkapAccountABI);
    const callData = callDataBuilder.encode("updateKeys", [
      encodedMasterKey,
      encodedTxKey,
    ]);
    this.setCallDataInternal(callData);
    // 이 메서드는 키 업데이트 트랜잭션 전용이므로 signerKeyTypes를 keyZkOAuthRS256으로 강제 덮어씁니다.
    // 이전에 setSignerKeyTypes()로 설정한 값은 무효화됩니다.
    this.signerKeyTypes = [PrimitiveAccountKeyTypes.keyZkOAuthRS256];
    return this;
  }

  /**
   * 내부용: signerKeyTypes 검증 없이 callData를 설정합니다.
   * setExecuteCallData, setExecuteBatchCallData 등 내부 메서드에서 사용합니다.
   */
  private setCallDataInternal(callData: string): void {
    this.userOp.callData = callData;
  }

  /**
   * execute callData를 설정합니다.
   * @note autoFillUserOp() 전에 반드시 setSignerKeyTypes()를 호출하여 서명 키 타입을 지정해야 합니다.
   *       미설정 시 verificationGasLimit이 과소 추정될 수 있습니다.
   */
  setExecuteCallData(
    contractAddress: string,
    value: ethers.BigNumberish,
    data: string
  ): this {
    const callDataBuilder = new CallDataBuilder(ZkapAccountABI);
    const useropCallData = callDataBuilder.encode("execute", [
      contractAddress,
      value,
      data,
    ]);

    this.setCallDataInternal(useropCallData);
    return this;
  }

  /**
   * executeBatch callData를 설정합니다.
   * @note autoFillUserOp() 전에 반드시 setSignerKeyTypes()를 호출하여 서명 키 타입을 지정해야 합니다.
   *       미설정 시 verificationGasLimit이 과소 추정될 수 있습니다.
   */
  setExecuteBatchCallData(
    contractAddresses: string[],
    values: ethers.BigNumberish[],
    data: string[]
  ): this {
    const callDataBuilder = new CallDataBuilder(ZkapAccountABI);
    const useropCallData = callDataBuilder.encode("executeBatch(address[],uint256[],bytes[])", [
      contractAddresses,
      values,
      data,
    ]);

    this.setCallDataInternal(useropCallData);
    return this;
  }

  setCallData(callData: string): this {
    if (!this.signerKeyTypes || this.signerKeyTypes.length === 0) {
      throw new Error(
        "Signer key types are not set. Please set a valid signer key types."
      );
    }
    super.setCallData(callData);
    return this;
  }

  setSignerKeyTypes(keyTypes: number[]): this {
    if (!Array.isArray(keyTypes) || keyTypes.length === 0) {
      throw new Error("keyTypes must be a non-empty array");
    }
    const validKeyTypes = new Set<number>([
      PrimitiveAccountKeyTypes.keyAddress,
      PrimitiveAccountKeyTypes.keySecp256k1,
      PrimitiveAccountKeyTypes.keySecp256r1,
      PrimitiveAccountKeyTypes.keyWebAuthn,
      PrimitiveAccountKeyTypes.keyOAuthRS256,
      PrimitiveAccountKeyTypes.keyZkOAuthRS256,
    ]);
    for (const kt of keyTypes) {
      if (!Number.isInteger(kt) || kt <= 0 || !validKeyTypes.has(kt)) {
        throw new Error(`Invalid keyType: ${kt}. Allowed values: ${[...validKeyTypes].join(", ")}`);
      }
    }
    this.signerKeyTypes = keyTypes;
    return this;
  }

  getUserOpHashForPaymaster(): string {
    const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();

    const userOpHash = ethers.keccak256(
      this.encodeUserOpForPaymaster(this.getPackedUserOp())
    );

    // entryPoint를 domain separator에 포함시켜 다른 EntryPoint로의 replay 방지
    const enc = defaultAbiCoder.encode(
      ["bytes32", "address", "uint256"],
      [userOpHash, this.entryPoint, this.chainId]
    );
    return ethers.keccak256(enc);
  }
}
