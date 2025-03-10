# zkap-aa-sdk

A TypeScript SDK for interacting with ZKAP Abstract Account contracts easily.

## 빌드 및 배포

### 빌드

```bash
yarn build
```

### 퍼블리시

```bash
yarn pub
```

## 패키지 설치 방법

```bash
yarn add @baerae-zkap/zkap-aa-sdk@<version>
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
