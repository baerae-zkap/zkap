// Contract ABIs, re-exported from the generated module.
//
// The Hardhat artifacts in this directory are the synced source of truth, but
// they are not imported at runtime: native ESM requires an import attribute for
// JSON, and shipping the full artifacts puts ~820 KB of unused bytecode and
// metadata into dist. `scripts/gen-abi.mjs` extracts just the `abi` fields into
// ./generated.ts.
export {
  AccountKeyAddressABI,
  AccountKeySecp256r1ABI,
  AccountKeyWebAuthnABI,
  AccountKeyZkOAuthRS256VerifierABI,
  ERC20ABI,
  EntryPointABI,
  PoseidonMerkleTreeDirectoryABI,
  ZkapAccountABI,
  ZkapAccountFactoryABI,
  ZkapPaymasterABI,
  ZkapTimelockControllerABI,
} from "./generated";
