/**
 * base64url 유틸리티 테스트
 *
 * 실제 함수 시그니처:
 * - base64URLencode(str: string): string
 * - base64URLdecode(str: string): string
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
      // base64url: + → -, / → _, 패딩(=) 제거
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
      // base64에서 +, / 가 나올 수 있는 문자열
      const input = '>>>???<<<';
      const result = base64URLencode(input);

      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
    });
  });

  describe('base64URLdecode', () => {
    it('should decode base64url string', () => {
      const encoded = 'SGVsbG8'; // "Hello" in base64url
      const result = base64URLdecode(encoded);

      expect(result).toBe('Hello');
    });

    it('should handle empty string', () => {
      const result = base64URLdecode('');
      expect(result).toBe('');
    });

    it('should handle base64url with - and _', () => {
      // - 와 _ 가 포함된 base64url 문자열 (표준 base64의 +, /를 대체)
      // ">>>" 의 base64url 인코딩
      const encoded = 'Pj4-'; // >>> in base64url (standard base64: Pj4+)
      const result = base64URLdecode(encoded);

      expect(result).toBe('>>>');
    });

    it('should handle strings without padding', () => {
      // base64url은 패딩을 생략할 수 있음
      const encoded = 'YQ'; // "a" without padding (standard: YQ==)
      const result = base64URLdecode(encoded);

      expect(result).toBe('a');
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

    it('should handle high byte values (0-255)', () => {
      // charCodeAt은 0-65535 반환하지만, 이 함수는 단순히 charCode를 저장
      const input = String.fromCharCode(255);
      const result = StringToUint8Array(input);

      expect(result[0]).toBe(255);
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

    it('should handle special byte values', () => {
      const input = new Uint8Array([0, 255, 128]);
      const result = Uint8ArrayToString(input);

      expect(result.length).toBe(3);
      expect(result.charCodeAt(0)).toBe(0);
      expect(result.charCodeAt(1)).toBe(255);
      expect(result.charCodeAt(2)).toBe(128);
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

      expect(decoded).toBe(original);
    });
  });
});
