# Add Mistake Pattern

실수 패턴을 수동으로 기록합니다.

## 사용법

다음 형식으로 실수 패턴을 기록해주세요:

```bash
echo '{"pattern":"PATTERN_DESCRIPTION","file":"FILE_PATH","lesson":"LESSON_LEARNED","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> .claude/cache/mistake-candidates.jsonl
```

## 예시

```bash
# 예: 잘못된 import 경로 사용
echo '{"pattern":"Wrong import path for AccountKey","file":"lib/signers/NewSigner.ts","lesson":"Use ../types/AccountKey not ./types/AccountKey","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> .claude/cache/mistake-candidates.jsonl
```

## 기록할 내용
- `pattern`: 실수 패턴 설명
- `file`: 관련 파일 경로
- `lesson`: 배운 교훈
- `timestamp`: 자동 생성

## 기록 확인

```bash
cat .claude/cache/mistake-candidates.jsonl | jq .
```
