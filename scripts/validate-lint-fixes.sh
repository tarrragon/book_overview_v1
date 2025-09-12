#!/bin/bash

# Lint 修正效果驗證腳本
# 詳細驗證修正結果，提供品質保證和修正建議

set -e

PROJECT_ROOT="/Users/tarragon/Projects/book_overview_v1"
VALIDATION_LOG="$PROJECT_ROOT/scripts/lint-fix-validation.log"
REPORT_DIR="$PROJECT_ROOT/.validation-reports"

mkdir -p "$REPORT_DIR"

echo "🔍 Lint 修正效果驗證開始" | tee "$VALIDATION_LOG"
echo "📅 驗證時間: $(date)" | tee -a "$VALIDATION_LOG"
echo "📁 專案根目錄: $PROJECT_ROOT" | tee -a "$VALIDATION_LOG"
echo "================================" | tee -a "$VALIDATION_LOG"

cd "$PROJECT_ROOT"

# 函數：統計特定錯誤類型
count_error_type() {
    local error_type="$1"
    local description="$2"
    local count=0
    
    if [ -f "current_lint.txt" ]; then
        count=$(grep -c "$error_type" "current_lint.txt" 2>/dev/null || echo "0")
    fi
    
    echo "  $description: $count" | tee -a "$VALIDATION_LOG"
    return $count
}

# 函數：檢查 StandardError 引入狀況
validate_standard_error_imports() {
    echo -e "\n🔧 StandardError 引入檢查" | tee -a "$VALIDATION_LOG"
    echo "================================" | tee -a "$VALIDATION_LOG"
    
    local missing_imports=0
    local incorrect_usage=0
    
    # 檢查缺少 StandardError 引入的檔案
    find "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
        if grep -q "StandardError" "$file" && ! grep -q "require.*StandardError" "$file" && ! grep -q "import.*StandardError" "$file"; then
            rel_path="${file#$PROJECT_ROOT/}"
            echo "❌ 缺少引入: $rel_path" | tee -a "$VALIDATION_LOG"
            ((missing_imports++))
        fi
    done
    
    # 檢查錯誤的 StandardError 使用方式
    find "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
        # 檢查是否仍有 throw new Error
        if grep -q "throw new Error(" "$file"; then
            rel_path="${file#$PROJECT_ROOT/}"
            echo "⚠️  仍使用原生 Error: $rel_path" | tee -a "$VALIDATION_LOG"
            grep -n "throw new Error(" "$file" | head -2 | sed "s/^/    /" | tee -a "$VALIDATION_LOG"
            ((incorrect_usage++))
        fi
    done
    
    echo "缺少引入檔案數: $missing_imports" | tee -a "$VALIDATION_LOG"
    echo "錯誤使用檔案數: $incorrect_usage" | tee -a "$VALIDATION_LOG"
    
    return $((missing_imports + incorrect_usage))
}

# 函數：檢查模板字串修正品質
validate_template_strings() {
    echo -e "\n🔧 模板字串修正檢查" | tee -a "$VALIDATION_LOG"
    echo "================================" | tee -a "$VALIDATION_LOG"
    
    local remaining_errors=0
    local potential_issues=0
    
    # 檢查仍有問題的模板字串
    find "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
        # 檢查單雙引號中的 ${} 模式
        if grep -E '["'"'"'][^"'"'"']*\$\{[^}]*\}[^"'"'"']*["'"'"']' "$file" >/dev/null 2>&1; then
            rel_path="${file#$PROJECT_ROOT/}"
            echo "❌ 仍有模板字串錯誤: $rel_path" | tee -a "$VALIDATION_LOG"
            grep -n -E '["'"'"'][^"'"'"']*\$\{[^}]*\}[^"'"'"']*["'"'"']' "$file" | head -2 | sed "s/^/    /" | tee -a "$VALIDATION_LOG"
            ((remaining_errors++))
        fi
        
        # 檢查可能的過度修正（反引號使用不當）
        if grep -E '`[^`]*["'"'"'][^`]*`' "$file" >/dev/null 2>&1; then
            rel_path="${file#$PROJECT_ROOT/}"
            echo "⚠️  可能過度修正: $rel_path" | tee -a "$VALIDATION_LOG"
            grep -n -E '`[^`]*["'"'"'][^`]*`' "$file" | head -1 | sed "s/^/    /" | tee -a "$VALIDATION_LOG"
            ((potential_issues++))
        fi
    done
    
    echo "仍有錯誤檔案數: $remaining_errors" | tee -a "$VALIDATION_LOG"
    echo "可能過度修正: $potential_issues" | tee -a "$VALIDATION_LOG"
    
    return $((remaining_errors + potential_issues))
}

