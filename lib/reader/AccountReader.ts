import { ethers } from "ethers";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";

export type KeyType = "webauthn" | "zkOAuth" | "address" | "secp256k1" | "secp256r1" | "oauthRs256" | "unknown";

export interface WebAuthnKeyData {
  x: string;
  y: string;
  credentialId: string;
  allowedOriginHash: string;
  allowedRpIdHash: string;
}

export interface TxKeyInfo {
  index: number;
  logicContract: string;
  keyId: number;
  keyType: KeyType;
  webauthn?: WebAuthnKeyData;
}

export interface MasterKeyInfo {
  threshold: number;
  keyCount: number;
  is3of3: boolean;
  anchor: string[];
  verifierAddress: string;
}

// Minimal ABI fragments for reading ZkapAccount state
const ZKAP_ACCOUNT_ABI = [
  "function txKeyList(uint256 index) view returns (address logic, uint256 keyId)",
  "function txKeyThreshold() view returns (uint8)",
  "function masterKeyThreshold() view returns (uint8)",
  "function txKeyWeightList(uint256 index) view returns (uint8)",
  "function masterKeyList(uint256 index) view returns (address logic, uint256 keyId)",
];

// WebAuthn singleton ABI (AccountKeyWebAuthn)
// KeyPurpose: Master=0, Tx=1
const WEBAUTHN_KEY_ABI = [
  "function getKeyData(uint8 purpose, address account, uint256 keyId) view returns (bytes32 x, bytes32 y, string credentialId, bytes32 allowedOriginHash, bytes32 allowedRpIdHash)",
];

// ZkOAuth verifier ABI
const ZK_OAUTH_VERIFIER_ABI = [
  "function getAnchor(uint256 keyId) view returns (uint256[] anchor)",
  "function getData(uint256 keyId) view returns (uint256 n, uint256 k, uint256 hAudList, uint256[] anchor)",
];

function keyTypeFromPrimitive(keyType: number): KeyType {
  switch (keyType) {
    case PrimitiveAccountKeyTypes.keyAddress: return "address";
    case PrimitiveAccountKeyTypes.keySecp256k1: return "secp256k1";
    case PrimitiveAccountKeyTypes.keySecp256r1: return "secp256r1";
    case PrimitiveAccountKeyTypes.keyWebAuthn: return "webauthn";
    case PrimitiveAccountKeyTypes.keyOAuthRS256: return "oauthRs256";
    case PrimitiveAccountKeyTypes.keyZkOAuthRS256: return "zkOAuth";
    default: return "unknown";
  }
}

// Attempt to detect key type by calling a type() or keyType() function on the logic contract.
// Falls back to "unknown" on error.
const KEY_TYPE_DETECTOR_ABI = [
  "function keyType() view returns (uint8)",
];

export class AccountReader {
  private readonly provider: ethers.JsonRpcProvider;

  constructor(config: { rpcUrl: string }) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  async isDeployed(address: string): Promise<boolean> {
    const code = await this.provider.getCode(address);
    return code !== "0x";
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return balance.toString();
  }

  async getTxKeyList(address: string): Promise<TxKeyInfo[]> {
    const account = new ethers.Contract(address, ZKAP_ACCOUNT_ABI, this.provider);
    const result: TxKeyInfo[] = [];

    const MAX_TX_KEYS = 5;
    for (let i = 0; i < MAX_TX_KEYS; i++) {
      let logic: string;
      let keyId: bigint;
      try {
        const entry = await account.txKeyList(i);
        logic = entry[0] as string;
        keyId = entry[1] as bigint;
      } catch {
        // No more entries (reverts when out of bounds)
        break;
      }

      if (!logic || logic === ethers.ZeroAddress) {
        break;
      }

      // Detect key type from logic contract
      const keyType = await this._detectKeyType(logic);
      const info: TxKeyInfo = {
        index: i,
        logicContract: logic,
        keyId: Number(keyId),
        keyType,
      };

      if (keyType === "webauthn") {
        try {
          const webauthnContract = new ethers.Contract(logic, WEBAUTHN_KEY_ABI, this.provider);
          // KeyPurpose.Tx = 1; pass account address so the singleton can look up the correct slot
          const kd = await webauthnContract.getKeyData(1, address, keyId);
          info.webauthn = {
            x: kd[0] as string,
            y: kd[1] as string,
            credentialId: kd[2] as string,
            allowedOriginHash: kd[3] as string,
            allowedRpIdHash: kd[4] as string,
          };
        } catch {
          // getKeyData not available or failed — leave webauthn undefined
        }
      }

      result.push(info);
    }

    return result;
  }

  async getMasterKeyInfo(address: string): Promise<MasterKeyInfo> {
    const account = new ethers.Contract(address, ZKAP_ACCOUNT_ABI, this.provider);

    let logic: string;
    let keyId: bigint;
    try {
      const entry = await account.masterKeyList(0);
      logic = entry[0] as string;
      keyId = entry[1] as bigint;
    } catch {
      throw new Error(`AccountReader: failed to read masterKeyList(0) for ${address}`);
    }

    let threshold = 1;
    try {
      const t = await account.masterKeyThreshold();
      threshold = Number(t);
    } catch {
      // ignore, default 1
    }

    // Count master keys and detect 3-of-3
    let keyCount = 1;
    const anchorList: string[] = [];
    // Attempt to read anchor data from the verifier
    try {
      const verifierContract = new ethers.Contract(logic, ZK_OAUTH_VERIFIER_ABI, this.provider);
      const data = await verifierContract.getData(keyId);
      const anchor: bigint[] = data[3];
      for (const a of anchor) {
        anchorList.push(a.toString());
      }
      // Infer 3-of-3 from anchor count
      if (anchor.length >= 3) {
        keyCount = 3;
      }
    } catch {
      // Verifier doesn't support getData, try getAnchor
      try {
        const verifierContract = new ethers.Contract(logic, ZK_OAUTH_VERIFIER_ABI, this.provider);
        const anchor: bigint[] = await verifierContract.getAnchor(keyId);
        for (const a of anchor) {
          anchorList.push(a.toString());
        }
        if (anchor.length >= 3) {
          keyCount = 3;
        }
      } catch {
        // Not available
      }
    }

    return {
      threshold,
      keyCount,
      is3of3: keyCount >= 3,
      anchor: anchorList,
      verifierAddress: logic,
    };
  }

  private async _detectKeyType(logicAddress: string): Promise<KeyType> {
    try {
      const contract = new ethers.Contract(logicAddress, KEY_TYPE_DETECTOR_ABI, this.provider);
      const kt = await contract.keyType();
      return keyTypeFromPrimitive(Number(kt));
    } catch {
      return "unknown";
    }
  }
}
