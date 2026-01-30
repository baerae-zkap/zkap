/**
 * ZkapBuilder 테스트
 *
 * ZKAP 계정용 UserOperation 빌더
 */

// Mock fetch for PaymasterService
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock ethers
const mockGetCode = jest.fn();
const mockEstimateGas = jest.fn();
const mockGetFeeData = jest.fn();
const mockGetNonce = jest.fn();

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ethers: {
      ...actual.ethers,
      ZeroAddress: '0x0000000000000000000000000000000000000000',
      JsonRpcProvider: jest.fn().mockImplementation(() => ({
        getCode: mockGetCode,
        estimateGas: mockEstimateGas,
        getFeeData: mockGetFeeData,
      })),
      Contract: jest.fn().mockImplementation(() => ({
        getNonce: mockGetNonce,
      })),
      Interface: jest.fn().mockImplementation(() => ({
        getFunction: jest.fn().mockReturnValue(true),
        encodeFunctionData: jest.fn().mockReturnValue('0xEncodedCallData'),
        parseTransaction: jest.fn().mockReturnValue({
          name: 'execute',
          args: ['0x' + '11'.repeat(20), BigInt(0), '0x1234'],
        }),
      })),
      AbiCoder: {
        defaultAbiCoder: () => ({
          encode: jest.fn().mockReturnValue('0xEncoded'),
        }),
      },
      concat: jest.fn().mockImplementation((arr) => arr.join('')),
      toBeHex: jest.fn().mockImplementation((val) => {
        if (typeof val === 'string' && val.startsWith('0x')) return val;
        return `0x${BigInt(val).toString(16)}`;
      }),
      keccak256: jest.fn().mockReturnValue('0x' + 'ab'.repeat(32)),
      zeroPadValue: jest.fn().mockReturnValue('0x' + '00'.repeat(16)),
      hexlify: jest.fn().mockImplementation((val) => typeof val === 'string' ? val : `0x${val}`),
      parseEther: jest.fn().mockReturnValue(BigInt(0)),
      dataSlice: jest.fn().mockImplementation((data, start, end) => {
        if (end) return data.slice(start * 2 + 2, end * 2 + 2);
        return data.slice(start * 2 + 2);
      }),
    },
  };
});

// Mock ABIs
jest.mock('../../resources/abis', () => ({
  ZkapAccountABIstring: '[]',
  ZkapAccountFactoryABIstring: '[]',
}));

import { ZkapBuilder, ZkapAccountInfo } from '../ZkapBuilder';
import { PaymasterMode } from '../../utils/PaymasterService';
import { ethers } from 'ethers';

