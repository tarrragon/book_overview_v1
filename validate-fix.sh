#!/bin/bash

echo "🔍 驗證 no-unused-vars 修復效果..."
echo ""

# 執行 ESLint 檢查
echo "📊 執行 ESLint 檢查..."

# 統計 no-unused-vars 警告數量
UNUSED_VARS_COUNT=$(npm run lint 2>&1 | grep -c "no-unused-vars" || echo "0")

echo "結果: 找到 $UNUSED_VARS_COUNT 個 no-unused-vars 警告"

if [ "$UNUSED_VARS_COUNT" -eq 0 ]; then
    echo "✅ 成功！所有 no-unused-vars 警告已修復"
    exit 0
else
    echo ""
    echo "⚠️ 剩餘的 no-unused-vars 警告:"
    echo "═══════════════════════════════════════"
    npm run lint 2>&1 | grep "no-unused-vars" | head -20

    if [ "$UNUSED_VARS_COUNT" -gt 20 ]; then
        echo "... 還有 $((UNUSED_VARS_COUNT - 20)) 個警告"
    fi

    echo ""
    echo "💡 建議接下來的操作:"
    echo "1. 檢查剩餘警告是否為必要的引用"
    echo "2. 為必要引用添加 eslint-disable 註解"
    echo "3. 移除真正未使用的變數"

    exit 1
fi