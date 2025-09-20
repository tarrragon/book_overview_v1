#!/bin/bash

echo "🚀 開始綜合性 no-unused-vars 清理..."

cd "$(dirname "$0")"

# 設定執行權限
chmod +x *.js

echo "📋 步驟 1: 檢查當前警告狀況..."
node check-current-warnings.js

echo ""
echo "📋 步驟 2: 執行綜合性修復..."
node comprehensive-unused-vars-cleanup.js

echo ""
echo "📋 步驟 3: 驗證修復結果..."
echo "重新檢查剩餘警告..."
npm run lint 2>&1 | grep "no-unused-vars" | wc -l | awk '{print "剩餘 no-unused-vars 警告: " $1 " 個"}'

echo ""
echo "✅ 綜合性清理流程完成！"
echo "💡 請檢查生成的報告文件以了解詳細結果"