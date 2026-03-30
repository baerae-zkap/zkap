import { UserOperation, PackedUserOperation } from "../types/UserOperation";
import { ethers } from "ethers";

export abstract class BaseAccountBuilder {
  /** 가스 추정치에 20% 여유분을 더하기 위한 승수 (120/100 = 1.2배) */
  protected static readonly GAS_ESTIMATE_MULTIPLIER = BigInt(120);
  protected static readonly GAS_ESTIMATE_DIVISOR = BigInt(100);
  /** minimum paymasterAndData hex length: (20 + 16 + 16 + 65) * 2 + 2("0x") = 236 */
  protected static readonly PAYMASTER_AND_DATA_MIN_HEX_LENGTH = 236;
  /** paymaster postOp 가스 기본값: ERC-4337 일반적인 postOp 작업(토큰 이체 등)의 경험적 하한값 */
  protected static readonly DEFAULT_PAYMASTER_POST_OP_GAS = BigInt(5000);
  protected userOp: Partial<UserOperation> = {};
  protected chainId: number;
  protected entryPoint: string;
  protected provider?: ethers.JsonRpcProvider;

  abstract setInitCode(...args: unknown[]): this;
  abstract setSignature(
    keyIndexList: number[],
    keySignatureList: string[]
  ): this;

