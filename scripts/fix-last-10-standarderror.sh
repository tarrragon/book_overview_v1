#!/bin/bash

echo "=== 修復最後 10 個 StandardError 錯誤 ==="

# 最後剩餘的檔案清單
FILES=(
  "tests/mocks/cross-device-sync.mock.js"
  "tests/performance/ErrorCodes-memory-benchmark.test.js"
  "tests/unit/adapters/stable-id-generation.test.js"
  "tests/unit/content/utils/memory-utils.test.js"
  "tests/unit/error-handling/error-recovery-strategies.test.js"
  "tests/unit/storage/adapters.test.js"
  "tests/unit/ui/data-import.test.js"
)

# 創建備份目錄
BACKUP_DIR="./.backup-last-10-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📊 最後衝刺！處理 ${#FILES[@]} 個檔案"
echo

processed=0
total_fixed=0

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

    # 2. 處理各種 require 路徑
    sed -i.bak "s/require('.*\/StandardError')/require('src\/core\/errors\/ErrorCodes')/g" "$file"
    sed -i.bak "s/require('.*StandardError.*')/require('src\/core\/errors\/ErrorCodes')/g" "$file"

    # 3. Python 超強精確替換
    python3 << EOF
import re

with open("$file", 'r', encoding='utf-8') as f:
    content = f.read()

# 所有可能的 StandardError 模式
patterns = [
    # 複雜模板字串
    (r"new StandardError\(\s*['\"]([^'\"]+)['\"]\s*,\s*\`([^\`]*)\`\s*,\s*\{([^}]*)\}\s*\)", r"(() => { const error = new Error(\`\2\`); error.code = ErrorCodes.\1; error.details = {\3}; return error })()"),
    # 標準三參數
    (r"new StandardError\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]*)['\"],\s*\{([^}]*)\}\s*\)", r"(() => { const error = new Error('\2'); error.code = ErrorCodes.\1; error.details = {\3}; return error })()"),
    # 變數訊息三參數
    (r"new StandardError\(\s*['\"]([^'\"]+)['\"]\s*,\s*([^,\)]+)\s*,\s*\{([^}]*)\}\s*\)", r"(() => { const error = new Error(\2); error.code = ErrorCodes.\1; error.details = {\3}; return error })()"),
    # 兩參數字串
    (r"new StandardError\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]*)['\"]s*\)", r"(() => { const error = new Error('\2'); error.code = ErrorCodes.\1; return error })()"),
    # 兩參數變數
    (r"new StandardError\(\s*['\"]([^'\"]+)['\"]\s*,\s*([^,\)]+)\s*\)", r"(() => { const error = new Error(\2); error.code = ErrorCodes.\1; return error })()"),
    # 單參數
    (r"new StandardError\(\s*['\"]([^'\"]+)['\"]\s*\)", r"(() => { const error = new Error('Unknown error'); error.code = ErrorCodes.\1; return error })()"),
    # 處理可能的格式問題
    (r"throw new StandardError\(", r"throw (() => { const error = new Error("),
    (r"StandardError\(", r"(() => { const error = new Error(")
]

for pattern, replacement in patterns:
    old_content = content
    content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    if content != old_content:
        print(f"Pattern matched: {pattern[:50]}...")

with open("$file", 'w', encoding='utf-8') as f:
    f.write(content)
EOF

    # 清理備份檔案
    rm -f "$file.bak"

    # 檢查修復後的錯誤數量
    after_count=$(npm run lint "$file" 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')
    fixed_count=$((before_count - after_count))
    total_fixed=$((total_fixed + fixed_count))

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

echo "🏁 最後衝刺完成！"
echo "   處理檔案數: $processed"
echo "   總共修復: $total_fixed 個錯誤"
echo "   備份位置: $BACKUP_DIR"

# 檢查最終結果
FINAL_ERRORS=$(npm run lint 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')
echo "   🎯 全域剩餘 StandardError 錯誤: $FINAL_ERRORS"

if [[ $FINAL_ERRORS -eq 0 ]]; then
  echo "🎉🎉🎉 所有 StandardError 錯誤已完全修復！🎉🎉🎉"
  echo "🏆 達成 StandardError 零錯誤里程碑！"
else
  echo "⚠️  仍有 $FINAL_ERRORS 個錯誤需要處理"
  echo "剩餘錯誤詳情:"
  npm run lint 2>&1 | grep "no-restricted-syntax" | head -5
fi