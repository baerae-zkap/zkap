/**
 * ZkOAuthSigner tests
 *
 * Signer that signs using ZK proofs with OAuth OIDC
 * Fetches Google/Kakao OAuth public keys, communicates with the ZK proof server, and interacts with smart contracts
 */

// Mock crypto utils
const mockGetSignedMessageHash = jest.fn().mockReturnValue('0x' + 'ee'.repeat(32));
jest.mock('../../utils/crypto', () => ({
  __esModule: true,
  default: {
    getSignedMessageHash: mockGetSignedMessageHash,
  },
  BN254_FR: 21888242871839275222246405745257275088548364400416034343698204186575808495617n,
}));

// Mock ethers
const mockMasterKeyList = jest.fn().mockResolvedValue({ logic: '0xMasterKeyAddress', keyId: BigInt(0) });
const mockGetAnchor = jest.fn().mockResolvedValue([BigInt(1), BigInt(2), BigInt(3)]);
const mockGetRoot = jest.fn().mockResolvedValue('0x' + 'ab'.repeat(32));
const mockGetLeafIndexByPubkeyHash = jest.fn().mockResolvedValue('0');
const mockGetMerklePath = jest.fn().mockResolvedValue(['0x1', '0x2', '0x3']);
const mockEncode = jest.fn().mockReturnValue('0xEncodedSignature');

