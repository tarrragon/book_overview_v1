#!/bin/bash

echo "🚀 執行系統性 no-unused-vars 修復..."

cd "$(dirname "$0")"

# 確保腳本有執行權限
chmod +x systematic-unused-vars-fix.js

# 執行修復
node systematic-unused-vars-fix.js

echo "✅ 系統性修復完成！"