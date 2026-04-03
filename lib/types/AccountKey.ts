/**
 * Numeric identifiers for primitive (single-signer) key types supported by
 * the ZKAP account contract. Use these values when constructing `KeyInfo`
 * objects to tell the contract which verification logic to apply.
 */
export const PrimitiveAccountKeyTypes = {
  /** Plain Ethereum address used as a signer (EOA). */
  keyAddress: 1,
  /** secp256k1 raw public key (same curve as Ethereum). */
  keySecp256k1: 2,
  /** secp256r1 (P-256) raw public key, compatible with WebCrypto / Secure Enclave. */
  keySecp256r1: 3,
  /** WebAuthn credential verified on-chain. */
  keyWebAuthn: 4,
  /** RS256 JWT (OAuth) verified on-chain without a ZK proof. */
  keyOAuthRS256: 5,
  /** RS256 JWT (OAuth) verified on-chain via a zero-knowledge proof. */
  keyZkOAuthRS256: 6,
} as const;

/**
 * Numeric identifiers for composite (multi-party) key types supported by
 * the ZKAP account contract.
 */
export const CompositeAccountKeyTypes = {
  /** M-of-N multisig policy composed from multiple primitive keys. */
  keyMultisig: 1,
} as const;

/**
 * Key data for an Ethereum address key.
 * Used with `PrimitiveAccountKeyTypes.keyAddress`.
 */
export type AddressKeyData = {
  /** Checksummed Ethereum address of the authorized signer. */
  signerAddress: string;
};

/**
 * Key data for a secp256k1 public key.
 * Used with `PrimitiveAccountKeyTypes.keySecp256k1`.
 */
export type Secp256k1KeyData = {
  /** Hex-encoded compressed or uncompressed secp256k1 public key. */
  pubkey: string;
};

/**
 * Key data for a secp256r1 (P-256) public key.
 * Used with `PrimitiveAccountKeyTypes.keySecp256r1`.
 */
export type Secp256r1KeyData = {
  /** Hex-encoded compressed or uncompressed secp256r1 public key. */
  pubkey: string;
};

/**
 * Key data for a WebAuthn credential key.
 * Used with `PrimitiveAccountKeyTypes.keyWebAuthn`.
 */
export type WebAuthnKeyData = {
  /** Hex-encoded COSE-format public key extracted from the authenticator response. */
  credentialPubkey: string;
  /** Base64URL-encoded credential identifier returned by the authenticator. */
  credentialId: string;
  /** Hex-encoded SHA-256 hash of the relying-party ID (domain). */
  rpIdHash: string;
  /** The relying-party origin URL (e.g. `"https://app.example.com"`). */
  origin: string;
  /**
   * When `true`, the on-chain verifier requires that the authenticator set the
   * User Verification (UV) flag. Defaults to `false` if omitted.
   */
  requireUV?: boolean;
};

/**
 * Key data for an OAuth RS256 (JWT) key verified without a ZK proof.
 * Used with `PrimitiveAccountKeyTypes.keyOAuthRS256`.
 */
export type OAuthRS256KeyData = {
  /** JWT `iss` (issuer) claim, e.g. `"https://accounts.google.com"`. */
  iss: string;
  /** JWT `kid` (key ID) identifying the RS256 public key used to sign the token. */
  kid: string;
  /** JWT `sub` (subject) claim uniquely identifying the user at the issuer. */
  sub: string;
  /** User's email address from the JWT `email` claim. */
  email: string;
  /** When `true`, the on-chain verifier checks that the `email` claim matches. */
  verifyEmail: boolean;
  /** When `true`, the on-chain verifier checks that the `sub` claim matches. */
  verifySub: boolean;
};

/**
 * Key data for a ZK OAuth RS256 key, where JWT verification is performed
 * inside a zero-knowledge proof circuit.
 * Used with `PrimitiveAccountKeyTypes.keyZkOAuthRS256`.
 */
export type ZkOAuthRS256KeyData = {
  /** Number of limbs used to represent the RSA modulus in the ZK circuit. */
  n: number;
  /** Bit size of each limb in the ZK circuit's big-integer representation. */
  k: number;
  /** Poseidon hash of the list of allowed OAuth audience (`aud`) values. */
  hAudList: string;
  /**
   * Array of Poseidon commitment values binding the user's identity to the
   * on-chain key without revealing the raw JWT claims.
   */
  commitment: string[];
  /** On-chain address or IPFS path of the Poseidon Merkle-tree directory. */
  poseidonMerkleTreeDirectory: string;
};

