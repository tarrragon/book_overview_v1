#!/bin/bash

# 批量修復錯誤適配器的 ES Module 問題
# 將 ES Module 語法轉換為 CommonJS 語法

echo "🔧 開始批量修復錯誤適配器模組語法..."

# 找出所有錯誤適配器檔案
error_files=$(find /Users/tarragon/Projects/book_overview_v1/src/core/errors -name "UC*ErrorAdapter.js" -o -name "UC*ErrorFactory.js")

total_files=$(echo "$error_files" | wc -l)
echo "📊 找到 $total_files 個檔案需要修復"

processed=0

for file in $error_files; do
    echo "🔄 處理: $(basename "$file")"

    # 1. 修復 import 語句
    sed -i '' 's/import { ErrorCodes } from .*ErrorCodes.*js.*/const { ErrorCodes } = require(".\/ErrorCodes")/g' "$file"

    # 2. 修復 export class 語句
    sed -i '' 's/export class \([A-Z][A-Za-z0-9]*\)/class \1/g' "$file"

    # 3. 提取類名並添加 module.exports
    class_name=$(grep -o "class [A-Z][A-Za-z0-9]*" "$file" | head -1 | cut -d' ' -f2)

    if [ -n "$class_name" ]; then
        # 檢查是否已經有 module.exports
        if ! grep -q "module.exports" "$file"; then
            echo "" >> "$file"
            echo "module.exports = { $class_name }" >> "$file"
        fi
    fi

    processed=$((processed + 1))
    echo "✅ 已處理: $processed/$total_files"
done

echo "🎉 批量修復完成！處理了 $processed 個檔案"

# 驗證修復結果
echo "🔍 驗證修復結果..."
import_count=$(find /Users/tarragon/Projects/book_overview_v1/src/core/errors -name "UC*Error*.js" | xargs grep -c "import.*ErrorCodes" | grep -v ":0" | wc -l)
export_count=$(find /Users/tarragon/Projects/book_overview_v1/src/core/errors -name "UC*Error*.js" | xargs grep -c "export class" | grep -v ":0" | wc -l)

echo "📊 剩餘 ES Module 語法:"
echo "  - import 語句: $import_count 個檔案"
echo "  - export class 語句: $export_count 個檔案"

if [ "$import_count" -eq 0 ] && [ "$export_count" -eq 0 ]; then
    echo "✅ 所有檔案已成功轉換為 CommonJS 格式"
else
    echo "⚠️  仍有檔案需要手動檢查"
fi