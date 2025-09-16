#!/bin/bash

echo "🔍 獲取當前 no-unused-vars 警告..."

# 執行 lint 並過濾 no-unused-vars 警告
npx eslint src/ tests/ 2>&1 | grep "no-unused-vars" | head -20

echo "📊 統計 no-unused-vars 警告數量..."
count=$(npx eslint src/ tests/ 2>&1 | grep "no-unused-vars" | wc -l)
echo "總計 no-unused-vars 警告: $count 個"