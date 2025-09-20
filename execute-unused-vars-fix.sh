#!/bin/bash

echo "🚀 執行 no-unused-vars 大規模修復..."

cd "$(dirname "$0")"

# 設定執行權限
chmod +x *.js

# 執行主要修復流程
echo "開始執行主要修復協調器..."
node master-unused-vars-fix.js

echo "✅ no-unused-vars 修復流程完成！"