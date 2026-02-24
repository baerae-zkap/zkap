/**
 * BaseAccountBuilder 테스트
 *
 * UserOperation을 구성하는 추상 빌더 클래스
 * setters, getters, encoding, packing 함수들 테스트
 */

import { BaseAccountBuilder } from '../BaseAccountBuilder';
import { UserOperation, PackedUserOperation } from '../../types/UserOperation';
import { ethers } from 'ethers';

// Concrete implementation for testing
class TestAccountBuilder extends BaseAccountBuilder {
  setInitCode(...initCodes: string[]): this {
    this.userOp.initCode = initCodes.join('');
    return this;
  }

  setSignature(keyIndexList: number[], keySignatureList: string[]): this {
    // Simple concatenation for testing
    this.userOp.signature = keySignatureList.join('');
    return this;
  }
}

describe('BaseAccountBuilder', () => {
  const mockChainId = 1;
  const mockEntryPoint = '0x' + '55'.repeat(20);
  let builder: TestAccountBuilder;

  beforeEach(() => {
    builder = new TestAccountBuilder(mockChainId, mockEntryPoint);
  });

  describe('constructor', () => {
    it('should initialize with chainId and entryPoint', () => {
      expect(builder).toBeInstanceOf(BaseAccountBuilder);
    });

    it('should accept optional provider', () => {
      const mockProvider = new ethers.JsonRpcProvider('http://localhost:8545');
      const builderWithProvider = new TestAccountBuilder(mockChainId, mockEntryPoint, mockProvider);
      expect(builderWithProvider).toBeInstanceOf(BaseAccountBuilder);
    });

    it('should throw when entryPoint is not a valid address', () => {
      expect(() => new TestAccountBuilder(1, 'not-an-address')).toThrow('Invalid entryPoint address');
    });

    it('should throw when entryPoint is zero address', () => {
      expect(() => new TestAccountBuilder(1, ethers.ZeroAddress)).toThrow('Invalid entryPoint address');
    });

    it('should throw when chainId is 0', () => {
      expect(() => new TestAccountBuilder(0, mockEntryPoint)).toThrow('Invalid chainId');
    });

    it('should throw when chainId is negative', () => {
      expect(() => new TestAccountBuilder(-1, mockEntryPoint)).toThrow('Invalid chainId');
    });

    it('should throw when chainId is not an integer', () => {
      expect(() => new TestAccountBuilder(1.5, mockEntryPoint)).toThrow('Invalid chainId');
    });
  });

  describe('setters - fluent interface', () => {
    it('should set sender', () => {
      const sender = '0x' + '11'.repeat(20);
      const result = builder.setSender(sender);

      expect(result).toBe(builder); // fluent interface
      expect(builder.getUserOp().sender).toBe(sender);
    });

    it('should throw when sender is not a valid Ethereum address', () => {
      expect(() => builder.setSender('not-an-address'))
        .toThrow('setSender: invalid Ethereum address: "not-an-address"');
    });

    it('should set nonce', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setNonce('0x5');

      expect(builder.getUserOp().nonce).toBe('0x5');
    });

    it('should set callData', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setCallData('0xabcdef');

      expect(builder.getUserOp().callData).toBe('0xabcdef');
    });

    it('should set callGasLimit', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setCallGasLimit('0x5208');

      expect(builder.getUserOp().callGasLimit).toBe('0x5208');
    });

    it('should set verificationGasLimit', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setVerificationGasLimit('0x7530');

      expect(builder.getUserOp().verificationGasLimit).toBe('0x7530');
    });

    it('should set preVerificationGas', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setPreVerificationGas('0xc350');

      expect(builder.getUserOp().preVerificationGas).toBe('0xc350');
    });

    it('should set maxFeePerGas', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setMaxFeePerGas('0x3b9aca00');

      expect(builder.getUserOp().maxFeePerGas).toBe('0x3b9aca00');
    });

    it('should set maxPriorityFeePerGas', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setMaxPriorityFeePerGas('0x59682f00');

      expect(builder.getUserOp().maxPriorityFeePerGas).toBe('0x59682f00');
    });

    it('should set paymaster', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setPaymaster('0x' + '22'.repeat(20));

      expect(builder.getUserOp().paymaster).toBe('0x' + '22'.repeat(20));
    });

    it('should throw when paymaster is not a valid Ethereum address', () => {
      builder.setSender('0x' + '11'.repeat(20));

      expect(() => builder.setPaymaster('not-an-address'))
        .toThrow('setPaymaster: invalid Ethereum address: "not-an-address"');
    });

    it('should set paymasterData', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setPaymasterData('0xPaymasterData');

      expect(builder.getUserOp().paymasterData).toBe('0xPaymasterData');
    });

    it('should set paymasterVerificationGasLimit', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setPaymasterVerificationGasLimit('0x6978');

      expect(builder.getUserOp().paymasterVerificationGasLimit).toBe('0x6978');
    });

    it('should set paymasterPostOpGasLimit', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setPaymasterPostOpGasLimit('0x186a0');

      expect(builder.getUserOp().paymasterPostOpGasLimit).toBe('0x186a0');
    });

    it('should chain multiple setters', () => {
      const sender = '0x' + '11'.repeat(20);

      builder
        .setSender(sender)
        .setNonce('0x1')
        .setCallData('0x1234')
        .setCallGasLimit('0x5000')
        .setVerificationGasLimit('0x7000')
        .setMaxFeePerGas('0x1000000000')
        .setMaxPriorityFeePerGas('0x100000000');

      const userOp = builder.getUserOp();
      expect(userOp.sender).toBe(sender);
      expect(userOp.nonce).toBe('0x1');
      expect(userOp.callData).toBe('0x1234');
    });
  });

  describe('setUserOp', () => {
    it('should set entire UserOp at once', () => {
      const userOp: UserOperation = {
        sender: '0x' + '11'.repeat(20),
        nonce: '0x10',
        initCode: '0x',
        callData: '0xabcd',
        callGasLimit: '0x5000',
        verificationGasLimit: '0x7000',
        preVerificationGas: '0x3000',
        maxFeePerGas: '0x1000000000',
        maxPriorityFeePerGas: '0x100000000',
        paymaster: ethers.ZeroAddress,
        paymasterData: '0x',
        paymasterVerificationGasLimit: '0x0',
        paymasterPostOpGasLimit: '0x0',
        signature: '0x',
      };

      builder.setUserOp(userOp);
      const result = builder.getUserOp();

      expect(result.sender).toBe(userOp.sender);
      expect(result.nonce).toBe(userOp.nonce);
      expect(result.callData).toBe(userOp.callData);
    });
  });

  describe('getUserOp', () => {
    it('should apply defaults when getting userOp', () => {
      const sender = '0x' + '11'.repeat(20);
      builder.setSender(sender);

      const userOp = builder.getUserOp();

      expect(userOp.sender).toBe(sender);
      expect(userOp.initCode).toBe('0x');
      expect(userOp.callData).toBe('0x');
      expect(userOp.signature).toBe('0x');
    });

    it('should throw when sender is default ZeroAddress (not explicitly set)', () => {
      // Default value is ZeroAddress, which now throws
      expect(() => builder.getUserOp()).toThrow('Sender is not set or is zero address');
    });

    it('should throw error when sender is explicitly set to empty value', () => {
      // Explicitly set sender to undefined to trigger error path
      (builder as any).userOp = { sender: undefined };

      expect(() => builder.getUserOp()).toThrow('Sender is not set or is zero address');
    });
  });

  describe('packAccountGasLimits', () => {
    it('should pack verification and call gas limits', () => {
      const result = builder.packAccountGasLimits('0x7530', '0x5208');

      expect(result).toMatch(/^0x/);
      expect(result.length).toBe(66); // 0x + 32 bytes (64 hex chars)
    });

    it('should produce different results for different inputs', () => {
      const result1 = builder.packAccountGasLimits('0x1000', '0x2000');
      const result2 = builder.packAccountGasLimits('0x3000', '0x4000');

      expect(result1).not.toBe(result2);
    });
  });

  describe('packPaymasterData', () => {
    it('should pack paymaster data', () => {
      const paymaster = '0x' + '22'.repeat(20);
      // ethers.hexlify needs hex strings
      const verificationGasLimit = '0x6978'; // 27000
      const postOpGasLimit = '0x0186a0'; // 100000 - need leading zero for even length
      const paymasterData = '0x1234';

      const result = builder.packPaymasterData(
        paymaster,
        verificationGasLimit,
        postOpGasLimit,
        paymasterData
      );

      expect(result).toMatch(/^0x/);
      expect(result.length).toBeGreaterThan(40); // At least address length
    });
  });

  describe('packUserOp', () => {
    it('should pack UserOp to PackedUserOperation', () => {
      // All gas values must be hex strings for ethers.hexlify
      const userOp: UserOperation = {
        sender: '0x' + '11'.repeat(20),
        nonce: '0x1',
        initCode: '0x',
        callData: '0xabcd',
        callGasLimit: '0x4e20', // 20000
        verificationGasLimit: '0x6d60', // 28000
        preVerificationGas: '0x2ee0', // 12000
        maxFeePerGas: '0x3b9aca00', // 1000000000
        maxPriorityFeePerGas: '0x05f5e100', // 100000000
        paymaster: ethers.ZeroAddress,
        paymasterData: '0x',
        paymasterVerificationGasLimit: '0x00',
        paymasterPostOpGasLimit: '0x00',
        signature: '0x' + '11'.repeat(32),
      };

      const packed = builder.packUserOp(userOp);

      expect(packed.sender).toBe(userOp.sender);
      expect(packed.nonce).toBe(userOp.nonce);
      expect(packed.initCode).toBe(userOp.initCode);
      expect(packed.callData).toBe(userOp.callData);
      expect(packed.signature).toBe(userOp.signature);
      expect(packed.accountGasLimits).toMatch(/^0x/);
      expect(packed.gasFees).toMatch(/^0x/);
      expect(packed.paymasterAndData).toBe('0x'); // No paymaster
    });

    it('should include paymasterAndData when paymaster is set', () => {
      const paymaster = '0x' + '22'.repeat(20);
      const userOp: UserOperation = {
        sender: '0x' + '11'.repeat(20),
        nonce: '0x1',
        initCode: '0x',
        callData: '0x',
        callGasLimit: '0x4e20',
        verificationGasLimit: '0x6d60',
        preVerificationGas: '0x2ee0',
        maxFeePerGas: '0x3b9aca00',
        maxPriorityFeePerGas: '0x05f5e100',
        paymaster: paymaster,
        paymasterData: '0x1234',
        paymasterVerificationGasLimit: '0x6978',
        paymasterPostOpGasLimit: '0x0186a0',
        signature: '0x',
      };

      const packed = builder.packUserOp(userOp);

      expect(packed.paymasterAndData).not.toBe('0x');
      expect(packed.paymasterAndData.toLowerCase()).toContain(paymaster.slice(2).toLowerCase());
    });
  });

  describe('getPackedUserOp', () => {
    it('should get packed user op', () => {
      builder.setSender('0x' + '11'.repeat(20));

      const packed = builder.getPackedUserOp();

      expect(packed).toHaveProperty('sender');
      expect(packed).toHaveProperty('nonce');
      expect(packed).toHaveProperty('initCode');
      expect(packed).toHaveProperty('callData');
      expect(packed).toHaveProperty('accountGasLimits');
      expect(packed).toHaveProperty('preVerificationGas');
      expect(packed).toHaveProperty('gasFees');
      expect(packed).toHaveProperty('paymasterAndData');
      expect(packed).toHaveProperty('signature');
    });
  });

  describe('encodeUserOp', () => {
    const createPackedUserOp = (): PackedUserOperation => ({
      sender: '0x' + '11'.repeat(20),
      nonce: '0x1',
      initCode: '0x',
      callData: '0x1234',
      accountGasLimits: '0x' + '00'.repeat(32),
      preVerificationGas: '0x5000',
      gasFees: '0x' + '00'.repeat(32),
      paymasterAndData: '0x',
      signature: '0x' + 'ab'.repeat(65), // Valid signature bytes
    });

    it('should encode for signature (forSignature = true)', () => {
      const packed = createPackedUserOp();
      const encoded = builder.encodeUserOp(packed, true);

      expect(encoded).toMatch(/^0x/);
      expect(encoded.length).toBeGreaterThan(100);
    });

    it('should encode with signature for gas cost (forSignature = false)', () => {
      const packed = createPackedUserOp();
      const encodedForSig = builder.encodeUserOp(packed, true);
      const encodedForGas = builder.encodeUserOp(packed, false);

      // Different encoding formats should produce different results
      expect(encodedForSig).not.toBe(encodedForGas);
    });
  });

  describe('encodeUserOpForPaymaster', () => {
    it('should encode user op for paymaster signature', () => {
      const packed: PackedUserOperation = {
        sender: '0x' + '11'.repeat(20),
        nonce: '0x1',
        initCode: '0x',
        callData: '0x1234',
        accountGasLimits: '0x' + '00'.repeat(32),
        preVerificationGas: '0x5000',
        gasFees: '0x' + '00'.repeat(32),
        // paymaster addr(20) + verifyGasLimit(16) + postOpGasLimit(16) + sig(65) = 117 bytes minimum
        paymasterAndData: '0x' + '22'.repeat(20) + '00'.repeat(16) + '00'.repeat(16) + 'aa'.repeat(65),
        signature: '0x',
      };

      const encoded = builder.encodeUserOpForPaymaster(packed);

      expect(encoded).toMatch(/^0x/);
    });

    it('should throw when paymasterAndData is too short to contain signature', () => {
      const packed: PackedUserOperation = {
        sender: '0x' + '11'.repeat(20),
        nonce: '0x1',
        initCode: '0x',
        callData: '0x1234',
        accountGasLimits: '0x' + '00'.repeat(32),
        preVerificationGas: '0x5000',
        gasFees: '0x' + '00'.repeat(32),
        paymasterAndData: '0x1234', // Too short (6 chars < 132)
        signature: '0x',
      };

      expect(() => builder.encodeUserOpForPaymaster(packed)).toThrow(
        'paymasterAndData too short to contain signature'
      );
    });

    it('should throw when paymasterAndData is just "0x"', () => {
      const packed: PackedUserOperation = {
        sender: '0x' + '11'.repeat(20),
        nonce: '0x1',
        initCode: '0x',
        callData: '0x1234',
        accountGasLimits: '0x' + '00'.repeat(32),
        preVerificationGas: '0x5000',
        gasFees: '0x' + '00'.repeat(32),
        paymasterAndData: '0x',
        signature: '0x',
      };

      expect(() => builder.encodeUserOpForPaymaster(packed)).toThrow(
        'paymasterAndData too short to contain signature'
      );
    });

    it('should throw when paymasterAndData is exactly sig length (no data before sig)', () => {
      // "0x" + 130 hex chars = exactly 132 chars total, which means only signature with no preceding data
      const packed: PackedUserOperation = {
        sender: '0x' + '11'.repeat(20),
        nonce: '0x1',
        initCode: '0x',
        callData: '0x1234',
        accountGasLimits: '0x' + '00'.repeat(32),
        preVerificationGas: '0x5000',
        gasFees: '0x' + '00'.repeat(32),
        paymasterAndData: '0x' + 'aa'.repeat(65), // exactly 132 chars
        signature: '0x',
      };

      expect(() => builder.encodeUserOpForPaymaster(packed)).toThrow(
        'paymasterAndData too short to contain signature'
      );
    });

    it('should throw when paymasterSigBytes is 0', () => {
      const packed: PackedUserOperation = {
        sender: '0x' + '11'.repeat(20),
        nonce: '0x0',
        initCode: '0x',
        callData: '0x',
        accountGasLimits: '0x' + '00'.repeat(32),
        preVerificationGas: '0x0',
        gasFees: '0x' + '00'.repeat(32),
        paymasterAndData: '0x' + '11'.repeat(117),
        signature: '0x',
      };
      expect(() => builder.encodeUserOpForPaymaster(packed, 0)).toThrow('Invalid paymasterSigBytes');
    });

    it('should throw when paymasterSigBytes is negative', () => {
      const packed: PackedUserOperation = {
        sender: '0x' + '11'.repeat(20),
        nonce: '0x0',
        initCode: '0x',
        callData: '0x',
        accountGasLimits: '0x' + '00'.repeat(32),
        preVerificationGas: '0x0',
        gasFees: '0x' + '00'.repeat(32),
        paymasterAndData: '0x' + '11'.repeat(117),
        signature: '0x',
      };
      expect(() => builder.encodeUserOpForPaymaster(packed, -1)).toThrow('Invalid paymasterSigBytes');
    });

    it('should throw when paymasterSigBytes exceeds 256', () => {
      const packed: PackedUserOperation = {
        sender: '0x' + '11'.repeat(20),
        nonce: '0x0',
        initCode: '0x',
        callData: '0x',
        accountGasLimits: '0x' + '00'.repeat(32),
        preVerificationGas: '0x0',
        gasFees: '0x' + '00'.repeat(32),
        paymasterAndData: '0x' + '11'.repeat(117),
        signature: '0x',
      };
      expect(() => builder.encodeUserOpForPaymaster(packed, 257)).toThrow('Invalid paymasterSigBytes');
    });
  });

  describe('getUserOpHash', () => {
    it('should compute user op hash', () => {
      builder.setSender('0x' + '11'.repeat(20));

      const hash = builder.getUserOpHash();

      expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('should produce consistent hash for same input', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setNonce('0x1');
      builder.setCallData('0x1234');

      const hash1 = builder.getUserOpHash();
      const hash2 = builder.getUserOpHash();

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different chainId', () => {
      const builder1 = new TestAccountBuilder(1, mockEntryPoint);
      const builder2 = new TestAccountBuilder(137, mockEntryPoint);

      builder1.setSender('0x' + '11'.repeat(20));
      builder2.setSender('0x' + '11'.repeat(20));

      const hash1 = builder1.getUserOpHash();
      const hash2 = builder2.getUserOpHash();

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hash for different entryPoint', () => {
      const builder1 = new TestAccountBuilder(1, '0x' + '55'.repeat(20));
      const builder2 = new TestAccountBuilder(1, '0x' + '66'.repeat(20));

      builder1.setSender('0x' + '11'.repeat(20));
      builder2.setSender('0x' + '11'.repeat(20));

      const hash1 = builder1.getUserOpHash();
      const hash2 = builder2.getUserOpHash();

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('setInitCode (abstract implementation)', () => {
    it('should set initCode via concrete implementation', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setInitCode('0xFactory', '0xInitData');

      expect(builder.getUserOp().initCode).toBe('0xFactory0xInitData');
    });
  });

  describe('setSignature (abstract implementation)', () => {
    it('should set signature via concrete implementation', () => {
      builder.setSender('0x' + '11'.repeat(20));
      builder.setSignature([0], ['0xSignature1']);

      expect(builder.getUserOp().signature).toBe('0xSignature1');
    });
  });

  describe('estimateUserOpGasCost', () => {
    const mockProvider = {
      estimateGas: jest.fn(),
      getFeeData: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw when provider is not set', async () => {
      const builderNoProvider = new TestAccountBuilder(mockChainId, mockEntryPoint);
      const userOp = builderNoProvider.setSender('0x' + '11'.repeat(20)).getUserOp();

      await expect(builderNoProvider.estimateUserOpGasCost(userOp)).rejects.toThrow(
        'Provider is required for gas estimation'
      );
    });

    it('should estimate gas cost for basic userOp', async () => {
      mockProvider.estimateGas.mockResolvedValue(BigInt(50000));
      mockProvider.getFeeData.mockResolvedValue({ gasPrice: BigInt(1000000000) });

      const builderWithProvider = new TestAccountBuilder(
        mockChainId,
        mockEntryPoint,
        mockProvider as unknown as ethers.JsonRpcProvider
      );

      builderWithProvider.setSender('0x' + '11'.repeat(20));
      builderWithProvider.setCallData('0x1234');
      builderWithProvider.setCallGasLimit('0x5000');
      builderWithProvider.setVerificationGasLimit('0x7000');

      const userOp = builderWithProvider.getUserOp();
      const cost = await builderWithProvider.estimateUserOpGasCost(userOp);

      expect(cost).toBeDefined();
      expect(typeof cost).toBe('string');
      // Cost should be a positive number string
      expect(BigInt(cost)).toBeGreaterThan(BigInt(0));
    });

    it('should estimate gas cost with initCode', async () => {
      mockProvider.estimateGas.mockResolvedValue(BigInt(100000));
      mockProvider.getFeeData.mockResolvedValue({ gasPrice: BigInt(2000000000) });

      const builderWithProvider = new TestAccountBuilder(
        mockChainId,
        mockEntryPoint,
        mockProvider as unknown as ethers.JsonRpcProvider
      );

      builderWithProvider.setSender('0x' + '11'.repeat(20));
      builderWithProvider.setInitCode('0x' + 'aa'.repeat(50)); // 50 byte initCode
      builderWithProvider.setCallData('0x1234');

      const userOp = builderWithProvider.getUserOp();
      const cost = await builderWithProvider.estimateUserOpGasCost(userOp);

      expect(BigInt(cost)).toBeGreaterThan(BigInt(0));
    });

    it('should estimate gas cost with paymaster', async () => {
      mockProvider.estimateGas.mockResolvedValue(BigInt(75000));
      mockProvider.getFeeData.mockResolvedValue({ gasPrice: BigInt(1500000000) });

      const builderWithProvider = new TestAccountBuilder(
        mockChainId,
        mockEntryPoint,
        mockProvider as unknown as ethers.JsonRpcProvider
      );

      builderWithProvider.setSender('0x' + '11'.repeat(20));
      builderWithProvider.setCallData('0x1234');
      builderWithProvider.setPaymaster('0x' + '33'.repeat(20));
      builderWithProvider.setPaymasterData('0xabcd');

      const userOp = builderWithProvider.getUserOp();
      const cost = await builderWithProvider.estimateUserOpGasCost(userOp);

      expect(BigInt(cost)).toBeGreaterThan(BigInt(0));
    });

    it('should handle zero callData', async () => {
      mockProvider.estimateGas.mockResolvedValue(BigInt(30000));
      mockProvider.getFeeData.mockResolvedValue({ gasPrice: BigInt(1000000000) });

      const builderWithProvider = new TestAccountBuilder(
        mockChainId,
        mockEntryPoint,
        mockProvider as unknown as ethers.JsonRpcProvider
      );

      builderWithProvider.setSender('0x' + '11'.repeat(20));
      // No callData set, should default to '0x'

      const userOp = builderWithProvider.getUserOp();
      const cost = await builderWithProvider.estimateUserOpGasCost(userOp);

      expect(BigInt(cost)).toBeGreaterThanOrEqual(BigInt(0));
    });

    it('should throw when gas estimation fails', async () => {
      // Verification gas estimation fails → error propagates immediately (no fallback)
      mockProvider.estimateGas.mockRejectedValueOnce(new Error('Estimation failed'));
      mockProvider.getFeeData.mockResolvedValue({ gasPrice: BigInt(1000000000) });

      const builderWithProvider = new TestAccountBuilder(
        mockChainId,
        mockEntryPoint,
        mockProvider as unknown as ethers.JsonRpcProvider
      );

      builderWithProvider.setSender('0x' + '11'.repeat(20));
      builderWithProvider.setCallData('0x1234');

      const userOp = builderWithProvider.getUserOp();

      // Errors are now propagated instead of using fallback values
      await expect(builderWithProvider.estimateUserOpGasCost(userOp)).rejects.toThrow(
        'Failed to estimate gas cost'
      );
    });

    it('should handle missing gas price', async () => {
      mockProvider.estimateGas.mockResolvedValue(BigInt(50000));
      mockProvider.getFeeData.mockResolvedValue({ gasPrice: null });

      const builderWithProvider = new TestAccountBuilder(
        mockChainId,
        mockEntryPoint,
        mockProvider as unknown as ethers.JsonRpcProvider
      );

      builderWithProvider.setSender('0x' + '11'.repeat(20));
      builderWithProvider.setCallData('0x1234');

      const userOp = builderWithProvider.getUserOp();
      const cost = await builderWithProvider.estimateUserOpGasCost(userOp);

      // With gasPrice = 0, total cost should be 0
      expect(cost).toBe('0');
    });

    it('should throw on complete estimation failure', async () => {
      mockProvider.estimateGas.mockRejectedValue(new Error('Network error'));
      mockProvider.getFeeData.mockRejectedValue(new Error('Fee data error'));

      const builderWithProvider = new TestAccountBuilder(
        mockChainId,
        mockEntryPoint,
        mockProvider as unknown as ethers.JsonRpcProvider
      );

      builderWithProvider.setSender('0x' + '11'.repeat(20));
      builderWithProvider.setCallData('0x1234');

      const userOp = builderWithProvider.getUserOp();

      await expect(builderWithProvider.estimateUserOpGasCost(userOp)).rejects.toThrow(
        'Failed to estimate gas cost'
      );
    });

    it('should calculate preVerificationGas based on calldata size', async () => {
      mockProvider.estimateGas.mockResolvedValue(BigInt(50000));
      mockProvider.getFeeData.mockResolvedValue({ gasPrice: BigInt(1000000000) });

      const builderWithProvider = new TestAccountBuilder(
        mockChainId,
        mockEntryPoint,
        mockProvider as unknown as ethers.JsonRpcProvider
      );

      builderWithProvider.setSender('0x' + '11'.repeat(20));

      // Small callData
      builderWithProvider.setCallData('0x12');
      const userOp1 = builderWithProvider.getUserOp();
      const cost1 = await builderWithProvider.estimateUserOpGasCost(userOp1);

      // Large callData
      builderWithProvider.setCallData('0x' + 'ab'.repeat(1000));
      const userOp2 = builderWithProvider.getUserOp();
      const cost2 = await builderWithProvider.estimateUserOpGasCost(userOp2);

      // Larger callData should result in higher cost
      expect(BigInt(cost2)).toBeGreaterThan(BigInt(cost1));
    });

    it('should handle paymaster with zero address', async () => {
      mockProvider.estimateGas.mockResolvedValue(BigInt(40000));
      mockProvider.getFeeData.mockResolvedValue({ gasPrice: BigInt(1000000000) });

      const builderWithProvider = new TestAccountBuilder(
        mockChainId,
        mockEntryPoint,
        mockProvider as unknown as ethers.JsonRpcProvider
      );

      builderWithProvider.setSender('0x' + '11'.repeat(20));
      builderWithProvider.setCallData('0x1234');
      builderWithProvider.setPaymaster(ethers.ZeroAddress);

      const userOp = builderWithProvider.getUserOp();
      const cost = await builderWithProvider.estimateUserOpGasCost(userOp);

      // Should not include paymaster gas when paymaster is ZeroAddress
      expect(BigInt(cost)).toBeGreaterThan(BigInt(0));
    });

    it('should throw when estimatePaymasterGas fails', async () => {
      // All estimateGas calls fail → error propagates (no fallback)
      mockProvider.estimateGas.mockRejectedValue(new Error('Estimation failed'));
      mockProvider.getFeeData.mockResolvedValue({ gasPrice: BigInt(1000000000) });

      const builderWithProvider = new TestAccountBuilder(
        mockChainId,
        mockEntryPoint,
        mockProvider as unknown as ethers.JsonRpcProvider
      );

      builderWithProvider.setSender('0x' + '11'.repeat(20));
      builderWithProvider.setCallData('0x1234');
      // Set a non-zero paymaster so estimatePaymasterGas is invoked
      builderWithProvider.setPaymaster('0x' + '33'.repeat(20));
      builderWithProvider.setPaymasterData('0xabcd');

      const userOp = builderWithProvider.getUserOp();

      await expect(builderWithProvider.estimateUserOpGasCost(userOp)).rejects.toThrow(
        'Failed to estimate gas cost'
      );
    });
  });
});
