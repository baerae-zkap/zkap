/**
 * userOpUtils 테스트
 *
 * - packUserOperation: UserOperation → PackedUserOperation
 * - unpackUserOperation: PackedUserOperation → UserOperation
 * - createDummyPasskeySignature: 7-field ABI encoded dummy
 * - createDummyZkSignature: 1-of-1 or 3-of-3 dummy ZK proof
 */

import { ethers } from 'ethers';
import {
  packUserOperation,
  unpackUserOperation,
  createDummyPasskeySignature,
  createDummyZkSignature,
} from '../userOpUtils';
import type { UserOperation, PackedUserOperation } from '../../types/UserOperation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUserOp(overrides?: Partial<UserOperation>): UserOperation {
  return {
    sender: '0x' + '11'.repeat(20),
    nonce: '0x1',
    initCode: '0x',
    callData: '0x' + 'ab'.repeat(4),
    callGasLimit: '0x5208',            // 21000
    verificationGasLimit: '0x186a0',   // 100000
    preVerificationGas: '0x6190',
    maxFeePerGas: '0x3b9aca00',
    maxPriorityFeePerGas: '0x77359400',
    paymaster: '0x0000000000000000000000000000000000000000',
    paymasterData: '0x',
    paymasterVerificationGasLimit: '0x0',
    paymasterPostOpGasLimit: '0x0',
    signature: '0x',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// packUserOperation
// ---------------------------------------------------------------------------

describe('packUserOperation', () => {
  it('packs accountGasLimits as verificationGasLimit (16B) || callGasLimit (16B)', () => {
    const userOp = makeUserOp({
      verificationGasLimit: '0x186a0',  // 100000
      callGasLimit: '0x5208',           // 21000
    });

    const packed = packUserOperation(userOp);

    // accountGasLimits should be 64 hex chars (32 bytes) + 0x prefix
    expect(packed.accountGasLimits).toMatch(/^0x[0-9a-fA-F]{64}$/);

    // The hex of 100000 should be in the first 32 chars, 21000 in the next 32
    const raw = packed.accountGasLimits.slice(2);
    const verGas = BigInt('0x' + raw.slice(0, 32));
    const callGas = BigInt('0x' + raw.slice(32, 64));
    expect(verGas).toBe(BigInt(100000));
    expect(callGas).toBe(BigInt(21000));
  });

  it('packs gasFees as maxPriorityFeePerGas (16B) || maxFeePerGas (16B)', () => {
    const userOp = makeUserOp({
      maxPriorityFeePerGas: '0x77359400', // 2000000000
      maxFeePerGas: '0x3b9aca00',          // 1000000000
    });

    const packed = packUserOperation(userOp);

    expect(packed.gasFees).toMatch(/^0x[0-9a-fA-F]{64}$/);

    const raw = packed.gasFees.slice(2);
    const maxPriority = BigInt('0x' + raw.slice(0, 32));
    const maxFee = BigInt('0x' + raw.slice(32, 64));
    expect(maxPriority).toBe(BigInt(2000000000));
    expect(maxFee).toBe(BigInt(1000000000));
  });

  it('sets paymasterAndData to 0x when paymaster is ZeroAddress', () => {
    const userOp = makeUserOp({
      paymaster: '0x0000000000000000000000000000000000000000',
    });

    const packed = packUserOperation(userOp);
    expect(packed.paymasterAndData).toBe('0x');
  });

  it('sets paymasterAndData to 0x when paymaster is "0x" (empty)', () => {
    const userOp = makeUserOp({
      paymaster: '0x',
    });

    const packed = packUserOperation(userOp);
    expect(packed.paymasterAndData).toBe('0x');
  });

  it('sets paymasterAndData to 0x when paymaster is undefined (falls back to ZeroAddress)', () => {
    const userOp = makeUserOp({
      paymaster: undefined as unknown as string,
    });

    const packed = packUserOperation(userOp);
    expect(packed.paymasterAndData).toBe('0x');
  });

  it('packs paymasterAndData with paymasterData omitting 0x prefix', () => {
    const paymasterAddr = '0x' + 'BB'.repeat(20);
    const userOp = makeUserOp({
      paymaster: paymasterAddr,
      paymasterVerificationGasLimit: '0x0',
      paymasterPostOpGasLimit: '0x0',
      paymasterData: 'cafebabe', // no 0x prefix
    });

    const packed = packUserOperation(userOp);
    expect(packed.paymasterAndData).not.toBe('0x');
    // paymasterData without 0x prefix should be included raw
    expect(packed.paymasterAndData.toLowerCase()).toContain('cafebabe');
  });

  it('packs paymasterAndData with missing paymasterVerificationGasLimit and paymasterPostOpGasLimit (defaults to 0x0)', () => {
    const paymasterAddr = '0x' + 'CC'.repeat(20);
    const userOp = makeUserOp({
      paymaster: paymasterAddr,
      paymasterVerificationGasLimit: undefined as unknown as string,
      paymasterPostOpGasLimit: undefined as unknown as string,
      paymasterData: '0x',
    });

    const packed = packUserOperation(userOp);
    expect(packed.paymasterAndData).not.toBe('0x');
    const raw = packed.paymasterAndData.slice(2);
    // paymaster address (40 chars) + pmVerGas (32 chars) + pmPostGas (32 chars)
    expect(raw.length).toBeGreaterThanOrEqual(40 + 64);
  });

  it('handles gas limit values without 0x prefix in padTo16Bytes', () => {
    // Pass gas values without 0x prefix to exercise the non-0x branch in padTo16Bytes
    const userOp = makeUserOp({
      verificationGasLimit: '186a0',   // no 0x prefix
      callGasLimit: '5208',            // no 0x prefix
      maxPriorityFeePerGas: '77359400',
      maxFeePerGas: '3b9aca00',
    });

    const packed = packUserOperation(userOp);
    const raw = packed.accountGasLimits.slice(2);
    const verGas = BigInt('0x' + raw.slice(0, 32));
    const callGas = BigInt('0x' + raw.slice(32, 64));
    expect(verGas).toBe(BigInt(0x186a0));
    expect(callGas).toBe(BigInt(0x5208));
  });

  it('handles paymaster address without 0x prefix', () => {
    // paymaster without 0x to exercise the non-0x branch in paymasterClean
    const paymasterAddrNoPrefix = 'DD'.repeat(20); // 40 chars, no 0x
    const userOp = makeUserOp({
      paymaster: paymasterAddrNoPrefix,
      paymasterVerificationGasLimit: '0x0',
      paymasterPostOpGasLimit: '0x0',
      paymasterData: '0x',
    });

    const packed = packUserOperation(userOp);
    expect(packed.paymasterAndData).not.toBe('0x');
    const raw = packed.paymasterAndData.slice(2);
    expect(raw.slice(0, 40).toLowerCase()).toBe('dd'.repeat(20));
  });

  it('packs paymasterAndData when paymaster is set', () => {
    const paymasterAddr = '0x' + 'AA'.repeat(20);
    const userOp = makeUserOp({
      paymaster: paymasterAddr,
      paymasterVerificationGasLimit: '0x6978', // 27000
      paymasterPostOpGasLimit: '0x0',
      paymasterData: '0xdeadbeef',
    });

    const packed = packUserOperation(userOp);

    expect(packed.paymasterAndData).not.toBe('0x');
    // Should start with paymaster address (40 hex chars after 0x)
    const raw = packed.paymasterAndData.slice(2);
    expect(raw.slice(0, 40).toLowerCase()).toBe('aa'.repeat(20));
  });

  it('passes through sender, nonce, initCode, callData, preVerificationGas, signature', () => {
    const userOp = makeUserOp({
      sender: '0x' + 'BB'.repeat(20),
      nonce: '0x5',
      initCode: '0xdeadbeef',
      callData: '0xcafebabe',
      preVerificationGas: '0x1000',
      signature: '0xsig',
    });

    const packed = packUserOperation(userOp);

    expect(packed.sender).toBe(userOp.sender);
    expect(packed.nonce).toBe(userOp.nonce);
    expect(packed.initCode).toBe(userOp.initCode);
    expect(packed.callData).toBe(userOp.callData);
    expect(packed.preVerificationGas).toBe(userOp.preVerificationGas);
    expect(packed.signature).toBe(userOp.signature);
  });
});

// ---------------------------------------------------------------------------
// unpackUserOperation
// ---------------------------------------------------------------------------

describe('unpackUserOperation', () => {
  it('reverses packUserOperation (round-trip)', () => {
    const original = makeUserOp({
      paymaster: '0x0000000000000000000000000000000000000000',
      verificationGasLimit: '0x' + (100000).toString(16),
      callGasLimit: '0x' + (21000).toString(16),
      maxPriorityFeePerGas: '0x' + (2000000000).toString(16),
      maxFeePerGas: '0x' + (1000000000).toString(16),
    });

    const packed = packUserOperation(original);
    const unpacked = unpackUserOperation(packed);

    // Gas values should round-trip (normalised as 0x-prefixed hex)
    expect(BigInt(unpacked.verificationGasLimit)).toBe(BigInt(original.verificationGasLimit));
    expect(BigInt(unpacked.callGasLimit)).toBe(BigInt(original.callGasLimit));
    expect(BigInt(unpacked.maxFeePerGas)).toBe(BigInt(original.maxFeePerGas));
    expect(BigInt(unpacked.maxPriorityFeePerGas)).toBe(BigInt(original.maxPriorityFeePerGas));
    expect(unpacked.sender).toBe(original.sender);
    expect(unpacked.nonce).toBe(original.nonce);
    expect(unpacked.signature).toBe(original.signature);
  });

  it('extracts paymaster address from paymasterAndData', () => {
    const paymasterAddr = '0x' + 'CC'.repeat(20);
    const userOp = makeUserOp({
      paymaster: paymasterAddr,
      paymasterVerificationGasLimit: '0x6978',
      paymasterPostOpGasLimit: '0x0',
      paymasterData: '0x',
    });

    const packed = packUserOperation(userOp);
    const unpacked = unpackUserOperation(packed);

    expect(unpacked.paymaster.toLowerCase()).toBe(paymasterAddr.toLowerCase());
  });

  it('returns ZeroAddress paymaster when paymasterAndData is 0x', () => {
    const packed: PackedUserOperation = {
      sender: '0x' + '11'.repeat(20),
      nonce: '0x0',
      initCode: '0x',
      callData: '0x',
      accountGasLimits: '0x' + '00'.repeat(32),
      preVerificationGas: '0x5208',
      gasFees: '0x' + '00'.repeat(32),
      paymasterAndData: '0x',
      signature: '0x',
    };

    const unpacked = unpackUserOperation(packed);
    expect(unpacked.paymaster).toBe(ethers.ZeroAddress);
  });

  it('extracts only paymaster address when paymasterAndData has exactly 40 hex chars (no gas fields)', () => {
    // pad = exactly 40 hex chars (20 bytes = address only, no pmVerGas/pmPostGas/pmData)
    const paymasterAddr = 'AA'.repeat(20); // 40 hex chars, no 0x
    const packed: PackedUserOperation = {
      sender: '0x' + '11'.repeat(20),
      nonce: '0x0',
      initCode: '0x',
      callData: '0x',
      accountGasLimits: '0x' + '00'.repeat(32),
      preVerificationGas: '0x5208',
      gasFees: '0x' + '00'.repeat(32),
      paymasterAndData: '0x' + paymasterAddr,
      signature: '0x',
    };

    const unpacked = unpackUserOperation(packed);
    expect(unpacked.paymaster.toLowerCase()).toBe('0x' + 'aa'.repeat(20));
    // Gas limits should remain at defaults since pad.length < 40 + 64
    expect(unpacked.paymasterVerificationGasLimit).toBe('0x0');
    expect(unpacked.paymasterPostOpGasLimit).toBe('0x0');
    expect(unpacked.paymasterData).toBe('0x');
  });

  it('extracts paymasterData when pad has address + gas fields + extra data', () => {
    const paymasterAddr = 'CC'.repeat(20);          // 40 chars
    const pmVerGas = '00'.repeat(16);               // 32 chars
    const pmPostGas = '00'.repeat(16);              // 32 chars
    const pmData = 'deadbeef';                       // extra data
    const pad = paymasterAddr + pmVerGas + pmPostGas + pmData;

    const packed: PackedUserOperation = {
      sender: '0x' + '11'.repeat(20),
      nonce: '0x0',
      initCode: '0x',
      callData: '0x',
      accountGasLimits: '0x' + '00'.repeat(32),
      preVerificationGas: '0x5208',
      gasFees: '0x' + '00'.repeat(32),
      paymasterAndData: '0x' + pad,
      signature: '0x',
    };

    const unpacked = unpackUserOperation(packed);
    expect(unpacked.paymaster.toLowerCase()).toBe('0x' + 'cc'.repeat(20));
    expect(unpacked.paymasterData.toLowerCase()).toBe('0xdeadbeef');
  });
});

// ---------------------------------------------------------------------------
// createDummyPasskeySignature
// ---------------------------------------------------------------------------

describe('createDummyPasskeySignature', () => {
  it('returns a 0x-prefixed hex string', () => {
    const sig = createDummyPasskeySignature();
    expect(typeof sig).toBe('string');
    expect(sig.startsWith('0x')).toBe(true);
  });

  it('produces ABI encoding decodable as 7 fields', () => {
    const sig = createDummyPasskeySignature();

    // Should be decodable as (bytes, bytes, bytes, uint256, uint256, uint256, uint256)
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['bytes', 'bytes', 'bytes', 'uint256', 'uint256', 'uint256', 'uint256'],
      sig
    );

    expect(decoded).toHaveLength(7);
    // typeIndex, challengeIndex, originIndex, originLength should be MaxUint256
    expect(decoded[3]).toBe(ethers.MaxUint256);
    expect(decoded[4]).toBe(ethers.MaxUint256);
    expect(decoded[5]).toBe(ethers.MaxUint256);
    expect(decoded[6]).toBe(ethers.MaxUint256);
  });

  it('authenticatorData is 37 bytes', () => {
    const sig = createDummyPasskeySignature();
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['bytes', 'bytes', 'bytes', 'uint256', 'uint256', 'uint256', 'uint256'],
      sig
    );
    // ethers decodes bytes as hex strings; hex length = bytes * 2 + 2 (0x prefix)
    const hexStr = decoded[0] as string;
    const byteLength = (hexStr.length - 2) / 2;
    expect(byteLength).toBe(37);
  });

  it('clientDataJSON is 200 bytes', () => {
    const sig = createDummyPasskeySignature();
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['bytes', 'bytes', 'bytes', 'uint256', 'uint256', 'uint256', 'uint256'],
      sig
    );
    const hexStr = decoded[1] as string;
    const byteLength = (hexStr.length - 2) / 2;
    expect(byteLength).toBe(200);
  });

  it('DER-encoded signature field is 72 bytes', () => {
    const sig = createDummyPasskeySignature();
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['bytes', 'bytes', 'bytes', 'uint256', 'uint256', 'uint256', 'uint256'],
      sig
    );
    const hexStr = decoded[2] as string;
    const byteLength = (hexStr.length - 2) / 2;
    expect(byteLength).toBe(72);
  });
});

