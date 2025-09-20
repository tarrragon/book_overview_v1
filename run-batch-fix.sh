#!/bin/bash

echo "🚀 執行批量修復 no-unused-vars 警告..."
echo ""

# 設置權限
chmod +x batch-fix-unused-vars.js

# 執行修復腳本
node batch-fix-unused-vars.js

echo ""
echo "🔍 修復後的 ESLint 檢查..."

# 檢查修復結果
npm run lint 2>&1 | grep "no-unused-vars" | head -20 || echo "✅ 沒有發現 no-unused-vars 警告"