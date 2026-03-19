export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  entryPoint: string;
  zkapFactory: string;
  bundlerUrl: string;
  poseidonMerkleTreeDirectory: string;
  contracts: {
    zkOAuthVerifier1of1: string;
    zkOAuthVerifier3of3: string;
    hAudLists: string;
    hAudLists1: string;
  };
}

interface CacheEntry {
  config: ChainConfig;
  expiresAt: number;
}

const DEFAULT_API_URL = "https://api.zkap.app";
const DEFAULT_CACHE_TTL_MS = 300000; // 5 minutes

export class ChainRegistry {
  private readonly apiUrl: string;
  private readonly cacheTtlMs: number;
  private cache: Map<number, CacheEntry> = new Map();
  private allChainsCache: { configs: ChainConfig[]; expiresAt: number } | null = null;

  constructor(config?: { apiUrl?: string; cacheTtlMs?: number }) {
    this.apiUrl = (config && config.apiUrl) ? config.apiUrl.replace(/\/$/, "") : DEFAULT_API_URL;
    this.cacheTtlMs = (config && config.cacheTtlMs != null) ? config.cacheTtlMs : DEFAULT_CACHE_TTL_MS;
  }

  async getChainConfig(chainId: number): Promise<ChainConfig> {
    const cached = this.cache.get(chainId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.config;
    }

    const url = `${this.apiUrl}/api/v1/chains/${chainId}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new Error(
        `ChainRegistry: network error fetching chainId ${chainId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!res.ok) {
      throw new Error(`ChainRegistry: failed to fetch chainId ${chainId} (HTTP ${res.status})`);
    }

    const data = await res.json() as Record<string, unknown>;
    const chainConfig = this._parseChainConfig(data);

    this.cache.set(chainId, {
      config: chainConfig,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return chainConfig;
  }

  async getSupportedChains(): Promise<ChainConfig[]> {
    if (this.allChainsCache && Date.now() < this.allChainsCache.expiresAt) {
      return this.allChainsCache.configs;
    }

    const url = `${this.apiUrl}/api/v1/chains`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new Error(
        `ChainRegistry: network error fetching supported chains: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!res.ok) {
      throw new Error(`ChainRegistry: failed to fetch supported chains (HTTP ${res.status})`);
    }

    const data = await res.json() as Record<string, unknown> | unknown[];
    const list: unknown[] = Array.isArray(data) ? data : ((data as Record<string, unknown>).chains || (data as Record<string, unknown>).data || []) as unknown[];
    const configs = list.map((item) => this._parseChainConfig(item as Record<string, unknown>));

    this.allChainsCache = {
      configs,
      expiresAt: Date.now() + this.cacheTtlMs,
    };

    // Populate per-chain cache as well
    for (const cfg of configs) {
      this.cache.set(cfg.chainId, {
        config: cfg,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }

    return configs;
  }

  refresh(): void {
    this.cache.clear();
    this.allChainsCache = null;
  }

  private _parseChainConfig(data: Record<string, unknown>): ChainConfig {
    // Support both flat and nested contract shapes from the API
    const contracts = (data.contracts as Record<string, string>) || {};

    const chainId = Number(data.chainId);
    const rpcUrl = String(data.rpcUrl || "");
    const entryPoint = String(data.entryPoint || data.entrypoint || "");
    const zkapFactory = String(data.zkapFactory || data.factory || "");

    if (!chainId || isNaN(chainId)) {
      throw new Error(`ChainRegistry: invalid or missing chainId in API response: ${JSON.stringify(data.chainId)}`);
    }
    if (!rpcUrl) {
      throw new Error(`ChainRegistry: missing rpcUrl for chainId ${chainId}`);
    }
    if (!entryPoint) {
      throw new Error(`ChainRegistry: missing entryPoint for chainId ${chainId}`);
    }
    if (!zkapFactory) {
      throw new Error(`ChainRegistry: missing zkapFactory for chainId ${chainId}`);
    }

    return {
      chainId,
      name: String(data.name || ""),
      rpcUrl,
      entryPoint,
      zkapFactory,
      bundlerUrl: String(data.bundlerUrl || ""),
      poseidonMerkleTreeDirectory: String(
        data.poseidonMerkleTreeDirectory || contracts.poseidonMerkleTreeDirectory || ""
      ),
      contracts: {
        zkOAuthVerifier1of1: String(contracts.zkOAuthVerifier1of1 || data.zkOAuthVerifier1of1 || ""),
        zkOAuthVerifier3of3: String(contracts.zkOAuthVerifier3of3 || data.zkOAuthVerifier3of3 || ""),
        hAudLists: String(contracts.hAudLists || data.hAudLists || ""),
        hAudLists1: String(contracts.hAudLists1 || data.hAudLists1 || ""),
      },
    };
  }
}
