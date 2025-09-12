#!/bin/bash

# 字串模板語法錯誤修正腳本
# 專門處理 no-template-curly-in-string ESLint 錯誤

set -e

# 動態獲取專案根目錄路徑
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/.backup/template_string_fix_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$PROJECT_ROOT/scripts/template-string-fix.log"

mkdir -p "$BACKUP_DIR"

echo "🔧 字串模板語法錯誤修正開始" | tee "$LOG_FILE"
echo "📁 備份目錄: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "================================" | tee -a "$LOG_FILE"

# 函數：檢查檔案是否有模板字串語法錯誤
has_template_string_error() {
    local file="$1"
    
    # 檢查常見的錯誤模式：在單引號或雙引號中使用 ${variable}
    if grep -E '["'"'"'][^"'"'"']*\$\{[^}]*\}[^"'"'"']*["'"'"']' "$file" >/dev/null 2>&1; then
        return 0  # 有錯誤
    fi
    
    return 1  # 沒有錯誤
}

# 函數：修正模板字串語法錯誤
fix_template_string_syntax() {
    local file="$1"
    local rel_path="${file#$PROJECT_ROOT/}"
    local backup_file="$BACKUP_DIR/$(basename "$file").before_template_fix"
    local temp_file=$(mktemp)
    
    # 備份檔案
    cp "$file" "$backup_file"
    
    echo "  🔍 分析模板字串錯誤: $rel_path" | tee -a "$LOG_FILE"
    
    # 使用 awk 來精確處理模板字串轉換
    awk '
    {
        line = $0
        # 處理單引號中的模板變數：'"'"'text${var}text'"'"' -> `text${var}text`
        while (match(line, /'"'"'[^'"'"']*\$\{[^}]*\}[^'"'"']*'"'"'/)) {
            before = substr(line, 1, RSTART-1)
            matched = substr(line, RSTART, RLENGTH)
            after = substr(line, RSTART+RLENGTH)
            
            # 將單引號替換為反引號
            gsub(/'"'"'/, "`", matched)
            line = before matched after
            
            print "    🔄 單引號 -> 反引號: " matched > "/dev/stderr"
        }
        
        # 處理雙引號中的模板變數："text${var}text" -> `text${var}text`
        while (match(line, /"[^"]*\$\{[^}]*\}[^"]*"/)) {
            before = substr(line, 1, RSTART-1)
            matched = substr(line, RSTART, RLENGTH)
            after = substr(line, RSTART+RLENGTH)
            
            # 將雙引號替換為反引號
            gsub(/"/, "`", matched)
            line = before matched after
            
            print "    🔄 雙引號 -> 反引號: " matched > "/dev/stderr"
        }
        
        print line
    }
    ' "$file" > "$temp_file" 2>> "$LOG_FILE"
    
    # 檢查是否有實際變更
    if ! cmp -s "$file" "$temp_file"; then
        mv "$temp_file" "$file"
        echo "  ✅ 已修正模板字串語法: $rel_path" | tee -a "$LOG_FILE"
        return 0
    else
        rm -f "$temp_file"
        echo "  ℹ️  無需修正: $rel_path" | tee -a "$LOG_FILE"
        return 1
    fi
}

# 函數：檢查複雜的模板字串情況
analyze_complex_cases() {
    local file="$1"
    local rel_path="${file#$PROJECT_ROOT/}"
    
    # 檢查可能需要手動處理的複雜情況
    local complex_patterns=(
        '\$\{[^}]*\$\{[^}]*\}'  # 巢狀模板變數
        '\\n.*\$\{'              # 跨行模板字串
        '\$\{[^}]*["'"'"'][^}]*\}' # 模板變數內包含引號
    )
    
    for pattern in "${complex_patterns[@]}"; do
        if grep -E "$pattern" "$file" >/dev/null 2>&1; then
            echo "  ⚠️  複雜情況需手動檢查: $rel_path - 模式: $pattern" | tee -a "$LOG_FILE"
            grep -n -E "$pattern" "$file" | head -3 >> "$LOG_FILE"
            return 0
        fi
    done
    
    return 1
}

# 統計修正前的狀態
echo -e "\n📊 修正前狀態統計:" | tee -a "$LOG_FILE"

FILES_WITH_ERRORS=$(find "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
    has_template_string_error "$file" && echo "$file"
done | wc -l)

echo "發現有模板字串語法錯誤的檔案: $FILES_WITH_ERRORS" | tee -a "$LOG_FILE"

# 顯示錯誤範例
echo -e "\n🔍 錯誤模式範例:" | tee -a "$LOG_FILE"
find "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
    if has_template_string_error "$file"; then
        rel_path="${file#$PROJECT_ROOT/}"
        echo "檔案: $rel_path" | tee -a "$LOG_FILE"
        grep -n -E '["'"'"'][^"'"'"']*\$\{[^}]*\}[^"'"'"']*["'"'"']' "$file" | head -2 | tee -a "$LOG_FILE"
        break
    fi
