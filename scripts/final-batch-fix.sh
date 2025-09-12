#!/bin/bash

# 最終批次修復腳本 - 基於手動驗證成功的修復模式
set -e

# 動態獲取專案根目錄路徑
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/.backup/final_fix_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$PROJECT_ROOT/scripts/final-fix.log"

mkdir -p "$BACKUP_DIR"

echo "🎯 最終批次修復開始" | tee "$LOG_FILE"
echo "📁 備份目錄: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "⏰ 開始時間: $(date)" | tee -a "$LOG_FILE"

# 統計修復前狀態
echo -e "\n📊 修復前狀態:" | tee -a "$LOG_FILE"
BEFORE_SRC_FILES=$(find "$PROJECT_ROOT/src" -name "*.js" | xargs grep -l "throw new Error(" 2>/dev/null | wc -l)
BEFORE_SRC_OCCURRENCES=$(find "$PROJECT_ROOT/src" -name "*.js" | xargs grep -c "throw new Error(" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
BEFORE_TEST_TOTHROW=$(find "$PROJECT_ROOT/tests" -name "*.test.js" | xargs grep -c "\.toThrow(" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')

echo "原始碼檔案包含 throw new Error: $BEFORE_SRC_FILES 個檔案" | tee -a "$LOG_FILE"
echo "throw new Error 總出現次數: $BEFORE_SRC_OCCURRENCES 次" | tee -a "$LOG_FILE"
echo "測試檔案中 .toThrow 出現次數: $BEFORE_TEST_TOTHROW 次" | tee -a "$LOG_FILE"

# 函數：修復原始碼檔案
fix_source_file() {
    local file="$1"
    local rel_path="${file#$PROJECT_ROOT/}"
    local backup_file="$BACKUP_DIR/$(basename "$file")"
    
    # 備份
    cp "$file" "$backup_file"
    
    if grep -q "throw new Error(" "$file"; then
        local temp_file=$(mktemp)
        
        # 替換模式：throw new Error('msg') -> throw new StandardError('IMPLEMENTATION_ERROR', 'msg')
        sed -E "s/throw new Error\('([^']*)'\)/throw new StandardError('IMPLEMENTATION_ERROR', '\1')/g" "$file" > "$temp_file"
        sed -i.bak -E 's/throw new Error\("([^"]*)"\)/throw new StandardError("IMPLEMENTATION_ERROR", "\1")/g' "$temp_file"
        sed -i.bak -E 's/throw new Error\(`([^`]*)`\)/throw new StandardError(`IMPLEMENTATION_ERROR`, `\1`)/g' "$temp_file"
        
        mv "$temp_file" "$file"
        rm -f "$temp_file.bak"
        
        # 添加 StandardError 匯入
        if ! grep -q "StandardError" "$file"; then
            temp_file=$(mktemp)
            echo "const { StandardError } = require('src/core/errors/StandardError')" > "$temp_file"
            echo "" >> "$temp_file"
            cat "$file" >> "$temp_file"
            mv "$temp_file" "$file"
        fi
        
        echo "  ✅ 修復原始碼: $rel_path" | tee -a "$LOG_FILE"
        return 0
    fi
    return 1
}

# 函數：修復測試檔案
fix_test_file() {
    local file="$1"
    local rel_path="${file#$PROJECT_ROOT/}"
    local backup_file="$BACKUP_DIR/$(basename "$file")"
    
    cp "$file" "$backup_file"
    
    if grep -q "\.toThrow(" "$file"; then
        local temp_file=$(mktemp)
        
        # 異步方法: .rejects.toThrow('msg') -> .rejects.toMatchObject(expect.objectContaining({ message: 'msg' }))
        sed -E "s/\.rejects\.toThrow\('([^']*)'\)/.rejects.toMatchObject(expect.objectContaining({ message: '\1' }))/g" "$file" > "$temp_file"
        sed -i.bak -E 's/\.rejects\.toThrow\("([^"]*)"\)/.rejects.toMatchObject(expect.objectContaining({ message: "\1" }))/g' "$temp_file"
        
        # 同步方法: .toThrow('msg') -> .toThrow(expect.objectContaining({ message: 'msg' }))
        # 但排除已經處理過的 .rejects.toThrow
        sed -i.bak -E 's/([^s])\.toThrow\('\''([^'\'']*)'\'\)/\1.toThrow(expect.objectContaining({ message: '\''\2'\'' }))/g' "$temp_file"
        sed -i.bak -E 's/([^s])\.toThrow\("([^"]*)"\)/\1.toThrow(expect.objectContaining({ message: "\2" }))/g' "$temp_file"
        
        mv "$temp_file" "$file"
        rm -f "$temp_file.bak"
        
        echo "  ✅ 修復測試: $rel_path" | tee -a "$LOG_FILE"
        return 0
    fi
    return 1
}

