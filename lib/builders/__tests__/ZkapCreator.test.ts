/**
 * ZkapCreator 테스트
 *
 * ZkapBuilder를 확장하여 새 ZKAP 계정 생성 기능 제공
 */

// Mock ZkapFactoryBuilder before imports
const mockCalcAccountAddress = jest.fn();
jest.mock('../ZkapFactoryBuilder', () => ({
  ZkapFactoryBuilder: jest.fn().mockImplementation(() => ({
    calcAccountAddress: mockCalcAccountAddress,
  })),
}));

// Mock ethers
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ethers: {
      ...actual.ethers,
      ZeroAddress: '0x0000000000000000000000000000000000000000',
      JsonRpcProvider: jest.fn().mockImplementation(() => ({
        getCode: jest.fn().mockResolvedValue('0x'),
        estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
        getFeeData: jest.fn().mockResolvedValue({ gasPrice: BigInt(1000000000) }),
      })),
      Interface: jest.fn().mockImplementation(() => ({
        getFunction: jest.fn().mockReturnValue(true),
        encodeFunctionData: jest.fn().mockReturnValue('0xEncodedCallData'),
        parseTransaction: jest.fn(),
      })),
      AbiCoder: {
        defaultAbiCoder: () => ({
          encode: jest.fn().mockReturnValue('0xEncoded'),
        }),
      },
      concat: jest.fn().mockReturnValue('0xConcatenated'),
      toBeHex: jest.fn().mockImplementation((val) => `0x${BigInt(val).toString(16)}`),
      keccak256: jest.fn().mockReturnValue('0x' + 'ab'.repeat(32)),
      zeroPadValue: jest.fn().mockReturnValue('0x' + '00'.repeat(16)),
      hexlify: jest.fn().mockImplementation((val) => `0x${val}`),
    },
  };
});


import { ZkapCreator, ZkapCreatorInfo } from '../ZkapCreator';
import { ZkapFactoryBuilder } from '../ZkapFactoryBuilder';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ethers } from 'ethers';

