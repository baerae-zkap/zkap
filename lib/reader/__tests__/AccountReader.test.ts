/**
 * AccountReader 테스트
 */

// ---------------------------------------------------------------------------
// Mock ethers before importing AccountReader
// ---------------------------------------------------------------------------

const mockGetCode = jest.fn();
const mockGetBalance = jest.fn();
const mockTxKeyList = jest.fn();
const mockTxKeyThreshold = jest.fn();
const mockMasterKeyThreshold = jest.fn();
const mockMasterKeyList = jest.fn();
const mockKeyType = jest.fn();
const mockGetKeyData = jest.fn();
const mockGetData = jest.fn();
const mockGetAnchor = jest.fn();

// We need different Contract instances per ABI. We track by constructing in order.
let contractCallCount = 0;
const contractMocks: Record<string, jest.Mock>[] = [];

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ethers: {
      ...actual.ethers,
      JsonRpcProvider: jest.fn().mockImplementation(() => ({
        getCode: mockGetCode,
        getBalance: mockGetBalance,
      })),
      Contract: jest.fn().mockImplementation((_address: string, abi: string[]) => {
        // Identify contract type by ABI shape
        const abiStr = abi.join('|');
        if (abiStr.includes('masterKeyThreshold')) {
          // ZKAP_ACCOUNT_ABI
          return {
            txKeyList: mockTxKeyList,
            txKeyThreshold: mockTxKeyThreshold,
            masterKeyThreshold: mockMasterKeyThreshold,
            masterKeyList: mockMasterKeyList,
          };
        }
        if (abiStr.includes('keyType')) {
          // KEY_TYPE_DETECTOR_ABI
          return { keyType: mockKeyType };
        }
        if (abiStr.includes('getKeyData')) {
          // WEBAUTHN_KEY_ABI
          return { getKeyData: mockGetKeyData };
        }
        if (abiStr.includes('getAnchor')) {
          // ZK_OAUTH_VERIFIER_ABI
          return { getData: mockGetData, getAnchor: mockGetAnchor };
        }
        return {};
      }),
      ZeroAddress: '0x0000000000000000000000000000000000000000',
    },
  };
});

import { AccountReader } from '../AccountReader';

