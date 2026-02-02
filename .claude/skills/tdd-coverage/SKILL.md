---
name: tdd-coverage
description: TDD 워크플로우와 95% 커버리지 달성. "테스트 추가", "테스트 코드", "coverage", "커버리지", "TDD" 언급 시 또는 코드 수정 완료 후 사용
argument-hint: [file-path]
---

# TDD with 95% Coverage - ZKAP AA SDK

ERC-4337 Account Abstraction SDK 테스트 가이드

## 1. 테스트 파일 위치

```
수정 파일                              테스트 파일
lib/signers/PasskeySigner.ts     →    lib/signers/__tests__/PasskeySigner.test.ts
lib/builders/ZkapBuilder.ts      →    lib/builders/__tests__/ZkapBuilder.test.ts
lib/utils/crypto.ts              →    lib/utils/__tests__/crypto.test.ts
```

## 2. 테스트 실행 명령어

```bash
# 단일 파일 테스트
npm test -- --testPathPattern="<파일명>"

# 전체 테스트
npm test

# 커버리지 리포트
npm test -- --coverage

# Watch 모드 (개발 중 유용)
npm test -- --watch

# 특정 describe 블록만 실행
npm test -- --testNamePattern="signUserOpHash"
```

## 3. 커버리지 목표

| 지표 | 목표 |
|------|------|
| Statements | 95%+ |
| Branches | 95%+ |
| Functions | 95%+ |
| Lines | 95%+ |

**모든 지표에서 95% 이상을 달성해야 합니다.**

## 4. 테스트 작성 원칙

모든 테스트는 다음 4가지 케이스를 반드시 포함해야 합니다:

### 4.1 성공 케이스 (Happy Path)
- 정상적인 입력으로 예상된 결과를 반환하는지 확인
- 가장 일반적인 사용 시나리오 테스트

```typescript
it('should return expected result for valid input', () => {
  const result = functionName('valid-input');
  expect(result).toBe('expected-output');
});
```

### 4.2 실패 케이스 (Error Handling)
- 에러가 발생해야 하는 상황에서 올바르게 throw 되는지 확인
- 에러 메시지가 명확한지 검증

```typescript
it('should throw error for invalid input', () => {
  expect(() => functionName(null as any)).toThrow('Expected error message');
});

it('should reject with error for async operations', async () => {
  await expect(asyncFunction()).rejects.toThrow('Async error');
});
```

### 4.3 경계값 (Edge Cases)
- 빈 값, 최소값, 최대값, null, undefined 등 극단적인 입력 테스트
- 예상치 못한 입력에 대한 안전성 확인

```typescript
it('should handle empty string', () => {
  expect(functionName('')).toBe('');
});

it('should handle null/undefined', () => {
  expect(() => functionName(null as any)).toThrow();
});

it('should handle maximum length', () => {
  const longInput = 'a'.repeat(10000);
  expect(() => functionName(longInput)).not.toThrow();
});
```

### 4.4 분기 커버 (Branch Coverage)
- if/else, switch, 삼항 연산자 등 모든 분기를 테스트
- 조건문의 true/false 경로 모두 실행

```typescript
// 예시: mode에 따른 분기
it('should use VERIFYING mode logic', () => {
  const service = new Service({ mode: PaymasterMode.VERIFYING });
  expect(service.estimateGas()).toBe(27000n);
});

it('should use ERC20 mode logic', () => {
  const service = new Service({ mode: PaymasterMode.ERC20 });
  expect(service.estimateGas()).toBe(40000n);
});
```

## 5. 커버리지 부족 시 대응 절차

커버리지가 95% 미만일 때 다음 절차를 따르세요:

### Step 1: 커버리지 리포트 확인
```bash
npm test -- --coverage
```

출력 예시:
```
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|----------|---------|---------|-------------------
utils/crypto.ts     |   87.5  |    75.0  |   90.0  |   88.2  | 45-47,52
```

### Step 2: Uncovered 라인 확인
- 터미널 출력에서 "Uncovered Line #s" 컬럼 확인
- 또는 `coverage/lcov-report/index.html` 브라우저로 열어 시각적으로 확인
  - 빨간색 = 커버되지 않은 라인
  - 노란색 = 일부만 커버된 분기

### Step 3: 테스트 케이스 추가
uncovered 라인을 실행하는 테스트 작성:

```typescript
// uncovered line이 45-47: 에러 처리 로직
it('should handle error in crypto operation', () => {
  const invalidInput = 'invalid-data';
  expect(() => cryptoFunction(invalidInput)).toThrow();
});
```

### Step 4: 다시 커버리지 확인
```bash
npm test -- --coverage
```

