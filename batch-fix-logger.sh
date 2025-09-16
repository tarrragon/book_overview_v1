#!/bin/bash

echo "🚀 開始批量修復 Logger 使用方式..."

# 找出所有使用 createLogger 的檔案
files=$(find src/ -name "*.js" -exec grep -l "createLogger" {} \;)

echo "📁 找到 $(echo "$files" | wc -l) 個檔案需要修改"

# 對每個檔案進行替換
for file in $files; do
    echo "🔧 修復: $file"
    
    # 替換 import/require 語句
    sed -i '' 's/const { createLogger }/const { Logger }/g' "$file"
    sed -i '' 's/createLogger(/new Logger(/g' "$file"
    
    echo "✅ 完成: $file"
done

echo "🎉 批量修復完成！"
echo "📊 修改檔案總數: $(echo "$files" | wc -l)"

# 檢查修復結果
echo "🔍 檢查修復結果..."
remaining=$(find src/ -name "*.js" -exec grep -l "createLogger" {} \; 2>/dev/null | wc -l)
echo "📋 剩餘未修復: $remaining 個檔案"

if [ "$remaining" -eq 0 ]; then
    echo "✨ 所有檔案修復完成！"
else
    echo "⚠️  還有檔案需要手動檢查"
    find src/ -name "*.js" -exec grep -l "createLogger" {} \;
fi