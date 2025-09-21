#!/bin/bash

echo "🚀 執行 ESLint 快速修復..."
echo "============================="

cd /Users/tarragon/Projects/book_overview_v1

# 設定權限
chmod +x *.js

# 執行快速修復
echo "執行快速修復腳本..."
node rapid-eslint-fix.js

echo ""
echo "🎯 修復完成！"