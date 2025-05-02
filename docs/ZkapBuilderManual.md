# ZkapBuilder 사용 메뉴얼

## 1. 개요

ZkapBuilder는 ZKAP(Zero Knowledge Account Protocol) 지갑을 생성하고 관리하기 위한 빌더 클래스입니다. 이 문서에서는 ZkapBuilder, AccountKeyBuilder, ZkapCreator의 사용 방법을 설명합니다.

## 2. 전체 프로세스

ZKAP 지갑의 생성 프로세스는 다음과 같습니다:

1. **키 생성**

   - 마스터 키 생성 (ZkOAuthRS256)
   - 트랜잭션 키 생성 (WebAuthn)
   - AccountKeyBuilder를 사용하여 키를 인코딩

2. **지갑 생성**

   - ZkapCreator를 사용하여 지갑 생성을 위한 데이터 준비
   - UserOp 생성

3. **트랜잭션 실행**

   - ZkapCreator 로 생성된 UserOp 를 handleOps 실행 트랜잭션으로 전송

만들어져있는 ZKAP 의 키 업데이트 프로세스는 다음과 같습니다:

1. **키 생성**

   - 트랜잭션 키 생성 (WebAuthn)
   - AccountKeyBuilder를 사용하여 키를 인코딩

2. **키 업데이트**

   - ZkapBuilder를 사용하여 키 업데이트를 위한 생성

3. **트랜잭션 실행**

   - ZkapBuilder 로 생성된 UserOp 를 handleOps 실행 트랜잭션으로 전송

## 3. 키 생성 (AccountKeyBuilder)

AccountKeyBuilder는 ZKAP 지갑에서 사용되는 다양한 타입의 키를 생성하고 인코딩하는 역할을 합니다.

### 3.1 마스터 키 생성 (ZkOAuthRS256)

#### 방법 1: 단계별 생성

```typescript
const accountKeyBuilder = new AccountKeyBuilder();

const threshold = 1;
const keyInfoList: ZkOAuthRS256KeyInfo[] = [
  {
    weight: 1,
    userSpecificVk: userVk, // 사용자별 검증 키
  },
];

const masterKey = accountKeyBuilder.setZkOAuthRS256Key(threshold, keyInfoList);
```

#### 방법 2: 생성과 동시에 완성

```typescript
const threshold = 1;
const keys: KeyInfo[] = [
  {
    keyType: PrimitiveAccountKeyTypes.keyZkOAuthRS256,
    weight: 1,
    keyData: {
      userSpecificVk: userVk,
    },
  },
];

const keyBuilder = new AccountKeyBuilder(threshold, keys);
const masterKey = keyBuilder.getEncodedCompositeKey();
```

### 3.2 트랜잭션 키 생성 (WebAuthnKey)

#### 방법 1: 단계별 생성

```typescript
const threshold = 1;
const keyInfoList: WebAuthnKeyInfo[] = [
  {
    weight: 1,
    credentialPubkey: "0x1234567890abcdef",
    credentialId: "0x1234567890abcdef",
    rpIdHash: "0x1234567890abcdef",
    origin: "https://example.com",
  },
];

const keyBuilder = new AccountKeyBuilder();
const txKey = keyBuilder.setWebAuthnKey(threshold, keyInfoList);
```

#### 방법 2: 생성과 동시에 완성

```typescript
const threshold = 1;
const keys: KeyInfo[] = [
  {
    keyType: PrimitiveAccountKeyTypes.keyWebAuthn,
    weight: 1,
    keyData: {
      credentialPubkey: "0x1234567890abcdef",
      credentialId: "0x1234567890abcdef",
      rpIdHash: "0x1234567890abcdef",
      origin: "https://example.com",
    },
  },
];

const keyBuilder = new AccountKeyBuilder(threshold, keys);
const txKey = keyBuilder.getEncodedCompositeKey();
```

## 4. 지갑 생성 (ZkapCreator)

ZkapCreator는 ZKAP 지갑을 생성하는 역할을 합니다.

### 4.1 초기화

```typescript
const zkapCreator = new ZkapCreator({
  chainId: 8216,
  entryPoint: entryPoint.target.toString(),
  zkapFactory: zkapAccountFactory.target.toString(),
  keyFactory: compositeFactory.target.toString(),
  enUrl,
  txKeySigner: new AddressKeySigner([ownerWallet.privateKey]),
  salt: ethers.sha256(ethers.toUtf8Bytes(`${userId}${account_num}`)),
  encodedMasterKey: masterKey,
  encodedTxKey: txKey,
});
```

(txKeySigner 할당 부분은 7.서명자 항목을 참고)

### 4.2 지갑 생성 tx 전송

