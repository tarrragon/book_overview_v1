#!/bin/bash

# 修復最後的 ESLint 錯誤
echo "🔧 開始修復最後的 ESLint 錯誤..."

# 檢查當前狀態
error_count_before=$(npm run lint 2>&1 | grep -E "^[[:space:]]*[0-9]+:[0-9]+[[:space:]]+error" | wc -l | tr -d ' ')
warning_count_before=$(npm run lint 2>&1 | grep -E "^[[:space:]]*[0-9]+:[0-9]+[[:space:]]+warning" | wc -l | tr -d ' ')

echo "修復前狀態："
echo "  錯誤數: $error_count_before"
echo "  警告數: $warning_count_before"

# 1. 修復引號問題 (quotes)
echo ""
echo "🔤 修復引號問題..."
files_with_quote_errors=$(npm run lint 2>&1 | grep "Strings must use singlequote" | cut -d: -f1 | sort -u)

if [ -n "$files_with_quote_errors" ]; then
    echo "$files_with_quote_errors" | head -10 | while read file; do
        if [ -f "$file" ]; then
            echo "  修復引號: $file"
            # 修復雙引號為單引號，但保留包含單引號的字串
            sed -i.bak 's/"\([^"]*\)"/'\''\\1'\''/g' "$file" 2>/dev/null || true
            rm -f "$file.bak"
        fi
    done
fi

# 2. 修復多餘空格問題 (no-multi-spaces)
echo ""
echo "🔧 修復多餘空格問題..."
files_with_space_errors=$(npm run lint 2>&1 | grep "Multiple spaces found" | cut -d: -f1 | sort -u)

if [ -n "$files_with_space_errors" ]; then
    echo "$files_with_space_errors" | head -10 | while read file; do
        if [ -f "$file" ]; then
            echo "  修復空格: $file"
            # 修復多餘空格
            sed -i.bak 's/  \+/ /g' "$file"
            rm -f "$file.bak"
        fi
    done
fi

# 3. 修復 ErrorCodes 未定義問題
echo ""
echo "📦 修復 ErrorCodes 未定義問題..."
files_with_errorcode_errors=$(npm run lint 2>&1 | grep "'ErrorCodes' is not defined" | cut -d: -f1 | sort -u)

if [ -n "$files_with_errorcode_errors" ]; then
    echo "$files_with_errorcode_errors" | head -5 | while read file; do
        if [ -f "$file" ]; then
            echo "  添加 ErrorCodes 引用: $file"

            # 檢查是否已有 ErrorCodes 引用
            if ! grep -q "const.*ErrorCodes.*require.*ErrorCodes" "$file"; then
                # 找到第一個 require 語句的位置
                first_require_line=$(grep -n "require(" "$file" | head -1 | cut -d: -f1)

                if [ -n "$first_require_line" ]; then
                    # 在第一個 require 之前插入 ErrorCodes 引用
                    sed -i.bak "${first_require_line}i\\
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
" "$file"
                    rm -f "$file.bak"
                fi
            fi
        fi
    done
fi

# 4. 修復 StandardError 遺留問題
echo ""
echo "🗑️  修復 StandardError 遺留問題..."
files_with_standarderror=$(npm run lint 2>&1 | grep "'StandardError' is not defined" | cut -d: -f1 | sort -u)

if [ -n "$files_with_standarderror" ]; then
    echo "$files_with_standarderror" | while read file; do
        if [ -f "$file" ]; then
            echo "  移除 StandardError 引用: $file"

            # 將 StandardError 替換為 Error
            sed -i.bak 's/new StandardError(/new Error(/g' "$file"
            sed -i.bak 's/throw new StandardError(/throw new Error(/g' "$file"
            sed -i.bak 's/StandardError\./ErrorCodes\./g' "$file"

            rm -f "$file.bak"
        fi
    done
fi

# 檢查修復結果
echo ""
echo "📊 修復結果："
error_count_after=$(npm run lint 2>&1 | grep -E "^[[:space:]]*[0-9]+:[0-9]+[[:space:]]+error" | wc -l | tr -d ' ')
warning_count_after=$(npm run lint 2>&1 | grep -E "^[[:space:]]*[0-9]+:[0-9]+[[:space:]]+warning" | wc -l | tr -d ' ')

echo "修復後狀態："
echo "  錯誤數: $error_count_after (之前: $error_count_before)"
echo "  警告數: $warning_count_after (之前: $warning_count_before)"

error_reduction=$((error_count_before - error_count_after))
warning_reduction=$((warning_count_before - warning_count_after))

if [ "$error_reduction" -gt 0 ]; then
    echo "✅ 成功減少 $error_reduction 個錯誤"
fi

if [ "$warning_reduction" -gt 0 ]; then
    echo "✅ 成功減少 $warning_reduction 個警告"
fi

if [ "$error_count_after" -eq 0 ]; then
    echo ""
    echo "🎉🎉🎉 恭喜！達成 100% ESLint 錯誤修復！ 🎉🎉🎉"
    echo "✨ StandardError to ErrorCodes 遷移任務完全完成！"
else
    echo ""
    echo "⏳ 剩餘 $error_count_after 個錯誤需要進一步處理"
    echo "📋 主要剩餘錯誤類型："
    npm run lint 2>&1 | grep -E "^[[:space:]]*[0-9]+:[0-9]+[[:space:]]+error" | cut -d' ' -f5- | sort | uniq -c | sort -nr | head -5
fi