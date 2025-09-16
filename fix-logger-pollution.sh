#!/bin/bash

# Logger 污染修復腳本
# 修復自動化腳本造成的重複 Logger 引用污染問題

echo "🚨 開始修復 Logger 污染問題..."

# 受影響的檔案列表 (根據 ESLint parsing errors 識別)
affected_files=(
    "src/export/handlers/handler-registry.js"
    "src/overview/overview.js"
    "src/popup/diagnostic-module.js"
    "src/popup/popup-controller.js"
    "src/popup/popup-event-controller.js"
    "src/ui/book-grid-renderer.js"
    "src/ui/handlers/base-ui-handler.js"
    "src/ui/handlers/ui-dom-manager.js"
    "src/ui/handlers/ui-progress-handler.js"
    "src/ui/search/ui-controller/search-ui-controller.js"
)

# 備份原始檔案
echo "📦 建立備份..."
backup_dir="backup_polluted_files_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

for file in "${affected_files[@]}"; do
    if [[ -f "$file" ]]; then
        cp "$file" "$backup_dir/"
        echo "  ✓ 備份: $file"
    fi
done

# 修復策略：移除重複的 Logger 引用行，保留第一個有效的
echo "🔧 開始修復檔案..."

fixed_count=0
for file in "${affected_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  🔧 修復: $file"
        
        # 建立臨時檔案
        temp_file="${file}.tmp"
        
        # 移除所有重複的 Logger 引用行，但保留程式邏輯
        # 策略: 刪除獨立成行的重複 Logger require
        sed '/^const Logger = require("src\/core\/logging\/Logger")$/d' "$file" > "$temp_file"
        
        # 檢查是否需要在檔案開頭加入一個正確的 Logger 引用
        if ! grep -q 'const.*Logger.*require.*logging' "$temp_file"; then
            # 在註解塊後面加入正確的 Logger 引用
            awk '
            BEGIN { logger_added = 0 }
            /^\*\// && !logger_added { 
                print $0
                print ""
                print "const { Logger } = require(\"src/core/logging\")"
                logger_added = 1
                next
            }
            { print }
            ' "$temp_file" > "${temp_file}.2"
            mv "${temp_file}.2" "$temp_file"
        fi
        
        # 替換原檔案
        mv "$temp_file" "$file"
        ((fixed_count++))
        
        echo "    ✅ 完成: $file"
    else
        echo "    ⚠️  檔案不存在: $file"
    fi
done

echo ""
echo "📊 修復結果:"
echo "  📁 備份目錄: $backup_dir"
echo "  🔧 修復檔案數: $fixed_count"

# 驗證修復結果
echo ""
echo "🔍 驗證修復結果..."

# 檢查 parsing errors 是否解決
echo "檢查 ESLint parsing errors..."
parsing_errors=$(npm run lint 2>&1 | grep "Parsing error.*Logger" | wc -l)

if [[ $parsing_errors -eq 0 ]]; then
    echo "✅ 所有 Logger parsing errors 已解決"
else
    echo "⚠️  仍有 $parsing_errors 個 parsing errors，可能需要手動檢查"
fi

# 檢查重複 Logger 宣告
echo "檢查重複 Logger 宣告..."
for file in "${affected_files[@]}"; do
    if [[ -f "$file" ]]; then
        logger_count=$(grep -c 'const.*Logger.*require' "$file" 2>/dev/null || echo "0")
        if [[ $logger_count -gt 1 ]]; then
            echo "⚠️  $file 仍有 $logger_count 個 Logger 宣告"
        fi
    fi
done

echo ""
echo "🎉 Logger 污染修復完成！"
echo ""
echo "後續步驟："
echo "1. 執行 npm run lint 檢查錯誤是否減少"
echo "2. 執行相關測試確保功能正常"
echo "3. 如修復有問題，可從 $backup_dir 恢復檔案"