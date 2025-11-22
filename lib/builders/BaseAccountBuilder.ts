import { UserOperation, PackedUserOperation } from "../types/UserOperation";
import { ethers } from "ethers";

export abstract class BaseAccountBuilder {
  protected userOp: Partial<UserOperation> = {};
  protected chainId: number;
  protected entryPoint: string;
  protected provider?: ethers.JsonRpcProvider;

  abstract setInitCode(...initCodes: string[]): this;
  abstract setSignature(
    keyIndexList: number[],
    keySignatureList: string[]
  ): this;

  constructor(
    chainId: number,
    entryPoint: string,
    provider?: ethers.JsonRpcProvider
  ) {
    this.chainId = chainId;
    this.entryPoint = entryPoint;
    this.provider = provider;
  }

  protected applyDefaults(): void {
    const defaultValues: UserOperation = {
      sender: ethers.ZeroAddress,
      nonce: ethers.toBeHex("0"),
      initCode: "0x",
      callData: "0x",
      callGasLimit: "0x00",
      verificationGasLimit: ethers.toBeHex("1500000"),
      preVerificationGas: ethers.toBeHex("210000"),
      maxFeePerGas: "0x00",
      maxPriorityFeePerGas: ethers.toBeHex("1000000000"),
      paymaster: ethers.ZeroAddress,
      paymasterData: "0x",
      paymasterVerificationGasLimit: "0x00",
      paymasterPostOpGasLimit: "0x00",
      signature: "0x",
    };

    this.userOp = { ...defaultValues, ...this.userOp };
  }

  encodeUserOpForPaymaster(packedUserOp: PackedUserOperation): string {
    const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();
    return defaultAbiCoder.encode(
      [
        "address",
        "uint256",
        "bytes32",
        "uint256",
        "bytes32",
        "bytes32",
        "bytes32",
        "bytes32",
      ],
      [
        packedUserOp.sender,
        packedUserOp.nonce,
        packedUserOp.accountGasLimits,
        packedUserOp.preVerificationGas,
        packedUserOp.gasFees,
        ethers.keccak256(packedUserOp.initCode),
        ethers.keccak256(packedUserOp.callData),
        ethers.keccak256(packedUserOp.paymasterAndData.slice(0, -130)),
      ]
    );
  }

  encodeUserOp(packedUserOp: PackedUserOperation, forSignature = true): string {
    const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();
    if (forSignature) {
      return defaultAbiCoder.encode(
        [
          "address",
          "uint256",
          "bytes32",
          "bytes32",
          "bytes32",
          "uint256",
          "bytes32",
          "bytes32",
        ],
        [
          packedUserOp.sender,
          packedUserOp.nonce,
          ethers.keccak256(packedUserOp.initCode),
          ethers.keccak256(packedUserOp.callData),
          packedUserOp.accountGasLimits,
          packedUserOp.preVerificationGas,
          packedUserOp.gasFees,
          ethers.keccak256(packedUserOp.paymasterAndData),
        ]
      );
    } else {
      // for the purpose of calculating gas cost encode also signature (and no keccak of bytes)
      return defaultAbiCoder.encode(
        [
          "address",
          "uint256",
          "bytes",
          "bytes",
          "bytes32",
          "uint256",
          "bytes32",
          "bytes",
          "bytes",
        ],
        [
          packedUserOp.sender,
          packedUserOp.nonce,
          packedUserOp.initCode,
          packedUserOp.callData,
          packedUserOp.accountGasLimits,
          packedUserOp.preVerificationGas,
          packedUserOp.gasFees,
          packedUserOp.paymasterAndData,
          packedUserOp.signature,
        ]
      );
    }
  }

  packAccountGasLimits(
    verificationGasLimit: string,
    callGasLimit: string
  ): string {
    return ethers.concat([
      ethers.zeroPadValue(ethers.hexlify(verificationGasLimit), 16),
      ethers.zeroPadValue(ethers.hexlify(callGasLimit), 16),
    ]);
  }

  packPaymasterData(
    paymaster: string,
    paymasterVerificationGasLimit: string,
    postOpGasLimit: string,
    paymasterData: string
  ): string {
    return ethers.concat([
      paymaster,
      ethers.zeroPadValue(ethers.hexlify(paymasterVerificationGasLimit), 16),
      ethers.zeroPadValue(ethers.hexlify(postOpGasLimit), 16),
      paymasterData,
    ]);
  }

  packUserOp(userOp: UserOperation): PackedUserOperation {
    const accountGasLimits = this.packAccountGasLimits(
      userOp.verificationGasLimit,
      userOp.callGasLimit
    );
    const gasFees = this.packAccountGasLimits(
      userOp.maxPriorityFeePerGas,
      userOp.maxFeePerGas
    );
    let paymasterAndData = "0x";
    if (
      userOp.paymaster?.length >= 20 &&
      userOp.paymaster !== ethers.ZeroAddress
    ) {
      paymasterAndData = this.packPaymasterData(
        userOp.paymaster as string,
        userOp.paymasterVerificationGasLimit,
        userOp.paymasterPostOpGasLimit,
        userOp.paymasterData as string
      );
    }
    return {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: userOp.initCode,
      callData: userOp.callData,
      accountGasLimits,
      preVerificationGas: userOp.preVerificationGas,
      gasFees,
      paymasterAndData,
      signature: userOp.signature,
    };
  }

