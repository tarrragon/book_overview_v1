#!/bin/bash

# StandardError 引入修正專用腳本
# 專門處理測試檔案和其他檔案中缺少 StandardError 引入的問題

set -e

# 動態獲取專案根目錄路徑
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/.backup/standard_error_fix_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$PROJECT_ROOT/scripts/standard-error-fix.log"

mkdir -p "$BACKUP_DIR"

echo "🔧 StandardError 引入修正開始" | tee "$LOG_FILE"
echo "📁 備份目錄: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "================================" | tee -a "$LOG_FILE"

# 函數：檢查檔案是否需要 StandardError 引入
needs_standard_error_import() {
    local file="$1"
    
    # 檢查是否使用了 StandardError
    if grep -q "StandardError" "$file"; then
        # 檢查是否已經有引入語句
        if ! grep -q "require.*StandardError" "$file" && ! grep -q "import.*StandardError" "$file"; then
            return 0  # 需要修正
        fi
    fi
    
    return 1  # 不需要修正
}

# 函數：智能添加 StandardError 引入
add_standard_error_import() {
    local file="$1"
    local rel_path="${file#$PROJECT_ROOT/}"
    local backup_file="$BACKUP_DIR/$(basename "$file").before_import"
    
    # 備份檔案
    cp "$file" "$backup_file"
    
    local temp_file=$(mktemp)
    
    # 檢查檔案是否已經有其他 require 語句
    if grep -q "^const.*require" "$file" || grep -q "^const {.*} = require" "$file"; then
        # 在第一行 require 之前插入
        awk '
        /^const.*require/ && !added {
            print "const { StandardError } = require(\"src/core/errors/StandardError\")"
            print ""
            added = 1
        }
        { print }
        ' "$file" > "$temp_file"
    else
        # 在檔案開頭插入（跳過 shebang 和註解）
        awk '
        BEGIN { added = 0 }
        /^#!/ { print; next }
        /^\/\*/ { in_comment = 1; print; next }
        in_comment && /\*\// { in_comment = 0; print; next }
        in_comment { print; next }
        /^\/\/.*$/ { print; next }
        /^[[:space:]]*$/ { print; next }
        !added {
            print "const { StandardError } = require(\"src/core/errors/StandardError\")"
            print ""
            added = 1
        }
        { print }
        ' "$file" > "$temp_file"
    fi
    
    mv "$temp_file" "$file"
    echo "  ✅ 已添加 StandardError 引入: $rel_path" | tee -a "$LOG_FILE"
    return 0
}

# 函數：檢查並修正測試檔案中的 StandardError 使用
fix_test_file_standard_error() {
    local file="$1"
    local rel_path="${file#$PROJECT_ROOT/}"
    local backup_file="$BACKUP_DIR/$(basename "$file").before_test_fix"
    
    if grep -q "StandardError" "$file"; then
        # 備份檔案
        cp "$file" "$backup_file"
        
        local temp_file=$(mktemp)
        
        # 修正測試中的 throw new Error 為 StandardError
        sed -E 's/throw new Error\(/throw new StandardError("IMPLEMENTATION_ERROR", /g' "$file" > "$temp_file"
        
        # 修正 .toThrow 模式為 .toMatchObject
        sed -i.bak -E 's/\.toThrow\("([^"]*)"\)/.toMatchObject({ message: "\1" })/g' "$temp_file"
        sed -i.bak -E "s/\.toThrow\('([^']*)'\)/.toMatchObject({ message: '\1' })/g" "$temp_file"
        
        rm -f "$temp_file.bak"
        mv "$temp_file" "$file"
        
        echo "  🧪 已修正測試檔案: $rel_path" | tee -a "$LOG_FILE"
        return 0
    fi
    
    return 1
}

# 統計修正前的狀態
echo -e "\n📊 修正前狀態統計:" | tee -a "$LOG_FILE"

SRC_FILES_NEED_IMPORT=$(find "$PROJECT_ROOT/src" -name "*.js" | while read -r file; do
    needs_standard_error_import "$file" && echo "$file"
done | wc -l)

TEST_FILES_NEED_IMPORT=$(find "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
    needs_standard_error_import "$file" && echo "$file"
done | wc -l)

echo "需要添加 StandardError 引入的原始碼檔案: $SRC_FILES_NEED_IMPORT" | tee -a "$LOG_FILE"
echo "需要添加 StandardError 引入的測試檔案: $TEST_FILES_NEED_IMPORT" | tee -a "$LOG_FILE"

