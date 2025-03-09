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
}