  setUserOp(userOp: UserOperation): this {
    this.userOp = userOp;
    return this;
  }

  setSender(sender: string): this {
    this.userOp.sender = sender;
    return this;
  }

  setNonce(nonce: string): this {
    this.userOp.nonce = nonce;
    return this;
  }

  setCallData(callData: string): this {
    this.userOp.callData = callData;
    return this;
  }

  setCallGasLimit(callGasLimit: string): this {
    this.userOp.callGasLimit = callGasLimit;
    return this;
  }

  setVerificationGasLimit(verificationGasLimit: string): this {
    this.userOp.verificationGasLimit = verificationGasLimit;
    return this;
  }

  setPreVerificationGas(preVerificationGas: string): this {
    this.userOp.preVerificationGas = preVerificationGas;
    return this;
  }

  setMaxFeePerGas(maxFeePerGas: string): this {
    this.userOp.maxFeePerGas = maxFeePerGas;
    return this;
  }

  setMaxPriorityFeePerGas(maxPriorityFeePerGas: string): this {
    this.userOp.maxPriorityFeePerGas = maxPriorityFeePerGas;
    return this;
  }

  setPaymaster(paymaster: string): this {
    this.userOp.paymaster = paymaster;
    return this;
  }

  setPaymasterData(paymasterData: string): this {
    this.userOp.paymasterData = paymasterData;
    return this;
  }

  setPaymasterVerificationGasLimit(
    paymasterVerificationGasLimit: string
  ): this {
    this.userOp.paymasterVerificationGasLimit = paymasterVerificationGasLimit;
    return this;
  }

  setPaymasterPostOpGasLimit(paymasterPostOpGasLimit: string): this {
    this.userOp.paymasterPostOpGasLimit = paymasterPostOpGasLimit;
    return this;
  }

  getUserOp(): UserOperation {
    this.applyDefaults(); // 기본값 적용

    if (!this.userOp.sender) {
      console.log(this.userOp);
      throw new Error("Required fields are missing");
    }

    return this.userOp as UserOperation;
  }

  getPackedUserOp(): PackedUserOperation {
    return this.packUserOp(this.getUserOp());
  }

  getUserOpHash(): string {
    const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();
    const userOpHash = ethers.keccak256(
      this.encodeUserOp(this.getPackedUserOp(), true)
    );
    const enc = defaultAbiCoder.encode(
      ["bytes32", "address", "uint256"],
      [userOpHash, this.entryPoint, this.chainId]
    );
    return ethers.keccak256(enc);
  }

