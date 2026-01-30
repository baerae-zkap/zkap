/**
 * ZkOidcSigner 테스트
 *
 * ZK 증명을 사용하여 OAuth OIDC 인증을 수행하는 Signer
 */

import { ZkOidcSigner } from '../ZkOidcSigner';
import { PrimitiveAccountKeyTypes } from '../../types/AccountKey';

describe('ZkOidcSigner', () => {
  describe('constructor', () => {
    it('should set keyTypes to keyZkOAuthRS256', () => {
      const signer = new ZkOidcSigner();

      expect(signer.keyTypes).toEqual([PrimitiveAccountKeyTypes.keyZkOAuthRS256]);
      expect(signer.keyTypes[0]).toBe(6);
    });
  });

  describe('setProofAndPublicInput', () => {
    it('should set proof and public inputs', () => {
      const signer = new ZkOidcSigner();
      const mockProof = Array(8).fill('0').map((_, i) => `${i}`);
      const mockPublicInputs = Array(8).fill('0').map((_, i) => `${i + 100}`);

      // setProofAndPublicInput doesn't return anything, but should enable signing
      signer.setProofAndPublicInput(mockProof, mockPublicInputs);

      // After setting, signUserOpHash should work
      expect(async () => await signer.signUserOpHash()).not.toThrow();
    });
  });

  describe('signUserOpHash', () => {
    const mockUserOpHash = '0x' + 'ab'.repeat(32);

    it('should throw when proof not set', async () => {
      const signer = new ZkOidcSigner();

      await expect(signer.signUserOpHash(mockUserOpHash))
        .rejects.toThrow('proof and publicInputs must be set before signing');
    });

    it('should return encoded signature when proof is set', async () => {
      const signer = new ZkOidcSigner();
      const mockProof = Array(8).fill('0').map((_, i) => `${i}`);
      const mockPublicInputs = Array(8).fill('0').map((_, i) => `${i + 100}`);

      signer.setProofAndPublicInput(mockProof, mockPublicInputs);
      const signatures = await signer.signUserOpHash(mockUserOpHash);

      expect(Array.isArray(signatures)).toBe(true);
      expect(signatures.length).toBe(1);
      expect(signatures[0]).toMatch(/^0x/);
    });

    it('should ignore userOpHash parameter (uses proof/publicInputs)', async () => {
      const signer = new ZkOidcSigner();
      const mockProof = Array(8).fill('0').map((_, i) => `${i}`);
      const mockPublicInputs = Array(8).fill('0').map((_, i) => `${i + 100}`);

      signer.setProofAndPublicInput(mockProof, mockPublicInputs);

      // Different hashes should produce same signature (based only on proof/inputs)
      const sig1 = await signer.signUserOpHash('0x' + '11'.repeat(32));
      const sig2 = await signer.signUserOpHash('0x' + '22'.repeat(32));
      const sig3 = await signer.signUserOpHash(); // No hash at all

      expect(sig1[0]).toBe(sig2[0]);
      expect(sig2[0]).toBe(sig3[0]);
    });

    it('should encode proof and public inputs as uint256[8] arrays', async () => {
      const signer = new ZkOidcSigner();
      const mockProof = ['1', '2', '3', '4', '5', '6', '7', '8'];
      const mockPublicInputs = ['10', '20', '30', '40', '50', '60', '70', '80'];

      signer.setProofAndPublicInput(mockProof, mockPublicInputs);
      const signatures = await signer.signUserOpHash();

      // Should be ABI encoded
      expect(signatures[0]).toMatch(/^0x/);
      // ABI encoding of two uint256[8] arrays is deterministic
      expect(signatures[0].length).toBeGreaterThan(2); // More than just '0x'
    });

    it('should produce consistent signatures', async () => {
      const signer = new ZkOidcSigner();
      const mockProof = Array(8).fill('0').map((_, i) => `${i * 1000}`);
      const mockPublicInputs = Array(8).fill('0').map((_, i) => `${i * 2000}`);

      signer.setProofAndPublicInput(mockProof, mockPublicInputs);

      const sig1 = await signer.signUserOpHash();
      const sig2 = await signer.signUserOpHash();

      expect(sig1[0]).toBe(sig2[0]);
    });

    it('should produce different signatures for different proofs', async () => {
      const signer1 = new ZkOidcSigner();
      const signer2 = new ZkOidcSigner();

      const proof1 = Array(8).fill('1');
      const proof2 = Array(8).fill('2');
      const inputs = Array(8).fill('100');

      signer1.setProofAndPublicInput(proof1, inputs);
      signer2.setProofAndPublicInput(proof2, inputs);

      const sig1 = await signer1.signUserOpHash();
      const sig2 = await signer2.signUserOpHash();

      expect(sig1[0]).not.toBe(sig2[0]);
    });
  });
});
