#!/bin/bash

# Logger 引用修復腳本
# 為使用 Logger 但缺少引用的文件添加正確的 import

echo "🔧 開始修復 Logger 引用問題..."

# 受影響的檔案列表 (根據 ESLint 'Logger' is not defined errors 識別)
affected_files=(
    "src/core/messages.js"
    "src/export/handlers/handler-registry.js"
    "src/overview/overview-page-controller.js"
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

# 備份檔案
echo "📦 建立備份..."
backup_dir="backup_logger_imports_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

for file in "${affected_files[@]}"; do
    if [[ -f "$file" ]]; then
        cp "$file" "$backup_dir/"
        echo "  ✓ 備份: $file"
    fi
done

# 修復函數
fix_logger_import() {
    local file="$1"
    
    echo "  🔧 修復: $file"
    
    # 檢查文件是否使用 Logger
    if ! grep -q "Logger\." "$file"; then
        echo "    ⚠️  文件未使用 Logger，跳過"
        return
    fi
    
    # 檢查是否已有 Logger 引用
    if grep -q "Logger.*require\|require.*Logger" "$file"; then
        echo "    ℹ️  已有 Logger 引用，跳過"
        return
    fi
    
    # 建立臨時檔案
    temp_file="${file}.tmp"
    
    # 根據文件類型決定插入位置和格式
    if [[ "$file" == *".js" ]]; then
        # 找到適當的插入位置 (在註解塊後面，其他 require 之前或之後)
        
        # 檢查是否已有其他 require 語句
        if grep -q "require(" "$file"; then
            # 有其他 require，插入在最後一個 require 之後
            awk '
            /require\(/ { last_require_line = NR }
            { lines[NR] = $0; max_line = NR }
            END {
                if (last_require_line > 0) {
                    for (i = 1; i <= last_require_line; i++) print lines[i]
                    print "const { Logger } = require(\"src/core/logging\")"
                    for (i = last_require_line + 1; i <= max_line; i++) print lines[i]
                } else {
                    # 沒找到 require，在註解塊後插入
                    inserted = 0
                    for (i = 1; i <= max_line; i++) {
                        print lines[i]
                        if (!inserted && lines[i] ~ /^\*\// && lines[i+1] !~ /^\/\*/) {
                            print ""
                            print "const { Logger } = require(\"src/core/logging\")"
                            inserted = 1
                        }
                    }
                    if (!inserted) {
                        # 如果找不到註解結束，在開頭插入
                        print "const { Logger } = require(\"src/core/logging\")"
                    }
                }
            }' "$file" > "$temp_file"
        else
            # 沒有其他 require，在註解塊後插入
            awk '
            { lines[++line_count] = $0 }
            END {
                inserted = 0
                for (i = 1; i <= line_count; i++) {
                    print lines[i]
                    # 在註解塊結束後插入
                    if (!inserted && lines[i] ~ /^\*\// && lines[i+1] !~ /^\/\*/) {
                        print ""
                        print "const { Logger } = require(\"src/core/logging\")"
                        print ""
                        inserted = 1
                    }
                }
                # 如果沒找到合適位置，在開頭插入
                if (!inserted) {
                    print "// Logger import added"
                    print "const { Logger } = require(\"src/core/logging\")"
                    print ""
                }
            }' "$file" > "$temp_file"
        fi
        
        # 替換原檔案
        mv "$temp_file" "$file"
        echo "    ✅ 完成: $file"
    else
        echo "    ⚠️  不支持的文件類型: $file"
    fi
}

# 執行修復
fixed_count=0
for file in "${affected_files[@]}"; do
    if [[ -f "$file" ]]; then
        fix_logger_import "$file"
        ((fixed_count++))
    else
        echo "  ⚠️  檔案不存在: $file"
    fi
done

echo ""
echo "📊 修復結果:"
echo "  📁 備份目錄: $backup_dir"
echo "  🔧 處理檔案數: $fixed_count"

# 驗證修復結果
echo ""
echo "🔍 驗證修復結果..."

# 檢查 Logger undefined errors 是否解決
echo "檢查 'Logger is not defined' errors..."
logger_errors=$(npm run lint 2>&1 | grep "'Logger' is not defined" | wc -l)

echo "剩餘 Logger 未定義錯誤: $logger_errors"

if [[ $logger_errors -eq 0 ]]; then
    echo "✅ 所有 Logger 未定義錯誤已解決"
else
    echo "⚠️  仍有 $logger_errors 個 Logger 未定義錯誤"
    echo "需要檢查的文件："
    npm run lint 2>&1 | grep -B1 "'Logger' is not defined" | grep "\.js:" | head -5
fi

echo ""
echo "🎉 Logger 引用修復完成！"
echo ""
echo "後續步驟："
echo "1. 執行 npm run lint 檢查錯誤是否減少"
echo "2. 如修復有問題，可從 $backup_dir 恢復檔案"
echo "3. 檢查修復後的 Logger 引用是否正確"