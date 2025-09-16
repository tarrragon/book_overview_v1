#!/bin/bash

# Logger 引用位置修復腳本
# 將錯誤放置的 Logger 引用移動到文件頂部

echo "🔧 開始修復 Logger 引用位置..."

# 需要檢查和修復的文件
files_to_check=(
    "src/core/messages.js"
    "src/overview/overview-page-controller.js" 
    "src/overview/overview.js"
    "src/popup/diagnostic-module.js"
    "src/popup/popup-controller.js"
    "src/ui/handlers/ui-dom-manager.js"
)

fix_logger_position() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        echo "  ⚠️  文件不存在: $file"
        return
    fi
    
    echo "  🔧 檢查: $file"
    
    # 檢查是否有 Logger 引用在錯誤位置（非頂部區域）
    logger_line=$(grep -n 'const { Logger } = require.*logging' "$file" | cut -d: -f1)
    
    if [[ -z "$logger_line" ]]; then
        echo "    ℹ️  未找到 Logger 引用，跳過"
        return
    fi
    
    # 檢查 Logger 引用是否在合適位置（前50行內）
    if [[ $logger_line -le 50 ]]; then
        echo "    ✅ Logger 引用位置正確（第 $logger_line 行）"
        return
    fi
    
    echo "    🔧 修復 Logger 引用位置（從第 $logger_line 行移到頂部）"
    
    # 創建臨時文件
    temp_file="${file}.tmp"
    
    # 提取 Logger 引用行
    logger_import=$(sed -n "${logger_line}p" "$file")
    
    # 移除原 Logger 引用行並重新插入到合適位置
    awk -v logger_line="$logger_line" -v logger_import="$logger_import" '
    BEGIN { 
        inserted = 0
        logger_found = 0
    }
    
    # 跳過原來的 Logger 引用行
    NR == logger_line { next }
    
    # 在適當位置插入 Logger 引用
    !inserted && (
        # 在其他 require 語句之後
        (/^const.*require\(/ && !/Logger/) ||
        # 或在註解結束後
        (/^\*\// && getline next_line > 0 && next_line !~ /^\/\*/)
    ) {
        print
        if (/^\*\//) {
            print next_line
        }
        print logger_import
        inserted = 1
        next
    }
    
    # 如果還沒插入且遇到第一個非註解、非空行
    !inserted && !/^\/\*/ && !/^\*/ && !/^$/ && NR > 5 {
        print logger_import
        print ""
        print
        inserted = 1
        next
    }
    
    { print }
    
    END {
        if (!inserted) {
            print ""
            print logger_import
        }
    }' "$file" > "$temp_file"
    
    # 替換原文件
    mv "$temp_file" "$file"
    echo "    ✅ 完成修復: $file"
}

# 執行修復
for file in "${files_to_check[@]}"; do
    fix_logger_position "$file"
done

echo ""
echo "🔍 驗證修復結果..."

# 檢查剩餘的 Logger 未定義錯誤
logger_errors=$(npm run lint --silent 2>&1 | grep "'Logger' is not defined" | wc -l)
echo "剩餘 Logger 未定義錯誤: $logger_errors"

if [[ $logger_errors -eq 0 ]]; then
    echo "✅ 所有 Logger 未定義錯誤已解決"
else
    echo "⚠️  仍有 $logger_errors 個 Logger 未定義錯誤"
fi

echo ""
echo "🎉 Logger 引用位置修復完成！"