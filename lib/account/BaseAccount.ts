export abstract class BaseAccount {
  protected address: string;

  constructor(address: string) {
    this.address = address;
  }

  abstract signUserOpHash(userOpHash: string): Promise<string[]>;
  abstract sendTransaction(userOp: any): Promise<string>;
  abstract getNonce(): Promise<number>;

  getAddress(): string {
    return this.address;
  }
}
