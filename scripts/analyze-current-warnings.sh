#!/bin/bash

# 分析當前 ESLint warnings 分佈
echo "🔍 分析當前 ESLint warnings 分佈..."

# 執行 lint 並分析 warnings
npm run lint 2>&1 | grep "warning" | awk '{print $3}' | sort | uniq -c | sort -nr > temp_warnings.txt

echo "📊 Warning 類型分佈："
cat temp_warnings.txt

echo ""
echo "📈 總 warnings 數量："
npm run lint 2>&1 | grep "warning" | wc -l

echo ""
echo "🎯 主要 warning 類型詳細分析："

# 分析 no-console
echo "1. no-console warnings:"
npm run lint 2>&1 | grep "no-console" | wc -l

# 分析 no-unused-vars
echo "2. no-unused-vars warnings:"
npm run lint 2>&1 | grep "no-unused-vars" | wc -l

# 分析 multiline-ternary
echo "3. multiline-ternary warnings:"
npm run lint 2>&1 | grep "multiline-ternary" | wc -l

# 分析 no-control-regex
echo "4. no-control-regex warnings:"
npm run lint 2>&1 | grep "no-control-regex" | wc -l

# 分析 no-new
echo "5. no-new warnings:"
npm run lint 2>&1 | grep "no-new" | wc -l

# 分析檔案分佈
echo ""
echo "🗂️ 主要問題檔案："
npm run lint 2>&1 | grep "warning" | awk '{print $1}' | sort | uniq -c | sort -nr | head -20

# 清理臨時檔案
rm -f temp_warnings.txt

echo ""
echo "✅ 分析完成！"