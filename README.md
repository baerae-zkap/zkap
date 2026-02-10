# zkap-aa-sdk

![CI](https://github.com/baerae-zkap/zkap-aa-sdk/workflows/CI/badge.svg)
[![codecov](https://img.shields.io/badge/coverage-95%25-brightgreen)](https://github.com/baerae-zkap/zkap-aa-sdk)

A TypeScript SDK for interacting with ZKAP Abstract Account contracts easily.

## Test Coverage

- **Statements**: 95.01%
- **Branches**: 89.2%
- **Functions**: 98.19%
- **Lines**: 94.99%

## 개발 환경 설정

### 의존성 설치

```bash
npm install
```

### 테스트 실행

```bash
# 전체 테스트
npm test

# 커버리지 포함
npm run test:coverage

# Watch 모드
npm run test:watch
```

## 빌드 및 배포

### 빌드

```bash
npm run build
```

### 퍼블리시

```bash
npm run pub
```

## 패키지 설치 방법

```bash
npm install @baerae-zkap/zkap-aa-sdk@<version>
```

## npmrc 파일 작성 방법

프로젝트 루트 디렉토리에 `.npmrc` 파일을 생성하고 다음 내용을 추가합니다:

```ini
//npm.pkg.github.com/:_authToken=< Your Token >
@baerae-zkap:registry=https://npm.pkg.github.com/
```

이 설정은 npm이 패키지를 설치할 때 사용할 기본 레지스트리를 지정합니다.

< Your Token > 부분에 개인 계정의 깃허브 토큰을 넣으면 동작합니다.

### 토큰 발급 위치

> Github / Settings / Developer Settings / Personal access tokens (classic) / New personal access token (classic)

## 사용 방법

