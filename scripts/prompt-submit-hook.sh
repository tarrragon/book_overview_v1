#!/bin/bash

# prompt-submit-hook.sh
# UserPromptSubmit Hook: 檢查工作流程合規性

# 設定路徑和日誌
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/.claude/hook-logs/prompt-submit-$(date +%Y%m%d_%H%M%S).log"

# 確保日誌目錄存在
mkdir -p "$PROJECT_ROOT/.claude/hook-logs"

# 執行日誌清理 (每10次觸發清理一次)
CLEANUP_TRIGGER="$PROJECT_ROOT/.claude/hook-logs/.cleanup_counter"
if [ ! -f "$CLEANUP_TRIGGER" ]; then
    echo "1" > "$CLEANUP_TRIGGER"
else
    COUNTER=$(cat "$CLEANUP_TRIGGER")
    if [ "$COUNTER" -ge 10 ]; then
        "$SCRIPT_DIR/cleanup-hook-logs.sh" >/dev/null 2>&1 &
        echo "1" > "$CLEANUP_TRIGGER"
    else
        echo $((COUNTER + 1)) > "$CLEANUP_TRIGGER"
    fi
fi

# 日誌函數
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "💬 UserPromptSubmit Hook: 檢查工作流程合規性"

cd "$PROJECT_ROOT"

# 1. 檢查是否有未追蹤的問題需要更新todolist
log "🔍 檢查未追蹤問題"

# 檢查是否有測試失敗
if command -v npm >/dev/null 2>&1; then
    # 快速測試檢查 (不執行完整測試，只檢查上次結果)
    if [ -f "coverage-private/test-status.txt" ]; then
        LAST_TEST_STATUS=$(cat "coverage-private/test-status.txt" 2>/dev/null || echo "unknown")
        if [ "$LAST_TEST_STATUS" != "pass" ]; then
            log "⚠️  上次測試狀態: $LAST_TEST_STATUS - 建議檢查測試結果"
        else
            log "✅ 上次測試狀態: 通過"
        fi
    fi
fi

# 2. 檢查測試通過率(三大鐵律之一)
log "🎯 檢查測試通過率(100%要求)"

# 檢查是否有 lint 錯誤
if command -v npm >/dev/null 2>&1 && [ -f "package.json" ]; then
    if npm run lint --silent 2>/dev/null | grep -q "error"; then
        log "⚠️  發現 ESLint 錯誤 - 違反100%品質要求"

        # 創建問題追蹤提醒
        REMINDER_FILE="$PROJECT_ROOT/.claude/hook-logs/issues-to-track.md"
        echo "## 🚨 需要追蹤的問題 - $(date)" >> "$REMINDER_FILE"
        echo "- ESLint 錯誤需要立即修復" >> "$REMINDER_FILE"
        echo "- 影響評估: Critical" >> "$REMINDER_FILE"
        echo "- 發現時間: $(date)" >> "$REMINDER_FILE"
        echo "" >> "$REMINDER_FILE"

        log "📋 已記錄問題追蹤提醒: $REMINDER_FILE"
    else
        log "✅ ESLint 檢查通過"
    fi
fi

# 3. 檢查架構債務(三大鐵律之一)
log "🏗️  檢查架構債務警示"

# 檢查是否有包含 "TODO", "FIXME", "HACK" 的程式碼註解
DEBT_COUNT=$(find src/ -name "*.js" -type f 2>/dev/null | xargs grep -l "TODO\|FIXME\|HACK" 2>/dev/null | wc -l)
if [ "$DEBT_COUNT" -gt 0 ]; then
    log "⚠️  發現 $DEBT_COUNT 個檔案包含技術債務標記"
else
    log "✅ 未發現明顯的技術債務標記"
fi

# 4. 生成工作流程建議
log "💡 生成工作流程建議"

# 檢查最近是否有提交
LAST_COMMIT_TIME=$(git log -1 --format=%ct 2>/dev/null || echo "0")
CURRENT_TIME=$(date +%s)
TIME_DIFF=$((CURRENT_TIME - LAST_COMMIT_TIME))

if [ "$TIME_DIFF" -gt 3600 ]; then # 超過1小時
    log "💡 建議檢查是否需要提交當前工作進度"
fi

# 檢查todolist.md更新時間
if [ -f "docs/todolist.md" ]; then
    TODOLIST_MOD_TIME=$(stat -f %m "docs/todolist.md" 2>/dev/null || echo "0")
    TODOLIST_DIFF=$((CURRENT_TIME - TODOLIST_MOD_TIME))

    if [ "$TODOLIST_DIFF" -gt 86400 ]; then # 超過24小時
        log "💡 todolist.md 超過24小時未更新，建議檢查任務狀態"
    fi
fi

log "✅ UserPromptSubmit Hook 檢查完成"

# 返回成功狀態 (不阻止對話)
exit 0