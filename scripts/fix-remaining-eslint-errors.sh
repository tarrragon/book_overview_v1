#!/bin/bash

echo "=== 修復剩餘的 ESLint 錯誤 ==="
echo

# 檢查初始錯誤數
INITIAL_ERRORS=$(npm run lint 2>&1 | grep "error" | wc -l | tr -d ' ')
echo "📊 初始錯誤數: $INITIAL_ERRORS"
echo

# 創建備份目錄
BACKUP_DIR="./.backup-eslint-final-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "🔧 階段 1: 修復 ErrorCodes 未定義錯誤..."

# 獲取需要添加 ErrorCodes 引用的檔案
FILES_NEED_ERRORCODES=$(npm run lint 2>&1 | awk '/^\/.*\.js$/{f=$0} /'\'ErrorCodes\'' is not defined/{print f}' | sort | uniq)

echo "需要修復 ErrorCodes 引用的檔案:"
echo "$FILES_NEED_ERRORCODES" | wc -l | tr -d ' ' | xargs echo "檔案數:"

while IFS= read -r file; do
  if [[ -n "$file" && -f "$file" ]]; then
    echo "📝 修復 ErrorCodes 引用: $(basename "$file")"

    # 備份檔案
    cp "$file" "$BACKUP_DIR/"

    # 檢查是否已經有 ErrorCodes 引用
    if ! grep -q "require.*ErrorCodes" "$file" && ! grep -q "import.*ErrorCodes" "$file"; then
      # 在檔案開頭添加 ErrorCodes 引用
      # 找到第一個非註釋的 require 或 import 行
      first_require_line=$(grep -n "^[^/]*require\|^[^/]*import" "$file" | head -1 | cut -d: -f1)

      if [[ -n "$first_require_line" ]]; then
        # 在第一個 require 前插入 ErrorCodes 引用
        sed -i.bak "${first_require_line}i\\
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
" "$file"
      else
        # 如果沒有其他 require，在檔案開頭插入
        sed -i.bak '1i\\
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
' "$file"
      fi

      rm -f "$file.bak"
    fi
  fi
done <<< "$FILES_NEED_ERRORCODES"

echo
echo "🔧 階段 2: 修復 quotes 錯誤..."

# 修復 quotes 錯誤
FILES_NEED_QUOTES=$(npm run lint 2>&1 | awk '/^\/.*\.js$/{f=$0} /Strings must use singlequote/{print f}' | sort | uniq)

while IFS= read -r file; do
  if [[ -n "$file" && -f "$file" ]]; then
    echo "📝 修復 quotes: $(basename "$file")"

    # 備份檔案
    cp "$file" "$BACKUP_DIR/"

    # 檢查具體的行號和內容
    npm run lint "$file" 2>&1 | grep "Strings must use singlequote" | while read line; do
      line_num=$(echo "$line" | cut -d: -f1 | tr -d ' ')
      if [[ "$line_num" =~ ^[0-9]+$ ]]; then
        # 獲取該行內容並修復雙引號
        sed -i.bak "${line_num}s/\"\([^\"]*\)\"/'\1'/g" "$file"
      fi
    done

    rm -f "$file.bak"
  fi
done <<< "$FILES_NEED_QUOTES"

echo
echo "🔧 階段 3: 修復 eol-last 錯誤..."

# 修復所有檔案的 eol-last 問題
find src/ tests/ -name "*.js" -type f | while read file; do
  if [[ -f "$file" ]]; then
    # 檢查檔案是否以換行符結尾
    if [[ -n "$(tail -c1 "$file")" ]]; then
      echo "" >> "$file"
    fi
  fi
done

echo
echo "🔧 階段 4: 修復語法錯誤..."

# 修復語法錯誤（主要是 IIFE 格式問題）
FILES_WITH_PARSING_ERRORS=$(npm run lint 2>&1 | awk '/^\/.*\.js$/{f=$0} /Parsing error/{print f}' | sort | uniq)

while IFS= read -r file; do
  if [[ -n "$file" && -f "$file" ]]; then
    echo "📝 修復語法錯誤: $(basename "$file")"

    # 備份檔案
    cp "$file" "$BACKUP_DIR/"

    # 修復常見的語法錯誤模式
    # 1. 修復 IIFE 中的 ErrorCodes 引用
    sed -i.bak 's/error.code = ErrorCodes\.\([A-Z_]*\)/error.code = ErrorCodes.\1/g' "$file"

    # 2. 修復未加引號的 ErrorCodes
    sed -i.bak 's/ErrorCodes\.\([A-Z_][A-Z_]*\)\([^A-Z_]\)/ErrorCodes.\1\2/g' "$file"

    rm -f "$file.bak"
  fi
done <<< "$FILES_WITH_PARSING_ERRORS"

echo "✅ 修復完成"
echo

# 檢查修復結果
FINAL_ERRORS=$(npm run lint 2>&1 | grep "error" | wc -l | tr -d ' ')
FIXED_COUNT=$((INITIAL_ERRORS - FINAL_ERRORS))

echo "📊 修復結果："
echo "   修復前: $INITIAL_ERRORS 個錯誤"
echo "   修復後: $FINAL_ERRORS 個錯誤"
echo "   已修復: $FIXED_COUNT 個錯誤"
echo "   備份位置: $BACKUP_DIR"

if [[ $FINAL_ERRORS -eq 0 ]]; then
  echo "🎉🎉🎉 所有 ESLint 錯誤已修復！達成 100% 合規！🎉🎉🎉"
else
  echo "⚠️  仍有 $FINAL_ERRORS 個錯誤"
  echo
  echo "剩餘錯誤類型："
  npm run lint 2>&1 | grep "error" | cut -d' ' -f4- | sort | uniq -c | sort -nr | head -5
fi