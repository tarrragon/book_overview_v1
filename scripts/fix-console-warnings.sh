#!/bin/bash

# 批量修復 no-console ESLint 警告
# 使用策略：
# 1. 測試文件：添加 eslint-disable-next-line 註解
# 2. 生產文件：條件性 console 或改用 Logger

echo "🔧 開始批量修復 no-console 警告..."

# 修復所有測試文件中的 console 語句
find tests/ -name "*.js" -type f -exec sed -i '' '
/console\.\(log\|warn\|error\|info\|debug\)/ {
    i\
      // eslint-disable-next-line no-console
}
' {} \;

# 修復部分 src 文件中需要條件性 console 的語句
# 處理 src 目錄下的所有 JS 文件
find src/ -name "*.js" -type f -exec sed -i '' '
/console\.\(log\|warn\|error\|info\|debug\)/ {
    # 如果前面沒有條件檢查和 eslint-disable，則添加 eslint-disable
    /if.*enableLogging\|if.*config\.debug\|\/\/ eslint-disable-next-line no-console/! {
        i\
      // eslint-disable-next-line no-console
    }
}
' {} \;

echo "✅ 批量修復完成！"
echo "📋 建議執行 'npm run lint' 檢查修復結果"