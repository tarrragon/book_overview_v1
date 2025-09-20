#!/bin/bash

echo "=== 快速批量修復剩餘 StandardError 錯誤 ==="
echo

# 創建備份目錄
BACKUP_DIR="./.backup-fast-fix-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 檢查初始錯誤數
INITIAL_ERRORS=$(npm run lint 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')
echo "📊 初始 StandardError 錯誤數: $INITIAL_ERRORS"
echo

# 獲取所有包含 StandardError 錯誤的檔案
FILES=$(npm run lint 2>&1 | grep -B1 "no-restricted-syntax" | grep "^/" | sort | uniq)

echo "🔄 快速批量處理..."
echo

# 對每個檔案進行處理
while IFS= read -r file; do
  if [[ -n "$file" && -f "$file" ]]; then
    echo "📝 處理: $(basename "$file")"

    # 備份檔案
    cp "$file" "$BACKUP_DIR/"

    # 批量替換 - 使用更精確的正則表達式

    # 1. 替換 import/require 語句
    sed -i.bak "s/const { StandardError } = require('src\/core\/errors\/StandardError')/const { ErrorCodes } = require('src\/core\/errors\/ErrorCodes')/g" "$file"
    sed -i.bak "s/import { StandardError } from 'src\/core\/errors\/StandardError'/import { ErrorCodes } from 'src\/core\/errors\/ErrorCodes'/g" "$file"

    # 2. 修復之前腳本造成的格式問題
    sed -i.bak "s/error.code = ErrorCodes\.'\([^']*\)'/error.code = ErrorCodes.\1/g" "$file"

    # 3. 標準的 new StandardError 替換
    sed -i.bak 's/new StandardError(\s*\('\''[^'\'']*\'\''\)\s*,\s*\([^,)]*\)\s*,\s*\([^)]*\)\s*)/(() => { const error = new Error(\2); error.code = ErrorCodes.\1; error.details = \3; return error })()/g' "$file"
    sed -i.bak 's/new StandardError(\s*\('\''[^'\'']*\'\''\)\s*,\s*\([^)]*\)\s*)/(() => { const error = new Error(\2); error.code = ErrorCodes.\1; return error })()/g' "$file"
    sed -i.bak 's/new StandardError(\s*\('\''[^'\'']*\'\''\)\s*)/(() => { const error = new Error("Unknown error"); error.code = ErrorCodes.\1; return error })()/g' "$file"

    # 清理備份檔案
    rm -f "$file.bak"
  fi
done <<< "$FILES"

echo
echo "📊 檢查修復結果..."

# 檢查最終結果
FINAL_ERRORS=$(npm run lint 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')
FIXED_COUNT=$((INITIAL_ERRORS - FINAL_ERRORS))

echo "   修復前: $INITIAL_ERRORS 個錯誤"
echo "   修復後: $FINAL_ERRORS 個錯誤"
echo "   已修復: $FIXED_COUNT 個錯誤"
echo "   備份位置: $BACKUP_DIR"

if [[ $FINAL_ERRORS -eq 0 ]]; then
  echo "🎉 所有 StandardError 錯誤已修復！"
else
  echo "⚠️  仍有 $FINAL_ERRORS 個錯誤需要手動處理"
  echo
  echo "剩餘錯誤詳情:"
  npm run lint 2>&1 | grep "no-restricted-syntax" | head -5
fi