# 階段 1: 修復所有原始碼檔案
echo -e "\n🔧 階段 1: 修復原始碼中的 throw new Error" | tee -a "$LOG_FILE"
FIXED_SRC=0

find "$PROJECT_ROOT/src" -name "*.js" | while read -r file; do
    if fix_source_file "$file"; then
        ((FIXED_SRC++))
    fi
done

echo "階段 1 完成" | tee -a "$LOG_FILE"

# 階段 2: 修復測試檔案
echo -e "\n🧪 階段 2: 修復測試檔案中的 .toThrow" | tee -a "$LOG_FILE"
FIXED_TEST=0

find "$PROJECT_ROOT/tests" -name "*.test.js" | while read -r file; do
    if fix_test_file "$file"; then
        ((FIXED_TEST++))
    fi
done

echo "階段 2 完成" | tee -a "$LOG_FILE"

# 最終統計
echo -e "\n📊 修復後狀態:" | tee -a "$LOG_FILE"
AFTER_SRC_FILES=$(find "$PROJECT_ROOT/src" -name "*.js" | xargs grep -l "throw new Error(" 2>/dev/null | wc -l)
AFTER_SRC_OCCURRENCES=$(find "$PROJECT_ROOT/src" -name "*.js" | xargs grep -c "throw new Error(" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
AFTER_TEST_TOTHROW=$(find "$PROJECT_ROOT/tests" -name "*.test.js" | xargs grep -c "\.toThrow(" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')

echo "剩餘 throw new Error 檔案: $AFTER_SRC_FILES (原 $BEFORE_SRC_FILES)" | tee -a "$LOG_FILE"
echo "剩餘 throw new Error 次數: $AFTER_SRC_OCCURRENCES (原 $BEFORE_SRC_OCCURRENCES)" | tee -a "$LOG_FILE"
echo "剩餘 .toThrow 次數: $AFTER_TEST_TOTHROW (原 $BEFORE_TEST_TOTHROW)" | tee -a "$LOG_FILE"

FIXED_SRC_TOTAL=$((BEFORE_SRC_OCCURRENCES - AFTER_SRC_OCCURRENCES))
FIXED_TEST_TOTAL=$((BEFORE_TEST_TOTHROW - AFTER_TEST_TOTHROW))

echo -e "\n🎯 修復成果:" | tee -a "$LOG_FILE"
echo "修復的 throw new Error: $FIXED_SRC_TOTAL 個" | tee -a "$LOG_FILE"
echo "修復的 .toThrow: $FIXED_TEST_TOTAL 個" | tee -a "$LOG_FILE"
echo "總修復數量: $((FIXED_SRC_TOTAL + FIXED_TEST_TOTAL)) 個" | tee -a "$LOG_FILE"

echo -e "\n✅ 最終批次修復完成!" | tee -a "$LOG_FILE"
echo "📁 備份位置: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "⏰ 完成時間: $(date)" | tee -a "$LOG_FILE"

echo -e "\n🔍 建議立即執行驗證:" | tee -a "$LOG_FILE"
echo "1. npx jest tests/unit/core/event-handler.test.js --verbose" | tee -a "$LOG_FILE"
echo "2. npx jest tests/unit/background/domains/data-management/interfaces/ISynchronizationCoordinator.test.js --verbose" | tee -a "$LOG_FILE"
echo "3. npm test  # 完整測試" | tee -a "$LOG_FILE"