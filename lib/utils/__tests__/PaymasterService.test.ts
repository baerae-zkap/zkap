/**
 * PaymasterService tests
 *
 * Service that fetches paymaster data by communicating with the paymaster server
 * - VERIFYING mode: basic paymaster verification
 * - ERC20 mode: pay gas fees with ERC20 tokens
 */

import {
  PaymasterService,
  PaymasterMode,
  PaymasterServiceConfig,
} from '../PaymasterService';
import { UserOperation } from '../../types/UserOperation';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper to create mock UserOperation
function createMockUserOp(): UserOperation {
  return {
    sender: '0x' + '11'.repeat(20),
    nonce: '0x1',
    initCode: '0x',
    callData: '0x' + 'ab'.repeat(32),
    callGasLimit: '0x5208',
    verificationGasLimit: '0x7530',
    preVerificationGas: '0xc350',
    maxFeePerGas: '0x3b9aca00',
    maxPriorityFeePerGas: '0x59682f00',
    paymaster: '0x' + '22'.repeat(20),
    paymasterData: '0x',
    paymasterVerificationGasLimit: '0x6978',
    paymasterPostOpGasLimit: '0x0',
    signature: '0x',
  };
}

// Helper to create mock config
function createMockConfig(mode: PaymasterMode = PaymasterMode.VERIFYING): PaymasterServiceConfig {
  const config: PaymasterServiceConfig = {
    serverUrl: 'http://localhost:3000',
    paymasterAddress: '0x' + '33'.repeat(20),
    chainId: 1,
    mode,
  };
  if (mode === PaymasterMode.ERC20) {
    config.tokenAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
  }
  return config;
}

// Helper to create successful API response
function createSuccessResponse(paymasterData: string = '0xabcd1234') {
  return {
    result: {
      userOp: {
        paymasterData,
      },
    },
  };
}

