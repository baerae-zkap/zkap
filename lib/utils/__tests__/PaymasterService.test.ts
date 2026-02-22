/**
 * PaymasterService 테스트
 *
 * Paymaster 서버와 통신하여 paymaster 데이터를 가져오는 서비스
 * - VERIFYING 모드: 기본 paymaster 검증
 * - ERC20 모드: ERC20 토큰으로 가스비 지불
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
      const service = new PaymasterService(config);

      await expect(service.getPaymasterData(createMockUserOp()))
        .rejects.toThrow('Invalid paymaster mode');
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
        json: () => Promise.resolve({ result: { paymasterData: '0xabcd' } }), // userOp 없음
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
      const service = new PaymasterService(config);

      expect(() => service.estimatePaymasterVerificationGasLimit())
        .toThrow('Invalid paymaster mode');
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
      const service = new PaymasterService(config);

      expect(() => service.estimatePaymasterPostOpGasLimit())
        .toThrow('Invalid paymaster mode');
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

    it('should rethrow non-abort fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const service = new PaymasterService(createMockConfig(PaymasterMode.VERIFYING));
      await expect(service.getPaymasterData(createMockUserOp()))
        .rejects.toThrow('Connection refused');
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
});
