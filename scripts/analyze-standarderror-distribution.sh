#!/bin/bash

echo "=== 分析剩餘 StandardError 錯誤分布 ==="
echo

# 創建臨時檔案來存儲 lint 輸出
TEMP_FILE=$(mktemp)
npm run lint 2>&1 > "$TEMP_FILE"

echo "📊 StandardError 錯誤統計："
echo "總數：$(grep "no-restricted-syntax" "$TEMP_FILE" | wc -l | tr -d ' ')"
echo

echo "📁 檔案分布 (前 20 個)："
echo "錯誤數 | 檔案路徑"
echo "------|--------"

# 獲取包含 StandardError 錯誤的檔案清單
FILES=$(grep -B1 "no-restricted-syntax" "$TEMP_FILE" | grep "^/" | sort | uniq)

# 統計每個檔案的錯誤數量
while IFS= read -r file; do
  if [[ -n "$file" ]]; then
    count=$(grep -F "$file" "$TEMP_FILE" | grep "no-restricted-syntax" | wc -l | tr -d ' ')
    short_name=$(basename "$file")  # 只顯示檔案名
    echo "$count | $short_name"
  fi
done <<< "$FILES" | sort -nr | head -20

echo
echo "🎯 建議處理策略："
echo "1. 優先處理錯誤數量最多的檔案"
echo "2. 主要是測試檔案，可以使用測試專用的錯誤處理模式"
echo "3. 使用批量處理腳本提高效率"

# 清理臨時檔案
rm "$TEMP_FILE"