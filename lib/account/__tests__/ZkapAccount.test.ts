/**
 * ZkapAccount tests
 *
 * ZKAP smart account implementation
 */

// Mock ethers before imports
const mockGetNonce = jest.fn();
const mockGetAddress = jest.fn();
const mockProviderSend = jest.fn();
jest.mock('ethers', () => ({
  ethers: {
    ZeroAddress: '0x0000000000000000000000000000000000000000',
    isAddress: jest.fn().mockReturnValue(true),
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      send: mockProviderSend,
    })),
    Contract: jest.fn().mockImplementation(() => ({
      getNonce: mockGetNonce,
      getAddress: mockGetAddress,
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
    mockGetNonce.mockReset();
    mockGetAddress.mockReset();
    mockProviderSend.mockReset();
    mockSigner = {
      keyTypes: [1],
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

    it('should throw when address is invalid', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mockEthers = require('ethers');
      mockEthers.ethers.isAddress.mockReturnValueOnce(false);
      expect(() => new ZkapAccount(
        'not-an-address',
        mockSigner,
        mockEnUrl,
        mockEntryPointAddress
      )).toThrow('Invalid account address');
    });

    it('should throw when entryPointAddress is invalid', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mockEthers = require('ethers');
      mockEthers.ethers.isAddress
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      expect(() => new ZkapAccount(
        mockAddress,
        mockSigner,
        mockEnUrl,
        'not-an-entrypoint'
      )).toThrow('Invalid entryPointAddress');
    });

    it('should throw when enUrl is not a valid URL', () => {
      expect(() => new ZkapAccount(
        mockAddress,
        mockSigner,
        'not-a-valid-url',
        mockEntryPointAddress
      )).toThrow('Invalid enUrl');
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
      const error = new Error('Signing failed');
      mockSigner.signUserOpHash.mockRejectedValueOnce(error);

      const account = new ZkapAccount(
        mockAddress,
        mockSigner,
        mockEnUrl,
        mockEntryPointAddress
      );

      await expect(account.signUserOpHash('0xhash')).rejects.toThrow('Signing failed');
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

      expect(mockGetNonce).toHaveBeenCalledWith(mockAddress, 0n);
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

    it('should include string (non-Error) in thrown message', async () => {
      mockGetNonce.mockRejectedValueOnce('string-nonce-error');

      const account = new ZkapAccount(
        mockAddress,
        mockSigner,
        mockEnUrl,
        mockEntryPointAddress
      );

      await expect(account.getNonce()).rejects.toThrow('string-nonce-error');
    });
  });

  describe('sendTransaction', () => {
    it('should send user operation via bundler RPC and return userOpHash', async () => {
      mockGetAddress.mockResolvedValueOnce(mockEntryPointAddress);
      mockProviderSend.mockResolvedValueOnce('0x' + 'ab'.repeat(32));

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

      const result = await account.sendTransaction(mockUserOp);

      expect(mockGetAddress).toHaveBeenCalled();
      expect(mockProviderSend).toHaveBeenCalledWith(
        'eth_sendUserOperation',
        expect.arrayContaining([expect.objectContaining({ sender: mockAddress }), mockEntryPointAddress])
      );
      expect(result).toBe('0x' + 'ab'.repeat(32));
    });

    it('should throw when bundler returns invalid userOpHash', async () => {
      mockGetAddress.mockResolvedValueOnce(mockEntryPointAddress);
      // Bundler returns a non-hex or wrong-length hash
      mockProviderSend.mockResolvedValueOnce('invalid-hash');

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
        .rejects.toThrow('Bundler returned invalid userOpHash');
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
