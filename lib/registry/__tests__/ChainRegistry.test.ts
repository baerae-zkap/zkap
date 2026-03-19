/**
 * ChainRegistry 테스트
 */

import { ChainRegistry } from '../ChainRegistry';
import type { ChainConfig } from '../ChainRegistry';

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApiChain(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    chainId: 42161,
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

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  };
}

function errorResponse(status: number) {
  return { ok: false, status, text: () => Promise.resolve('Not Found') };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChainRegistry', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('uses default API URL when no config provided', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(makeApiChain()));
      const registry = new ChainRegistry();
      await registry.getChainConfig(42161);
      expect(mockFetch).toHaveBeenCalledWith('https://api.zkap.app/api/v1/chains/42161');
    });

    it('uses custom apiUrl from config', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(makeApiChain()));
      const registry = new ChainRegistry({ apiUrl: 'https://custom.api.example.com' });
      await registry.getChainConfig(42161);
      expect(mockFetch).toHaveBeenCalledWith('https://custom.api.example.com/api/v1/chains/42161');
    });

    it('strips trailing slash from custom apiUrl', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(makeApiChain()));
      const registry = new ChainRegistry({ apiUrl: 'https://custom.api.example.com/' });
      await registry.getChainConfig(42161);
      expect(mockFetch).toHaveBeenCalledWith('https://custom.api.example.com/api/v1/chains/42161');
    });
  });

  describe('getChainConfig', () => {
    it('fetches chain config from API and returns parsed ChainConfig', async () => {
      const apiData = makeApiChain();
      mockFetch.mockResolvedValueOnce(okResponse(apiData));

      const registry = new ChainRegistry();
      const config = await registry.getChainConfig(42161);

      expect(config.chainId).toBe(42161);
      expect(config.name).toBe('Arbitrum');
      expect(config.rpcUrl).toBe('https://arb1.arbitrum.io/rpc');
      expect(config.entryPoint).toBeTruthy();
      expect(config.zkapFactory).toBeTruthy();
    });

    it('returns cached value on second call within TTL', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(makeApiChain()));

      const registry = new ChainRegistry({ cacheTtlMs: 60000 });
      const first = await registry.getChainConfig(42161);
      const second = await registry.getChainConfig(42161);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(second).toBe(first); // same object reference
    });

    it('re-fetches after TTL expires', async () => {
      mockFetch.mockResolvedValue(okResponse(makeApiChain()));

      const registry = new ChainRegistry({ cacheTtlMs: 1 }); // 1ms TTL
      await registry.getChainConfig(42161);
      await new Promise((r) => setTimeout(r, 10)); // wait for TTL
      await registry.getChainConfig(42161);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404));

      const registry = new ChainRegistry();
      await expect(registry.getChainConfig(99999))
        .rejects.toThrow('ChainRegistry: failed to fetch chainId 99999 (HTTP 404)');
    });

    it('throws on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const registry = new ChainRegistry();
      await expect(registry.getChainConfig(42161))
        .rejects.toThrow('ChainRegistry: network error fetching chainId 42161');
    });

    it('throws on missing rpcUrl', async () => {
      const data = makeApiChain({ rpcUrl: '' });
      mockFetch.mockResolvedValueOnce(okResponse(data));

      const registry = new ChainRegistry();
      await expect(registry.getChainConfig(42161))
        .rejects.toThrow('ChainRegistry: missing rpcUrl for chainId 42161');
    });

    it('throws on missing entryPoint', async () => {
      const data = makeApiChain({ entryPoint: '', entrypoint: '' });
      mockFetch.mockResolvedValueOnce(okResponse(data));

      const registry = new ChainRegistry();
      await expect(registry.getChainConfig(42161))
        .rejects.toThrow('ChainRegistry: missing entryPoint for chainId 42161');
    });

    it('throws on missing zkapFactory', async () => {
      const data = makeApiChain({ zkapFactory: '', factory: '' });
      mockFetch.mockResolvedValueOnce(okResponse(data));

      const registry = new ChainRegistry();
      await expect(registry.getChainConfig(42161))
        .rejects.toThrow('ChainRegistry: missing zkapFactory for chainId 42161');
    });

    it('accepts entrypoint (lowercase) as alias for entryPoint', async () => {
      const data = makeApiChain({ entryPoint: undefined, entrypoint: '0x' + '5F'.repeat(20) });
      mockFetch.mockResolvedValueOnce(okResponse(data));

      const registry = new ChainRegistry();
      const config = await registry.getChainConfig(42161);
      expect(config.entryPoint).toBeTruthy();
    });

    it('accepts factory as alias for zkapFactory', async () => {
      const data = makeApiChain({ zkapFactory: undefined, factory: '0x' + 'AB'.repeat(20) });
      mockFetch.mockResolvedValueOnce(okResponse(data));

      const registry = new ChainRegistry();
      const config = await registry.getChainConfig(42161);
      expect(config.zkapFactory).toBeTruthy();
    });

    it('throws on invalid/missing chainId in response', async () => {
      const data = makeApiChain({ chainId: 0 });
      mockFetch.mockResolvedValueOnce(okResponse(data));

      const registry = new ChainRegistry();
      await expect(registry.getChainConfig(0))
        .rejects.toThrow('ChainRegistry: invalid or missing chainId in API response');
    });
  });

  describe('refresh', () => {
    it('clears cache so next call re-fetches', async () => {
      mockFetch.mockResolvedValue(okResponse(makeApiChain()));

      const registry = new ChainRegistry({ cacheTtlMs: 60000 });
      await registry.getChainConfig(42161);

      registry.refresh();
      await registry.getChainConfig(42161);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('clears allChains cache as well', async () => {
      mockFetch.mockResolvedValue(okResponse([makeApiChain()]));

      const registry = new ChainRegistry({ cacheTtlMs: 60000 });
      await registry.getSupportedChains();

      registry.refresh();
      await registry.getSupportedChains();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSupportedChains', () => {
    it('fetches all chains from /api/v1/chains', async () => {
      const chains = [makeApiChain(), makeApiChain({ chainId: 8217, name: 'Kaia' })];
      mockFetch.mockResolvedValueOnce(okResponse(chains));

      const registry = new ChainRegistry();
      const result = await registry.getSupportedChains();

      expect(result).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith('https://api.zkap.app/api/v1/chains');
    });

    it('returns cached value on second call within TTL', async () => {
      mockFetch.mockResolvedValueOnce(okResponse([makeApiChain()]));

      const registry = new ChainRegistry({ cacheTtlMs: 60000 });
      const first = await registry.getSupportedChains();
      const second = await registry.getSupportedChains();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
    });

    it('populates per-chain cache from getSupportedChains result', async () => {
      mockFetch.mockResolvedValueOnce(okResponse([makeApiChain()]));

      const registry = new ChainRegistry({ cacheTtlMs: 60000 });
      await registry.getSupportedChains();
      // Second call should use per-chain cache, no new fetch
      await registry.getChainConfig(42161);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('accepts chains wrapped in .chains key', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ chains: [makeApiChain()] }));

      const registry = new ChainRegistry();
      const result = await registry.getSupportedChains();
      expect(result).toHaveLength(1);
    });

    it('accepts chains wrapped in .data key', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ data: [makeApiChain()] }));

      const registry = new ChainRegistry();
      const result = await registry.getSupportedChains();
      expect(result).toHaveLength(1);
    });

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500));

      const registry = new ChainRegistry();
      await expect(registry.getSupportedChains())
        .rejects.toThrow('ChainRegistry: failed to fetch supported chains (HTTP 500)');
    });

    it('throws on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('timeout'));

      const registry = new ChainRegistry();
      await expect(registry.getSupportedChains())
        .rejects.toThrow('ChainRegistry: network error fetching supported chains');
    });
  });
});
