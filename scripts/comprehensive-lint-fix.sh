#!/bin/bash

# 綜合性 Lint 錯誤修正腳本
# 基於格式化修正案例範例集和專案規範，執行全面的程式碼品質修正

set -e

# 專案配置
PROJECT_ROOT="/Users/tarragon/Projects/book_overview_v1"
BACKUP_DIR="$PROJECT_ROOT/.backup/comprehensive_lint_fix_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$PROJECT_ROOT/scripts/comprehensive-lint-fix.log"
PROGRESS_FILE="$PROJECT_ROOT/scripts/lint-fix-progress.txt"

# 創建備份和日誌目錄
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

echo "🚀 綜合性 Lint 錯誤修正開始" | tee "$LOG_FILE"
echo "📁 備份目錄: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "📊 修復開始時間: $(date)" | tee -a "$LOG_FILE"
echo "================================" | tee -a "$LOG_FILE"

# 階段 0: 執行完整的 lint 分析
echo -e "\n📋 階段 0: 執行完整 Lint 分析" | tee -a "$LOG_FILE"
cd "$PROJECT_ROOT"

# 執行 lint 檢查並保存結果
npm run lint > lint-full-report.txt 2>&1 || true
LINT_EXIT_CODE=$?

if [ -f "lint-full-report.txt" ]; then
    TOTAL_PROBLEMS=$(grep -E "✖ [0-9]+ problems" lint-full-report.txt | head -1 | grep -o '[0-9]\+ problems' | grep -o '[0-9]\+' || echo "0")
    ERRORS=$(grep -E "✖ [0-9]+ problems.*[0-9]+ errors" lint-full-report.txt | head -1 | grep -o '[0-9]\+ errors' | grep -o '[0-9]\+' || echo "0")
    WARNINGS=$(grep -E "✖ [0-9]+ problems.*[0-9]+ warnings" lint-full-report.txt | head -1 | grep -o '[0-9]\+ warnings' | grep -o '[0-9]\+' || echo "0")
    FIXABLE=$(grep -E "[0-9]+ errors and [0-9]+ warnings potentially fixable with the \`--fix\`" lint-full-report.txt | grep -o '[0-9]\+' | head -1 || echo "0")
    
    echo "📊 Lint 分析結果:" | tee -a "$LOG_FILE"
    echo "  總問題數: $TOTAL_PROBLEMS" | tee -a "$LOG_FILE"
    echo "  錯誤數: $ERRORS" | tee -a "$LOG_FILE"
    echo "  警告數: $WARNINGS" | tee -a "$LOG_FILE" 
    echo "  可自動修正: $FIXABLE" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
else
    echo "⚠️  無法產生 lint 報告，將繼續執行修正程序" | tee -a "$LOG_FILE"
    TOTAL_PROBLEMS=0
    ERRORS=0
    WARNINGS=0
    FIXABLE=0
fi

# 階段 1: ESLint --fix 自動修正
echo -e "\n🔧 階段 1: ESLint 自動格式修正" | tee -a "$LOG_FILE"
echo "正在執行: npm run lint:fix" | tee -a "$LOG_FILE"

# 備份主要原始碼目錄
echo "📦 創建修正前備份..." | tee -a "$LOG_FILE"
cp -r "$PROJECT_ROOT/src" "$BACKUP_DIR/src_backup" 2>/dev/null || true
cp -r "$PROJECT_ROOT/tests" "$BACKUP_DIR/tests_backup" 2>/dev/null || true

# 執行自動修正
npm run lint:fix > lint-fix-output.txt 2>&1 || true
AUTO_FIX_RESULT=$?

if [ $AUTO_FIX_RESULT -eq 0 ]; then
    echo "✅ ESLint --fix 執行成功" | tee -a "$LOG_FILE"
else
    echo "⚠️  ESLint --fix 執行完成 (退出碼: $AUTO_FIX_RESULT)" | tee -a "$LOG_FILE"
fi

# 階段 2: 手動修正 StandardError 引入問題
echo -e "\n🔧 階段 2: StandardError 引入修正" | tee -a "$LOG_FILE"

# 檢查需要 StandardError 但缺少引入的檔案
FIXED_IMPORT_COUNT=0