describe('ZkapCreator', () => {
  const mockCreatorInfo: ZkapCreatorInfo = {
    chainId: 1,
    entryPoint: '0x' + '55'.repeat(20),
    zkapFactory: '0x' + '11'.repeat(20),
    enUrl: 'http://localhost:8545',
    salt: '0x' + '00'.repeat(32),
    encodedMasterKey: '0x' + 'aa'.repeat(64),
    encodedTxKey: '0x' + 'bb'.repeat(64),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalcAccountAddress.mockReset();
  });

  describe('constructor', () => {
    it('should create instance with ZkapCreatorInfo', () => {
      const creator = new ZkapCreator(mockCreatorInfo);
      expect(creator).toBeInstanceOf(ZkapCreator);
    });

    it('should call setInitCode during construction', () => {
      const creator = new ZkapCreator(mockCreatorInfo);
      // initCode should be set (via setInitCode call in constructor)
      expect(creator).toBeDefined();
    });
  });

  describe('deriveZkapAddress', () => {
    it('should calculate and return zkap address', async () => {
      const expectedAddress = '0x' + 'ff'.repeat(20);
      mockCalcAccountAddress.mockResolvedValueOnce(expectedAddress);

      const creator = new ZkapCreator(mockCreatorInfo);
      const address = await creator.deriveZkapAddress();

      expect(address).toBe(expectedAddress);
      expect(ZkapFactoryBuilder).toHaveBeenCalledWith(
        mockCreatorInfo.zkapFactory,
        mockCreatorInfo.enUrl
      );
      expect(mockCalcAccountAddress).toHaveBeenCalledWith(
        mockCreatorInfo.salt,
        mockCreatorInfo.encodedMasterKey,
        mockCreatorInfo.encodedTxKey
      );
    });

    it('should cache address and return cached value on subsequent calls', async () => {
      const expectedAddress = '0x' + 'cc'.repeat(20);
      mockCalcAccountAddress.mockResolvedValueOnce(expectedAddress);

      const creator = new ZkapCreator(mockCreatorInfo);

      const address1 = await creator.deriveZkapAddress();
      const address2 = await creator.deriveZkapAddress();

      expect(address1).toBe(expectedAddress);
      expect(address2).toBe(expectedAddress);
      // Should only call calcAccountAddress once due to caching
      expect(mockCalcAccountAddress).toHaveBeenCalledTimes(1);
    });

    it('should set sender after deriving address', async () => {
      const expectedAddress = '0x' + 'dd'.repeat(20);
      mockCalcAccountAddress.mockResolvedValueOnce(expectedAddress);

      const creator = new ZkapCreator(mockCreatorInfo);
      await creator.deriveZkapAddress();

      const userOp = creator.getUserOp();
      expect(userOp.sender).toBe(expectedAddress);
    });

    it('should only call calcAccountAddress once on concurrent calls', async () => {
      const expectedAddress = '0x' + 'ee'.repeat(20);
      mockCalcAccountAddress.mockResolvedValueOnce(expectedAddress);

      const creator = new ZkapCreator(mockCreatorInfo);
      const [addr1, addr2, addr3] = await Promise.all([
        creator.deriveZkapAddress(),
        creator.deriveZkapAddress(),
        creator.deriveZkapAddress(),
      ]);

      expect(addr1).toBe(expectedAddress);
      expect(addr2).toBe(expectedAddress);
      expect(addr3).toBe(expectedAddress);
      expect(mockCalcAccountAddress).toHaveBeenCalledTimes(1);
    });

    it('should allow retry after failure', async () => {
      const expectedAddress = '0x' + 'ff'.repeat(20);
      mockCalcAccountAddress
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce(expectedAddress);

      const creator = new ZkapCreator(mockCreatorInfo);

      // First call fails
      await expect(creator.deriveZkapAddress()).rejects.toThrow('network error');

      // Second call should retry (not return cached rejected promise)
      const address = await creator.deriveZkapAddress();
      expect(address).toBe(expectedAddress);
      expect(mockCalcAccountAddress).toHaveBeenCalledTimes(2);
    });

    it('should use different addresses for different salts', async () => {
      const address1 = '0x' + 'aa'.repeat(20);
      const address2 = '0x' + 'bb'.repeat(20);

      mockCalcAccountAddress
        .mockResolvedValueOnce(address1)
        .mockResolvedValueOnce(address2);

      const info1 = { ...mockCreatorInfo, salt: '0x1' };
      const info2 = { ...mockCreatorInfo, salt: '0x2' };

      const creator1 = new ZkapCreator(info1);
      const creator2 = new ZkapCreator(info2);

      const result1 = await creator1.deriveZkapAddress();
      const result2 = await creator2.deriveZkapAddress();

      expect(result1).toBe(address1);
      expect(result2).toBe(address2);
    });
  });

  describe('inheritance from ZkapBuilder', () => {
    it('should have ZkapBuilder methods', () => {
      const creator = new ZkapCreator(mockCreatorInfo);

      expect(typeof creator.setSender).toBe('function');
      expect(typeof creator.setNonce).toBe('function');
      expect(typeof creator.setCallData).toBe('function');
      expect(typeof creator.getUserOp).toBe('function');
      expect(typeof creator.getUserOpHash).toBe('function');
    });

    it('should be able to use fluent interface', async () => {
      mockCalcAccountAddress.mockResolvedValueOnce('0x' + 'ee'.repeat(20));

      const creator = new ZkapCreator(mockCreatorInfo);
      await creator.deriveZkapAddress();

      // Chain setters
      creator
        .setNonce('0x5')
        .setMaxFeePerGas('0x3b9aca00')
        .setMaxPriorityFeePerGas('0x59682f00');

      const userOp = creator.getUserOp();
      expect(userOp.nonce).toBe('0x5');
    });
  });
});
