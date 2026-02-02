/**
 * ZkapAccount 테스트
 *
 * ZKAP 스마트 계정 구현
 */

// Mock ethers before imports
const mockGetNonce = jest.fn();
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
    Contract: jest.fn().mockImplementation(() => ({
      getNonce: mockGetNonce,
    })),
  },
}));

// Mock EntryPoint ABI
jest.mock('../../types/abi/EntryPoint.json', () => ({ abi: [] }), { virtual: true });

import { ZkapAccount } from '../ZkapAccount';
import { IUserOpSigner } from '../../utils/IUserOpSigner';

describe('ZkapAccount', () => {
  const mockAddress = '0x' + '11'.repeat(20);
  const mockEnUrl = 'http://localhost:8545';
  const mockEntryPointAddress = '0x' + '22'.repeat(20);
  let mockSigner: jest.Mocked<IUserOpSigner>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSigner = {
      signUserOpHash: jest.fn().mockResolvedValue(['0xSignature1', '0xSignature2']),
    };
  });

  describe('constructor', () => {
    it('should create instance with required parameters', () => {
      const account = new ZkapAccount(
        mockAddress,
        mockSigner,
        mockEnUrl,
        mockEntryPointAddress
      );

      expect(account).toBeInstanceOf(ZkapAccount);
      expect(account.getAddress()).toBe(mockAddress);
    });
  });

  describe('signUserOpHash', () => {
    it('should delegate signing to signer', async () => {
      const account = new ZkapAccount(
        mockAddress,
        mockSigner,
        mockEnUrl,
        mockEntryPointAddress
      );

      const opHash = '0x' + 'ab'.repeat(32);
      const result = await account.signUserOpHash(opHash);

      expect(mockSigner.signUserOpHash).toHaveBeenCalledWith(opHash);
      expect(result).toEqual(['0xSignature1', '0xSignature2']);
    });

    it('should propagate signer errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Signing failed');
      mockSigner.signUserOpHash.mockRejectedValueOnce(error);

      const account = new ZkapAccount(
        mockAddress,
        mockSigner,
        mockEnUrl,
        mockEntryPointAddress
      );

      await expect(account.signUserOpHash('0xhash')).rejects.toThrow('Signing failed');
      expect(consoleSpy).toHaveBeenCalledWith(error);

      consoleSpy.mockRestore();
    });
  });

  describe('getNonce', () => {
    it('should fetch nonce from entryPoint contract', async () => {
      mockGetNonce.mockResolvedValueOnce(BigInt(5));

      const account = new ZkapAccount(
        mockAddress,
        mockSigner,
        mockEnUrl,
        mockEntryPointAddress
      );

      const nonce = await account.getNonce();

      expect(mockGetNonce).toHaveBeenCalledWith(mockAddress, 0);
      expect(nonce).toBe(BigInt(5));
    });

    it('should return different nonces', async () => {
      mockGetNonce
        .mockResolvedValueOnce(BigInt(1))
        .mockResolvedValueOnce(BigInt(10));

      const account = new ZkapAccount(
        mockAddress,
        mockSigner,
        mockEnUrl,
        mockEntryPointAddress
      );

      const nonce1 = await account.getNonce();
      const nonce2 = await account.getNonce();

      expect(nonce1).toBe(BigInt(1));
      expect(nonce2).toBe(BigInt(10));
    });
  });

  describe('sendTransaction', () => {
    it('should throw not implemented error', async () => {
      const account = new ZkapAccount(
        mockAddress,
        mockSigner,
        mockEnUrl,
        mockEntryPointAddress
      );

      const mockUserOp = {
        sender: mockAddress,
        nonce: '0x1',
        initCode: '0x',
        callData: '0x',
        accountGasLimits: '0x',
        preVerificationGas: '0x',
        gasFees: '0x',
        paymasterAndData: '0x',
        signature: '0x',
      };

      await expect(account.sendTransaction(mockUserOp))
        .rejects.toThrow('Method not implemented.');
    });
  });

  describe('getAddress', () => {
    it('should return account address', () => {
      const account = new ZkapAccount(
        mockAddress,
        mockSigner,
        mockEnUrl,
        mockEntryPointAddress
      );

      expect(account.getAddress()).toBe(mockAddress);
    });
  });
});
