#!/bin/bash

echo "=== 修復語法解析錯誤 ==="
echo

# 檢查初始錯誤數
INITIAL_ERRORS=$(npm run lint 2>&1 | grep "Parsing error" | wc -l | tr -d ' ')
echo "📊 初始語法錯誤數: $INITIAL_ERRORS"
echo

# 創建備份目錄
BACKUP_DIR="./.backup-syntax-fix-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "🔧 修復 ErrorCodes 引號問題..."

# 找出所有包含語法錯誤的檔案
FILES_WITH_SYNTAX_ERRORS=$(npm run lint 2>&1 | awk '/^\/.*\.js$/{f=$0} /Parsing error/{print f}' | sort | uniq)

echo "需要修復語法錯誤的檔案:"
echo "$FILES_WITH_SYNTAX_ERRORS" | wc -l | tr -d ' ' | xargs echo "檔案數:"

while IFS= read -r file; do
  if [[ -n "$file" && -f "$file" ]]; then
    echo "📝 修復語法錯誤: $(basename "$file")"

    # 備份檔案
    cp "$file" "$BACKUP_DIR/"

    # 修復 ErrorCodes.'CODE' 格式問題
    sed -i.bak "s/ErrorCodes\\.'\([A-Z_][A-Z_]*\)'/ErrorCodes.\1/g" "$file"

    # 修復 ErrorCodes."CODE" 格式問題
    sed -i.bak 's/ErrorCodes\."\([A-Z_][A-Z_]*\)"/ErrorCodes.\1/g' "$file"

    # 修復可能的重複引號問題
    sed -i.bak "s/ErrorCodes\\.'\\([A-Z_][A-Z_]*\\)'/ErrorCodes.\1/g" "$file"
    sed -i.bak 's/ErrorCodes\\"\\([A-Z_][A-Z_]*\\)"/ErrorCodes.\1/g' "$file"

    # 清理備份檔案
    rm -f "$file.bak"
  fi
done <<< "$FILES_WITH_SYNTAX_ERRORS"

echo
echo "🔧 修復重複宣告問題..."

# 處理 ErrorCodes 重複宣告的問題
while IFS= read -r file; do
  if [[ -n "$file" && -f "$file" ]]; then
    # 檢查是否有重複的 ErrorCodes 引用
    error_count=$(grep -c "require.*ErrorCodes" "$file" 2>/dev/null || echo "0")
    if [[ $error_count -gt 1 ]]; then
      echo "📝 移除重複的 ErrorCodes 引用: $(basename "$file")"

      # 備份檔案
      cp "$file" "$BACKUP_DIR/"

      # 保留第一個 ErrorCodes 引用，移除其他的
      awk '
        BEGIN { found = 0 }
        /require.*ErrorCodes/ {
          if (found == 0) {
            print
            found = 1
          }
          next
        }
        { print }
      ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    fi
  fi
done <<< "$FILES_WITH_SYNTAX_ERRORS"

echo
echo "🔧 修復其他語法問題..."

# 處理其他可能的語法問題
while IFS= read -r file; do
  if [[ -n "$file" && -f "$file" ]]; then
    # 備份檔案
    cp "$file" "$BACKUP_DIR/"

    # 修復可能的 IIFE 格式問題
    sed -i.bak 's/const error = new Error(.*); error\.code = ErrorCodes\./const error = new Error(/g' "$file"

    # 清理可能的不完整替換
    sed -i.bak 's/throw (() => { const error = new Error(/throw (() => { const error = new Error(/g' "$file"

    # 清理備份檔案
    rm -f "$file.bak"
  fi
done <<< "$FILES_WITH_SYNTAX_ERRORS"

echo "✅ 語法修復完成"
echo

# 檢查修復結果
FINAL_ERRORS=$(npm run lint 2>&1 | grep "Parsing error" | wc -l | tr -d ' ')
FIXED_COUNT=$((INITIAL_ERRORS - FINAL_ERRORS))

echo "📊 修復結果："
echo "   修復前: $INITIAL_ERRORS 個語法錯誤"
echo "   修復後: $FINAL_ERRORS 個語法錯誤"
echo "   已修復: $FIXED_COUNT 個語法錯誤"
echo "   備份位置: $BACKUP_DIR"

if [[ $FINAL_ERRORS -eq 0 ]]; then
  echo "🎉 所有語法錯誤已修復！"
else
  echo "⚠️  仍有 $FINAL_ERRORS 個語法錯誤"
  echo
  echo "剩餘語法錯誤："
  npm run lint 2>&1 | grep "Parsing error" | head -3
fi

# 總體錯誤檢查
TOTAL_ERRORS=$(npm run lint 2>&1 | grep "error" | wc -l | tr -d ' ')
echo
echo "📊 總體 ESLint 狀態："
echo "   總錯誤數: $TOTAL_ERRORS"

if [[ $TOTAL_ERRORS -eq 0 ]]; then
  echo "🎉🎉🎉 恭喜！達成 100% ESLint 合規！🎉🎉🎉"
fi