  // TODO: @kaikookim 여기 아래 함수들은 검증되지 않은 함수이므로, 테스트 후 사용해야 함
  // estimateUserOpGasCost, calculatePreVerificationGas, estimateVerificationGas, estimateCallGas, estimatePaymasterGas, generateDummySignature
  /**
   * UserOperation의 가스 비용을 추정합니다.
   * EntryPoint의 simulateValidation과 simulateHandleOp을 사용하여 가스를 추정합니다.
   * @param userOp 추정할 UserOperation
   * @returns 추정된 가스 비용 (wei 단위)
   */
  async estimateUserOpGasCost(userOp: UserOperation): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider is required for gas estimation");
    }

    try {
      // 1. preVerificationGas 계산
      const preVerificationGas = this.calculatePreVerificationGas(userOp);

      // 2. verificationGasLimit 추정
      const verificationGasLimit = await this.estimateVerificationGas(userOp);

      // 3. callGasLimit 추정
      const callGasLimit = await this.estimateCallGas(userOp);

      // 4. paymaster gas 추정 (paymaster가 있는 경우)
      let paymasterVerificationGasLimit = BigInt(0);
      let paymasterPostOpGasLimit = BigInt(0);

      if (userOp.paymaster && userOp.paymaster !== ethers.ZeroAddress) {
        const paymasterGas = await this.estimatePaymasterGas(userOp);
        paymasterVerificationGasLimit = paymasterGas.verification;
        paymasterPostOpGasLimit = paymasterGas.postOp;
      }

      // 5. 총 가스 계산
      const totalGas =
        preVerificationGas +
        verificationGasLimit +
        callGasLimit +
        paymasterVerificationGasLimit +
        paymasterPostOpGasLimit;

      // 6. 가스 가격 가져오기
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(0);

      // 7. 총 비용 계산 (가스 * 가스가격)
      const totalCost = totalGas * gasPrice;

      return totalCost.toString();
    } catch (error) {
      throw new Error(`Failed to estimate gas cost: ${error}`);
    }
  }

  /**
   * preVerificationGas를 계산합니다.
   * @param userOp UserOperation
   * @returns preVerificationGas
   */
  private calculatePreVerificationGas(userOp: UserOperation): bigint {
    // 기본 preVerificationGas
    let preVerificationGas = BigInt(21000);

    // calldata 비용 추가
    const packedUserOp = this.packUserOp(userOp);
    const encodedUserOp = this.encodeUserOp(packedUserOp, false);
    const calldataLength = (encodedUserOp.length - 2) / 2; // 0x 제외하고 바이트 수
    preVerificationGas += BigInt(calldataLength * 16); // 16 gas per byte

    // initCode가 있는 경우 추가 비용
    if (userOp.initCode && userOp.initCode !== "0x") {
      const initCodeLength = (userOp.initCode.length - 2) / 2;
      preVerificationGas += BigInt(initCodeLength * 200); // 200 gas per byte for initCode
    }

    return preVerificationGas;
  }

  /**
   * verificationGasLimit을 추정합니다.
   * @param userOp UserOperation
   * @returns verificationGasLimit
   */
  private async estimateVerificationGas(
    userOp: UserOperation
  ): Promise<bigint> {
    if (!this.provider) {
      throw new Error("Provider is required for verification gas estimation");
    }

    try {
      // EntryPoint의 simulateValidation 호출
      const entryPointInterface = new ethers.Interface([
        "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes,bytes)) external returns (ValidationResult)",
      ]);

      const packedUserOp = this.packUserOp(userOp);
      const callData = entryPointInterface.encodeFunctionData(
        "simulateValidation",
        [packedUserOp]
      );

      const gasEstimate = await this.provider.estimateGas({
        to: this.entryPoint,
        data: callData,
      });

      // 20% 여유분 추가
      return (gasEstimate * BigInt(120)) / BigInt(100);
    } catch (error) {
      // 추정 실패 시 기본값 사용
      console.warn("Verification gas estimation failed, using default:", error);
      return BigInt(150000);
    }
  }

  /**
   * callGasLimit을 추정합니다.
   * @param userOp UserOperation
   * @returns callGasLimit
   */
  private async estimateCallGas(userOp: UserOperation): Promise<bigint> {
    if (!this.provider) {
      throw new Error("Provider is required for call gas estimation");
    }

    try {
      // callData가 있는 경우에만 추정
      if (!userOp.callData || userOp.callData === "0x") {
        return BigInt(0);
      }

      // EntryPoint의 simulateHandleOp 호출
      const entryPointInterface = new ethers.Interface([
        "function simulateHandleOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes,bytes),address,bytes) external",
      ]);

      const packedUserOp = this.packUserOp(userOp);
      const callData = entryPointInterface.encodeFunctionData(
        "simulateHandleOp",
        [packedUserOp, userOp.sender, "0x"]
      );

      const gasEstimate = await this.provider.estimateGas({
        to: this.entryPoint,
        data: callData,
      });

      // 20% 여유분 추가
      return (gasEstimate * BigInt(120)) / BigInt(100);
    } catch (error) {
      // 추정 실패 시 기본값 사용
      console.warn("Call gas estimation failed, using default:", error);
      return BigInt(100000);
    }
  }

  /**
   * paymaster gas를 추정합니다.
   * @param userOp UserOperation
   * @returns paymaster gas 정보
   */
  private async estimatePaymasterGas(userOp: UserOperation): Promise<{
    verification: bigint;
    postOp: bigint;
  }> {
    if (!this.provider || !userOp.paymaster) {
      return { verification: BigInt(0), postOp: BigInt(0) };
    }

    try {
      // paymaster의 validatePaymasterUserOp 호출
      const paymasterInterface = new ethers.Interface([
        "function validatePaymasterUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes,bytes),bytes32,uint256) external returns (bytes memory, uint256)",
      ]);

      const packedUserOp = this.packUserOp(userOp);
      const userOpHash = this.getUserOpHash();
      const callData = paymasterInterface.encodeFunctionData(
        "validatePaymasterUserOp",
        [packedUserOp, userOpHash, BigInt(0)]
      );

      const gasEstimate = await this.provider.estimateGas({
        to: userOp.paymaster,
        data: callData,
      });

      // 20% 여유분 추가
      const verificationGas = (gasEstimate * BigInt(120)) / BigInt(100);

      // postOp gas는 일반적으로 작은 값
      const postOpGas = BigInt(5000);

      return {
        verification: verificationGas,
        postOp: postOpGas,
      };
    } catch (error) {
      // 추정 실패 시 기본값 사용
      console.warn("Paymaster gas estimation failed, using default:", error);
      return {
        verification: BigInt(100000),
        postOp: BigInt(5000),
      };
    }
  }

  /**
   * 가스 추정을 위한 더미 서명을 생성합니다.
   * @returns 더미 서명
   */
  private generateDummySignature(): string {
    // ZkapAccount의 더미 서명 (65바이트)
    // 실제 서명과 유사한 형태로 생성
    return "0x" + "ff".repeat(32) + "00".repeat(32) + "01";
  }
}