### Step 5: 95% 달성까지 반복
Step 1-4를 반복하여 **모든 지표가 95% 이상**이 될 때까지 계속:
- Statements: 95% 이상
- Branches: 95% 이상
- Functions: 95% 이상
- Lines: 95% 이상

### 팁: 커버되지 않는 라인 찾기
```bash
# 특정 파일만 커버리지 확인
npm test -- --coverage --collectCoverageFrom='lib/utils/crypto.ts'

# 커버리지 HTML 리포트 자동 열기 (Mac)
npm test -- --coverage && open coverage/lcov-report/index.html
```

## 6. 커밋 조건 (필수)

**다음 3가지 조건을 모두 충족해야만 커밋 가능:**

### ✅ 조건 1: 모든 테스트 통과
```bash
npm test
# ✓ All tests passed
```

### ✅ 조건 2: 커버리지 95% 이상 달성
```bash
npm test -- --coverage
# Statements: 95%+
# Branches: 95%+
# Functions: 95%+
# Lines: 95%+
```

### ✅ 조건 3: 테스트 파일과 소스 파일 함께 커밋
```bash
git add lib/signers/NewSigner.ts
git add lib/signers/__tests__/NewSigner.test.ts
git commit -m "feat: add NewSigner with 95% test coverage"
```

**❌ 다음은 절대 금지:**
- 테스트 없이 소스 코드만 커밋
- 커버리지 95% 미만 상태에서 커밋
- 실패하는 테스트가 있는 상태에서 커밋

## 7. 테스트 우선순위

| 순서 | 파일 | 난이도 | 이유 |
|------|------|--------|------|
| 1 | `lib/utils/signature.ts` | 낮음 | 순수 함수, 보안 critical |
| 2 | `lib/utils/base64url.ts` | 낮음 | 순수 함수 |
| 3 | `lib/utils/crypto.ts` | 중간 | ZK/암호화 로직 |
| 4 | `lib/signers/*.ts` | 중간 | 핵심 서명 로직 |
| 5 | `lib/builders/CallDataBuilder.ts` | 중간 | ABI 인코딩 |
| 6 | `lib/builders/ZkapBuilder.ts` | 높음 | 복잡한 상태/Provider |
| 7 | `lib/utils/PaymasterService.ts` | 높음 | HTTP 통신 |

---

## 8. Mock 패턴 (ZKAP SDK용)

### ethers.js Mock

```typescript
// __mocks__/ethers.ts 또는 테스트 파일 상단
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      JsonRpcProvider: jest.fn().mockImplementation(() => ({
        getCode: jest.fn().mockResolvedValue('0x'),
        estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt(1000000000),
        }),
      })),
      Contract: jest.fn().mockImplementation(() => ({
        getNonce: jest.fn().mockResolvedValue(BigInt(0)),
      })),
    },
  };
});
```

### Provider Mock (상세)

```typescript
const createMockProvider = () => ({
  getCode: jest.fn().mockResolvedValue('0x'),
  estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
  getFeeData: jest.fn().mockResolvedValue({
    gasPrice: BigInt(1000000000),
    maxFeePerGas: BigInt(2000000000),
    maxPriorityFeePerGas: BigInt(1000000000),
  }),
});
```

### fetch Mock (PaymasterService용)

```typescript
// PaymasterService 테스트
global.fetch = jest.fn();

beforeEach(() => {
  (global.fetch as jest.Mock).mockReset();
});

it('should get paymaster data', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      result: {
        userOp: { paymasterData: '0xpaymasterdata' }
      }
    }),
  });

  const service = new PaymasterService(config);
  const result = await service.getPaymasterData(mockUserOp);

  expect(result).toBe('0xpaymasterdata');
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/paymaster/'),
    expect.any(Object)
  );
});

it('should throw on HTTP error', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
  });

  await expect(service.getPaymasterData(mockUserOp))
    .rejects.toThrow('Paymaster data request failed');
});
```

### Signer Mock

```typescript
// IUserOpSigner는 keyTypes가 없음 (인터페이스에 signUserOpHash만 있음)
const mockSigner = {
  signUserOpHash: jest.fn().mockResolvedValue(['0xsignature...']),
};

// 구체적인 Signer 타입 mock
import { AddressKeySigner } from '../AddressKeySigner';
jest.mock('../AddressKeySigner');
(AddressKeySigner as jest.Mock).mockImplementation(() => ({
  keyTypes: [1], // keyAddress
  signUserOpHash: jest.fn().mockResolvedValue(['0xsig']),
}));
```

### WebAuthn/Passkey Mock

