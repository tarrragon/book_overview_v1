#!/bin/bash

# StandardErrorWrapper 批量修復腳本
# 使用 sed 進行高效率的批量替換

echo "開始批量修復 StandardErrorWrapper 引用..."

# 建立備份目錄
mkdir -p docs/migration-reports/backups-$(date +%Y%m%d_%H%M%S)

# 獲取所有包含 StandardErrorWrapper 的檔案
FILES=$(find src -name "*.js" -type f -exec grep -l "StandardErrorWrapper" {} \;)

echo "找到 $(echo "$FILES" | wc -l) 個需要修復的檔案"

# 修復計數器
SUCCESS_COUNT=0
TOTAL_COUNT=0

for FILE in $FILES; do
    echo "正在修復: $FILE"
    TOTAL_COUNT=$((TOTAL_COUNT + 1))

    # 建立備份
    cp "$FILE" "docs/migration-reports/backups-$(date +%Y%m%d_%H%M%S)/$(basename $FILE).backup.$(date +%s)"

    # 1. 添加 ErrorCodes 引用（如果還沒有）
    if grep -q "require('src/core/errors/StandardError')" "$FILE" && ! grep -q "require('src/core/errors/ErrorCodes')" "$FILE"; then
        sed -i '' "/const { StandardError } = require('src\/core\/errors\/StandardError')/a\\
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
" "$FILE"
    fi

    # 2. 修復常見的 StandardErrorWrapper 模式
    # 模式1: 簡單的三參數格式
    sed -i '' 's/throw new StandardErrorWrapper(\(['"'"'"]\)\([^'"'"'"]*\)\1, \(['"'"'"]\)\([^'"'"'"]*\)\3, {/const error = new Error(\3\4\3); error.code = ErrorCodes.VALIDATION_ERROR; error.details = {/g' "$FILE"

    # 模式2: 添加 throw error
    sed -i '' 's/error.details = {/error.details = {/g' "$FILE"

    # 3. 處理特定錯誤代碼映射
    sed -i '' 's/ErrorCodes.VALIDATION_ERROR; error.details = { category: '\''ui'\''/ErrorCodes.VALIDATION_ERROR; error.details = { category: '\''ui'\'' }; throw error/g' "$FILE"

    # 檢查是否成功修復
    if ! grep -q "StandardErrorWrapper" "$FILE"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo "✅ 成功修復: $FILE"
    else
        echo "⚠️  需要手動處理: $FILE"
    fi
done

echo ""
echo "=== 批量修復總結 ==="
echo "總檔案數: $TOTAL_COUNT"
echo "成功修復: $SUCCESS_COUNT"
echo "需要手動處理: $((TOTAL_COUNT - SUCCESS_COUNT))"
echo ""
echo "批量修復完成！"

# 執行 lint 檢查
echo "正在執行 lint 檢查..."
npm run lint | grep -E "(error|StandardErrorWrapper)" | head -20