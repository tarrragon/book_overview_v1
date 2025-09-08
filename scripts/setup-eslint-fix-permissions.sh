#!/bin/bash
# setup-eslint-fix-permissions.sh
# 設定ESLint修正相關腳本的執行權限

echo "🔧 設定ESLint修正腳本執行權限..."

# 修正腳本權限
chmod +x scripts/fix-eslint-errors.sh
chmod +x scripts/validate-eslint-fix.sh  
chmod +x scripts/test-path-fix.sh
chmod +x scripts/setup-eslint-fix-permissions.sh

echo "✅ 權限設定完成"

# 驗證權限
echo "📋 腳本權限檢查："
ls -la scripts/fix-eslint-errors.sh
ls -la scripts/validate-eslint-fix.sh
ls -la scripts/test-path-fix.sh

echo ""
echo "🚀 可以執行的指令："
echo "  ./scripts/test-path-fix.sh          # 測試修正邏輯"
echo "  ./scripts/validate-eslint-fix.sh    # 快速驗證"
echo "  ./scripts/fix-eslint-errors.sh      # 完整修正流程"