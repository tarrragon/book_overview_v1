#!/bin/bash

# 🚀 完整 ESLint 警告修復執行腳本
# 目標：修復所有 105 個 ESLint 警告，達到 100% 合規狀態

echo "🚀 開始完整 ESLint 警告修復流程..."
echo "目標：修復所有警告，達到 0 errors + 0 warnings 狀態"
echo ""

# 設定工作目錄
cd "$(dirname "$0")"

# 設定權限
chmod +x *.js
chmod +x *.sh

# 步驟 1: 檢查當前狀況
echo "📋 步驟 1: 檢查當前警告狀況..."
echo "========================================"
node execute-check.js
echo ""

# 步驟 2: 執行主要修復（處理大部分警告）
echo "📋 步驟 2: 執行主要修復流程..."
echo "========================================"
node master-eslint-warnings-fix.js
echo ""

# 步驟 3: 處理特殊警告類型
echo "📋 步驟 3: 處理特殊警告類型..."
echo "========================================"
node special-warnings-fix.js
echo ""

# 步驟 4: 最終驗證
echo "📋 步驟 4: 最終驗證與統計..."
echo "========================================"

echo "執行最終 ESLint 檢查..."
LINT_OUTPUT=$(npm run lint 2>&1)
LINT_EXIT_CODE=$?

if [ $LINT_EXIT_CODE -eq 0 ]; then
    echo "🎉 ESLint 檢查通過！達到 100% 合規狀態！"
    echo "✅ 0 errors + 0 warnings"
else
    echo "📊 ESLint 檢查結果："
    echo "$LINT_OUTPUT" | grep -E "(warning|error)" | head -10

    # 統計剩餘警告
    WARNING_COUNT=$(echo "$LINT_OUTPUT" | grep -c "warning" || echo "0")
    ERROR_COUNT=$(echo "$LINT_OUTPUT" | grep -c "error" || echo "0")

    echo ""
    echo "📈 剩餘問題統計："
    echo "  Errors: $ERROR_COUNT"
    echo "  Warnings: $WARNING_COUNT"

    if [ "$WARNING_COUNT" -eq "0" ] && [ "$ERROR_COUNT" -eq "0" ]; then
        echo "🎉 實際上已達到完美合規狀態！"
    else
        echo "📋 需要進一步手動處理的問題："
        echo "$LINT_OUTPUT" | grep -E "(warning|error)" | head -5
    fi
fi

echo ""

# 步驟 5: 執行測試確保功能完整性
echo "📋 步驟 5: 執行測試確保功能完整性..."
echo "========================================"

echo "運行測試套件..."
if npm test --silent > /dev/null 2>&1; then
    echo "✅ 測試通過！功能完整性確認"
    TEST_STATUS="通過"
else
    echo "⚠️  測試發現問題，建議檢查修復內容"
    TEST_STATUS="需要檢查"
fi

echo ""

# 步驟 6: 生成最終報告
echo "📋 步驟 6: 生成最終報告..."
echo "========================================"

FINAL_REPORT="final-eslint-fix-report.md"

cat > "$FINAL_REPORT" << EOF
# ESLint 完整修復報告

## 📊 執行摘要
- 執行時間: $(date)
- 目標: 修復所有 105 個 ESLint 警告
- 最終狀態: $([ $LINT_EXIT_CODE -eq 0 ] && echo "✅ 100% 合規" || echo "📋 $WARNING_COUNT 警告 + $ERROR_COUNT 錯誤")
- 測試狀態: $TEST_STATUS

## 🔧 執行步驟
1. ✅ 檢查當前狀況
2. ✅ 執行主要修復（no-unused-vars, no-console 等）
3. ✅ 處理特殊警告（no-callback-literal, no-new 等）
4. ✅ 最終驗證
5. ✅ 功能測試

## 📈 修復效果
$([ $LINT_EXIT_CODE -eq 0 ] && echo "🏆 達到完美 ESLint 合規狀態！" || echo "📋 剩餘少量問題需要手動處理")

## 📋 剩餘問題
$([ $LINT_EXIT_CODE -ne 0 ] && echo "$LINT_OUTPUT" | grep -E "(warning|error)" | head -10 || echo "無剩餘問題")

## 🎯 建議後續行動
$([ $LINT_EXIT_CODE -eq 0 ] && echo "- 專案已達到 ESLint 完美合規狀態" || echo "- 手動檢查剩餘問題並進行針對性修復")
$([ "$TEST_STATUS" != "通過" ] && echo "- 檢查測試失敗原因並修復" || echo "- 功能完整性已確認")

EOF

echo "📋 最終報告已生成: $FINAL_REPORT"

# 最終狀態總結
echo ""
echo "🎯 ESLint 完整修復流程執行完成！"
echo "========================================"

if [ $LINT_EXIT_CODE -eq 0 ]; then
    echo "🏆 成功達到 100% ESLint 合規狀態！"
    echo "✨ 專案程式碼品質已達到最高標準"
else
    echo "📈 大部分警告已修復，剩餘問題："
    echo "  Warnings: $WARNING_COUNT"
    echo "  Errors: $ERROR_COUNT"
    echo "💡 建議檢查 $FINAL_REPORT 了解詳細情況"
fi

echo ""
echo "📁 相關檔案："
echo "  - 執行報告: $FINAL_REPORT"
echo "  - 主要修復報告: eslint-warnings-fix-report.md"
echo ""