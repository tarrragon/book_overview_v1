#!/bin/bash

# 修復測試檔案中的 StandardError 實例
# 將 new StandardError(code, message, details) 轉換為 ErrorCodes IIFE 模式

echo "🔧 修復測試檔案中的 StandardError 實例..."

TEST_FILE="/Users/tarragon/Projects/book_overview_v1/tests/unit/export/export-user-feedback.test.js"

if [ ! -f "$TEST_FILE" ]; then
    echo "❌ 測試檔案不存在: $TEST_FILE"
    exit 1
fi

echo "📂 處理檔案: $(basename "$TEST_FILE")"

# 備份原檔案
cp "$TEST_FILE" "$TEST_FILE.backup"

# 1. 計算原始 StandardError 數量
original_count=$(grep -c "new StandardError" "$TEST_FILE")
echo "📊 原始 StandardError 實例數: $original_count"

# 2. 使用 sed 轉換 StandardError 為 ErrorCodes IIFE 模式
# 匹配模式: new StandardError('CODE', 'message', { details })
# 轉換為: (() => { const error = new Error('message'); error.code = ErrorCodes.CODE; error.details = { details }; return error })()

sed -i '' -E 's/new StandardError\('\''([^'\''"]+)'\'', '\''([^'\''"]*)'\'', \{([^}]*)\}\)/(() => { const error = new Error('\''\2'\''); error.code = ErrorCodes.\1; error.details = {\3}; return error })()/g' "$TEST_FILE"

# 3. 處理沒有 details 的情況
# 匹配模式: new StandardError('CODE', 'message')
sed -i '' -E 's/new StandardError\('\''([^'\''"]+)'\'', '\''([^'\''"]*)'\''\)/(() => { const error = new Error('\''\2'\''); error.code = ErrorCodes.\1; return error })()/g' "$TEST_FILE"

# 4. 驗證轉換結果
new_count=$(grep -c "new StandardError" "$TEST_FILE")
converted_count=$(grep -c "error.code = ErrorCodes\." "$TEST_FILE")

echo "📊 轉換結果:"
echo "  - 剩餘 StandardError: $new_count"
echo "  - 新增 ErrorCodes: $converted_count"

if [ "$new_count" -eq 0 ]; then
    echo "✅ 所有 StandardError 已成功轉換"
    rm "$TEST_FILE.backup"
else
    echo "⚠️  仍有 $new_count 個 StandardError 需要手動處理"
    echo "🔍 剩餘的 StandardError 位置："
    grep -n "new StandardError" "$TEST_FILE"
fi

# 5. 檢查語法錯誤
echo "🔍 檢查轉換後的語法..."
node -c "$TEST_FILE" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 語法檢查通過"
else
    echo "❌ 語法錯誤，恢復備份"
    mv "$TEST_FILE.backup" "$TEST_FILE"
    exit 1
fi

echo "🎉 測試檔案 StandardError 修復完成"