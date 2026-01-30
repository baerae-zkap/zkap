/**
 * ZkPasskeySigner 테스트
 *
 * OAuth OIDC를 사용한 ZK 증명 기반 서명 Signer
 * Google/Kakao OAuth 공개키 가져오기, ZK 증명 서버 통신, 스마트 컨트랙트 상호작용
 */

// Mock ABIs first (before any imports)
jest.mock('../../types/abi/ZkapAccount.json', () => ({ abi: [] }), { virtual: true });
jest.mock('../../types/abi/AccountKeyZkOAuthRS256Verifier.json', () => ({ abi: [] }), { virtual: true });
jest.mock('../../types/abi/PoseidonMerkleTreeDirectory.json', () => ({ abi: [] }), { virtual: true });

// Mock crypto utils
const mockGetSignedMessageHash = jest.fn().mockReturnValue('0x' + 'ee'.repeat(32));
jest.mock('../../utils/crypto', () => ({
  __esModule: true,
  default: {
    getSignedMessageHash: mockGetSignedMessageHash,
  },
}));

// Mock ethers
const mockMasterKeyList = jest.fn().mockResolvedValue('0xMasterKeyAddress');
const mockGetTag = jest.fn().mockResolvedValue([BigInt(1), BigInt(2), BigInt(3)]);
const mockGetRoot = jest.fn().mockResolvedValue('0x' + 'ab'.repeat(32));
const mockGetLeafIndexByPubkeyHash = jest.fn().mockResolvedValue('0');
const mockGetMerklePath = jest.fn().mockResolvedValue(['0x1', '0x2', '0x3']);
const mockEncode = jest.fn().mockReturnValue('0xEncodedSignature');

jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
    Contract: jest.fn().mockImplementation(() => ({
      masterKeyList: mockMasterKeyList,
      getTag: mockGetTag,
      getRoot: mockGetRoot,
      getLeafIndexByPubkeyHash: mockGetLeafIndexByPubkeyHash,
      getMerklePath: mockGetMerklePath,
    })),
    AbiCoder: {
      defaultAbiCoder: () => ({
        encode: mockEncode,
      }),
    },
    toBigInt: (x: any) => {
      if (typeof x === 'string') {
        return BigInt(x.startsWith('0x') ? x : `0x${x}`);
      }
      return BigInt(x || 0);
    },
    toBeHex: jest.fn().mockReturnValue('0x' + 'ab'.repeat(32)),
    sha256: jest.fn().mockReturnValue('0x' + 'cd'.repeat(32)),
    toUtf8Bytes: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  },
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { ZkPasskeySigner } from '../ZkPasskeySigner';
import { PrimitiveAccountKeyTypes } from '../../types/AccountKey';

// Helper to create mock JWT
function createMockJwt(kid: string = 'test-kid'): string {
  const header = { alg: 'RS256', kid };
  const payload = { sub: '12345', iss: 'https://accounts.google.com' };
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(payload));
  return `${headerB64}.${payloadB64}.signature`;
}

// Helper to create Google JWKS response
function createGoogleJwksResponse(kid: string = 'test-kid') {
  return {
    keys: [
      { kid, n: 'mock-modulus-n-value', e: 'AQAB', kty: 'RSA' },
      { kid: 'other-kid', n: 'other-modulus', e: 'AQAB', kty: 'RSA' },
    ],
  };
}

// Helper to create Kakao JWKS response
function createKakaoJwksResponse(kid: string = 'kakao-kid') {
  return {
    keys: [
      { kid, n: 'kakao-modulus-n-value', e: 'AQAB', kty: 'RSA' },
    ],
  };
}

// Helper to create proof server response
function createProofResponse() {
  return {
    proof: Array(8).fill('0').map((_, i) => `${i}`),
    publicInputs: Array(8).fill('0').map((_, i) => `${i + 100}`),
  };
}

