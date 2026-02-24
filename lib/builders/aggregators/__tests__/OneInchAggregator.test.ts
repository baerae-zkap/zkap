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
        json: () => Promise.resolve({ allowance: '1000000' }),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      const result = await aggregator.checkAllowance('0xToken', '0xWallet');

      expect(result).toBe('1000000');
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

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await expect(aggregator.checkAllowance('0xToken', '0xWallet')).rejects.toThrow(
        'Error fetching allowance: 401 Unauthorized'
      );
    });

    it('should propagate fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await expect(aggregator.checkAllowance('0xToken', '0xWallet')).rejects.toThrow('Network error');
    });

    it('should throw timeout error when checkAllowance is aborted', async () => {
      const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      mockFetch.mockRejectedValueOnce(abortError);

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await expect(aggregator.checkAllowance('0xToken', '0xWallet'))
        .rejects.toThrow('Request timed out after 30000ms');
    });
  });

  describe('getApprovalTxData', () => {
    it('should fetch approval transaction data successfully', async () => {
      const mockTx = {
        to: '0x1111111111111111111111111111111111111111',
        value: '0',
        data: '0xabcd1234',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTx),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      const result = await aggregator.getApprovalTxData('0xToken', '1000000');

      expect(result).toEqual({
        contractAddress: '0x1111111111111111111111111111111111111111',
        value: '0',
        data: '0xabcd1234',
      });
    });

    it('should fetch approval without amount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ to: '0x2222222222222222222222222222222222222222', value: '0', data: '0x' }),
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

    it('should throw when response to address is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ to: 'not-an-address', value: '0', data: '0x' }),
      });
      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await expect(aggregator.getApprovalTxData('0xToken', '100'))
        .rejects.toThrow("Invalid approval response: 'to' is not a valid address");
    });

    it('should throw when response data is not valid hex', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ to: '0x1111111111111111111111111111111111111111', value: '0', data: 'not-hex' }),
      });
      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await expect(aggregator.getApprovalTxData('0xToken', '100'))
        .rejects.toThrow('Invalid approval response: data is not valid hex');
    });

    it('should default value to "0" when approval response has no value field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          to: '0x1111111111111111111111111111111111111111',
          data: '0xabcd1234',
        }),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      const result = await aggregator.getApprovalTxData('0xToken', '100');
      expect(result.value).toBe('0');
    });

    it('should throw timeout error when getApprovalTxData is aborted', async () => {
      const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      mockFetch.mockRejectedValueOnce(abortError);

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await expect(aggregator.getApprovalTxData('0xToken', '100'))
        .rejects.toThrow('Request timed out after 30000ms');
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
          to: '0x3333333333333333333333333333333333333333',
          value: '0',
          data: '0xdead1234',
        },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTx),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      const result = await aggregator.getSwapTxData(mockSwapParams);

      expect(result).toEqual({
        contractAddress: '0x3333333333333333333333333333333333333333',
        value: '0',
        data: '0xdead1234',
      });
    });

    it('should include swap params in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tx: { to: '0x4444444444444444444444444444444444444444', value: '0', data: '0x' } }),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await aggregator.getSwapTxData(mockSwapParams);

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('src=0xTokenA');
      expect(calledUrl).toContain('dst=0xTokenB');
      expect(calledUrl).toContain('amount=1000000000000000000');
      expect(calledUrl).toContain('from=0xSender');
    });

    it('should throw on 400 status', async () => {
      const errorData = { error: 'Insufficient liquidity' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorData),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);

      await expect(aggregator.getSwapTxData(mockSwapParams))
        .rejects.toThrow('1inch API error (400):');
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

    it('should throw when swap response to address is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tx: { to: 'not-an-address', value: '0', data: '0x' } }),
      });
      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await expect(aggregator.getSwapTxData(mockSwapParams))
        .rejects.toThrow("Invalid swap response: 'to' is not a valid address");
    });

    it('should throw when swap response data is not valid hex', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tx: { to: '0x3333333333333333333333333333333333333333', value: '0', data: 'not-hex' } }),
      });
      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await expect(aggregator.getSwapTxData(mockSwapParams))
        .rejects.toThrow('Invalid swap response: data is not valid hex');
    });

    it('should use correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tx: { to: '0x5555555555555555555555555555555555555555', value: '0', data: '0x' } }),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await aggregator.getSwapTxData(mockSwapParams);

      const calledHeaders = mockFetch.mock.calls[0][1].headers;
      expect(calledHeaders.Authorization).toBe(`Bearer ${mockApiKey}`);
      expect(calledHeaders.accept).toBe('application/json');
    });

    it('should default value to "0" when swap response has no tx.value', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tx: {
            to: '0x3333333333333333333333333333333333333333',
            data: '0xdead1234',
          },
        }),
      });

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      const result = await aggregator.getSwapTxData(mockSwapParams);
      expect(result.value).toBe('0');
    });

    it('should throw timeout error when getSwapTxData is aborted', async () => {
      const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      mockFetch.mockRejectedValueOnce(abortError);

      const aggregator = new OneInchAggregator(mockChainId, mockApiKey);
      await expect(aggregator.getSwapTxData(mockSwapParams))
        .rejects.toThrow('Request timed out after 30000ms');
    });
  });
});
