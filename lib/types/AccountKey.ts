export const PrimitiveAccountKeyTypes = {
  keyAddress: 1,
  keySecp256k1: 2,
  keySecp256r1: 3,
  keyWebAuthn: 4,
  keyOAuthRS256: 5,
  keyZkOAuthRS256: 6,
} as const;

export const CompositeAccountKeyTypes = {
  keyMultisig: 1,
} as const;

export type AddressKeyData = {
  signerAddress: string;
};

export type Secp256k1KeyData = {
  pubkey: string;
};

export type Secp256r1KeyData = {
  pubkey: string;
};

export type WebAuthnKeyData = {
  credentialPubkey: string;
  credentialId: string;
  rpIdHash: string;
  origin: string;
  requireUV?: boolean;
};

export type OAuthRS256KeyData = {
  iss: string;
  kid: string;
  sub: string;
  email: string;
  verifyEmail: boolean;
  verifySub: boolean;
};

export type ZkOAuthRS256KeyData = {
  n: number;
  k: number;
  hAudList: string;
  commitment: string[];
  poseidonMerkleTreeDirectory: string;
};

export type KeyData =
  | AddressKeyData
  | Secp256k1KeyData
  | Secp256r1KeyData
  | WebAuthnKeyData
  | OAuthRS256KeyData
  | ZkOAuthRS256KeyData;

export type KeyInfo = {
  keyType: number;
  logicContract: string;
  weight: number;
  keyData: KeyData;
};

export type AddressKeyInfo = {
  weight: number;
  signerAddress: string;
};

export type Secp256k1KeyInfo = {
  weight: number;
  pubkey: string;
};

export type Secp256r1KeyInfo = {
  weight: number;
  pubkey: string;
};

export type WebAuthnKeyInfo = {
  weight: number;
  credentialPubkey: string;
  credentialId: string;
  rpIdHash: string;
  origin: string;
  requireUV?: boolean;
};

export type OAuthRS256KeyInfo = {
  weight: number;
  iss: string;
  kid: string;
  sub: string;
  email: string;
  verifyEmail: boolean;
  verifySub: boolean;
};

export type ZkOAuthRS256KeyInfo = {
  weight: number;
  userSpecificVk: string[];
};