done

# 階段 1: 修正檔案
echo -e "\n🔧 階段 1: 批量修正模板字串語法" | tee -a "$LOG_FILE"
FIXED_COUNT=0
COMPLEX_COUNT=0

find "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
    if has_template_string_error "$file"; then
        if fix_template_string_syntax "$file"; then
            ((FIXED_COUNT++)) || true
        fi
        
        # 檢查是否有複雜情況
        if analyze_complex_cases "$file"; then
            ((COMPLEX_COUNT++)) || true
        fi
    fi
done

echo "模板字串語法修正完成，處理檔案數: $FIXED_COUNT" | tee -a "$LOG_FILE"
echo "發現複雜情況需手動處理: $COMPLEX_COUNT" | tee -a "$LOG_FILE"

# 階段 2: 驗證修正結果
echo -e "\n📊 修正後狀態統計:" | tee -a "$LOG_FILE"

AFTER_FILES_WITH_ERRORS=$(find "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
    has_template_string_error "$file" && echo "$file"
done | wc -l)

echo "剩餘有模板字串語法錯誤的檔案: $AFTER_FILES_WITH_ERRORS (原: $FILES_WITH_ERRORS)" | tee -a "$LOG_FILE"

# 階段 3: ESLint 驗證
echo -e "\n🔍 階段 3: ESLint 驗證" | tee -a "$LOG_FILE"
echo "執行 ESLint 檢查修正效果..." | tee -a "$LOG_FILE"

cd "$PROJECT_ROOT"
npm run lint 2>&1 | grep "no-template-curly-in-string" > template-string-lint.txt || true

if [ -s template-string-lint.txt ]; then
    REMAINING_ERRORS=$(wc -l < template-string-lint.txt)
    echo "⚠️  仍有 $REMAINING_ERRORS 個 no-template-curly-in-string 錯誤" | tee -a "$LOG_FILE"
    echo "詳細錯誤已保存至: template-string-lint.txt" | tee -a "$LOG_FILE"
else
    echo "✅ 所有 no-template-curly-in-string 錯誤已修正" | tee -a "$LOG_FILE"
fi

# 階段 4: 功能測試
echo -e "\n🧪 階段 4: 功能測試" | tee -a "$LOG_FILE"
echo "執行測試以確保修正沒有破壞功能..." | tee -a "$LOG_FILE"

npm test > template-fix-test.txt 2>&1 || true
TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ 所有測試通過" | tee -a "$LOG_FILE"
else
    echo "❌ 測試失敗，可能需要調整修正方式" | tee -a "$LOG_FILE"
    echo "測試結果已保存至: template-fix-test.txt" | tee -a "$LOG_FILE"
fi

# 生成修正報告
echo -e "\n📋 模板字串語法修正報告" | tee -a "$LOG_FILE"
echo "================================" | tee -a "$LOG_FILE"
echo "修正統計:" | tee -a "$LOG_FILE"
echo "  修正檔案數: $FIXED_COUNT" | tee -a "$LOG_FILE"
echo "  複雜情況: $COMPLEX_COUNT (需手動處理)" | tee -a "$LOG_FILE"
echo "  修正成效: $([ $AFTER_FILES_WITH_ERRORS -eq 0 ] && echo "完全修正" || echo "部分修正")" | tee -a "$LOG_FILE"
echo "  功能測試: $([ $TEST_RESULT -eq 0 ] && echo "通過" || echo "需檢查")" | tee -a "$LOG_FILE"

echo -e "\n📁 檔案位置:" | tee -a "$LOG_FILE"
echo "  備份目錄: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "  修正日誌: $LOG_FILE" | tee -a "$LOG_FILE"
echo "  ESLint 結果: template-string-lint.txt" | tee -a "$LOG_FILE"
echo "  測試結果: template-fix-test.txt" | tee -a "$LOG_FILE"

echo -e "\n🎯 後續建議:" | tee -a "$LOG_FILE"
echo "1. 檢查剩餘錯誤: cat template-string-lint.txt" | tee -a "$LOG_FILE"
echo "2. 檢查測試結果: cat template-fix-test.txt" | tee -a "$LOG_FILE"
echo "3. 手動處理複雜情況: 參考日誌中標記的檔案" | tee -a "$LOG_FILE"
echo "4. 驗證修正準確性: 抽查幾個修正過的檔案" | tee -a "$LOG_FILE"

echo -e "\n✅ 模板字串語法修正完成!" | tee -a "$LOG_FILE"
echo "⏰ 完成時間: $(date)" | tee -a "$LOG_FILE"