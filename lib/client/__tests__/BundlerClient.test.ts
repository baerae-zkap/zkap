/**
 * Tests for BundlerClient, BundlerProvider, BundlerError, and classifyBundlerError
 */

import { BundlerClient } from '../BundlerClient';
import { ZkapBundlerProvider, Erc4337BundlerProvider } from '../BundlerProvider';
import { BundlerError } from '../types';
import type { BundlerProvider, UserOpReceipt, UserOpStatus } from '../types';
import type { PackedUserOperation } from '../../types/UserOperation';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePackedUserOp(overrides?: Partial<PackedUserOperation>): PackedUserOperation {
  return {
    sender: '0x' + '11'.repeat(20),
    nonce: '0x0',
    initCode: '0x',
    callData: '0x',
    accountGasLimits: '0x' + '00'.repeat(16) + '00'.repeat(16),
    preVerificationGas: '0x5208',
    gasFees: '0x' + '00'.repeat(16) + '00'.repeat(16),
    paymasterAndData: '0x',
    signature: '0x',
    ...overrides,
  };
}

const MOCK_USER_OP_HASH = '0x' + 'ab'.repeat(32);
const MOCK_ENTRY_POINT = '0x' + '5F'.padStart(40, '5');

function makeReceipt(success = true): UserOpReceipt {
  return {
    userOpHash: MOCK_USER_OP_HASH,
    txHash: '0x' + 'cc'.repeat(32),
    blockNumber: 1000,
    success,
    actualGasCost: '21000',
    actualGasUsed: '21000',
  };
}

// ---------------------------------------------------------------------------
// Mock BundlerProvider for BundlerClient unit tests
// ---------------------------------------------------------------------------

