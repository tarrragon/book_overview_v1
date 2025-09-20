#!/bin/bash

# 修復 IIFE 模式中的語法錯誤
# 主要問題：new Error(ERROR_CODE; 格式錯誤

echo "🔧 開始修復 IIFE 語法錯誤..."

# 先建立錯誤清單
echo "📊 檢查當前語法錯誤數量..."
error_count_before=$(npm run lint 2>&1 | grep "Parsing error: Unexpected token ;" | wc -l | tr -d ' ')
echo "修復前語法錯誤數: $error_count_before"

# 搜尋需要修復的檔案
files_to_fix=$(grep -rl "new Error([A-Z_][A-Z_]*;" tests/ --include="*.js" 2>/dev/null | sort -u)

if [ -z "$files_to_fix" ]; then
    echo "❌ 未找到需要修復的檔案"
    exit 1
fi

echo "📂 發現需要修復的檔案:"
echo "$files_to_fix" | while read file; do
    echo "  - $file"
done

# 修復每個檔案
echo "$files_to_fix" | while read file; do
    if [ ! -f "$file" ]; then
        continue
    fi

    echo "🔧 處理檔案: $file"

    # 備份原檔案
    cp "$file" "$file.bak"

    # 修復 IIFE 語法錯誤
    # 模式 1: new Error(ERROR_CODE; -> new Error('error message'); error.code = ErrorCodes.ERROR_CODE;
    # 這是最常見的錯誤模式

    # 先找出所有錯誤代碼
    error_codes=$(grep -o "new Error([A-Z_][A-Z_]*;" "$file" | sed 's/new Error(//g' | sed 's/;//g' | sort -u)

    if [ -n "$error_codes" ]; then
        echo "  📝 發現錯誤代碼: $error_codes"

        # 對每個錯誤代碼進行修復
        echo "$error_codes" | while read error_code; do
            if [ -n "$error_code" ]; then
                echo "    🔄 修復錯誤代碼: $error_code"

                # 生成錯誤訊息（從錯誤代碼推導）
                error_message=$(echo "$error_code" | tr '[:upper:]' '[:lower:]' | sed 's/_/ /g')

                # 替換模式：
                # new Error(ERROR_CODE; error.details =
                # ->
                # new Error('error message'); error.code = ErrorCodes.ERROR_CODE; error.details =
                sed -i.tmp "s/new Error($error_code; error\.details =/new Error('$error_message'); error.code = ErrorCodes.$error_code; error.details =/g" "$file"
            fi
        done

        # 清理臨時檔案
        rm -f "$file.tmp"
    fi

    # 驗證修復結果
    syntax_errors=$(npm run lint "$file" 2>&1 | grep "Parsing error" | wc -l | tr -d ' ')
    if [ "$syntax_errors" -eq 0 ]; then
        echo "  ✅ $file 修復成功"
        rm -f "$file.bak"
    else
        echo "  ⚠️  $file 仍有語法錯誤，嘗試進階修復..."

        # 進階修復：處理更複雜的情況
        # 如果第一輪修復不成功，嘗試更寬鬆的模式匹配

        # 恢復備份並嘗試其他修復方式
        cp "$file.bak" "$file"

        # 使用更精確的正則表達式修復
        perl -i -pe 's/new Error\(([A-Z_]+);([^}]+})/new Error("error occurred"); error.code = ErrorCodes.$1;$2/g' "$file"

        # 再次檢查
        syntax_errors_after=$(npm run lint "$file" 2>&1 | grep "Parsing error" | wc -l | tr -d ' ')
        if [ "$syntax_errors_after" -eq 0 ]; then
            echo "  ✅ $file 進階修復成功"
            rm -f "$file.bak"
        else
            echo "  ❌ $file 修復失敗，保留備份"
        fi
    fi
done

echo ""
echo "🔍 修復完成，檢查結果..."

# 檢查修復後的語法錯誤數量
error_count_after=$(npm run lint 2>&1 | grep "Parsing error: Unexpected token ;" | wc -l | tr -d ' ')
echo "修復後語法錯誤數: $error_count_after"

if [ "$error_count_after" -lt "$error_count_before" ]; then
    reduced=$((error_count_before - error_count_after))
    echo "✅ 成功修復 $reduced 個語法錯誤！"
else
    echo "⚠️  語法錯誤數量未減少，需要手動檢查"
fi

# 總體 ESLint 狀態
echo ""
echo "📊 總體 ESLint 狀態："
total_errors=$(npm run lint 2>&1 | grep -E "^[[:space:]]*[0-9]+:[0-9]+[[:space:]]+error" | wc -l | tr -d ' ')
echo "總錯誤數: $total_errors"

if [ "$total_errors" -eq 0 ]; then
    echo "🎉 達成 100% ESLint 合規！"
else
    echo "⏳ 剩餘錯誤需要進一步處理"
fi