const MOCK_ADDRESS = '0x' + '11'.repeat(20);
const MOCK_LOGIC = '0x' + 'AA'.repeat(20);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccountReader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contractCallCount = 0;
  });

  describe('isDeployed', () => {
    it('returns true when getCode returns non-empty bytecode', async () => {
      mockGetCode.mockResolvedValueOnce('0x6080604052');
      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      expect(await reader.isDeployed(MOCK_ADDRESS)).toBe(true);
    });

    it('returns false when getCode returns 0x (EOA / not deployed)', async () => {
      mockGetCode.mockResolvedValueOnce('0x');
      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      expect(await reader.isDeployed(MOCK_ADDRESS)).toBe(false);
    });
  });

  describe('getBalance', () => {
    it('returns balance as string', async () => {
      mockGetBalance.mockResolvedValueOnce(BigInt('1000000000000000000'));
      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const balance = await reader.getBalance(MOCK_ADDRESS);
      expect(balance).toBe('1000000000000000000');
    });

    it('returns 0 as string when balance is zero', async () => {
      mockGetBalance.mockResolvedValueOnce(BigInt(0));
      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      expect(await reader.getBalance(MOCK_ADDRESS)).toBe('0');
    });
  });

  describe('getTxKeyList', () => {
    it('returns array of TxKeyInfo for each key entry', async () => {
      // index 0: webauthn key, index 1: throws (end of list)
      mockTxKeyList
        .mockResolvedValueOnce([MOCK_LOGIC, BigInt(1)])
        .mockRejectedValueOnce(new Error('out of bounds'));
      mockKeyType.mockResolvedValueOnce(BigInt(4)); // keyWebAuthn
      // webauthn getKeyData
      mockGetKeyData.mockResolvedValueOnce([
        '0x' + 'aa'.repeat(32), // x
        '0x' + 'bb'.repeat(32), // y
        'mock-cred-id',
        '0x' + 'cc'.repeat(32),
        '0x' + 'dd'.repeat(32),
      ]);

      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const keys = await reader.getTxKeyList(MOCK_ADDRESS);

      expect(keys).toHaveLength(1);
      expect(keys[0].index).toBe(0);
      expect(keys[0].logicContract).toBe(MOCK_LOGIC);
      expect(keys[0].keyId).toBe(1);
      expect(keys[0].keyType).toBe('webauthn');
      expect(keys[0].webauthn).toBeDefined();
      expect(keys[0].webauthn!.credentialId).toBe('mock-cred-id');
    });

    it('returns empty array when txKeyList throws immediately', async () => {
      mockTxKeyList.mockRejectedValueOnce(new Error('revert'));
      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const keys = await reader.getTxKeyList(MOCK_ADDRESS);
      expect(keys).toHaveLength(0);
    });

    it('stops iteration when logic is ZeroAddress', async () => {
      mockTxKeyList.mockResolvedValueOnce([ZERO_ADDRESS, BigInt(0)]);
      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const keys = await reader.getTxKeyList(MOCK_ADDRESS);
      expect(keys).toHaveLength(0);
    });

    it('handles multiple keys until ZeroAddress sentinel', async () => {
      const LOGIC_1 = '0x' + 'A1'.repeat(20);
      const LOGIC_2 = '0x' + 'A2'.repeat(20);

      mockTxKeyList
        .mockResolvedValueOnce([LOGIC_1, BigInt(1)])
        .mockResolvedValueOnce([LOGIC_2, BigInt(2)])
        .mockRejectedValueOnce(new Error('end'));

      // Both keys: unknown type (keyType call fails)
      mockKeyType
        .mockRejectedValueOnce(new Error('no keyType'))
        .mockRejectedValueOnce(new Error('no keyType'));

      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const keys = await reader.getTxKeyList(MOCK_ADDRESS);

      expect(keys).toHaveLength(2);
      expect(keys[0].keyType).toBe('unknown');
      expect(keys[1].keyType).toBe('unknown');
    });

    it('leaves webauthn field undefined if getKeyData fails', async () => {
      mockTxKeyList
        .mockResolvedValueOnce([MOCK_LOGIC, BigInt(1)])
        .mockRejectedValueOnce(new Error('end'));
      mockKeyType.mockResolvedValueOnce(BigInt(4)); // webauthn
      mockGetKeyData.mockRejectedValueOnce(new Error('call failed'));

      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const keys = await reader.getTxKeyList(MOCK_ADDRESS);

      expect(keys).toHaveLength(1);
      expect(keys[0].keyType).toBe('webauthn');
      expect(keys[0].webauthn).toBeUndefined();
    });
  });

  describe('getMasterKeyInfo', () => {
    it('reads masterKeyThreshold (not txKeyThreshold)', async () => {
      mockMasterKeyList.mockResolvedValueOnce([MOCK_LOGIC, BigInt(0)]);
      mockMasterKeyThreshold.mockResolvedValueOnce(BigInt(1));
      mockGetData.mockRejectedValueOnce(new Error('no getData'));
      mockGetAnchor.mockRejectedValueOnce(new Error('no getAnchor'));

      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const info = await reader.getMasterKeyInfo(MOCK_ADDRESS);

      expect(info.threshold).toBe(1);
      expect(mockMasterKeyThreshold).toHaveBeenCalled();
      expect(mockTxKeyThreshold).not.toHaveBeenCalled();
    });

    it('is3of3 is true when threshold >= 3', async () => {
      mockMasterKeyList.mockResolvedValueOnce([MOCK_LOGIC, BigInt(0)]);
      mockMasterKeyThreshold.mockResolvedValueOnce(BigInt(3));
      mockGetData.mockResolvedValueOnce([
        BigInt(17), BigInt(6), BigInt(0),
        [BigInt(1), BigInt(2), BigInt(3)],
      ]);

      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const info = await reader.getMasterKeyInfo(MOCK_ADDRESS);

      expect(info.threshold).toBe(3);
      expect(info.is3of3).toBe(true);
    });

    it('is3of3 is false when threshold < 3', async () => {
      mockMasterKeyList.mockResolvedValueOnce([MOCK_LOGIC, BigInt(0)]);
      mockMasterKeyThreshold.mockResolvedValueOnce(BigInt(1));
      mockGetData.mockRejectedValueOnce(new Error('no getData'));
      mockGetAnchor.mockRejectedValueOnce(new Error('no getAnchor'));

      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const info = await reader.getMasterKeyInfo(MOCK_ADDRESS);

      expect(info.is3of3).toBe(false);
    });

    it('is3of3 is true when anchor list has >= 3 elements', async () => {
      mockMasterKeyList.mockResolvedValueOnce([MOCK_LOGIC, BigInt(0)]);
      mockMasterKeyThreshold.mockResolvedValueOnce(BigInt(1)); // low threshold
      mockGetData.mockResolvedValueOnce([
        BigInt(17), BigInt(6), BigInt(0),
        [BigInt(1), BigInt(2), BigInt(3)],
      ]);

      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const info = await reader.getMasterKeyInfo(MOCK_ADDRESS);

      expect(info.keyCount).toBe(3);
      expect(info.is3of3).toBe(true);
    });

    it('falls back to getAnchor when getData fails', async () => {
      mockMasterKeyList.mockResolvedValueOnce([MOCK_LOGIC, BigInt(0)]);
      mockMasterKeyThreshold.mockResolvedValueOnce(BigInt(1));
      mockGetData.mockRejectedValueOnce(new Error('no getData'));
      mockGetAnchor.mockResolvedValueOnce([BigInt(10), BigInt(20), BigInt(30)]);

      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const info = await reader.getMasterKeyInfo(MOCK_ADDRESS);

      expect(info.anchor).toEqual(['10', '20', '30']);
      expect(info.keyCount).toBe(3);
    });

    it('returns anchor list from getData', async () => {
      mockMasterKeyList.mockResolvedValueOnce([MOCK_LOGIC, BigInt(0)]);
      mockMasterKeyThreshold.mockResolvedValueOnce(BigInt(1));
      mockGetData.mockResolvedValueOnce([
        BigInt(17), BigInt(6), BigInt(0),
        [BigInt(111), BigInt(222)],
      ]);

      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const info = await reader.getMasterKeyInfo(MOCK_ADDRESS);

      expect(info.anchor).toEqual(['111', '222']);
    });

    it('throws when masterKeyList(0) fails', async () => {
      mockMasterKeyList.mockRejectedValueOnce(new Error('revert: key not found'));

      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      await expect(reader.getMasterKeyInfo(MOCK_ADDRESS))
        .rejects.toThrow('AccountReader: failed to read masterKeyList(0)');
    });

    it('defaults threshold to 1 when masterKeyThreshold call fails', async () => {
      mockMasterKeyList.mockResolvedValueOnce([MOCK_LOGIC, BigInt(0)]);
      mockMasterKeyThreshold.mockRejectedValueOnce(new Error('no threshold'));
      mockGetData.mockRejectedValueOnce(new Error('no getData'));
      mockGetAnchor.mockRejectedValueOnce(new Error('no getAnchor'));

      const reader = new AccountReader({ rpcUrl: 'https://rpc.example.com' });
      const info = await reader.getMasterKeyInfo(MOCK_ADDRESS);

      expect(info.threshold).toBe(1);
    });
  });
});