function makeMockProvider(overrides?: Partial<BundlerProvider>): BundlerProvider {
  return {
    submitUserOp: jest.fn().mockResolvedValue(MOCK_USER_OP_HASH),
    getStatus: jest.fn().mockResolvedValue('included' as UserOpStatus),
    getReceipt: jest.fn().mockResolvedValue(makeReceipt()),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// BundlerClient
// ---------------------------------------------------------------------------

describe('BundlerClient', () => {
  describe('submitUserOp', () => {
    it('delegates to provider and returns userOpHash', async () => {
      const provider = makeMockProvider();
      const client = new BundlerClient(provider);
      const userOp = makePackedUserOp();

      const hash = await client.submitUserOp(userOp, MOCK_ENTRY_POINT);

      expect(hash).toBe(MOCK_USER_OP_HASH);
      expect(provider.submitUserOp).toHaveBeenCalledWith(userOp, MOCK_ENTRY_POINT);
    });

    it('propagates provider errors', async () => {
      const provider = makeMockProvider({
        submitUserOp: jest.fn().mockRejectedValue(new BundlerError('rejected', 'BUNDLER_REJECTED', false)),
      });
      const client = new BundlerClient(provider);

      await expect(client.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
        .rejects.toThrow('rejected');
    });
  });

  describe('getStatus', () => {
    it('delegates to provider', async () => {
      const provider = makeMockProvider({
        getStatus: jest.fn().mockResolvedValue('pending' as UserOpStatus),
      });
      const client = new BundlerClient(provider);

      const status = await client.getStatus(MOCK_USER_OP_HASH);

      expect(status).toBe('pending');
      expect(provider.getStatus).toHaveBeenCalledWith(MOCK_USER_OP_HASH);
    });
  });

  describe('waitForReceipt', () => {
    it('returns receipt immediately when status is included', async () => {
      const receipt = makeReceipt(true);
      const provider = makeMockProvider({
        getStatus: jest.fn().mockResolvedValue('included' as UserOpStatus),
        getReceipt: jest.fn().mockResolvedValue(receipt),
      });
      const client = new BundlerClient(provider);

      const result = await client.waitForReceipt(MOCK_USER_OP_HASH, { pollInterval: 10, timeout: 5000 });

      expect(result).toEqual(receipt);
      expect(provider.getStatus).toHaveBeenCalledTimes(1);
    });

    it('returns receipt when status is failed', async () => {
      const receipt = makeReceipt(false);
      const provider = makeMockProvider({
        getStatus: jest.fn().mockResolvedValue('failed' as UserOpStatus),
        getReceipt: jest.fn().mockResolvedValue(receipt),
      });
      const client = new BundlerClient(provider);

      const result = await client.waitForReceipt(MOCK_USER_OP_HASH, { pollInterval: 10, timeout: 5000 });

      expect(result.success).toBe(false);
    });

    it('polls until included status is found', async () => {
      const getStatus = jest.fn()
        .mockResolvedValueOnce('pending' as UserOpStatus)
        .mockResolvedValueOnce('pending' as UserOpStatus)
        .mockResolvedValueOnce('included' as UserOpStatus);
      const provider = makeMockProvider({ getStatus, getReceipt: jest.fn().mockResolvedValue(makeReceipt()) });
      const client = new BundlerClient(provider);

      const result = await client.waitForReceipt(MOCK_USER_OP_HASH, { pollInterval: 10, timeout: 5000 });

      expect(getStatus).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('builds a fallback receipt when getReceipt returns null for included status', async () => {
      const provider = makeMockProvider({
        getStatus: jest.fn().mockResolvedValue('included' as UserOpStatus),
        getReceipt: jest.fn().mockResolvedValue(null),
      });
      const client = new BundlerClient(provider);

      const result = await client.waitForReceipt(MOCK_USER_OP_HASH, { pollInterval: 10, timeout: 5000 });

      expect(result.userOpHash).toBe(MOCK_USER_OP_HASH);
      expect(result.success).toBe(true);
      expect(result.txHash).toBe('');
      expect(result.blockNumber).toBe(0);
    });

    it('builds a fallback receipt when getReceipt returns null for failed status', async () => {
      const provider = makeMockProvider({
        getStatus: jest.fn().mockResolvedValue('failed' as UserOpStatus),
        getReceipt: jest.fn().mockResolvedValue(null),
      });
      const client = new BundlerClient(provider);

      const result = await client.waitForReceipt(MOCK_USER_OP_HASH, { pollInterval: 10, timeout: 5000 });

      expect(result.success).toBe(false);
    });

    it('throws BundlerError with BUNDLER_TIMEOUT code on timeout', async () => {
      const provider = makeMockProvider({
        getStatus: jest.fn().mockResolvedValue('pending' as UserOpStatus),
      });
      const client = new BundlerClient(provider);

      await expect(
        client.waitForReceipt(MOCK_USER_OP_HASH, { pollInterval: 10, timeout: 50 })
      ).rejects.toThrow(BundlerError);

      await expect(
        client.waitForReceipt(MOCK_USER_OP_HASH, { pollInterval: 10, timeout: 50 })
      ).rejects.toMatchObject({ code: 'BUNDLER_TIMEOUT', retryable: false });
    });

    it('timeout error message contains userOpHash and timeout value', async () => {
      const provider = makeMockProvider({
        getStatus: jest.fn().mockResolvedValue('not_found' as UserOpStatus),
      });
      const client = new BundlerClient(provider);

      await expect(
        client.waitForReceipt(MOCK_USER_OP_HASH, { pollInterval: 10, timeout: 50 })
      ).rejects.toThrow(MOCK_USER_OP_HASH.slice(0, 10));
    });

    it('uses default poll interval and timeout when options not provided', async () => {
      // This test just verifies the client doesn't throw immediately with defaults.
      // We use a very fast-resolving mock so it exits the loop before real timeout.
      const provider = makeMockProvider({
        getStatus: jest.fn().mockResolvedValue('included' as UserOpStatus),
        getReceipt: jest.fn().mockResolvedValue(makeReceipt()),
      });
      const client = new BundlerClient(provider);

      const result = await client.waitForReceipt(MOCK_USER_OP_HASH);
      expect(result.userOpHash).toBe(MOCK_USER_OP_HASH);
    });
  });
});

// ---------------------------------------------------------------------------
// BundlerError
// ---------------------------------------------------------------------------

describe('BundlerError', () => {
  it('has correct name, code, and retryable flag', () => {
    const err = new BundlerError('msg', 'AA21_INSUFFICIENT_FUNDS', false);
    expect(err.name).toBe('BundlerError');
    expect(err.code).toBe('AA21_INSUFFICIENT_FUNDS');
    expect(err.retryable).toBe(false);
    expect(err.message).toBe('msg');
    expect(err).toBeInstanceOf(Error);
  });

  it('retryable defaults to false', () => {
    const err = new BundlerError('msg', 'BUNDLER_REJECTED');
    expect(err.retryable).toBe(false);
  });

  it('retryable can be set to true', () => {
    const err = new BundlerError('network issue', 'NETWORK_ERROR', true);
    expect(err.retryable).toBe(true);
  });

  it('is instanceof BundlerError and Error', () => {
    const err = new BundlerError('msg', 'BUNDLER_TIMEOUT', false);
    expect(err instanceof BundlerError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ZkapBundlerProvider
// ---------------------------------------------------------------------------

describe('ZkapBundlerProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('submitUserOp', () => {
    it('sends POST to /api/v1/bundler/submit-direct with userOp', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ userOpHash: MOCK_USER_OP_HASH }),
      });

      const provider = new ZkapBundlerProvider();
      const userOp = makePackedUserOp();
      const hash = await provider.submitUserOp(userOp, MOCK_ENTRY_POINT);

      expect(hash).toBe(MOCK_USER_OP_HASH);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.zkap.app/api/v1/bundler/submit-direct',
        expect.objectContaining({ method: 'POST' })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.userOp).toEqual(userOp);
    });

    it('uses custom baseUrl from config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ userOpHash: MOCK_USER_OP_HASH }),
      });

      const provider = new ZkapBundlerProvider({ baseUrl: 'https://custom.api.example.com' });
      await provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.api.example.com/api/v1/bundler/submit-direct',
        expect.any(Object)
      );
    });

    it('strips trailing slash from baseUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ userOpHash: MOCK_USER_OP_HASH }),
      });

      const provider = new ZkapBundlerProvider({ baseUrl: 'https://custom.api.example.com/' });
      await provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.api.example.com/api/v1/bundler/submit-direct',
        expect.any(Object)
      );
    });

    it('throws BundlerError with NETWORK_ERROR on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const provider = new ZkapBundlerProvider();
      await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
        .rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
    });

    it('throws classified BundlerError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('AA21: insufficient funds'),
      });

      const provider = new ZkapBundlerProvider();
      await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
        .rejects.toThrow(BundlerError);
    });

    it('throws BUNDLER_REJECTED when response missing userOpHash', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const provider = new ZkapBundlerProvider();
      await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
        .rejects.toMatchObject({ code: 'BUNDLER_REJECTED' });
    });
  });

  describe('getStatus', () => {
    it('returns not_found on 404', async () => {
      mockFetch.mockResolvedValueOnce({ status: 404, ok: false });

      const provider = new ZkapBundlerProvider();
      const status = await provider.getStatus(MOCK_USER_OP_HASH);

      expect(status).toBe('not_found');
    });

    it('returns included for success status values', async () => {
      for (const s of ['included', 'confirmed', 'success']) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: s }),
        });
        const provider = new ZkapBundlerProvider();
        expect(await provider.getStatus(MOCK_USER_OP_HASH)).toBe('included');
      }
    });

    it('returns failed for failed/reverted status', async () => {
      for (const s of ['failed', 'reverted']) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: s }),
        });
        const provider = new ZkapBundlerProvider();
        expect(await provider.getStatus(MOCK_USER_OP_HASH)).toBe('failed');
      }
    });

    it('returns pending for pending/submitted status', async () => {
      for (const s of ['pending', 'submitted']) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: s }),
        });
        const provider = new ZkapBundlerProvider();
        expect(await provider.getStatus(MOCK_USER_OP_HASH)).toBe('pending');
      }
    });

    it('returns not_found for unknown status string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'unknown_status' }),
      });
      const provider = new ZkapBundlerProvider();
      expect(await provider.getStatus(MOCK_USER_OP_HASH)).toBe('not_found');
    });

    it('throws NETWORK_ERROR on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      const provider = new ZkapBundlerProvider();
      await expect(provider.getStatus(MOCK_USER_OP_HASH))
        .rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
    });

    it('throws NETWORK_ERROR on non-ok non-404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });
      const provider = new ZkapBundlerProvider();
      await expect(provider.getStatus(MOCK_USER_OP_HASH))
        .rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    });
  });

  describe('getReceipt', () => {
    it('returns null when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network'));
      const provider = new ZkapBundlerProvider();
      expect(await provider.getReceipt(MOCK_USER_OP_HASH)).toBeNull();
    });

    it('returns null when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const provider = new ZkapBundlerProvider();
      expect(await provider.getReceipt(MOCK_USER_OP_HASH)).toBeNull();
    });

    it('returns null for pending status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'pending' }),
      });
      const provider = new ZkapBundlerProvider();
      expect(await provider.getReceipt(MOCK_USER_OP_HASH)).toBeNull();
    });

    it('returns receipt for included status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'included',
          bundleHash: '0x' + 'cc'.repeat(32),
          blockNumber: 999,
          actualGasCost: '50000',
          actualGasUsed: '21000',
        }),
      });
      const provider = new ZkapBundlerProvider();
      const receipt = await provider.getReceipt(MOCK_USER_OP_HASH);

      expect(receipt).not.toBeNull();
      expect(receipt!.userOpHash).toBe(MOCK_USER_OP_HASH);
      expect(receipt!.success).toBe(true);
      expect(receipt!.blockNumber).toBe(999);
    });

    it('returns receipt with success=false for failed status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'failed' }),
      });
      const provider = new ZkapBundlerProvider();
      const receipt = await provider.getReceipt(MOCK_USER_OP_HASH);
      expect(receipt!.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Erc4337BundlerProvider
// ---------------------------------------------------------------------------

describe('Erc4337BundlerProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('submitUserOp', () => {
    it('sends eth_sendUserOperation JSON-RPC with userOp and entryPoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: MOCK_USER_OP_HASH }),
      });

      const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
      const userOp = makePackedUserOp();
      const hash = await provider.submitUserOp(userOp, MOCK_ENTRY_POINT);

      expect(hash).toBe(MOCK_USER_OP_HASH);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.method).toBe('eth_sendUserOperation');
      expect(callBody.params[0]).toEqual(userOp);
      expect(callBody.params[1]).toBe(MOCK_ENTRY_POINT);
      expect(callBody.jsonrpc).toBe('2.0');
    });

    it('throws classified BundlerError when JSON-RPC returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          error: { message: 'AA21 insufficient funds for gas' },
        }),
      });

      const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
      await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
        .rejects.toMatchObject({ code: 'AA21_INSUFFICIENT_FUNDS', retryable: false });
    });

    it('throws NETWORK_ERROR on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('connection refused'));

      const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
      await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
        .rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
    });
  });

  describe('getStatus', () => {
    it('returns not_found when receipt is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: null }),
      });

      const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
      expect(await provider.getStatus(MOCK_USER_OP_HASH)).toBe('not_found');
    });

    it('returns included when receipt.success is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: { success: true } }),
      });

      const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
      expect(await provider.getStatus(MOCK_USER_OP_HASH)).toBe('included');
    });

    it('returns failed when receipt.success is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: { success: false } }),
      });

      const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
      expect(await provider.getStatus(MOCK_USER_OP_HASH)).toBe('failed');
    });
  });

  describe('getReceipt', () => {
    it('returns null when rpcCall returns null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: null }),
      });

      const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
      expect(await provider.getReceipt(MOCK_USER_OP_HASH)).toBeNull();
    });

    it('returns UserOpReceipt with transactionHash when result has transactionHash', async () => {
      const txHash = '0x' + 'dd'.repeat(32);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            transactionHash: txHash,
            blockNumber: 12345,
            success: true,
            actualGasCost: '100000',
            actualGasUsed: '80000',
          },
        }),
      });

      const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
      const receipt = await provider.getReceipt(MOCK_USER_OP_HASH);

      expect(receipt).not.toBeNull();
      expect(receipt!.txHash).toBe(txHash);
      expect(receipt!.blockNumber).toBe(12345);
      expect(receipt!.success).toBe(true);
      expect(receipt!.actualGasCost).toBe('100000');
      expect(receipt!.actualGasUsed).toBe('80000');
      expect(receipt!.userOpHash).toBe(MOCK_USER_OP_HASH);
    });

    it('falls back to txHash when transactionHash is absent', async () => {
      const txHash = '0x' + 'ee'.repeat(32);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            txHash,
            blockNumber: 999,
            success: false,
            actualGasCost: '0',
            actualGasUsed: '0',
          },
        }),
      });

      const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
      const receipt = await provider.getReceipt(MOCK_USER_OP_HASH);

      expect(receipt!.txHash).toBe(txHash);
      expect(receipt!.success).toBe(false);
    });

    it('returns empty string txHash when neither transactionHash nor txHash present', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: { blockNumber: 100, success: true },
        }),
      });

      const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
      const receipt = await provider.getReceipt(MOCK_USER_OP_HASH);

      expect(receipt!.txHash).toBe('');
      expect(receipt!.blockNumber).toBe(100);
    });
  });
});