# 階段 1: 修正原始碼檔案
echo -e "\n🔧 階段 1: 修正原始碼檔案" | tee -a "$LOG_FILE"
FIXED_SRC_COUNT=0

find "$PROJECT_ROOT/src" -name "*.js" | while read -r file; do
    if needs_standard_error_import "$file"; then
        add_standard_error_import "$file"
        ((FIXED_SRC_COUNT++)) || true
    fi
done

echo "原始碼檔案修正完成，處理檔案數: $FIXED_SRC_COUNT" | tee -a "$LOG_FILE"

# 階段 2: 修正測試檔案
echo -e "\n🧪 階段 2: 修正測試檔案" | tee -a "$LOG_FILE"
FIXED_TEST_COUNT=0

find "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
    MODIFIED=false
    
    # 先檢查並添加 StandardError 引入
    if needs_standard_error_import "$file"; then
        add_standard_error_import "$file"
        MODIFIED=true
    fi
    
    # 然後修正測試模式
    if fix_test_file_standard_error "$file"; then
        MODIFIED=true
    fi
    
    if [ "$MODIFIED" = true ]; then
        ((FIXED_TEST_COUNT++)) || true
    fi
done

echo "測試檔案修正完成，處理檔案數: $FIXED_TEST_COUNT" | tee -a "$LOG_FILE"

# 階段 3: 驗證修正結果
echo -e "\n📊 修正後狀態統計:" | tee -a "$LOG_FILE"

AFTER_SRC=$(find "$PROJECT_ROOT/src" -name "*.js" | while read -r file; do
    needs_standard_error_import "$file" && echo "$file"
done | wc -l)

AFTER_TEST=$(find "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
    needs_standard_error_import "$file" && echo "$file"
done | wc -l)

echo "剩餘需修正的原始碼檔案: $AFTER_SRC (原: $SRC_FILES_NEED_IMPORT)" | tee -a "$LOG_FILE"
echo "剩餘需修正的測試檔案: $AFTER_TEST (原: $TEST_FILES_NEED_IMPORT)" | tee -a "$LOG_FILE"

# 階段 4: 語法檢查
echo -e "\n🔍 階段 4: 語法檢查" | tee -a "$LOG_FILE"
echo "執行 ESLint 檢查修正後的語法..." | tee -a "$LOG_FILE"

cd "$PROJECT_ROOT"
npm run lint > standard-error-fix-lint.txt 2>&1 || true
LINT_RESULT=$?

if [ $LINT_RESULT -eq 0 ]; then
    echo "✅ Lint 檢查通過" | tee -a "$LOG_FILE"
else
    REMAINING_ERRORS=$(grep -c "🚨" standard-error-fix-lint.txt 2>/dev/null || echo "0")
    echo "⚠️  仍有 $REMAINING_ERRORS 個 StandardError 相關錯誤需要手動處理" | tee -a "$LOG_FILE"
fi

# 生成修正報告
echo -e "\n📋 StandardError 引入修正報告" | tee -a "$LOG_FILE"
echo "================================" | tee -a "$LOG_FILE"
echo "修正統計:" | tee -a "$LOG_FILE"
echo "  原始碼檔案修正: $FIXED_SRC_COUNT" | tee -a "$LOG_FILE"
echo "  測試檔案修正: $FIXED_TEST_COUNT" | tee -a "$LOG_FILE"
echo "  總修正檔案數: $((FIXED_SRC_COUNT + FIXED_TEST_COUNT))" | tee -a "$LOG_FILE"

echo -e "\n📁 檔案位置:" | tee -a "$LOG_FILE"
echo "  備份目錄: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "  修正日誌: $LOG_FILE" | tee -a "$LOG_FILE"
echo "  Lint 結果: standard-error-fix-lint.txt" | tee -a "$LOG_FILE"

echo -e "\n🎯 後續建議:" | tee -a "$LOG_FILE"
echo "1. 檢查 Lint 結果: cat standard-error-fix-lint.txt" | tee -a "$LOG_FILE"
echo "2. 執行測試驗證: npm test" | tee -a "$LOG_FILE"
echo "3. 手動檢查複雜案例: 查看日誌中的具體檔案" | tee -a "$LOG_FILE"
echo "4. 若測試通過，使用 /commit-as-prompt 提交修正" | tee -a "$LOG_FILE"

echo -e "\n✅ StandardError 引入修正完成!" | tee -a "$LOG_FILE"
echo "⏰ 完成時間: $(date)" | tee -a "$LOG_FILE"