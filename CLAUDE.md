# ZKAP AA SDK - Claude Code Instructions

## Quick Overview
ERC-4337 Account Abstraction SDK for ZKAP smart wallets. Supports WebAuthn (Passkey), ZK-OIDC, and address-based signers with paymaster integration.

## Core Flows

| Feature | Key Files | Description |
|---------|-----------|-------------|
| **UserOp Builder** | `lib/builders/ZkapBuilder.ts` | UserOperation 생성 및 gas 자동 추정 |
| **Account Factory** | `lib/builders/ZkapFactoryBuilder.ts`, `ZkapCreator.ts` | 스마트 지갑 생성 |
| **Passkey Signing** | `lib/signers/PasskeySigner.ts`, `ZkPasskeySigner.ts` | WebAuthn 기반 서명 |
| **ZK-OIDC Signing** | `lib/signers/ZkOidcSigner.ts` | ZK 증명 기반 OAuth 서명 |
| **Paymaster** | `lib/utils/PaymasterService.ts` | Gas 대납 기능 |
| **CallData** | `lib/builders/CallDataBuilder.ts` | 트랜잭션 데이터 인코딩 |
| **Types** | `lib/types/AccountKey.ts`, `UserOperation.ts` | 핵심 타입 정의 |

## Architecture

```
lib/
├── account/          # Account 클래스 (ZkapAccount, BaseAccount)
├── builders/         # Builder 패턴 (ZkapBuilder, CallDataBuilder, ...)
│   └── aggregators/  # DEX Aggregator (1inch)
├── signers/          # Signer 구현체 (Passkey, ZkOidc, Address)
├── types/            # TypeScript 타입 정의
│   └── abi/          # Contract ABI JSON
├── utils/            # 유틸리티 (crypto, signature, base64url)
└── resources/        # ABI 문자열 상수
```

## Development Commands

```bash
# Build
yarn build          # TypeScript 컴파일 (dist/ 생성)

# Publish
yarn pub            # Private npm registry에 배포

# Type Check (빌드 없이)
npx tsc --noEmit
```

## Key Types

### Account Key Types (`lib/types/AccountKey.ts`)
| Type | Value | Description |
|------|-------|-------------|
| `keyAddress` | 1 | EOA 주소 기반 |
| `keySecp256k1` | 2 | secp256k1 공개키 |
| `keySecp256r1` | 3 | secp256r1 공개키 |
| `keyWebAuthn` | 4 | Passkey (WebAuthn) |
| `keyOAuthRS256` | 5 | OAuth RS256 |
| `keyZkOAuthRS256` | 6 | ZK-OAuth RS256 |

### Signer Interface (`lib/utils/IUserOpSigner.ts`)
새로운 Signer 추가 시 `IUserOpSigner` 인터페이스 구현 필요:
```typescript
interface IUserOpSigner {
  keyTypes: number[];
  signUserOpHash(userOpHash: string): Promise<string[]>;
}
```

## Permissions

### Allowed
- `lib/**/*.ts` 수정
- 새 Signer/Builder 추가
- ABI JSON 업데이트 (`lib/types/abi/`)
- 테스트 코드 작성

### Prohibited
- `.npmrc` 수정 (인증 정보 포함)
- `publish.sh` 직접 실행
- `dist/` 직접 수정 (빌드 결과물)
- Breaking changes without version bump

## Common Patterns

### 새 Signer 추가
1. `lib/signers/` 에 새 클래스 파일 생성
2. `IUserOpSigner` 인터페이스 구현
3. `keyTypes` 배열에 지원하는 키 타입 설정
4. `signUserOpHash()` 메서드 구현
5. `lib/index.ts` 에서 export

### ZkapBuilder 사용 흐름
```typescript
const builder = new ZkapBuilder({ chainId, entryPoint, enUrl, paymaster });
builder
  .setSender(address)
  .setExecuteCallData(to, value, data)
  .setSignerKeyTypes([PrimitiveAccountKeyTypes.keyWebAuthn]);
await builder.autoFillUserOp();
const userOp = builder.getUserOp();
```

## Dependencies
- `ethers@^6.13.5` - Ethereum 상호작용
- `jwt-decode@^4.0.0` - JWT 파싱
- `@levischuck/tiny-cbor@^0.2.11` - CBOR 인코딩

## Notes
- `strictNullChecks: false` 설정됨 - null 체크 완화
- CommonJS 모듈 시스템 사용
- Private npm registry: `asia-northeast3-npm.pkg.dev/zkap-dev/zkap-npm-packages/`