  constructor(
    chainId: number,
    entryPoint: string,
    provider?: ethers.JsonRpcProvider
  ) {
    if (!Number.isInteger(chainId) || chainId <= 0) {
      throw new Error(`Invalid chainId: ${chainId}. Must be a positive integer.`);
    }
    if (!ethers.isAddress(entryPoint) || entryPoint === ethers.ZeroAddress) {
      throw new Error(`Invalid entryPoint address: "${entryPoint}". Must be a non-zero Ethereum address.`);
    }
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

  /**
   * Paymaster용 UserOperation 해시 계산을 위해 UserOp을 ABI 인코딩합니다.
   * @requires 이 메서드 호출 전 autoFillUserOp()이 완료되어야 합니다.
   *           미완료 시 paymasterAndData가 올바르지 않아 잘못된 해시가 계산될 수 있습니다.
   * @param packedUserOp 인코딩할 PackedUserOperation
   * @param paymasterSigBytes paymaster 서명 바이트 수 (기본값 65)
   * @returns ABI 인코딩된 UserOperation 문자열
   */
  encodeUserOpForPaymaster(packedUserOp: PackedUserOperation, paymasterSigBytes: number = 65): string {
    if (!Number.isInteger(paymasterSigBytes) || paymasterSigBytes < 1 || paymasterSigBytes > 256) {
      throw new Error(`Invalid paymasterSigBytes: ${paymasterSigBytes}. Must be an integer between 1 and 256.`);
    }
    const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();
    const PAYMASTER_SIG_BYTES = paymasterSigBytes;
    const _PAYMASTER_SIG_HEX_LENGTH = PAYMASTER_SIG_BYTES * 2; // eslint-disable-line @typescript-eslint/no-unused-vars
    // minimum valid payload: paymaster addr(20) + verifyGasLimit(16) + postOpGasLimit(16) + sig(65) = 117 bytes
    // hex representation: 117 * 2 + 2("0x" prefix) = 236 chars
    // Changed from <= PAYMASTER_SIG_HEX_LENGTH + 2 to < 236 to correctly enforce the minimum
    // valid structure (paymaster header + signature). The old condition could reject valid
    // paymasterAndData that is exactly PAYMASTER_SIG_HEX_LENGTH + 2 chars long.
    // 236 = (paymaster_addr(20) + verifyGasLimit(16) + postOpGasLimit(16) + sig(65)) * 2 hex chars + 2 ("0x")
    if (packedUserOp.paymasterAndData.length < BaseAccountBuilder.PAYMASTER_AND_DATA_MIN_HEX_LENGTH) {
      // "0x" prefix(2) + 최소 sig 길이 미만이면 서명 영역이 없는 것
      throw new Error(
        `paymasterAndData too short to contain signature: length=${packedUserOp.paymasterAndData.length}, expected at least ${BaseAccountBuilder.PAYMASTER_AND_DATA_MIN_HEX_LENGTH}`
      );
    }
    // paymasterAndData = paymaster_addr(20) + verifyGasLimit(16) + postOpGasLimit(16) + paymasterData
    // paymasterData 끝 PAYMASTER_SIG_BYTES 바이트가 서명. 모드 무관하게 서명은 항상 마지막에 위치.
    // C-1: ethers.dataSlice는 byte 단위로 슬라이스 (64-bit 안전)
    const totalBytes = (packedUserOp.paymasterAndData.length - 2) / 2;
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
        ethers.keccak256(ethers.dataSlice(packedUserOp.paymasterAndData, 0, totalBytes - PAYMASTER_SIG_BYTES)),
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

  packGasFees(
    maxPriorityFeePerGas: string,
    maxFeePerGas: string
  ): string {
    return ethers.concat([
      ethers.zeroPadValue(ethers.hexlify(maxPriorityFeePerGas), 16),
      ethers.zeroPadValue(ethers.hexlify(maxFeePerGas), 16),
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
    const gasFees = this.packGasFees(
      userOp.maxPriorityFeePerGas,
      userOp.maxFeePerGas
    );
    let paymasterAndData = "0x";
    if (
      userOp.paymaster &&
      ethers.isAddress(userOp.paymaster) &&
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
    if (!ethers.isAddress(sender)) {
      throw new Error(`setSender: invalid Ethereum address: "${sender}"`);
    }
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
    if (!ethers.isAddress(paymaster)) {
      throw new Error(`setPaymaster: invalid Ethereum address: "${paymaster}"`);
    }
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
    this.applyDefaults(); // 설정되지 않은 필드에만 기본값 적용 (기존 값 보존)

    if (!this.userOp.sender || !ethers.isAddress(this.userOp.sender) || this.userOp.sender === ethers.ZeroAddress) {
      throw new Error("Sender is not set or is zero address. Please set a valid sender address.");
    }

    return this.userOp as UserOperation;
  }

  getPackedUserOp(): PackedUserOperation {
    return this.packUserOp(this.getUserOp());
  }

  getUserOpHash(): string {
    const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();
    const packed = this.getPackedUserOp();

    // 1. PACKED_USEROP_TYPEHASH (EntryPoint v0.9)
    const PACKED_USEROP_TYPEHASH = ethers.keccak256(
      ethers.toUtf8Bytes(
        "PackedUserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData)"
      )
    );

    // 2. Struct hash (includes TypeHash as first param)
    const structHash = ethers.keccak256(
      defaultAbiCoder.encode(
        ["bytes32", "address", "uint256", "bytes32", "bytes32", "bytes32", "uint256", "bytes32", "bytes32"],
        [
          PACKED_USEROP_TYPEHASH,
          packed.sender,
          packed.nonce,
          ethers.keccak256(packed.initCode),
          ethers.keccak256(packed.callData),
          packed.accountGasLimits,
          packed.preVerificationGas,
          packed.gasFees,
          ethers.keccak256(packed.paymasterAndData),
        ]
      )
    );

    // 3. EIP-712 Domain Separator (name="ERC4337", version="1")
    const EIP712_DOMAIN_TYPEHASH = ethers.keccak256(
      ethers.toUtf8Bytes(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
      )
    );
    const domainSeparator = ethers.keccak256(
      defaultAbiCoder.encode(
        ["bytes32", "bytes32", "bytes32", "uint256", "address"],
        [
          EIP712_DOMAIN_TYPEHASH,
          ethers.keccak256(ethers.toUtf8Bytes("ERC4337")),
          ethers.keccak256(ethers.toUtf8Bytes("1")),
          this.chainId,
          this.entryPoint,
        ]
      )
    );

    // 4. EIP-712 final hash
    return ethers.keccak256(
      ethers.solidityPacked(
        ["bytes1", "bytes1", "bytes32", "bytes32"],
        ["0x19", "0x01", domainSeparator, structHash]
      )
    );
  }

  /**
   * UserOperation의 가스 비용을 추정합니다.
   * EntryPoint의 simulateValidation과 simulateHandleOp을 사용하여 가스를 추정합니다.
   * @experimental 이 메서드는 검증되지 않았습니다.
   * @note ERC-4337 v0.7에서 simulateValidation은 ValidationResult revert로 응답하므로
   *       estimateGas 기반 검증 가스 추정이 실제로 동작하지 않습니다.
   *       테스트 후 사용하세요.
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
      const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? BigInt(0);
      if (gasPrice === BigInt(0)) {

      }

      // 7. 총 비용 계산 (가스 * 가스가격)
      const totalCost = totalGas * gasPrice;

      return totalCost.toString();
    } catch (error) {
      throw Object.assign(
        new Error(`Failed to estimate gas cost: ${error instanceof Error ? error.message : error}`),
        { cause: error }
      );
    }
  }

  /**
   * preVerificationGas를 계산합니다.
   * @param userOp UserOperation
   * @returns preVerificationGas
   */
  protected calculatePreVerificationGas(userOp: UserOperation): bigint {
    // 기본 preVerificationGas (ZK proof signature overhead 반영)
    let preVerificationGas = BigInt(30000);

    // handleOps() ABI 인코딩 오버헤드 (함수 셀렉터 4B + 배열 offset/length 64B + beneficiary 32B + 구조체 오버헤드)
    const HANDLE_OPS_OVERHEAD_GAS = BigInt(2000);
    preVerificationGas += HANDLE_OPS_OVERHEAD_GAS;

    // calldata 비용 추가
    const packedUserOp = this.packUserOp(userOp);
    const encodedUserOp = this.encodeUserOp(packedUserOp, false);
    // EIP-2028: zero byte = 4 gas, non-zero byte = 16 gas
    const encodedBytes = ethers.getBytes(encodedUserOp);
    let calldataCost = BigInt(0);
    for (const byte of encodedBytes) {
      calldataCost += byte === 0 ? BigInt(4) : BigInt(16);
    }
    calldataCost = calldataCost * BigInt(130) / BigInt(100); // 30% buffer for ZK proof calldata
    preVerificationGas += calldataCost;

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
    /* istanbul ignore next */
    if (!this.provider) {
      throw new Error("Provider is required for verification gas estimation");
    }

    try {
      // EntryPoint의 simulateValidation 호출
      const entryPointInterface = new ethers.Interface([
        "function simulateValidation((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes)) external",
      ]);

      const packed = this.packUserOp(userOp);
      const packedArray = [
        packed.sender,
        packed.nonce,
        packed.initCode,
        packed.callData,
        packed.accountGasLimits,
        packed.preVerificationGas,
        packed.gasFees,
        packed.paymasterAndData,
        packed.signature,
      ];
      const callData = entryPointInterface.encodeFunctionData(
        "simulateValidation",
        [packedArray]
      );

      /* istanbul ignore next */
      const gasEstimate = await this.provider.estimateGas({
        to: this.entryPoint,
        data: callData,
      });

      // 20% 여유분 추가
      /* istanbul ignore next */
      return (gasEstimate * BaseAccountBuilder.GAS_ESTIMATE_MULTIPLIER) / BaseAccountBuilder.GAS_ESTIMATE_DIVISOR;
    } catch (error) {
      throw Object.assign(
        new Error(`Verification gas estimation failed: ${error instanceof Error ? error.message : error}`),
        { cause: error }
      );
    }
  }

  /**
   * callGasLimit을 추정합니다.
   * @param userOp UserOperation
   * @returns callGasLimit
   */
  private async estimateCallGas(userOp: UserOperation): Promise<bigint> {
    /* istanbul ignore next */
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
        "function simulateHandleOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),address,bytes) external",
      ]);

      const packed = this.packUserOp(userOp);
      const packedArray = [
        packed.sender,
        packed.nonce,
        packed.initCode,
        packed.callData,
        packed.accountGasLimits,
        packed.preVerificationGas,
        packed.gasFees,
        packed.paymasterAndData,
        packed.signature,
      ];
      const callData = entryPointInterface.encodeFunctionData(
        "simulateHandleOp",
        [packedArray, userOp.sender, "0x"]
      );

      /* istanbul ignore next */
      const gasEstimate = await this.provider.estimateGas({
        to: this.entryPoint,
        data: callData,
      });

      // 20% 여유분 추가
      /* istanbul ignore next */
      return (gasEstimate * BaseAccountBuilder.GAS_ESTIMATE_MULTIPLIER) / BaseAccountBuilder.GAS_ESTIMATE_DIVISOR;
    } catch (error) {
      /* istanbul ignore next */
      throw Object.assign(
        new Error(`Call gas estimation failed: ${error instanceof Error ? error.message : error}`),
        { cause: error }
      );
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
    /* istanbul ignore next */
    if (!this.provider || !userOp.paymaster) {
      return { verification: BigInt(0), postOp: BigInt(0) };
    }

    try {
      // paymaster의 validatePaymasterUserOp 호출
      const paymasterInterface = new ethers.Interface([
        "function validatePaymasterUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),bytes32,uint256) external returns (bytes memory, uint256)",
      ]);

      const packed = this.packUserOp(userOp);
      const packedArray = [
        packed.sender,
        packed.nonce,
        packed.initCode,
        packed.callData,
        packed.accountGasLimits,
        packed.preVerificationGas,
        packed.gasFees,
        packed.paymasterAndData,
        packed.signature,
      ];
      const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();
      const innerHash = ethers.keccak256(
        this.encodeUserOp(packed, true)
      );
      const userOpHash = ethers.keccak256(
        defaultAbiCoder.encode(
          ["bytes32", "address", "uint256"],
          [innerHash, this.entryPoint, this.chainId]
        )
      );
      const callData = paymasterInterface.encodeFunctionData(
        "validatePaymasterUserOp",
        [packedArray, userOpHash, BigInt(0)]
      );

      /* istanbul ignore next */
      const gasEstimate = await this.provider.estimateGas({
        to: userOp.paymaster,
        data: callData,
      });

      // 20% 여유분 추가
      /* istanbul ignore next */
      const verificationGas = (gasEstimate * BaseAccountBuilder.GAS_ESTIMATE_MULTIPLIER) / BaseAccountBuilder.GAS_ESTIMATE_DIVISOR;

      // postOp gas는 일반적으로 작은 값
      /* istanbul ignore next */
      const postOpGas = BaseAccountBuilder.DEFAULT_PAYMASTER_POST_OP_GAS;

      /* istanbul ignore next */
      return {
        verification: verificationGas,
        postOp: postOpGas,
      };
    /* istanbul ignore next */
    } catch (error) {
      throw Object.assign(
        new Error(`Paymaster gas estimation failed: ${error instanceof Error ? error.message : error}`),
        { cause: error }
      );
    }
  }

}
