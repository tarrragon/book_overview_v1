#!/bin/bash

echo "🎯 執行精確 no-unused-vars 修復..."

cd "$(dirname "$0")"

# 設定執行權限
chmod +x precise-unused-vars-fix.js

# 執行精確修復
echo "開始精確修復..."
node precise-unused-vars-fix.js

echo ""
echo "修復完成！檢查結果..."

# 檢查修復效果
echo "執行 lint 檢查剩餘警告..."
npm run lint 2>&1 | grep "no-unused-vars" | head -10

echo ""
echo "✅ 精確修復流程完成！"