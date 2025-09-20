#!/bin/bash

# 通用 StandardError 批量修復腳本
# 可處理任何包含 StandardError 的檔案

if [ $# -eq 0 ]; then
    echo "使用方式: $0 <檔案路徑>"
    echo "範例: $0 /path/to/file.js"
    exit 1
fi

TARGET_FILE="$1"

if [ ! -f "$TARGET_FILE" ]; then
    echo "❌ 檔案不存在: $TARGET_FILE"
    exit 1
fi

echo "🔧 修復檔案中的 StandardError 實例..."
echo "📂 處理檔案: $(basename "$TARGET_FILE")"

# 備份原檔案
BACKUP_FILE="${TARGET_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$TARGET_FILE" "$BACKUP_FILE"

# 計算原始 StandardError 數量
original_count=$(grep -c "new StandardError" "$TARGET_FILE")
echo "📊 原始 StandardError 實例數: $original_count"

if [ "$original_count" -eq 0 ]; then
    echo "✅ 檔案中沒有 StandardError 實例需要處理"
    rm "$BACKUP_FILE"
    exit 0
fi

# 轉換策略 1: 處理完整的三參數模式
# new StandardError('CODE', 'message', { details })
sed -i '' -E 's/new StandardError\('\''([^'\''"]+)'\'', '\''([^'\''"]*)'\'', \{([^}]*)\}\)/(() => { const error = new Error('\''\2'\''); error.code = ErrorCodes.\1; error.details = {\3}; return error })()/g' "$TARGET_FILE"

# 轉換策略 2: 處理雙參數模式（沒有 details）
# new StandardError('CODE', 'message')
sed -i '' -E 's/new StandardError\('\''([^'\''"]+)'\'', '\''([^'\''"]*)'\''\)/(() => { const error = new Error('\''\2'\''); error.code = ErrorCodes.\1; return error })()/g' "$TARGET_FILE"

# 轉換策略 3: 處理雙引號的情況
sed -i '' -E 's/new StandardError\("([^"]+)", "([^"]*)", \{([^}]*)\}\)/(() => { const error = new Error("\2"); error.code = ErrorCodes.\1; error.details = {\3}; return error })()/g' "$TARGET_FILE"

sed -i '' -E 's/new StandardError\("([^"]+)", "([^"]*)"\)/(() => { const error = new Error("\2"); error.code = ErrorCodes.\1; return error })()/g' "$TARGET_FILE"

# 轉換策略 4: 處理變數作為訊息的情況（包含template literal和變數）
# new StandardError('CODE', variableMessage, { details })
sed -i '' -E 's/new StandardError\('\''([^'\''"]+)'\'', ([^,]+), \{([^}]*)\}\)/(() => { const error = new Error(\2); error.code = ErrorCodes.\1; error.details = {\3}; return error })()/g' "$TARGET_FILE"

# new StandardError('CODE', variableMessage)
sed -i '' -E 's/new StandardError\('\''([^'\''"]+)'\'', ([^,)]+)\)/(() => { const error = new Error(\2); error.code = ErrorCodes.\1; return error })()/g' "$TARGET_FILE"

# 驗證轉換結果
new_count=$(grep -c "new StandardError" "$TARGET_FILE")
converted_count=$(grep -c "error.code = ErrorCodes\." "$TARGET_FILE")

echo "📊 轉換結果:"
echo "  - 剩餘 StandardError: $new_count"
echo "  - 新增 ErrorCodes: $converted_count"

if [ "$new_count" -eq 0 ]; then
    echo "✅ 所有 StandardError 已成功轉換"

    # 檢查語法錯誤
    echo "🔍 檢查轉換後的語法..."
    node -c "$TARGET_FILE" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ 語法檢查通過"
        rm "$BACKUP_FILE"
    else
        echo "❌ 語法錯誤，恢復備份"
        mv "$BACKUP_FILE" "$TARGET_FILE"
        exit 1
    fi
else
    echo "⚠️  仍有 $new_count 個 StandardError 需要手動處理"
    echo "🔍 剩餘的 StandardError 位置："
    grep -n "new StandardError" "$TARGET_FILE"
    echo "📁 備份檔案保留在: $BACKUP_FILE"
fi

echo "🎉 檔案 StandardError 修復完成: $(basename "$TARGET_FILE")"