/**
 * ZkapFactoryBuilder 테스트
 *
 * ZkapAccountFactory 컨트랙트와 상호작용하여 계정 주소를 계산하는 빌더
 */

// Mock ethers before imports
const mockCalcAccountAddress = jest.fn();
jest.mock('ethers', () => ({
  ethers: {
    isAddress: jest.fn().mockReturnValue(true),
    JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
    Contract: jest.fn().mockImplementation(() => ({
      calcAccountAddress: mockCalcAccountAddress,
    })),
  },
}));


import { ZkapFactoryBuilder } from '../ZkapFactoryBuilder';

describe('ZkapFactoryBuilder', () => {
  const mockFactoryAddress = '0x' + '11'.repeat(20);
  const mockEnUrl = 'http://localhost:8545';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with factory address and enUrl', () => {
      const builder = new ZkapFactoryBuilder(mockFactoryAddress, mockEnUrl);
      expect(builder).toBeInstanceOf(ZkapFactoryBuilder);
    });

    it('should throw when address is not a valid Ethereum address', () => {
      const { ethers: mockEthers } = jest.requireMock('ethers');
      mockEthers.isAddress.mockReturnValueOnce(false);
      expect(() => new ZkapFactoryBuilder('not-an-address', mockEnUrl)).toThrow(
        'ZkapFactoryBuilder: invalid contract address: "not-an-address"'
      );
    });
  });

  describe('calcAccountAddress', () => {
    it('should calculate account address with given parameters', async () => {
      const expectedAddress = '0x' + 'ab'.repeat(20);
      mockCalcAccountAddress.mockResolvedValueOnce(expectedAddress);

      const builder = new ZkapFactoryBuilder(mockFactoryAddress, mockEnUrl);
      const salt = '0x' + '00'.repeat(32);
      const encodedMasterKey = '0x' + '11'.repeat(64);
      const encodedTxKey = '0x' + '22'.repeat(64);

      const result = await builder.calcAccountAddress(salt, encodedMasterKey, encodedTxKey);

      expect(result).toBe(expectedAddress);
      expect(mockCalcAccountAddress).toHaveBeenCalledWith(salt, encodedMasterKey, encodedTxKey);
    });

    it('should call contract with exact parameters', async () => {
      mockCalcAccountAddress.mockResolvedValueOnce('0x' + 'ff'.repeat(20));

      const builder = new ZkapFactoryBuilder(mockFactoryAddress, mockEnUrl);
      const salt = '0xSalt123';
      const masterKey = '0xMasterKey456';
      const txKey = '0xTxKey789';

      await builder.calcAccountAddress(salt, masterKey, txKey);

      expect(mockCalcAccountAddress).toHaveBeenCalledTimes(1);
      expect(mockCalcAccountAddress).toHaveBeenCalledWith(salt, masterKey, txKey);
    });

    it('should propagate contract errors', async () => {
      const error = new Error('Contract call failed');
      mockCalcAccountAddress.mockRejectedValueOnce(error);

      const builder = new ZkapFactoryBuilder(mockFactoryAddress, mockEnUrl);

      await expect(
        builder.calcAccountAddress('0x1', '0x2', '0x3')
      ).rejects.toThrow('Contract call failed');
    });

    it('should handle different salt values', async () => {
      mockCalcAccountAddress
        .mockResolvedValueOnce('0xAddress1')
        .mockResolvedValueOnce('0xAddress2');

      const builder = new ZkapFactoryBuilder(mockFactoryAddress, mockEnUrl);

      const result1 = await builder.calcAccountAddress('0x1', '0xKey', '0xTx');
      const result2 = await builder.calcAccountAddress('0x2', '0xKey', '0xTx');

      expect(result1).toBe('0xAddress1');
      expect(result2).toBe('0xAddress2');
    });
  });
});