/**
 * Union of all supported key data shapes.
 * Discriminate on the accompanying `keyType` field of {@link KeyInfo} to
 * determine the concrete variant.
 */
export type KeyData =
  | AddressKeyData
  | Secp256k1KeyData
  | Secp256r1KeyData
  | WebAuthnKeyData
  | OAuthRS256KeyData
  | ZkOAuthRS256KeyData;

/**
 * Full descriptor for a single key registered on a ZKAP smart account,
 * as stored in the account contract's key registry.
 */
export type KeyInfo = {
  /** Key type identifier — one of {@link PrimitiveAccountKeyTypes} or {@link CompositeAccountKeyTypes}. */
  keyType: number;
  /** Address of the on-chain logic contract that verifies signatures for this key type. */
  logicContract: string;
  /** Voting weight of this key in a multisig threshold policy. */
  weight: number;
  /** Type-specific key material — shape determined by `keyType`. */
  keyData: KeyData;
};

/**
 * Flattened key info for an Ethereum address signer, combining the
 * multisig weight with the signer address for ergonomic use in builders.
 */
export type AddressKeyInfo = {
  /** Voting weight of this key in a multisig threshold policy. */
  weight: number;
  /** Checksummed Ethereum address of the authorized signer. */
  signerAddress: string;
};

/**
 * Flattened key info for a secp256k1 public key, combining the multisig
 * weight with the raw public key for ergonomic use in builders.
 */
export type Secp256k1KeyInfo = {
  /** Voting weight of this key in a multisig threshold policy. */
  weight: number;
  /** Hex-encoded compressed or uncompressed secp256k1 public key. */
  pubkey: string;
};

/**
 * Flattened key info for a secp256r1 (P-256) public key, combining the
 * multisig weight with the raw public key for ergonomic use in builders.
 */
export type Secp256r1KeyInfo = {
  /** Voting weight of this key in a multisig threshold policy. */
  weight: number;
  /** Hex-encoded compressed or uncompressed secp256r1 public key. */
  pubkey: string;
};

/**
 * Flattened key info for a WebAuthn credential, combining the multisig
 * weight with the credential fields for ergonomic use in builders.
 */
export type WebAuthnKeyInfo = {
  /** Voting weight of this key in a multisig threshold policy. */
  weight: number;
  /** Hex-encoded COSE-format public key extracted from the authenticator response. */
  credentialPubkey: string;
  /** Base64URL-encoded credential identifier returned by the authenticator. */
  credentialId: string;
  /** Hex-encoded SHA-256 hash of the relying-party ID (domain). */
  rpIdHash: string;
  /** The relying-party origin URL (e.g. `"https://app.example.com"`). */
  origin: string;
  /**
   * When `true`, the on-chain verifier requires the UV flag from the
   * authenticator. Defaults to `false` if omitted.
   */
  requireUV?: boolean;
};

/**
 * Flattened key info for an OAuth RS256 (JWT) key verified without ZK,
 * combining the multisig weight with JWT claim fields for ergonomic use
 * in builders.
 */
export type OAuthRS256KeyInfo = {
  /** Voting weight of this key in a multisig threshold policy. */
  weight: number;
  /** JWT `iss` (issuer) claim, e.g. `"https://accounts.google.com"`. */
  iss: string;
  /** JWT `kid` (key ID) identifying the RS256 public key used to sign the token. */
  kid: string;
  /** JWT `sub` (subject) claim uniquely identifying the user at the issuer. */
  sub: string;
  /** User's email address from the JWT `email` claim. */
  email: string;
  /** When `true`, the on-chain verifier checks that the `email` claim matches. */
  verifyEmail: boolean;
  /** When `true`, the on-chain verifier checks that the `sub` claim matches. */
  verifySub: boolean;
};

/**
 * Flattened key info for a ZK OAuth RS256 key, combining the multisig
 * weight with the user-specific verifying key for ergonomic use in builders.
 */
export type ZkOAuthRS256KeyInfo = {
  /** Voting weight of this key in a multisig threshold policy. */
  weight: number;
  /**
   * User-specific verifying key (vk) elements derived from the ZK circuit,
   * used by the on-chain verifier to validate ZK proofs for this identity.
   */
  userSpecificVk: string[];
};
