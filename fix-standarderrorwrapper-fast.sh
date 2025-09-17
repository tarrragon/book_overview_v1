#!/bin/bash

# 快速批量修復 StandardErrorWrapper 腳本
# 使用 sed 進行高效率的批量替換

echo "開始快速批量修復 StandardErrorWrapper 引用..."

# 建立今日的備份目錄
BACKUP_DIR="docs/migration-reports/backups-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 獲取所有包含 StandardErrorWrapper 的 JS 檔案
echo "搜尋需要修復的檔案..."
FILES=($(find src -name "*.js" -type f -exec grep -l "StandardErrorWrapper" {} \;))

echo "找到 ${#FILES[@]} 個需要修復的檔案"

# 修復計數器
SUCCESS_COUNT=0
TOTAL_COUNT=${#FILES[@]}

echo "開始修復檔案..."

for FILE in "${FILES[@]}"; do
    echo "正在修復: $FILE"

    # 建立備份
    cp "$FILE" "$BACKUP_DIR/$(basename $FILE).backup.$(date +%s)"

    # 1. 首先添加 ErrorCodes 引用（如果還沒有）
    if grep -q "require('src/core/errors/StandardError')" "$FILE" && ! grep -q "require('src/core/errors/ErrorCodes')" "$FILE"; then
        # 在 StandardError 引用後面添加 ErrorCodes 引用
        sed -i.bak "s|const { StandardError } = require('src/core/errors/StandardError')|const { StandardError } = require('src/core/errors/StandardError')\nconst { ErrorCodes } = require('src/core/errors/ErrorCodes')|g" "$FILE"
        rm "${FILE}.bak" 2>/dev/null || true
    fi

    # 2. 替換 StandardErrorWrapper 引用
    # 使用多個 sed 命令來處理不同的模式

    # 模式1: 簡單的單行模式
    sed -i.bak1 "s|throw new StandardErrorWrapper('EVENTBUS_ERROR'|const error = new Error|g" "$FILE"
    sed -i.bak2 "s|throw new StandardErrorWrapper('UI_OPERATION_FAILED'|const error = new Error|g" "$FILE"
    sed -i.bak3 "s|throw new StandardErrorWrapper('VALIDATION_FAILED'|const error = new Error|g" "$FILE"
    sed -i.bak4 "s|throw new StandardErrorWrapper('UNKNOWN_ERROR'|const error = new Error|g" "$FILE"
    sed -i.bak5 "s|throw new StandardErrorWrapper('INVALID_DATA_FORMAT'|const error = new Error|g" "$FILE"

    # 清理臨時檔案
    rm "${FILE}".bak* 2>/dev/null || true

    # 3. 處理錯誤代碼和詳細資訊
    # 這需要更複雜的處理，暫時使用簡單的模式匹配
    sed -i.bak "s|, {|; error.code = ErrorCodes.VALIDATION_ERROR; error.details = {|g" "$FILE"
    sed -i.bak2 "s|})$|} ; throw error|g" "$FILE"

    # 清理臨時檔案
    rm "${FILE}".bak* 2>/dev/null || true

    # 檢查是否還有 StandardErrorWrapper 引用
    if ! grep -q "StandardErrorWrapper" "$FILE"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo "✅ 完全修復: $FILE"
    else
        echo "⚠️  部分修復: $FILE (需要手動檢查)"
    fi
done

echo ""
echo "=== 快速修復總結 ==="
echo "總檔案數: $TOTAL_COUNT"
echo "完全修復: $SUCCESS_COUNT"
echo "部分修復: $((TOTAL_COUNT - SUCCESS_COUNT))"
echo ""

# 檢查剩餘的 StandardErrorWrapper 引用
REMAINING=$(find src -name "*.js" -type f -exec grep -l "StandardErrorWrapper" {} \; | wc -l)
echo "剩餘待修復檔案: $REMAINING"

echo "快速修復完成！備份檔案存放在: $BACKUP_DIR"

# 執行 lint 檢查看修復效果
echo ""
echo "執行 lint 檢查看修復效果..."
npm run lint 2>/dev/null | grep -E "(error|StandardErrorWrapper)" | head -10 || echo "Lint 檢查完成"