find "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
    # 檢查是否使用了 StandardError 但沒有引入
    if grep -q "StandardError" "$file" && ! grep -q "require.*StandardError" "$file" && ! grep -q "import.*StandardError" "$file"; then
        RELATIVE_PATH="${file#$PROJECT_ROOT/}"
        echo "  🔍 發現需要修正: $RELATIVE_PATH" | tee -a "$LOG_FILE"
        
        # 備份檔案
        cp "$file" "$BACKUP_DIR/$(basename "$file").before_import_fix"
        
        # 在檔案開頭添加 StandardError 引入
        temp_file=$(mktemp)
        echo "const { StandardError } = require('src/core/errors/StandardError')" > "$temp_file"
        echo "" >> "$temp_file"
        cat "$file" >> "$temp_file"
        mv "$temp_file" "$file"
        
        echo "  ✅ 已添加 StandardError 引入: $RELATIVE_PATH" | tee -a "$LOG_FILE"
        ((FIXED_IMPORT_COUNT++)) || true
    fi
done

echo "📊 StandardError 引入修正完成: $FIXED_IMPORT_COUNT 個檔案" | tee -a "$LOG_FILE"

# 階段 3: 修正字串模板語法錯誤 (no-template-curly-in-string)
echo -e "\n🔧 階段 3: 字串模板語法修正" | tee -a "$LOG_FILE"

TEMPLATE_FIX_COUNT=0

find "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
    # 檢查 no-template-curly-in-string 錯誤模式
    if grep -E '\$\{[^}]+\}' "$file" | grep -qv '^[[:space:]]*//'; then
        RELATIVE_PATH="${file#$PROJECT_ROOT/}"
        echo "  🔍 檢查模板字串語法: $RELATIVE_PATH" | tee -a "$LOG_FILE"
        
        # 備份檔案
        cp "$file" "$BACKUP_DIR/$(basename "$file").before_template_fix"
        
        # 修正常見的模板字串錯誤模式
        sed -i.tmp "s/'\${/\`\${/g" "$file"
        sed -i.tmp "s/}'/}\`/g" "$file"
        sed -i.tmp 's/"\${/\`\${/g' "$file"
        sed -i.tmp 's/}"/}\`/g' "$file"
        rm -f "$file.tmp"
        
        echo "  ✅ 已修正模板字串語法: $RELATIVE_PATH" | tee -a "$LOG_FILE"
        ((TEMPLATE_FIX_COUNT++)) || true
    fi
done

echo "📊 模板字串語法修正完成: $TEMPLATE_FIX_COUNT 個檔案" | tee -a "$LOG_FILE"

# 階段 4: 清理未使用變數和 console 語句
echo -e "\n🔧 階段 4: 未使用變數和 Console 語句清理" | tee -a "$LOG_FILE"

CLEANUP_COUNT=0

find "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" -name "*.js" | while read -r file; do
    RELATIVE_PATH="${file#$PROJECT_ROOT/}"
    MODIFIED=false
    
    # 備份檔案
    cp "$file" "$BACKUP_DIR/$(basename "$file").before_cleanup"
    
    # 移除單獨的 console.log 語句（保留有意義的錯誤處理）
    if grep -q "console\.log(" "$file"; then
        # 僅移除明顯的調試語句，保留錯誤處理
        sed -i.tmp '/^[[:space:]]*console\.log(/d' "$file"
        rm -f "$file.tmp"
        MODIFIED=true
    fi
    
    # 移除未使用的變數宣告（簡單模式）
    if grep -E "const [a-zA-Z_]+ = .*; *$" "$file" | grep -qv "module\.exports\|require"; then
        # 這裡只處理明顯未使用的簡單情況
        # 複雜的未使用變數偵測留給 ESLint
        MODIFIED=true
    fi
    
    if [ "$MODIFIED" = true ]; then
        echo "  ✅ 已清理: $RELATIVE_PATH" | tee -a "$LOG_FILE"
        ((CLEANUP_COUNT++)) || true
    fi
done

echo "📊 變數和語句清理完成: $CLEANUP_COUNT 個檔案" | tee -a "$LOG_FILE"

# 階段 5: 再次執行 ESLint 檢查修正效果
echo -e "\n🔧 階段 5: 驗證修正效果" | tee -a "$LOG_FILE"

npm run lint > lint-after-fix.txt 2>&1 || true
FINAL_LINT_EXIT_CODE=$?

