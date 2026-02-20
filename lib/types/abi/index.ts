import AccountKeyAddress from "./AccountKeyAddress.json";
import AccountKeyWebAuthn from "./AccountKeyWebAuthn.json";
import AccountKeyZkOAuthRS256Verifier from "./AccountKeyZkOAuthRS256Verifier.json";
import ERC20 from "./ERC20.json";
import EntryPoint from "./EntryPoint.json";
import PoseidonMerkleTreeDirectory from "./PoseidonMerkleTreeDirectory.json";
import ZkapAccount from "./ZkapAccount.json";
import ZkapAccountFactory from "./ZkapAccountFactory.json";
import ZkapPaymaster from "./ZkapPaymaster.json";

interface HardhatArtifact {
  _format: string;
  contractName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any[];
}

// 각 Hardhat artifact JSON 에서 abi 필드만 export
export const AccountKeyAddressABI = (AccountKeyAddress as HardhatArtifact).abi;
export const AccountKeyWebAuthnABI = (AccountKeyWebAuthn as HardhatArtifact).abi;
export const AccountKeyZkOAuthRS256VerifierABI = (
  AccountKeyZkOAuthRS256Verifier as HardhatArtifact
).abi;
export const EntryPointABI = (EntryPoint as HardhatArtifact).abi;
export const PoseidonMerkleTreeDirectoryABI = (
  PoseidonMerkleTreeDirectory as HardhatArtifact
).abi;
export const ZkapAccountABI = (ZkapAccount as HardhatArtifact).abi;
export const ZkapAccountFactoryABI = (ZkapAccountFactory as HardhatArtifact).abi;
export const ZkapPaymasterABI = (ZkapPaymaster as HardhatArtifact).abi;
export const ERC20ABI = ERC20 as string[];