# 函數：檢查程式碼品質提升
validate_code_quality() {
    echo -e "\n🔧 程式碼品質檢查" | tee -a "$VALIDATION_LOG"
    echo "================================" | tee -a "$VALIDATION_LOG"
    
    # 檢查未使用變數
    local unused_vars=$(find "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" -name "*.js" -exec grep -l "no-unused-vars" {} \; 2>/dev/null | wc -l)
    echo "未使用變數問題檔案: $unused_vars" | tee -a "$VALIDATION_LOG"
    
    # 檢查 console.log 清理效果
    local console_logs=$(find "$PROJECT_ROOT/src" -name "*.js" -exec grep -c "console\.log" {} + 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
    echo "原始碼中剩餘 console.log: $console_logs" | tee -a "$VALIDATION_LOG"
    
    # 檢查格式化問題
    local formatting_issues=0
    if [ -f "current_lint.txt" ]; then
        formatting_issues=$(grep -c -E "(space-before-function-paren|semi|quotes|indent)" "current_lint.txt" 2>/dev/null || echo "0")
    fi
    echo "格式化問題: $formatting_issues" | tee -a "$VALIDATION_LOG"
    
    return $((unused_vars + console_logs + formatting_issues))
}

# 函數：測試完整性驗證
validate_test_integrity() {
    echo -e "\n🧪 測試完整性驗證" | tee -a "$VALIDATION_LOG"
    echo "================================" | tee -a "$VALIDATION_LOG"
    
    echo "執行完整測試套件..." | tee -a "$VALIDATION_LOG"
    npm test > "$REPORT_DIR/test_validation.txt" 2>&1 || true
    local test_result=$?
    
    if [ $test_result -eq 0 ]; then
        echo "✅ 所有測試通過" | tee -a "$VALIDATION_LOG"
        
        # 提取測試統計
        if [ -f "$REPORT_DIR/test_validation.txt" ]; then
            local test_suites=$(grep -c "PASS\|FAIL" "$REPORT_DIR/test_validation.txt" 2>/dev/null || echo "0")
            local passed_tests=$(grep -o "Tests:.*passed" "$REPORT_DIR/test_validation.txt" | grep -o '[0-9]\+ passed' | grep -o '[0-9]\+' || echo "0")
            echo "測試套件數: $test_suites" | tee -a "$VALIDATION_LOG"
            echo "通過測試數: $passed_tests" | tee -a "$VALIDATION_LOG"
        fi
    else
        echo "❌ 測試失敗" | tee -a "$VALIDATION_LOG"
        
        # 分析失敗原因
        if [ -f "$REPORT_DIR/test_validation.txt" ]; then
            echo "測試失敗分析:" | tee -a "$VALIDATION_LOG"
            grep -A5 -B5 "FAIL\|Error:" "$REPORT_DIR/test_validation.txt" | head -20 | sed "s/^/    /" | tee -a "$VALIDATION_LOG"
        fi
    fi
    
    return $test_result
}

# 主要驗證流程
echo -e "\n🔍 開始詳細驗證..." | tee -a "$VALIDATION_LOG"

# 執行 Lint 檢查
echo "執行當前 Lint 狀況檢查..." | tee -a "$VALIDATION_LOG"
npm run lint > "current_lint.txt" 2>&1 || true

# 提取基本統計
if [ -f "current_lint.txt" ]; then
    CURRENT_PROBLEMS=$(grep -E "✖ [0-9]+ problems" "current_lint.txt" | head -1 | grep -o '[0-9]\+ problems' | grep -o '[0-9]\+' || echo "0")
    CURRENT_ERRORS=$(grep -E "[0-9]+ errors" "current_lint.txt" | head -1 | grep -o '[0-9]\+ errors' | grep -o '[0-9]\+' || echo "0")
    CURRENT_WARNINGS=$(grep -E "[0-9]+ warnings" "current_lint.txt" | head -1 | grep -o '[0-9]\+ warnings' | grep -o '[0-9]\+' || echo "0")
    
    echo -e "\n📊 當前 Lint 狀況:" | tee -a "$VALIDATION_LOG"
    echo "總問題數: $CURRENT_PROBLEMS" | tee -a "$VALIDATION_LOG"
    echo "錯誤數: $CURRENT_ERRORS" | tee -a "$VALIDATION_LOG"
    echo "警告數: $CURRENT_WARNINGS" | tee -a "$VALIDATION_LOG"
    
    # 統計主要問題類型
    echo -e "\n主要問題類型統計:" | tee -a "$VALIDATION_LOG"
    count_error_type "🚨.*不允許" "StandardError 規範違規"
    count_error_type "no-template-curly-in-string" "模板字串語法錯誤"
    count_error_type "no-unused-vars" "未使用變數"
    count_error_type "no-console" "Console 語句"
    count_error_type "semi" "分號錯誤"
    count_error_type "quotes" "引號風格錯誤"
    count_error_type "indent" "縮排錯誤"
else
    echo "⚠️  無法執行 Lint 檢查" | tee -a "$VALIDATION_LOG"
    CURRENT_PROBLEMS=999
fi

# 詳細驗證各個方面
VALIDATION_SCORE=0

# StandardError 引入驗證
if validate_standard_error_imports; then
    ((VALIDATION_SCORE++))
fi

# 模板字串修正驗證
if validate_template_strings; then
    ((VALIDATION_SCORE++))
fi

# 程式碼品質驗證
if validate_code_quality; then
    ((VALIDATION_SCORE++))
fi

# 測試完整性驗證
if validate_test_integrity; then
    ((VALIDATION_SCORE+=2))  # 測試通過給雙倍分數
fi

# 生成驗證報告
echo -e "\n📋 修正效果驗證報告" | tee -a "$VALIDATION_LOG"
echo "================================" | tee -a "$VALIDATION_LOG"
echo "驗證時間: $(date)" | tee -a "$VALIDATION_LOG"
echo "驗證分數: $VALIDATION_SCORE/5" | tee -a "$VALIDATION_LOG"

# 根據分數給出評級
if [ $VALIDATION_SCORE -eq 5 ]; then
    GRADE="A+ (優秀)"
    RECOMMENDATION="修正完全成功，建議立即提交"
elif [ $VALIDATION_SCORE -ge 4 ]; then
    GRADE="A (良好)"
    RECOMMENDATION="修正基本成功，可檢查剩餘問題後提交"
elif [ $VALIDATION_SCORE -ge 3 ]; then
    GRADE="B (普通)"
    RECOMMENDATION="修正部分成功，建議處理主要問題後再提交"
elif [ $VALIDATION_SCORE -ge 2 ]; then
    GRADE="C (需改進)"
    RECOMMENDATION="修正效果有限，建議檢查修正腳本執行狀況"
else
    GRADE="D (失敗)"
    RECOMMENDATION="修正基本失敗，建議重新檢查問題並重新執行修正"
fi

echo "修正品質: $GRADE" | tee -a "$VALIDATION_LOG"
echo "建議行動: $RECOMMENDATION" | tee -a "$VALIDATION_LOG"

# 具體建議
echo -e "\n🎯 具體修正建議:" | tee -a "$VALIDATION_LOG"

if [ $CURRENT_PROBLEMS -gt 100 ]; then
    echo "1. 問題數仍然很多($CURRENT_PROBLEMS)，建議重新執行修正腳本" | tee -a "$VALIDATION_LOG"
elif [ $CURRENT_PROBLEMS -gt 50 ]; then
    echo "1. 問題數中等($CURRENT_PROBLEMS)，建議手動處理剩餘問題" | tee -a "$VALIDATION_LOG"
elif [ $CURRENT_PROBLEMS -gt 10 ]; then
    echo "1. 問題數較少($CURRENT_PROBLEMS)，可以手動逐一修正" | tee -a "$VALIDATION_LOG"
else
    echo "1. ✅ 問題數很少($CURRENT_PROBLEMS)，修正效果良好" | tee -a "$VALIDATION_LOG"
fi

if [ $CURRENT_ERRORS -gt 0 ]; then
    echo "2. 仍有 $CURRENT_ERRORS 個錯誤，建議優先處理" | tee -a "$VALIDATION_LOG"
else
    echo "2. ✅ 沒有錯誤，僅剩警告項目" | tee -a "$VALIDATION_LOG"
fi

echo "3. 詳細問題清單請查看: current_lint.txt" | tee -a "$VALIDATION_LOG"
echo "4. 測試結果請查看: $REPORT_DIR/test_validation.txt" | tee -a "$VALIDATION_LOG"

# 保存驗證結果摘要
cat > "$REPORT_DIR/validation_summary.txt" << EOF
Lint 修正效果驗證摘要
驗證時間: $(date)

當前狀況:
- 總問題數: $CURRENT_PROBLEMS
- 錯誤數: $CURRENT_ERRORS  
- 警告數: $CURRENT_WARNINGS

驗證分數: $VALIDATION_SCORE/5
修正品質: $GRADE
建議行動: $RECOMMENDATION

重要檔案:
- 驗證日誌: $VALIDATION_LOG
- Lint 報告: current_lint.txt
- 測試報告: $REPORT_DIR/test_validation.txt
EOF

echo -e "\n📁 重要檔案位置:" | tee -a "$VALIDATION_LOG"
echo "驗證日誌: $VALIDATION_LOG" | tee -a "$VALIDATION_LOG"
echo "驗證摘要: $REPORT_DIR/validation_summary.txt" | tee -a "$VALIDATION_LOG"
echo "當前 Lint: current_lint.txt" | tee -a "$VALIDATION_LOG"
echo "測試結果: $REPORT_DIR/test_validation.txt" | tee -a "$VALIDATION_LOG"

echo -e "\n✅ Lint 修正效果驗證完成!" | tee -a "$VALIDATION_LOG"
echo "⭐ 修正品質: $GRADE" | tee -a "$VALIDATION_LOG"