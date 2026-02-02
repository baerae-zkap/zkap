/**
 * lido.ts 테스트
 *
 * Lido 스테이킹/언스테이킹 관련 함수들
 */

// Mock ethers.Contract for GetUserLidoStakingAmount tests
const mockBalanceOf = jest.fn();
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      Contract: jest.fn().mockImplementation(() => ({
        balanceOf: mockBalanceOf,
      })),
    },
  };
});

import {
  GetLidoStakingCallData,
  GetLidoRequestWithdrawalCallData,
  GetClaimWithdrawalCalldata,
  GetLidoApr,
  GetUserLidoStakingAmount,
} from '../lido';
import { ethers } from 'ethers';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('lido', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('GetLidoStakingCallData', () => {
    it('should generate callData for staking with default referral', () => {
      const callData = GetLidoStakingCallData();

      expect(callData).toMatch(/^0x/);
      // submit(address _referral) selector
      expect(callData.slice(0, 10)).toBe('0xa1903eab');
    });

    it('should generate callData for staking with custom referral', () => {
      const referral = '0x' + '11'.repeat(20);
      const callData = GetLidoStakingCallData(referral);

      expect(callData).toMatch(/^0x/);
      expect(callData.toLowerCase()).toContain(referral.slice(2).toLowerCase());
    });

    it('should produce different callData for different referrals', () => {
      const callData1 = GetLidoStakingCallData('0x' + '11'.repeat(20));
      const callData2 = GetLidoStakingCallData('0x' + '22'.repeat(20));

      expect(callData1).not.toBe(callData2);
    });
  });

  describe('GetLidoRequestWithdrawalCallData', () => {
    it('should generate callData for withdrawal request', () => {
      const amount = '1.0'; // 1 ETH
      const owner = '0x' + '11'.repeat(20);

      const callData = GetLidoRequestWithdrawalCallData(amount, owner);

      expect(callData).toMatch(/^0x/);
    });

    it('should handle decimal amounts', () => {
      const amount = '0.5'; // 0.5 ETH
      const owner = '0x' + '22'.repeat(20);

      const callData = GetLidoRequestWithdrawalCallData(amount, owner);

      expect(callData).toMatch(/^0x/);
    });

    it('should handle large amounts', () => {
      const amount = '100.0'; // 100 ETH
      const owner = '0x' + '33'.repeat(20);

      const callData = GetLidoRequestWithdrawalCallData(amount, owner);

      expect(callData).toMatch(/^0x/);
    });
  });

  describe('GetClaimWithdrawalCalldata', () => {
    it('should generate callData for claiming withdrawal', () => {
      const requestId = 123;

      const callData = GetClaimWithdrawalCalldata(requestId);

      expect(callData).toMatch(/^0x/);
    });

    it('should handle different request IDs', () => {
      const callData1 = GetClaimWithdrawalCalldata(1);
      const callData2 = GetClaimWithdrawalCalldata(999);

      expect(callData1).not.toBe(callData2);
    });

    it('should handle zero request ID', () => {
      const callData = GetClaimWithdrawalCalldata(0);

      expect(callData).toMatch(/^0x/);
    });
  });

  describe('GetLidoApr', () => {
    it('should fetch APR successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({
          data: {
            smaApr: '4.5',
          },
        }),
      });

      const apr = await GetLidoApr();

      expect(apr).toBe('4.5');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('v1/protocol/steth/apr/sma')
      );
    });

    it('should return empty string on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
      });

      const apr = await GetLidoApr();

      expect(apr).toBe('');
    });

    it('should use custom LIDO_APR_URL from env', async () => {
      const originalEnv = process.env.LIDO_APR_URL;
      process.env.LIDO_APR_URL = 'https://custom.lido.api/';

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: { smaApr: '5.0' } }),
      });

      await GetLidoApr();

      expect(mockFetch).toHaveBeenCalledWith('https://custom.lido.api/v1/protocol/steth/apr/sma');

      // Restore
      process.env.LIDO_APR_URL = originalEnv;
    });
  });

  describe('GetUserLidoStakingAmount', () => {
    beforeEach(() => {
      mockBalanceOf.mockReset();
    });

    it('should throw when LIDO_STAKING_CONTRACT is not defined', async () => {
      const originalEnv = process.env.LIDO_STAKING_CONTRACT;
      delete process.env.LIDO_STAKING_CONTRACT;

      const mockProvider = {} as ethers.JsonRpcProvider;
      const userAddress = '0x' + '11'.repeat(20);

      await expect(GetUserLidoStakingAmount(userAddress, mockProvider))
        .rejects.toThrow('LIDO_STAKING_CONTRACT is not defined');

      // Restore
      process.env.LIDO_STAKING_CONTRACT = originalEnv;
    });

    it('should return staking amount when LIDO_STAKING_CONTRACT is defined', async () => {
      const originalEnv = process.env.LIDO_STAKING_CONTRACT;
      process.env.LIDO_STAKING_CONTRACT = '0x' + 'aa'.repeat(20);

      mockBalanceOf.mockResolvedValue(BigInt('1000000000000000000')); // 1 ETH in wei

      const mockProvider = {} as ethers.JsonRpcProvider;
      const userAddress = '0x' + '11'.repeat(20);

      const result = await GetUserLidoStakingAmount(userAddress, mockProvider);

      expect(result).toBe(BigInt('1000000000000000000'));
      expect(mockBalanceOf).toHaveBeenCalledWith(userAddress);

      // Restore
      process.env.LIDO_STAKING_CONTRACT = originalEnv;
    });

    it('should use the correct contract address from env', async () => {
      const originalEnv = process.env.LIDO_STAKING_CONTRACT;
      const lidoContractAddress = '0x' + 'bb'.repeat(20);
      process.env.LIDO_STAKING_CONTRACT = lidoContractAddress;

      mockBalanceOf.mockResolvedValue(BigInt('5000000000000000000'));

      const mockProvider = {} as ethers.JsonRpcProvider;
      const userAddress = '0x' + '22'.repeat(20);

      await GetUserLidoStakingAmount(userAddress, mockProvider);

      // Verify Contract was called with correct address
      expect(ethers.Contract).toHaveBeenCalledWith(
        lidoContractAddress,
        expect.any(String),
        mockProvider
      );

      // Restore
      process.env.LIDO_STAKING_CONTRACT = originalEnv;
    });
  });
});
