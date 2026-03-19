/**
 * PasskeySigner 테스트
 *
 * WebAuthn (Passkey) 기반 서명을 수행하는 Signer
 * verifyWithPasskey 콜백을 통해 브라우저의 WebAuthn API와 통신
 */

import { PasskeySigner } from '../PasskeySigner';
import { PrimitiveAccountKeyTypes } from '../../types/AccountKey';
import { base64URLencode } from '../../utils/base64url';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { wrapSignature, toHex } from '../../utils/signature';
import { ethers } from 'ethers';

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

    it('should produce base64URL challenge of exactly 43 chars from raw 32-byte hash', async () => {
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);

      await signer.signUserOpHash(mockUserOpHash);

      const challenge = mockVerifyWithPasskey.mock.calls[0][1];
      // 32 raw bytes → base64URL = ceil(32/3)*4 - padding = 43 chars
      expect(challenge.length).toBe(43);
      // base64URL alphabet only (no +, /, =)
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should produce challenge matching contract Base64.encodeURL(abi.encodePacked(bytes32(msgHash)))', async () => {
      const userOpHash = '0x' + 'ab'.repeat(32);
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);

      await signer.signUserOpHash(userOpHash);

      const challenge = mockVerifyWithPasskey.mock.calls[0][1];
      // Manually compute expected: raw bytes → base64 → base64URL
      const rawBytes = ethers.getBytes(userOpHash);
      const expected = ethers.encodeBase64(rawBytes)
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      expect(challenge).toBe(expected);
    });

    it('should NOT apply EIP-191 prefix to challenge', async () => {
      const userOpHash = '0x' + 'ff'.repeat(32);
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);

      await signer.signUserOpHash(userOpHash);

      const challenge = mockVerifyWithPasskey.mock.calls[0][1];
      // EIP-191 would produce keccak256("\x19Ethereum Signed Message:\n32" + hash),
      // which is a different 32-byte value → different base64URL.
      // The raw base64URL of 0xff repeated 32 times is deterministic:
      const rawBytes = ethers.getBytes(userOpHash);
      const expectedRaw = ethers.encodeBase64(rawBytes)
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      // If EIP-191 was applied, this would NOT match
      expect(challenge).toBe(expectedRaw);
    });

    it('should throw when clientDataJSON is missing type field', async () => {
      mockVerifyWithPasskey.mockResolvedValueOnce({
        response: {
          signature: createMockDerSignature(),
          authenticatorData: base64URLencode('authdata123'),
          clientDataJSON: base64URLencode('{"challenge":"mockchallenge","origin":"https://example.com"}'),
        },
      });
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);
      await expect(signer.signUserOpHash(mockUserOpHash))
        .rejects.toThrow('clientDataJSON missing "type" field');
    });

    it('should throw when clientDataJSON is missing challenge field', async () => {
      mockVerifyWithPasskey.mockResolvedValueOnce({
        response: {
          signature: createMockDerSignature(),
          authenticatorData: base64URLencode('authdata123'),
          clientDataJSON: base64URLencode('{"type":"webauthn.get","origin":"https://example.com"}'),
        },
      });
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);
      await expect(signer.signUserOpHash(mockUserOpHash))
        .rejects.toThrow('clientDataJSON missing "challenge" field');
    });

    it('should throw when clientDataJSON is too short for pattern matching', async () => {
      mockVerifyWithPasskey.mockResolvedValueOnce({
        response: {
          signature: createMockDerSignature(),
          authenticatorData: base64URLencode('authdata123'),
          clientDataJSON: base64URLencode('{}'),
        },
      });
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);
      await expect(signer.signUserOpHash(mockUserOpHash))
        .rejects.toThrow('clientDataJSON missing "type" field');
    });

    it('should throw when clientDataJSON is missing origin field', async () => {
      mockVerifyWithPasskey.mockResolvedValueOnce({
        response: {
          signature: createMockDerSignature(),
          authenticatorData: base64URLencode('authdata123'),
          clientDataJSON: base64URLencode('{"type":"webauthn.get","challenge":"mockchallenge"}'),
        },
      });
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);
      await expect(signer.signUserOpHash(mockUserOpHash))
        .rejects.toThrow('clientDataJSON missing "origin" field');
    });

    it('should throw when clientDataJSON origin value is not terminated', async () => {
      mockVerifyWithPasskey.mockResolvedValueOnce({
        response: {
          signature: createMockDerSignature(),
          authenticatorData: base64URLencode('authdata123'),
          clientDataJSON: base64URLencode('{"type":"webauthn.get","challenge":"mockchallenge","origin":"https://example.com'),
        },
      });
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);
      await expect(signer.signUserOpHash(mockUserOpHash))
        .rejects.toThrow('clientDataJSON "origin" value not terminated');
    });

    it('should encode byte offsets even when clientDataJSON contains non-ASCII bytes', async () => {
      const clientJson =
        '{"emoji":"😀","type":"webauthn.get","challenge":"mockchallenge","origin":"https://example.com"}';
      mockVerifyWithPasskey.mockResolvedValueOnce({
        response: {
          signature: createMockDerSignature(),
          authenticatorData: base64URLencode('authdata123'),
          clientDataJSON: base64URLencode(clientJson),
        },
      });
      const signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);
      const signatures = await signer.signUserOpHash(mockUserOpHash);
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["bytes", "bytes", "bytes", "uint256", "uint256", "uint256", "uint256"],
        signatures[0]
      );

      const clientDataBytes = Buffer.from(ethers.getBytes(decoded[1]));
      const typePattern = Buffer.from('"type":"');
      const challengePattern = Buffer.from('"challenge":"');
      const originPattern = Buffer.from('"origin":"');
      const expectedTypeIndex = clientDataBytes.indexOf(typePattern) + typePattern.length;
      const expectedChallengeIndex = clientDataBytes.indexOf(challengePattern) + challengePattern.length;
      const expectedOriginIndex = clientDataBytes.indexOf(originPattern) + originPattern.length;

      expect(decoded[3]).toBe(BigInt(expectedTypeIndex));
      expect(decoded[4]).toBe(BigInt(expectedChallengeIndex));
      expect(decoded[5]).toBe(BigInt(expectedOriginIndex));
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
