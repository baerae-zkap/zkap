import { BaseAccount } from "./BaseAccount";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { ethers } from "ethers";
import EntryPoint from "../types/abi/EntryPoint.json";
import { PackedUserOperation } from "../types/UserOperation";

export class ZkapAccount extends BaseAccount {
  private signer: IUserOpSigner;
  private provider: ethers.JsonRpcProvider;
  private entryPoint: ethers.Contract;

  constructor(
    address: string,
    signer: IUserOpSigner,
    enUrl: string,
    entryPointAddress: string
  ) {
    super(address);
    if (!ethers.isAddress(entryPointAddress) || entryPointAddress === ethers.ZeroAddress) {
      throw new Error(`Invalid entryPointAddress: "${entryPointAddress}". Must be a non-zero Ethereum address.`);
    }
    this.signer = signer;
    try {
      new URL(enUrl);
    } catch {
      throw new Error(`Invalid enUrl: "${enUrl}". Must be a valid URL.`);
    }
    this.provider = new ethers.JsonRpcProvider(enUrl);
    this.entryPoint = new ethers.Contract(
      entryPointAddress,
      EntryPoint.abi,
      this.provider
    );
  }

  async signUserOpHash(opHash: string): Promise<string[]> {
    return this.signer.signUserOpHash(opHash);
  }

  async getNonce(nonceKey: bigint = 0n): Promise<bigint> {
    try {
      const nonce = await this.entryPoint.getNonce(this.address, nonceKey);
      return nonce;
    } catch (error) {
      throw Object.assign(
        new Error(
          `Failed to fetch nonce from entryPoint for account ${this.address} (nonceKey=${nonceKey.toString()}): ` +
          `${error instanceof Error ? error.message : String(error)}`
        ),
        { cause: error }
      );
    }
  }

  /**
   * ERC-4337 번들러에 UserOperation을 전송합니다.
   * @param packedUserOp 전송할 PackedUserOperation
   * @returns 번들러가 반환한 userOpHash (0x + 64 hex chars)
   */
  async sendTransaction(packedUserOp: PackedUserOperation): Promise<string> {
    const entryPointAddress = await this.entryPoint.getAddress();
    // ERC-4337 표준 번들러 RPC: eth_sendUserOperation
    // provider는 번들러 호환 엔드포인트여야 합니다
    const userOpHash = await this.provider.send("eth_sendUserOperation", [
      {
        sender: packedUserOp.sender,
        nonce: packedUserOp.nonce,
        initCode: packedUserOp.initCode,
        callData: packedUserOp.callData,
        accountGasLimits: packedUserOp.accountGasLimits,
        preVerificationGas: packedUserOp.preVerificationGas,
        gasFees: packedUserOp.gasFees,
        paymasterAndData: packedUserOp.paymasterAndData,
        signature: packedUserOp.signature,
      },
      entryPointAddress,
    ]);
    if (typeof userOpHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(userOpHash)) {
      throw new Error(`Bundler returned invalid userOpHash: ${userOpHash}`);
    }
    return userOpHash;
  }
}
