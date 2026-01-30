# Type Check Command

빠른 TypeScript 타입 체크를 실행합니다 (빌드 없이).

## 실행할 명령어

```bash
npx tsc --noEmit
```

## 사용 시점
- 코드 수정 후 빠른 타입 검증
- PR 전 타입 에러 확인
- 리팩토링 중 타입 호환성 확인

## 예상 결과
- 성공 시: 출력 없음
- 실패 시: 타입 에러 목록 출력

## 관련 설정
- `tsconfig.json`
- `strictNullChecks: false` (null 체크 완화됨)