```typescript
const mockVerifyWithPasskey = jest.fn().mockResolvedValue({
  response: {
    signature: 'MEUCIQDmock-signature-base64url',
    authenticatorData: 'SZYN5mock-authdata-base64url',
    clientDataJSON: 'eyJ0eXmock-clientdata-base64url',
  },
});

// PasskeySigner 테스트
const signer = new PasskeySigner('credential-id', mockVerifyWithPasskey);
const result = await signer.signUserOpHash('0xuserhash...');

expect(mockVerifyWithPasskey).toHaveBeenCalledWith(
  'credential-id',
  expect.any(String) // base64url encoded challenge
);
```

### 순차적 Mock

```typescript
(mockProvider.getCode as jest.Mock)
  .mockResolvedValueOnce('0x')           // 첫 호출: 미배포
  .mockResolvedValueOnce('0x608060...');  // 두 번째: 배포됨
```

---

## 9. 테스트 템플릿

### Utils 테스트 (순수 함수)

```typescript
import { functionName } from '../utils';

describe('functionName', () => {
  describe('정상 케이스', () => {
    it('should return expected output for valid input', () => {
      const result = functionName('valid-input');
      expect(result).toBe('expected-output');
    });
  });

  describe('에러 케이스', () => {
    it('should throw for invalid input', () => {
      expect(() => functionName(null as any)).toThrow();
    });
  });

  describe('경계값', () => {
    it('should handle empty string', () => {
      expect(functionName('')).toBe('');
    });

    it('should handle maximum length', () => {
      const longInput = 'a'.repeat(1000);
      expect(() => functionName(longInput)).not.toThrow();
    });
  });
});
```

### Signer 테스트

```typescript
import { PasskeySigner } from '../PasskeySigner';

describe('PasskeySigner', () => {
  const mockCredentialId = 'test-credential-id';
  let mockVerifyWithPasskey: jest.Mock;
  let signer: PasskeySigner;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyWithPasskey = jest.fn().mockResolvedValue({
      response: {
        signature: 'mock-signature',
        authenticatorData: 'mock-auth-data',
        clientDataJSON: 'mock-client-data',
      },
    });
    signer = new PasskeySigner(mockCredentialId, mockVerifyWithPasskey);
  });

  describe('constructor', () => {
    it('should set keyTypes to keyWebAuthn', () => {
      expect(signer.keyTypes).toContain(4); // PrimitiveAccountKeyTypes.keyWebAuthn
    });
  });

  describe('signUserOpHash', () => {
    const mockUserOpHash = '0x' + 'ab'.repeat(32);

    it('should call verifyWithPasskey with correct params', async () => {
      await signer.signUserOpHash(mockUserOpHash);

      expect(mockVerifyWithPasskey).toHaveBeenCalledWith(
        mockCredentialId,
        expect.any(String)
      );
    });

    it('should return encoded signature array', async () => {
      const result = await signer.signUserOpHash(mockUserOpHash);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]).toMatch(/^0x/);
    });

    it('should throw when verifyWithPasskey fails', async () => {
      mockVerifyWithPasskey.mockRejectedValueOnce(new Error('Auth failed'));

      await expect(signer.signUserOpHash(mockUserOpHash))
        .rejects.toThrow('Auth failed');
    });
  });
});
```

### Builder 테스트

```typescript
import { ZkapBuilder, ZkapAccountInfo } from '../ZkapBuilder';
import { ethers } from 'ethers';

// Provider mock
const mockProvider = {
  getCode: jest.fn(),
  estimateGas: jest.fn(),
  getFeeData: jest.fn(),
};

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      JsonRpcProvider: jest.fn(() => mockProvider),
    },
  };
});

describe('ZkapBuilder', () => {
  const config: ZkapAccountInfo = {
    chainId: 1,
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    enUrl: 'https://rpc.example.com',
  };

  let builder: ZkapBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProvider.getCode.mockResolvedValue('0x');
    mockProvider.estimateGas.mockResolvedValue(BigInt(21000));
    mockProvider.getFeeData.mockResolvedValue({
      gasPrice: BigInt(1000000000),
    });

    builder = new ZkapBuilder(config);
  });

  describe('setSender', () => {
    it('should set sender and return this for chaining', () => {
      const result = builder.setSender('0x1234...');

      expect(result).toBe(builder);
      expect(builder.getUserOp().sender).toBe('0x1234...');
    });
  });

  describe('autoFillUserOp', () => {
    it('should fill gas values from provider', async () => {
      builder.setSender('0x1234567890123456789012345678901234567890');

      await builder.autoFillUserOp();
      const userOp = builder.getUserOp();

      expect(userOp.maxFeePerGas).toBeDefined();
      expect(mockProvider.getFeeData).toHaveBeenCalled();
    });

    it('should throw when sender not set', async () => {
      await expect(builder.autoFillUserOp())
        .rejects.toThrow('Sender is not set');
    });

    it('should throw when provider returns no gas price', async () => {
      builder.setSender('0x1234567890123456789012345678901234567890');
      mockProvider.getFeeData.mockResolvedValueOnce({ gasPrice: null });

      await expect(builder.autoFillUserOp())
        .rejects.toThrow('Failed to get fee data');
    });
  });
});
```

