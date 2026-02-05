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

      expect(encoded).toMatch(/^0x/);
      // initialize(address) selector is 0xc4d66de8
      expect(encoded.slice(0, 10)).toBe('0xc4d66de8');
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
  });

  describe('getEncodedSecp256r1Key', () => {
    it('should encode secp256r1 public key', () => {
      const builder = new AccountKeyBuilder();
      // 65 byte uncompressed public key (04 prefix + 32 bytes x + 32 bytes y)
      const pubkey = '0x04' + 'ee'.repeat(32) + 'ff'.repeat(32);

      const encoded = builder.getEncodedSecp256r1Key(pubkey);

      expect(encoded).toMatch(/^0x/);
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

      expect(encoded).toMatch(/^0x/);
      // initialize(bytes,address) selector is 0xcce2df03
      expect(encoded.slice(0, 10)).toBe('0xcce2df03');
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

      expect(encoded).toMatch(/^0x/);
      // initialize(bytes,bytes32,bytes) selector is 0x5fca9cbd
      expect(encoded.slice(0, 10)).toBe('0x5fca9cbd');
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
          keyType: PrimitiveAccountKeyTypes.keyWebAuthn, // WebAuthn not supported in setEncodedInitData
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

      expect(() => builder.setEncodedInitData(1, keyInfoList)).toThrow(
        'Unsupported key type: 4'
      );
    });
  });

  describe('getDecodedKeyTypes', () => {
    it('should decode address key type from encoded data', () => {
      const builder = new AccountKeyBuilder();

      // First encode some address keys
      const keyInfoList: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
      ];

      const encoded = builder.setEncodedKeyData(1, keyInfoList);
      const keyTypes = builder.getDecodedKeyTypes(encoded);

      expect(keyTypes).toEqual([PrimitiveAccountKeyTypes.keyAddress]);
    });

    it('should decode multiple key types', () => {
      const builder = new AccountKeyBuilder();

      // Using Address and WebAuthn keys which have matching encode/decode selectors
      const keyInfoList: KeyInfo[] = [
        {
          keyType: PrimitiveAccountKeyTypes.keyAddress,
          logicContract: mockLogicContract,
          weight: 1,
          keyData: { signerAddress: mockAddress } as AddressKeyData,
        },
        {
          keyType: PrimitiveAccountKeyTypes.keyWebAuthn,
          logicContract: '0x' + '99'.repeat(20),
          weight: 2,
          keyData: {
            credentialPubkey: '0x' + 'aa'.repeat(77),
            credentialId: 'cred-id',
            rpIdHash: '0x' + 'bb'.repeat(32),
            origin: 'https://test.com',
          } as WebAuthnKeyData,
        },
      ];

      const encoded = builder.setEncodedKeyData(2, keyInfoList);
      const keyTypes = builder.getDecodedKeyTypes(encoded);

      expect(keyTypes).toEqual([
        PrimitiveAccountKeyTypes.keyAddress,
        PrimitiveAccountKeyTypes.keyWebAuthn,
      ]);
    });

    it('should decode WebAuthn key type', () => {
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
      const keyTypes = builder.getDecodedKeyTypes(encoded);

      expect(keyTypes).toEqual([PrimitiveAccountKeyTypes.keyWebAuthn]);
    });

    it('should throw for unsupported selector', () => {
      const builder = new AccountKeyBuilder();

      // Create encoded data with an invalid selector
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const invalidEncoded = abiCoder.encode(
        ['uint8', 'address[]', 'bytes[]', 'uint8[]'],
        [1, [mockLogicContract], ['0xdeadbeef' + '00'.repeat(28)], [1]]
      );

      expect(() => builder.getDecodedKeyTypes(invalidEncoded)).toThrow(
        'Unsupported key type: 0xdeadbeef'
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
    it('should handle zero threshold with no keys', () => {
      const builder = new AccountKeyBuilder(0, []);
      expect(builder.getEncodedKey()).not.toBe('');
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

      const keyTypes = builder.getDecodedKeyTypes(builder.getEncodedKey());
      expect(keyTypes.length).toBe(3);
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
