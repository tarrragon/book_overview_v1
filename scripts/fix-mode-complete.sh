#!/bin/bash

# fix-mode-complete.sh
# 完成修復模式的腳本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIX_MODE_FILE="$PROJECT_ROOT/.claude/TASK_AVOIDANCE_FIX_MODE"

echo "🔧 完成修復模式"

if [ -f "$FIX_MODE_FILE" ]; then
    echo "✅ 移除修復模式檔案"
    rm -f "$FIX_MODE_FILE"
    echo "🎉 修復模式已完成，系統恢復正常檢查狀態"
else
    echo "ℹ️  系統未處於修復模式"
fi

echo "✅ 修復完成確認"