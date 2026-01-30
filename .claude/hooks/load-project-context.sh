#!/bin/bash
# SessionStart Hook: Load project context for zkap-aa-sdk

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CACHE_FILE="$PROJECT_ROOT/.claude/cache/project-context.md"
MISTAKE_LOG="$PROJECT_ROOT/.claude/cache/mistake-candidates.jsonl"

# Output project context if exists
if [ -f "$CACHE_FILE" ]; then
  echo "=== ZKAP AA SDK Context Loaded ==="
  echo "Project: @baerae-zkap/zkap-aa-sdk"
  echo "Type: TypeScript SDK (ERC-4337 Account Abstraction)"
  echo ""
  echo "Key Entry Points:"
  echo "  - ZkapBuilder: lib/builders/ZkapBuilder.ts"
  echo "  - Signers: lib/signers/*.ts"
  echo "  - Types: lib/types/*.ts"
  echo ""
  echo "Commands: yarn build | yarn pub | npx tsc --noEmit"
fi

# Check for recent mistakes
if [ -f "$MISTAKE_LOG" ]; then
  RECENT_MISTAKES=$(tail -5 "$MISTAKE_LOG" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$RECENT_MISTAKES" -gt 0 ]; then
    echo ""
    echo "Warning: $RECENT_MISTAKES recent edit patterns logged"
  fi
fi

exit 0
