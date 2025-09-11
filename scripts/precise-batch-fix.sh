#!/bin/bash

# 精確批次修復腳本
# 基於已驗證的修復模式，專門處理高信心度的錯誤格式問題

set -e

PROJECT_ROOT="/Users/mac-eric/project/book_overview_v1"
BACKUP_DIR="$PROJECT_ROOT/.backup/precise_fix_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$PROJECT_ROOT/scripts/precise-fix.log"

# 建立備份和日誌目錄
mkdir -p "$BACKUP_DIR"

echo "🎯 精確批次修復開始" | tee "$LOG_FILE"
echo "📁 備份目錄: $BACKUP_DIR" | tee -a "$LOG_FILE"

# 函數：修復 throw new Error - 基於 ISynchronizationCoordinator 驗證成功的模式
fix_standard_error_pattern() {
    local file="$1"
    local backup_file="$BACKUP_DIR/$(basename "$file")"
    
    # 備份檔案
    cp "$file" "$backup_file"
    
    # 檢查是否包含需要修復的模式
    if grep -q "throw new Error(" "$file"; then
        local temp_file=$(mktemp)
        
        # Pattern 1: throw new Error('message') -> throw StandardError.create('message', { code: 'IMPLEMENTATION_ERROR' })
        sed -E "s/throw new Error\('([^']*)'?\)/throw StandardError.create('\1', { code: 'IMPLEMENTATION_ERROR' })/g" "$file" > "$temp_file"
        
        # Pattern 2: throw new Error("message") -> throw StandardError.create("message", { code: 'IMPLEMENTATION_ERROR' })
        sed -i.backup -E 's/throw new Error\("([^"]*)\"?\)/throw StandardError.create("\1", { code: "IMPLEMENTATION_ERROR" })/g' "$temp_file"
        
        # Pattern 3: throw new Error(`message`) -> throw StandardError.create(`message`, { code: 'IMPLEMENTATION_ERROR' })
        sed -i.backup -E 's/throw new Error\(`([^`]*)`?\)/throw StandardError.create(`\1`, { code: `IMPLEMENTATION_ERROR` })/g' "$temp_file"
        
        # 移動修復後的檔案
        mv "$temp_file" "$file"
        rm -f "$temp_file.backup"
        
        # 檢查並新增 StandardError 匯入
        if ! grep -q "const StandardError = require('src/core/errors/StandardError')" "$file" && grep -q "StandardError.create" "$file"; then
            local temp_with_import=$(mktemp)
            echo "const StandardError = require('src/core/errors/StandardError')" > "$temp_with_import"
            echo "" >> "$temp_with_import"
            cat "$file" >> "$temp_with_import"
            mv "$temp_with_import" "$file"
            echo "  ✅ 新增 StandardError 匯入: $(basename "$file")" | tee -a "$LOG_FILE"
        fi
        
        return 0  # 修復成功
    fi
    
    return 1  # 無需修復
}

# 函數：修復測試檔案 .toThrow 模式
fix_test_tothrow_pattern() {
    local file="$1"
    local backup_file="$BACKUP_DIR/$(basename "$file")"
    
    # 備份檔案  
    cp "$file" "$backup_file"
    
    if grep -q "\.toThrow(" "$file"; then
        local temp_file=$(mktemp)
        
        # Pattern: .toThrow('message') -> .toMatchObject(expect.objectContaining({ message: 'message' }))
        sed -E "s/\.toThrow\('([^']*)'\)/.toMatchObject(expect.objectContaining({ message: '\1' }))/g" "$file" > "$temp_file"
        
        # Pattern: .toThrow("message") -> .toMatchObject(expect.objectContaining({ message: "message" }))
        sed -i.backup -E 's/\.toThrow\("([^"]*)"\)/.toMatchObject(expect.objectContaining({ message: "\1" }))/g' "$temp_file"
        
        mv "$temp_file" "$file"
        rm -f "$temp_file.backup"
        
        return 0
    fi
    
    return 1
}

# 階段 1: 處理所有原始檔中的 throw new Error 模式
echo -e "\n🔧 階段 1: 修復 src/ 中的 throw new Error 模式" | tee -a "$LOG_FILE"

FIXED_SOURCE_COUNT=0
find "$PROJECT_ROOT/src" -name "*.js" | while read -r file; do
    if fix_standard_error_pattern "$file"; then
        echo "  ✅ $(basename "$file")" | tee -a "$LOG_FILE"
        ((FIXED_SOURCE_COUNT++))
    fi
done

echo "階段 1 完成，修復了原始碼檔案中的 throw new Error 模式" | tee -a "$LOG_FILE"

# 階段 2: 處理測試檔案中的 .toThrow 模式  
echo -e "\n🧪 階段 2: 修復測試檔案中的 .toThrow 模式" | tee -a "$LOG_FILE"

FIXED_TEST_COUNT=0
find "$PROJECT_ROOT/tests" -name "*.test.js" | while read -r file; do
    if fix_test_tothrow_pattern "$file"; then
        echo "  ✅ $(basename "$file")" | tee -a "$LOG_FILE"
        ((FIXED_TEST_COUNT++))
    fi
done

echo "階段 2 完成，修復了測試檔案中的 .toThrow 模式" | tee -a "$LOG_FILE"

# 階段 3: 驗證修復結果
echo -e "\n📊 階段 3: 驗證修復結果" | tee -a "$LOG_FILE"

# 統計剩餘的 throw new Error 
REMAINING_THROW=$(find "$PROJECT_ROOT/src" -name "*.js" | xargs grep -c "throw new Error(" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
echo "剩餘 throw new Error 模式: $REMAINING_THROW" | tee -a "$LOG_FILE"

# 統計剩餘的 .toThrow
REMAINING_TOTHROW=$(find "$PROJECT_ROOT/tests" -name "*.test.js" | xargs grep -c "\.toThrow(" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')  
echo "剩餘 .toThrow 模式: $REMAINING_TOTHROW" | tee -a "$LOG_FILE"

echo -e "\n🎯 精確批次修復完成!" | tee -a "$LOG_FILE"
echo "📁 所有修復的檔案都已備份到: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "⏰ 完成時間: $(date)" | tee -a "$LOG_FILE"

# 建議下一步行動
echo -e "\n🔍 建議立即執行:" | tee -a "$LOG_FILE"
echo "1. npx jest tests/unit/background/domains/data-management/interfaces/ISynchronizationCoordinator.test.js --verbose  # 驗證修復品質" | tee -a "$LOG_FILE"
echo "2. npm test  # 執行完整測試驗證" | tee -a "$LOG_FILE"
echo "3. 如有問題可從備份復原: cp $BACKUP_DIR/* [target_directory]" | tee -a "$LOG_FILE"