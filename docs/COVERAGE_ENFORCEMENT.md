# Coverage Enforcement Guide

## Overview

이 프로젝트는 코드 커버리지 목표를 강제하여 코드 품질을 유지합니다.

## Coverage Targets

| 지표 | 목표 |
|------|------|
| Lines | 95% |
| Branches | 90% |
| Statements | 95% |
| Functions | 95% |

## How It Works

### 1. Jest Configuration

`jest.config.js`에 커버리지 임계값이 설정되어 있습니다:

```javascript
coverageThreshold: {
  global: {
    statements: 95,
    branches: 90,
    functions: 95,
    lines: 95,
  },
}
```

로컬에서 `npm run test:coverage`를 실행하면 임계값 미달 시 테스트가 실패합니다.

### 2. CI Workflow

`.github/workflows/ci.yml`에서 다음 단계를 수행합니다:

1. **테스트 실행**: 모든 테스트를 커버리지와 함께 실행
2. **임계값 체크**: 커버리지가 목표에 미달하면 빌드 실패
3. **PR 코멘트**: PR에 커버리지 리포트 자동 생성

```yaml
- name: Check coverage thresholds
  if: always()
  run: |
    if grep -q "Jest: \"global\" coverage threshold" coverage/coverage.txt; then
      echo "❌ Coverage thresholds not met!"
      exit 1
    fi
```

### 3. Branch Protection Rules

GitHub에서 branch protection rules를 설정하여 CI 통과를 필수로 만들 수 있습니다.

## Setting Up Branch Protection

### 방법 1: GitHub UI

1. **Settings** → **Branches** 이동
2. **Branch protection rules** 섹션에서 **Add rule** 클릭
3. **Branch name pattern**: `main` 입력
4. 다음 옵션 활성화:
   - ✅ **Require a pull request before merging**
   - ✅ **Require status checks to pass before merging**
     - 검색창에서 `test` 체크 (CI workflow의 job 이름)
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Do not allow bypassing the above settings**
5. **Create** 클릭

### 방법 2: GitHub CLI

```bash
gh api repos/baerae-zkap/zkap-aa-sdk/branches/main/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks='{"strict":true,"contexts":["test"]}' \
  -f required_pull_request_reviews='{"required_approving_review_count":1}' \
  -f enforce_admins=true
```

## Testing Coverage Enforcement

### 로컬 테스트

```bash
# 커버리지 확인
npm run test:coverage

# 목표 미달 시 출력 예시:
# Jest: "global" coverage threshold for lines (95%) not met: 94.5%
# 프로세스가 exit code 1로 종료됨
```

### CI에서 테스트

1. 커버리지를 낮추는 코드 작성
2. PR 생성
3. CI가 실패하는지 확인
4. PR의 "Checks" 탭에서 실패 이유 확인

## Coverage 개선 방법

커버리지가 목표에 미달할 경우:

1. **누락된 테스트 식별**:
   ```bash
   npm run test:coverage
   # coverage/lcov-report/index.html 열기
   ```

2. **TDD 스킬 활용** (프로젝트에 설정되어 있음):
   - 성공 케이스 테스트
   - 실패 케이스 테스트
   - 경계값 테스트
   - 분기 케이스 테스트

3. **커버리지 리포트 분석**:
   - 빨간색으로 표시된 라인 확인
   - 각 파일의 uncovered lines 확인
   - 누락된 브랜치 찾기

## Troubleshooting

### CI는 통과했지만 coverage가 낮음

- `jest.config.js`의 `coverageThreshold` 값 확인
- CI workflow의 체크 단계가 제대로 작동하는지 확인

### 로컬에서는 통과하지만 CI에서 실패

- 로컬과 CI의 Node.js 버전 확인 (CI는 Node 20 사용)
- 캐시 문제일 수 있으므로 `npm ci` 실행

### Branch protection이 적용되지 않음

- Repository settings 권한 확인 (admin 권한 필요)
- Status check 이름이 정확한지 확인 (`test`)

## References

- [Jest Coverage Configuration](https://jestjs.io/docs/configuration#coveragethreshold-object)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Actions Status Checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)
