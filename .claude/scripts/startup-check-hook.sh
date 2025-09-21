#!/bin/bash

# startup-check-hook.sh
# SessionStart Hook: 自動執行啟動檢查流程

# 設定路徑和日誌
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/.claude/hook-logs/startup-$(date +%Y%m%d_%H%M%S).log"

# 確保日誌目錄存在
mkdir -p "$PROJECT_ROOT/.claude/hook-logs"

# SessionStart 時總是執行清理 (因為是新會話開始)
"$SCRIPT_DIR/cleanup-hook-logs.sh" >/dev/null 2>&1 &

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
    "pubspec.yaml"
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

# 檢查 Flutter 依賴項
if [ -f "$PROJECT_ROOT/pubspec.lock" ]; then
    log "✅ pubspec.lock 存在，依賴項已解析"
else
    log "⚠️  pubspec.lock 不存在，可能需要執行 flutter pub get"
fi

# 檢查 .dart_tool 目錄
if [ -d "$PROJECT_ROOT/.dart_tool" ]; then
    log "✅ .dart_tool 目錄存在"
else
    log "⚠️  .dart_tool 目錄不存在，可能需要執行 flutter pub get"
fi

# 檢查當前版本 (從 pubspec.yaml)
if [ -f "$PROJECT_ROOT/pubspec.yaml" ]; then
    CURRENT_VERSION=$(grep '^version:' "$PROJECT_ROOT/pubspec.yaml" | sed 's/version: *//')
    if [ -n "$CURRENT_VERSION" ]; then
        log "📦 當前版本: $CURRENT_VERSION"
    else
        log "📦 版本未在 pubspec.yaml 中定義"
    fi
fi

# 檢查最新工作日誌
LATEST_WORKLOG=$(ls "$PROJECT_ROOT/docs/work-logs/" 2>/dev/null | grep '^v[0-9]' | sort -V | tail -1)
if [ -n "$LATEST_WORKLOG" ]; then
    log "📋 最新工作日誌: $LATEST_WORKLOG"
else
    log "⚠️  未找到工作日誌檔案"
fi

# 4. 專案規範文檔檢查
log "📋 專案規範文檔檢查"

# 檢查 Flutter 專案檔案
if [ -f "pubspec.yaml" ]; then
    log "✅ pubspec.yaml 存在 (Flutter 專案)"
else
    log "❌ pubspec.yaml 缺失"
fi

if [ -f "docs/README.md" ]; then
    log "✅ docs/README.md 存在 (文檔導引)"
else
    log "❌ docs/README.md 缺失"
fi

# 核心規範文檔
CORE_DOCS=(
    "docs/app-requirements-spec.md"
    "docs/app-use-cases.md"
    "docs/ui_design_specification.md"
    "docs/test-pyramid-design.md"
    "docs/code-quality-examples.md"
    "docs/app-error-handling-design.md"
    "test/TESTING_GUIDELINES.md"
)

MISSING_CORE_DOCS=0
for doc in "${CORE_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        log "✅ $doc 存在"
    else
        log "⚠️  $doc 缺失"
        MISSING_CORE_DOCS=$((MISSING_CORE_DOCS + 1))
    fi
done

# 架構與開發文檔
ARCH_DOCS=(
    "docs/event-driven-architecture-design.md"
    "docs/i18n_guide.md"
    "docs/terminology-dictionary.md"
)

MISSING_ARCH_DOCS=0
for doc in "${ARCH_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        log "✅ $doc 存在"
    else
        log "🔍 $doc 缺失 (可選)"
        MISSING_ARCH_DOCS=$((MISSING_ARCH_DOCS + 1))
    fi
done

# 文檔合規性摘要
if [ $MISSING_CORE_DOCS -eq 0 ]; then
    log "🎯 核心規範文檔完整 (0/${#CORE_DOCS[@]} 缺失)"
else
    log "⚠️  核心規範文檔不完整 ($MISSING_CORE_DOCS/${#CORE_DOCS[@]} 缺失)"
fi

# 5. 終端環境檢查
log "🖥️  終端環境已準備就緒"

# 6. 工作評估與建議
log "🎯 工作評估與下一步建議"

# 檢查 todolist.md 狀態
if [ -f "$PROJECT_ROOT/docs/todolist.md" ]; then
    TODO_ITEMS=$(grep -c "^-" "$PROJECT_ROOT/docs/todolist.md" 2>/dev/null || echo "0")
    log "📋 TodoList 項目數: $TODO_ITEMS"

    # 檢查是否有進行中的任務
    ACTIVE_TASKS=$(grep -c "🔄\|進行中\|in_progress" "$PROJECT_ROOT/docs/todolist.md" 2>/dev/null || echo "0")
    if [ "$ACTIVE_TASKS" -gt 0 ]; then
        log "⚡ 發現 $ACTIVE_TASKS 個進行中任務"
    fi
else
    log "⚠️  TodoList 檔案不存在"
fi

# 分析最新工作日誌狀態
if [ -n "$LATEST_WORKLOG" ]; then
    WORKLOG_PATH="$PROJECT_ROOT/docs/work-logs/$LATEST_WORKLOG"

    # 檢查工作日誌是否標記為完成
    if grep -q "版本交付\|🚀 版本交付\|## 🚀" "$WORKLOG_PATH" 2>/dev/null; then
        log "✅ 最新工作日誌已完成，建議評估版本推進"
        log "💡 建議行動: 執行 /smart-version-check 或檢視 todolist 下一個任務"
    elif grep -q "進行中\|開發中\|實作中" "$WORKLOG_PATH" 2>/dev/null; then
        log "🔄 最新工作日誌顯示工作進行中"
        log "💡 建議行動: 繼續完成當前工作日誌中的任務"
    else
        log "📋 最新工作日誌狀態不明確"
        log "💡 建議行動: 檢查工作日誌並確認當前狀態"
    fi

    # 檢查工作日誌的最後修改時間
    LAST_MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$WORKLOG_PATH" 2>/dev/null || echo "未知")
    log "⏰ 工作日誌最後修改: $LAST_MODIFIED"
else
    log "💡 建議行動: 建立新的工作日誌開始開發"
fi

# 檢查是否有測試需要修復 (基於當前修復模式狀態)
if [ -f "$PROJECT_ROOT/.claude/TASK_AVOIDANCE_FIX_MODE" ]; then
    log "🔧 系統處於修復模式 - 需要解決逃避行為問題"
    log "💡 優先行動: 檢查修復模式報告並解決問題"
fi

# 7. 生成啟動報告摘要
log "📊 啟動檢查完成，詳細記錄: $LOG_FILE"

# 返回成功狀態
exit 0