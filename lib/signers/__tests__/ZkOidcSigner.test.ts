/**
 * ZkOidcSigner 테스트
 *
 * ZK 증명을 사용하여 OAuth OIDC 인증을 수행하는 Signer
 */

import { ZkOidcSigner } from '../ZkOidcSigner';
import { PrimitiveAccountKeyTypes } from '../../types/AccountKey';
import { ethers } from 'ethers';

describe('ZkOidcSigner', () => {
  describe('constructor', () => {
    it('should set keyTypes to keyZkOAuthRS256', () => {
      const signer = new ZkOidcSigner();

      expect(signer.keyTypes).toEqual([PrimitiveAccountKeyTypes.keyZkOAuthRS256]);
      expect(signer.keyTypes[0]).toBe(6);
    });
  });

  describe('setProofData', () => {
    it('should set proof data (sharedInputs, partialRhsList, proofs)', () => {
      const signer = new ZkOidcSigner();
      const mockSharedInputs = Array(7).fill('0').map((_, i) => `${i}`);
      const mockPartialRhsList = ['100', '200'];
      const mockProofs = [
        Array(8).fill('0').map((_, i) => `${i}`),
        Array(8).fill('0').map((_, i) => `${i + 100}`)
      ];

      // setProofData doesn't return anything, but should enable signing
      signer.setProofData({ sharedInputs: mockSharedInputs, partialRhsList: mockPartialRhsList, proofs: mockProofs });

      // After setting, signUserOpHash should work
      expect(async () => await signer.signUserOpHash()).not.toThrow();
    });
  });

  describe('signUserOpHash', () => {
    const mockUserOpHash = '0x' + 'ab'.repeat(32);

    it('should throw when proof data not set', async () => {
      const signer = new ZkOidcSigner();

      await expect(signer.signUserOpHash(mockUserOpHash))
        .rejects.toThrow('sharedInputs, partialRhsList, and proofs must be set before signing');
    });

    it('should return encoded signature when proof data is set', async () => {
      const signer = new ZkOidcSigner();
      const mockSharedInputs = Array(7).fill('0').map((_, i) => `${i}`);
      const mockPartialRhsList = ['100', '200'];
      const mockProofs = [
        Array(8).fill('0').map((_, i) => `${i}`),
        Array(8).fill('0').map((_, i) => `${i + 100}`)
      ];

      signer.setProofData({ sharedInputs: mockSharedInputs, partialRhsList: mockPartialRhsList, proofs: mockProofs });
      const signatures = await signer.signUserOpHash(mockUserOpHash);

      expect(Array.isArray(signatures)).toBe(true);
      expect(signatures.length).toBe(1);
      expect(signatures[0]).toMatch(/^0x/);
    });

    it('should ignore userOpHash parameter (uses proof data)', async () => {
      const signer = new ZkOidcSigner();
      const mockSharedInputs = Array(7).fill('0').map((_, i) => `${i}`);
      const mockPartialRhsList = ['100', '200'];
      const mockProofs = [
        Array(8).fill('0').map((_, i) => `${i}`),
        Array(8).fill('0').map((_, i) => `${i + 100}`)
      ];

      signer.setProofData({ sharedInputs: mockSharedInputs, partialRhsList: mockPartialRhsList, proofs: mockProofs });

      // Different hashes should produce same signature (based only on proof data)
      const sig1 = await signer.signUserOpHash('0x' + '11'.repeat(32));
      const sig2 = await signer.signUserOpHash('0x' + '22'.repeat(32));
      const sig3 = await signer.signUserOpHash(); // No hash at all

      expect(sig1[0]).toBe(sig2[0]);
      expect(sig2[0]).toBe(sig3[0]);
    });

    it('should encode as uint256[7], uint256[], uint256[8][] format', async () => {
      const signer = new ZkOidcSigner();
      const mockSharedInputs = ['1', '2', '3', '4', '5', '6', '7'];
      const mockPartialRhsList = ['100', '200'];
      const mockProofs = [
        ['10', '20', '30', '40', '50', '60', '70', '80'],
        ['11', '21', '31', '41', '51', '61', '71', '81']
      ];

      signer.setProofData({ sharedInputs: mockSharedInputs, partialRhsList: mockPartialRhsList, proofs: mockProofs });
      const signatures = await signer.signUserOpHash();

      // Should be ABI encoded
      expect(signatures[0]).toMatch(/^0x/);

      // Decode and verify structure
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const decoded = abiCoder.decode(
        ["uint256[7]", "uint256[]", "uint256[8][]"],
        signatures[0]
      );

      expect(decoded[0].length).toBe(7); // sharedInputs
      expect(decoded[1].length).toBe(2); // partialRhsList (K=2)
      expect(decoded[2].length).toBe(2); // proofs (K=2)
      expect(decoded[2][0].length).toBe(8); // 각 proof는 8요소
      expect(decoded[2][1].length).toBe(8);
    });

    it('should produce consistent signatures', async () => {
      const signer = new ZkOidcSigner();
      const mockSharedInputs = Array(7).fill('0').map((_, i) => `${i * 1000}`);
      const mockPartialRhsList = ['10000', '20000'];
      const mockProofs = [
        Array(8).fill('0').map((_, i) => `${i * 100}`),
        Array(8).fill('0').map((_, i) => `${i * 200}`)
      ];

      signer.setProofData({ sharedInputs: mockSharedInputs, partialRhsList: mockPartialRhsList, proofs: mockProofs });

      const sig1 = await signer.signUserOpHash();
      const sig2 = await signer.signUserOpHash();

      expect(sig1[0]).toBe(sig2[0]);
    });

    it('should produce different signatures for different proofs', async () => {
      const signer1 = new ZkOidcSigner();
      const signer2 = new ZkOidcSigner();

      const sharedInputs = Array(7).fill('100');
      const partialRhsList1 = ['10', '20'];
      const partialRhsList2 = ['30', '40'];
      const proofs1 = [
        Array(8).fill('1'),
        Array(8).fill('2')
      ];
      const proofs2 = [
        Array(8).fill('3'),
        Array(8).fill('4')
      ];

      signer1.setProofData({ sharedInputs, partialRhsList: partialRhsList1, proofs: proofs1 });
      signer2.setProofData({ sharedInputs, partialRhsList: partialRhsList2, proofs: proofs2 });

      const sig1 = await signer1.signUserOpHash();
      const sig2 = await signer2.signUserOpHash();

      expect(sig1[0]).not.toBe(sig2[0]);
    });
  });
});
