export interface IUserOpSigner {
  readonly keyTypes: number[];
  signUserOpHash(userOpHash: string): Promise<string[]>;
}
