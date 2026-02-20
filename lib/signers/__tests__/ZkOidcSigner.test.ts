/**
 * ZkOidcSigner 테스트
 *
 * ZK 증명을 사용하여 OAuth OIDC 인증을 수행하는 Signer
 */

import { ZkOidcSigner } from '../ZkOidcSigner';
import { PrimitiveAccountKeyTypes } from '../../types/AccountKey';
import { ethers } from 'ethers';

// sharedInputs[3] = userOpHash mod SNARK_SCALAR_FIELD
const SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
function computeHSignUserOp(userOpHash: string): string {
  return (BigInt(userOpHash) % SNARK_SCALAR_FIELD).toString();
}

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
      const userOpHash = '0x' + 'ab'.repeat(32);
      const signer = new ZkOidcSigner();
      const mockSharedInputs = Array(7).fill('0').map((_, i) => i === 3 ? computeHSignUserOp(userOpHash) : `${i}`);
      const mockPartialRhsList = ['100', '200'];
      const mockProofs = [
        Array(8).fill('0').map((_, i) => `${i}`),
        Array(8).fill('0').map((_, i) => `${i + 100}`)
      ];

      // setProofData doesn't return anything, but should enable signing
      signer.setProofData({ sharedInputs: mockSharedInputs, partialRhsList: mockPartialRhsList, proofs: mockProofs });

      // After setting, signUserOpHash should work
      expect(async () => await signer.signUserOpHash(userOpHash)).not.toThrow();
    });

    it('should throw when sharedInputs is not 7 elements', () => {
      const signer = new ZkOidcSigner();
      expect(() => signer.setProofData({
        sharedInputs: ['1', '2', '3'],
        partialRhsList: ['100'],
        proofs: [Array(8).fill('0')],
      })).toThrow('setProofData: sharedInputs must be an array of 7 elements, got 3');
    });

    it('should throw when partialRhsList is not an array', () => {
      const signer = new ZkOidcSigner();
      expect(() => signer.setProofData({
        sharedInputs: Array(7).fill('0'),
        partialRhsList: 'not-array' as any,
        proofs: [Array(8).fill('0')],
      })).toThrow('setProofData: partialRhsList must be an array');
    });

    it('should throw when proofs is empty', () => {
      const signer = new ZkOidcSigner();
      expect(() => signer.setProofData({
        sharedInputs: Array(7).fill('0'),
        partialRhsList: [],
        proofs: [],
      })).toThrow('setProofData: proofs must be a non-empty array');
    });

    it('should throw when partialRhsList.length !== proofs.length', () => {
      const signer = new ZkOidcSigner();
      expect(() => signer.setProofData({
        sharedInputs: Array(7).fill('0'),
        partialRhsList: ['100'],
        proofs: [Array(8).fill('0'), Array(8).fill('0')],
      })).toThrow('setProofData: partialRhsList.length (1) must equal proofs.length (2)');
    });

    it('should throw when a proof element is not 8 elements', () => {
      const signer = new ZkOidcSigner();
      expect(() => signer.setProofData({
        sharedInputs: Array(7).fill('0'),
        partialRhsList: ['100', '200'],
        proofs: [Array(8).fill('0'), Array(5).fill('0')],
      })).toThrow('setProofData: proofs[1] must be an array of 8 elements, got 5');
    });

    it('should throw when sharedInputs contains non-numeric string', () => {
      const signer = new ZkOidcSigner();
      expect(() => signer.setProofData({
        sharedInputs: ['0', '1', '2', 'abc', '4', '5', '6'],
        partialRhsList: ['100'],
        proofs: [Array(8).fill('0')],
      })).toThrow('setProofData: sharedInputs[3] must be a numeric string');
    });

    it('should throw when sharedInputs contains hex string', () => {
      const signer = new ZkOidcSigner();
      expect(() => signer.setProofData({
        sharedInputs: ['0x123', '1', '2', '3', '4', '5', '6'],
        partialRhsList: ['100'],
        proofs: [Array(8).fill('0')],
      })).toThrow('setProofData: sharedInputs[0] must be a numeric string');
    });

    it('should throw when partialRhsList element is out of BN254 scalar field range', () => {
      const signer = new ZkOidcSigner();
      // BN254_FR = 21888242871839275222246405745257275088548364400416034343698204186575808495617
      const outOfRange = '21888242871839275222246405745257275088548364400416034343698204186575808495618'; // BN254_FR + 1
      expect(() => signer.setProofData({
        sharedInputs: Array(7).fill('0'),
        partialRhsList: [outOfRange],
        proofs: [Array(8).fill('0')],
      })).toThrow('partialRhsList[0] is out of BN254 scalar field range');
    });

    it('should throw when proofs element is out of BN254 scalar field range', () => {
      const signer = new ZkOidcSigner();
      const outOfRange = '21888242871839275222246405745257275088548364400416034343698204186575808495618'; // BN254_FR + 1
      const proofsWithOutOfRange = [Array(8).fill('0')];
      proofsWithOutOfRange[0][3] = outOfRange;
      expect(() => signer.setProofData({
        sharedInputs: Array(7).fill('0'),
        partialRhsList: ['100'],
        proofs: proofsWithOutOfRange,
      })).toThrow('proofs[0][3] is out of BN254 scalar field range');
    });

    it('should throw when sharedInputs element is out of BN254 scalar field range', () => {
      const signer = new ZkOidcSigner();
      const outOfRange = '21888242871839275222246405745257275088548364400416034343698204186575808495618'; // BN254_FR + 1
      expect(() => signer.setProofData({
        sharedInputs: ['0', '0', '0', outOfRange, '0', '0', '0'],
        partialRhsList: ['100'],
        proofs: [Array(8).fill('0')],
      })).toThrow('sharedInputs[3] is out of BN254 scalar field range');
    });
  });

  describe('signUserOpHash', () => {
    const mockUserOpHash = '0x' + 'ab'.repeat(32);

    it('should throw when proof data not set', async () => {
      const signer = new ZkOidcSigner();

      await expect(signer.signUserOpHash(mockUserOpHash))
        .rejects.toThrow('sharedInputs, partialRhsList, and proofs must be set before signing');
    });

    it('should throw when userOpHash is not a valid 32-byte hex string', async () => {
      const signer = new ZkOidcSigner();
      const mockSharedInputs = Array(7).fill('0').map((_, i) => i === 3 ? computeHSignUserOp(mockUserOpHash) : `${i}`);
      signer.setProofData({
        sharedInputs: mockSharedInputs,
        partialRhsList: ['100'],
        proofs: [Array(8).fill('0')],
      });

      await expect(signer.signUserOpHash('invalid-hash'))
        .rejects.toThrow('userOpHash must be a 0x-prefixed 32-byte hex string');
    });

    it('should throw when sharedInputs[3] does not match userOpHash mod SNARK_SCALAR_FIELD', async () => {
      const signer = new ZkOidcSigner();
      // sharedInputs[3] = "3" which won't match the computed value for mockUserOpHash
      const wrongSharedInputs = Array(7).fill('0').map((_, i) => `${i}`);
      const mockPartialRhsList = ['100', '200'];
      const mockProofs = [
        Array(8).fill('0').map((_, i) => `${i}`),
        Array(8).fill('0').map((_, i) => `${i + 100}`)
      ];

      signer.setProofData({ sharedInputs: wrongSharedInputs, partialRhsList: mockPartialRhsList, proofs: mockProofs });

      await expect(signer.signUserOpHash(mockUserOpHash))
        .rejects.toThrow('signUserOpHash: proof does not match userOpHash. sharedInputs[3] must equal userOpHash mod SNARK_SCALAR_FIELD');
    });

    it('should return encoded signature when proof data is set with correct sharedInputs[3]', async () => {
      const signer = new ZkOidcSigner();
      const mockSharedInputs = Array(7).fill('0').map((_, i) => i === 3 ? computeHSignUserOp(mockUserOpHash) : `${i}`);
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

    it('should throw when signing with different userOpHash than sharedInputs[3] binding', async () => {
      const signer = new ZkOidcSigner();
      const hashA = '0x' + '11'.repeat(32);
      const hashB = '0x' + '22'.repeat(32);
      // sharedInputs[3] matches hashA
      const mockSharedInputs = Array(7).fill('0').map((_, i) => i === 3 ? computeHSignUserOp(hashA) : `${i}`);
      const mockPartialRhsList = ['100', '200'];
      const mockProofs = [
        Array(8).fill('0').map((_, i) => `${i}`),
        Array(8).fill('0').map((_, i) => `${i + 100}`)
      ];

      signer.setProofData({ sharedInputs: mockSharedInputs, partialRhsList: mockPartialRhsList, proofs: mockProofs });

      // Signing with hashB should fail since sharedInputs[3] was computed for hashA
      await expect(signer.signUserOpHash(hashB))
        .rejects.toThrow('signUserOpHash: proof does not match userOpHash. sharedInputs[3] must equal userOpHash mod SNARK_SCALAR_FIELD');
    });

    it('should encode as uint256[7], uint256[], uint256[8][] format', async () => {
      const signer = new ZkOidcSigner();
      const testUserOpHash = '0x' + 'ab'.repeat(32);
      const mockSharedInputs = ['1', '2', '3', computeHSignUserOp(testUserOpHash), '5', '6', '7'];
      const mockPartialRhsList = ['100', '200'];
      const mockProofs = [
        ['10', '20', '30', '40', '50', '60', '70', '80'],
        ['11', '21', '31', '41', '51', '61', '71', '81']
      ];

      signer.setProofData({ sharedInputs: mockSharedInputs, partialRhsList: mockPartialRhsList, proofs: mockProofs });
      const signatures = await signer.signUserOpHash(testUserOpHash);

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

    it('should produce consistent signatures for same userOpHash', async () => {
      const signer = new ZkOidcSigner();
      const testUserOpHash = '0x' + 'ab'.repeat(32);
      const mockSharedInputs = Array(7).fill('0').map((_, i) => i === 3 ? computeHSignUserOp(testUserOpHash) : `${i * 1000}`);
      const mockPartialRhsList = ['10000', '20000'];
      const mockProofs = [
        Array(8).fill('0').map((_, i) => `${i * 100}`),
        Array(8).fill('0').map((_, i) => `${i * 200}`)
      ];

      signer.setProofData({ sharedInputs: mockSharedInputs, partialRhsList: mockPartialRhsList, proofs: mockProofs });

      const sig1 = await signer.signUserOpHash(testUserOpHash);
      const sig2 = await signer.signUserOpHash(testUserOpHash);

      expect(sig1[0]).toBe(sig2[0]);
    });

    it('should produce different signatures for different proofs (with correct hash bindings)', async () => {
      const signer1 = new ZkOidcSigner();
      const signer2 = new ZkOidcSigner();

      const testUserOpHash = '0x' + 'ab'.repeat(32);
      const hSignUserOp = computeHSignUserOp(testUserOpHash);

      const sharedInputs1 = Array(7).fill('100').map((v, i) => i === 3 ? hSignUserOp : v);
      const sharedInputs2 = Array(7).fill('100').map((v, i) => i === 3 ? hSignUserOp : v);
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

      signer1.setProofData({ sharedInputs: sharedInputs1, partialRhsList: partialRhsList1, proofs: proofs1 });
      signer2.setProofData({ sharedInputs: sharedInputs2, partialRhsList: partialRhsList2, proofs: proofs2 });

      const sig1 = await signer1.signUserOpHash(testUserOpHash);
      const sig2 = await signer2.signUserOpHash(testUserOpHash);

      expect(sig1[0]).not.toBe(sig2[0]);
    });
  });
});
