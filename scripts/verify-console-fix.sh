#!/bin/bash

echo "🔍 驗證 Console Warnings 修復效果..."
echo

# 統計修復前後的對比
echo "📊 Console 語句統計:"
echo "   總 console 語句數量: $(find src/ tests/ -name "*.js" -exec grep -c "console\." {} \; | awk '{sum+=$1} END {print sum}')"
echo "   已添加 eslint-disable 註解: $(find src/ tests/ -name "*.js" -exec grep -c "eslint-disable-next-line no-console" {} \; | awk '{sum+=$1} END {print sum}')"

echo
echo "📁 各目錄修復情況:"

echo "   src/ 目錄:"
echo "     - Console 語句: $(find src/ -name "*.js" -exec grep -c "console\." {} \; | awk '{sum+=$1} END {print sum}')"
echo "     - 已添加註解: $(find src/ -name "*.js" -exec grep -c "eslint-disable-next-line no-console" {} \; | awk '{sum+=$1} END {print sum}')"

echo "   tests/ 目錄:"
echo "     - Console 語句: $(find tests/ -name "*.js" -exec grep -c "console\." {} \; | awk '{sum+=$1} END {print sum}')"
echo "     - 已添加註解: $(find tests/ -name "*.js" -exec grep -c "eslint-disable-next-line no-console" {} \; | awk '{sum+=$1} END {print sum}')"

echo
echo "🔧 核心檔案修復檢查:"

key_files=(
    "src/core/migration/DualErrorSystemBridge.js"
    "src/core/performance/performance-anomaly-detector.js"
    "src/overview/overview-page-controller.js"
    "src/popup/popup-controller.js"
    "tests/helpers/chrome-extension-controller.js"
)

for file in "${key_files[@]}"; do
    if [ -f "$file" ]; then
        console_count=$(grep -c "console\." "$file" 2>/dev/null || echo "0")
        disable_count=$(grep -c "eslint-disable-next-line no-console" "$file" 2>/dev/null || echo "0")
        echo "   ✅ $file: $console_count console, $disable_count 註解"
    else
        echo "   ⚠️  $file: 檔案不存在"
    fi
done

echo
echo "💡 建議執行以下指令進行完整驗證:"
echo "   npm run lint | grep \"no-console\" | wc -l"
echo "   npm run lint"
echo "   npm test"

echo
echo "✅ 驗證完成！"