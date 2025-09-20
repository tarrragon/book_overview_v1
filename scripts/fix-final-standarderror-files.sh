#!/bin/bash

echo "=== 修復剩餘的 StandardError 錯誤檔案 ==="

# 剩餘的檔案清單
FILES=(
  "tests/helpers/message-flow-tracker.js"
  "tests/integration/chrome-extension/background-event-system.test.js"
  "tests/integration/chrome-extension/event-bus-stats.test.js"
  "tests/integration/platform/platform-detection-integration.test.js"
)

# 創建備份目錄
BACKUP_DIR="./.backup-final-fix-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📊 預計處理 ${#FILES[@]} 個檔案"
echo

processed=0

for file in "${FILES[@]}"; do
  if [[ -f "$file" ]]; then
    echo "📝 處理: $file"

    # 備份檔案
    cp "$file" "$BACKUP_DIR/"

    # 檢查錯誤數量
    before_count=$(npm run lint "$file" 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')
    echo "   修復前錯誤數: $before_count"

    # 1. 替換 import/require
    sed -i.bak "s/const { StandardError } = require('.*StandardError.*')/const { ErrorCodes } = require('src\/core\/errors\/ErrorCodes')/g" "$file"
    sed -i.bak "s/import { StandardError } from '.*StandardError.*'/import { ErrorCodes } from 'src\/core\/errors\/ErrorCodes'/g" "$file"

    # 2. Python 精確替換
    python3 << EOF
import re

with open("$file", 'r', encoding='utf-8') as f:
    content = f.read()

# 各種 StandardError 模式替換
patterns = [
    (r"new StandardError\(\s*'([^']+)'\s*,\s*\`([^\`]*)\`\s*,\s*\{([^}]*)\}\s*\)", r"(() => { const error = new Error(\`\2\`); error.code = ErrorCodes.\1; error.details = {\3}; return error })()"),
    (r"new StandardError\(\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*\{([^}]*)\}\s*\)", r"(() => { const error = new Error('\2'); error.code = ErrorCodes.\1; error.details = {\3}; return error })()"),
    (r"new StandardError\(\s*'([^']+)'\s*,\s*([^,]+)\s*,\s*\{([^}]*)\}\s*\)", r"(() => { const error = new Error(\2); error.code = ErrorCodes.\1; error.details = {\3}; return error })()"),
    (r"new StandardError\(\s*'([^']+)'\s*,\s*'([^']*)'\s*\)", r"(() => { const error = new Error('\2'); error.code = ErrorCodes.\1; return error })()"),
    (r"new StandardError\(\s*'([^']+)'\s*,\s*([^,)]+)\s*\)", r"(() => { const error = new Error(\2); error.code = ErrorCodes.\1; return error })()"),
    (r"new StandardError\(\s*'([^']+)'\s*\)", r"(() => { const error = new Error('Unknown error'); error.code = ErrorCodes.\1; return error })()")
]

for pattern, replacement in patterns:
    content = re.sub(pattern, replacement, content)

with open("$file", 'w', encoding='utf-8') as f:
    f.write(content)
EOF

    # 清理備份檔案
    rm -f "$file.bak"

    # 檢查修復後的錯誤數量
    after_count=$(npm run lint "$file" 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')
    fixed_count=$((before_count - after_count))

    echo "   修復後錯誤數: $after_count"
    echo "   已修復: $fixed_count 個錯誤"

    if [[ $after_count -eq 0 ]]; then
      echo "   ✅ 完全修復"
    else
      echo "   ⚠️  仍有錯誤"
    fi

    processed=$((processed + 1))
    echo
  else
    echo "❌ 檔案不存在: $file"
  fi
done

echo "📊 處理完成："
echo "   處理檔案數: $processed"
echo "   備份位置: $BACKUP_DIR"

# 檢查最終結果
FINAL_ERRORS=$(npm run lint 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')
echo "   全域剩餘 StandardError 錯誤: $FINAL_ERRORS"

if [[ $FINAL_ERRORS -eq 0 ]]; then
  echo "🎉 所有 StandardError 錯誤已修復！"
else
  echo "⚠️  仍有 $FINAL_ERRORS 個錯誤需要處理"
fi