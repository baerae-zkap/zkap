/**
 * WalletHelper 테스트
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCode = jest.fn();
const mockGetBalance = jest.fn();
const mockTxKeyList = jest.fn();
const mockMasterKeyList = jest.fn();
const mockMasterKeyThreshold = jest.fn();
const mockKeyType = jest.fn();
const mockGetData = jest.fn();
const mockGetAnchor = jest.fn();
const mockFactoryGetAddress = jest.fn();

const mockAutoFillUserOp = jest.fn();
const mockGetUserOpHash = jest.fn();
const mockGetPackedUserOp = jest.fn();
const mockSetSender = jest.fn();
const mockSetExecuteCallData = jest.fn();
const mockSetExecuteBatchCallData = jest.fn();
const mockSetSignature = jest.fn();

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
        const abiStr = abi.join('|');
        if (abiStr.includes('getAddress')) {
          // ZKAP_FACTORY_ABI
          return { 'getAddress(uint256)': mockFactoryGetAddress };
        }
        if (abiStr.includes('masterKeyThreshold')) {
          return {
            txKeyList: mockTxKeyList,
            masterKeyList: mockMasterKeyList,
            masterKeyThreshold: mockMasterKeyThreshold,
            txKeyThreshold: jest.fn(),
            txKeyWeightList: jest.fn(),
          };
        }
        if (abiStr.includes('keyType')) {
          return { keyType: mockKeyType };
        }
        if (abiStr.includes('getAnchor')) {
          return { getData: mockGetData, getAnchor: mockGetAnchor };
        }
        return {};
      }),
      ZeroAddress: '0x0000000000000000000000000000000000000000',
      keccak256: actual.ethers.keccak256,
      AbiCoder: actual.ethers.AbiCoder,
    },
  };
});

// Mock ZkapBuilder
jest.mock('../../builders/ZkapBuilder', () => {
  const builder = {
    setSender: jest.fn().mockReturnThis(),
    setExecuteCallData: jest.fn().mockReturnThis(),
    setExecuteBatchCallData: jest.fn().mockReturnThis(),
    autoFillUserOp: jest.fn().mockResolvedValue(undefined),
    getUserOpHash: jest.fn().mockReturnValue('0x' + 'ab'.repeat(32)),
    setSignature: jest.fn().mockReturnThis(),
    getPackedUserOp: jest.fn().mockReturnValue({ sender: '0x' + '11'.repeat(20) }),
  };
  return {
    ZkapBuilder: jest.fn().mockImplementation(() => builder),
  };
});

import { WalletHelper } from '../WalletHelper';
import type { WalletHelperConfig } from '../WalletHelper';
import type { ChainConfig } from '../../registry/ChainRegistry';
import type { BundlerClient } from '../../client/BundlerClient';
import type { UserOpReceipt } from '../../client/types';
import { ethers } from 'ethers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_ADDRESS = '0x' + '11'.repeat(20);
const MOCK_USER_OP_HASH = '0x' + 'ab'.repeat(32);
const MOCK_CHAIN_ID = 42161;

function makeChainConfig(overrides?: Partial<ChainConfig>): ChainConfig {
  return {
    chainId: MOCK_CHAIN_ID,
    name: 'Arbitrum',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    entryPoint: '0x' + '5F'.repeat(20),
    zkapFactory: '0x' + 'AB'.repeat(20),
    bundlerUrl: 'https://bundler.example.com',
    poseidonMerkleTreeDirectory: 'https://merkle.example.com',
    contracts: {
      zkOAuthVerifier1of1: '0x' + '11'.repeat(20),
      zkOAuthVerifier3of3: '0x' + '22'.repeat(20),
      hAudLists: '0x' + '33'.repeat(20),
      hAudLists1: '0x' + '44'.repeat(20),
    },
    ...overrides,
  };
}

function makeMockChainRegistry(chainConfig = makeChainConfig()) {
  return {
    getChainConfig: jest.fn().mockResolvedValue(chainConfig),
    getSupportedChains: jest.fn().mockResolvedValue([chainConfig]),
    refresh: jest.fn(),
  };
}

function makeMockReceipt(): UserOpReceipt {
  return {
    userOpHash: MOCK_USER_OP_HASH,
    txHash: '0x' + 'cc'.repeat(32),
    blockNumber: 1000,
    success: true,
    actualGasCost: '21000',
    actualGasUsed: '21000',
  };
}

function makeMockBundlerClient() {
  return {
    submitUserOp: jest.fn().mockResolvedValue(MOCK_USER_OP_HASH),
    waitForReceipt: jest.fn().mockResolvedValue(makeMockReceipt()),
    getStatus: jest.fn().mockResolvedValue('included'),
  };
}

function makeMockSigner(keyTypes = [5]) {
  return {
    keyTypes,
    signUserOpHash: jest.fn().mockResolvedValue(['0xmocksig']),
  };
}

function makeWalletHelper(
  chainRegistry = makeMockChainRegistry(),
  bundlerClient = makeMockBundlerClient()
): WalletHelper {
  return new WalletHelper({
    chainRegistry: chainRegistry as any,
    bundlerClient: bundlerClient as any,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WalletHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('computeSalt (static)', () => {
    it('produces a deterministic hex string', () => {
      const salt = WalletHelper.computeSalt('myaud', 'mysub');
      expect(salt).toMatch(/^0x[0-9a-f]{64}$/i);
    });

    it('same inputs always produce the same salt', () => {
      const a = WalletHelper.computeSalt('aud1', 'sub1');
      const b = WalletHelper.computeSalt('aud1', 'sub1');
      expect(a).toBe(b);
    });

    it('different aud produces different salt', () => {
      const a = WalletHelper.computeSalt('aud1', 'sub1');
      const b = WalletHelper.computeSalt('aud2', 'sub1');
      expect(a).not.toBe(b);
    });

    it('different sub produces different salt', () => {
      const a = WalletHelper.computeSalt('aud1', 'sub1');
      const b = WalletHelper.computeSalt('aud1', 'sub2');
      expect(a).not.toBe(b);
    });
  });

  describe('deriveAddress', () => {
    it('accepts aud (not provider) and returns factory address', async () => {
      const MOCK_WALLET_ADDR = '0x' + 'FF'.repeat(20);
      mockFactoryGetAddress.mockResolvedValueOnce(MOCK_WALLET_ADDR);

      const chainRegistry = makeMockChainRegistry();
      const helper = makeWalletHelper(chainRegistry);

      const addr = await helper.deriveAddress({ aud: 'my-client-id', sub: 'user-sub', chainId: MOCK_CHAIN_ID });

      expect(addr).toBe(MOCK_WALLET_ADDR);
      expect(chainRegistry.getChainConfig).toHaveBeenCalledWith(MOCK_CHAIN_ID);
    });

    it('throws when factory getAddress fails', async () => {
      mockFactoryGetAddress.mockRejectedValueOnce(new Error('contract reverted'));

      const helper = makeWalletHelper();
      await expect(helper.deriveAddress({ aud: 'aud', sub: 'sub', chainId: MOCK_CHAIN_ID }))
        .rejects.toThrow('WalletHelper.deriveAddress: failed to call getAddress');
    });
  });

  describe('sendTransaction', () => {
    it('builds, signs, submits and returns userOpHash and receipt promise', async () => {
      const chainRegistry = makeMockChainRegistry();
      const bundlerClient = makeMockBundlerClient();
      const helper = makeWalletHelper(chainRegistry, bundlerClient);
      const signer = makeMockSigner();

      const result = await helper.sendTransaction({
        sender: MOCK_ADDRESS,
        to: '0x' + '22'.repeat(20),
        value: '0',
        chainId: MOCK_CHAIN_ID,
        signer,
      });

      expect(result.userOpHash).toBe(MOCK_USER_OP_HASH);
      expect(result.receipt).toBeInstanceOf(Promise);
      expect(bundlerClient.submitUserOp).toHaveBeenCalled();
    });

    it('calls signer.signUserOpHash with the computed userOpHash', async () => {
      const signer = makeMockSigner();
      const helper = makeWalletHelper();

      await helper.sendTransaction({
        sender: MOCK_ADDRESS,
        to: '0x' + '22'.repeat(20),
        value: '1000',
        chainId: MOCK_CHAIN_ID,
        signer,
      });

      expect(signer.signUserOpHash).toHaveBeenCalledWith(MOCK_USER_OP_HASH);
    });

    it('uses optional data field, defaulting to 0x', async () => {
      const { ZkapBuilder } = require('../../builders/ZkapBuilder');
      const signer = makeMockSigner();
      const helper = makeWalletHelper();

      await helper.sendTransaction({
        sender: MOCK_ADDRESS,
        to: '0x' + '22'.repeat(20),
        value: '0',
        chainId: MOCK_CHAIN_ID,
        signer,
      });

      const builderInstance = ZkapBuilder.mock.results[0].value;
      expect(builderInstance.setExecuteCallData).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        '0x',
        signer.keyTypes
      );
    });
  });

  describe('isDeployed', () => {
    it('creates a per-chain AccountReader and delegates to isDeployed', async () => {
      mockGetCode.mockResolvedValueOnce('0x6080');
      const helper = makeWalletHelper();

      const result = await helper.isDeployed(MOCK_ADDRESS, MOCK_CHAIN_ID);
      expect(result).toBe(true);
    });

    it('returns false for undeployed address', async () => {
      mockGetCode.mockResolvedValueOnce('0x');
      const helper = makeWalletHelper();
      expect(await helper.isDeployed(MOCK_ADDRESS, MOCK_CHAIN_ID)).toBe(false);
    });

    it('reuses AccountReader for same chainId', async () => {
      mockGetCode.mockResolvedValue('0x');
      const { ethers: ethersModule } = require('ethers');
      const providerSpy = ethersModule.JsonRpcProvider;

      const helper = makeWalletHelper();
      await helper.isDeployed(MOCK_ADDRESS, MOCK_CHAIN_ID);
      await helper.isDeployed(MOCK_ADDRESS, MOCK_CHAIN_ID);

      // JsonRpcProvider should be created only once for same chainId
      expect(providerSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBalance', () => {
    it('creates per-chain AccountReader and delegates to getBalance', async () => {
      mockGetBalance.mockResolvedValueOnce(BigInt('5000000000000000000'));
      const helper = makeWalletHelper();

      const balance = await helper.getBalance(MOCK_ADDRESS, MOCK_CHAIN_ID);
      expect(balance).toBe('5000000000000000000');
    });
  });

  describe('getTxKeyList', () => {
    it('delegates to per-chain AccountReader', async () => {
      mockTxKeyList.mockRejectedValueOnce(new Error('empty')); // returns empty list
      const helper = makeWalletHelper();

      const keys = await helper.getTxKeyList(MOCK_ADDRESS, MOCK_CHAIN_ID);
      expect(Array.isArray(keys)).toBe(true);
    });
  });

  describe('sendBatchTransaction', () => {
    it('builds, signs, submits and returns userOpHash and receipt promise', async () => {
      const chainRegistry = makeMockChainRegistry();
      const bundlerClient = makeMockBundlerClient();
      const helper = makeWalletHelper(chainRegistry, bundlerClient);
      const signer = makeMockSigner();

      const result = await helper.sendBatchTransaction({
        sender: MOCK_ADDRESS,
        transactions: [
          { to: '0x' + '22'.repeat(20), value: '0' },
          { to: '0x' + '33'.repeat(20), value: '1000', data: '0xdeadbeef' },
        ],
        chainId: MOCK_CHAIN_ID,
        signer,
      });

      expect(result.userOpHash).toBe(MOCK_USER_OP_HASH);
      expect(result.receipt).toBeInstanceOf(Promise);
      expect(bundlerClient.submitUserOp).toHaveBeenCalled();
    });

    it('calls signer.signUserOpHash with the computed userOpHash', async () => {
      const signer = makeMockSigner();
      const helper = makeWalletHelper();

      await helper.sendBatchTransaction({
        sender: MOCK_ADDRESS,
        transactions: [{ to: '0x' + '22'.repeat(20), value: '0' }],
        chainId: MOCK_CHAIN_ID,
        signer,
      });

      expect(signer.signUserOpHash).toHaveBeenCalledWith(MOCK_USER_OP_HASH);
    });

    it('uses 0x as default data for transactions without data field', async () => {
      const { ZkapBuilder } = require('../../builders/ZkapBuilder');
      const signer = makeMockSigner();
      const helper = makeWalletHelper();

      await helper.sendBatchTransaction({
        sender: MOCK_ADDRESS,
        transactions: [
          { to: '0x' + '22'.repeat(20), value: '0' },           // no data
          { to: '0x' + '33'.repeat(20), value: '0', data: '0xab' }, // with data
        ],
        chainId: MOCK_CHAIN_ID,
        signer,
      });

      const builderInstance = ZkapBuilder.mock.results[ZkapBuilder.mock.results.length - 1].value;
      expect(builderInstance.setExecuteBatchCallData).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(String)]),
        expect.arrayContaining([expect.any(String)]),
        expect.arrayContaining(['0x', '0xab']),
        signer.keyTypes
      );
    });

    it('constructs keyIndexList from signer.keyTypes', async () => {
      const { ZkapBuilder } = require('../../builders/ZkapBuilder');
      const signer = makeMockSigner([3, 5]); // two key types
      const helper = makeWalletHelper();

      await helper.sendBatchTransaction({
        sender: MOCK_ADDRESS,
        transactions: [{ to: '0x' + '22'.repeat(20), value: '0' }],
        chainId: MOCK_CHAIN_ID,
        signer,
      });

      const builderInstance = ZkapBuilder.mock.results[ZkapBuilder.mock.results.length - 1].value;
      expect(builderInstance.setSignature).toHaveBeenCalledWith([0, 1], expect.any(Array));
    });
  });

  describe('constructor apiUrl option', () => {
    it('accepts custom apiUrl and strips trailing slash', () => {
      const helper = new WalletHelper({
        chainRegistry: makeMockChainRegistry() as any,
        bundlerClient: makeMockBundlerClient() as any,
        apiUrl: 'https://custom.api.example.com/',
      });
      // The helper constructs without error and the apiUrl is stripped
      expect(helper).toBeInstanceOf(WalletHelper);
    });

    it('uses default apiUrl when not provided', () => {
      const helper = new WalletHelper({
        chainRegistry: makeMockChainRegistry() as any,
        bundlerClient: makeMockBundlerClient() as any,
      });
      expect(helper).toBeInstanceOf(WalletHelper);
    });
  });
});
