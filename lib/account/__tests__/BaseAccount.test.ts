/**
 * BaseAccount tests
 *
 * Abstract base account class
 */

import { BaseAccount } from '../BaseAccount';

// Concrete implementation for testing
class TestAccount extends BaseAccount {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async signUserOpHash(_userOpHash: string): Promise<string[]> {
    return ['0xsignature'];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendTransaction(_userOp: any): Promise<string> {
    return '0xtxhash';
  }

  async getNonce(): Promise<bigint> {
    return BigInt(42);
  }
}

describe('BaseAccount', () => {
  const mockAddress = '0x' + '11'.repeat(20);

  describe('constructor', () => {
    it('should store address', () => {
      const account = new TestAccount(mockAddress);
      expect(account.getAddress()).toBe(mockAddress);
    });
  });

  describe('getAddress', () => {
    it('should return the stored address', () => {
      const account = new TestAccount(mockAddress);
      expect(account.getAddress()).toBe(mockAddress);
    });

    it('should return different addresses for different accounts', () => {
      const account1 = new TestAccount('0x' + '11'.repeat(20));
      const account2 = new TestAccount('0x' + '22'.repeat(20));

      expect(account1.getAddress()).not.toBe(account2.getAddress());
    });
  });

  describe('abstract methods', () => {
    it('should implement signUserOpHash', async () => {
      const account = new TestAccount(mockAddress);
      const result = await account.signUserOpHash('0xhash');
      expect(result).toEqual(['0xsignature']);
    });

    it('should implement sendTransaction', async () => {
      const account = new TestAccount(mockAddress);
      const result = await account.sendTransaction({});
      expect(result).toBe('0xtxhash');
    });

    it('should implement getNonce', async () => {
      const account = new TestAccount(mockAddress);
      const result = await account.getNonce();
      expect(result).toBe(BigInt(42));
    });
  });
});
