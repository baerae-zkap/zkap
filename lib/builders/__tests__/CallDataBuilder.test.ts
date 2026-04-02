/**
 * CallDataBuilder tests
 *
 * Builder that encodes/decodes callData using contract ABIs
 */

import { CallDataBuilder } from '../CallDataBuilder';
import { ethers } from 'ethers';

// Simple ERC20 ABI for testing - as JSON string
const ERC20_ABI = JSON.stringify([
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
]);

// More complex ABI - as JSON string
const COMPLEX_ABI = JSON.stringify([
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'dest', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'func', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeBatch',
    inputs: [
      { name: 'dest', type: 'address[]' },
      { name: 'value', type: 'uint256[]' },
      { name: 'func', type: 'bytes[]' },
    ],
    outputs: [],
  },
]);

describe('CallDataBuilder', () => {
  describe('constructor', () => {
    it('should create builder with string array ABI', () => {
      const builder = new CallDataBuilder(ERC20_ABI);
      expect(builder).toBeInstanceOf(CallDataBuilder);
    });

    it('should create builder with Fragment array', () => {
      // Create Interface first to get proper Fragment objects
      const iface = new ethers.Interface([
        'function transfer(address to, uint256 amount) returns (bool)',
      ]);
      const fragments = iface.fragments;

      const builder = new CallDataBuilder(fragments as ethers.Fragment[]);
      expect(builder).toBeInstanceOf(CallDataBuilder);
    });
  });

  describe('encode', () => {
    it('should encode transfer function', () => {
      const builder = new CallDataBuilder(ERC20_ABI);
      const to = '0x' + '11'.repeat(20);
      const amount = BigInt('1000000000000000000'); // 1 ETH

      const callData = builder.encode('transfer', [to, amount]);

      expect(callData).toMatch(/^0x/);
      // transfer function selector is 0xa9059cbb
      expect(callData.slice(0, 10)).toBe('0xa9059cbb');
    });

    it('should encode approve function', () => {
      const builder = new CallDataBuilder(ERC20_ABI);
      const spender = '0x' + '22'.repeat(20);
      const amount = BigInt('999999999999999999999');

      const callData = builder.encode('approve', [spender, amount]);

      expect(callData).toMatch(/^0x/);
      // approve function selector is 0x095ea7b3
      expect(callData.slice(0, 10)).toBe('0x095ea7b3');
    });

    it('should encode complex execute function', () => {
      const builder = new CallDataBuilder(COMPLEX_ABI);
      const dest = '0x' + '33'.repeat(20);
      const value = BigInt(0);
      const func = '0x12345678';

      const callData = builder.encode('execute', [dest, value, func]);

      expect(callData).toMatch(/^0x/);
      expect(callData.length).toBeGreaterThan(10);
    });

    it('should encode executeBatch with arrays', () => {
      const builder = new CallDataBuilder(COMPLEX_ABI);
      const dests = ['0x' + '11'.repeat(20), '0x' + '22'.repeat(20)];
      const values = [BigInt(0), BigInt(100)];
      const funcs = ['0x12345678', '0xabcdef00'];

      const callData = builder.encode('executeBatch', [dests, values, funcs]);

      expect(callData).toMatch(/^0x/);
      expect(callData.length).toBeGreaterThan(200); // Batch encoding is longer
    });

    it('should throw for non-existent method', () => {
      const builder = new CallDataBuilder(ERC20_ABI);

      expect(() => builder.encode('nonExistentMethod', []))
        .toThrow('Method nonExistentMethod not found in ABI.');
    });

    it('should throw for invalid parameters', () => {
      const builder = new CallDataBuilder(ERC20_ABI);

      // Transfer expects address and uint256, passing wrong types should fail
      expect(() => builder.encode('transfer', ['not-an-address', 'not-a-number']))
        .toThrow();
    });

    it('should encode with zero values', () => {
      const builder = new CallDataBuilder(ERC20_ABI);
      const to = '0x' + '00'.repeat(20);
      const amount = BigInt(0);

      const callData = builder.encode('transfer', [to, amount]);

      expect(callData).toMatch(/^0x/);
    });

    it('should encode with max uint256', () => {
      const builder = new CallDataBuilder(ERC20_ABI);
      const spender = '0x' + 'ff'.repeat(20);
      const maxUint256 = BigInt('0x' + 'ff'.repeat(32));

      const callData = builder.encode('approve', [spender, maxUint256]);

      expect(callData).toMatch(/^0x/);
    });
  });

  describe('decode', () => {
    it('should decode transfer callData', () => {
      const builder = new CallDataBuilder(ERC20_ABI);
      const to = '0x' + '11'.repeat(20);
      const amount = BigInt('1000000000000000000');

      // First encode
      const callData = builder.encode('transfer', [to, amount]);

      // Then decode
      const decoded = builder.decode('transfer', callData);

      expect(decoded[0].toLowerCase()).toBe(to.toLowerCase());
      expect(decoded[1]).toBe(amount);
    });

    it('should decode approve callData', () => {
      const builder = new CallDataBuilder(ERC20_ABI);
      const spender = '0x' + '22'.repeat(20);
      const amount = BigInt('5000000000000000000');

      const callData = builder.encode('approve', [spender, amount]);
      const decoded = builder.decode('approve', callData);

      expect(decoded[0].toLowerCase()).toBe(spender.toLowerCase());
      expect(decoded[1]).toBe(amount);
    });

    it('should decode execute callData', () => {
      const builder = new CallDataBuilder(COMPLEX_ABI);
      const dest = '0x' + '33'.repeat(20);
      const value = BigInt(100);
      const func = '0x12345678';

      const callData = builder.encode('execute', [dest, value, func]);
      const decoded = builder.decode('execute', callData);

      expect(decoded[0].toLowerCase()).toBe(dest.toLowerCase());
      expect(decoded[1]).toBe(value);
      expect(decoded[2].toLowerCase()).toBe(func.toLowerCase());
    });

    it('should throw for non-existent method', () => {
      const builder = new CallDataBuilder(ERC20_ABI);

      expect(() => builder.decode('nonExistentMethod', '0x1234'))
        .toThrow('Method nonExistentMethod not found in ABI.');
    });

    it('should throw for invalid callData', () => {
      const builder = new CallDataBuilder(ERC20_ABI);

      // Invalid callData (wrong function selector)
      expect(() => builder.decode('transfer', '0x12345678'))
        .toThrow();
    });
  });

  describe('roundtrip encode/decode', () => {
    it('should roundtrip transfer', () => {
      const builder = new CallDataBuilder(ERC20_ABI);
      const originalTo = '0x' + 'ab'.repeat(20);
      const originalAmount = BigInt('123456789012345678901234567890');

      const encoded = builder.encode('transfer', [originalTo, originalAmount]);
      const decoded = builder.decode('transfer', encoded);

      expect(decoded[0].toLowerCase()).toBe(originalTo.toLowerCase());
      expect(decoded[1]).toBe(originalAmount);
    });

    it('should roundtrip executeBatch', () => {
      const builder = new CallDataBuilder(COMPLEX_ABI);
      const originalDests = ['0x' + '11'.repeat(20), '0x' + '22'.repeat(20), '0x' + '33'.repeat(20)];
      const originalValues = [BigInt(0), BigInt(1000), BigInt(2000)];
      const originalFuncs = ['0x11111111', '0x22222222', '0x33333333'];

      const encoded = builder.encode('executeBatch', [originalDests, originalValues, originalFuncs]);
      const decoded = builder.decode('executeBatch', encoded);

      expect(decoded[0].length).toBe(3);
      expect(decoded[1].length).toBe(3);
      expect(decoded[2].length).toBe(3);

      decoded[0].forEach((addr: string, i: number) => {
        expect(addr.toLowerCase()).toBe(originalDests[i].toLowerCase());
      });
      decoded[1].forEach((val: bigint, i: number) => {
        expect(val).toBe(originalValues[i]);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty bytes parameter', () => {
      const builder = new CallDataBuilder(COMPLEX_ABI);
      const dest = '0x' + '11'.repeat(20);
      const value = BigInt(0);
      const emptyFunc = '0x';

      const callData = builder.encode('execute', [dest, value, emptyFunc]);

      expect(callData).toMatch(/^0x/);
    });

    it('should handle empty arrays in batch', () => {
      const builder = new CallDataBuilder(COMPLEX_ABI);

      const callData = builder.encode('executeBatch', [[], [], []]);

      expect(callData).toMatch(/^0x/);
    });

    it('should handle checksum addresses', () => {
      const builder = new CallDataBuilder(ERC20_ABI);
      // Checksum address (mixed case)
      const checksumAddress = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B';
      const amount = BigInt(100);

      const callData = builder.encode('transfer', [checksumAddress, amount]);
      const decoded = builder.decode('transfer', callData);

      expect(decoded[0].toLowerCase()).toBe(checksumAddress.toLowerCase());
    });
  });
});
