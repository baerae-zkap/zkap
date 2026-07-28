/**
 * salt utility tests
 *
 * - computeSalt(aud, sub): keccak256(abi.encode(string, string)) → 0x hex
 * - computeSalt(aud, sub, walletIndex): optional 3rd arg selects an alternate
 *   wallet derived from the same (aud, sub) identity (walletIndex 1-255) via
 *   keccak256(abi.encode(string, string, string)). walletIndex 0/undefined
 *   are byte-identical to the 2-arg path (backward compatibility).
 *
 * shared cross-repo salt vectors — generated via ethers v6 AbiCoder+keccak256,
 * plan host-wallet-sequential-cloud (2026-07-28). Mirrors: embedded-zkap
 * src/core/crypto/__tests__/salt.test.ts, zkap-web3-server intent-policy spec
 */

import { ethers } from 'ethers';
import { computeSalt } from '../salt';
import { AaOperationError } from '../../errors';

describe('computeSalt', () => {
  it('returns a 0x-prefixed 32-byte hex string (66 chars total)', () => {
    const salt = computeSalt('myaud', 'mysub');
    expect(typeof salt).toBe('string');
    expect(salt).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it('is deterministic for the same aud and sub', () => {
    const a = computeSalt('google-client-id', 'user-sub-12345');
    const b = computeSalt('google-client-id', 'user-sub-12345');
    expect(a).toBe(b);
  });

  it('produces different results for different aud values', () => {
    const a = computeSalt('aud-A', 'same-sub');
    const b = computeSalt('aud-B', 'same-sub');
    expect(a).not.toBe(b);
  });

  it('produces different results for different sub values', () => {
    const a = computeSalt('same-aud', 'sub-1');
    const b = computeSalt('same-aud', 'sub-2');
    expect(a).not.toBe(b);
  });

  it('handles empty string aud', () => {
    const salt = computeSalt('', 'some-sub');
    expect(salt).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it('handles empty string sub', () => {
    const salt = computeSalt('some-aud', '');
    expect(salt).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it('handles both aud and sub empty', () => {
    const salt = computeSalt('', '');
    expect(salt).toMatch(/^0x[0-9a-fA-F]{64}$/);
    // Not the zero hash — it's keccak256 of ABI-encoded empty strings
    expect(salt).not.toBe('0x' + '00'.repeat(32));
  });

  it('matches known keccak256(abi.encode(string,string)) value', () => {
    // Pre-compute expected: keccak256(abi.encode("aud-test", "sub-test"))
    const expected = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['string', 'string'],
        ['aud-test', 'sub-test']
      )
    );
    expect(computeSalt('aud-test', 'sub-test')).toBe(expected);
  });

  it('handles long strings', () => {
    const longAud = 'a'.repeat(500);
    const longSub = 'b'.repeat(500);
    const salt = computeSalt(longAud, longSub);
    expect(salt).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it('is not equal for swapped aud/sub arguments', () => {
    const a = computeSalt('audValue', 'subValue');
    const b = computeSalt('subValue', 'audValue');
    expect(a).not.toBe(b);
  });
});

describe('computeSalt (walletIndex)', () => {
  const VECTOR_AUD = 'zkap-test-aud.apps.googleusercontent.com';
  const VECTOR_SUB = '110169484474386276334';

  const EXPECTED_INDEX_0 =
    '0x9df233bef96c911e750eb1695092d90022b27bd27d77188c7e7a24c286728670';
  const EXPECTED_INDEX_1 =
    '0xde84f2c155ed8cc82c3542e170bcbca6afb2ea9de6c51374339dc20fb047eec5';
  const EXPECTED_INDEX_7 =
    '0x710d2981d9630fe9402fd57eca64574b0ce1b203cace651f9a42dc2ee18e3f1b';
  const EXPECTED_INDEX_255 =
    '0x0136a7038f6bc292af3f8d8e538a9b48c485415b0bec25219dafac706e1e46da';

  describe('backward compatibility: undefined === 0 === 2-arg (byte identical)', () => {
    it('walletIndex omitted matches the pinned 2-arg vector', () => {
      expect(computeSalt(VECTOR_AUD, VECTOR_SUB)).toBe(EXPECTED_INDEX_0);
    });

    it('walletIndex undefined matches the pinned 2-arg vector', () => {
      expect(computeSalt(VECTOR_AUD, VECTOR_SUB, undefined)).toBe(
        EXPECTED_INDEX_0
      );
    });

    it('walletIndex 0 matches the pinned 2-arg vector', () => {
      expect(computeSalt(VECTOR_AUD, VECTOR_SUB, 0)).toBe(EXPECTED_INDEX_0);
    });

    it('omitted, undefined, and 0 are all mutually byte-identical', () => {
      const omitted = computeSalt(VECTOR_AUD, VECTOR_SUB);
      const undef = computeSalt(VECTOR_AUD, VECTOR_SUB, undefined);
      const zero = computeSalt(VECTOR_AUD, VECTOR_SUB, 0);
      expect(omitted).toBe(undef);
      expect(undef).toBe(zero);
    });
  });

  describe('new 3-arg derivation path (walletIndex >= 1)', () => {
    it('walletIndex 1 matches the pinned vector', () => {
      expect(computeSalt(VECTOR_AUD, VECTOR_SUB, 1)).toBe(EXPECTED_INDEX_1);
    });

    it('walletIndex 7 matches the pinned vector', () => {
      expect(computeSalt(VECTOR_AUD, VECTOR_SUB, 7)).toBe(EXPECTED_INDEX_7);
    });

    it('walletIndex 255 (upper bound) matches the pinned vector and is accepted', () => {
      expect(computeSalt(VECTOR_AUD, VECTOR_SUB, 255)).toBe(
        EXPECTED_INDEX_255
      );
    });

    it('walletIndex 1 differs from walletIndex 0', () => {
      expect(computeSalt(VECTOR_AUD, VECTOR_SUB, 1)).not.toBe(
        computeSalt(VECTOR_AUD, VECTOR_SUB, 0)
      );
    });

    it('matches an independently computed 3-arg ABI encoding for a non-pinned case', () => {
      const expected = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['string', 'string', 'string'],
          ['aud-idx', 'sub-idx', String(3)]
        )
      );
      expect(computeSalt('aud-idx', 'sub-idx', 3)).toBe(expected);
    });
  });

  describe('rejects invalid walletIndex (no ?? coalescing — explicit branches)', () => {
    it('throws for -1 (negative)', () => {
      expect(() => computeSalt(VECTOR_AUD, VECTOR_SUB, -1)).toThrow(
        AaOperationError
      );
    });

    it('throws for 1.5 (non-integer)', () => {
      expect(() => computeSalt(VECTOR_AUD, VECTOR_SUB, 1.5)).toThrow(
        AaOperationError
      );
    });

    it('throws for 256 (over MAX_WALLET_INDEX)', () => {
      expect(() => computeSalt(VECTOR_AUD, VECTOR_SUB, 256)).toThrow(
        AaOperationError
      );
    });

    it('throws for null (not treated as undefined or 0)', () => {
      expect(() =>
        computeSalt(VECTOR_AUD, VECTOR_SUB, null as unknown as number)
      ).toThrow(AaOperationError);
    });

    it('accepts 255 without throwing (upper bound is inclusive)', () => {
      expect(() => computeSalt(VECTOR_AUD, VECTOR_SUB, 255)).not.toThrow();
    });
  });
});
