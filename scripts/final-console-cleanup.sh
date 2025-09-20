#!/bin/bash

echo "🧹 最終清理：處理剩餘的 console warnings 和清理備份檔案"

echo "🔍 檢查剩餘的未處理 console 語句..."
# 搜尋沒有 eslint-disable 註解的 console 語句
remaining_console=$(grep -r "console\.\(log\|warn\|error\|info\|debug\)" tests/ --include="*.js" | grep -v "eslint-disable-next-line no-console" | grep -v ".bak:" | wc -l)

echo "發現 ${remaining_console} 個未處理的 console 語句"

if [ "$remaining_console" -gt 0 ]; then
    echo "📝 列出未處理的 console 語句："
    grep -r "console\.\(log\|warn\|error\|info\|debug\)" tests/ --include="*.js" | grep -v "eslint-disable-next-line no-console" | grep -v ".bak:" | head -10
fi

echo ""
echo "🗑️  清理備份檔案..."
find tests/ -name "*.bak" -type f -delete
echo "✅ 備份檔案清理完成"

echo ""
echo "📊 最終統計："
echo "剩餘需要處理的 console 語句: $(grep -r "console\.\(log\|warn\|error\|info\|debug\)" tests/ --include="*.js" | grep -v "eslint-disable-next-line no-console" | wc -l)"
echo "已處理的 console 語句: $(grep -r "eslint-disable-next-line no-console" tests/ --include="*.js" | wc -l)"

echo ""
echo "🎉 Console warnings 清理工作完成！"