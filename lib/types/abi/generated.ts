// GENERATED FILE — do not edit by hand.
// Run `node scripts/gen-abi.mjs` to regenerate from lib/types/abi/*.json.
//
// Holds only each artifact's `abi` field. Importing the .json files directly
// is deliberately avoided: native ESM requires an import attribute for JSON,
// and shipping the full Hardhat artifacts adds ~820 KB of bytecode/metadata to
// dist that no runtime code reads.

export const AccountKeyAddressABI: any[] = [
  {
    "inputs": [],
    "name": "ECDSAInvalidSignature",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "length",
        "type": "uint256"
      }
    ],
    "name": "ECDSAInvalidSignatureLength",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "s",
        "type": "bytes32"
      }
    ],
    "name": "ECDSAInvalidSignatureS",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MaxKeysExceeded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SignerCannotBeZeroAddress",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "signer",
        "type": "address"
      }
    ],
    "name": "AccountKeyAddressRegistered",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAX_KEYS_PER_ACCOUNT",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "name": "getSigner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "keyType",
    "outputs": [
      {
        "internalType": "enum IPrimitiveAccountKey.KeyType",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "bytes",
        "name": "initData",
        "type": "bytes"
      }
    ],
    "name": "register",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      }
    ],
    "name": "resetKeys",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "sig",
        "type": "bytes"
      },
      {
        "internalType": "uint256",
        "name": "msgHash",
        "type": "uint256"
      }
    ],
    "name": "validate",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export const AccountKeySecp256r1ABI: any[] = [
  {
    "inputs": [],
    "name": "InvalidKeyData",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidSValue",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidSignatureLength",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MaxKeysExceeded",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      },
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "x",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "y",
            "type": "bytes32"
          }
        ],
        "indexed": false,
        "internalType": "struct AccountKeySecp256r1.Key",
        "name": "_registeredKey",
        "type": "tuple"
      }
    ],
    "name": "AccountKeySecp256r1Registered",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAX_KEYS_PER_ACCOUNT",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "name": "getKey",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "keyType",
    "outputs": [
      {
        "internalType": "enum IPrimitiveAccountKey.KeyType",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "bytes",
        "name": "initData",
        "type": "bytes"
      }
    ],
    "name": "register",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      }
    ],
    "name": "resetKeys",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "sig",
        "type": "bytes"
      },
      {
        "internalType": "uint256",
        "name": "msgHash",
        "type": "uint256"
      }
    ],
    "name": "validate",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export const AccountKeyWebAuthnABI: any[] = [
  {
    "inputs": [],
    "name": "AuthDataTooShort",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidChallenge",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidKeyData",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidOrigin",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidRLength",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidRpId",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidSLength",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidSValue",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidWebAuthnType",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MaxKeysExceeded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SignatureTooLong",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SignatureTooShort",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SignatureTruncatedAtSLength",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SignatureTruncatedAtSValue",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UserPresenceRequired",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UserVerificationRequired",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      },
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "x",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "y",
            "type": "bytes32"
          },
          {
            "internalType": "string",
            "name": "credentialId",
            "type": "string"
          }
        ],
        "indexed": false,
        "internalType": "struct AccountKeyWebAuthn.Key",
        "name": "_key",
        "type": "tuple"
      }
    ],
    "name": "AccountKeyWebAuthnRegistered",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAX_KEYS_PER_ACCOUNT",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "name": "getKeyData",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "x",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "y",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "credentialId",
        "type": "string"
      },
      {
        "internalType": "bytes32",
        "name": "allowedOriginHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "allowedRpIdHash",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "keyType",
    "outputs": [
      {
        "internalType": "enum IPrimitiveAccountKey.KeyType",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "bytes",
        "name": "initData",
        "type": "bytes"
      }
    ],
    "name": "register",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      }
    ],
    "name": "resetKeys",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "sig",
        "type": "bytes"
      },
      {
        "internalType": "uint256",
        "name": "msgHash",
        "type": "uint256"
      }
    ],
    "name": "validate",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export const AccountKeyZkOAuthRS256VerifierABI: any[] = [
  {
    "inputs": [],
    "name": "AnchorMismatch",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidAudienceList",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidJwtExpiry",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidLhsSum",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidMerkleRoot",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidMerkleTreeDirectoryAddress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidNonce",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidProofCount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidProofK",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MaxKeysExceeded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "VerificationFailed",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256[]",
        "name": "anchor",
        "type": "uint256[]"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "hAudList",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "contract PoseidonMerkleTreeDirectory",
        "name": "directory",
        "type": "address"
      }
    ],
    "name": "ZkOAuthRS256VerifierRegistered",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAX_KEYS_PER_ACCOUNT",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "name": "getAnchor",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "name": "getCachedRoots",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "name": "getData",
    "outputs": [
      {
        "internalType": "address",
        "name": "directory",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "n",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "k",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "hAudList",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "keyType",
    "outputs": [
      {
        "internalType": "enum IPrimitiveAccountKey.KeyType",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "name": "refreshCachedRoots",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "bytes",
        "name": "initData",
        "type": "bytes"
      }
    ],
    "name": "register",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      }
    ],
    "name": "resetKeys",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IAccountKey.KeyPurpose",
        "name": "purpose",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "sig",
        "type": "bytes"
      },
      {
        "internalType": "uint256",
        "name": "msgHash",
        "type": "uint256"
      }
    ],
    "name": "validate",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export const ERC20ABI: string[] = [
  "function transfer(address to, uint256 amount)"
];

