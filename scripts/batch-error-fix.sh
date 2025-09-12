#!/bin/bash

# 批次錯誤格式修復腳本
# 自動化修復 throw new Error 和 .toThrow() 格式問題

set -e  # 遇到錯誤就停止

# 動態獲取專案根目錄路徑
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/.backup/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$PROJECT_ROOT/scripts/batch-fix.log"

# 建立備份目錄
mkdir -p "$BACKUP_DIR"

echo "🚀 開始批次錯誤格式修復" | tee "$LOG_FILE"
echo "📁 備份目錄: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "⏰ 開始時間: $(date)" | tee -a "$LOG_FILE"

# 統計修復前的狀態
echo -e "\n📊 修復前統計:" | tee -a "$LOG_FILE"
BEFORE_THROW=$(find "$PROJECT_ROOT" -name "*.js" -not -path "*/node_modules/*" -not -path "*/.backup/*" | xargs grep -c "throw new Error(" 2>/dev/null | wc -l)
BEFORE_TOTHROW=$(find "$PROJECT_ROOT" -name "*.test.js" | xargs grep -c "\.toThrow(" 2>/dev/null | wc -l)
echo "- throw new Error 模式: $BEFORE_THROW 個檔案" | tee -a "$LOG_FILE"
echo "- .toThrow 模式: $BEFORE_TOTHROW 個檔案" | tee -a "$LOG_FILE"

# 函數：修復 throw new Error 模式
fix_throw_errors() {
    local file="$1"
    local temp_file=$(mktemp)
    
    # 備份原始檔案
    cp "$file" "$BACKUP_DIR/$(basename "$file").backup"
    
    # 修復模式 1: throw new Error('message') -> throw StandardError.create('message')
    sed -E "s/throw new Error\('([^']+)'\)/throw StandardError.create('\1', { code: 'IMPLEMENTATION_ERROR' })/g" "$file" > "$temp_file"
    
    # 修復模式 2: throw new Error("message") -> throw StandardError.create("message")  
    sed -i.tmp -E 's/throw new Error\("([^"]+)"\)/throw StandardError.create("\1", { code: "IMPLEMENTATION_ERROR" })/g' "$temp_file"
    
    # 修復模式 3: throw new Error(`message`) -> throw StandardError.create(`message`)
    sed -i.tmp -E 's/throw new Error\(`([^`]+)`\)/throw StandardError.create(`\1`, { code: `IMPLEMENTATION_ERROR` })/g' "$temp_file"
    
    # 移動修復後的檔案
    mv "$temp_file" "$file"
    rm -f "$temp_file.tmp"
    
    # 檢查是否需要新增 StandardError 匯入
    if ! grep -q "StandardError" "$file" && grep -q "StandardError.create" "$file"; then
        # 在檔案開頭新增 require
        temp_file=$(mktemp)
        echo "const StandardError = require('src/core/errors/StandardError')" > "$temp_file"
        echo "" >> "$temp_file"
        cat "$file" >> "$temp_file"
        mv "$temp_file" "$file"
        echo "  ✅ 新增 StandardError 匯入: $file" | tee -a "$LOG_FILE"
    fi
}

# 函數：修復測試檔案中的 .toThrow 模式
fix_test_tothrow() {
    local file="$1"
    local temp_file=$(mktemp)
    
    # 備份原始檔案
    cp "$file" "$BACKUP_DIR/$(basename "$file").backup"
    
    # 修復 .toThrow('message') -> .toMatchObject(expect.objectContaining({ message: 'message' }))
    sed -E "s/\.toThrow\('([^']+)'\)/.toMatchObject(expect.objectContaining({ message: '\1' }))/g" "$file" > "$temp_file"
    
    # 修復 .toThrow("message") -> .toMatchObject(expect.objectContaining({ message: "message" }))
    sed -i.tmp -E 's/\.toThrow\("([^"]+)"\)/.toMatchObject(expect.objectContaining({ message: "\1" }))/g' "$temp_file"
    
    mv "$temp_file" "$file"
    rm -f "$temp_file.tmp"
}

# 處理 throw new Error 模式
echo -e "\n🔧 修復 throw new Error 模式..." | tee -a "$LOG_FILE"
find "$PROJECT_ROOT/src" -name "*.js" | while read -r file; do
    if grep -q "throw new Error(" "$file"; then
        echo "  🔧 修復: $file" | tee -a "$LOG_FILE"
        fix_throw_errors "$file"
    fi
done

# 處理測試檔案中的 .toThrow 模式
echo -e "\n🧪 修復測試檔案 .toThrow 模式..." | tee -a "$LOG_FILE"
find "$PROJECT_ROOT/tests" -name "*.test.js" | while read -r file; do
    if grep -q "\.toThrow(" "$file"; then
        echo "  🧪 修復: $file" | tee -a "$LOG_FILE"
        fix_test_tothrow "$file"
    fi
done

# 修復後統計
echo -e "\n📊 修復後統計:" | tee -a "$LOG_FILE"
AFTER_THROW=$(find "$PROJECT_ROOT" -name "*.js" -not -path "*/node_modules/*" -not -path "*/.backup/*" | xargs grep -c "throw new Error(" 2>/dev/null | wc -l)
AFTER_TOTHROW=$(find "$PROJECT_ROOT" -name "*.test.js" | xargs grep -c "\.toThrow(" 2>/dev/null | wc -l)
echo "- throw new Error 模式: $AFTER_THROW 個檔案 (減少 $((BEFORE_THROW - AFTER_THROW)))" | tee -a "$LOG_FILE"
echo "- .toThrow 模式: $AFTER_TOTHROW 個檔案 (減少 $((BEFORE_TOTHROW - AFTER_TOTHROW)))" | tee -a "$LOG_FILE"

echo -e "\n🎯 批次修復完成!" | tee -a "$LOG_FILE"
echo "📁 備份位置: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "📄 日誌檔案: $LOG_FILE" | tee -a "$LOG_FILE"
echo "⏰ 完成時間: $(date)" | tee -a "$LOG_FILE"

# 建議下一步
echo -e "\n🔍 建議執行以下檢查:" | tee -a "$LOG_FILE"
echo "1. npm test  # 執行測試驗證修復結果" | tee -a "$LOG_FILE"
echo "2. npm run lint  # 檢查程式碼格式" | tee -a "$LOG_FILE"
echo "3. git diff  # 檢視修復的變更內容" | tee -a "$LOG_FILE"
echo "4. 如果出現問題，可以從 $BACKUP_DIR 復原檔案" | tee -a "$LOG_FILE"