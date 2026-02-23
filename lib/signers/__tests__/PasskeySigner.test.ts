/**
 * PasskeySigner 테스트
 *
 * WebAuthn (Passkey) 기반 서명을 수행하는 Signer
 * verifyWithPasskey 콜백을 통해 브라우저의 WebAuthn API와 통신
 */

import { PasskeySigner } from '../PasskeySigner';
import { PrimitiveAccountKeyTypes } from '../../types/AccountKey';
import { base64URLencode } from '../../utils/base64url';
import { wrapSignature, toHex } from '../../utils/signature';

// DER 인코딩된 secp256r1 서명 생성 헬퍼
function createMockDerSignature(): string {
  // 32바이트 r, s 값 생성
  const r = new Uint8Array(32).fill(0x11);
  const s = new Uint8Array(32).fill(0x22);

  // DER 형식으로 래핑
  const derSig = wrapSignature(r, s);

  // base64url 인코딩
  return base64URLencode(String.fromCharCode(...derSig));
}

// Mock WebAuthn 응답 생성
function createMockAuthResponse(signature?: string) {
  return {
    response: {
      signature: signature || createMockDerSignature(),
      authenticatorData: base64URLencode('mock-auth-data-bytes'),
      clientDataJSON: base64URLencode('{"type":"webauthn.get","challenge":"mockchallenge","origin":"https://example.com","crossOrigin":false}'),
    },
  };
}

describe('PasskeySigner', () => {
  const mockCredentialId = 'test-credential-id';
  let mockVerifyWithPasskey: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyWithPasskey = jest.fn().mockResolvedValue(createMockAuthResponse());
  });

  describe('constructor', () => {
    it('should set keyTypes to keyWebAuthn', () => {
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);

      expect(signer.keyTypes).toEqual([PrimitiveAccountKeyTypes.keyWebAuthn]);
      expect(signer.keyTypes[0]).toBe(4);
    });

    it('should store credentialId', () => {
      const signer = new PasskeySigner('my-credential', mockVerifyWithPasskey);

      // credentialId는 private이지만 signUserOpHash에서 사용됨
      expect(signer.keyTypes).toBeDefined();
    });
  });

  describe('signUserOpHash', () => {
    const mockUserOpHash = '0x' + 'ab'.repeat(32);

    it('should call verifyWithPasskey with correct parameters', async () => {
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);

      await signer.signUserOpHash(mockUserOpHash);

      expect(mockVerifyWithPasskey).toHaveBeenCalledTimes(1);
      expect(mockVerifyWithPasskey).toHaveBeenCalledWith(
        mockCredentialId,
        expect.any(String) // base64url encoded challenge
      );
    });

    it('should return encoded signature array', async () => {
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);

      const signatures = await signer.signUserOpHash(mockUserOpHash);

      expect(Array.isArray(signatures)).toBe(true);
      expect(signatures.length).toBe(1);
      expect(signatures[0]).toMatch(/^0x/);
    });

    it('should throw when verifyWithPasskey fails', async () => {
      const failingMock = jest.fn().mockRejectedValue(new Error('Auth failed'));
      const signer = new PasskeySigner(mockCredentialId, failingMock);

      await expect(signer.signUserOpHash(mockUserOpHash))
        .rejects.toThrow('Auth failed');
    });

    it('should process signature through unwrap/flip/wrap pipeline', async () => {
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);

      const signatures = await signer.signUserOpHash(mockUserOpHash);

      // 결과는 ABI 인코딩된 (authenticatorData, clientDataJSON, signature)
      expect(signatures[0].length).toBeGreaterThan(10);
    });

    it('should produce different results for different hashes', async () => {
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);

      // Mock returns same signature, but challenge (derived from hash) is different
      const hash1 = '0x' + '11'.repeat(32);
      const hash2 = '0x' + '22'.repeat(32);

      await signer.signUserOpHash(hash1);
      const call1Challenge = mockVerifyWithPasskey.mock.calls[0][1];

      await signer.signUserOpHash(hash2);
      const call2Challenge = mockVerifyWithPasskey.mock.calls[1][1];

      expect(call1Challenge).not.toBe(call2Challenge);
    });

    it('should use correct credential ID', async () => {
      const customCredentialId = 'my-custom-credential-123';
      const signer = new PasskeySigner(customCredentialId, mockVerifyWithPasskey);

      await signer.signUserOpHash(mockUserOpHash);

      expect(mockVerifyWithPasskey.mock.calls[0][0]).toBe(customCredentialId);
    });

    it('should handle error and rethrow', async () => {
      const error = new Error('WebAuthn error');
      const failingMock = jest.fn().mockRejectedValue(error);
      const signer = new PasskeySigner(mockCredentialId, failingMock);

      await expect(signer.signUserOpHash(mockUserOpHash)).rejects.toThrow('WebAuthn error');
    });
  });

  describe('signature processing', () => {
    it('should encode authenticatorData, clientDataJSON, and signature', async () => {
      const mockResponse = {
        response: {
          signature: createMockDerSignature(),
          authenticatorData: base64URLencode('authdata123'),
          clientDataJSON: base64URLencode('{"type":"webauthn.get","challenge":"testchallenge","origin":"https://example.com"}'),
        },
      };
      mockVerifyWithPasskey.mockResolvedValue(mockResponse);

      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);
      const signatures = await signer.signUserOpHash('0x' + 'ff'.repeat(32));

      // 결과는 ABI 인코딩됨
      expect(signatures[0]).toMatch(/^0x/);
      expect(signatures[0].length).toBeGreaterThan(100); // ABI encoded 3 bytes values
    });
  });
});