describe('ZkapBuilder', () => {
  const mockAccountInfo: ZkapAccountInfo = {
    chainId: 1,
    entryPoint: '0x' + '55'.repeat(20),
    enUrl: 'http://localhost:8545',
  };

  const mockPaymasterConfig = {
    serverUrl: 'http://localhost:3000',
    paymasterAddress: '0x' + '33'.repeat(20),
    chainId: 1,
    mode: PaymasterMode.VERIFYING,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockGetCode.mockReset();
    mockEstimateGas.mockReset();
    mockGetFeeData.mockReset();
    mockGetNonce.mockReset();

    // Default mock values
    mockGetCode.mockResolvedValue('0x1234'); // Wallet deployed
    mockEstimateGas.mockResolvedValue(BigInt(21000));
    mockGetFeeData.mockResolvedValue({ gasPrice: BigInt(1000000000) });
    mockGetNonce.mockResolvedValue(BigInt(0));
  });

  describe('constructor', () => {
    it('should create instance without paymaster', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      expect(builder).toBeInstanceOf(ZkapBuilder);
    });

    it('should create instance with paymaster config', () => {
      const accountInfoWithPaymaster = {
        ...mockAccountInfo,
        paymaster: mockPaymasterConfig,
      };

      const builder = new ZkapBuilder(accountInfoWithPaymaster);
      expect(builder).toBeInstanceOf(ZkapBuilder);
    });
  });

  describe('getRequiredPrefund', () => {
    it('should calculate required prefund', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder
        .setSender('0x' + '11'.repeat(20))
        .setVerificationGasLimit('0x7530')
        .setCallGasLimit('0x5208')
        .setPaymasterVerificationGasLimit('0x6978')
        .setPaymasterPostOpGasLimit('0x0')
        .setPreVerificationGas('0xc350')
        .setMaxFeePerGas('0x3b9aca00');

      const prefund = builder.getRequiredPrefund();
      expect(prefund).toMatch(/^0x/);
    });

    it('should throw when gas limits are not set', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));

      expect(() => builder.getRequiredPrefund()).toThrow(
        'Verification gas limit and call gas limit are not set'
      );
    });
  });

  describe('setInitCode', () => {
    it('should set init code for new account creation', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      const zkapFactory = '0x' + '22'.repeat(20);
      const salt = '0x1';
      const encodedMasterKey = '0x' + 'aa'.repeat(64);
      const encodedTxKey = '0x' + 'bb'.repeat(64);

      builder.setInitCode(zkapFactory, salt, encodedMasterKey, encodedTxKey);

      const userOp = builder.setSender('0x' + '11'.repeat(20)).getUserOp();
      expect(userOp.initCode).toBeDefined();
      expect(userOp.initCode).not.toBe('0x');
    });
  });

  describe('setRawInitCode', () => {
    it('should set raw init code directly', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      const rawInitCode = '0x' + 'ff'.repeat(100);

      builder.setRawInitCode(rawInitCode);

      const userOp = builder.setSender('0x' + '11'.repeat(20)).getUserOp();
      expect(userOp.initCode).toBe(rawInitCode);
    });
  });

  describe('setSignature', () => {
    it('should encode signature with key indices', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));

      builder.setSignature([0], ['0xSignature1']);

      const userOp = builder.getUserOp();
      expect(userOp.signature).toMatch(/^0x/);
    });

    it('should handle multiple signatures', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));

      builder.setSignature([0, 1], ['0xSig1', '0xSig2']);

      const userOp = builder.getUserOp();
      expect(userOp.signature).toBeDefined();
    });
  });

  describe('setExecuteCallData', () => {
    it('should set execute call data', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));

      const contractAddress = '0x' + '22'.repeat(20);
      const value = BigInt(0);
      const data = '0x1234';

      builder.setExecuteCallData(contractAddress, value, data);

      const userOp = builder.getUserOp();
      expect(userOp.callData).toBeDefined();
      expect(userOp.callData).not.toBe('0x');
    });
  });

  describe('setExecuteBatchCallData', () => {
    it('should set batch execute call data', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));

      const addresses = ['0x' + '22'.repeat(20), '0x' + '33'.repeat(20)];
      const values = [BigInt(0), BigInt(100)];
      const datas = ['0x1234', '0x5678'];

      builder.setExecuteBatchCallData(addresses, values, datas);

      const userOp = builder.getUserOp();
      expect(userOp.callData).toBeDefined();
    });
  });

  describe('setUpdateTxKeyCallData', () => {
    it('should set update tx key call data', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));

      const encoded = '0x' + 'cc'.repeat(64);
      builder.setUpdateTxKeyCallData(encoded);

      const userOp = builder.getUserOp();
      expect(userOp.callData).toBeDefined();
    });

    it('should throw when sender is not set', () => {
      const builder = new ZkapBuilder(mockAccountInfo);

      expect(() => builder.setUpdateTxKeyCallData('0x1234')).toThrow(
        'Sender is not set'
      );
    });
  });

  describe('setUpdateMasterKeyCallData', () => {
    it('should set update master key call data', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));

      const encoded = '0x' + 'dd'.repeat(64);
      builder.setUpdateMasterKeyCallData(encoded);

      const userOp = builder.getUserOp();
      expect(userOp.callData).toBeDefined();
    });

    it('should throw when sender is not set', () => {
      const builder = new ZkapBuilder(mockAccountInfo);

      expect(() => builder.setUpdateMasterKeyCallData('0x1234')).toThrow(
        'Sender is not set'
      );
    });
  });

  describe('setCallData (overridden)', () => {
    it('should throw when signer key types are not set', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));

      expect(() => builder.setCallData('0x1234')).toThrow(
        'Signer key types are not set'
      );
    });

    it('should work when signer key types are set', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));
      builder.setSignerKeyTypes([4]); // keyWebAuthn

      builder.setCallData('0x5678');

      const userOp = builder.getUserOp();
      expect(userOp.callData).toBe('0x5678');
    });
  });

  describe('setSignerKeyTypes', () => {
    it('should set signer key types', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));

      builder.setSignerKeyTypes([1, 4]);

      // After setting key types, setCallData should work
      expect(() => builder.setCallData('0x1234')).not.toThrow();
    });
  });

  describe('setPaymasterConfig', () => {
    it('should set paymaster config', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));

      builder.setPaymasterConfig(mockPaymasterConfig);

      const userOp = builder.getUserOp();
      expect(userOp.paymaster).toBe(mockPaymasterConfig.paymasterAddress);
    });
  });

  describe('removePaymasterConfig', () => {
    it('should remove paymaster config', () => {
      const accountInfoWithPaymaster = {
        ...mockAccountInfo,
        paymaster: mockPaymasterConfig,
      };

      const builder = new ZkapBuilder(accountInfoWithPaymaster);
      builder.setSender('0x' + '11'.repeat(20));
      builder.removePaymasterConfig();

      const userOp = builder.getUserOp();
      expect(userOp.paymaster).toBe(ethers.ZeroAddress);
      expect(userOp.paymasterData).toBe('0x');
    });
  });

  describe('autoFillUserOp', () => {
    it('should auto fill user operation fields', async () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));
      builder.setSignerKeyTypes([4]);
      builder.setCallData('0x1234');

      await builder.autoFillUserOp();

      const userOp = builder.getUserOp();
      expect(userOp.nonce).toBeDefined();
      expect(userOp.maxFeePerGas).toBeDefined();
      expect(userOp.callGasLimit).toBeDefined();
      expect(userOp.verificationGasLimit).toBeDefined();
    });

    it('should throw when sender is not set', async () => {
      const builder = new ZkapBuilder(mockAccountInfo);

      await expect(builder.autoFillUserOp()).rejects.toThrow(
        'Sender is not set'
      );
    });

    it('should throw when fee data is not available', async () => {
      mockGetFeeData.mockResolvedValueOnce(null);

      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));

      await expect(builder.autoFillUserOp()).rejects.toThrow(
        'Failed to get fee data from provider'
      );
    });

    it('should auto fill paymaster data when paymaster is configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            userOp: { paymasterData: '0xPaymasterData' },
          },
        }),
      });

      const accountInfoWithPaymaster = {
        ...mockAccountInfo,
        paymaster: mockPaymasterConfig,
      };

      const builder = new ZkapBuilder(accountInfoWithPaymaster);
      builder.setSender('0x' + '11'.repeat(20));
      builder.setSignerKeyTypes([4]);
      builder.setCallData('0x1234');

      await builder.autoFillUserOp();

      const userOp = builder.getUserOp();
      expect(userOp.paymasterVerificationGasLimit).toBeDefined();
      expect(userOp.paymasterPostOpGasLimit).toBeDefined();
    });

    it('should handle wallet not deployed scenario', async () => {
      mockGetCode.mockResolvedValueOnce('0x'); // No code = not deployed

      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));
      builder.setSignerKeyTypes([4]);

      // Without initCode, should throw
      await expect(builder.autoFillUserOp()).rejects.toThrow(
        'Wallet not deployed and no initCode provided'
      );
    });

    it('should handle wallet creation with initCode', async () => {
      mockGetCode.mockResolvedValueOnce('0x'); // Not deployed

      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));
      builder.setInitCode(
        '0x' + '22'.repeat(20),
        '0x1',
        '0x' + 'aa'.repeat(64),
        '0x' + 'bb'.repeat(64)
      );

      await builder.autoFillUserOp();

      const userOp = builder.getUserOp();
      expect(userOp.verificationGasLimit).toBeDefined();
    });
  });

  describe('getUserOpHashForPaymaster', () => {
    it('should compute hash for paymaster', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder
        .setSender('0x' + '11'.repeat(20))
        .setPaymaster('0x' + '22'.repeat(20))
        .setPaymasterData('0x1234')
        .setPaymasterVerificationGasLimit('0x6978')
        .setPaymasterPostOpGasLimit('0x0');

      const hash = builder.getUserOpHashForPaymaster();

      expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  describe('updateUserOpCallDataForPaymasterERC20', () => {
    it('should throw when call data is not set', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));

      expect(() =>
        builder.updateUserOpCallDataForPaymasterERC20(
          '0x' + '22'.repeat(20),
          '0x' + '33'.repeat(20),
          BigInt(1000)
        )
      ).toThrow('Call data is not set');
    });

    it('should update call data for ERC20 paymaster with execute', () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));
      builder.setSignerKeyTypes([4]);
      builder.setExecuteCallData('0x' + '44'.repeat(20), BigInt(0), '0x1234');

      builder.updateUserOpCallDataForPaymasterERC20(
        '0x' + '55'.repeat(20),
        '0x' + '66'.repeat(20),
        BigInt(1000)
      );

      const userOp = builder.getUserOp();
      expect(userOp.callData).toBeDefined();
    });

  });

  describe('estimateCallGasLimit (via autoFillUserOp)', () => {
    it('should return minimal gas when only initCode is set without callData', async () => {
      mockGetCode.mockResolvedValueOnce('0x'); // Not deployed

      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));
      builder.setInitCode(
        '0x' + '22'.repeat(20),
        '0x1',
        '0x' + 'aa'.repeat(64),
        '0x' + 'bb'.repeat(64)
      );
      // No callData set - should return minimal gas

      await builder.autoFillUserOp();

      const userOp = builder.getUserOp();
      expect(userOp.callGasLimit).toBeDefined();
      expect(userOp.callGasLimit).toBe('0x3e8'); // 1000 in hex
    });
  });

  describe('edge cases', () => {
    it('should handle multiple key types for gas estimation', async () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));
      builder.setSignerKeyTypes([1, 4, 6]); // Address, WebAuthn, ZkOAuth
      builder.setCallData('0x1234');

      await builder.autoFillUserOp();

      const userOp = builder.getUserOp();
      expect(userOp.verificationGasLimit).toBeDefined();
    });

    it('should use existing nonce when already set', async () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));
      builder.setNonce('0x10'); // Pre-set nonce
      builder.setSignerKeyTypes([4]);
      builder.setCallData('0x1234');

      await builder.autoFillUserOp();

      const userOp = builder.getUserOp();
      expect(userOp.nonce).toBe('0x10');
      expect(mockGetNonce).not.toHaveBeenCalled();
    });

    it('should handle empty string callData', async () => {
      const builder = new ZkapBuilder(mockAccountInfo);
      builder.setSender('0x' + '11'.repeat(20));
      builder.setSignerKeyTypes([4]);
      builder.setCallData('0x');

      await builder.autoFillUserOp();

      const userOp = builder.getUserOp();
      expect(userOp.callGasLimit).toBeDefined();
    });
  });

});
