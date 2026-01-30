#!/bin/bash
# PostToolUse Hook: Remind related files after edit
# Usage: Called by Claude Code after Edit/Write tools

FILE_PATH="$1"
EDIT_COUNT_FILE="$HOME/.claude/cache/edit-counts.json"
MISTAKE_LOG="$(dirname "$0")/../cache/mistake-candidates.jsonl"

# Create cache directories if needed
mkdir -p "$(dirname "$MISTAKE_LOG")"
mkdir -p "$(dirname "$EDIT_COUNT_FILE")"

# Initialize edit count file if not exists
if [ ! -f "$EDIT_COUNT_FILE" ]; then
  echo "{}" > "$EDIT_COUNT_FILE"
fi

# Function to output related file reminders
output_reminder() {
  local file="$1"
  local basename=$(basename "$file")
  local dirname=$(dirname "$file")

  # Signer 수정 시
  if [[ "$file" == *"/signers/"* ]]; then
    echo "Reminder: Signer 수정됨"
    echo "  - lib/index.ts export 확인"
    echo "  - lib/types/AccountKey.ts 키 타입 확인"
  fi

  # Builder 수정 시
  if [[ "$file" == *"/builders/"* ]]; then
    echo "Reminder: Builder 수정됨"
    echo "  - lib/index.ts export 확인"
    echo "  - 관련 ABI (lib/resources/abis.ts) 확인"
  fi

  # Type 수정 시
  if [[ "$file" == *"/types/"* ]]; then
    echo "Reminder: Type 수정됨"
    echo "  - 관련 Builder/Signer 타입 호환성 확인"
    echo "  - lib/index.ts export 확인"
  fi

  # ABI 수정 시
  if [[ "$file" == *"/types/abi/"* ]] || [[ "$file" == *"abis.ts"* ]]; then
    echo "Reminder: ABI 수정됨"
    echo "  - ZkapBuilder.ts 인터페이스 업데이트 확인"
    echo "  - CallDataBuilder.ts 확인"
  fi

  # Utils 수정 시
  if [[ "$file" == *"/utils/"* ]]; then
    echo "Reminder: Utils 수정됨"
    echo "  - 사용처 확인 (Signers, Builders)"
  fi
}

# Function to track edit counts and detect repeated edits
track_edit() {
  local file="$1"
  local timestamp=$(date +%s)

  # Simple edit tracking using temp file (cross-platform)
  local temp_count_file="/tmp/claude_edit_${file//\//_}"

  if [ -f "$temp_count_file" ]; then
    count=$(cat "$temp_count_file")
    count=$((count + 1))
  else
    count=1
  fi

  echo "$count" > "$temp_count_file"

  # Log if same file edited 3+ times
  if [ "$count" -ge 3 ]; then
    echo "{\"file\":\"$file\",\"count\":$count,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> "$MISTAKE_LOG"
    echo ""
    echo "Warning: '$basename' edited $count times this session"
    echo "  Consider reviewing approach or breaking into smaller changes"
  fi
}

# Main
if [ -n "$FILE_PATH" ]; then
  output_reminder "$FILE_PATH"
  track_edit "$FILE_PATH"
fi

exit 0
