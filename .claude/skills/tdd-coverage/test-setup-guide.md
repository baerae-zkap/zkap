# 테스트 환경 설정 가이드

## 1. 의존성 설치

```bash
yarn add -D jest ts-jest @types/jest
```

## 2. package.json 스크립트 추가

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --coverageReporters=text-summary"
  }
}
```

## 3. 디렉토리 구조

```
lib/
├── signers/
│   ├── PasskeySigner.ts
│   ├── ZkOidcSigner.ts
│   └── __tests__/
│       ├── PasskeySigner.test.ts
│       └── ZkOidcSigner.test.ts
├── builders/
│   ├── ZkapBuilder.ts
│   └── __tests__/
│       └── ZkapBuilder.test.ts
├── utils/
│   ├── crypto.ts
│   ├── signature.ts
│   └── __tests__/
│       ├── crypto.test.ts
│       └── signature.test.ts
└── types/
    └── __tests__/
        └── AccountKey.test.ts
```

## 4. 공통 테스트 유틸리티

`lib/__tests__/helpers/` 폴더에 공통 mock과 fixture 저장:

```typescript
// lib/__tests__/helpers/mocks.ts
export const createMockProvider = () => ({
  getCode: jest.fn().mockResolvedValue('0x'),
  estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
  getFeeData: jest.fn().mockResolvedValue({
    gasPrice: BigInt(1000000000),
  }),
});

export const createMockSigner = () => ({
  keyTypes: [4], // keyWebAuthn
  signUserOpHash: jest.fn().mockResolvedValue(['0xsignature']),
});
```

```typescript
// lib/__tests__/helpers/fixtures.ts
export const MOCK_ADDRESSES = {
  sender: '0x1234567890123456789012345678901234567890',
  entryPoint: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  factory: '0x9876543210987654321098765432109876543210',
};

export const MOCK_USER_OP = {
  sender: MOCK_ADDRESSES.sender,
  nonce: '0x0',
  initCode: '0x',
  callData: '0x',
  callGasLimit: '0x5208',
  verificationGasLimit: '0x186a0',
  preVerificationGas: '0x5208',
  maxFeePerGas: '0x3b9aca00',
  maxPriorityFeePerGas: '0x3b9aca00',
  paymaster: '0x0000000000000000000000000000000000000000',
  paymasterData: '0x',
  paymasterVerificationGasLimit: '0x0',
  paymasterPostOpGasLimit: '0x0',
  signature: '0x',
};
```

## 5. VS Code 설정 (선택)

`.vscode/settings.json`에 추가:

```json
{
  "jest.autoRun": "off",
  "jest.showCoverageOnLoad": true
}
```

## 6. 커버리지 리포트 확인

```bash
# 텍스트 리포트
yarn test --coverage --coverageReporters=text

# HTML 리포트 (브라우저에서 확인)
yarn test --coverage
open coverage/lcov-report/index.html
```

## 7. CI/CD 통합

GitHub Actions 예시:

```yaml
- name: Run tests
  run: yarn test:ci

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
```
