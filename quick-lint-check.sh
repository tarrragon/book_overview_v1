#!/bin/bash

cd /Users/tarragon/Projects/book_overview_v1

echo "🔍 執行 ESLint 檢查 no-unused-vars 警告..."
echo ""

# 執行 lint 並將輸出保存到檔案
npm run lint 2>&1 | tee current-lint-full.txt

echo ""
echo "📊 篩選 no-unused-vars 警告..."

# 篩選出 no-unused-vars 警告
grep "no-unused-vars" current-lint-full.txt | grep -v "eslint-disable" > current-unused-vars.txt

# 顯示統計
unused_count=$(wc -l < current-unused-vars.txt | tr -d ' ')
echo "找到 $unused_count 個 no-unused-vars 警告"

if [ "$unused_count" -gt 0 ]; then
    echo ""
    echo "📋 前 20 個 no-unused-vars 警告："
    head -20 current-unused-vars.txt

    echo ""
    echo "💾 完整清單已保存到 current-unused-vars.txt"
else
    echo "✅ 沒有發現 no-unused-vars 警告"
fi