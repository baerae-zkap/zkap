/**
 * AddressKeySigner 테스트
 *
 * EOA 개인키로 UserOp에 서명하는 Signer
 */

import { AddressKeySigner } from '../AddressKeySigner';
import { PrimitiveAccountKeyTypes } from '../../types/AccountKey';

// 테스트용 개인키 (절대 실제 사용 금지!)
const TEST_PRIVATE_KEY_1 = '0x' + '11'.repeat(32);
const TEST_PRIVATE_KEY_2 = '0x' + '22'.repeat(32);

describe('AddressKeySigner', () => {
  describe('constructor', () => {
    it('should set keyTypes to keyAddress', () => {
      const signer = new AddressKeySigner([TEST_PRIVATE_KEY_1]);

      expect(signer.keyTypes).toEqual([PrimitiveAccountKeyTypes.keyAddress]);
      expect(signer.keyTypes[0]).toBe(1);
    });

    it('should accept multiple private keys', () => {
      const signer = new AddressKeySigner([TEST_PRIVATE_KEY_1, TEST_PRIVATE_KEY_2]);

      expect(signer.keyTypes).toEqual([PrimitiveAccountKeyTypes.keyAddress]);
    });

    it('should accept empty private keys array', () => {
      const signer = new AddressKeySigner([]);

      expect(signer.keyTypes).toEqual([PrimitiveAccountKeyTypes.keyAddress]);
    });
  });

  describe('signUserOpHash', () => {
    const mockUserOpHash = '0x' + 'ab'.repeat(32);

    it('should sign with single private key', async () => {
      const signer = new AddressKeySigner([TEST_PRIVATE_KEY_1]);

      const signatures = await signer.signUserOpHash(mockUserOpHash);

      expect(Array.isArray(signatures)).toBe(true);
      expect(signatures.length).toBe(1);
      expect(signatures[0]).toMatch(/^0x[0-9a-f]+$/i);
    });

    it('should sign with multiple private keys', async () => {
      const signer = new AddressKeySigner([TEST_PRIVATE_KEY_1, TEST_PRIVATE_KEY_2]);

      const signatures = await signer.signUserOpHash(mockUserOpHash);

      expect(signatures.length).toBe(2);
      expect(signatures[0]).not.toBe(signatures[1]); // Different keys produce different sigs
    });

    it('should return empty array for empty private keys', async () => {
      const signer = new AddressKeySigner([]);

      const signatures = await signer.signUserOpHash(mockUserOpHash);

      expect(signatures).toEqual([]);
    });

    it('should produce consistent signatures for same input', async () => {
      const signer = new AddressKeySigner([TEST_PRIVATE_KEY_1]);

      const sig1 = await signer.signUserOpHash(mockUserOpHash);
      const sig2 = await signer.signUserOpHash(mockUserOpHash);

      expect(sig1[0]).toBe(sig2[0]);
    });

    it('should produce different signatures for different hashes', async () => {
      const signer = new AddressKeySigner([TEST_PRIVATE_KEY_1]);

      const hash1 = '0x' + '11'.repeat(32);
      const hash2 = '0x' + '22'.repeat(32);

      const sig1 = await signer.signUserOpHash(hash1);
      const sig2 = await signer.signUserOpHash(hash2);

      expect(sig1[0]).not.toBe(sig2[0]);
    });

    it('should produce valid Ethereum signature format', async () => {
      const signer = new AddressKeySigner([TEST_PRIVATE_KEY_1]);

      const signatures = await signer.signUserOpHash(mockUserOpHash);

      // Ethereum signature is 65 bytes (r:32 + s:32 + v:1) = 130 hex chars + '0x'
      expect(signatures[0].length).toBe(132);
    });
  });
});