// ---------------------------------------------------------------------------
// createDummyZkSignature
// ---------------------------------------------------------------------------

describe('createDummyZkSignature', () => {
  it('returns a 0x-prefixed hex string', () => {
    expect(createDummyZkSignature(1).startsWith('0x')).toBe(true);
    expect(createDummyZkSignature(3).startsWith('0x')).toBe(true);
  });

  it('produces valid 1-of-1 ABI encoding when n=1', () => {
    const sig = createDummyZkSignature(1);
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256[6]', 'uint256[]', 'uint256[]', 'uint256[8][]'],
      sig
    );

    expect(decoded[0]).toHaveLength(6); // public inputs
    expect((decoded[1] as bigint[]).length).toBe(1); // 1 secret
    expect((decoded[2] as bigint[]).length).toBe(1); // 1 zkNonce
    expect((decoded[3] as bigint[][]).length).toBe(1); // 1 proof
  });

  it('produces valid 3-of-3 ABI encoding when n=3', () => {
    const sig = createDummyZkSignature(3);
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256[6]', 'uint256[]', 'uint256[]', 'uint256[8][]'],
      sig
    );

    expect((decoded[1] as bigint[]).length).toBe(3); // 3 secrets
    expect((decoded[2] as bigint[]).length).toBe(3); // 3 zkNonces
    expect((decoded[3] as bigint[][]).length).toBe(3); // 3 proofs
  });

  it('n>=3 produces 3-of-3 encoding', () => {
    const sig4 = createDummyZkSignature(4);
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256[6]', 'uint256[]', 'uint256[]', 'uint256[8][]'],
      sig4
    );
    expect((decoded[1] as bigint[]).length).toBe(3);
  });

  it('each proof entry has 8 elements (uint256[8])', () => {
    const sig = createDummyZkSignature(1);
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256[6]', 'uint256[]', 'uint256[]', 'uint256[8][]'],
      sig
    );
    const proofs = decoded[3] as bigint[][];
    expect(proofs[0]).toHaveLength(8);
  });

  it('all values are MaxUint256 (dummy)', () => {
    const sig = createDummyZkSignature(1);
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256[6]', 'uint256[]', 'uint256[]', 'uint256[8][]'],
      sig
    );
    // Public inputs (first field)
    for (const v of decoded[0] as bigint[]) {
      expect(v).toBe(ethers.MaxUint256);
    }
    // Proof entries
    const proofs = decoded[3] as bigint[][];
    for (const proof of proofs) {
      for (const v of proof) {
        expect(v).toBe(ethers.MaxUint256);
      }
    }
  });
});
