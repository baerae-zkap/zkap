export interface IUserOpSigner {
  signUserOpHash(userOpHash: string): Promise<string[]>;
}
