#!/bin/bash

echo "=== 處理剩餘 StandardError 錯誤 ==="
echo

# 獲取所有包含 StandardError 錯誤的檔案
FILES=$(npm run lint 2>&1 | grep -B1 "no-restricted-syntax" | grep "^/" | sort | uniq)

# 統計檔案數量
FILE_COUNT=$(echo "$FILES" | wc -l | tr -d ' ')
echo "📊 發現 $FILE_COUNT 個檔案包含 StandardError 錯誤"

# 統計總錯誤數
TOTAL_ERRORS=$(npm run lint 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')
echo "📊 總計 $TOTAL_ERRORS 個 StandardError 錯誤"
echo

# 備份原始檔案並處理
BACKUP_DIR="./.backup-standarderror-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "🔄 開始批量處理..."
echo

processed_count=0

while IFS= read -r file; do
  if [[ -n "$file" && -f "$file" ]]; then
    echo "📝 處理: $file"

    # 備份原始檔案
    cp "$file" "$BACKUP_DIR/"

    # 檢查檔案中的 StandardError 錯誤數量
    error_count=$(npm run lint "$file" 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')
    echo "   錯誤數量: $error_count"

    if [[ $error_count -gt 0 ]]; then
      # 使用 sed 進行批量替換

      # 首先替換 import/require
      sed -i.tmp "s/const { StandardError } = require('src\/core\/errors\/StandardError')/const { ErrorCodes } = require('src\/core\/errors\/ErrorCodes')/g" "$file"
      sed -i.tmp "s/import { StandardError } from 'src\/core\/errors\/StandardError'/import { ErrorCodes } from 'src\/core\/errors\/ErrorCodes'/g" "$file"

      # 模式 1: new StandardError('CODE', 'message', details)
      sed -i.tmp 's/new StandardError(\(['"'"'"]*[^'"'"'"]*['"'"'"]*\), *\(['"'"'"]*[^'"'"'"]*['"'"'"]*\), *\([^)]*\))/(() => { const error = new Error(\2); error.code = ErrorCodes.\1; error.details = \3; return error })()/g' "$file"

      # 模式 2: new StandardError('CODE', 'message')
      sed -i.tmp 's/new StandardError(\(['"'"'"]*[^'"'"'"]*['"'"'"]*\), *\(['"'"'"]*[^'"'"'"]*['"'"'"]*\))/(() => { const error = new Error(\2); error.code = ErrorCodes.\1; return error })()/g' "$file"

      # 模式 3: new StandardError('CODE')
      sed -i.tmp 's/new StandardError(\(['"'"'"]*[^'"'"'"]*['"'"'"]*\))/(() => { const error = new Error("Unknown error"); error.code = ErrorCodes.\1; return error })()/g' "$file"

      # 清理臨時檔案
      rm -f "$file.tmp"

      # 檢查處理後的錯誤數量
      new_error_count=$(npm run lint "$file" 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')

      if [[ $new_error_count -eq 0 ]]; then
        echo "   ✅ 已完全修復"
      else
        echo "   ⚠️  剩餘 $new_error_count 個錯誤（需要手動處理）"
      fi

      processed_count=$((processed_count + 1))
    else
      echo "   ℹ️  無需處理"
    fi

    echo
  fi
done <<< "$FILES"

echo "📊 處理完成："
echo "   處理檔案數: $processed_count"
echo "   備份位置: $BACKUP_DIR"

# 檢查最終結果
FINAL_ERRORS=$(npm run lint 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')
echo "   剩餘 StandardError 錯誤: $FINAL_ERRORS"

if [[ $FINAL_ERRORS -eq 0 ]]; then
  echo "🎉 所有 StandardError 錯誤已修復！"
else
  echo "⚠️  仍有 $FINAL_ERRORS 個錯誤需要手動處理"
fi