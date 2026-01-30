# Build Command

TypeScript를 컴파일하여 dist/ 폴더에 JavaScript 출력을 생성합니다.

## 실행할 명령어

```bash
yarn build
```

## 출력 구조

```
dist/
└── lib/
    ├── index.js
    ├── index.d.ts
    ├── account/
    ├── builders/
    ├── signers/
    ├── types/
    ├── utils/
    └── resources/
```

## 사용 시점
- 배포 전
- 로컬 테스트 전
- `yarn pub` 실행 전

## 관련 설정
- `tsconfig.json`
- 출력 디렉토리: `./dist`
- 모듈: CommonJS
- 타겟: ES2020
