#!/bin/bash

# 直接執行分析和修復，不需要用戶交互
echo "🚀 啟動最終大規模 ESLint warnings 修復"
echo ""

# 分析當前狀況
echo "🔍 分析當前 warnings 狀況..."
chmod +x scripts/analyze-current-warnings.sh 2>/dev/null || true
bash scripts/analyze-current-warnings.sh

echo ""

# 執行修復
echo "🔧 執行智能批量修復..."
chmod +x scripts/master-final-warnings-fix.js 2>/dev/null || true
node scripts/master-final-warnings-fix.js

echo ""
echo "✅ 修復完成！執行驗證..."

# 快速驗證
set +e  # 允許命令失敗
warnings_count=$(npm run lint 2>&1 | grep "warning" | wc -l 2>/dev/null || echo "0")
errors_count=$(npm run lint 2>&1 | grep "error" | wc -l 2>/dev/null || echo "0")
set -e

echo "當前狀態："
echo "  Warnings: $warnings_count"
echo "  Errors: $errors_count"

echo ""
echo "🎉 最終大規模 warnings 修復完成！"