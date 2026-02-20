export interface IUserOpSigner {
  keyTypes: number[];
  signUserOpHash(userOpHash: string): Promise<string[]>;
}