### PaymasterService 테스트

```typescript
import { PaymasterService, PaymasterMode, PaymasterServiceConfig } from '../PaymasterService';

describe('PaymasterService', () => {
  const config: PaymasterServiceConfig = {
    serverUrl: 'https://paymaster.example.com',
    paymasterAddress: '0xPaymaster...',
    chainId: 1,
    mode: PaymasterMode.VERIFYING,
  };

  let service: PaymasterService;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    service = new PaymasterService(config);
  });

  describe('getPaymasterData', () => {
    const mockUserOp = {
      sender: '0x...',
      nonce: '0x0',
      // ... 나머지 필드
    };

    it('should return paymaster data on success', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { userOp: { paymasterData: '0xdata' } }
        }),
      });

      const result = await service.getPaymasterData(mockUserOp as any);
      expect(result).toBe('0xdata');
    });

    it('should throw on HTTP error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });

      await expect(service.getPaymasterData(mockUserOp as any))
        .rejects.toThrow('Paymaster data request failed');
    });

    it('should throw on API error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: { message: 'Invalid params' }
        }),
      });

      await expect(service.getPaymasterData(mockUserOp as any))
        .rejects.toThrow('Invalid params');
    });
  });

  describe('estimatePaymasterVerificationGasLimit', () => {
    it('should return 27000n for VERIFYING mode', () => {
      expect(service.estimatePaymasterVerificationGasLimit()).toBe(27000n);
    });

    it('should return 40000n for ERC20 mode', () => {
      const erc20Service = new PaymasterService({
        ...config,
        mode: PaymasterMode.ERC20,
      });
      expect(erc20Service.estimatePaymasterVerificationGasLimit()).toBe(40000n);
    });
  });
});
```

---

## 10. 환경 설정 주의사항

### Node.js 버전
- `atob`/`btoa`: Node 18+ 에서 global 사용 가능
- Node 16 이하: `Buffer.from(str, 'base64')` 또는 polyfill 필요

### TypeScript 설정
- **`strictNullChecks: false`** 설정되어 있음
- null 체크가 완화되어 있으므로 테스트에서 명시적으로 null/undefined 케이스 검증 필요
- TypeScript 컴파일러가 null 관련 에러를 감지하지 못하므로, 테스트에서 더 철저히 검증해야 함

```typescript
// strictNullChecks: false 환경에서 테스트 작성 시
// ❌ 나쁜 예: TypeScript가 에러를 잡아주지 않음
it('should handle null', () => {
  expect(() => functionName(null)).toThrow();
});

// ✅ 좋은 예: as any로 명시적 처리
it('should handle null', () => {
  expect(() => functionName(null as any)).toThrow();
});

// ✅ 경계값 테스트 예시
it('should handle null/undefined', () => {
  expect(() => functionName(null as any)).toThrow('Cannot process null');
  expect(() => functionName(undefined as any)).toThrow('Cannot process undefined');
});
```

### Jest 설정 (jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // global mocks
  setupFilesAfterEnv: ['<rootDir>/lib/__tests__/setup.ts'],
};
```

### 테스트 Setup 파일

```typescript
// lib/__tests__/setup.ts

// fetch mock (Node 18 미만)
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}

// TextEncoder/TextDecoder (Node에 기본 포함)
// atob/btoa (Node 18+에 기본 포함)

// 전역 mock 리셋
beforeEach(() => {
  jest.clearAllMocks();
});
```

---

## 11. 체크리스트

### 테스트 작성 전
- [ ] 대상 함수의 입력/출력 타입 확인
- [ ] 의존성 확인 (ethers, fetch, Buffer 등)
- [ ] 에러 throw 조건 확인

### 테스트 작성 후
- [ ] 모든 public 메서드 테스트
- [ ] 에러 케이스 테스트 (throw 조건)
- [ ] 경계값 테스트 (빈 문자열, null, 긴 입력)
- [ ] Mock이 올바르게 리셋됨 (`jest.clearAllMocks()`)
- [ ] 비동기 함수는 `async/await` 사용
- [ ] `expect` 호출 포함 (빈 테스트 없음)

### 커밋 전
- [ ] `npm test` 통과
- [ ] `npm test --coverage` 95% 이상
- [ ] `npx tsc --noEmit` 타입 체크 통과
