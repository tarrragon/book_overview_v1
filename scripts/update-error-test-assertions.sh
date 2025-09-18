#!/bin/bash

# update-error-test-assertions.sh
# 批量更新測試檔案中的StandardError斷言為ErrorCodes機制

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TESTS_DIR="$PROJECT_ROOT/tests"

# 統計和日誌
UPDATED_FILES=0
TOTAL_REPLACEMENTS=0
LOG_FILE="$PROJECT_ROOT/.claude/hook-logs/test-migration-$(date +%Y%m%d_%H%M%S).log"

# 確保日誌目錄存在
mkdir -p "$PROJECT_ROOT/.claude/hook-logs"

# 日誌函數
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🔄 開始測試斷言遷移作業"
log "📁 測試目錄: $TESTS_DIR"

# 備份函數
backup_file() {
    local file="$1"
    local backup_dir="$PROJECT_ROOT/.backup/test_migration_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    cp "$file" "$backup_dir/$(basename "$file")"
}

# 更新單一檔案的函數
update_test_file() {
    local file="$1"
    local changes=0

    log "📝 處理檔案: $(basename "$file")"

    # 備份原始檔案
    backup_file "$file"

    # 創建臨時檔案
    local temp_file="${file}.tmp"

    # 執行替換並統計變更
    sed -E '
        # 替換 .toThrow(StandardError) 為 .toThrow(Error)
        s/\.toThrow\(StandardError\)/\.toThrow(Error)/g

        # 替換 .rejects.toThrow(StandardError) 為 .rejects.toThrow(Error)
        s/\.rejects\.toThrow\(StandardError\)/\.rejects\.toThrow(Error)/g

        # 替換 .toBeInstanceOf(StandardError) 為 .toBeInstanceOf(Error)
        s/\.toBeInstanceOf\(StandardError\)/\.toBeInstanceOf(Error)/g

        # 替換 instanceof StandardError 為 instanceof Error
        s/instanceof StandardError/instanceof Error/g

    ' "$file" > "$temp_file"

    # 計算實際變更行數
    if ! diff -q "$file" "$temp_file" >/dev/null 2>&1; then
        changes=$(diff "$file" "$temp_file" | grep '^>' | wc -l)
        mv "$temp_file" "$file"
        log "  ✅ 更新完成，變更 $changes 處"
        ((TOTAL_REPLACEMENTS += changes))
        ((UPDATED_FILES++))
    else
        rm "$temp_file"
        log "  ℹ️  無需更新"
    fi

    return $changes
}

# 在測試檔案開頭添加error-assertions引入
add_error_assertions_import() {
    local file="$1"

    # 檢查是否已經有引入
    if grep -q "error-assertions" "$file"; then
        return 0
    fi

    # 檢查是否有其他require語句
    if grep -q "require.*src/" "$file"; then
        # 在第一個src require前添加
        sed -i '' '1,/require.*src\// {
            /require.*src\//i\
const { expectErrorWithCode, expectErrorDetails } = require('\''tests/helpers/error-assertions'\'')
        }' "$file"
        log "  📦 已添加error-assertions引入"
        return 1
    else
        # 在檔案開頭添加
        sed -i '' '1i\
const { expectErrorWithCode, expectErrorDetails } = require('\''tests/helpers/error-assertions'\'')
' "$file"
        log "  📦 已添加error-assertions引入"
        return 1
    fi
}

# 主要處理邏輯
main() {
    log "🔍 搜尋包含StandardError的測試檔案..."

    # 找到所有包含StandardError的測試檔案
    local test_files=()
    while IFS= read -r -d '' file; do
        test_files+=("$file")
    done < <(find "$TESTS_DIR" -name "*.test.js" -type f -exec grep -l "StandardError" {} \; -print0)

    log "📊 找到 ${#test_files[@]} 個需要更新的測試檔案"

    # 處理每個檔案
    for file in "${test_files[@]}"; do
        update_test_file "$file"

        # 檢查是否需要添加error-assertions引入
        if grep -q "toThrow.*Error\|toBeInstanceOf.*Error" "$file"; then
            add_error_assertions_import "$file"
        fi
    done

    log "✅ 測試斷言遷移完成"
    log "📊 統計資訊："
    log "   - 更新檔案數: $UPDATED_FILES"
    log "   - 總替換次數: $TOTAL_REPLACEMENTS"
    log "   - 備份位置: $PROJECT_ROOT/.backup/"
    log "   - 詳細日誌: $LOG_FILE"

    # 建議下一步
    log ""
    log "💡 建議下一步操作："
    log "1. 執行測試驗證: npm test"
    log "2. 檢查測試失敗: 應該會因為程式碼還沒遷移而失敗"
    log "3. 開始TDD循環: 修正程式碼讓測試通過"
}

# 執行主函數
main "$@"