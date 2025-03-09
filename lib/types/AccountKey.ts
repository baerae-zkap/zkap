export const PrimitiveAccountKeyTypes = {
  keyAddress: 1,
  keySecp256k1: 2,
  keySecp256r1: 3,
  keyWebAuthn: 4,
  keyOAuthRS256: 5,
};

export const CompositeAccountKeyTypes = {
  keyMultisig: 1,
};

export type KeyInfo = {
  keyType: number;
  weight: number;
  keyData: string;
};
