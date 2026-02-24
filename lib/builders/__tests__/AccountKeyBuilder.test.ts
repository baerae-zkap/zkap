/**
 * AccountKeyBuilder 테스트
 *
 * 다양한 키 타입의 인코딩 및 디코딩 기능 테스트
 */

// Mock crypto module before imports
jest.mock('../../utils/crypto', () => ({
  __esModule: true,
  default: {
    userSpecificVkParser: jest.fn().mockReturnValue([
      [BigInt(1), BigInt(2), BigInt(3), BigInt(4)],
      [BigInt(5), BigInt(6), BigInt(7), BigInt(8)],
      [BigInt(9), BigInt(10), BigInt(11), BigInt(12)],
      [BigInt(13), BigInt(14), BigInt(15), BigInt(16)],
    ]),
  },
}));

// Mock tiny-cbor
jest.mock('@levischuck/tiny-cbor', () => ({
  decodePartialCBOR: jest.fn().mockImplementation((input) => {
    // Return a mock Map that simulates EC2 public key
    const mockMap = new Map();
    mockMap.set(1, 2); // kty = EC2
    mockMap.set(3, -7); // alg = ES256
    mockMap.set(-1, 1); // crv = P-256
    mockMap.set(-2, new Uint8Array(32).fill(0xaa)); // x
    mockMap.set(-3, new Uint8Array(32).fill(0xbb)); // y
    return [mockMap, input.length];
  }),
}));

import { AccountKeyBuilder } from '../AccountKeyBuilder';
import { PrimitiveAccountKeyTypes, KeyInfo, AddressKeyData, WebAuthnKeyData, ZkOAuthRS256KeyData } from '../../types/AccountKey';
import { ethers } from 'ethers';

