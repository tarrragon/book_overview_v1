#!/bin/bash

echo "🚀 執行最終大規模 ESLint warnings 修復..."

# 切換到專案目錄
cd /Users/tarragon/Projects/book_overview_v1

# 執行修復程式
node fix-warnings-batch.js

echo ""
echo "✅ 修復程式執行完成！"