```typescript
// 생성된 UserOp 전송 (유저의 ZKAP 에 수수료가 있는 상태여야 함)
await zkapCreator.completeUserOp();
const tx = await entryPoint.handleOps(
  [zkapCreator.getPackedUserOp()],
  ownerWallet.address
);
```

## 5. 키 업데이트 (ZkapBuilder)

ZkapBuilder는 기존 ZKAP 지갑의 키를 업데이트하는 역할을 합니다.

### 5.1 초기화

```typescript
const zkapBuilder = new ZkapBuilder({
  chainId: 8216,
  entryPoint: entryPoint.target.toString(),
  enUrl,
  txKeySigner: new AddressKeySigner([privateKey]),
  masterKeySigner: new ZkOAuthRS256KeySigner(serverUrl, enUrl, accountAddress, [
    idTokenGenerator,
  ]),
});
```

(txKeySigner, masterKeySigner 할당 부분은 7.서명자 항목을 참고)

### 5.2 트랜잭션 키 업데이트

```typescript
// 1. 새로운 트랜잭션 키 생성
const threshold = 1;
const keyInfoList: WebAuthnKeyInfo[] = [
  {
    weight: 1,
    credentialPubkey: "0x1234567890abcdef",
    credentialId: "0x1234567890abcdef",
    rpIdHash: "0x1234567890abcdef",
    origin: "https://example.com",
  },
];

const keyBuilder = new AccountKeyBuilder();
const newtxKey = keyBuilder.setWebAuthnKey(threshold, keyInfoList);

// 2. UserOp 생성 및 전송
zkapBuilder.setSender(zkapAddress).setUpdateTxKeyCallData(newTxKey);

await zkapBuilder.completeUserOp();

const tx = await entryPoint.handleOps(
  [zkapBuilder.getPackedUserOp()],
  ownerWallet.address
);
```

## 6. 트랜잭션 실행

```typescript
await zkapBuilder.completeUserOp();

const tx = await entryPoint.handleOps(
  [zkapBuilder.getPackedUserOp()],
  ownerWallet.address
);
```

## 7. 서명자 (Signer)

ZKAP 지갑은 다양한 타입의 서명자를 지원합니다. 각 서명자는 특정 키 타입에 맞는 서명을 생성하는 역할을 합니다.

### 7.1 ZkOAuthRS256KeySigner

ZkOAuthRS256KeySigner는 OAuth RS256 서명을 생성하는 서명자입니다. Google, Apple, Kakao 등의 OAuth 서비스와 연동하여 서명을 생성합니다.

```typescript
const zkOAuthRS256Signer = new ZkOAuthRS256KeySigner(
  proofServerUrl, // ZK 증명 서버 URL
  enUrl, // 이더리움 노드 URL
  zkapAddress, // ZKAP 지갑 주소
  [idTokenGenerator] // ID 토큰 생성 함수 배열 (여기에 소셜로그인 업체별 idToken 만드는 함수 삽입)
);

// 초기화
await zkOAuthRS256Signer.init();

// 서명 생성
const signatures = await zkOAuthRS256Signer.signUserOpHash(userOpHash);
```

특징:

- OAuth RS256 서명을 지원
- ZK 증명 서버와 연동하여 서명 생성
- 다중 서명 지원 (여러 개의 ID 토큰 생성 함수를 전달 가능)
- Google, Apple, Kakao 등의 OAuth 서비스 지원

### 7.2 PasskeySigner

PasskeySigner는 WebAuthn/Passkey를 사용하여 서명을 생성하는 서명자입니다. 사용자의 생체 인증이나 보안 키를 사용하여 서명을 생성합니다.

```typescript
const passkeySigner = new PasskeySigner(
  credentialId, // WebAuthn 자격 증명 ID
  verifyWithPasskey // Passkey 검증 함수
);

// 서명 생성
const signatures = await passkeySigner.signUserOpHash(userOpHash);
```

특징:

- WebAuthn/Passkey 서명을 지원
- 생체 인증 및 보안 키 지원
- 클라이언트 측에서 서명 생성
- 단일 서명만 지원

## 8. 주의사항

1. 지갑 생성 시 충분한 ETH 혹은 paymaster에서 사용할 수수료가 필요합니다.
2. 트랜잭션 키 업데이트는 마스터 키로 서명해야 합니다.
3. 일반 트랜잭션은 트랜잭션 키로 서명해야 합니다.

## 9. 에러 처리

- `Required fields are missing`: 필수 필드가 설정되지 않은 경우
- `UserOpSigner is not set`: 서명자가 설정되지 않은 경우
- `Invalid key type`: 잘못된 키 타입이 사용된 경우
- `Threshold is greater than the sum of weights`: 임계값이 키 가중치의 합보다 큰 경우
