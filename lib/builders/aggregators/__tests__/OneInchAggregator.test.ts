/**
 * OneInchAggregator 테스트
 *
 * 1inch DEX 애그리게이터 API와 통신하여 스왑/승인 트랜잭션 데이터를 가져옴
 */

import { OneInchAggregator } from '../OneInchAggregator';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OneInchAggregator', () => {
  const mockChainId = 1;
  const mockApiKey = 'test-api-key-12345';

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should create aggregator with chainId and apiKey', () => {
      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      expect(aggregator).toBeInstanceOf(OneInchAggregator);
    });
  });

  describe('apiRequestUrl', () => {
    it('should construct correct API URL', () => {
      const aggregator = new OneInchAggregator(1, mockApiKey);
      const url = aggregator.apiRequestUrl('/swap', { src: '0x1', dst: '0x2' });

      expect(url).toBe('https://api.1inch.dev/swap/v6.0/1/swap?src=0x1&dst=0x2');
    });

    it('should handle different chain IDs', () => {
      const aggregator = new OneInchAggregator(137, mockApiKey);
      const url = aggregator.apiRequestUrl('/test', { param: 'value' });

      expect(url).toContain('/137/');
    });
  });

  describe('checkAllowance', () => {
    it('should fetch allowance successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ allowance: 1000000 }),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      const result = await aggregator.checkAllowance('0xToken', '0xWallet');

      expect(result).toBe(1000000);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/approve/allowance'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiKey}`,
          }),
        })
      );
    });

    it('should return null when allowance is not present', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      const result = await aggregator.checkAllowance('0xToken', '0xWallet');

      expect(result).toBeNull();
    });

    it('should return null on HTTP error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      const result = await aggregator.checkAllowance('0xToken', '0xWallet');

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should return null on fetch error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      const result = await aggregator.checkAllowance('0xToken', '0xWallet');

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('getApprovalTxData', () => {
    it('should fetch approval transaction data successfully', async () => {
      const mockTx = {
        to: '0xTokenContract',
        value: '0',
        data: '0xapproveData',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTx),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      const result = await aggregator.getApprovalTxData('0xToken', '1000000');

      expect(result).toEqual({
        contractAddress: '0xTokenContract',
        value: '0',
        data: '0xapproveData',
      });
    });

    it('should fetch approval without amount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ to: '0x1', value: '0', data: '0x' }),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await aggregator.getApprovalTxData('0xToken', undefined);

      // URL should only contain tokenAddress, not amount
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('tokenAddress=0xToken');
      expect(calledUrl).not.toContain('amount=');
    });

    it('should throw on HTTP error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);

      await expect(aggregator.getApprovalTxData('0xToken', '100'))
        .rejects.toThrow('HTTP Error! Status: 401 - Unauthorized');

      consoleSpy.mockRestore();
    });
  });

  describe('getSwapTxData', () => {
    const mockSwapParams = {
      src: '0xTokenA',
      dst: '0xTokenB',
      amount: '1000000000000000000',
      from: '0xSender',
      slippage: 0.01,
    };

    it('should fetch swap transaction data successfully', async () => {
      const mockTx = {
        tx: {
          to: '0xRouterContract',
          value: '0',
          data: '0xswapData',
        },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTx),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      const result = await aggregator.getSwapTxData(mockSwapParams);

      expect(result).toEqual({
        contractAddress: '0xRouterContract',
        value: '0',
        data: '0xswapData',
      });
    });

    it('should include swap params in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tx: { to: '0x', value: '0', data: '0x' } }),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await aggregator.getSwapTxData(mockSwapParams);

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('src=0xTokenA');
      expect(calledUrl).toContain('dst=0xTokenB');
      expect(calledUrl).toContain('amount=1000000000000000000');
      expect(calledUrl).toContain('from=0xSender');
    });

    it('should return error object on 400 status', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorData = { error: 'Insufficient liquidity' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorData),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      const result = await aggregator.getSwapTxData(mockSwapParams);

      expect(result).toEqual({ error: errorData });
      consoleSpy.mockRestore();
    });

    it('should throw on non-400 HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);

      await expect(aggregator.getSwapTxData(mockSwapParams))
        .rejects.toThrow('HTTP Error! Status: 500 - Internal Server Error');
    });

    it('should use correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tx: { to: '0x', value: '0', data: '0x' } }),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await aggregator.getSwapTxData(mockSwapParams);

      const calledHeaders = mockFetch.mock.calls[0][1].headers;
      expect(calledHeaders.Authorization).toBe(`Bearer ${mockApiKey}`);
      expect(calledHeaders.accept).toBe('application/json');
    });
  });
});
