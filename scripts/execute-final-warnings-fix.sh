#!/bin/bash

set -e

echo "🚀 啟動最終大規模 ESLint warnings 修復"
echo "目標：處理剩餘主要 warning 類型，朝向 100% 合規"
echo ""

# 記錄開始時間
start_time=$(date +%s)

# 1. 分析當前狀況
echo "🔍 步驟 1: 分析當前 warnings 狀況..."
chmod +x scripts/analyze-current-warnings.sh
./scripts/analyze-current-warnings.sh

echo ""
echo "⏸️ 按 Enter 繼續執行修復..."
read

# 2. 執行主要修復程式
echo "🔧 步驟 2: 執行智能批量修復..."
chmod +x scripts/master-final-warnings-fix.js
node scripts/master-final-warnings-fix.js

echo ""

# 3. 驗證修復結果
echo "✅ 步驟 3: 驗證修復結果..."
echo "執行 lint 檢查..."
npm run lint 2>&1 | head -50

echo ""

# 4. 統計改善效果
echo "📊 步驟 4: 統計改善效果..."
warnings_count=$(npm run lint 2>&1 | grep "warning" | wc -l || echo "0")
errors_count=$(npm run lint 2>&1 | grep "error" | wc -l || echo "0")

echo "當前狀態："
echo "  Warnings: $warnings_count"
echo "  Errors: $errors_count"

# 5. 如果還有大量 warnings，執行第二輪修復
if [ "$warnings_count" -gt 50 ]; then
    echo ""
    echo "🔄 步驟 5: 執行第二輪修復（還有較多 warnings）..."
    echo "⏸️ 按 Enter 繼續第二輪修復..."
    read

    node scripts/master-final-warnings-fix.js

    # 再次檢查
    warnings_count_final=$(npm run lint 2>&1 | grep "warning" | wc -l || echo "0")
    echo "第二輪修復後 warnings: $warnings_count_final"
fi

# 計算耗時
end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
echo "🎉 最終大規模 warnings 修復完成！"
echo "⏰ 總耗時: ${duration} 秒"
echo ""
echo "📈 建議下一步："
echo "1. 執行完整測試確保功能正常"
echo "2. 檢查剩餘的複雜 warnings"
echo "3. 考慮調整 .eslintrc.js 規則（如果必要）"
echo ""
echo "💡 提示：可以執行 'npm run lint | grep warning | head -20' 查看剩餘 warnings"