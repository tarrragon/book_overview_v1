#!/bin/bash

echo "=== 修復 ESLint 格式錯誤 ==="
echo

# 檢查初始錯誤數
INITIAL_ERRORS=$(npm run lint 2>&1 | grep "error" | wc -l | tr -d ' ')
echo "📊 初始錯誤數: $INITIAL_ERRORS"
echo

# 創建備份目錄
BACKUP_DIR="./.backup-format-fix-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "🔧 修復格式錯誤..."

# 1. 修復 quotes 錯誤 - 將雙引號改為單引號
echo "📝 修復 quotes 錯誤..."
find src/ tests/ -name "*.js" -type f | while read file; do
  if [[ -f "$file" ]]; then
    # 備份檔案
    cp "$file" "$BACKUP_DIR/"

    # 修復雙引號問題 - 但保留模板字串和特殊情況
    sed -i.bak 's/"\([^"]*\)"/'"'"'\1'"'"'/g' "$file"

    # 恢復一些特殊情況的雙引號
    sed -i.bak 's/'"'"'\\'"'"'/"\\""/g' "$file"
    sed -i.bak 's/'"'"'\\n'"'"'/"\n"/g' "$file"
    sed -i.bak 's/'"'"'\\t'"'"'/"\t"/g' "$file"

    # 清理備份檔案
    rm -f "$file.bak"
  fi
done

# 2. 修復 eol-last 錯誤 - 在檔案結尾加上換行
echo "📝 修復 eol-last 錯誤..."
find src/ tests/ -name "*.js" -type f | while read file; do
  if [[ -f "$file" ]]; then
    # 檢查檔案是否以換行符結尾
    if [[ -n "$(tail -c1 "$file")" ]]; then
      echo "" >> "$file"
    fi
  fi
done

# 3. 修復特定檔案的問題
echo "📝 修復特定檔案問題..."

# ErrorCodes.js 結尾換行
if [[ -f "src/core/errors/ErrorCodes.js" ]]; then
  echo "" >> "src/core/errors/ErrorCodes.js"
fi

# UC02ErrorAdapter.js 常數賦值問題
if [[ -f "src/core/errors/UC02ErrorAdapter.js" ]]; then
  cp "src/core/errors/UC02ErrorAdapter.js" "$BACKUP_DIR/"
  sed -i.bak 's/strategy = /const newStrategy = /g' "src/core/errors/UC02ErrorAdapter.js"
  rm -f "src/core/errors/UC02ErrorAdapter.js.bak"
fi

# LogLevel.js 模板字串問題
if [[ -f "src/core/enums/LogLevel.js" ]]; then
  cp "src/core/enums/LogLevel.js" "$BACKUP_DIR/"
  sed -i.bak 's/\${/\\\${/g' "src/core/enums/LogLevel.js"
  rm -f "src/core/enums/LogLevel.js.bak"
fi

echo "✅ 格式修復完成"
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
  npm run lint 2>&1 | grep "error" | cut -d' ' -f4- | sort | uniq -c | sort -nr | head -10
fi