describe('ZkPasskeySigner', () => {
  const mockProofServerUrl = 'http://localhost:3000';
  const mockEnUrl = 'http://localhost:8545';
  const mockZkapAddress = '0x' + '11'.repeat(20);
  const mockPoseidonTreeAddress = '0x' + '22'.repeat(20);
  let mockIdTokenGenerator: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockIdTokenGenerator = jest.fn().mockResolvedValue(createMockJwt());
  });

  describe('constructor', () => {
    it('should set keyTypes to keyZkOAuthRS256', () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2, // zkapK
        3  // zkapN
      );

      expect(signer.keyTypes).toEqual([PrimitiveAccountKeyTypes.keyZkOAuthRS256]);
      expect(signer.keyTypes[0]).toBe(6);
    });

    it('should throw when socialServices and idTokenGenerators length mismatch', () => {
      expect(() => {
        new ZkPasskeySigner(
          mockProofServerUrl,
          mockEnUrl,
          mockZkapAddress,
          ['google', 'kakao'], // 2 services
          [mockIdTokenGenerator], // only 1 generator
          mockPoseidonTreeAddress,
          2,
          3
        );
      }).toThrow('socialServices.length !== idTokenGenerators.length');
    });

    it('should accept multiple social services', () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao'],
        [mockIdTokenGenerator, mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      expect(signer.keyTypes).toEqual([PrimitiveAccountKeyTypes.keyZkOAuthRS256]);
    });

    it('should initialize selector array based on zkapK and zkapN', () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2, // zkapK = 2 true values
        5  // zkapN = 5 total (3 false values)
      );

      // selector is private, but we can verify via behavior
      expect(signer.keyTypes).toBeDefined();
    });
  });

  describe('init', () => {
    it('should initialize contracts and fetch anchor', async () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await signer.init();

      // init is successful if no error is thrown
      // anchor and contracts are initialized (private members)
      expect(signer.keyTypes).toBeDefined();
    });
  });

  describe('prepareIdToken', () => {
    it('should prepare idToken for given index', async () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      const mockUserOpHash = '0x' + 'ab'.repeat(32);
      const result = await signer.prepareIdToken(mockUserOpHash, 0);

      expect(mockIdTokenGenerator).toHaveBeenCalledTimes(1);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });

    it('should throw when index is out of range', async () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await expect(signer.prepareIdToken('0x' + 'ab'.repeat(32), 5))
        .rejects.toThrow('index is out of range');
    });

    it('should throw when idTokenGenerator is undefined', async () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [undefined as any],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await expect(signer.prepareIdToken('0x' + 'ab'.repeat(32), 0))
        .rejects.toThrow('idTokenGenerator undefined');
    });

    it('should throw when idToken is undefined', async () => {
      const failingGenerator = jest.fn().mockResolvedValue(undefined);
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [failingGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await expect(signer.prepareIdToken('0x' + 'ab'.repeat(32), 0))
        .rejects.toThrow('idToken is undefined');
    });

    it('should initialize if not already initialized', async () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      // prepareIdToken should call init internally
      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      expect(mockIdTokenGenerator).toHaveBeenCalled();
    });

    it('should prepare multiple idTokens for multiple services', async () => {
      const generator1 = jest.fn().mockResolvedValue(createMockJwt('kid1'));
      const generator2 = jest.fn().mockResolvedValue(createMockJwt('kid2'));

      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao'],
        [generator1, generator2],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);
      const result = await signer.prepareIdToken('0x' + 'cd'.repeat(32), 1);

      expect(result.length).toBe(2);
    });
  });

  describe('signUserOpHash', () => {
    it('should throw when idTokens is not prepared', async () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32)))
        .rejects.toThrow('idToken is not initialized');
    });

    it('should sign after preparing idToken with Google', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createGoogleJwksResponse()),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createProofResponse()),
        });

      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);
      const signatures = await signer.signUserOpHash('0x' + 'ab'.repeat(32));

      expect(Array.isArray(signatures)).toBe(true);
      expect(signatures.length).toBe(1);
    });

    it('should sign after preparing idToken with Kakao', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createKakaoJwksResponse('kakao-kid')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createProofResponse()),
        });

      const kakaoGenerator = jest.fn().mockResolvedValue(createMockJwt('kakao-kid'));
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['kakao'],
        [kakaoGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);
      const signatures = await signer.signUserOpHash('0x' + 'ab'.repeat(32));

      expect(signatures.length).toBe(1);
    });

    it('should throw for invalid social service', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ keys: [{ kid: 'test-kid', n: 'modulus' }] }),
      });

      const invalidGenerator = jest.fn().mockResolvedValue(createMockJwt());
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['facebook' as any], // Invalid service
        [invalidGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32)))
        .rejects.toThrow('Invalid service');
    });
  });

  describe('getSignatures', () => {
    it('should throw when poseidonMerkleTreeDirectory not initialized', async () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      // Call getSignatures directly without init
      await expect(
        signer.getSignatures(['jwt1'], ['pk1'], [0], [['path1']])
      ).rejects.toThrow('poseidonMerkleTreeDirectory is not initialized');
    });

    it('should handle single idToken (duplicates to 3)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createProofResponse()),
      });

      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await signer.init();
      const signatures = await signer.getSignatures(
        ['jwt1'],
        ['pk1'],
        [0],
        [['path1', 'path2']]
      );

      expect(signatures.length).toBe(1);
      // Verify proof server was called with duplicated arrays
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockProofServerUrl}/proof2`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should handle two idTokens (duplicates first to 3)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createProofResponse()),
      });

      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao'],
        [mockIdTokenGenerator, mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await signer.init();
      const signatures = await signer.getSignatures(
        ['jwt1', 'jwt2'],
        ['pk1', 'pk2'],
        [0, 1],
        [['path1'], ['path2']]
      );

      expect(signatures.length).toBe(1);
    });

    it('should handle three idTokens directly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createProofResponse()),
      });

      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao', 'google'],
        [mockIdTokenGenerator, mockIdTokenGenerator, mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await signer.init();
      const signatures = await signer.getSignatures(
        ['jwt1', 'jwt2', 'jwt3'],
        ['pk1', 'pk2', 'pk3'],
        [0, 1, 2],
        [['p1'], ['p2'], ['p3']]
      );

      expect(signatures.length).toBe(1);
    });
  });

  describe('OAuth public key fetching', () => {
    it('should fetch Google public key successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createGoogleJwksResponse('google-kid')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createProofResponse()),
        });

      const googleGenerator = jest.fn().mockResolvedValue(createMockJwt('google-kid'));
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [googleGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);
      await signer.signUserOpHash();

      expect(mockFetch).toHaveBeenCalledWith('https://www.googleapis.com/oauth2/v3/certs');
    });

    it('should fetch Kakao public key successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createKakaoJwksResponse('kakao-kid')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createProofResponse()),
        });

      const kakaoGenerator = jest.fn().mockResolvedValue(createMockJwt('kakao-kid'));
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['kakao'],
        [kakaoGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);
      await signer.signUserOpHash();

      expect(mockFetch).toHaveBeenCalledWith('https://kauth.kakao.com/.well-known/jwks.json');
    });

    it('should throw when public key not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ keys: [{ kid: 'wrong-kid', n: 'modulus' }] }),
      });

      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash()).rejects.toThrow('Public key not found');
    });

    it('should throw when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash()).rejects.toThrow('HTTP error! status: 500');
    });

    it('should throw HTTP error when Kakao fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const kakaoGenerator = jest.fn().mockResolvedValue(createMockJwt('kakao-kid'));
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['kakao'],
        [kakaoGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash()).rejects.toThrow('HTTP error! status: 503');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should throw when Kakao public key not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ keys: [{ kid: 'different-kid', n: 'modulus' }] }),
      });

      const kakaoGenerator = jest.fn().mockResolvedValue(createMockJwt('kakao-kid'));
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['kakao'],
        [kakaoGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash()).rejects.toThrow('Public key not found');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log and rethrow error when Kakao fetch throws exception', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const kakaoGenerator = jest.fn().mockResolvedValue(createMockJwt('kakao-kid'));
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['kakao'],
        [kakaoGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash()).rejects.toThrow('Network error');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching Kakao public keys:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('full signing flow', () => {
    it('should complete full signing flow with single service', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createGoogleJwksResponse()),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createProofResponse()),
        });

      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      const userOpHash = '0x' + 'ab'.repeat(32);

      // Step 1: Prepare idToken
      await signer.prepareIdToken(userOpHash, 0);

      // Step 2: Sign
      const signatures = await signer.signUserOpHash(userOpHash);

      expect(signatures.length).toBe(1);
      expect(signatures[0]).toMatch(/^0x/);
    });

    it('should complete full signing flow with multiple services', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createGoogleJwksResponse('google-kid')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createKakaoJwksResponse('kakao-kid')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createProofResponse()),
        });

      const googleGenerator = jest.fn().mockResolvedValue(createMockJwt('google-kid'));
      const kakaoGenerator = jest.fn().mockResolvedValue(createMockJwt('kakao-kid'));

      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao'],
        [googleGenerator, kakaoGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      );

      const userOpHash = '0x' + 'ab'.repeat(32);

      // Prepare both idTokens
      await signer.prepareIdToken(userOpHash, 0);
      await signer.prepareIdToken(userOpHash, 1);

      // Sign
      const signatures = await signer.signUserOpHash(userOpHash);

      expect(signatures.length).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty social services array', () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        [],
        [],
        mockPoseidonTreeAddress,
        2,
        3
      );

      expect(signer.keyTypes).toEqual([PrimitiveAccountKeyTypes.keyZkOAuthRS256]);
    });

    it('should handle zkapK = 0', () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        0, // zkapK = 0
        3
      );

      expect(signer.keyTypes).toBeDefined();
    });

    it('should handle zkapK = zkapN', () => {
      const signer = new ZkPasskeySigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        3, // zkapK = zkapN
        3
      );

      expect(signer.keyTypes).toBeDefined();
    });
  });
});
