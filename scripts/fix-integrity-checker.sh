#!/bin/bash

echo "=== 修復 testing-integrity-checker.js 的 StandardError 錯誤 ==="

FILE="tests/helpers/testing-integrity-checker.js"

# 備份檔案
cp "$FILE" "$FILE.backup.$(date +%Y%m%d_%H%M%S)"

echo "📝 修復 $FILE 中的 StandardError 實例..."

# 處理各種 StandardError 模式
sed -i.tmp 's/new StandardError(\(['"'"'"]*[^'"'"'"]*['"'"'"]*\), *`\([^`]*\)`, *{\([^}]*\)})/(() => { const error = new Error(`\2`); error.code = ErrorCodes.\1; error.details = {\3}; return error })()/g' "$FILE"

sed -i.tmp 's/new StandardError(\(['"'"'"]*[^'"'"'"]*['"'"'"]*\), *\([^,)]*\), *{\([^}]*\)})/(() => { const error = new Error(\2); error.code = ErrorCodes.\1; error.details = {\3}; return error })()/g' "$FILE"

sed -i.tmp 's/new StandardError(\(['"'"'"]*[^'"'"'"]*['"'"'"]*\), *\([^)]*\))/(() => { const error = new Error(\2); error.code = ErrorCodes.\1; return error })()/g' "$FILE"

# 清理暫存檔案
rm -f "$FILE.tmp"

echo "✅ 修復完成"

# 檢查修復結果
ERRORS=$(npm run lint "$FILE" 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')
echo "📊 剩餘 StandardError 錯誤: $ERRORS"

if [[ $ERRORS -eq 0 ]]; then
  echo "🎉 所有 StandardError 錯誤已修復！"
else
  echo "⚠️  仍有錯誤需要處理:"
  npm run lint "$FILE" 2>&1 | grep "no-restricted-syntax" | head -5
fi