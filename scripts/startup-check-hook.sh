#!/bin/bash

# startup-check-hook.sh
# SessionStart Hook: 自動執行啟動檢查流程

# 設定路徑和日誌
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/.claude/hook-logs/startup-$(date +%Y%m%d_%H%M%S).log"

# 確保日誌目錄存在
mkdir -p "$PROJECT_ROOT/.claude/hook-logs"

# 日誌函數
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🚀 SessionStart Hook: 開始執行啟動檢查"

# 1. Git 環境檢查
log "📊 Git 環境檢查"
cd "$PROJECT_ROOT"

# 檢查 Git 狀態
git fetch origin &>/dev/null
GIT_STATUS=$(git status --porcelain)
CURRENT_BRANCH=$(git branch --show-current)
COMMIT_COUNT=$(git log --oneline -3 | wc -l)

if [ -n "$GIT_STATUS" ]; then
    log "⚠️  工作目錄有未提交變更"
else
    log "✅ 工作目錄乾淨"
fi

log "📍 當前分支: $CURRENT_BRANCH"
log "📝 最近提交數: $COMMIT_COUNT"

# 2. 專案檔案載入確認
log "📁 專案檔案載入確認"
KEY_FILES=(
    "CLAUDE.md"
    "docs/todolist.md"
    "package.json"
    "docs/claude/tdd-collaboration-flow.md"
    "docs/claude/document-responsibilities.md"
)

for file in "${KEY_FILES[@]}"; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        log "✅ $file 存在"
    else
        log "❌ $file 缺失"
    fi
done

# 3. 開發狀態檢查
log "🔧 開發狀態檢查"

# 檢查依賴項
if [ -d "$PROJECT_ROOT/node_modules" ]; then
    log "✅ node_modules 存在"
else
    log "⚠️  node_modules 不存在，可能需要執行 npm install"
fi

# 檢查當前版本
if [ -f "$PROJECT_ROOT/package.json" ]; then
    CURRENT_VERSION=$(grep '"version"' "$PROJECT_ROOT/package.json" | cut -d'"' -f4)
    log "📦 當前版本: $CURRENT_VERSION"
fi

# 檢查最新工作日誌
LATEST_WORKLOG=$(ls "$PROJECT_ROOT/docs/work-logs/" 2>/dev/null | grep '^v[0-9]' | sort -V | tail -1)
if [ -n "$LATEST_WORKLOG" ]; then
    log "📋 最新工作日誌: $LATEST_WORKLOG"
else
    log "⚠️  未找到工作日誌檔案"
fi

# 4. TMux 環境檢查
if [ -n "$TMUX" ]; then
    PANE_COUNT=$(tmux list-panes 2>/dev/null | wc -l)
    log "🖥️  TMux 環境: $PANE_COUNT 個面板"

    # 檢查是否有面板3 (Git操作面板)
    if tmux list-panes 2>/dev/null | grep -q "^3:"; then
        log "✅ 面板3 (Git操作面板) 已準備"
    else
        log "💡 建議設定面板3作為Git操作面板"
    fi
else
    log "📟 非TMux環境"
fi

# 5. 生成啟動報告摘要
log "📊 啟動檢查完成，詳細記錄: $LOG_FILE"

# 返回成功狀態
exit 0