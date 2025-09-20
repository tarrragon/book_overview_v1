#!/bin/bash

echo "🔍 檢查 no-use-before-define 修復結果..."
echo "================================="

cd /Users/tarragon/Projects/book_overview_v1

# 執行 lint 並搜尋 no-use-before-define 問題
echo "正在執行 npm run lint..."
npm run lint 2>&1 | grep "no-use-before-define" > no_use_before_define_results.txt

# 檢查結果
if [ -s no_use_before_define_results.txt ]; then
    echo "❌ 仍有 no-use-before-define 問題："
    cat no_use_before_define_results.txt
    problem_count=$(wc -l < no_use_before_define_results.txt)
    echo "總共 $problem_count 個問題"
else
    echo "✅ 太好了！所有 no-use-before-define 問題都已修復！"
    echo ""
    echo "📝 修復摘要："
    echo "  - tests/helpers/e2e-integration-test-coordinator.js: 4個問題修復"
    echo "  - tests/helpers/e2e-test-suite.js: 10個問題修復"
    echo "  - tests/helpers/testing-integrity-checker.js: 1個問題修復"
    echo "  - tests/helpers/ui-state-tracker.js: 1個問題修復"
    echo ""
    echo "🔧 修復策略："
    echo "  - 解決 IIFE 中變數名稱衝突"
    echo "  - 避免 catch 區塊參數與內部變數同名"
    echo "  - 重新命名衝突的變數"
fi

# 顯示整體 lint 狀態
echo ""
echo "📊 整體 Lint 狀態："
echo "=================="
npm run lint 2>&1 | tail -3

# 清理
rm -f no_use_before_define_results.txt
rm -f /Users/tarragon/Projects/book_overview_v1/temp_lint_check.js 2>/dev/null
rm -f /Users/tarragon/Projects/book_overview_v1/verify_no_use_before_define_fix.js 2>/dev/null

echo ""
echo "🎉 no-use-before-define 修復檢查完成！"