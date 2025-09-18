#!/bin/bash

# task-avoidance-block-check.sh
# PreToolUse Hook: 檢查是否存在任務逃避阻止狀態

# 設定路徑
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BLOCK_FILE="$PROJECT_ROOT/.claude/TASK_AVOIDANCE_BLOCK"

cd "$PROJECT_ROOT"

# 檢查是否存在阻止檔案
if [ -f "$BLOCK_FILE" ]; then
    echo ""
    echo "🚨🚨🚨 任務逃避阻止狀態 🚨🚨🚨"
    echo ""
    echo "❌ 偵測到任務逃避行為，當前操作被阻止"
    echo ""

    # 讀取阻止資訊
    if [ -r "$BLOCK_FILE" ]; then
        source "$BLOCK_FILE"
        echo "📋 阻止原因: $BLOCK_REASON"
        echo "⏰ 偵測時間: $DETECTION_TIME"
        echo "📄 詳細報告: $REPORT_FILE"
        echo "🔢 問題數量: $DETECTED_ISSUES_COUNT"
    fi

    echo ""
    echo "🔧 修正步驟:"
    echo "1. 查看詳細報告了解具體問題"
    echo "2. 按照永不放棄鐵律修正所有逃避行為"
    echo "3. 移除所有禁用詞彙並完整解決問題"
    echo "4. 確保所有測試通過且無 ESLint 錯誤"
    echo "5. 執行: rm .claude/TASK_AVOIDANCE_BLOCK"
    echo ""
    echo "💡 參考修正腳本: .claude/hook-logs/force-fix-avoidance.sh"
    echo ""
    echo "⚠️  在修正完成前，所有開發操作都將被阻止"
    echo ""

    # 返回錯誤狀態阻止操作
    exit 1
fi

# 沒有阻止狀態，允許繼續
exit 0