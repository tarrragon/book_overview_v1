#!/bin/bash

# 最終清理所有 StandardError - 達成 100% ESLint 合規
# 這是實現零錯誤目標的決定性行動

echo "🎯 開始最終階段 StandardError 全面清理..."
echo "📊 目標：100% ESLint 合規，零 StandardError 殘留"

# 統計起始狀態
original_errors=$(npm run lint 2>&1 | grep -c "StandardError 已棄用" || echo 0)
echo "📊 起始 StandardError 錯誤數：$original_errors"

# 優先處理的檔案清單（按重要性排序）
priority_files=(
    "/Users/tarragon/Projects/book_overview_v1/tests/unit/core/errors/standard-error.test.js"
    "/Users/tarragon/Projects/book_overview_v1/tests/helpers/runtime-messaging-validator.js"
    "/Users/tarragon/Projects/book_overview_v1/tests/helpers/e2e-integration-test-coordinator.js"
    "/Users/tarragon/Projects/book_overview_v1/tests/utils/error-test-data-factory.js"
    "/Users/tarragon/Projects/book_overview_v1/tests/unit/export/export-manager.test.js"
    "/Users/tarragon/Projects/book_overview_v1/tests/utils/error-injector.js"
    "/Users/tarragon/Projects/book_overview_v1/tests/utils/error-injector-refactored.js"
    "/Users/tarragon/Projects/book_overview_v1/tests/unit/core/errors/operation-result.test.js"
    "/Users/tarragon/Projects/book_overview_v1/src/core/migration/StandardErrorMigrationAnalyzer.js"
)

# 計數器
total_files=${#priority_files[@]}
processed_files=0
successful_fixes=0
failed_fixes=0

echo "📂 即將處理 $total_files 個優先檔案"

for file in "${priority_files[@]}"; do
    if [ -f "$file" ]; then
        echo ""
        echo "🔄 [$((processed_files + 1))/$total_files] 處理: $(basename "$file")"

        # 檢查檔案是否有 StandardError
        error_count=$(grep -c "new StandardError" "$file" 2>/dev/null || echo 0)

        if [ "$error_count" -gt 0 ]; then
            echo "   📊 發現 $error_count 個 StandardError 實例"

            # 執行修復
            if /Users/tarragon/Projects/book_overview_v1/scripts/fix-standarderror-universal.sh "$file"; then
                echo "   ✅ 修復成功"
                ((successful_fixes++))
            else
                echo "   ❌ 修復失敗"
                ((failed_fixes++))
            fi
        else
            echo "   ✅ 檔案已清潔，無需處理"
            ((successful_fixes++))
        fi
    else
        echo "   ⚠️  檔案不存在: $(basename "$file")"
        ((failed_fixes++))
    fi

    ((processed_files++))

    # 每5個檔案檢查一次進度
    if [ $((processed_files % 5)) -eq 0 ]; then
        current_errors=$(npm run lint 2>&1 | grep -c "StandardError 已棄用" || echo 0)
        echo "   📊 當前 StandardError 錯誤數：$current_errors"
    fi
done

echo ""
echo "🔍 搜尋所有剩餘的 StandardError 檔案..."

# 找出所有剩餘的檔案
remaining_files=$(find /Users/tarragon/Projects/book_overview_v1/src /Users/tarragon/Projects/book_overview_v1/tests -name "*.js" -not -path "*/backup*/*" | xargs grep -l "new StandardError" 2>/dev/null | head -20)

if [ -n "$remaining_files" ]; then
    echo "📂 發現剩餘檔案，繼續批量處理..."

    while IFS= read -r file; do
        if [ -f "$file" ]; then
            echo "🔄 處理剩餘檔案: $(basename "$file")"

            error_count=$(grep -c "new StandardError" "$file" 2>/dev/null || echo 0)
            if [ "$error_count" -gt 0 ]; then
                /Users/tarragon/Projects/book_overview_v1/scripts/fix-standarderror-universal.sh "$file"
            fi
        fi
    done <<< "$remaining_files"
fi

echo ""
echo "🎯 最終驗證階段..."

# 最終統計
final_errors=$(npm run lint 2>&1 | grep -c "StandardError 已棄用" || echo 0)
total_eslint_errors=$(npm run lint 2>&1 | grep -E "problem|error" | tail -1 | grep -o '[0-9]\+ errors' | grep -o '[0-9]\+' || echo 0)

echo ""
echo "🏆 最終清理報告"
echo "=================="
echo "📊 起始 StandardError 錯誤：$original_errors"
echo "📊 最終 StandardError 錯誤：$final_errors"
echo "📊 減少的錯誤數量：$((original_errors - final_errors))"
echo "📊 處理的檔案總數：$processed_files"
echo "📊 成功修復檔案：$successful_fixes"
echo "📊 失敗檔案：$failed_fixes"
echo "📊 總 ESLint 錯誤數：$total_eslint_errors"

if [ "$final_errors" -eq 0 ]; then
    echo ""
    echo "🎉 恭喜！已達成 StandardError 零錯誤目標！"
    echo "🎯 StandardError 系統已100%棄用"

    if [ "$total_eslint_errors" -eq 0 ]; then
        echo "🏆 完美！已達成 100% ESLint 合規！"
    else
        echo "📊 仍需處理 $total_eslint_errors 個其他 ESLint 錯誤"
    fi
else
    echo ""
    echo "⚠️  仍有 $final_errors 個 StandardError 錯誤需要手動處理"
    echo "🔍 執行以下指令查看詳細位置："
    echo "npm run lint 2>&1 | grep 'StandardError 已棄用'"
fi

echo ""
echo "🎯 最終清理任務完成！"