/**
 * salt utility 테스트
 *
 * - computeSalt(aud, sub): keccak256(abi.encode(string, string)) → 0x hex
 */

import { ethers } from 'ethers';
import { computeSalt } from '../salt';

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