export const EntryPointABI: any[] = [
  {
    "inputs": [
      {
        "internalType": "bool",
        "name": "success",
        "type": "bool"
      },
      {
        "internalType": "bytes",
        "name": "ret",
        "type": "bytes"
      }
    ],
    "name": "DelegateAndRevert",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "opIndex",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "name": "FailedOp",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "opIndex",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "reason",
        "type": "string"
      },
      {
        "internalType": "bytes",
        "name": "inner",
        "type": "bytes"
      }
    ],
    "name": "FailedOpWithRevert",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "returnData",
        "type": "bytes"
      }
    ],
    "name": "PostOpReverted",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "SenderAddressResult",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "aggregator",
        "type": "address"
      }
    ],
    "name": "SignatureValidationFailed",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "userOpHash",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "factory",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "paymaster",
        "type": "address"
      }
    ],
    "name": "AccountDeployed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [],
    "name": "BeforeExecution",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalDeposit",
        "type": "uint256"
      }
    ],
    "name": "Deposited",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "userOpHash",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "revertReason",
        "type": "bytes"
      }
    ],
    "name": "PostOpRevertReason",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "aggregator",
        "type": "address"
      }
    ],
    "name": "SignatureAggregatorChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalStaked",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "unstakeDelaySec",
        "type": "uint256"
      }
    ],
    "name": "StakeLocked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "withdrawTime",
        "type": "uint256"
      }
    ],
    "name": "StakeUnlocked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "withdrawAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "StakeWithdrawn",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "userOpHash",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "paymaster",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "success",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "actualGasCost",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "actualGasUsed",
        "type": "uint256"
      }
    ],
    "name": "UserOperationEvent",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "userOpHash",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      }
    ],
    "name": "UserOperationPrefundTooLow",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "userOpHash",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "revertReason",
        "type": "bytes"
      }
    ],
    "name": "UserOperationRevertReason",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "withdrawAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "Withdrawn",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint32",
        "name": "unstakeDelaySec",
        "type": "uint32"
      }
    ],
    "name": "addStake",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "target",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "delegateAndRevert",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "depositTo",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "deposits",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "deposit",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "staked",
        "type": "bool"
      },
      {
        "internalType": "uint112",
        "name": "stake",
        "type": "uint112"
      },
      {
        "internalType": "uint32",
        "name": "unstakeDelaySec",
        "type": "uint32"
      },
      {
        "internalType": "uint48",
        "name": "withdrawTime",
        "type": "uint48"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "getDepositInfo",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "deposit",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "staked",
            "type": "bool"
          },
          {
            "internalType": "uint112",
            "name": "stake",
            "type": "uint112"
          },
          {
            "internalType": "uint32",
            "name": "unstakeDelaySec",
            "type": "uint32"
          },
          {
            "internalType": "uint48",
            "name": "withdrawTime",
            "type": "uint48"
          }
        ],
        "internalType": "struct IStakeManager.DepositInfo",
        "name": "info",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "internalType": "uint192",
        "name": "key",
        "type": "uint192"
      }
    ],
    "name": "getNonce",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "initCode",
        "type": "bytes"
      }
    ],
    "name": "getSenderAddress",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "sender",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "nonce",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "initCode",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "callData",
            "type": "bytes"
          },
          {
            "internalType": "bytes32",
            "name": "accountGasLimits",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "preVerificationGas",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "gasFees",
            "type": "bytes32"
          },
          {
            "internalType": "bytes",
            "name": "paymasterAndData",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "internalType": "struct PackedUserOperation",
        "name": "userOp",
        "type": "tuple"
      }
    ],
    "name": "getUserOpHash",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "components": [
              {
                "internalType": "address",
                "name": "sender",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "nonce",
                "type": "uint256"
              },
              {
                "internalType": "bytes",
                "name": "initCode",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "callData",
                "type": "bytes"
              },
              {
                "internalType": "bytes32",
                "name": "accountGasLimits",
                "type": "bytes32"
              },
              {
                "internalType": "uint256",
                "name": "preVerificationGas",
                "type": "uint256"
              },
              {
                "internalType": "bytes32",
                "name": "gasFees",
                "type": "bytes32"
              },
              {
                "internalType": "bytes",
                "name": "paymasterAndData",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "signature",
                "type": "bytes"
              }
            ],
            "internalType": "struct PackedUserOperation[]",
            "name": "userOps",
            "type": "tuple[]"
          },
          {
            "internalType": "contract IAggregator",
            "name": "aggregator",
            "type": "address"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "internalType": "struct IEntryPoint.UserOpsPerAggregator[]",
        "name": "opsPerAggregator",
        "type": "tuple[]"
      },
      {
        "internalType": "address payable",
        "name": "beneficiary",
        "type": "address"
      }
    ],
    "name": "handleAggregatedOps",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "sender",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "nonce",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "initCode",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "callData",
            "type": "bytes"
          },
          {
            "internalType": "bytes32",
            "name": "accountGasLimits",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "preVerificationGas",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "gasFees",
            "type": "bytes32"
          },
          {
            "internalType": "bytes",
            "name": "paymasterAndData",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "internalType": "struct PackedUserOperation[]",
        "name": "ops",
        "type": "tuple[]"
      },
      {
        "internalType": "address payable",
        "name": "beneficiary",
        "type": "address"
      }
    ],
    "name": "handleOps",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint192",
        "name": "key",
        "type": "uint192"
      }
    ],
    "name": "incrementNonce",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "callData",
        "type": "bytes"
      },
      {
        "components": [
          {
            "components": [
              {
                "internalType": "address",
                "name": "sender",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "nonce",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "verificationGasLimit",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "callGasLimit",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "paymasterVerificationGasLimit",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "paymasterPostOpGasLimit",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "preVerificationGas",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "paymaster",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "maxFeePerGas",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "maxPriorityFeePerGas",
                "type": "uint256"
              }
            ],
            "internalType": "struct EntryPoint.MemoryUserOp",
            "name": "mUserOp",
            "type": "tuple"
          },
          {
            "internalType": "bytes32",
            "name": "userOpHash",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "prefund",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "contextOffset",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "preOpGas",
            "type": "uint256"
          }
        ],
        "internalType": "struct EntryPoint.UserOpInfo",
        "name": "opInfo",
        "type": "tuple"
      },
      {
        "internalType": "bytes",
        "name": "context",
        "type": "bytes"
      }
    ],
    "name": "innerHandleOp",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "actualGasCost",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint192",
        "name": "",
        "type": "uint192"
      }
    ],
    "name": "nonceSequenceNumber",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unlockStake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address payable",
        "name": "withdrawAddress",
        "type": "address"
      }
    ],
    "name": "withdrawStake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address payable",
        "name": "withdrawAddress",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "withdrawAmount",
        "type": "uint256"
      }
    ],
    "name": "withdrawTo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
];

