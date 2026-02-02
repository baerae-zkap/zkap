/**
 * 공통 Mock 헬퍼 함수 - ZKAP AA SDK용
 */

import { PrimitiveAccountKeyTypes } from '../../types/AccountKey';

/**
 * Mock JsonRpcProvider 생성
 * ZkapBuilder, ZkapAccount 등에서 사용
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
 * Mock EntryPoint Contract 생성
 */
export const createMockEntryPointContract = () => ({
  getNonce: jest.fn().mockResolvedValue(BigInt(0)),
  handleOps: jest.fn().mockResolvedValue({ wait: jest.fn() }),
});

/**
 * IUserOpSigner Mock 생성
 * 주의: IUserOpSigner 인터페이스에는 signUserOpHash만 있음
 * keyTypes는 구현체(PasskeySigner, ZkOidcSigner 등)에만 있음
 */
export const createMockSigner = () => ({
  signUserOpHash: jest.fn().mockResolvedValue(['0xmocksignature']),
});

/**
 * PasskeySigner용 verifyWithPasskey 콜백 Mock
 */
export const createMockVerifyWithPasskey = () =>
  jest.fn().mockResolvedValue({
    response: {
      // base64url 인코딩된 값들
      signature: 'MEUCIQDmocksignaturebase64urlencoded',
      authenticatorData: 'SZYN5YgOjGh0NBcPZHZgW4mockauthdata',
      clientDataJSON: 'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoibW9ja2NoYWxsZW5nZSIsIm9yaWdpbiI6Imh0dHBzOi8vYXBwLmV4YW1wbGUuY29tIn0',
    },
  });

/**
 * fetch Mock 생성 - PaymasterService용
 */
export const createMockFetch = () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch;
  return mockFetch;
};

/**
 * Paymaster 성공 응답 Mock
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
 * Paymaster 에러 응답 Mock
 */
export const mockPaymasterErrorResponse = (message: string = 'Error') => ({
  ok: true,
  json: async () => ({
    error: { message },
  }),
});

/**
 * HTTP 에러 응답 Mock
 */
export const mockHttpErrorResponse = (status: number = 500, statusText: string = 'Internal Server Error') => ({
  ok: false,
  status,
  statusText,
});

/**
 * AddressKeySigner용 Mock
 */
export const createMockAddressKeySigner = () => ({
  keyTypes: [PrimitiveAccountKeyTypes.keyAddress],
  signUserOpHash: jest.fn().mockResolvedValue(['0xmockaddresssig']),
});

/**
 * PasskeySigner용 Mock
 */
export const createMockPasskeySigner = () => ({
  keyTypes: [PrimitiveAccountKeyTypes.keyWebAuthn],
  signUserOpHash: jest.fn().mockResolvedValue(['0xmockpasskeysig']),
});

/**
 * ZkOidcSigner용 Mock
 */
export const createMockZkOidcSigner = () => ({
  keyTypes: [PrimitiveAccountKeyTypes.keyZkOAuthRS256],
  signUserOpHash: jest.fn().mockResolvedValue(['0xmockzkoidcsig']),
});
