# ZKAP AA SDK - Project Context Cache

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           zkap-aa-sdk                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐      │
│  │   Signers   │     │    Builders     │     │     Accounts     │      │
│  ├─────────────┤     ├─────────────────┤     ├──────────────────┤      │
│  │ PasskeySigner│────▶│  ZkapBuilder    │────▶│   ZkapAccount    │      │
│  │ZkPasskeySigner│   │                 │     │                  │      │
│  │ ZkOidcSigner │    │ CallDataBuilder │     │   BaseAccount    │      │
│  │AddressKeySigner│  │ AccountKeyBuilder│    │                  │      │
│  └──────┬──────┘     │ SwapBuilder     │     └────────┬─────────┘      │
│         │            │ ZkapCreator     │              │                 │
│         │            │ZkapFactoryBuilder│             │                 │
│         │            └────────┬────────┘              │                 │
│         │                     │                       │                 │
│         ▼                     ▼                       ▼                 │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                     IUserOpSigner Interface                   │      │
│  │  signUserOpHash(hash: string): Promise<string[]>              │      │
│  │  keyTypes: number[]                                           │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                 │                                       │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                      UserOperation                            │      │
│  │  sender, nonce, initCode, callData, gas limits, signature     │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                 │                                       │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                      EntryPoint (ERC-4337)                    │      │
│  │  handleOps() → 스마트 지갑 트랜잭션 실행                        │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                    PaymasterService                          │       │
│  │  Gas 대납 서비스 (Verifying Paymaster / ERC20 Paymaster)      │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Entry Points

| Entry Point | File | Purpose |
|-------------|------|---------|
| SDK Export | `lib/index.ts` | 모든 public API export |
| Builder Main | `lib/builders/ZkapBuilder.ts` | UserOp 생성의 핵심 |
| Signer Interface | `lib/utils/IUserOpSigner.ts` | Signer 구현 계약 |
| Types | `lib/types/AccountKey.ts` | 키 타입 상수 정의 |
| ABI | `lib/resources/abis.ts` | 컨트랙트 ABI 문자열 |

## Common Patterns

### Pattern 1: 새 Signer 추가
```typescript
// lib/signers/NewSigner.ts
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";

export class NewSigner implements IUserOpSigner {
  public keyTypes: number[] = [PrimitiveAccountKeyTypes.keyXXX];

  async signUserOpHash(userOpHash: string): Promise<string[]> {
    // 서명 로직 구현
    return [encodedSignature];
  }
}

// lib/index.ts에 export 추가
export { NewSigner } from "./signers/NewSigner";
```

### Pattern 2: Builder 메서드 체이닝
```typescript
const builder = new ZkapBuilder(config)
  .setSender(address)
  .setExecuteCallData(to, value, data)
  .setSignerKeyTypes([PrimitiveAccountKeyTypes.keyWebAuthn]);

await builder.autoFillUserOp();
const userOp = builder.getUserOp();
const hash = builder.getUserOpHash();
```

### Pattern 3: Paymaster 통합
```typescript
const builder = new ZkapBuilder({
  chainId,
  entryPoint,
  enUrl,
  paymaster: {
    serverUrl: "https://paymaster.example.com",
    paymasterAddress: "0x...",
    chainId,
    mode: "verifying" // or "erc20"
  }
});
// autoFillUserOp()가 paymaster 데이터 자동 설정
```

## Gas Estimation Constants

| Key Type | Gas (verification) | File Reference |
|----------|-------------------|----------------|
| keyAddress | 15,000 | `ZkapBuilder.ts:262` |
| keyWebAuthn | 470,000 | `ZkapBuilder.ts:263` |
| keyZkOAuthRS256 | 340,000 | `ZkapBuilder.ts:264` |

## File Dependencies Graph

```
index.ts
├── types/UserOperation.ts
├── types/AccountKey.ts
├── types/jwk.ts
├── types/Swap.ts
├── types/abi/index.ts
├── account/BaseAccount.ts
├── account/ZkapAccount.ts
│   └── utils/IUserOpSigner.ts
├── builders/BaseAccountBuilder.ts
├── builders/ZkapBuilder.ts
│   ├── BaseAccountBuilder.ts
│   ├── CallDataBuilder.ts
│   ├── utils/PaymasterService.ts
│   └── resources/abis.ts
├── builders/ZkapCreator.ts
├── builders/ZkapFactoryBuilder.ts
├── builders/SwapBuilder.ts
├── builders/aggregators/OneInchAggregator.ts
├── signers/AddressKeySigner.ts
├── signers/PasskeySigner.ts
│   └── utils/signature.ts
├── signers/ZkPasskeySigner.ts
├── signers/ZkOidcSigner.ts
├── utils/crypto.ts
├── utils/signature.ts
├── utils/base64url.ts
└── resources/abis.ts
```

## Related Contract ABIs

| Contract | ABI Location | Purpose |
|----------|--------------|---------|
| ZkapAccount | `lib/types/abi/ZkapAccount.json` | 스마트 지갑 |
| ZkapAccountFactory | `lib/types/abi/ZkapAccountFactory.json` | 지갑 생성 |
| EntryPoint | `lib/types/abi/EntryPoint.json` | ERC-4337 진입점 |
| ZkOAuthVerifier | `lib/types/abi/ZkOAuthVerifier.json` | ZK 증명 검증 |

## Version History (Recent)

| Version | Key Changes |
|---------|-------------|
| 0.0.22 | Current |
| Recent | ZK-OIDC Signer 추가, ABI 업데이트, Paymaster ERC20 모드 |