describe('PaymasterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should create instance with config', () => {
      const config = createMockConfig();
      const service = new PaymasterService(config);

      expect(service.getConfig()).toEqual(config);
    });

    it('should store VERIFYING mode', () => {
      const config = createMockConfig(PaymasterMode.VERIFYING);
      const service = new PaymasterService(config);

      expect(service.getConfig().mode).toBe(PaymasterMode.VERIFYING);
    });

    it('should store ERC20 mode', () => {
      const config = createMockConfig(PaymasterMode.ERC20);
      const service = new PaymasterService(config);

      expect(service.getConfig().mode).toBe(PaymasterMode.ERC20);
    });

    it('should throw when serverUrl is not a valid URL', () => {
      expect(() => new PaymasterService({
        serverUrl: 'not-a-valid-url',
        paymasterAddress: '0x' + '33'.repeat(20),
        chainId: 1,
        mode: PaymasterMode.VERIFYING,
      })).toThrow('PaymasterService: serverUrl is not a valid URL: "not-a-valid-url"');
    });

    it('should throw when serverUrl uses HTTP with non-localhost hostname', () => {
      expect(() => new PaymasterService({
        serverUrl: 'http://remoteserver.com:3000',
        paymasterAddress: '0x' + '33'.repeat(20),
        chainId: 1,
        mode: PaymasterMode.VERIFYING,
      })).toThrow('PaymasterService serverUrl must use HTTPS. HTTP is only allowed for localhost.');
    });

    it('should throw when paymasterAddress is not a valid Ethereum address', () => {
      expect(() => new PaymasterService({
        serverUrl: 'http://localhost:3000',
        paymasterAddress: 'not-an-address',
        chainId: 1,
        mode: PaymasterMode.VERIFYING,
      })).toThrow('PaymasterService: paymasterAddress is not a valid Ethereum address: "not-an-address"');
    });

    it('should throw when ERC20 mode is used without tokenAddress', () => {
      expect(() => new PaymasterService({
        serverUrl: 'http://localhost:3000',
        paymasterAddress: '0x' + '33'.repeat(20),
        chainId: 1,
        mode: PaymasterMode.ERC20,
      })).toThrow('PaymasterService: tokenAddress is required for ERC20 mode');
    });

    it('should throw when ERC20 tokenAddress is not a valid Ethereum address', () => {
      expect(() => new PaymasterService({
        serverUrl: 'http://localhost:3000',
        paymasterAddress: '0x' + '33'.repeat(20),
        chainId: 1,
        mode: PaymasterMode.ERC20,
        tokenAddress: 'not-an-address',
      })).toThrow('PaymasterService: tokenAddress is not a valid Ethereum address: "not-an-address"');
    });
  });

  describe('getPaymasterData', () => {
    it('should route to VERIFYING method for VERIFYING mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse('0xabcdef1234')),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      const result = await service.getPaymasterData(createMockUserOp());

      expect(result).toBe('0xabcdef1234');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/paymaster/get-paymaster-data',
        expect.any(Object)
      );
    });

    it('should route to ERC20 method for ERC20 mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse('0xfeedbeef')),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.ERC20));
      const result = await service.getPaymasterData(createMockUserOp());

      expect(result).toBe('0xfeedbeef');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/paymaster/get-paymaster-data-erc20',
        expect.any(Object)
      );
    });

    it('should throw for invalid mode', async () => {
      const config = createMockConfig();
      (config as any).mode = 999; // Invalid mode
      expect(() => new PaymasterService(config))
        .toThrow('PaymasterService: unsupported mode: 999');
    });
  });

  describe('getPaymasterDataVerifying', () => {
    const mockUserOp = createMockUserOp();

    it('should fetch paymaster data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse('0xab12cd34ef')),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      const result = await service.getPaymasterData(mockUserOp);

      expect(result).toBe('0xab12cd34ef');
    });

    it('should send correct request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse()),
      });

      const config = createMockConfig(PaymasterMode.VERIFYING);
      const service = new PaymasterService(config);
      await service.getPaymasterData(mockUserOp);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/paymaster/get-paymaster-data',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.jsonrpc).toBe('2.0');
      expect(body.method).toBe('pm_getPaymasterData');
      expect(body.params[0].sender).toBe(mockUserOp.sender);
      expect(body.params[1]).toBe(config.paymasterAddress);
      expect(body.params[2]).toBe(config.chainId.toString());
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));

      await expect(service.getPaymasterData(mockUserOp))
        .rejects.toThrow('Paymaster data request failed: 500 Internal Server Error');
    });

    it('includes response body text in HTTP error message when available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: () => Promise.resolve('invalid userOp format'),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      const err = await service.getPaymasterData(mockUserOp).catch((e: unknown) => e);

      expect((err as Error).message).toContain('invalid userOp format');
      expect((err as any).rawResponse).toBe('invalid userOp format');
    });

    it('should throw on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          error: { message: 'Insufficient balance' },
        }),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));

      await expect(service.getPaymasterData(mockUserOp))
        .rejects.toThrow('Paymaster data error: Insufficient balance');
    });

    it('should throw when result is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));

      await expect(service.getPaymasterData(mockUserOp))
        .rejects.toThrow('Paymaster data error: result is not found');
    });

    it('should throw when result.userOp is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: { paymasterData: '0xabcd' } }), // no userOp
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));

      await expect(service.getPaymasterData(createMockUserOp()))
        .rejects.toThrow('result.userOp is not found');
    });

    it('should throw when paymasterData is not a hex string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            userOp: { paymasterData: 'not-hex-string' },
          },
        }),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));

      await expect(service.getPaymasterData(mockUserOp))
        .rejects.toThrow('Invalid paymasterData format: expected 0x-prefixed even-length hex string');
    });

    it('should throw when paymasterData is a number instead of string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            userOp: { paymasterData: 12345 },
          },
        }),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));

      await expect(service.getPaymasterData(mockUserOp))
        .rejects.toThrow('Invalid paymasterData format: expected 0x-prefixed even-length hex string, got number');
    });

    it('should throw when response body is not valid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Unexpected token < in JSON')),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));

      await expect(service.getPaymasterData(createMockUserOp()))
        .rejects.toThrow('Paymaster data error: invalid JSON response');
    });

    it('should handle non-Error JSON parse rejection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject('parse_failure'),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      const err = await service.getPaymasterData(createMockUserOp()).catch((e: unknown) => e);

      expect((err as any).code).toBe('ZKAP_AA_FETCH_RESPONSE_SHAPE');
      expect((err as Error).message).toContain('parse_failure');
    });

    it('should include all userOp fields in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse()),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      await service.getPaymasterData(mockUserOp);

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      const userOpParam = body.params[0];

      expect(userOpParam.sender).toBe(mockUserOp.sender);
      expect(userOpParam.nonce).toBe(mockUserOp.nonce);
      expect(userOpParam.initCode).toBe(mockUserOp.initCode);
      expect(userOpParam.callData).toBe(mockUserOp.callData);
      expect(userOpParam.callGasLimit).toBe(mockUserOp.callGasLimit);
      expect(userOpParam.verificationGasLimit).toBe(mockUserOp.verificationGasLimit);
      expect(userOpParam.preVerificationGas).toBe(mockUserOp.preVerificationGas);
      expect(userOpParam.maxPriorityFeePerGas).toBe(mockUserOp.maxPriorityFeePerGas);
      expect(userOpParam.maxFeePerGas).toBe(mockUserOp.maxFeePerGas);
      expect(userOpParam.paymaster).toBe(mockUserOp.paymaster);
      expect(userOpParam.paymasterVerificationGasLimit).toBe(mockUserOp.paymasterVerificationGasLimit);
      expect(userOpParam.paymasterPostOpGasLimit).toBe(mockUserOp.paymasterPostOpGasLimit);
    });
  });

  describe('getPaymasterDataErc20', () => {
    const mockUserOp = createMockUserOp();

    it('should fetch ERC20 paymaster data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse('0xdeadbeef01')),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.ERC20));
      const result = await service.getPaymasterData(mockUserOp);

      expect(result).toBe('0xdeadbeef01');
    });

    it('should call correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse()),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.ERC20));
      await service.getPaymasterData(mockUserOp);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/paymaster/get-paymaster-data-erc20',
        expect.any(Object)
      );
    });

    it('should include configured token address in params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse()),
      });

      const config = createMockConfig(PaymasterMode.ERC20);
      config.tokenAddress = '0x' + 'cd'.repeat(20);
      const service = new PaymasterService(config);
      await service.getPaymasterData(mockUserOp);

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      // ERC20 mode includes token address as 4th param
      expect(body.params.length).toBe(4);
      expect(body.params[3]).toBe('0x' + 'cd'.repeat(20));
    });

    it('should throw when tokenAddress is not set for ERC20 mode', () => {
      expect(() => new PaymasterService({
        serverUrl: 'http://localhost:3000',
        paymasterAddress: '0x' + '33'.repeat(20),
        chainId: 1,
        mode: PaymasterMode.ERC20,
        // no tokenAddress
      })).toThrow('PaymasterService: tokenAddress is required for ERC20 mode');
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.ERC20));

      await expect(service.getPaymasterData(mockUserOp))
        .rejects.toThrow('Paymaster data request failed: 400 Bad Request');
    });

    it('should throw on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          error: { message: 'Token not supported' },
        }),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.ERC20));

      await expect(service.getPaymasterData(mockUserOp))
        .rejects.toThrow('Paymaster data error: Token not supported');
    });

    it('should throw when result is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.ERC20));

      await expect(service.getPaymasterData(mockUserOp))
        .rejects.toThrow('Paymaster data error: result is not found');
    });
  });

  describe('estimatePaymasterVerificationGasLimit', () => {
    it('should return 27000n for VERIFYING mode', () => {
      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      const result = service.estimatePaymasterVerificationGasLimit();

      expect(result).toBe(27000n);
    });

    it('should return 40000n for ERC20 mode', () => {
      const service = new PaymasterService(createMockConfig(PaymasterMode.ERC20));
      const result = service.estimatePaymasterVerificationGasLimit();

      expect(result).toBe(40000n);
    });

    it('should throw for invalid mode', () => {
      const config = createMockConfig();
      (config as any).mode = 999;
      expect(() => new PaymasterService(config))
        .toThrow('PaymasterService: unsupported mode: 999');
    });
  });

  describe('estimatePaymasterPostOpGasLimit', () => {
    it('should return 0n for VERIFYING mode', () => {
      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      const result = service.estimatePaymasterPostOpGasLimit();

      expect(result).toBe(0n);
    });

    it('should return 100000n for ERC20 mode', () => {
      const service = new PaymasterService(createMockConfig(PaymasterMode.ERC20));
      const result = service.estimatePaymasterPostOpGasLimit();

      expect(result).toBe(100000n);
    });

    it('should throw for invalid mode', () => {
      const config = createMockConfig();
      (config as any).mode = 999;
      expect(() => new PaymasterService(config))
        .toThrow('PaymasterService: unsupported mode: 999');
    });
  });

  describe('getConfig', () => {
    it('should return the config object', () => {
      const config = createMockConfig(PaymasterMode.ERC20);
      config.serverUrl = 'https://custom.server.com';
      config.paymasterAddress = '0x' + 'ab'.repeat(20);
      config.chainId = 137;

      const service = new PaymasterService(config);
      const returnedConfig = service.getConfig();

      expect(returnedConfig.serverUrl).toBe('https://custom.server.com');
      expect(returnedConfig.paymasterAddress).toBe('0x' + 'ab'.repeat(20));
      expect(returnedConfig.chainId).toBe(137);
      expect(returnedConfig.mode).toBe(PaymasterMode.ERC20);
    });
  });

  describe('PaymasterMode enum', () => {
    it('should have correct values', () => {
      expect(PaymasterMode.VERIFYING).toBe(0);
      expect(PaymasterMode.ERC20).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle different chainIds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse()),
      });

      const config = createMockConfig(PaymasterMode.VERIFYING);
      config.chainId = 8453; // Base
      const service = new PaymasterService(config);
      await service.getPaymasterData(createMockUserOp());

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.params[2]).toBe('8453');
    });

    it('should handle different server URLs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse()),
      });

      const config = createMockConfig(PaymasterMode.VERIFYING);
      config.serverUrl = 'https://paymaster.example.com/api/v1';
      const service = new PaymasterService(config);
      await service.getPaymasterData(createMockUserOp());

      expect(mockFetch).toHaveBeenCalledWith(
        'https://paymaster.example.com/api/v1/paymaster/get-paymaster-data',
        expect.any(Object)
      );
    });

    it('should include unique numeric id in request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse()),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      await service.getPaymasterData(createMockUserOp());
      await service.getPaymasterData(createMockUserOp());

      const body1 = JSON.parse(mockFetch.mock.calls[0][1].body);
      const body2 = JSON.parse(mockFetch.mock.calls[1][1].body);

      expect(typeof body1.id).toBe('number');
      expect(body1.id).toBeGreaterThanOrEqual(0);
      expect(typeof body2.id).toBe('number');
      expect(body2.id).toBeGreaterThanOrEqual(0);
    });

    it('should throw timeout error when fetch is aborted', async () => {
      const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      mockFetch.mockRejectedValueOnce(abortError);

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      await expect(service.getPaymasterData(createMockUserOp()))
        .rejects.toThrow('Paymaster request timed out after 30000ms');
    });

    it('setTimeout callback fires and aborts the request after timeout', async () => {
      jest.useFakeTimers();
      const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      // fetch hangs until AbortController fires, then rejects with AbortError
      mockFetch.mockImplementationOnce((_url: string, opts: RequestInit) => {
        return new Promise((_resolve, reject) => {
          (opts.signal as AbortSignal).addEventListener('abort', () => {
            reject(abortError);
          });
        });
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      const promise = service.getPaymasterData(createMockUserOp());
      jest.advanceTimersByTime(30001);
      await expect(promise).rejects.toThrow('Paymaster request timed out after 30000ms');
      jest.useRealTimers();
    });

    it('should rethrow non-abort fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      await expect(service.getPaymasterData(createMockUserOp()))
        .rejects.toThrow('Connection refused');
    });

    it('handles HTTP error with no response body gracefully (text() throws)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: () => Promise.reject(new Error('body read failed')),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      const err = await service.getPaymasterData(createMockUserOp()).catch((e: unknown) => e);

      expect((err as any).code).toBe('ZKAP_AA_FETCH_HTTP_STATUS');
      expect((err as any).httpStatus).toBe(503);
      expect((err as any).rawResponse).toBe('');
    });

    it('should stringify non-object API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ error: 'unauthorized' }),
      });

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      await expect(service.getPaymasterData(createMockUserOp()))
        .rejects.toThrow('Paymaster data error: "unauthorized"');
    });
  });

  describe('sponsorTokenPayment', () => {
    const TOKEN_ADDRESS = '0x' + 'aa'.repeat(20);
    const SERVICE_KEY = 'sk-test-9999';
    const IDEMPOTENCY_KEY = 'idem-key-001';

    function createTokenPaymentResponse() {
      return {
        rewrittenUserOp: {
          callData: '0x' + '22'.repeat(64),
          callGasLimit: '0x8000',
          verificationGasLimit: '0x30000',
          preVerificationGas: '0xe000',
          maxFeePerGas: '0x3b9aca00',
          maxPriorityFeePerGas: '0x3b9aca00',
          paymasterVerificationGasLimit: '0xa000',
          paymasterPostOpGasLimit: '0x20000',
        },
        paymaster: '0x' + 'bb'.repeat(20),
        paymasterData: '0x' + 'ee'.repeat(78),
        paymasterVerificationGasLimit: '0xa000',
        paymasterPostOpGasLimit: '0x20000',
        validUntil: 9999999999,
        validAfter: 0,
        treasury: '0x' + 'cc'.repeat(20),
        tokenAmount: '1000000000000000000',
        sessionId: 'sess_xyz',
      };
    }

    function makeErc20Service() {
      return new PaymasterService({
        serverUrl: 'https://paymaster.test',
        paymasterAddress: '0x' + '33'.repeat(20),
        chainId: 1,
        mode: PaymasterMode.ERC20,
        tokenAddress: TOKEN_ADDRESS,
      });
    }

    it('happy path: returns full TokenPaymentResponse', async () => {
      const expected = createTokenPaymentResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(expected),
      });

      const service = makeErc20Service();
      const result = await service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      );

      expect(result).toEqual(expected);
    });

    it('sends POST to correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createTokenPaymentResponse()),
      });

      const service = makeErc20Service();
      await service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://paymaster.test/paymaster-v2/v1/sponsorship/token-payment',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('sets X-Service-Key header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createTokenPaymentResponse()),
      });

      const service = makeErc20Service();
      await service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      );

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers['X-Service-Key']).toBe(SERVICE_KEY);
    });

    it('sets Idempotency-Key header when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createTokenPaymentResponse()),
      });

      const service = makeErc20Service();
      await service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY, idempotencyKey: IDEMPOTENCY_KEY }
      );

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers['Idempotency-Key']).toBe(IDEMPOTENCY_KEY);
    });

    it('omits Idempotency-Key header when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createTokenPaymentResponse()),
      });

      const service = makeErc20Service();
      await service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      );

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers['Idempotency-Key']).toBeUndefined();
    });

    it('sends correct request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createTokenPaymentResponse()),
      });

      const userOp = createMockUserOp();
      const service = makeErc20Service();
      await service.sponsorTokenPayment(
        { chainId: 137, userOp, tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      );

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.chainId).toBe(137);
      expect(body.tokenAddress).toBe(TOKEN_ADDRESS);
      expect(body.userOp.sender).toBe(userOp.sender);
      expect(body.userOp.callData).toBe(userOp.callData);
    });

    it('throws AaFetchError TIMEOUT on AbortError', async () => {
      const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      mockFetch.mockRejectedValueOnce(abortError);

      const service = makeErc20Service();
      const err = await service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      ).catch((e: unknown) => e);

      expect((err as any).code).toBe('ZKAP_AA_FETCH_TIMEOUT');
      expect((err as Error).message).toMatch(/timed out after 30000ms/);
    });

    it('setTimeout callback fires and aborts sponsorTokenPayment after timeout', async () => {
      jest.useFakeTimers();
      const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      mockFetch.mockImplementationOnce((_url: string, opts: RequestInit) => {
        return new Promise((_resolve, reject) => {
          (opts.signal as AbortSignal).addEventListener('abort', () => {
            reject(abortError);
          });
        });
      });

      const service = makeErc20Service();
      const promise = service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      );
      jest.advanceTimersByTime(30001);
      await expect(promise).rejects.toThrow('Token payment request timed out after 30000ms');
      jest.useRealTimers();
    });

    it('rethrows non-abort fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('DNS failure'));

      const service = makeErc20Service();
      await expect(
        service.sponsorTokenPayment(
          { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
          { serviceKey: SERVICE_KEY }
        )
      ).rejects.toThrow('DNS failure');
    });

    it('throws AaFetchError HTTP_STATUS on 4xx response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Unauthorized'),
      });

      const service = makeErc20Service();
      const err = await service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      ).catch((e: unknown) => e);

      expect((err as any).code).toBe('ZKAP_AA_FETCH_HTTP_STATUS');
      expect((err as any).httpStatus).toBe(401);
    });

    it('throws AaFetchError HTTP_STATUS on 5xx response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      });

      const service = makeErc20Service();
      const err = await service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      ).catch((e: unknown) => e);

      expect((err as any).code).toBe('ZKAP_AA_FETCH_HTTP_STATUS');
      expect((err as any).httpStatus).toBe(500);
    });

    it('includes rawResponse in HTTP_STATUS error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Access denied'),
      });

      const service = makeErc20Service();
      const err = await service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      ).catch((e: unknown) => e);

      expect((err as any).rawResponse).toBe('Access denied');
    });

    it('throws AaFetchError RESPONSE_SHAPE on invalid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Unexpected token')),
      });

      const service = makeErc20Service();
      const err = await service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      ).catch((e: unknown) => e);

      expect((err as any).code).toBe('ZKAP_AA_FETCH_RESPONSE_SHAPE');
      expect((err as Error).message).toMatch(/invalid JSON response/);
    });

    it('throws AaFetchError RESPONSE_SHAPE on non-Error JSON parse rejection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject('parse_failure_string'),
      });

      const service = makeErc20Service();
      const err = await service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      ).catch((e: unknown) => e);

      expect((err as any).code).toBe('ZKAP_AA_FETCH_RESPONSE_SHAPE');
      expect((err as Error).message).toContain('parse_failure_string');
    });

    it('handles HTTP error with no response body gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: () => Promise.reject(new Error('body read failed')),
      });

      const service = makeErc20Service();
      const err = await service.sponsorTokenPayment(
        { chainId: 1, userOp: createMockUserOp(), tokenAddress: TOKEN_ADDRESS },
        { serviceKey: SERVICE_KEY }
      ).catch((e: unknown) => e);

      expect((err as any).code).toBe('ZKAP_AA_FETCH_HTTP_STATUS');
      expect((err as any).httpStatus).toBe(503);
      // rawResponse is empty string when text() throws
      expect((err as any).rawResponse).toBe('');
    });
  });

  // The constructor blocks unsupported modes, so the public methods'
  // fall-through throws are only reachable when an instance's state is
  // mutated post-construction. These tests inject an invalid mode to
  // exercise those defensive branches.
  describe('defensive invalid-mode branches', () => {
    function makeServiceWithInvalidMode(): PaymasterService {
      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      // `config` is `private` but not `readonly` — the field itself can be
      // reassigned via runtime reflection (Object.freeze only froze the prior
      // object's properties, not the slot on the instance).
      (service as any).config = { ...service.getConfig(), mode: 999 };
      return service;
    }

    it('getPaymasterData throws on invalid mode (runtime fall-through)', async () => {
      const service = makeServiceWithInvalidMode();
      await expect(service.getPaymasterData(createMockUserOp()))
        .rejects.toThrow('Invalid paymaster mode');
    });

    it('estimatePaymasterVerificationGasLimit throws on invalid mode (runtime fall-through)', () => {
      const service = makeServiceWithInvalidMode();
      expect(() => service.estimatePaymasterVerificationGasLimit())
        .toThrow('Invalid paymaster mode');
    });

    it('estimatePaymasterPostOpGasLimit throws on invalid mode (runtime fall-through)', () => {
      const service = makeServiceWithInvalidMode();
      expect(() => service.estimatePaymasterPostOpGasLimit())
        .toThrow('Invalid paymaster mode');
    });

    it('getPaymasterDataErc20 throws when tokenAddress is missing (direct call on VERIFYING service)', async () => {
      // VERIFYING-mode services have no tokenAddress; calling the ERC20 method
      // directly skips the getPaymasterData router and hits the in-method guard.
      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      await expect(service.getPaymasterDataErc20(createMockUserOp()))
        .rejects.toThrow('tokenAddress is required for ERC20 paymaster mode');
    });
  });
});
