import { ethers } from "ethers";

export class CallDataBuilder {
  private contractInterface: ethers.Interface;

  constructor(abi: string | ethers.Fragment[]) {
    this.contractInterface = new ethers.Interface(abi);
  }

  /**
   * Generates callData for a specific contract method.
   * @param methodName - The contract method name.
   * @param params - Parameters to pass to the method.
   * @returns The encoded callData.
   */
  public encode(methodName: string, params: any[]): string {
    if (!this.contractInterface.getFunction(methodName)) {
      throw new Error(`Method ${methodName} not found in ABI.`);
    }
    return this.contractInterface.encodeFunctionData(methodName, params);
  }

  // TODO: @kaikookim 아래 decode 함수는 검증되지 않은 함수이므로, 테스트 후 사용해야 함
  /**
   * Decodes callData for a specific contract method.
   * @param methodName - The contract method name.
   * @param callData - The callData to decode.
   * @returns The decoded parameters.
   */
  public decode(methodName: string, callData: string): any[] {
    if (!this.contractInterface.getFunction(methodName)) {
      throw new Error(`Method ${methodName} not found in ABI.`);
    }
    return this.contractInterface.decodeFunctionData(methodName, callData);
  }
}
