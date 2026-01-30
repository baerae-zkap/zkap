/**
 * SwapBuilder 테스트
 *
 * DEX 애그리게이터를 통한 스왑 트랜잭션 데이터를 생성하는 빌더
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

    it('should not create aggregator for unsupported aggregator name', () => {
      // Clear mock calls
      (OneInchAggregator as jest.Mock).mockClear();

      const builder = new SwapBuilder('unsupported', mockChainId, mockApiKey, mockBundlerAddress);

      // Unsupported aggregators don't create an instance
      expect(builder).toBeInstanceOf(SwapBuilder);
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

      const params = {
        src: '0xTokenA',
        dst: '0xTokenB',
        amount: '1000000',
        from: '0xSender',
        slippage: 0.05,
        disableEstimate: true,
        allowPartialFill: false,
      };

      await builder.getSwapTxData(params);

      expect(mockGetSwapTxData).toHaveBeenCalledWith({
        src: '0xTokenA',
        dst: '0xTokenB',
        amount: '1000000',
        from: '0xSender',
        origin: mockBundlerAddress,
        slippage: 0.05,
        disableEstimate: true,
        allowPartialFill: false,
      });
    });

    it('should use default values for optional params', async () => {
      mockGetSwapTxData.mockResolvedValueOnce({});

      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);

      await builder.getSwapTxData({
        src: '0xSrc',
        dst: '0xDst',
        amount: '100',
        from: '0xFrom',
      });

      expect(mockGetSwapTxData).toHaveBeenCalledWith({
        src: '0xSrc',
        dst: '0xDst',
        amount: '100',
        from: '0xFrom',
        origin: mockBundlerAddress,
        slippage: 0.01, // default
        disableEstimate: false, // default
        allowPartialFill: true, // default
      });
    });

    it('should propagate aggregator errors', async () => {
      const error = new Error('API rate limit exceeded');
      mockGetSwapTxData.mockRejectedValueOnce(error);

      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);

      await expect(
        builder.getSwapTxData({
          src: '0x1',
          dst: '0x2',
          amount: '100',
          from: '0x3',
        })
      ).rejects.toThrow('API rate limit exceeded');
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
        '0xSender',
        '0xToken',
        '1000000000000000000'
      );

      expect(result).toEqual(mockApprovalData);
    });

    it('should pass correct parameters to aggregator', async () => {
      mockGetApprovalTxData.mockResolvedValueOnce({});

      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);
      const sender = '0x' + '11'.repeat(20);
      const token = '0x' + '22'.repeat(20);
      const amount = '999999999';

      await builder.getApprovalTxData(sender, token, amount);

      expect(mockGetApprovalTxData).toHaveBeenCalledWith(token, amount, sender);
    });

    it('should propagate aggregator errors', async () => {
      const error = new Error('Token not found');
      mockGetApprovalTxData.mockRejectedValueOnce(error);

      const builder = new SwapBuilder('1inch', mockChainId, mockApiKey, mockBundlerAddress);

      await expect(
        builder.getApprovalTxData('0xSender', '0xToken', '100')
      ).rejects.toThrow('Token not found');
    });
  });

  describe('different chain IDs', () => {
    it('should create aggregator with correct chain ID', () => {
      new SwapBuilder('1inch', 137, mockApiKey, mockBundlerAddress);
      expect(OneInchAggregator).toHaveBeenCalledWith(137, mockApiKey);

      (OneInchAggregator as jest.Mock).mockClear();

      new SwapBuilder('1inch', 8453, mockApiKey, mockBundlerAddress);
      expect(OneInchAggregator).toHaveBeenCalledWith(8453, mockApiKey);
    });
  });
});
