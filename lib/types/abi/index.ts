import AccountKeyAddress from "./AccountKeyAddress.json";
import AccountKeyWebAuthn from "./AccountKeyWebAuthn.json";
import AccountKeyZkOAuthRS256Verifier from "./AccountKeyZkOAuthRS256Verifier.json";
import EntryPoint from "./EntryPoint.json";
import PoseidonMerkleTreeDirectory from "./PoseidonMerkleTreeDirectory.json";
import ZkapAccount from "./ZkapAccount.json";
import ZkapAccountFactory from "./ZkapAccountFactory.json";
import ZkapPaymaster from "./ZkapPaymaster.json";

// 각 Hardhat artifact JSON 에서 abi 필드만 export
export const AccountKeyAddressABI = (AccountKeyAddress as any).abi;
export const AccountKeyWebAuthnABI = (AccountKeyWebAuthn as any).abi;
export const AccountKeyZkOAuthRS256VerifierABI = (
  AccountKeyZkOAuthRS256Verifier as any
).abi;
export const EntryPointABI = (EntryPoint as any).abi;
export const PoseidonMerkleTreeDirectoryABI = (
  PoseidonMerkleTreeDirectory as any
).abi;
export const ZkapAccountABI = (ZkapAccount as any).abi;
export const ZkapAccountFactoryABI = (ZkapAccountFactory as any).abi;
export const ZkapPaymasterABI = (ZkapPaymaster as any).abi;