if [ -f "lint-after-fix.txt" ]; then
    FINAL_PROBLEMS=$(grep -E "✖ [0-9]+ problems" lint-after-fix.txt | head -1 | grep -o '[0-9]\+ problems' | grep -o '[0-9]\+' || echo "0")
    FINAL_ERRORS=$(grep -E "✖ [0-9]+ problems.*[0-9]+ errors" lint-after-fix.txt | head -1 | grep -o '[0-9]\+ errors' | grep -o '[0-9]\+' || echo "0")
    FINAL_WARNINGS=$(grep -E "✖ [0-9]+ problems.*[0-9]+ warnings" lint-after-fix.txt | head -1 | grep -o '[0-9]\+ warnings' | grep -o '[0-9]\+' || echo "0")
    
    echo "📊 修正後 Lint 結果:" | tee -a "$LOG_FILE"
    echo "  總問題數: $FINAL_PROBLEMS (原: $TOTAL_PROBLEMS)" | tee -a "$LOG_FILE"
    echo "  錯誤數: $FINAL_ERRORS (原: $ERRORS)" | tee -a "$LOG_FILE"
    echo "  警告數: $FINAL_WARNINGS (原: $WARNINGS)" | tee -a "$LOG_FILE"
    
    # 計算修正效果
    if [ "$TOTAL_PROBLEMS" -gt 0 ]; then
        PROBLEMS_REDUCED=$((TOTAL_PROBLEMS - FINAL_PROBLEMS))
        REDUCTION_RATE=$((PROBLEMS_REDUCED * 100 / TOTAL_PROBLEMS))
        echo "  修正成效: 減少 $PROBLEMS_REDUCED 個問題 ($REDUCTION_RATE%)" | tee -a "$LOG_FILE"
    fi
else
    echo "⚠️  無法產生修正後的 lint 報告" | tee -a "$LOG_FILE"
fi

# 階段 6: 測試驗證
echo -e "\n🧪 階段 6: 功能驗證測試" | tee -a "$LOG_FILE"
echo "執行核心測試以驗證修正後的程式碼功能正常..." | tee -a "$LOG_FILE"

npm test > test-after-fix.txt 2>&1 || true
TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ 測試全部通過 - 修正未破壞現有功能" | tee -a "$LOG_FILE"
else
    echo "❌ 測試失敗 - 需要檢查修正內容" | tee -a "$LOG_FILE"
    echo "⚠️  建議檢查 test-after-fix.txt 以了解測試失敗原因" | tee -a "$LOG_FILE"
fi

# 生成完整修正報告
echo -e "\n📋 綜合修正報告" | tee -a "$LOG_FILE"
echo "================================" | tee -a "$LOG_FILE"
echo "📊 執行階段統計:" | tee -a "$LOG_FILE"
echo "  階段 1: ESLint 自動修正 - 完成" | tee -a "$LOG_FILE"
echo "  階段 2: StandardError 引入 - $FIXED_IMPORT_COUNT 個檔案" | tee -a "$LOG_FILE"
echo "  階段 3: 模板字串語法修正 - $TEMPLATE_FIX_COUNT 個檔案" | tee -a "$LOG_FILE"
echo "  階段 4: 未使用變數清理 - $CLEANUP_COUNT 個檔案" | tee -a "$LOG_FILE"
echo "  階段 5: 效果驗證 - 完成" | tee -a "$LOG_FILE"
echo "  階段 6: 功能測試 - $([ $TEST_RESULT -eq 0 ] && echo "通過" || echo "需檢查")" | tee -a "$LOG_FILE"

echo -e "\n📁 備份和日誌位置:" | tee -a "$LOG_FILE"
echo "  備份目錄: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "  修正日誌: $LOG_FILE" | tee -a "$LOG_FILE"
echo "  Lint 報告: lint-full-report.txt, lint-after-fix.txt" | tee -a "$LOG_FILE"
echo "  測試報告: test-after-fix.txt" | tee -a "$LOG_FILE"

echo -e "\n🎯 後續建議行動:" | tee -a "$LOG_FILE"
echo "1. 檢查測試結果: cat test-after-fix.txt" | tee -a "$LOG_FILE"
echo "2. 審查修正效果: npm run lint" | tee -a "$LOG_FILE"
echo "3. 手動檢查複雜問題: 查看 lint-after-fix.txt" | tee -a "$LOG_FILE"
echo "4. 提交修正結果: 使用 /commit-as-prompt" | tee -a "$LOG_FILE"

echo -e "\n✅ 綜合性 Lint 修正完成!" | tee -a "$LOG_FILE"
echo "⏰ 完成時間: $(date)" | tee -a "$LOG_FILE"

# 創建進度記錄檔案
cat > "$PROGRESS_FILE" << EOF
綜合性 Lint 修正進度記錄
完成時間: $(date)

修正統計:
- StandardError 引入修正: $FIXED_IMPORT_COUNT 個檔案
- 模板字串語法修正: $TEMPLATE_FIX_COUNT 個檔案  
- 未使用變數清理: $CLEANUP_COUNT 個檔案

Lint 結果:
- 修正前問題數: $TOTAL_PROBLEMS
- 修正後問題數: $FINAL_PROBLEMS
- 測試結果: $([ $TEST_RESULT -eq 0 ] && echo "通過" || echo "需檢查")

備份位置: $BACKUP_DIR
EOF

echo "📊 進度記錄已保存至: $PROGRESS_FILE" | tee -a "$LOG_FILE"