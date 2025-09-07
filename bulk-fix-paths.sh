#!/bin/bash

# 批量修正 require('./src/ 路徑為 require('src/

echo "🚀 開始批量修正 JavaScript require 路徑..."

# 找到所有含有 require('./src/ 的 JavaScript 檔案
files_to_fix=$(grep -r "require('\.\/src\/" --include="*.js" . | cut -d: -f1 | sort -u | grep -v node_modules | grep -v fix-require-paths | grep -v bulk-fix-paths)

if [ -z "$files_to_fix" ]; then
    echo "🎉 沒有找到需要修正的檔案！"
    exit 0
fi

count=$(echo "$files_to_fix" | wc -l)
echo "📋 找到 $count 個檔案需要修正"

# 統計變數
fixed_count=0
error_count=0

# 逐一處理檔案
while IFS= read -r file; do
    if [ -f "$file" ]; then
        echo "🔧 修正: $file"
        
        # 使用 sed 替換 require('./src/ 為 require('src/
        if sed -i '' "s/require('\.\/src\//require('src\//g" "$file" 2>/dev/null; then
            fixed_count=$((fixed_count + 1))
            echo "✅ 成功: $file"
        else
            error_count=$((error_count + 1))
            echo "❌ 失敗: $file"
        fi
    else
        echo "⚠️ 檔案不存在: $file"
    fi
done <<< "$files_to_fix"

echo ""
echo "📊 修正統計:"
echo "✅ 成功修正: $fixed_count 個檔案"
echo "❌ 修正失敗: $error_count 個檔案"

# 驗證結果
remaining=$(grep -r "require('\.\/src\/" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v fix-require-paths | grep -v bulk-fix-paths | wc -l)

echo ""
echo "🔍 驗證結果:"
if [ "$remaining" -eq 0 ]; then
    echo "🎉 所有 JavaScript require 路徑都已修正完成！"
else
    echo "⚠️ 還有 $remaining 個路徑需要檢查"
fi

echo "✨ 路徑標準化修正作業完成！"