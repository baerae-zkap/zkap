/**
 * base64url utility tests
 *
 * Actual function signatures:
 * - base64URLencode(str: string): string
 * - base64URLdecode(str: string): Uint8Array
 * - StringToUint8Array(str: string): Uint8Array
 * - Uint8ArrayToString(uint8Array: Uint8Array): string
 * - toURLEncode(base64str: string): string
 */

import {
  base64URLencode,
  base64URLdecode,
  StringToUint8Array,
  Uint8ArrayToString,
  toURLEncode,
} from '../base64url';

describe('base64url', () => {
  describe('base64URLencode', () => {
    it('should encode string to base64url format', () => {
      const input = 'Hello';
      const result = base64URLencode(input);

      expect(typeof result).toBe('string');
      // base64url: + → -, / → _, padding (=) removed
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      expect(result).not.toContain('=');
    });

    it('should handle empty string', () => {
      const result = base64URLencode('');
      expect(result).toBe('');
    });

    it('should encode special characters', () => {
      const input = '한글 테스트 🚀';
      const result = base64URLencode(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should produce URL-safe output for problematic bytes', () => {
      // String that can produce + and / in base64
      const input = '>>>???<<<';
      const result = base64URLencode(input);

      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
    });
  });

  describe('base64URLdecode', () => {
    it('should decode base64url string to Uint8Array', () => {
      const encoded = 'SGVsbG8'; // "Hello" in base64url
      const result = base64URLdecode(encoded);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]); // "Hello" bytes
    });

    it('should handle empty string', () => {
      const result = base64URLdecode('');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(0);
    });

    it('should handle base64url with - and _', () => {
      // base64url string containing - and _ (replacing + and / from standard base64)
      // base64url encoding of ">>>"
      const encoded = 'Pj4-'; // >>> in base64url (standard base64: Pj4+)
      const result = base64URLdecode(encoded);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual([62, 62, 62]); // ">>>" bytes
    });

    it('should handle strings without padding', () => {
      // base64url can omit padding
      const encoded = 'YQ'; // "a" without padding (standard: YQ==)
      const result = base64URLdecode(encoded);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual([97]); // "a" byte
    });
  });

  describe('toURLEncode', () => {
    it('should convert standard base64 to base64url', () => {
      const standardBase64 = 'Pj4+'; // >>> in standard base64
      const result = toURLEncode(standardBase64);

      expect(result).toBe('Pj4-');
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
    });

    it('should remove padding', () => {
      const withPadding = 'YQ==';
      const result = toURLEncode(withPadding);

      expect(result).toBe('YQ');
      expect(result).not.toContain('=');
    });

    it('should handle already URL-safe strings', () => {
      const alreadySafe = 'SGVsbG8';
      const result = toURLEncode(alreadySafe);

      expect(result).toBe('SGVsbG8');
    });
  });

  describe('StringToUint8Array', () => {
    it('should convert string to Uint8Array', () => {
      const input = 'Hello';
      const result = StringToUint8Array(input);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(5);
      expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]);
    });

    it('should handle empty string', () => {
      const result = StringToUint8Array('');

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(0);
    });

    it('should handle ASCII special characters', () => {
      const input = '!@#$%';
      const result = StringToUint8Array(input);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(5);
      expect(result[0]).toBe(33); // '!'
      expect(result[1]).toBe(64); // '@'
    });

    it('should handle high byte values via UTF-8 encoding', () => {
      // TextEncoder encodes as UTF-8: String.fromCharCode(255) = 'ÿ' (U+00FF) is
      // encoded as 2 bytes in UTF-8: [0xC3, 0xBF] = [195, 191]
      const input = String.fromCharCode(255);
      const result = StringToUint8Array(input);

      expect(result.length).toBe(2);
      expect(result[0]).toBe(0xC3); // 195
      expect(result[1]).toBe(0xBF); // 191
    });
  });

  describe('Uint8ArrayToString', () => {
    it('should convert Uint8Array to string', () => {
      const input = new Uint8Array([72, 101, 108, 108, 111]);
      const result = Uint8ArrayToString(input);

      expect(result).toBe('Hello');
    });

    it('should handle empty array', () => {
      const result = Uint8ArrayToString(new Uint8Array([]));
      expect(result).toBe('');
    });

    it('should handle valid UTF-8 byte sequences', () => {
      // TextDecoder decodes UTF-8 bytes.
      // [0xC3, 0xBF] = ÿ (U+00FF), [0xC2, 0x80] = U+0080 (control char)
      const input = new Uint8Array([0xC3, 0xBF]);
      const result = Uint8ArrayToString(input);

      expect(result).toBe('ÿ');
      expect(result.charCodeAt(0)).toBe(255);
    });
  });

  describe('roundtrip', () => {
    it('StringToUint8Array and Uint8ArrayToString should be inverse', () => {
      const original = 'Test String 123';
      const asArray = StringToUint8Array(original);
      const backToString = Uint8ArrayToString(asArray);

      expect(backToString).toBe(original);
    });

    it('encode and decode should roundtrip for ASCII', () => {
      const original = 'Hello World!';
      const encoded = base64URLencode(original);
      const decoded = base64URLdecode(encoded);

      // base64URLdecode returns Uint8Array, convert back to string for comparison
      const decodedStr = new TextDecoder().decode(decoded);
      expect(decodedStr).toBe(original);
    });
  });
});
