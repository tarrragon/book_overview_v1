#!/bin/bash

cd /Users/tarragon/Projects/book_overview_v1

echo "🔧 執行自動 ESLint 修復..."
echo ""

# 記錄修復前的狀態
echo "📊 修復前的狀態："
npm run lint 2>&1 | grep -E "(✖|problems|errors|warnings)" | tail -1

echo ""
echo "🔄 執行 npm run lint:fix..."

# 執行自動修復
npm run lint:fix

echo ""
echo "📊 修復後的狀態："
npm run lint 2>&1 | grep -E "(✖|problems|errors|warnings)" | tail -1

echo ""
echo "🔍 剩餘的 no-unused-vars 警告："
npm run lint 2>&1 | grep "no-unused-vars" | wc -l | tr -d ' ' | xargs -I {} echo "找到 {} 個 no-unused-vars 警告"

# 如果還有 no-unused-vars 警告，顯示前幾個
remaining=$(npm run lint 2>&1 | grep "no-unused-vars" | wc -l | tr -d ' ')
if [ "$remaining" -gt 0 ]; then
    echo ""
    echo "前 10 個剩餘的 no-unused-vars 警告："
    npm run lint 2>&1 | grep "no-unused-vars" | head -10
else
    echo "✅ 所有 no-unused-vars 警告已修復！"
fi