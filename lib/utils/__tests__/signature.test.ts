/**
 * signature.ts 테스트
 *
 * 함수 목록:
 * - unwrapSignature: DER 인코딩된 서명에서 r, s 추출
 * - flipSecp256r1Signature: s가 N/2보다 크면 flip (malleability 방지)
 * - wrapSignature: r, s를 DER 형식으로 래핑
 * - toHex: Uint8Array → hex string
 * - fromHex: hex string → Uint8Array
 */

import {
  unwrapSignature,
  flipSecp256r1Signature,
  wrapSignature,
  toHex,
  fromHex,
} from '../signature';

describe('signature', () => {
  describe('toHex', () => {
    it('should convert Uint8Array to hex string', () => {
      const input = new Uint8Array([0xad, 0xce, 0x00, 0x02, 0x35]);
      const result = toHex(input);

      expect(result).toBe('adce000235');
    });

    it('should handle empty array', () => {
      const result = toHex(new Uint8Array([]));
      expect(result).toBe('');
    });

    it('should pad single digit hex values with zero', () => {
      const input = new Uint8Array([0x00, 0x01, 0x0f]);
      const result = toHex(input);

      expect(result).toBe('00010f');
    });

    it('should handle all possible byte values', () => {
      const input = new Uint8Array([0x00, 0x7f, 0x80, 0xff]);
      const result = toHex(input);

      expect(result).toBe('007f80ff');
    });

    it('should produce lowercase hex', () => {
      const input = new Uint8Array([0xAB, 0xCD, 0xEF]);
      const result = toHex(input);

      expect(result).toBe('abcdef');
    });
  });

  describe('fromHex', () => {
    it('should convert hex string to Uint8Array', () => {
      const result = fromHex('adce000235');

      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual([0xad, 0xce, 0x00, 0x02, 0x35]);
    });

    it('should handle null input', () => {
      const result = fromHex(null);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(0);
    });

    it('should handle empty string (returns empty array, not throw)', () => {
      // Empty string is falsy in JS, so fromHex returns empty array
      const result = fromHex('');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(0);
    });

    it('should handle uppercase hex', () => {
      const result = fromHex('ABCDEF');

      expect(Array.from(result)).toEqual([0xab, 0xcd, 0xef]);
    });

    it('should handle mixed case hex', () => {
      const result = fromHex('AbCdEf');

      expect(Array.from(result)).toEqual([0xab, 0xcd, 0xef]);
    });

    it('should throw on odd length hex string', () => {
      expect(() => fromHex('abc')).toThrow('Invalid hex string');
    });

    it('should throw on invalid hex characters', () => {
      expect(() => fromHex('ghij')).toThrow('Invalid hex string');
      expect(() => fromHex('12g4')).toThrow('Invalid hex string');
      expect(() => fromHex('12 34')).toThrow('Invalid hex string');
    });

    it('should handle long hex string', () => {
      const hex = 'ff'.repeat(32); // 64 chars = 32 bytes
      const result = fromHex(hex);

      expect(result.length).toBe(32);
      expect(result.every(b => b === 0xff)).toBe(true);
    });
  });

  describe('toHex and fromHex roundtrip', () => {
    it('should roundtrip correctly', () => {
      const original = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]);
      const hex = toHex(original);
      const back = fromHex(hex);

      expect(Array.from(back)).toEqual(Array.from(original));
    });

    it('should roundtrip 32-byte values (common for signatures)', () => {
      const original = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        original[i] = i;
      }
      const hex = toHex(original);
      const back = fromHex(hex);

      expect(Array.from(back)).toEqual(Array.from(original));
    });
  });

  describe('wrapSignature', () => {
    it('should wrap r and s into DER format', () => {
      const r = new Uint8Array(32).fill(0x11);
      const s = new Uint8Array(32).fill(0x22);

      const result = wrapSignature(r, s);

      expect(result).toBeInstanceOf(Uint8Array);
      // DER format: 0x30 (SEQUENCE) + length + 0x02 (INTEGER) + 0x20 (32 bytes) + r + 0x02 + 0x20 + s
      expect(result[0]).toBe(0x30); // SEQUENCE tag
      expect(result[1]).toBe(0x44); // Total length (68 bytes)
      expect(result[2]).toBe(0x02); // INTEGER tag for r
      expect(result[3]).toBe(0x20); // Length of r (32 bytes)
      // r starts at index 4
      expect(result.slice(4, 36)).toEqual(r);
      expect(result[36]).toBe(0x02); // INTEGER tag for s
      expect(result[37]).toBe(0x20); // Length of s (32 bytes)
      // s starts at index 38
      expect(result.slice(38, 70)).toEqual(s);
    });

    it('should produce correct total length when MSB is not set', () => {
      // r[0] < 0x80 and s[0] < 0x80: no sign bytes needed
      const r = new Uint8Array(32).fill(0x11);
      const s = new Uint8Array(32).fill(0x22);

      const result = wrapSignature(r, s);

      // 2 (seq header) + (2+32) r-integer + (2+32) s-integer = 70 bytes
      expect(result.length).toBe(70);
    });

    it('should add DER sign byte when r MSB is set', () => {
      // r[0] >= 0x80: needs 0x00 prefix in DER INTEGER
      const r = new Uint8Array(32).fill(0xaa);
      const s = new Uint8Array(32).fill(0x22); // s[0] < 0x80

      const result = wrapSignature(r, s);

      // r needs sign byte → rIntLen=33, sIntLen=32, seqLen=4+33+32=69
      expect(result[0]).toBe(0x30); // SEQUENCE
      expect(result[1]).toBe(0x45); // sequence length = 69
      expect(result[2]).toBe(0x02); // INTEGER tag for r
      expect(result[3]).toBe(0x21); // r length = 33 (with sign byte)
      expect(result[4]).toBe(0x00); // sign byte
      expect(Array.from(result.slice(5, 37))).toEqual(Array.from(r)); // r value
      expect(result[37]).toBe(0x02); // INTEGER tag for s
      expect(result[38]).toBe(0x20); // s length = 32
      expect(Array.from(result.slice(39, 71))).toEqual(Array.from(s)); // s value
      expect(result.length).toBe(71);
    });

    it('should add DER sign bytes when both r and s MSB are set', () => {
      const r = new Uint8Array(32).fill(0xaa); // MSB set
      const s = new Uint8Array(32).fill(0xbb); // MSB set

      const result = wrapSignature(r, s);

      // Both need sign bytes → rIntLen=33, sIntLen=33, seqLen=4+33+33=70
      expect(result[1]).toBe(0x46); // sequence length = 70
      expect(result[3]).toBe(0x21); // r length = 33
      expect(result[4]).toBe(0x00); // r sign byte
      // s starts at 5+32=37, then tag(1)+len(1)+sign(1)=39
      expect(result[37]).toBe(0x02); // INTEGER tag for s
      expect(result[38]).toBe(0x21); // s length = 33
      expect(result[39]).toBe(0x00); // s sign byte
      expect(result.length).toBe(72);
    });

    it('should pad r when shorter than 32 bytes', () => {
      const r = new Uint8Array(16).fill(0x11); // shorter than 32
      const s = new Uint8Array(32).fill(0x22);

      const result = wrapSignature(r, s);

      // r should be padded to 32 bytes at index 4-35
      expect(result.length).toBe(70);
      // First 16 bytes of r slot should be zero (padding)
      for (let i = 4; i < 20; i++) {
        expect(result[i]).toBe(0x00);
      }
      // Last 16 bytes of r slot should be 0x11
      for (let i = 20; i < 36; i++) {
        expect(result[i]).toBe(0x11);
      }
    });

    it('should pad s when shorter than 32 bytes', () => {
      const r = new Uint8Array(32).fill(0x33);
      const s = new Uint8Array(16).fill(0x44); // shorter than 32

      const result = wrapSignature(r, s);

      expect(result.length).toBe(70);
      // s slot starts at index 38; first 16 bytes should be zero padding
      for (let i = 38; i < 54; i++) {
        expect(result[i]).toBe(0x00);
      }
      // Last 16 bytes should be 0x44
      for (let i = 54; i < 70; i++) {
        expect(result[i]).toBe(0x44);
      }
    });
  });

  describe('unwrapSignature', () => {
    it('should extract r and s from wrapped signature', () => {
      // Create a valid DER-encoded signature
      const r = new Uint8Array(32).fill(0x11);
      const s = new Uint8Array(32).fill(0x22);
      const wrapped = wrapSignature(r, s);

      const [extractedR, extractedS] = unwrapSignature(wrapped);

      expect(Array.from(extractedR)).toEqual(Array.from(r));
      expect(Array.from(extractedS)).toEqual(Array.from(s));
    });

    it('should handle signatures with leading zeros in r', () => {
      // When r has a high bit set, DER encoding adds a 0x00 prefix
      const r = new Uint8Array(32);
      r.fill(0x00);
      r[0] = 0x80; // High bit set
      const s = new Uint8Array(32).fill(0x33);

      // Manually create DER with padding
      const derSig = Buffer.concat([
        new Uint8Array([0x30, 0x45, 0x02, 0x21, 0x00]), // SEQUENCE, len, INTEGER, len+1, padding
        r,
        new Uint8Array([0x02, 0x20]),
        s,
      ]);

      const [extractedR, extractedS] = unwrapSignature(derSig);

      expect(Array.from(extractedR)).toEqual(Array.from(r));
      expect(Array.from(extractedS)).toEqual(Array.from(s));
    });

    it('should roundtrip wrap and unwrap', () => {
      const r = new Uint8Array(32);
      const s = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        r[i] = i;
        s[i] = 255 - i;
      }

      const wrapped = wrapSignature(r, s);
      const [extractedR, extractedS] = unwrapSignature(wrapped);

      expect(Array.from(extractedR)).toEqual(Array.from(r));
      expect(Array.from(extractedS)).toEqual(Array.from(s));
    });

    it('should throw when buffer is too short (< 8 bytes)', () => {
      expect(() => unwrapSignature(new Uint8Array([0x30, 0x06, 0x02]))).toThrow('DER signature too short');
    });

    it('should throw when first byte is not 0x30 (SEQUENCE tag)', () => {
      const buf = new Uint8Array(10).fill(0);
      buf[0] = 0x31; // wrong tag
      buf[2] = 0x02;
      expect(() => unwrapSignature(buf)).toThrow('Expected DER SEQUENCE tag (0x30)');
    });

    it('should throw when r INTEGER tag is not 0x02', () => {
      const buf = new Uint8Array(10).fill(0);
      buf[0] = 0x30;
      buf[2] = 0x03; // wrong INTEGER tag
      buf[3] = 2;
      expect(() => unwrapSignature(buf)).toThrow('Expected DER INTEGER tag (0x02) for r');
    });

    it('should throw when r length exceeds buffer', () => {
      const buf = new Uint8Array(10).fill(0);
      buf[0] = 0x30;
      buf[2] = 0x02;
      buf[3] = 100; // rLength > sigBuffer.length - 4
      expect(() => unwrapSignature(buf)).toThrow('Invalid r length in DER signature');
    });

    it('should throw when buffer too short for s component', () => {
      // sTagOffset = 4 + rLength. Make sTagOffset + 1 >= sigBuffer.length
      const rLength = 4;
      const buf = new Uint8Array(4 + rLength + 1).fill(0); // barely too short for s
      buf[0] = 0x30;
      buf[2] = 0x02;
      buf[3] = rLength;
      // sTagOffset = 4 + 4 = 8, buf.length = 9, sTagOffset + 1 = 9 >= 9 → throw
      expect(() => unwrapSignature(buf)).toThrow('DER signature too short for s component');
    });

    it('should throw when s INTEGER tag is not 0x02', () => {
      const rLength = 2;
      const buf = new Uint8Array(4 + rLength + 4).fill(0);
      buf[0] = 0x30;
      buf[2] = 0x02;
      buf[3] = rLength;
      // sTagOffset = 4 + 2 = 6
      buf[6] = 0x03; // wrong s tag
      buf[7] = 2;
      expect(() => unwrapSignature(buf)).toThrow('Expected DER INTEGER tag (0x02) for s');
    });

    it('should throw when s length exceeds buffer', () => {
      const rLength = 2;
      const buf = new Uint8Array(4 + rLength + 4).fill(0);
      buf[0] = 0x30;
      buf[2] = 0x02;
      buf[3] = rLength;
      // sTagOffset = 6
      buf[6] = 0x02;
      buf[7] = 100; // sLength too large
      expect(() => unwrapSignature(buf)).toThrow('Invalid s length in DER signature');
    });
  });

  describe('flipSecp256r1Signature', () => {
    // secp256r1 curve order N
    const N_HEX = 'FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551';
    // N/2 (halfN)
    const HALF_N_HEX = '7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8';

    it('should not flip s when s < N/2', () => {
      const r = new Uint8Array(32).fill(0x11);
      // s = 1 (very small, definitely < N/2)
      const s = new Uint8Array(32).fill(0x00);
      s[31] = 0x01;

      const [resultR, resultS] = flipSecp256r1Signature(r, s);

      // r should be unchanged
      expect(Array.from(resultR)).toEqual(Array.from(r));
      // s should be unchanged (not flipped)
      expect(Array.from(resultS)).toEqual(Array.from(s));
    });

    it('should flip s when s > N/2', () => {
      const r = new Uint8Array(32).fill(0x11);
      // s = N - 1 (very large, definitely > N/2)
      const s = fromHex('FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632550');

      const [resultR, resultS] = flipSecp256r1Signature(r, s);

      // r should be unchanged
      expect(Array.from(resultR)).toEqual(Array.from(r));
      // s should be flipped: N - s = N - (N-1) = 1
      expect(resultS[resultS.length - 1]).toBe(0x01);
    });

    it('should handle s exactly at boundary', () => {
      const r = new Uint8Array(32).fill(0x22);
      // s = halfN + 1 (just above threshold, should be flipped)
      const halfNPlusOne = fromHex('7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a9');

      const [resultR, resultS] = flipSecp256r1Signature(r, halfNPlusOne);

      // Should be flipped
      expect(Array.from(resultR)).toEqual(Array.from(r));
      // Result should be <= halfN (low-s form)
      // s' = N - s = N - (halfN + 1) ≈ halfN
      const resultBigInt = BigInt('0x' + toHex(resultS));
      const halfNBigInt = BigInt('0x' + HALF_N_HEX);
      expect(resultBigInt <= halfNBigInt).toBe(true);
    });

    it('should preserve r unchanged', () => {
      const r = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        r[i] = i;
      }
      const s = fromHex('FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632550');

      const [resultR] = flipSecp256r1Signature(r, s);

      expect(Array.from(resultR)).toEqual(Array.from(r));
    });

    it('should produce valid low-s signature for malleability prevention', () => {
      const r = new Uint8Array(32).fill(0xaa);
      // High s value
      const highS = fromHex('EEEEEEEE00000000EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE');

      const [, resultS] = flipSecp256r1Signature(r, highS);

      // Result should satisfy low-s requirement (s <= N/2)
      const resultBigInt = BigInt('0x' + toHex(resultS));
      const halfNBigInt = BigInt('0x' + HALF_N_HEX);
      expect(resultBigInt <= halfNBigInt).toBe(true);
    });
  });

  describe('integration: full signature processing', () => {
    it('should process WebAuthn-style signature correctly', () => {
      // Simulate a typical flow: unwrap -> flip -> wrap
      const r = new Uint8Array(32);
      const s = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        r[i] = i + 1;
        s[i] = (i + 1) * 2;
      }

      // Wrap original
      const wrapped = wrapSignature(r, s);

      // Unwrap
      const [unwrappedR, unwrappedS] = unwrapSignature(wrapped);

      // Flip if needed
      const [flippedR, flippedS] = flipSecp256r1Signature(unwrappedR, unwrappedS);

      // Wrap again
      const rewrapped = wrapSignature(flippedR, flippedS);

      // Should produce valid DER structure
      expect(rewrapped[0]).toBe(0x30);
      expect(rewrapped[2]).toBe(0x02);
    });
  });
});
