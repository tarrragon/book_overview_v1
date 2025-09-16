#!/bin/bash

echo "🔍 檢查 no-unused-vars 警告..."

# 執行 eslint 並獲取 no-unused-vars 警告
npx eslint src/ tests/ 2>&1 | grep "no-unused-vars" > unused-vars-temp.txt

echo "📊 找到的 no-unused-vars 警告:"
cat unused-vars-temp.txt | head -20

echo ""
echo "統計: $(cat unused-vars-temp.txt | wc -l) 個 no-unused-vars 警告"

# 清理臨時文件
rm -f unused-vars-temp.txt