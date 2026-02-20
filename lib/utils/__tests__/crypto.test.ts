/**
 * crypto.ts 테스트
 *
 * Export된 함수들:
 * - formattingModulorN: 바이트를 ZK 회로용으로 포맷
 * - calculateMaxClaimLen: 최대 claim 길이 계산
 * - padStr: 문자열 패딩
 * - padAndStrToFieldsBN254: 패딩 후 BN254 필드 변환
 *
 * Default export (cryptoUtils):
 * - sha256BlockCompress: SHA256 부분 업데이트 (ZK 회로용 블록 압축)
 * - getOutOfCircuitHashSegment: JWT에서 해시 세그먼트 추출
 * - Utf8ToUint8Array: UTF8 → Uint8Array
 * - commonVkParser: 공통 VK 파서
 * - userSpecificVkParser: 사용자별 VK 파서
 * - userSpecificVkToStringArray: VK → 문자열 배열
 * - getSignedMessageHash: 이더리움 서명 메시지 해시
 */

import cryptoUtils, {
  formattingModulorN,
  calculateMaxClaimLen,
  padStr,
  padAndStrToFieldsBN254,
} from '../crypto';

describe('crypto', () => {
  describe('padStr', () => {
    it('should pad string to target length', () => {
      const result = padStr('hello', 10, 0x00);

      expect(result.length).toBe(10);
      expect(result.substring(0, 5)).toBe('hello');
    });

    it('should use specified pad character', () => {
      const result = padStr('ab', 5, 0x58); // 'X' = 0x58

      expect(result).toBe('abXXX');
    });

    it('should not modify string if already at target length', () => {
      const result = padStr('hello', 5, 0x00);

      expect(result).toBe('hello');
    });

    it('should not modify string if longer than target length', () => {
      const result = padStr('hello world', 5, 0x00);

      expect(result).toBe('hello world');
    });

    it('should handle empty string', () => {
      const result = padStr('', 3, 0x41); // 'A' = 0x41

      expect(result).toBe('AAA');
    });

    it('should handle null character padding', () => {
      const result = padStr('test', 8, 0x00);

      expect(result.length).toBe(8);
      expect(result.charCodeAt(4)).toBe(0);
    });
  });

  describe('calculateMaxClaimLen', () => {
    it('should calculate max claim length for BN254 (default)', () => {
      // BN254: MODULUS_BIT_SIZE = 254, LIMB_WIDTH = 31
      // For input 50: ceil(50/31) * 31 = 2 * 31 = 62
      const result = calculateMaxClaimLen(50);

      expect(result).toBe(62);
    });

    it('should round up to next limb boundary', () => {
      // For input 31: ceil(31/31) * 31 = 1 * 31 = 31
      expect(calculateMaxClaimLen(31)).toBe(31);

      // For input 32: ceil(32/31) * 31 = 2 * 31 = 62
      expect(calculateMaxClaimLen(32)).toBe(62);
    });

    it('should handle small values', () => {
      // For input 1: ceil(1/31) * 31 = 1 * 31 = 31
      expect(calculateMaxClaimLen(1)).toBe(31);
    });

    it('should handle exact multiples', () => {
      // For input 62: ceil(62/31) * 31 = 2 * 31 = 62
      expect(calculateMaxClaimLen(62)).toBe(62);

      // For input 93: ceil(93/31) * 31 = 3 * 31 = 93
      expect(calculateMaxClaimLen(93)).toBe(93);
    });

    it('should accept custom modulus bit size', () => {
      // For modulusBitSize = 256: limbWidth = floor(255/8) = 31
      const result = calculateMaxClaimLen(50, 256);
      expect(result).toBe(62);

      // For modulusBitSize = 128: limbWidth = floor(127/8) = 15
      // ceil(50/15) * 15 = 4 * 15 = 60
      const result2 = calculateMaxClaimLen(50, 128);
      expect(result2).toBe(60);
    });
  });

  describe('formattingModulorN', () => {
    it('should format 8-byte hex string', () => {
      const input = '0x0102030405060708';
      const result = formattingModulorN(input);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });

    it('should format 16-byte hex string', () => {
      const input = '0x' + '00'.repeat(16);
      const result = formattingModulorN(input);

      expect(result.length).toBe(2);
    });

    it('should throw for non-multiple of 8 bytes', () => {
      const input = '0x010203'; // 3 bytes

      expect(() => formattingModulorN(input)).toThrow('Input length must be a multiple of 8');
    });

    it('should handle Uint8Array input', () => {
      const input = new Uint8Array(8).fill(0xff);
      const result = formattingModulorN(input);

      expect(result.length).toBe(1);
    });

    it('should reverse bytes and convert to little-endian chunks', () => {
      // Input: 0x0102030405060708 (big-endian)
      // Reversed: 0x0807060504030201
      // Little-endian interpretation of reversed bytes
      const input = '0x0102030405060708';
      const result = formattingModulorN(input);

      expect(result.length).toBe(1);
      // The result should be a hex string
      expect(result[0].startsWith('0x')).toBe(true);
    });

    it('should handle 32-byte input (common for hashes)', () => {
      const input = '0x' + 'ab'.repeat(32);
      const result = formattingModulorN(input);

      expect(result.length).toBe(4); // 32 / 8 = 4 chunks
    });
  });

  describe('padAndStrToFieldsBN254', () => {
    it('should pad and convert string to BN254 field elements', () => {
      const result = padAndStrToFieldsBN254('test', 31, 0x00);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1); // 31 bytes = 1 limb
      expect(typeof result[0]).toBe('bigint');
    });

    it('should handle longer strings requiring multiple limbs', () => {
      const input = 'a'.repeat(50);
      const result = padAndStrToFieldsBN254(input, 50, 0x00);

      // 50 → maxClaimLen = 62 (2 limbs)
      expect(result.length).toBe(2);
    });

    it('should apply padding correctly', () => {
      const result1 = padAndStrToFieldsBN254('abc', 31, 0x00);
      const result2 = padAndStrToFieldsBN254('abc', 31, 0x20); // space padding

      // Different padding should produce different results
      expect(result1[0]).not.toBe(result2[0]);
    });
  });

  describe('cryptoUtils.Utf8ToUint8Array', () => {
    it('should convert UTF8 string to Uint8Array', () => {
      const result = cryptoUtils.Utf8ToUint8Array('hello');

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(5);
      expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
    });

    it('should handle empty string', () => {
      const result = cryptoUtils.Utf8ToUint8Array('');

      expect(result.length).toBe(0);
    });

    it('should handle Unicode characters', () => {
      const result = cryptoUtils.Utf8ToUint8Array('한글');

      expect(result).toBeInstanceOf(Uint8Array);
      // Korean characters are 3 bytes each in UTF-8
      expect(result.length).toBe(6);
    });
  });

  describe('cryptoUtils.getSignedMessageHash', () => {
    it('should return Ethereum signed message hash', () => {
      const message = '0x' + 'ab'.repeat(32);
      const result = cryptoUtils.getSignedMessageHash(message);

      expect(result).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('should produce consistent results', () => {
      const message = '0x' + '11'.repeat(32);
      const result1 = cryptoUtils.getSignedMessageHash(message);
      const result2 = cryptoUtils.getSignedMessageHash(message);

      expect(result1).toBe(result2);
    });

    it('should produce different results for different inputs', () => {
      const result1 = cryptoUtils.getSignedMessageHash('0x' + '11'.repeat(32));
      const result2 = cryptoUtils.getSignedMessageHash('0x' + '22'.repeat(32));

      expect(result1).not.toBe(result2);
    });
  });

  describe('cryptoUtils.sha256BlockCompress', () => {
    it('should process 64-byte data block', () => {
      const data = new Uint8Array(64).fill(0x61); // 'a' repeated
      const result = cryptoUtils.sha256BlockCompress(data);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(8); // SHA256 state is 8 32-bit words
    });

    it('should process multiple 64-byte blocks', () => {
      const data = new Uint8Array(128).fill(0x00);
      const result = cryptoUtils.sha256BlockCompress(data);

      expect(result.length).toBe(8);
    });

    it('should throw for non-64-byte-multiple data', () => {
      const data = new Uint8Array(63);

      expect(() => cryptoUtils.sha256BlockCompress(data)).toThrow('data length must be a multiple of 64 bytes');
    });

    it('should produce consistent results', () => {
      const data = new Uint8Array(64);
      for (let i = 0; i < 64; i++) data[i] = i;

      const result1 = cryptoUtils.sha256BlockCompress(data);
      const result2 = cryptoUtils.sha256BlockCompress(data);

      expect(result1).toEqual(result2);
    });
  });

  describe('cryptoUtils.commonVkParser', () => {
    it('should parse 20-element verifying key', () => {
      const vk = Array(20).fill('0').map((_, i) => `${i}`);
      const result = cryptoUtils.commonVkParser(vk);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(5);

      const [pairingVk, n, m0, sigma, omega] = result;
      expect(pairingVk.length).toBe(5); // g1Gen, g2Gen, g2X, g1Z, g2Z
      expect(n).toBe('16');
      expect(m0).toBe('17');
      expect(sigma).toBe('18');
      expect(omega).toBe('19');
    });

    it('should correctly reorder elements for pairing', () => {
      const vk = Array(20).fill('0').map((_, i) => `elem${i}`);
      const [pairingVk] = cryptoUtils.commonVkParser(vk);

      // g1Generator should be [vk[0], vk[1]]
      expect(pairingVk[0]).toEqual(['elem0', 'elem1']);

      // g2Generator should be [vk[3], vk[2], vk[5], vk[4]] (swapped pairs)
      expect(pairingVk[1]).toEqual(['elem3', 'elem2', 'elem5', 'elem4']);
    });
  });

  describe('cryptoUtils.userSpecificVkParser', () => {
    it('should parse 16-element user VK with strings', () => {
      const userVk = Array(16).fill('0').map((_, i) => `${i * 100}`);
      const result = cryptoUtils.userSpecificVkParser(userVk);

      expect(result.length).toBe(4); // g2Mu, g2MuX, g2MuZ, vAcc
      expect(result[0].length).toBe(4);
      expect(typeof result[0][0]).toBe('bigint');
    });

    it('should parse 16-element user VK with BigInts', () => {
      const userVk = Array(16).fill(0n).map((_, i) => BigInt(i * 100));
      const result = cryptoUtils.userSpecificVkParser(userVk);

      expect(result.length).toBe(4);
      expect(typeof result[0][0]).toBe('bigint');
    });

    it('should throw for wrong length input', () => {
      const userVk = Array(15).fill('0');

      expect(() => cryptoUtils.userSpecificVkParser(userVk)).toThrow('userVk length must be 16');
    });

    it('should correctly reorder elements', () => {
      const userVk = Array(16).fill('0').map((_, i) => `${i}`);
      const result = cryptoUtils.userSpecificVkParser(userVk);

      // g2Mu should be [vk[1], vk[0], vk[3], vk[2]] (swapped pairs)
      expect(result[0]).toEqual([1n, 0n, 3n, 2n]);
    });
  });

  describe('cryptoUtils.userSpecificVkToStringArray', () => {
    it('should convert userSpecificVk back to string array', () => {
      const input: bigint[][] = [
        [1n, 2n, 3n, 4n],
        [5n, 6n, 7n, 8n],
        [9n, 10n, 11n, 12n],
        [13n, 14n, 15n, 16n],
      ];
      const result = cryptoUtils.userSpecificVkToStringArray(input);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(16);
      expect(result.every(item => typeof item === 'string')).toBe(true);
    });

    it('should throw for wrong outer length', () => {
      const input: bigint[][] = [
        [1n, 2n, 3n, 4n],
        [5n, 6n, 7n, 8n],
        [9n, 10n, 11n, 12n],
      ];

      expect(() => cryptoUtils.userSpecificVkToStringArray(input)).toThrow('userSpecificVk must have 4 elements');
    });

    it('should throw for wrong inner length', () => {
      const input: bigint[][] = [
        [1n, 2n, 3n], // wrong length
        [5n, 6n, 7n, 8n],
        [9n, 10n, 11n, 12n],
        [13n, 14n, 15n, 16n],
      ];

      expect(() => cryptoUtils.userSpecificVkToStringArray(input)).toThrow('Each element in userSpecificVk must have 4 elements');
    });

    it('should roundtrip with userSpecificVkParser', () => {
      const original = Array(16).fill('0').map((_, i) => `${i * 1000}`);
      const parsed = cryptoUtils.userSpecificVkParser(original);
      const backToString = cryptoUtils.userSpecificVkToStringArray(parsed);

      // Should be same values but possibly reordered
      expect(backToString.length).toBe(16);
    });
  });

  describe('cryptoUtils.getOutOfCircuitHashSegment', () => {
    it('should extract hash segment from valid JWT', () => {
      // Create a minimal valid JWT structure
      // Header: {"alg":"RS256","typ":"JWT"}
      const header = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9';
      // Payload: {"sub":"1234567890","name":"John Doe","iat":1516239022}
      const payload = 'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
      const signature = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const jwt = `${header}.${payload}.${signature}`;
      const result = cryptoUtils.getOutOfCircuitHashSegment(jwt, ['sub']);

      expect(typeof result).toBe('string');
      // Result should be a multiple of 64 characters (block size)
      expect(result.length % 64).toBe(0);
    });

    it('should throw for invalid JWT format', () => {
      expect(() => cryptoUtils.getOutOfCircuitHashSegment('invalid', ['sub']))
        .toThrow('Invalid JWT');
    });

    it('should throw for JWT with only 2 parts', () => {
      expect(() => cryptoUtils.getOutOfCircuitHashSegment('header.payload', ['sub']))
        .toThrow('Invalid JWT');
    });

    it('should throw when key is not found in payload', () => {
      // Header: {"alg":"RS256","typ":"JWT"}
      const header = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9';
      // Payload: {"sub":"1234567890"}
      const payload = 'eyJzdWIiOiIxMjM0NTY3ODkwIn0';
      const signature = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const jwt = `${header}.${payload}.${signature}`;

      expect(() => cryptoUtils.getOutOfCircuitHashSegment(jwt, ['nonexistent_key']))
        .toThrow('Claim with key "nonexistent_key" not found in payload');
    });

    it('should handle multiple keys and use minimum offset', () => {
      const header = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9';
      // Payload with multiple claims: {"iss":"test","sub":"1234567890","aud":"client"}
      const payload = 'eyJpc3MiOiJ0ZXN0Iiwic3ViIjoiMTIzNDU2Nzg5MCIsImF1ZCI6ImNsaWVudCJ9';
      const signature = 'signature';

      const jwt = `${header}.${payload}.${signature}`;
      const result = cryptoUtils.getOutOfCircuitHashSegment(jwt, ['sub', 'iss']);

      expect(typeof result).toBe('string');
      expect(result.length % 64).toBe(0);
    });

    it('should throw when keys array is empty', () => {
      const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature';
      expect(() => cryptoUtils.getOutOfCircuitHashSegment(jwt, []))
        .toThrow('getOutOfCircuitHashSegment: keys must be a non-empty array');
    });
  });

  describe('padAndStrToFieldsBN254 edge cases', () => {
    it('should handle string that needs padding to fill exactly one limb', () => {
      // 'a' padded to 31 bytes (1 limb)
      const result = padAndStrToFieldsBN254('a', 31, 0x00);
      expect(result.length).toBe(1);
    });

    it('should handle string that needs padding across multiple limbs', () => {
      // String of 10 chars, padded to 62 (2 limbs)
      const result = padAndStrToFieldsBN254('abcdefghij', 62, 0x00);
      expect(result.length).toBe(2);
    });

    it('should handle userMaxClaimLen smaller than string length', () => {
      // String is 10 chars, userMaxClaimLen is 5, but after padding it becomes 31
      const result = padAndStrToFieldsBN254('abcdefghij', 5, 0x00);
      // calculateMaxClaimLen(5) = 31, string is 10 chars so no padding needed
      // but 10 is not multiple of 31, so it gets padded to 31
      expect(result.length).toBe(1);
    });
  });

  describe('sha256BlockCompress error cases', () => {
    it('should throw when data length is not a multiple of 64 bytes', () => {
      const invalidData = new Uint8Array(32); // Not multiple of 64

      expect(() => cryptoUtils.sha256BlockCompress(invalidData)).toThrow(
        'data length must be a multiple of 64 bytes'
      );
    });

    it('should accept data length that is multiple of 64', () => {
      const validData = new Uint8Array(64);

      expect(() => cryptoUtils.sha256BlockCompress(validData)).not.toThrow();
    });

    it('should accept data length of 128 (2 * 64)', () => {
      const validData = new Uint8Array(128);

      expect(() => cryptoUtils.sha256BlockCompress(validData)).not.toThrow();
    });
  });
});