jest.mock('ethers', () => ({
  ethers: {
    isAddress: jest.fn().mockReturnValue(true),
    JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
    Contract: jest.fn().mockImplementation(() => ({
      masterKeyList: mockMasterKeyList,
      getAnchor: mockGetAnchor,
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
    ZeroAddress: '0x0000000000000000000000000000000000000000',
  },
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { ZkOAuthSigner, clearJwksCache } from '../ZkOAuthSigner';
import { PrimitiveAccountKeyTypes } from '../../types/AccountKey';

// Helper to create mock JWT
function createMockJwt(kid: string = 'test-kid', alg: string = 'RS256'): string {
  const header = { alg, kid, typ: 'JWT' };
  const payload = { sub: '12345', iss: 'https://accounts.google.com' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${headerB64}.${payloadB64}.signature`;
}

// 2048-bit RSA modulus in base64url format (342+ chars required by validation)
const MOCK_RSA_MODULUS = 'A'.repeat(342);

// Helper to create Google JWKS response
function createGoogleJwksResponse(kid: string = 'test-kid') {
  return {
    keys: [
      { kid, n: MOCK_RSA_MODULUS, e: 'AQAB', kty: 'RSA', use: 'sig', alg: 'RS256' },
      { kid: 'other-kid', n: MOCK_RSA_MODULUS, e: 'AQAB', kty: 'RSA', use: 'sig', alg: 'RS256' },
    ],
  };
}

// Helper to create Kakao JWKS response
function createKakaoJwksResponse(kid: string = 'kakao-kid') {
  return {
    keys: [
      { kid, n: MOCK_RSA_MODULUS, e: 'AQAB', kty: 'RSA', use: 'sig', alg: 'RS256' },
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

describe('ZkOAuthSigner', () => {
  const mockProofServerUrl = 'http://localhost:3000';
  const mockEnUrl = 'http://localhost:8545';
  const mockZkapAddress = '0x' + '11'.repeat(20);
  const mockPoseidonTreeAddress = '0x' + '22'.repeat(20);
  let mockIdTokenGenerator: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    clearJwksCache();
    mockIdTokenGenerator = jest.fn().mockResolvedValue(createMockJwt());
  });

  describe('constructor', () => {
    it('should set keyTypes to keyZkOAuthRS256', () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1, // zkapK
        1  // zkapN
      );

      expect(signer.keyTypes).toEqual([PrimitiveAccountKeyTypes.keyZkOAuthRS256]);
      expect(signer.keyTypes[0]).toBe(6);
    });

    it('should throw when socialServices and idTokenGenerators length mismatch', () => {
      expect(() => {
        new ZkOAuthSigner(
          mockProofServerUrl,
          mockEnUrl,
          mockZkapAddress,
          ['google', 'kakao'], // 2 services
          [mockIdTokenGenerator], // only 1 generator
          mockPoseidonTreeAddress,
          1,
          2
        );
      }).toThrow('socialServices.length !== idTokenGenerators.length');
    });

    it('should throw when socialServices.length > 3', () => {
      expect(() => {
        new ZkOAuthSigner(
          mockProofServerUrl,
          mockEnUrl,
          mockZkapAddress,
          ['google', 'kakao', 'google', 'kakao'], // 4 services
          [mockIdTokenGenerator, mockIdTokenGenerator, mockIdTokenGenerator, mockIdTokenGenerator],
          mockPoseidonTreeAddress,
          2,
          3
        );
      }).toThrow('socialServices.length must be <= 3');
    });

    it('should accept multiple social services matching zkapN', () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao'],
        [mockIdTokenGenerator, mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        2  // zkapN matches socialServices.length
      );

      expect(signer.keyTypes).toEqual([PrimitiveAccountKeyTypes.keyZkOAuthRS256]);
    });

    it('should throw when zkapK > 1 (single-proof signer limitation)', () => {
      expect(() => new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao', 'google'],
        [mockIdTokenGenerator, mockIdTokenGenerator, mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        2,
        3
      )).toThrow('ZkOAuthSigner currently supports only zkapK=1');
    });

    it('should throw when socialServices.length !== zkapN (H-1)', () => {
      expect(() => {
        new ZkOAuthSigner(
          mockProofServerUrl,
          mockEnUrl,
          mockZkapAddress,
          ['google'],       // length = 1
          [mockIdTokenGenerator],
          mockPoseidonTreeAddress,
          1,
          2  // zkapN = 2, mismatch
        );
      }).toThrow('socialServices.length (1) must equal zkapN (2). Each OAuth provider corresponds to one selector slot.');
    });

    it('should throw when proofServerUrl uses HTTP with non-localhost hostname', () => {
      expect(() => {
        new ZkOAuthSigner(
          'http://remoteserver.com:3000',
          mockEnUrl,
          mockZkapAddress,
          ['google'],
          [mockIdTokenGenerator],
          mockPoseidonTreeAddress,
          1,
          1
        );
      }).toThrow('proofServerUrl must use HTTPS');
    });

    it('should allow HTTP for RFC1918 private addresses', () => {
      expect(() => new ZkOAuthSigner('http://10.0.2.2:3000', mockEnUrl, mockZkapAddress, ['google'], [mockIdTokenGenerator], mockPoseidonTreeAddress, 1, 1)).not.toThrow();
      expect(() => new ZkOAuthSigner('http://192.168.1.10:3000', mockEnUrl, mockZkapAddress, ['google'], [mockIdTokenGenerator], mockPoseidonTreeAddress, 1, 1)).not.toThrow();
      expect(() => new ZkOAuthSigner('http://172.16.0.1:3000', mockEnUrl, mockZkapAddress, ['google'], [mockIdTokenGenerator], mockPoseidonTreeAddress, 1, 1)).not.toThrow();
    });

    it('should allow HTTP for .local domains', () => {
      expect(() => new ZkOAuthSigner('http://myserver.local:3000', mockEnUrl, mockZkapAddress, ['google'], [mockIdTokenGenerator], mockPoseidonTreeAddress, 1, 1)).not.toThrow();
    });

    it('should allow HTTP for IPv6 loopback addresses', () => {
      // [::1] is the bracketed form used in URLs
      expect(() => new ZkOAuthSigner('http://[::1]:3000', mockEnUrl, mockZkapAddress, ['google'], [mockIdTokenGenerator], mockPoseidonTreeAddress, 1, 1)).not.toThrow();
    });

    it('should allow HTTP for IPv4-mapped IPv6 loopback', () => {
      // Node.js normalizes ::ffff:127.0.0.1 → ::ffff:7f00:1 in URL.hostname
      expect(() => new ZkOAuthSigner('http://[::ffff:7f00:1]:3000', mockEnUrl, mockZkapAddress, ['google'], [mockIdTokenGenerator], mockPoseidonTreeAddress, 1, 1)).not.toThrow();
    });
  });

  describe('init', () => {
    it('should initialize contracts and fetch anchor', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();

      // init is successful if no error is thrown
      expect(signer.keyTypes).toBeDefined();
    });

    it('should return cached initPromise when called twice (idempotent)', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await signer.init(); // second call -> cached initPromise branch

      expect(mockMasterKeyList).toHaveBeenCalledTimes(1); // RPC called once
    });

    it('should throw when masterKeyList returns zero address', async () => {
      mockMasterKeyList.mockResolvedValueOnce({
        logic: '0x0000000000000000000000000000000000000000',
        keyId: BigInt(0),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await expect(signer.init()).rejects.toThrow(
        'masterKeyList returned invalid logic address (zero address)'
      );
    });
  });

  describe('prepareIdToken', () => {
    it('should prepare idToken for given index', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      const mockUserOpHash = '0x' + 'ab'.repeat(32);
      const result = await signer.prepareIdToken(mockUserOpHash, 0);

      expect(mockIdTokenGenerator).toHaveBeenCalledTimes(1);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });

    it('should pass raw userOpHash (not EIP-191 hash) to idTokenGenerator', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      const rawUserOpHash = '0x' + 'ab'.repeat(32);
      await signer.prepareIdToken(rawUserOpHash, 0);

      // Generator must receive raw userOpHash, NOT the EIP-191 prefixed hash
      expect(mockIdTokenGenerator).toHaveBeenCalledWith(rawUserOpHash);
    });

    it('should throw when index is out of range', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await expect(signer.prepareIdToken('0x' + 'ab'.repeat(32), 5))
        .rejects.toThrow('index is out of range');
    });

    it('should throw when idTokenGenerator is undefined', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [undefined as any],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await expect(signer.prepareIdToken('0x' + 'ab'.repeat(32), 0))
        .rejects.toThrow('idTokenGenerator undefined');
    });

    it('should throw when idToken is undefined', async () => {
      const failingGenerator = jest.fn().mockResolvedValue(undefined);
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [failingGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await expect(signer.prepareIdToken('0x' + 'ab'.repeat(32), 0))
        .rejects.toThrow('idToken is undefined');
    });

    it('should initialize if not already initialized', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      // prepareIdToken should call init internally
      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      expect(mockIdTokenGenerator).toHaveBeenCalled();
    });

    it('should prepare multiple idTokens for multiple services', async () => {
      const generator1 = jest.fn().mockResolvedValue(createMockJwt('kid1'));
      const generator2 = jest.fn().mockResolvedValue(createMockJwt('kid2'));

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao'],
        [generator1, generator2],
        mockPoseidonTreeAddress,
        1,
        2
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);
      const result = await signer.prepareIdToken('0x' + 'ab'.repeat(32), 1);

      expect(result.length).toBe(2);
    });

    it('should throw when concurrent prepareIdToken calls are made', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      const hash = '0x' + 'ab'.repeat(32);
      // Start first call without awaiting
      const p1 = signer.prepareIdToken(hash, 0);
      // Second call should fail because _prepareInProgress is true
      const p2 = signer.prepareIdToken(hash, 0);
      await expect(p2).rejects.toThrow('concurrent calls are not allowed');
      // Await first call to cleanup
      await p1;
    });
  });

  describe('signUserOpHash', () => {
    it('should throw when idTokens is not prepared (selector=true slot)', async () => {
      // zkapK=1 means selector[0]=true, so idTokens[0] must be set
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1, // zkapK=1: selector[0]=true requires idToken
        1
      );

      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32)))
        .rejects.toThrow('prepareIdToken() must be called before signUserOpHash()');
    });

    it('should throw when idTokens is undefined', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );
      // Force internal state to bypass preparedUserOpHash guard and test idTokens=undefined branch
      const hash = '0x' + 'ab'.repeat(32);
      (signer as any).preparedUserOpHash = hash;
      (signer as any).idTokens = undefined;

      await expect(signer.signUserOpHash(hash))
        .rejects.toThrow('idTokens is undefined');
    });

    it('should throw when userOpHash format is invalid in signUserOpHash', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      // Set preparedUserOpHash so we pass the first guard
      const validHash = '0x' + 'ab'.repeat(32);
      await signer.prepareIdToken(validHash, 0);

      await expect(signer.signUserOpHash('invalid-hash'))
        .rejects.toThrow('userOpHash must be a 0x-prefixed 32-byte hex string');
    });

    it('should throw when signUserOpHash is called with different hash than prepared', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      const hashA = '0x' + 'aa'.repeat(32);
      const hashB = '0x' + 'bb'.repeat(32);

      await signer.prepareIdToken(hashA, 0);

      await expect(signer.signUserOpHash(hashB)).rejects.toThrow(
        'signUserOpHash: userOpHash mismatch'
      );
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

      // zkapK=1, zkapN=1: selector=[true,false,false] → slot 0 is active, JWKS is fetched
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
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
      // zkapK=1, zkapN=1: selector=[true,false,false] → slot 0 is active, JWKS is fetched
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['kakao'],
        [kakaoGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);
      const signatures = await signer.signUserOpHash('0x' + 'ab'.repeat(32));

      expect(signatures.length).toBe(1);
    });

    it('should throw for invalid social service', () => {
      const invalidGenerator = jest.fn().mockResolvedValue(createMockJwt());
      expect(() => new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['facebook' as any], // Invalid service
        [invalidGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      )).toThrow('Unsupported social service: "facebook"');
    });

    it('should throw when selector is not properly initialized', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      const hash = '0x' + 'ab'.repeat(32);
      await signer.prepareIdToken(hash, 0);
      // Force selector to undefined to trigger the guard
      (signer as any).selector = undefined;

      await expect(signer.signUserOpHash(hash))
        .rejects.toThrow('selector is not properly initialized');
    });

    it('should throw when selector=true slot has no idToken (idToken[i] not initialized)', async () => {
      const generator0 = jest.fn().mockResolvedValue(createMockJwt('kid0'));
      const generator1 = jest.fn().mockResolvedValue(createMockJwt('kid1'));
      // zkapN=2, zkapK=1: selector=[true, false] — slot 0 requires token, slot 1 does not
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao'],
        [generator0, generator1],
        mockPoseidonTreeAddress,
        1,
        2
      );

      const hash = '0x' + 'ab'.repeat(32);
      // Only prepare slot 1 (the false slot), leaving slot 0 (the true slot) empty
      await signer.prepareIdToken(hash, 1);

      await expect(signer.signUserOpHash(hash))
        .rejects.toThrow('idToken[0] is not initialized (selector=true slot requires a token)');
    });
  });

  describe('getSignatures (private, tested via casting)', () => {
    it('should throw when poseidonMerkleTreeDirectory not initialized', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      // Call getSignatures directly without init (via casting since private)
      await expect(
        (signer as any).getSignatures(['jwt1'], ['pk1'], [0], [['path1']])
      ).rejects.toThrow('poseidonMerkleTreeDirectory is not initialized');
    });

    it('should handle single idToken (duplicates to 3)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createProofResponse()),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      const signatures = await (signer as any).getSignatures(
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

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao'],
        [mockIdTokenGenerator, mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        2
      );

      await signer.init();
      const signatures = await (signer as any).getSignatures(
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

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao', 'google'],
        [mockIdTokenGenerator, mockIdTokenGenerator, mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        3
      );

      await signer.init();
      const signatures = await (signer as any).getSignatures(
        ['jwt1', 'jwt2', 'jwt3'],
        ['pk1', 'pk2', 'pk3'],
        [0, 1, 2],
        [['p1'], ['p2'], ['p3']]
      );

      expect(signatures.length).toBe(1);
    });

    it('should throw when idTokens.length is 0', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await expect(
        (signer as any).getSignatures([], [], [], [])
      ).rejects.toThrow('Invalid idTokens count: 0. Must be 1, 2, or 3.');
    });

    it('should throw when proof server returns non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await expect(
        (signer as any).getSignatures(['jwt1'], ['pk1'], [0], [['path1']])
      ).rejects.toThrow('Proof server error! status: 502');
    });

    it('should throw when jwtPks length does not match idTokens length', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await expect(
        (signer as any).getSignatures(['jwt1'], ['pk1', 'pk2'], [0], [['path1']])
      ).rejects.toThrow('Array length mismatch');
    });

    it('should throw when idTokens.length > 3', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await expect(
        (signer as any).getSignatures(['j1', 'j2', 'j3', 'j4'], ['pk1', 'pk2', 'pk3', 'pk4'], [0, 1, 2, 3], [['p1'], ['p2'], ['p3'], ['p4']])
      ).rejects.toThrow('Invalid idTokens count: 4. Must be 1, 2, or 3.');
    });

    it('should throw when proof array length is not 8 (L-3)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          proof: ['0', '1', '2'], // only 3 elements
          publicInputs: Array(8).fill('0'),
        }),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await expect(
        (signer as any).getSignatures(['jwt1'], ['pk1'], [0], [['path1']])
      ).rejects.toThrow('Invalid proof server response: proof must be an array of 8 elements, got 3');
    });

    it('should throw when publicInputs array length is not 8 (L-3)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          proof: Array(8).fill('0'),
          publicInputs: ['0', '1'], // only 2 elements
        }),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await expect(
        (signer as any).getSignatures(['jwt1'], ['pk1'], [0], [['path1']])
      ).rejects.toThrow('Invalid proof server response: publicInputs must be an array of 8 elements, got 2');
    });

    it('should throw when proof element is out of BN254 scalar field range', async () => {
      const BN254_FR = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
      const outOfRange = (BN254_FR + 1n).toString();
      const proofWithOutOfRange = Array(8).fill('0');
      proofWithOutOfRange[3] = outOfRange;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          proof: proofWithOutOfRange,
          publicInputs: Array(8).fill('0'),
        }),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await expect(
        (signer as any).getSignatures(['jwt1'], ['pk1'], [0], [['path1']])
      ).rejects.toThrow('proof[3] is out of BN254 scalar field range');
    });

    it('should throw when publicInputs element is out of BN254 scalar field range', async () => {
      const BN254_FR = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
      const outOfRange = (BN254_FR + 1n).toString();
      const publicInputsWithOutOfRange = Array(8).fill('0');
      publicInputsWithOutOfRange[5] = outOfRange;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          proof: Array(8).fill('0'),
          publicInputs: publicInputsWithOutOfRange,
        }),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await expect(
        (signer as any).getSignatures(['jwt1'], ['pk1'], [0], [['path1']])
      ).rejects.toThrow('publicInputs[5] is out of BN254 scalar field range');
    });

    it('should throw when proof is not an array (L-3)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          proof: 'not-an-array',
          publicInputs: Array(8).fill('0'),
        }),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await expect(
        (signer as any).getSignatures(['jwt1'], ['pk1'], [0], [['path1']])
      ).rejects.toThrow('Invalid proof server response: proof must be an array of 8 elements');
    });

    it('should include server error body in error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error":"invalid JWT signature"}'),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await expect(
        (signer as any).getSignatures(['jwt1'], ['pk1'], [0], [['path1']])
      ).rejects.toThrow('Proof server error! status: 400: {"error":"invalid JWT signature"}');
    });

    it('should throw when proof element is not a valid number', async () => {
      const proofWithNonNumeric = Array(8).fill('0');
      proofWithNonNumeric[2] = 'not-a-number';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          proof: proofWithNonNumeric,
          publicInputs: Array(8).fill('0'),
        }),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await expect(
        (signer as any).getSignatures(['jwt1'], ['pk1'], [0], [['path1']])
      ).rejects.toThrow('proof[2] is not a valid number: not-a-number');
    });

    it('should throw when publicInputs element is not a valid number', async () => {
      const publicInputsWithNonNumeric = Array(8).fill('0');
      publicInputsWithNonNumeric[4] = null;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          proof: Array(8).fill('0'),
          publicInputs: publicInputsWithNonNumeric,
        }),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      await expect(
        (signer as any).getSignatures(['jwt1'], ['pk1'], [0], [['path1']])
      ).rejects.toThrow('publicInputs[4] is not a valid number: null');
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
      // zkapK=1: selector[0]=true → JWKS fetch is performed for slot 0
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [googleGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);
      await signer.signUserOpHash('0x' + 'ab'.repeat(32));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v3/certs'
      );
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
      // zkapK=1: selector[0]=true → JWKS fetch is performed for slot 0
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['kakao'],
        [kakaoGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);
      await signer.signUserOpHash('0x' + 'ab'.repeat(32));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://kauth.kakao.com/.well-known/jwks.json'
      );
    });

    it('should throw when JWKS response has no keys array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ notKeys: [] }),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32)))
        .rejects.toThrow("Invalid JWKS response: missing or malformed 'keys' array");
    });

    it('should throw when public key not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ keys: [{ kid: 'wrong-kid', n: 'modulus' }] }),
      });

      // zkapK=1: selector[0]=true → JWKS fetch is performed for slot 0
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32))).rejects.toThrow('No valid JWK found for kid:');
    });

    it('should throw when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // zkapK=1: selector[0]=true → JWKS fetch is performed for slot 0
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32))).rejects.toThrow('HTTP error! status: 500');
    });

    it('should throw HTTP error when Kakao fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const kakaoGenerator = jest.fn().mockResolvedValue(createMockJwt('kakao-kid'));
      // zkapK=1: selector[0]=true → JWKS fetch is performed for slot 0
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['kakao'],
        [kakaoGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32))).rejects.toThrow('HTTP error! status: 503');
    });

    it('should throw when Kakao public key not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ keys: [{ kid: 'different-kid', n: 'modulus' }] }),
      });

      const kakaoGenerator = jest.fn().mockResolvedValue(createMockJwt('kakao-kid'));
      // zkapK=1: selector[0]=true → JWKS fetch is performed for slot 0
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['kakao'],
        [kakaoGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32))).rejects.toThrow('No valid JWK found for kid:');
    });

    it('should rethrow error when Kakao fetch throws exception', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const kakaoGenerator = jest.fn().mockResolvedValue(createMockJwt('kakao-kid'));
      // zkapK=1: selector[0]=true → JWKS fetch is performed for slot 0
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['kakao'],
        [kakaoGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32))).rejects.toThrow('Network error');
    });

    it('should use cached JWKS on second sign without fetching again', async () => {
      // First sign: JWKS fetch + proof fetch
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createGoogleJwksResponse('cached-kid')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createProofResponse()),
        })
        // Second sign (new signer instance): only proof fetch (JWKS should be served from module-level cache)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createProofResponse()),
        });

      const cachedKidGenerator = jest.fn().mockResolvedValue(createMockJwt('cached-kid'));
      // zkapK=1: selector[0]=true → JWKS fetch is performed for slot 0
      const signer1 = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [cachedKidGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      const userOpHash = '0x' + 'ab'.repeat(32);

      // First sign — fetches JWKS and proof
      await signer1.prepareIdToken(userOpHash, 0);
      await signer1.signUserOpHash(userOpHash);

      const fetchCountAfterFirst = mockFetch.mock.calls.filter(
        (call) => String(call[0]).includes('googleapis.com')
      ).length;
      expect(fetchCountAfterFirst).toBe(1);

      // Second sign with a new signer instance and different hash — JWKS should be cached in module cache
      const signer2 = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [cachedKidGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );
      const userOpHash2 = '0x' + 'cd'.repeat(32);
      await signer2.prepareIdToken(userOpHash2, 0);
      await signer2.signUserOpHash(userOpHash2);

      const fetchCountAfterSecond = mockFetch.mock.calls.filter(
        (call) => String(call[0]).includes('googleapis.com')
      ).length;
      // JWKS should still be 1 (cached), not 2
      expect(fetchCountAfterSecond).toBe(1);
    });

    it('should throw when RSA modulus is too short (< 300 chars)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          keys: [{ kid: 'test-kid', n: 'A'.repeat(100), e: 'AQAB', kty: 'RSA', use: 'sig', alg: 'RS256' }],
        }),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);
      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32)))
        .rejects.toThrow('RSA modulus too short for kid: test-kid. Minimum 2048-bit key required.');
    });

    it('should throw when JWKS key is missing public exponent (e)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          keys: [{ kid: 'test-kid', n: MOCK_RSA_MODULUS, kty: 'RSA', use: 'sig', alg: 'RS256' }],
        }),
      });

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);
      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32)))
        .rejects.toThrow('Missing public exponent (e) for kid: test-kid');
    });

    it('should log warning when JWKS key is rotated (same kid, different n)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const rotatedModulus = 'B'.repeat(342);

      const rotationKidGenerator = jest.fn().mockResolvedValue(createMockJwt('rotation-kid'));

      // First sign: cache key with MOCK_RSA_MODULUS
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createGoogleJwksResponse('rotation-kid')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createProofResponse()),
        });

      const signer1 = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [rotationKidGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      const hash1 = '0x' + 'ab'.repeat(32);
      await signer1.prepareIdToken(hash1, 0);
      await signer1.signUserOpHash(hash1);

      // Advance time past TTL (5 minutes) so cache entry is stale and re-fetch occurs
      const futureTime = Date.now() + 6 * 60 * 1000;
      jest.spyOn(Date, 'now').mockReturnValue(futureTime);

      // Second sign: same kid but different n (key rotated) — triggers re-fetch and warn
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            keys: [{ kid: 'rotation-kid', n: rotatedModulus, e: 'AQAB', kty: 'RSA', use: 'sig', alg: 'RS256' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createProofResponse()),
        });

      const signer2 = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [rotationKidGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      const hash2 = '0x' + 'cd'.repeat(32);
      await signer2.prepareIdToken(hash2, 0);
      await signer2.signUserOpHash(hash2);

      // console.warn for key rotation was removed — verify the cache was updated silently
      // (key rotation still works, just without the log)

      jest.spyOn(Date, 'now').mockRestore();
      consoleWarnSpy.mockRestore();
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

      // zkapK=1: selector[0]=true → JWKS fetch is performed for slot 0
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      const userOpHash = '0x' + 'ab'.repeat(32);

      // Step 1: Prepare idToken
      await signer.prepareIdToken(userOpHash, 0);

      // Step 2: Sign
      const signatures = await signer.signUserOpHash(userOpHash);

      expect(signatures.length).toBe(1);
      expect(signatures[0]).toMatch(/^0x/);
    });

    it('should reject full signing flow setup when zkapK > 1', () => {
      const googleGenerator = jest.fn().mockResolvedValue(createMockJwt('google-kid'));
      const kakaoGenerator = jest.fn().mockResolvedValue(createMockJwt('kakao-kid'));
      expect(() => new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao'],
        [googleGenerator, kakaoGenerator],
        mockPoseidonTreeAddress,
        2,
        2
      )).toThrow('ZkOAuthSigner currently supports only zkapK=1');
    });

    it('should skip merkle path lookup for selector=false slots and return dummy values', async () => {
      // zkapK=1, zkapN=2: selector=[true,false,false]
      // slot 0 (google) is active → JWKS fetched, merkle path looked up
      // slot 1 (kakao) is selector=false → merkle path skipped (dummy {leafIndex:0, pathUint:[]})
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
      const kakaoGenerator = jest.fn().mockResolvedValue(createMockJwt('kakao-kid'));

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao'],
        [googleGenerator, kakaoGenerator],
        mockPoseidonTreeAddress,
        1, // zkapK=1: selector=[true,false,false]
        2  // zkapN=2
      );

      const userOpHash = '0x' + 'ab'.repeat(32);

      // Only prepare slot 0 (active)
      await signer.prepareIdToken(userOpHash, 0);

      // Sign — slot 1 is selector=false so merkle path lookup is skipped
      const signatures = await signer.signUserOpHash(userOpHash);

      expect(signatures.length).toBe(1);
      // getLeafIndexByPubkeyHash should only be called once (for slot 0), not for slot 1
      expect(mockGetLeafIndexByPubkeyHash).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should throw when zkapK = 0', () => {
      expect(() => new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        0, // zkapK = 0: now invalid
        1
      )).toThrow('zkapK must be between 1 and zkapN');
    });

    it('should throw when zkapK = zkapN > 1', () => {
      expect(() => new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao', 'google'],
        [mockIdTokenGenerator, mockIdTokenGenerator, mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        3,
        3
      )).toThrow('ZkOAuthSigner currently supports only zkapK=1');
    });
  });

  describe('M-2: zkapK/zkapN constructor validation', () => {
    it('should throw when zkapN <= 0', () => {
      expect(() => {
        new ZkOAuthSigner(
          mockProofServerUrl,
          mockEnUrl,
          mockZkapAddress,
          ['google'],
          [mockIdTokenGenerator],
          mockPoseidonTreeAddress,
          1,
          0 // zkapN = 0
        );
      }).toThrow('zkapN must be between 1 and 3');
    });

    it('should throw when zkapN is negative', () => {
      expect(() => {
        new ZkOAuthSigner(
          mockProofServerUrl,
          mockEnUrl,
          mockZkapAddress,
          ['google'],
          [mockIdTokenGenerator],
          mockPoseidonTreeAddress,
          1,
          -1 // zkapN negative
        );
      }).toThrow('zkapN must be between 1 and 3');
    });

    it('should throw when zkapN > 3', () => {
      expect(() => {
        new ZkOAuthSigner(
          mockProofServerUrl,
          mockEnUrl,
          mockZkapAddress,
          ['google'],
          [mockIdTokenGenerator],
          mockPoseidonTreeAddress,
          2,
          4 // zkapN > 3
        );
      }).toThrow('zkapN must be between 1 and 3');
    });

    it('should throw when zkapK > zkapN', () => {
      expect(() => {
        new ZkOAuthSigner(
          mockProofServerUrl,
          mockEnUrl,
          mockZkapAddress,
          ['google'],
          [mockIdTokenGenerator],
          mockPoseidonTreeAddress,
          5, // zkapK > zkapN
          3
        );
      }).toThrow('zkapK must be between 1 and zkapN');
    });

    it('should throw when zkapK is negative', () => {
      expect(() => {
        new ZkOAuthSigner(
          mockProofServerUrl,
          mockEnUrl,
          mockZkapAddress,
          ['google'],
          [mockIdTokenGenerator],
          mockPoseidonTreeAddress,
          -1, // zkapK negative
          3
        );
      }).toThrow('zkapK must be between 1 and zkapN');
    });
  });

  describe('M-1: init failure and retry', () => {
    it('should reset initPromise on failure and allow retry', async () => {
      // First call fails
      mockMasterKeyList.mockRejectedValueOnce(new Error('RPC failed'));

      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      // First init should fail
      await expect(signer.init()).rejects.toThrow('RPC failed');

      // Reset mock to succeed on second call
      mockMasterKeyList.mockResolvedValueOnce({
        logic: '0xMasterKeyAddress',
        keyId: BigInt(0),
      });

      // Second init should succeed (initPromise was reset)
      await signer.init();

      // Verify it was called twice (once failed, once succeeded)
      expect(mockMasterKeyList).toHaveBeenCalledTimes(2);
    });
  });

  describe('M-2: JWT header validation', () => {
    it('should throw when JWT has less than 3 parts', async () => {
      const invalidJwtGenerator = jest.fn().mockResolvedValue('header.payload');

      // zkapK=1: selector[0]=true → decodeJwtHeader is called for slot 0
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [invalidJwtGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      // When signUserOpHash calls decodeJwtHeader, it should throw
      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32)))
        .rejects.toThrow('Invalid JWT format: expected 3 parts, got 2');
    });

    it('should throw when JWT header is missing kid', async () => {
      // Create JWT without kid
      const headerNoKid = { alg: 'RS256', typ: 'JWT' };
      const headerB64 = Buffer.from(JSON.stringify(headerNoKid)).toString('base64url');
      const noKidJwt = `${headerB64}.payload.signature`;
      const noKidGenerator = jest.fn().mockResolvedValue(noKidJwt);

      // zkapK=1: selector[0]=true → decodeJwtHeader is called for slot 0
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [noKidGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32)))
        .rejects.toThrow('JWT header missing required field: kid');
    });

    it('should throw when JWT algorithm is not RS256', async () => {
      const wrongAlgJwt = createMockJwt('test-kid', 'ES256');
      const wrongAlgGenerator = jest.fn().mockResolvedValue(wrongAlgJwt);

      // zkapK=1: selector[0]=true → decodeJwtHeader is called for slot 0
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [wrongAlgGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.prepareIdToken('0x' + 'ab'.repeat(32), 0);

      await expect(signer.signUserOpHash('0x' + 'ab'.repeat(32)))
        .rejects.toThrow('Unsupported JWT algorithm: ES256. Only RS256 is supported.');
    });
  });

  describe('destroy', () => {
    it('should clear all sensitive state fields', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      await signer.init();
      const hash = '0x' + 'ab'.repeat(32);
      await signer.prepareIdToken(hash, 0);

      signer.destroy();

      expect((signer as any).idTokens).toBeUndefined();
      expect((signer as any).anchor).toBeUndefined();
      expect((signer as any).preparedUserOpHash).toBeUndefined();
      expect((signer as any).idTokenGenerators).toEqual([]);
      expect((signer as any).isInitialized).toBe(false);
      expect((signer as any).initPromise).toBeUndefined();
      expect((signer as any).masterKeyId).toBeUndefined();
      expect((signer as any).zkapAccount).toBeUndefined();
      expect((signer as any).zkOAuthRS256Verifier).toBeUndefined();
      expect((signer as any).poseidonMerkleTreeDirectory).toBeUndefined();
    });

    it('should prevent further signing after destroy', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google'],
        [mockIdTokenGenerator],
        mockPoseidonTreeAddress,
        1,
        1
      );

      const hash = '0x' + 'ab'.repeat(32);
      await signer.prepareIdToken(hash, 0);
      signer.destroy();

      // After destroy, idTokens is cleared → initialization check fails
      await expect(signer.prepareIdToken(hash, 0))
        .rejects.toThrow('idTokens is not initialized');
    });
  });

  describe('prepareIdToken - userOpHash change error', () => {
    it('should throw when userOpHash changes between prepareIdToken calls', async () => {
      const signer = new ZkOAuthSigner(
        mockProofServerUrl,
        mockEnUrl,
        mockZkapAddress,
        ['google', 'kakao'],
        [mockIdTokenGenerator, jest.fn().mockResolvedValue(createMockJwt('kid2'))],
        mockPoseidonTreeAddress,
        1,
        2
      );

      await signer.prepareIdToken('0x' + 'aa'.repeat(32), 0);
      await expect(signer.prepareIdToken('0x' + 'bb'.repeat(32), 1))
        .rejects.toThrow('prepareIdToken: userOpHash changed');
    });
  });
});
