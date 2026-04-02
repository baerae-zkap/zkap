/**
 * SwapBuilder tests
 *
 * Builder that generates swap transaction data via a DEX aggregator
 */

// Mock OneInchAggregator
const mockGetSwapTxData = jest.fn();
const mockGetApprovalTxData = jest.fn();

jest.mock('../aggregators/OneInchAggregator', () => ({
  OneInchAggregator: jest.fn().mockImplementation(() => ({
    getSwapTxData: mockGetSwapTxData,
    getApprovalTxData: mockGetApprovalTxData,
  })),
}));

import { SwapBuilder } from '../SwapBuilder';
import { OneInchAggregator } from '../aggregators/OneInchAggregator';

describe('SwapBuilder', () => {
  const mockChainId = 1;
  const mockApiKey = 'test-api-key';
  const mockBundlerAddress = '0x' + '99'.repeat(20);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSwapTxData.mockReset();
    mockGetApprovalTxData.mockReset();
  });

  describe('constructor', () => {
    it('should create builder with 1inch aggregator', () => {
      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);

      expect(builder).toBeInstanceOf(SwapBuilder);
      expect(OneInchAggregator).toHaveBeenCalledWith(mockChainId, mockApiKey);
    });

    it('should throw for unsupported aggregator name', () => {
      // Clear mock calls
      (OneInchAggregator as unknown as jest.Mock).mockClear();

      expect(() => new SwapBuilder('unsupported', mockChainId, mockApiKey, mockBundlerAddress))
        .toThrow('Unsupported aggregator: "unsupported"');
    });

    it('should throw when chainId is zero', () => {
      expect(() => new SwapBuilder('1inch', 0, mockApiKey, mockBundlerAddress))
        .toThrow('SwapBuilder: chainId must be a positive integer, got 0');
    });

    it('should throw when chainId is negative', () => {
      expect(() => new SwapBuilder('1inch', -1, mockApiKey, mockBundlerAddress))
        .toThrow('SwapBuilder: chainId must be a positive integer, got -1');
    });

    it('should throw when apiKey is empty', () => {
      expect(() => new SwapBuilder('1inch', mockChainId, '', mockBundlerAddress))
        .toThrow('SwapBuilder: apiKey must be a non-empty string');
    });

    it('should throw when apiKey is whitespace only', () => {
      expect(() => new SwapBuilder('1inch', mockChainId, '   ', mockBundlerAddress))
        .toThrow('SwapBuilder: apiKey must be a non-empty string');
    });

    it('should throw when bundlerAddress is not a valid Ethereum address', () => {
      expect(() => new SwapBuilder('1inch', mockChainId, mockApiKey, 'not-an-address'))
        .toThrow('SwapBuilder: bundlerAddress is not a valid Ethereum address: "not-an-address"');
    });
  });

  describe('getSwapTxData', () => {
    it('should get swap transaction data', async () => {
      const mockSwapData = {
        contractAddress: '0x' + 'aa'.repeat(20),
        value: '0',
        data: '0x12345678',
      };
      mockGetSwapTxData.mockResolvedValueOnce(mockSwapData);

      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);

      const result = await builder.getSwapTxData({
        src: '0x' + '11'.repeat(20),
        dst: '0x' + '22'.repeat(20),
        amount: '1000000000000000000',
        from: '0x' + '33'.repeat(20),
      });

      expect(result).toEqual(mockSwapData);
    });

    it('should pass correct parameters to aggregator', async () => {
      mockGetSwapTxData.mockResolvedValueOnce({});

      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);

      const src = '0x' + 'aa'.repeat(20);
      const dst = '0x' + 'bb'.repeat(20);
      const from = '0x' + 'cc'.repeat(20);
      const params = {
        src,
        dst,
        amount: '1000000',
        from,
        slippage: 0.05,
        disableEstimate: true,
        allowPartialFill: false,
      };

      await builder.getSwapTxData(params);

      expect(mockGetSwapTxData).toHaveBeenCalledWith({
        src,
        dst,
        amount: '1000000',
        from,
        origin: mockBundlerAddress,
        slippage: 0.05,
        disableEstimate: true,
        allowPartialFill: false,
      });
    });

    it('should use default values for optional params', async () => {
      mockGetSwapTxData.mockResolvedValueOnce({});

      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);

      const src = '0x' + 'dd'.repeat(20);
      const dst = '0x' + 'ee'.repeat(20);
      const from = '0x' + 'ff'.repeat(20);
      await builder.getSwapTxData({ src, dst, amount: '100', from });

      expect(mockGetSwapTxData).toHaveBeenCalledWith({
        src,
        dst,
        amount: '100',
        from,
        origin: mockBundlerAddress,
        slippage: 0.01,
        disableEstimate: false,
        allowPartialFill: true,
      });
    });

    it('should propagate aggregator errors', async () => {
      const error = new Error('API rate limit exceeded');
      mockGetSwapTxData.mockRejectedValueOnce(error);

      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);

      await expect(
        builder.getSwapTxData({
          src: '0x' + '11'.repeat(20),
          dst: '0x' + '22'.repeat(20),
          amount: '100',
          from: '0x' + '33'.repeat(20),
        })
      ).rejects.toThrow('API rate limit exceeded');
    });

    it('should throw when src is not a valid Ethereum address', async () => {
      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);
      await expect(
        builder.getSwapTxData({ src: 'not-an-address', dst: '0x' + '22'.repeat(20), amount: '100', from: '0x' + '33'.repeat(20) })
      ).rejects.toThrow('SwapBuilder: src is not a valid Ethereum address: "not-an-address"');
    });

    it('should throw when dst is not a valid Ethereum address', async () => {
      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);
      await expect(
        builder.getSwapTxData({ src: '0x' + '11'.repeat(20), dst: 'bad-dst', amount: '100', from: '0x' + '33'.repeat(20) })
      ).rejects.toThrow('SwapBuilder: dst is not a valid Ethereum address: "bad-dst"');
    });

    it('should throw when from is not a valid Ethereum address', async () => {
      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);
      await expect(
        builder.getSwapTxData({ src: '0x' + '11'.repeat(20), dst: '0x' + '22'.repeat(20), amount: '100', from: 'bad-from' })
      ).rejects.toThrow('SwapBuilder: from is not a valid Ethereum address: "bad-from"');
    });
  });

  describe('getApprovalTxData', () => {
    it('should get approval transaction data', async () => {
      const mockApprovalData = {
        contractAddress: '0xTokenAddress',
        value: '0',
        data: '0xapproveData',
      };
      mockGetApprovalTxData.mockResolvedValueOnce(mockApprovalData);

      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);

      const result = await builder.getApprovalTxData(
        '0xToken',
        '1000000000000000000'
      );

      expect(result).toEqual(mockApprovalData);
    });

    it('should pass correct parameters to aggregator', async () => {
      mockGetApprovalTxData.mockResolvedValueOnce({});

      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);
      const token = '0x' + '22'.repeat(20);
      const amount = '999999999';

      await builder.getApprovalTxData(token, amount);

      expect(mockGetApprovalTxData).toHaveBeenCalledWith(token, amount);
    });

    it('should propagate aggregator errors', async () => {
      const error = new Error('Token not found');
      mockGetApprovalTxData.mockRejectedValueOnce(error);

      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);

      await expect(
        builder.getApprovalTxData('0xToken', '100')
      ).rejects.toThrow('Token not found');
    });
  });

  describe('different chain IDs', () => {
    it('should create aggregator with correct chain ID', () => {
      new SwapBuilder('1inch', 137, mockApiKey, mockBundlerAddress);
      expect(OneInchAggregator).toHaveBeenCalledWith(137, mockApiKey);

      (OneInchAggregator as unknown as jest.Mock).mockClear();

      new SwapBuilder('1inch', 8453, mockApiKey, mockBundlerAddress);
      expect(OneInchAggregator).toHaveBeenCalledWith(8453, mockApiKey);
    });
  });
});
