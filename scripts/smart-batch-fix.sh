#!/bin/bash

# 智能批次修復腳本 - 基於實際 StandardError 結構
set -e

PROJECT_ROOT="/Users/mac-eric/project/book_overview_v1"
BACKUP_DIR="$PROJECT_ROOT/.backup/smart_fix_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$PROJECT_ROOT/scripts/smart-fix.log"

mkdir -p "$BACKUP_DIR"

echo "🧠 智能批次修復開始" | tee "$LOG_FILE"
echo "📁 備份目錄: $BACKUP_DIR" | tee -a "$LOG_FILE"

# 函數：檢查檔案是否需要修復
needs_throw_error_fix() {
    local file="$1"
    grep -q "throw new Error(" "$file" 2>/dev/null
}

# 函數：智能修復 throw new Error 模式
smart_fix_throw_pattern() {
    local file="$1"
    local rel_path="${file#$PROJECT_ROOT/}"
    local backup_file="$BACKUP_DIR/$(basename "$file")"
    
    # 備份檔案
    cp "$file" "$backup_file"
    
    if needs_throw_error_fix "$file"; then
        local temp_file=$(mktemp)
        
        # 使用更智能的替換模式，匹配 StandardError 的實際 API
        # Pattern: throw new Error('message') -> throw new StandardError('IMPLEMENTATION_ERROR', 'message')
        sed -E "s/throw new Error\('([^']*)'\)/throw new StandardError('IMPLEMENTATION_ERROR', '\1')/g" "$file" > "$temp_file"
        
        # Pattern: throw new Error("message") -> throw new StandardError('IMPLEMENTATION_ERROR', "message")
        sed -i.backup -E 's/throw new Error\("([^"]*)"\)/throw new StandardError("IMPLEMENTATION_ERROR", "\1")/g' "$temp_file"
        
        # Pattern: throw new Error(`message`) -> throw new StandardError('IMPLEMENTATION_ERROR', `message`)
        sed -i.backup -E 's/throw new Error\(`([^`]*)`\)/throw new StandardError(`IMPLEMENTATION_ERROR`, `\1`)/g' "$temp_file"
        
        mv "$temp_file" "$file"
        rm -f "$temp_file.backup"
        
        # 智能添加正確的匯入語句
        if ! grep -q "StandardError" "$file" || ! grep -q "require.*StandardError" "$file"; then
            # 檢查是否已經有其他 require 語句來決定插入位置
            if grep -q "^const.*require" "$file"; then
                # 在第一行 require 之前插入
                local temp_with_import=$(mktemp)
                awk '/^const.*require/ && !added {print "const { StandardError } = require('"'"'src/core/errors/StandardError'"'"')"; print ""; added=1} 1' "$file" > "$temp_with_import"
                mv "$temp_with_import" "$file"
            else
                # 在檔案開頭插入
                local temp_with_import=$(mktemp)
                echo "const { StandardError } = require('src/core/errors/StandardError')" > "$temp_with_import"
                echo "" >> "$temp_with_import"
                cat "$file" >> "$temp_with_import"
                mv "$temp_with_import" "$file"
            fi
            echo "  ➕ 新增 StandardError 匯入: $rel_path" | tee -a "$LOG_FILE"
        fi
        
        echo "  ✅ 修復完成: $rel_path" | tee -a "$LOG_FILE"
        return 0
    fi
    
    return 1
}

# 函數：修復測試檔案 .toThrow 模式
smart_fix_test_pattern() {
    local file="$1"
    local rel_path="${file#$PROJECT_ROOT/}"
    local backup_file="$BACKUP_DIR/$(basename "$file")"
    
    cp "$file" "$backup_file"
    
    if grep -q "\.toThrow(" "$file"; then
        local temp_file=$(mktemp)
        
        # 智能替換 .toThrow() 為符合 StandardError 結構的匹配模式
        sed -E "s/\.toThrow\('([^']*)'\)/.toMatchObject(expect.objectContaining({ message: '\1' }))/g" "$file" > "$temp_file"
        sed -i.backup -E 's/\.toThrow\("([^"]*)"\)/.toMatchObject(expect.objectContaining({ message: "\1" }))/g' "$temp_file"
        sed -i.backup -E 's/\.toThrow\(`([^`]*)`\)/.toMatchObject(expect.objectContaining({ message: `\1` }))/g' "$temp_file"
        
        mv "$temp_file" "$file"
        rm -f "$temp_file.backup"
        
        echo "  ✅ 測試修復: $rel_path" | tee -a "$LOG_FILE"
        return 0
    fi
    
    return 1
}

# 統計修復前的狀態
echo -e "\n📊 修復前狀態統計:" | tee -a "$LOG_FILE"
BEFORE_SRC=$(find "$PROJECT_ROOT/src" -name "*.js" | xargs grep -l "throw new Error(" 2>/dev/null | wc -l)
BEFORE_TEST=$(find "$PROJECT_ROOT/tests" -name "*.test.js" | xargs grep -l "\.toThrow(" 2>/dev/null | wc -l)
echo "需要修復的原始碼檔案: $BEFORE_SRC" | tee -a "$LOG_FILE"
echo "需要修復的測試檔案: $BEFORE_TEST" | tee -a "$LOG_FILE"

# 階段 1: 修復原始碼檔案
echo -e "\n🔧 階段 1: 修復原始碼中的 throw new Error" | tee -a "$LOG_FILE"
FIXED_SRC=0

find "$PROJECT_ROOT/src" -name "*.js" | while read -r file; do
    if smart_fix_throw_pattern "$file"; then
        ((FIXED_SRC++))
    fi
done

echo "原始碼修復完成，處理了檔案數量" | tee -a "$LOG_FILE"

# 階段 2: 修復測試檔案
echo -e "\n🧪 階段 2: 修復測試檔案中的 .toThrow" | tee -a "$LOG_FILE"
FIXED_TEST=0

find "$PROJECT_ROOT/tests" -name "*.test.js" | while read -r file; do
    if smart_fix_test_pattern "$file"; then
        ((FIXED_TEST++))
    fi
done

echo "測試檔案修復完成" | tee -a "$LOG_FILE"

# 階段 3: 最終驗證
echo -e "\n📊 修復後狀態統計:" | tee -a "$LOG_FILE"
AFTER_SRC=$(find "$PROJECT_ROOT/src" -name "*.js" | xargs grep -l "throw new Error(" 2>/dev/null | wc -l)
AFTER_TEST=$(find "$PROJECT_ROOT/tests" -name "*.test.js" | xargs grep -l "\.toThrow(" 2>/dev/null | wc -l)
echo "剩餘需修復的原始碼檔案: $AFTER_SRC (原 $BEFORE_SRC)" | tee -a "$LOG_FILE"
echo "剩餘需修復的測試檔案: $AFTER_TEST (原 $BEFORE_TEST)" | tee -a "$LOG_FILE"

echo -e "\n🎯 智能批次修復完成!" | tee -a "$LOG_FILE"
echo "📁 備份位置: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "⏰ 完成時間: $(date)" | tee -a "$LOG_FILE"

# 快速驗證建議
echo -e "\n🔍 建議立即驗證:" | tee -a "$LOG_FILE"
echo "1. 測試修復品質: npx jest tests/unit/background/domains/data-management/interfaces/ISynchronizationCoordinator.test.js --verbose" | tee -a "$LOG_FILE"
echo "2. 全面測試驗證: npm test" | tee -a "$LOG_FILE"
echo "3. 檢查語法正確性: npm run lint" | tee -a "$LOG_FILE"