describe('AccountKeyBuilder', () => {
  const mockLogicContract = '0x' + '11'.repeat(20);
  const mockAddress = '0x' + '22'.repeat(20);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance without parameters', () => {
      const builder = new AccountKeyBuilder();

      expect(builder).toBeInstanceOf(AccountKeyBuilder);
      expect(builder.getEncodedKey()).toBe('');
    });

    it('should create instance with threshold and keys', () => {
      const keys: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
      ];

      const builder = new AccountKeyBuilder(1, keys);

      expect(builder).toBeInstanceOf(AccountKeyBuilder);
      expect(builder.getEncodedKey()).not.toBe('');
    });

    it('should throw when threshold exceeds weight sum', () => {
      const keys: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
      ];

      expect(() => new AccountKeyBuilder(5, keys)).toThrow(
        'Threshold is greater than the sum of weights'
      );
    });
  });

  describe('checkThreshold', () => {
    it('should return true when weight sum meets threshold', () => {
      const keys: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 2,
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 3,
          keyData: { signerAddress: '0x' + '33'.repeat(20) } as AddressKeyData,
        },
      ];

      const builder = new AccountKeyBuilder(5, keys);
      expect(builder).toBeInstanceOf(AccountKeyBuilder);
    });

    it('should allow weight sum greater than threshold', () => {
      const keys: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 10,
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
      ];

      const builder = new AccountKeyBuilder(3, keys);
      expect(builder).toBeInstanceOf(AccountKeyBuilder);
    });
  });

  describe('getEncodedAddressKey', () => {
    it('should encode address key', () => {
      const builder = new AccountKeyBuilder();
      const encoded = builder.getEncodedAddressKey(mockAddress);

      expect(encoded).toMatch(/^0x/);
      expect(encoded.toLowerCase()).toContain(mockAddress.slice(2).toLowerCase());
    });

    it('should produce different encodings for different addresses', () => {
      const builder = new AccountKeyBuilder();
      const encoded1 = builder.getEncodedAddressKey('0x' + '11'.repeat(20));
      const encoded2 = builder.getEncodedAddressKey('0x' + '22'.repeat(20));

      expect(encoded1).not.toBe(encoded2);
    });
  });

  describe('getEncodedAddressKeyInitData', () => {
    it('should encode address key init data', () => {
      const builder = new AccountKeyBuilder();
      const addressKeyData: AddressKeyData = { signerAddress: mockAddress };

      const encoded = builder.getEncodedAddressKeyInitData(addressKeyData);

      // raw abi.encode(address) — no function selector
      expect(encoded).toMatch(/^0x/);
      expect(encoded.length).toBe(66); // 0x + 64 hex chars (32 bytes)
    });
  });

  describe('getEncodedOAuthKey', () => {
    it('should encode OAuth key', () => {
      const builder = new AccountKeyBuilder();

      const encoded = builder.getEncodedOAuthKey(
        'https://accounts.google.com',
        'key-id-123',
        'user-sub-456',
        'test@example.com',
        true,
        true
      );

      expect(encoded).toMatch(/^0x/);
    });

    it('should handle different verification flags', () => {
      const builder = new AccountKeyBuilder();

      const encoded1 = builder.getEncodedOAuthKey(
        'https://accounts.google.com',
        'key-id',
        'sub',
        'email@test.com',
        true,
        false
      );

      const encoded2 = builder.getEncodedOAuthKey(
        'https://accounts.google.com',
        'key-id',
        'sub',
        'email@test.com',
        false,
        true
      );

      expect(encoded1).not.toBe(encoded2);
    });
  });

  describe('getEncodedSecp256k1Key', () => {
    it('should encode secp256k1 public key', () => {
      const builder = new AccountKeyBuilder();
      // 65 byte uncompressed public key (04 prefix + 32 bytes x + 32 bytes y)
      const pubkey = '0x04' + 'aa'.repeat(32) + 'bb'.repeat(32);

      const encoded = builder.getEncodedSecp256k1Key(pubkey);

      expect(encoded).toMatch(/^0x/);
    });

    it('should produce different encodings for different keys', () => {
      const builder = new AccountKeyBuilder();
      const pubkey1 = '0x04' + 'aa'.repeat(32) + 'bb'.repeat(32);
      const pubkey2 = '0x04' + 'cc'.repeat(32) + 'dd'.repeat(32);

      const encoded1 = builder.getEncodedSecp256k1Key(pubkey1);
      const encoded2 = builder.getEncodedSecp256k1Key(pubkey2);

      expect(encoded1).not.toBe(encoded2);
    });

    it('should throw when x coordinate is zero', () => {
      const builder = new AccountKeyBuilder();
      // x = 0, y = non-zero
      const pubkey = '0x04' + '00'.repeat(32) + 'bb'.repeat(32);

      expect(() => builder.getEncodedSecp256k1Key(pubkey)).toThrow(
        'Invalid public key: x and y coordinates must be non-zero'
      );
    });

    it('should throw when y coordinate is zero', () => {
      const builder = new AccountKeyBuilder();
      // x = non-zero, y = 0
      const pubkey = '0x04' + 'aa'.repeat(32) + '00'.repeat(32);

      expect(() => builder.getEncodedSecp256k1Key(pubkey)).toThrow(
        'Invalid public key: x and y coordinates must be non-zero'
      );
    });
  });

  describe('getEncodedSecp256r1Key', () => {
    it('should encode secp256r1 public key', () => {
      const builder = new AccountKeyBuilder();
      // 65 byte uncompressed public key (04 prefix + 32 bytes x + 32 bytes y)
      const pubkey = '0x04' + 'ee'.repeat(32) + 'ff'.repeat(32);

      const encoded = builder.getEncodedSecp256r1Key(pubkey);

      expect(encoded).toMatch(/^0x/);
    });

    it('should throw when x coordinate is zero', () => {
      const builder = new AccountKeyBuilder();
      const pubkey = '0x04' + '00'.repeat(32) + 'ff'.repeat(32);

      expect(() => builder.getEncodedSecp256r1Key(pubkey)).toThrow(
        'Invalid public key: x and y coordinates must be non-zero'
      );
    });

    it('should throw when y coordinate is zero', () => {
      const builder = new AccountKeyBuilder();
      const pubkey = '0x04' + 'ee'.repeat(32) + '00'.repeat(32);

      expect(() => builder.getEncodedSecp256r1Key(pubkey)).toThrow(
        'Invalid public key: x and y coordinates must be non-zero'
      );
    });
  });

  describe('getEncodedZkOAuthRS256Key', () => {
    it('should encode ZkOAuth RS256 key with 16 elements', () => {
      const builder = new AccountKeyBuilder();
      const userSpecificVk = Array(16).fill('123456789');

      const encoded = builder.getEncodedZkOAuthRS256Key(userSpecificVk);

      expect(encoded).toMatch(/^0x/);
    });

    it('should throw when userSpecificVk is not 16 elements', () => {
      const builder = new AccountKeyBuilder();
      const userSpecificVk = Array(10).fill('123456789');

      expect(() => builder.getEncodedZkOAuthRS256Key(userSpecificVk)).toThrow(
        'userSpecificVk must be 16 elements'
      );
    });

    it('should throw when userSpecificVk has wrong length', () => {
      const builder = new AccountKeyBuilder();
      const userSpecificVk = Array(20).fill('123456789');

      expect(() => builder.getEncodedZkOAuthRS256Key(userSpecificVk)).toThrow(
        'userSpecificVk must be 16 elements'
      );
    });
  });

  describe('getEncodedCommitment', () => {
    it('should encode commitment array', () => {
      const builder = new AccountKeyBuilder();
      const commitment = ['0x1', '0x2', '0x3'];

      const encoded = builder.getEncodedCommitment(commitment);

      expect(encoded).toMatch(/^0x/);
    });

    it('should handle empty commitment array', () => {
      const builder = new AccountKeyBuilder();
      const commitment: string[] = [];

      const encoded = builder.getEncodedCommitment(commitment);

      expect(encoded).toMatch(/^0x/);
    });

    it('should handle large commitment array', () => {
      const builder = new AccountKeyBuilder();
      const commitment = Array(100).fill('0x' + 'ab'.repeat(32));

      const encoded = builder.getEncodedCommitment(commitment);

      expect(encoded).toMatch(/^0x/);
    });
  });

  describe('getEncodedZkOAuthRS256KeyInitData', () => {
    it('should encode ZkOAuthRS256 key init data', () => {
      const builder = new AccountKeyBuilder();
      const zkOAuthKeyData: ZkOAuthRS256KeyData = {
        n: 17,
        k: 2,
        hAudList: '0x123',
        commitment: ['0x1', '0x2', '0x3'],
        poseidonMerkleTreeDirectory: '0x' + '44'.repeat(20),
      };

      const encoded = builder.getEncodedZkOAuthRS256KeyInitData(zkOAuthKeyData);

      // raw abi.encode(bytes, address) — no function selector
      expect(encoded).toMatch(/^0x/);
      expect(encoded.length).toBeGreaterThan(10);
    });

    it('should throw when hAudList is missing', () => {
      const builder = new AccountKeyBuilder();
      const keyDataWithoutHAudList = {
        n: 17,
        k: 2,
        commitment: ['0x1', '0x2'],
        poseidonMerkleTreeDirectory: '0x' + '44'.repeat(20),
      } as unknown as ZkOAuthRS256KeyData;

      expect(() => builder.getEncodedZkOAuthRS256KeyInitData(keyDataWithoutHAudList))
        .toThrow('ZkOAuthRS256KeyData.hAudList is required');
    });

    it('should throw when hAudList is empty string', () => {
      const builder = new AccountKeyBuilder();
      const keyDataEmptyHAudList: ZkOAuthRS256KeyData = {
        n: 17,
        k: 2,
        hAudList: '',
        commitment: ['0x1', '0x2'],
        poseidonMerkleTreeDirectory: '0x' + '44'.repeat(20),
      };

      expect(() => builder.getEncodedZkOAuthRS256KeyInitData(keyDataEmptyHAudList))
        .toThrow('ZkOAuthRS256KeyData.hAudList is required');
    });

    it('should throw when hAudList is bare "0x"', () => {
      const builder = new AccountKeyBuilder();
      const keyDataBareHex: ZkOAuthRS256KeyData = {
        n: 17,
        k: 2,
        hAudList: '0x',
        commitment: ['0x1', '0x2'],
        poseidonMerkleTreeDirectory: '0x' + '44'.repeat(20),
      };

      expect(() => builder.getEncodedZkOAuthRS256KeyInitData(keyDataBareHex))
        .toThrow('ZkOAuthRS256KeyData.hAudList is required');
    });
  });

  describe('computeHAudList', () => {
    it('should return a 32-byte hex hash from audience strings', () => {
      const result = AccountKeyBuilder.computeHAudList(['https://example.com']);
      expect(result).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    it('should return different hashes for different audiences', () => {
      const hash1 = AccountKeyBuilder.computeHAudList(['https://example.com']);
      const hash2 = AccountKeyBuilder.computeHAudList(['https://other.com']);
      expect(hash1).not.toBe(hash2);
    });

    it('should return consistent hash for same audiences', () => {
      const hash1 = AccountKeyBuilder.computeHAudList(['https://example.com', 'https://other.com']);
      const hash2 = AccountKeyBuilder.computeHAudList(['https://example.com', 'https://other.com']);
      expect(hash1).toBe(hash2);
    });

    it('should throw when audiences is empty array', () => {
      expect(() => AccountKeyBuilder.computeHAudList([]))
        .toThrow('computeHAudList: audiences must be a non-empty array');
    });

    it('should produce a valid hAudList usable in getEncodedZkOAuthRS256KeyInitData', () => {
      const hAudList = AccountKeyBuilder.computeHAudList(['https://example.com']);
      const builder = new AccountKeyBuilder();
      expect(() => builder.getEncodedZkOAuthRS256KeyInitData({
        n: 17,
        k: 2,
        hAudList,
        commitment: ['0x1', '0x2'],
        poseidonMerkleTreeDirectory: '0x' + '44'.repeat(20),
      })).not.toThrow();
    });

    it('should handle different n and k values', () => {
      const builder = new AccountKeyBuilder();

      const encoded1 = builder.getEncodedZkOAuthRS256KeyInitData({
        n: 17,
        k: 2,
        hAudList: '0x123',
        commitment: ['0x1'],
        poseidonMerkleTreeDirectory: '0x' + '55'.repeat(20),
      });

      const encoded2 = builder.getEncodedZkOAuthRS256KeyInitData({
        n: 32,
        k: 4,
        hAudList: '0x456',
        commitment: ['0x1'],
        poseidonMerkleTreeDirectory: '0x' + '55'.repeat(20),
      });

      expect(encoded1).not.toBe(encoded2);
    });
  });

  describe('getEncodedWebAuthnKeyInitData', () => {
    it('should encode WebAuthn key init data', () => {
      const builder = new AccountKeyBuilder();

      // Create a minimal CBOR-encoded EC2 public key (mocked)
      const credentialPubkey = '0x' + 'aa'.repeat(77); // Simulated CBOR data

      const webAuthnKeyData: WebAuthnKeyData = {
        credentialPubkey,
        credentialId: 'credential-id-123',
        rpIdHash: '0x' + 'bb'.repeat(32),
        origin: 'https://example.com',
      };

      const encoded = builder.getEncodedWebAuthnKeyInitData(webAuthnKeyData);

      // raw abi.encode(bytes, bytes32, bytes, bool) — no function selector
      expect(encoded).toMatch(/^0x/);
      expect(encoded.length).toBeGreaterThan(10);
    });

    it('should encode WebAuthn key init data with requireUV=true', () => {
      const builder = new AccountKeyBuilder();
      const credentialPubkey = '0x' + 'aa'.repeat(77);

      const webAuthnKeyData: WebAuthnKeyData = {
        credentialPubkey,
        credentialId: 'credential-id-123',
        rpIdHash: '0x' + 'bb'.repeat(32),
        origin: 'https://example.com',
        requireUV: true,
      };

      const encoded = builder.getEncodedWebAuthnKeyInitData(webAuthnKeyData);
      expect(encoded).toMatch(/^0x/);
    });

    it('should throw when public key is not EC2 in getEncodedWebAuthnKeyInitData', () => {
      const { decodePartialCBOR } = require('@levischuck/tiny-cbor');
      (decodePartialCBOR as jest.Mock).mockImplementationOnce((input: Uint8Array) => {
        const mockMap = new Map();
        mockMap.set(1, 1); // kty = OKP (not EC2)
        return [mockMap, input.length];
      });

      const builder = new AccountKeyBuilder();
      const webAuthnKeyData: WebAuthnKeyData = {
        credentialPubkey: '0x' + 'aa'.repeat(77),
        credentialId: 'credential-id',
        rpIdHash: '0x' + 'bb'.repeat(32),
        origin: 'https://example.com',
      };

      expect(() => builder.getEncodedWebAuthnKeyInitData(webAuthnKeyData)).toThrow('Not EC2');
    });
  });

  describe('getEncodedWebAuthnKey', () => {
    it('should encode WebAuthn key', () => {
      const builder = new AccountKeyBuilder();

      // Create mock CBOR public key data
      const credentialPubkey = '0x' + 'cc'.repeat(77);

      const encoded = builder.getEncodedWebAuthnKey(
        credentialPubkey,
        'credential-id',
        '0x' + 'dd'.repeat(32),
        'https://example.com'
      );

      expect(encoded).toMatch(/^0x/);
    });

    it('should encode WebAuthn key with requireUV=true', () => {
      const builder = new AccountKeyBuilder();
      const credentialPubkey = '0x' + 'cc'.repeat(77);

      const encoded = builder.getEncodedWebAuthnKey(
        credentialPubkey,
        'credential-id',
        '0x' + 'dd'.repeat(32),
        'https://example.com',
        true
      );

      expect(encoded).toMatch(/^0x/);
    });

    it('should throw when public key is not EC2 in getEncodedWebAuthnKey', () => {
      const { decodePartialCBOR } = require('@levischuck/tiny-cbor');
      (decodePartialCBOR as jest.Mock).mockImplementationOnce((input: Uint8Array) => {
        const mockMap = new Map();
        mockMap.set(1, 1); // kty = OKP (not EC2)
        return [mockMap, input.length];
      });

      const builder = new AccountKeyBuilder();

      expect(() =>
        builder.getEncodedWebAuthnKey(
          '0x' + 'cc'.repeat(77),
          'credential-id',
          '0x' + 'dd'.repeat(32),
          'https://example.com'
        )
      ).toThrow('Not EC2');
    });
  });

  describe('encodeCall', () => {
    it('should encode function call data', () => {
      const builder = new AccountKeyBuilder();
      const iface = new ethers.Interface([
        'function transfer(address to, uint256 amount)',
      ]);

      const encoded = builder.encodeCall(iface, 'transfer', [
        mockAddress,
        BigInt(1000),
      ]);

      expect(encoded).toMatch(/^0x/);
      // transfer(address,uint256) selector is 0xa9059cbb
      expect(encoded.slice(0, 10)).toBe('0xa9059cbb');
    });
  });

  describe('setEncodedKeyData', () => {
    it('should encode multiple address keys', () => {
      const builder = new AccountKeyBuilder();
      const keyInfoList: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: '0x' + '33'.repeat(20),
          weight: 2,
          keyData: { signerAddress: '0x' + '44'.repeat(20) } as AddressKeyData,
        },
      ];

      const encoded = builder.setEncodedKeyData(2, keyInfoList);

      expect(encoded).toMatch(/^0x/);
    });

    it('should encode ZkOAuthRS256 key data', () => {
      const builder = new AccountKeyBuilder();
      const keyInfoList: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyZkOAuthRS256,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: {
            n: 17,
            k: 2,
            hAudList: '0x123',
            commitment: ['0x1', '0x2'],
            poseidonMerkleTreeDirectory: '0x' + '55'.repeat(20),
          } as ZkOAuthRS256KeyData,
        },
      ];

      const encoded = builder.setEncodedKeyData(1, keyInfoList);

      expect(encoded).toMatch(/^0x/);
    });

    it('should encode WebAuthn key data', () => {
      const builder = new AccountKeyBuilder();
      const keyInfoList: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyWebAuthn,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: {
            credentialPubkey: '0x' + 'aa'.repeat(77),
            credentialId: 'cred-id',
            rpIdHash: '0x' + 'bb'.repeat(32),
            origin: 'https://test.com',
          } as WebAuthnKeyData,
        },
      ];

      const encoded = builder.setEncodedKeyData(1, keyInfoList);

      expect(encoded).toMatch(/^0x/);
    });

    it('should throw for unsupported key type', () => {
      const builder = new AccountKeyBuilder();
      const keyInfoList: KeyInfo[] = [
        {
          keyType: 999, // Unsupported key type
          logicContract: mockLogicContract,
          weight: 1,
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
      ];

      expect(() => builder.setEncodedKeyData(1, keyInfoList)).toThrow(
        'Unsupported key type: 999'
      );
    });

    it('should handle mixed key types', () => {
      const builder = new AccountKeyBuilder();
      const keyInfoList: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
        {
          keyType: PrimitiveAccountKeyTypes.keyZkOAuthRS256,
          logicContract: '0x' + '66'.repeat(20),
          weight: 2,
          keyData: {
            n: 17,
            k: 2,
            hAudList: '0xabc',
            commitment: ['0x1'],
            poseidonMerkleTreeDirectory: '0x' + '77'.repeat(20),
          } as ZkOAuthRS256KeyData,
        },
      ];

      const encoded = builder.setEncodedKeyData(2, keyInfoList);

      expect(encoded).toMatch(/^0x/);
    });
  });

  describe('setEncodedInitData', () => {
    it('should encode init data for address keys', () => {
      const builder = new AccountKeyBuilder();
      const keyInfoList: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
      ];

      const encoded = builder.setEncodedInitData(1, keyInfoList);

      expect(encoded).toMatch(/^0x/);
    });

    it('should encode init data for ZkOAuthRS256 keys', () => {
      const builder = new AccountKeyBuilder();
      const keyInfoList: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyZkOAuthRS256,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: {
            n: 17,
            k: 2,
            hAudList: '0x456',
            commitment: ['0x1', '0x2', '0x3'],
            poseidonMerkleTreeDirectory: '0x' + '88'.repeat(20),
          } as ZkOAuthRS256KeyData,
        },
      ];

      const encoded = builder.setEncodedInitData(1, keyInfoList);

      expect(encoded).toMatch(/^0x/);
    });

    it('should throw for unsupported key type in setEncodedInitData', () => {
      const builder = new AccountKeyBuilder();
      const keyInfoList: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keySecp256k1, // Secp256k1 not supported in setEncodedInitData
          logicContract: mockLogicContract,
          weight: 1,
          keyData: {} as any,
        },
      ];

      expect(() => builder.setEncodedInitData(1, keyInfoList)).toThrow(
        'Unsupported key type: 2'
      );
    });
  });


  describe('getEncodedKey', () => {
    it('should return empty string for uninitialized builder', () => {
      const builder = new AccountKeyBuilder();
      expect(builder.getEncodedKey()).toBe('');
    });

    it('should return encoded key for initialized builder', () => {
      const keys: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
      ];

      const builder = new AccountKeyBuilder(1, keys);
      const encoded = builder.getEncodedKey();

      expect(encoded).toMatch(/^0x/);
      expect(encoded.length).toBeGreaterThan(10);
    });
  });

  describe('CBOR decoding (private methods)', () => {
    it('should handle EC2 public key decoding in getEncodedWebAuthnKey', () => {
      const builder = new AccountKeyBuilder();

      // Mock CBOR data that will be parsed by tiny-cbor mock
      const credentialPubkey = '0x' + 'ee'.repeat(77);

      const encoded = builder.getEncodedWebAuthnKey(
        credentialPubkey,
        'test-credential-id',
        '0x' + 'ff'.repeat(32),
        'https://localhost'
      );

      expect(encoded).toMatch(/^0x/);
    });
  });

  describe('edge cases', () => {
    it('should throw when threshold is zero', () => {
      expect(() => new AccountKeyBuilder(0, [])).toThrow("Threshold must be greater than 0");
    });

    it('should handle large weight values', () => {
      const keys: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 255, // Max uint8
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
      ];

      const builder = new AccountKeyBuilder(100, keys);
      expect(builder.getEncodedKey()).not.toBe('');
    });

    it('should handle multiple keys with same weight', () => {
      const keys: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: '0x' + 'bb'.repeat(20),
          weight: 1,
          keyData: { signerAddress: '0x' + 'cc'.repeat(20) } as AddressKeyData,
        },
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: '0x' + 'dd'.repeat(20),
          weight: 1,
          keyData: { signerAddress: '0x' + 'ee'.repeat(20) } as AddressKeyData,
        },
      ];

      const builder = new AccountKeyBuilder(2, keys);
      expect(builder.getEncodedKey()).not.toBe('');
    });

    it('should handle empty commitment in ZkOAuthRS256KeyData', () => {
      const builder = new AccountKeyBuilder();
      const keyInfoList: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyZkOAuthRS256,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: {
            n: 17,
            k: 2,
            hAudList: '0x789',
            commitment: [],
            poseidonMerkleTreeDirectory: '0x' + 'ff'.repeat(20),
          } as ZkOAuthRS256KeyData,
        },
      ];

      const encoded = builder.setEncodedKeyData(1, keyInfoList);
      expect(encoded).toMatch(/^0x/);
    });
  });
});
