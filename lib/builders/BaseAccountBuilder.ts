import { UserOperation, PackedUserOperation } from "../types/UserOperation";
import { ethers } from "ethers";

export abstract class BaseAccountBuilder {
  protected userOp: Partial<UserOperation> = {};
  protected chainId: number;
  protected entryPoint: string;

  abstract setInitCode(...initCodes: string[]): this;
  abstract setSignature(signature: any): this;

  constructor(chainId: number, entryPoint: string) {
    this.chainId = chainId;
    this.entryPoint = entryPoint;
  }

  protected applyDefaults(): void {
    const defaultValues: UserOperation = {
      sender: ethers.ZeroAddress,
      nonce: "",
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
      callData: userOp.callData,
      accountGasLimits,
      initCode: userOp.initCode,
      preVerificationGas: userOp.preVerificationGas,
      gasFees,
      paymasterAndData,
      signature: userOp.signature,
    };
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
}
