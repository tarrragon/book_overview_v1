#!/bin/bash

# fix-mode-complete.sh
# 修復模式完成腳本 - 手動確認修復完成並移除修復模式

# 設定路徑
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIX_MODE_FILE="$PROJECT_ROOT/.claude/TASK_AVOIDANCE_FIX_MODE"

cd "$PROJECT_ROOT"

echo "🔧 修復模式完成確認"
echo ""

# 檢查是否處於修復模式
if [ ! -f "$FIX_MODE_FILE" ]; then
    echo "ℹ️  系統未處於修復模式"
    echo "✅ 修復完成確認"
    exit 0
fi

echo "📋 修復模式資訊:"
cat "$FIX_MODE_FILE"
echo ""

# 移除修復模式 (讓主線程控制修復狀態)
echo "1. 完成修復..."
echo "✅ 移除修復模式檔案"
rm -f "$FIX_MODE_FILE"
echo "   ✅ 修復模式已移除"

echo ""
echo "🎉 修復完成！系統已恢復正常逃避檢查模式"
echo ""
echo "下次檢測到逃避行為時將重新啟動修復模式"
