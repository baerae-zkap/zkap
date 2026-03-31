/**
 * Common mock helper functions for the ZKAP AA SDK
 */

import { PrimitiveAccountKeyTypes } from '../../types/AccountKey';

/**
 * Create a mock JsonRpcProvider
 * Used by ZkapBuilder, ZkapAccount, etc.
 */
export const createMockProvider = () => ({
  getCode: jest.fn().mockResolvedValue('0x'),
  estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
  getFeeData: jest.fn().mockResolvedValue({
    gasPrice: BigInt(1000000000),
    maxFeePerGas: BigInt(2000000000),
    maxPriorityFeePerGas: BigInt(1000000000),
  }),
});

/**
 * Create a mock EntryPoint Contract
 */
export const createMockEntryPointContract = () => ({
  getNonce: jest.fn().mockResolvedValue(BigInt(0)),
  handleOps: jest.fn().mockResolvedValue({ wait: jest.fn() }),
});

/**
 * Create an IUserOpSigner mock
 * Note: the IUserOpSigner interface only has signUserOpHash
 * keyTypes exists only on concrete implementations (PasskeySigner, ZkOidcSigner, etc.)
 */
export const createMockSigner = () => ({
  signUserOpHash: jest.fn().mockResolvedValue(['0xmocksignature']),
});

/**
 * Mock verifyWithPasskey callback for PasskeySigner
 */
export const createMockVerifyWithPasskey = () =>
  jest.fn().mockResolvedValue({
    response: {
      // base64url-encoded values
      signature: 'MEUCIQDmocksignaturebase64urlencoded',
      authenticatorData: 'SZYN5YgOjGh0NBcPZHZgW4mockauthdata',
      clientDataJSON: 'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoibW9ja2NoYWxsZW5nZSIsIm9yaWdpbiI6Imh0dHBzOi8vYXBwLmV4YW1wbGUuY29tIn0',
    },
  });

/**
 * Create a fetch mock for PaymasterService
 */
export const createMockFetch = () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch;
  return mockFetch;
};

/**
 * Mock successful Paymaster response
 */
export const mockPaymasterSuccessResponse = (paymasterData: string = '0xpaymasterdata') => ({
  ok: true,
  json: async () => ({
    result: {
      userOp: { paymasterData },
    },
  }),
});

/**
 * Mock Paymaster error response
 */
export const mockPaymasterErrorResponse = (message: string = 'Error') => ({
  ok: true,
  json: async () => ({
    error: { message },
  }),
});

/**
 * Mock HTTP error response
 */
export const mockHttpErrorResponse = (status: number = 500, statusText: string = 'Internal Server Error') => ({
  ok: false,
  status,
  statusText,
});

/**
 * Mock for AddressKeySigner
 */
export const createMockAddressKeySigner = () => ({
  keyTypes: [PrimitiveAccountKeyTypes.keyAddress],
  signUserOpHash: jest.fn().mockResolvedValue(['0xmockaddresssig']),
});

/**
 * Mock for PasskeySigner
 */
export const createMockPasskeySigner = () => ({
  keyTypes: [PrimitiveAccountKeyTypes.keyWebAuthn],
  signUserOpHash: jest.fn().mockResolvedValue(['0xmockpasskeysig']),
});

/**
 * Mock for ZkOidcSigner
 */
export const createMockZkOidcSigner = () => ({
  keyTypes: [PrimitiveAccountKeyTypes.keyZkOAuthRS256],
  signUserOpHash: jest.fn().mockResolvedValue(['0xmockzkoidcsig']),
});