export const PoseidonMerkleTreeDirectoryABI: any[] = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_depth",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "BadIndex",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "CannotAppendAnymore",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "CommitmentAlreadyExists",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "CommitmentDoesNotExist",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "CommitmentToRemoveDoesNotExist",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidDepth",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidPubkeyHash",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "LevelOutOfBounds",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PubkeyHashAlreadyExists",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PubkeyHashDoesNotExist",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "oldLeaf",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "root",
        "type": "bytes32"
      }
    ],
    "name": "LeafDeleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "leaf",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "root",
        "type": "bytes32"
      }
    ],
    "name": "LeafInserted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "oldLeaf",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "newLeaf",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "root",
        "type": "bytes32"
      }
    ],
    "name": "LeafUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "message",
        "type": "bytes32"
      }
    ],
    "name": "LogDebug",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "ROOT_HISTORY_SIZE",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      }
    ],
    "name": "_computeMerklePath",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "_getNumLeaves",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "_getRoot",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "_nodes",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "cmExists",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "cmToIndex",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "idx",
        "type": "uint256"
      }
    ],
    "name": "deleteCm",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "root",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "level",
        "type": "uint256"
      }
    ],
    "name": "getDefaultValue",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "cm",
        "type": "bytes32"
      }
    ],
    "name": "getLeafIndex",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "pubkeyHash",
        "type": "bytes32"
      }
    ],
    "name": "getLeafIndexByPubkeyHash",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "idx",
        "type": "uint256"
      }
    ],
    "name": "getLeafNode",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "idx",
        "type": "uint256"
      }
    ],
    "name": "getMerklePath",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getNumLeaves",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRecentRoots",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "root0",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "root1",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRoot",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "indexToCm",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "indexToPubkeyHash",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "cm",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "pubkeyHash",
        "type": "bytes32"
      }
    ],
    "name": "insertCm",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "root",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "root",
        "type": "bytes32"
      }
    ],
    "name": "isRecentRoot",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "knownRootCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "latestRootIndex",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "pubkeyHashExists",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "pubkeyHashToIndex",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "rootHistory",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "idx",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "newCm",
        "type": "bytes32"
      }
    ],
    "name": "updateCm",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "root",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "idx",
        "type": "uint256"
      },
      {
        "internalType": "bytes32[]",
        "name": "merklePath",
        "type": "bytes32[]"
      },
      {
        "internalType": "bytes32",
        "name": "expectedRoot",
        "type": "bytes32"
      }
    ],
    "name": "verifyMerklePath",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export const ZkapAccountABI: any[] = [
  {
    "inputs": [
      {
        "internalType": "contract IEntryPoint",
        "name": "anEntryPoint",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "target",
        "type": "address"
      }
    ],
    "name": "AddressEmptyCode",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "CannotCallKeyProxy",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "CannotCallKeySingleton",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "CannotUpgradeViaTxKey",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "DuplicateKeyIndex",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "implementation",
        "type": "address"
      }
    ],
    "name": "ERC1967InvalidImplementation",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ERC1967NonPayable",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "error",
        "type": "bytes"
      }
    ],
    "name": "ExecuteError",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "FailedCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientMasterKeyWeight",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientTxKeyWeight",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidEntryPointAddress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidInitialization",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "KeyIndexOutOfBounds",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MasterKeyListMustNotBeEmpty",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MasterKeyLogicAddressZero",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MasterKeyThresholdMustBePositive",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MasterKeyUpdateInProgress",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "msgSender",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "entity",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "entryPoint",
        "type": "address"
      }
    ],
    "name": "NotFromEntryPoint",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotInitializing",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OnlyOwner",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TxKeyListMustNotBeEmpty",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TxKeyLogicAddressZero",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TxKeyThresholdMustBePositive",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TxKeyUpdateInProgress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UUPSUnauthorizedCallContext",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "slot",
        "type": "bytes32"
      }
    ],
    "name": "UUPSUnsupportedProxiableUUID",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "WrongArrayLengths",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "version",
        "type": "uint64"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "MasterKeyUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "TxKeyUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "implementation",
        "type": "address"
      }
    ],
    "name": "Upgraded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract IEntryPoint",
        "name": "entryPoint",
        "type": "address"
      }
    ],
    "name": "ZkapAccountInitialized",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "UPGRADE_INTERFACE_VERSION",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "addDeposit",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "entryPoint",
    "outputs": [
      {
        "internalType": "contract IEntryPoint",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "dest",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "func",
        "type": "bytes"
      }
    ],
    "name": "execute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "target",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "value",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "data",
            "type": "bytes"
          }
        ],
        "internalType": "struct BaseAccount.Call[]",
        "name": "calls",
        "type": "tuple[]"
      }
    ],
    "name": "executeBatch",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "dest",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "value",
        "type": "uint256[]"
      },
      {
        "internalType": "bytes[]",
        "name": "func",
        "type": "bytes[]"
      }
    ],
    "name": "executeBatch",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getDeposit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getNonce",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "encodedMasterKey",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "encodedTxKey",
        "type": "bytes"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_hash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "_signature",
        "type": "bytes"
      }
    ],
    "name": "isValidSignature",
    "outputs": [
      {
        "internalType": "bytes4",
        "name": "",
        "type": "bytes4"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "masterKeyList",
    "outputs": [
      {
        "internalType": "address",
        "name": "logic",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "masterKeyThreshold",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "masterKeyWeightList",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "onERC1155BatchReceived",
    "outputs": [
      {
        "internalType": "bytes4",
        "name": "",
        "type": "bytes4"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "onERC1155Received",
    "outputs": [
      {
        "internalType": "bytes4",
        "name": "",
        "type": "bytes4"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "onERC721Received",
    "outputs": [
      {
        "internalType": "bytes4",
        "name": "",
        "type": "bytes4"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "proxiableUUID",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "keyListIndex",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "isMaster",
        "type": "bool"
      }
    ],
    "name": "refreshMerkleRoots",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "txKeyList",
    "outputs": [
      {
        "internalType": "address",
        "name": "logic",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "keyId",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "txKeyThreshold",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "txKeyWeightList",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "encodedMasterKey",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "encodedTxKey",
        "type": "bytes"
      }
    ],
    "name": "updateKeys",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "encoded",
        "type": "bytes"
      }
    ],
    "name": "updateMasterKey",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "encoded",
        "type": "bytes"
      }
    ],
    "name": "updateTxKey",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newImplementation",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "upgradeToAndCall",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "sender",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "nonce",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "initCode",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "callData",
            "type": "bytes"
          },
          {
            "internalType": "bytes32",
            "name": "accountGasLimits",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "preVerificationGas",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "gasFees",
            "type": "bytes32"
          },
          {
            "internalType": "bytes",
            "name": "paymasterAndData",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "internalType": "struct PackedUserOperation",
        "name": "userOp",
        "type": "tuple"
      },
      {
        "internalType": "bytes32",
        "name": "userOpHash",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "missingAccountFunds",
        "type": "uint256"
      }
    ],
    "name": "validateUserOp",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "validationData",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address payable",
        "name": "withdrawAddress",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "withdrawDepositTo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "zkapVersion",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
];

export const ZkapAccountFactoryABI: any[] = [
  {
    "inputs": [
      {
        "internalType": "contract IEntryPoint",
        "name": "_entryPoint",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "InvalidEntryPointAddress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ACCOUNT_IMPLEMENTATION",
    "outputs": [
      {
        "internalType": "contract ZkapAccount",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "salt",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "encodedMasterKey",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "encodedTxKey",
        "type": "bytes"
      }
    ],
    "name": "calcAccountAddress",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "salt",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "encodedMasterKey",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "encodedTxKey",
        "type": "bytes"
      }
    ],
    "name": "createAccount",
    "outputs": [
      {
        "internalType": "contract ZkapAccount",
        "name": "ret",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export const ZkapPaymasterABI: any[] = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_entryPoint",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_manager",
        "type": "address"
      },
      {
        "internalType": "address[]",
        "name": "_signers",
        "type": "address[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AccessControlBadConfirmation",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "neededRole",
        "type": "bytes32"
      }
    ],
    "name": "AccessControlUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "neededRole",
        "type": "bytes32"
      }
    ],
    "name": "AccessControlUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "bundler",
        "type": "address"
      }
    ],
    "name": "BundlerNotAllowed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ECDSAInvalidSignature",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "length",
        "type": "uint256"
      }
    ],
    "name": "ECDSAInvalidSignatureLength",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "s",
        "type": "bytes32"
      }
    ],
    "name": "ECDSAInvalidSignatureS",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PaymasterAndDataLengthInvalid",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PaymasterConfigLengthInvalid",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PaymasterModeInvalid",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PaymasterSignatureLengthInvalid",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "msg",
        "type": "string"
      }
    ],
    "name": "PostOpTransferFromFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PreFundTooHigh",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TokenAddressInvalid",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TokenAmountInvalid",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "bundler",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "allowed",
        "type": "bool"
      }
    ],
    "name": "BundlerAllowlistUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "previousAdminRole",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "newAdminRole",
        "type": "bytes32"
      }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "signer",
        "type": "address"
      }
    ],
    "name": "SignerAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "signer",
        "type": "address"
      }
    ],
    "name": "SignerRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "userOpHash",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "paymasterMode",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "tokenAmount",
        "type": "uint256"
      }
    ],
    "name": "UserOperationSponsored",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "DEFAULT_ADMIN_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MANAGER_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_signer",
        "type": "address"
      }
    ],
    "name": "addSigner",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint32",
        "name": "unstakeDelaySec",
        "type": "uint32"
      }
    ],
    "name": "addStake",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "entryPoint",
    "outputs": [
      {
        "internalType": "contract IEntryPoint",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getDeposit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "_mode",
        "type": "uint8"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "sender",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "nonce",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "initCode",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "callData",
            "type": "bytes"
          },
          {
            "internalType": "bytes32",
            "name": "accountGasLimits",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "preVerificationGas",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "gasFees",
            "type": "bytes32"
          },
          {
            "internalType": "bytes",
            "name": "paymasterAndData",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "internalType": "struct PackedUserOperation",
        "name": "_userOp",
        "type": "tuple"
      }
    ],
    "name": "getHash",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "getRoleAdmin",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "bundler",
        "type": "address"
      }
    ],
    "name": "isBundlerAllowed",
    "outputs": [
      {
        "internalType": "bool",
        "name": "allowed",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum PostOpMode",
        "name": "",
        "type": "uint8"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "postOp",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_signer",
        "type": "address"
      }
    ],
    "name": "removeSigner",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "callerConfirmation",
        "type": "address"
      }
    ],
    "name": "renounceRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "signers",
    "outputs": [
      {
        "internalType": "bool",
        "name": "isValidSigner",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unlockStake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "bundlers",
        "type": "address[]"
      },
      {
        "internalType": "bool",
        "name": "allowed",
        "type": "bool"
      }
    ],
    "name": "updateBundlerAllowlist",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "sender",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "nonce",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "initCode",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "callData",
            "type": "bytes"
          },
          {
            "internalType": "bytes32",
            "name": "accountGasLimits",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "preVerificationGas",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "gasFees",
            "type": "bytes32"
          },
          {
            "internalType": "bytes",
            "name": "paymasterAndData",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "internalType": "struct PackedUserOperation",
        "name": "userOp",
        "type": "tuple"
      },
      {
        "internalType": "bytes32",
        "name": "userOpHash",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "requiredPreFund",
        "type": "uint256"
      }
    ],
    "name": "validatePaymasterUserOp",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "context",
        "type": "bytes"
      },
      {
        "internalType": "uint256",
        "name": "validationData",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address payable",
        "name": "withdrawAddress",
        "type": "address"
      }
    ],
    "name": "withdrawStake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address payable",
        "name": "withdrawAddress",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "withdrawTo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export const ZkapTimelockControllerABI: any[] = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "minDelay",
        "type": "uint256"
      },
      {
        "internalType": "address[]",
        "name": "proposers",
        "type": "address[]"
      },
      {
        "internalType": "address[]",
        "name": "executors",
        "type": "address[]"
      },
      {
        "internalType": "address",
        "name": "admin",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "treeDepth",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AccessControlBadConfirmation",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "neededRole",
        "type": "bytes32"
      }
    ],
    "name": "AccessControlUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "FailedCall",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "delay",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minDelay",
        "type": "uint256"
      }
    ],
    "name": "TimelockInsufficientDelay",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "targets",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "payloads",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "values",
        "type": "uint256"
      }
    ],
    "name": "TimelockInvalidOperationLength",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "caller",
        "type": "address"
      }
    ],
    "name": "TimelockUnauthorizedCaller",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "predecessorId",
        "type": "bytes32"
      }
    ],
    "name": "TimelockUnexecutedPredecessor",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "operationId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "expectedStates",
        "type": "bytes32"
      }
    ],
    "name": "TimelockUnexpectedOperationState",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "target",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "CallExecuted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "salt",
        "type": "bytes32"
      }
    ],
    "name": "CallSalt",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "target",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "predecessor",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "delay",
        "type": "uint256"
      }
    ],
    "name": "CallScheduled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "name": "Cancelled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "oldDuration",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newDuration",
        "type": "uint256"
      }
    ],
    "name": "MinDelayChange",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "previousAdminRole",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "newAdminRole",
        "type": "bytes32"
      }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleRevoked",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "CANCELLER_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "DEFAULT_ADMIN_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "EXECUTOR_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "PROPOSER_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "name": "cancel",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "directory",
    "outputs": [
      {
        "internalType": "contract PoseidonMerkleTreeDirectory",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "target",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "payload",
        "type": "bytes"
      },
      {
        "internalType": "bytes32",
        "name": "predecessor",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "salt",
        "type": "bytes32"
      }
    ],
    "name": "execute",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "targets",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "values",
        "type": "uint256[]"
      },
      {
        "internalType": "bytes[]",
        "name": "payloads",
        "type": "bytes[]"
      },
      {
        "internalType": "bytes32",
        "name": "predecessor",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "salt",
        "type": "bytes32"
      }
    ],
    "name": "executeBatch",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getMinDelay",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "name": "getOperationState",
    "outputs": [
      {
        "internalType": "enum TimelockController.OperationState",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "getRoleAdmin",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "name": "getTimestamp",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "target",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      },
      {
        "internalType": "bytes32",
        "name": "predecessor",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "salt",
        "type": "bytes32"
      }
    ],
    "name": "hashOperation",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "targets",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "values",
        "type": "uint256[]"
      },
      {
        "internalType": "bytes[]",
        "name": "payloads",
        "type": "bytes[]"
      },
      {
        "internalType": "bytes32",
        "name": "predecessor",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "salt",
        "type": "bytes32"
      }
    ],
    "name": "hashOperationBatch",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "name": "isOperation",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "name": "isOperationDone",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "name": "isOperationPending",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "name": "isOperationReady",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "onERC1155BatchReceived",
    "outputs": [
      {
        "internalType": "bytes4",
        "name": "",
        "type": "bytes4"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "onERC1155Received",
    "outputs": [
      {
        "internalType": "bytes4",
        "name": "",
        "type": "bytes4"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "onERC721Received",
    "outputs": [
      {
        "internalType": "bytes4",
        "name": "",
        "type": "bytes4"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "callerConfirmation",
        "type": "address"
      }
    ],
    "name": "renounceRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "target",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      },
      {
        "internalType": "bytes32",
        "name": "predecessor",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "salt",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "delay",
        "type": "uint256"
      }
    ],
    "name": "schedule",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "targets",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "values",
        "type": "uint256[]"
      },
      {
        "internalType": "bytes[]",
        "name": "payloads",
        "type": "bytes[]"
      },
      {
        "internalType": "bytes32",
        "name": "predecessor",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "salt",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "delay",
        "type": "uint256"
      }
    ],
    "name": "scheduleBatch",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "newDelay",
        "type": "uint256"
      }
    ],
    "name": "updateDelay",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
];
