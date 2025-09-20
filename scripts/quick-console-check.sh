#!/bin/bash

echo "🔍 快速檢查 no-console 警告..."

# 只檢查 src 目錄中的未修復檔案
find src/ -name "*.js" -type f -exec grep -l "console\." {} \; | while read file; do
    echo "📄 檢查 $file"

    # 檢查是否已有 eslint-disable 註解
    grep -B1 "console\." "$file" | grep -q "eslint-disable-next-line no-console"
    if [ $? -ne 0 ]; then
        echo "   ⚠️  可能需要修復"
        grep -n "console\." "$file" | head -3
        echo
    fi
done

echo "✅ 檢查完成"