#!/bin/bash

# 精確修復特定檔案的 IIFE 語法錯誤
echo "🎯 精確修復語法錯誤的檔案..."

# 取得包含語法錯誤的檔案清單
files_with_syntax_errors=$(npm run lint 2>&1 | grep -B 1 "Parsing error: Unexpected token ;" | grep "^/" | sort -u)

echo "📂 發現語法錯誤的檔案:"
echo "$files_with_syntax_errors"

error_count_before=$(npm run lint 2>&1 | grep "Parsing error: Unexpected token ;" | wc -l | tr -d ' ')
echo "修復前語法錯誤數: $error_count_before"

# 修復每個檔案
echo "$files_with_syntax_errors" | while read file; do
    if [ -f "$file" ]; then
        echo ""
        echo "🔧 修復檔案: $file"

        # 備份檔案
        cp "$file" "$file.bak"

        # 檢查檔案中的錯誤模式
        error_patterns=$(grep -n "new Error([A-Z_][A-Z_]*;" "$file" | head -3)

        if [ -n "$error_patterns" ]; then
            echo "  📝 發現錯誤模式:"
            echo "$error_patterns" | sed 's/^/    /'

            # 執行修復
            # 模式 1: new Error(ERROR_CODE; error.details =
            # 修復為: new Error('error message'); error.code = ErrorCodes.ERROR_CODE; error.details =

            sed -i.tmp 's/new Error(\([A-Z_][A-Z_]*\); error\.details =/new Error("error occurred"); error.code = ErrorCodes.\1; error.details =/g' "$file"

            # 清理臨時檔案
            rm -f "$file.tmp"

            # 驗證修復
            syntax_check=$(node -c "$file" 2>&1 | grep "SyntaxError" | wc -l)
            if [ "$syntax_check" -eq 0 ]; then
                echo "  ✅ 修復成功"
                rm -f "$file.bak"
            else
                echo "  ⚠️  仍有語法問題，嘗試其他修復方式"
                # 恢復備份
                cp "$file.bak" "$file"

                # 嘗試更寬鬆的修復
                perl -i -pe 's/new Error\(([A-Z_]+);/new Error("error"); error.code = ErrorCodes.$1;/g' "$file"

                # 再次檢查
                syntax_check2=$(node -c "$file" 2>&1 | grep "SyntaxError" | wc -l)
                if [ "$syntax_check2" -eq 0 ]; then
                    echo "  ✅ 進階修復成功"
                    rm -f "$file.bak"
                else
                    echo "  ❌ 修復失敗，恢復原檔案"
                    cp "$file.bak" "$file"
                fi
            fi
        else
            echo "  ℹ️  未找到預期的錯誤模式，跳過"
            rm -f "$file.bak"
        fi
    fi
done

echo ""
echo "📊 修復完成，檢查結果..."

# 檢查最終結果
error_count_after=$(npm run lint 2>&1 | grep "Parsing error: Unexpected token ;" | wc -l | tr -d ' ')
echo "修復後語法錯誤數: $error_count_after"

if [ "$error_count_after" -lt "$error_count_before" ]; then
    reduced=$((error_count_before - error_count_after))
    echo "✅ 成功修復 $reduced 個語法錯誤！"
    echo "🎯 剩餘 $error_count_after 個語法錯誤需要進一步處理"
else
    echo "⚠️  語法錯誤數量未減少，可能需要手動檢查"
fi

# 總體狀態
echo ""
echo "📈 總體 ESLint 狀態："
total_errors=$(npm run lint 2>&1 | grep -E "^[[:space:]]*[0-9]+:[0-9]+[[:space:]]+error" | wc -l | tr -d ' ')
echo "總錯誤數: $total_errors"

if [ "$total_errors" -eq 0 ]; then
    echo "🎉 恭喜！達成 100% ESLint 合規！"
fi