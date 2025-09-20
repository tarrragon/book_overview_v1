#!/bin/bash

# 修復剩餘的 IIFE 語法錯誤 - 第二批
echo "🔧 繼續修復 IIFE 語法錯誤（第二批）..."

# 檢查當前錯誤數
error_count_before=$(npm run lint 2>&1 | grep "Parsing error: Unexpected token ;" | wc -l | tr -d ' ')
echo "修復前語法錯誤數: $error_count_before"

# 批量修復所有剩餘檔案
echo "🚀 開始批量修復..."

# 找出所有仍有語法錯誤的檔案
files_with_errors=$(npm run lint 2>&1 | grep "Parsing error: Unexpected token ;" | cut -d: -f1 | sort -u)

echo "📂 需要修復的檔案:"
echo "$files_with_errors" | head -5

# 對每個檔案執行快速修復
echo "$files_with_errors" | head -10 | while read file; do
    if [ -f "$file" ]; then
        echo "🔧 修復: $file"

        # 備份
        cp "$file" "$file.bak"

        # 使用 Perl 進行精確的一次性修復
        # 模式：new Error(ERROR_CODE; -> new Error('error message'); error.code = ErrorCodes.ERROR_CODE;
        perl -i -pe '
        s/new Error\(([A-Z_]+);(\s*error\.details\s*=)/new Error("error occurred"); error.code = ErrorCodes.$1;$2/g;
        ' "$file"

        # 檢查修復效果
        syntax_errors=$(node -c "$file" 2>&1 | grep -c "SyntaxError" || echo "0")
        if [ "$syntax_errors" -eq 0 ]; then
            echo "  ✅ 修復成功"
            rm -f "$file.bak"
        else
            echo "  ⚠️  語法仍有問題，嘗試進階修復"
            # 恢復並嘗試其他方法
            cp "$file.bak" "$file"

            # 更寬鬆的替換
            sed -i.tmp "s/new Error(\([A-Z_]*\);/new Error('error'); error.code = ErrorCodes.\1;/g" "$file"
            rm -f "$file.tmp"

            # 再次檢查
            syntax_errors2=$(node -c "$file" 2>&1 | grep -c "SyntaxError" || echo "0")
            if [ "$syntax_errors2" -eq 0 ]; then
                echo "  ✅ 進階修復成功"
                rm -f "$file.bak"
            else
                echo "  ❌ 修復失敗，保留備份"
            fi
        fi
    fi
done

# 檢查結果
echo ""
echo "📊 修復結果："
error_count_after=$(npm run lint 2>&1 | grep "Parsing error: Unexpected token ;" | wc -l | tr -d ' ')
echo "修復後語法錯誤數: $error_count_after"

if [ "$error_count_after" -lt "$error_count_before" ]; then
    reduced=$((error_count_before - error_count_after))
    echo "✅ 此批次修復了 $reduced 個語法錯誤"
else
    echo "⚠️  此批次未能減少錯誤數量"
fi

echo "🎯 剩餘語法錯誤: $error_count_after"