// ---------------------------------------------------------------------------
// classifyBundlerError (tested via ZkapBundlerProvider/Erc4337BundlerProvider behaviour)
// ---------------------------------------------------------------------------

describe('classifyBundlerError (via Erc4337BundlerProvider)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  function makeRpcError(message: string) {
    return mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ error: { message } }),
    });
  }

  it('classifies AA21 (case-insensitive) as AA21_INSUFFICIENT_FUNDS, not retryable', async () => {
    makeRpcError('AA21: insufficient funds for gas * price + value');
    const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
    await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
      .rejects.toMatchObject({ code: 'AA21_INSUFFICIENT_FUNDS', retryable: false });
  });

  it('classifies AA21 uppercase as AA21_INSUFFICIENT_FUNDS', async () => {
    makeRpcError('AA21 insufficient funds');
    const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
    await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
      .rejects.toMatchObject({ code: 'AA21_INSUFFICIENT_FUNDS' });
  });

  it('classifies AA25 as AA25_NONCE_ERROR, not retryable', async () => {
    makeRpcError('AA25 invalid account nonce');
    const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
    await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
      .rejects.toMatchObject({ code: 'AA25_NONCE_ERROR', retryable: false });
  });

  it('classifies AA40 as AA40_PAYMASTER_ERROR', async () => {
    makeRpcError('AA40 over verification gas limit');
    const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
    await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
      .rejects.toMatchObject({ code: 'AA40_PAYMASTER_ERROR', retryable: false });
  });

  it('classifies AA41 as AA40_PAYMASTER_ERROR', async () => {
    makeRpcError('AA41 too little verification gas');
    const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
    await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
      .rejects.toMatchObject({ code: 'AA40_PAYMASTER_ERROR' });
  });

  it('classifies network errors as NETWORK_ERROR, retryable', async () => {
    makeRpcError('network error: connection refused');
    const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
    await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
      .rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
  });

  it('classifies fetch errors as NETWORK_ERROR, retryable', async () => {
    makeRpcError('fetch failed: connection reset');
    const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
    await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
      .rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
  });

  it('classifies AA31 as AA40_PAYMASTER_ERROR', async () => {
    makeRpcError('AA31 paymaster deposit too low');
    const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
    await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
      .rejects.toMatchObject({ code: 'AA40_PAYMASTER_ERROR' });
  });

  it('classifies AA32 as AA40_PAYMASTER_ERROR', async () => {
    makeRpcError('AA32 paymaster expired or not due');
    const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
    await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
      .rejects.toMatchObject({ code: 'AA40_PAYMASTER_ERROR' });
  });

  it('classifies econnrefused as NETWORK_ERROR', async () => {
    makeRpcError('ECONNREFUSED connection refused');
    const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
    await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
      .rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
  });

  it('classifies unknown errors as BUNDLER_REJECTED, not retryable', async () => {
    makeRpcError('some unknown bundler rejection');
    const provider = new Erc4337BundlerProvider({ rpcUrl: 'https://bundler.example.com' });
    await expect(provider.submitUserOp(makePackedUserOp(), MOCK_ENTRY_POINT))
      .rejects.toMatchObject({ code: 'BUNDLER_REJECTED', retryable: false });
  });
});
