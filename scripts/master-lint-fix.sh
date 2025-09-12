#!/bin/bash

# 主控 Lint 修正腳本
# 按照正確順序執行所有修正腳本，提供完整的批量修正解決方案

set -e

# 動態獲取專案根目錄路徑
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MASTER_LOG="$PROJECT_ROOT/scripts/master-lint-fix.log"
PROGRESS_DIR="$PROJECT_ROOT/.master-fix-progress"

# 創建進度目錄
mkdir -p "$PROGRESS_DIR"

echo "🚀 主控 Lint 修正流程開始" | tee "$MASTER_LOG"
echo "📅 開始時間: $(date)" | tee -a "$MASTER_LOG"
echo "📁 專案根目錄: $PROJECT_ROOT" | tee -a "$MASTER_LOG"
echo "================================" | tee -a "$MASTER_LOG"

# 函數：檢查腳本是否存在並可執行
check_script() {
    local script_path="$1"
    local script_name="$2"
    
    if [ ! -f "$script_path" ]; then
        echo "❌ 腳本不存在: $script_name ($script_path)" | tee -a "$MASTER_LOG"
        return 1
    fi
    
    if [ ! -x "$script_path" ]; then
        echo "🔧 設定腳本執行權限: $script_name" | tee -a "$MASTER_LOG"
        chmod +x "$script_path"
    fi
    
    echo "✅ 腳本檢查通過: $script_name" | tee -a "$MASTER_LOG"
    return 0
}

# 函數：執行修正階段
execute_phase() {
    local phase_num="$1"
    local phase_name="$2"
    local script_path="$3"
    local progress_file="$PROGRESS_DIR/phase_${phase_num}_completed"
    
    echo -e "\n🔧 階段 $phase_num: $phase_name" | tee -a "$MASTER_LOG"
    echo "腳本: $script_path" | tee -a "$MASTER_LOG"
    echo "開始時間: $(date)" | tee -a "$MASTER_LOG"
    
    # 檢查是否已經完成過
    if [ -f "$progress_file" ]; then
        echo "ℹ️  階段 $phase_num 已完成，跳過執行" | tee -a "$MASTER_LOG"
        return 0
    fi
    
    # 執行腳本
    if bash "$script_path" 2>&1 | tee -a "$MASTER_LOG"; then
        echo "✅ 階段 $phase_num 執行成功" | tee -a "$MASTER_LOG"
        echo "$(date)" > "$progress_file"
        return 0
    else
        echo "❌ 階段 $phase_num 執行失敗" | tee -a "$MASTER_LOG"
        return 1
    fi
}

# 函數：生成初始狀態報告
generate_initial_report() {
    echo -e "\n📊 修正前狀態分析" | tee -a "$MASTER_LOG"
    echo "================================" | tee -a "$MASTER_LOG"
    
    cd "$PROJECT_ROOT"
    
    # 執行 Lint 分析
    echo "正在執行 Lint 分析..." | tee -a "$MASTER_LOG"
    npm run lint > "$PROGRESS_DIR/initial_lint_report.txt" 2>&1 || true
    
    if [ -f "$PROGRESS_DIR/initial_lint_report.txt" ]; then
        # 提取關鍵統計
        TOTAL_PROBLEMS=$(grep -E "✖ [0-9]+ problems" "$PROGRESS_DIR/initial_lint_report.txt" | head -1 | grep -o '[0-9]\+ problems' | grep -o '[0-9]\+' || echo "0")
        ERRORS=$(grep -E "[0-9]+ errors" "$PROGRESS_DIR/initial_lint_report.txt" | head -1 | grep -o '[0-9]\+ errors' | grep -o '[0-9]\+' || echo "0")
        WARNINGS=$(grep -E "[0-9]+ warnings" "$PROGRESS_DIR/initial_lint_report.txt" | head -1 | grep -o '[0-9]\+ warnings' | grep -o '[0-9]\+' || echo "0")
        FIXABLE=$(grep -E "potentially fixable with.*--fix" "$PROGRESS_DIR/initial_lint_report.txt" | grep -o '[0-9]\+' | head -1 || echo "0")
        
        echo "總問題數: $TOTAL_PROBLEMS" | tee -a "$MASTER_LOG"
        echo "錯誤數: $ERRORS" | tee -a "$MASTER_LOG"
        echo "警告數: $WARNINGS" | tee -a "$MASTER_LOG"
        echo "可自動修正: $FIXABLE" | tee -a "$MASTER_LOG"
        
        # 分析主要問題類型
        echo -e "\n主要問題類型:" | tee -a "$MASTER_LOG"
        grep -E "🚨.*不允許" "$PROGRESS_DIR/initial_lint_report.txt" | head -5 | tee -a "$MASTER_LOG" || true
        grep -E "no-template-curly-in-string" "$PROGRESS_DIR/initial_lint_report.txt" | wc -l | xargs -I {} echo "模板字串錯誤: {} 個" | tee -a "$MASTER_LOG"
        grep -E "no-unused-vars" "$PROGRESS_DIR/initial_lint_report.txt" | wc -l | xargs -I {} echo "未使用變數: {} 個" | tee -a "$MASTER_LOG"
        
        # 保存詳細統計
        cat > "$PROGRESS_DIR/initial_stats.txt" << EOF
修正前統計 - $(date)
總問題數: $TOTAL_PROBLEMS
錯誤數: $ERRORS  
警告數: $WARNINGS
可自動修正: $FIXABLE
EOF
        
    else
        echo "⚠️  無法產生初始 Lint 報告" | tee -a "$MASTER_LOG"
    fi
}

# 函數：生成最終狀態報告
generate_final_report() {
    echo -e "\n📋 修正完成狀態分析" | tee -a "$MASTER_LOG"
    echo "================================" | tee -a "$MASTER_LOG"
    
    cd "$PROJECT_ROOT"
    
    # 執行最終 Lint 檢查
    echo "正在執行最終 Lint 檢查..." | tee -a "$MASTER_LOG"
    npm run lint > "$PROGRESS_DIR/final_lint_report.txt" 2>&1 || true
    
    if [ -f "$PROGRESS_DIR/final_lint_report.txt" ]; then
        # 提取最終統計
        FINAL_PROBLEMS=$(grep -E "✖ [0-9]+ problems" "$PROGRESS_DIR/final_lint_report.txt" | head -1 | grep -o '[0-9]\+ problems' | grep -o '[0-9]\+' || echo "0")
        FINAL_ERRORS=$(grep -E "[0-9]+ errors" "$PROGRESS_DIR/final_lint_report.txt" | head -1 | grep -o '[0-9]\+ errors' | grep -o '[0-9]\+' || echo "0")
        FINAL_WARNINGS=$(grep -E "[0-9]+ warnings" "$PROGRESS_DIR/final_lint_report.txt" | head -1 | grep -o '[0-9]\+ warnings' | grep -o '[0-9]\+' || echo "0")
        
        echo "最終問題數: $FINAL_PROBLEMS" | tee -a "$MASTER_LOG"
        echo "最終錯誤數: $FINAL_ERRORS" | tee -a "$MASTER_LOG"
        echo "最終警告數: $FINAL_WARNINGS" | tee -a "$MASTER_LOG"
        
        # 計算修正效果
        if [ -f "$PROGRESS_DIR/initial_stats.txt" ]; then
            INITIAL_PROBLEMS=$(grep "總問題數:" "$PROGRESS_DIR/initial_stats.txt" | grep -o '[0-9]\+')
            INITIAL_ERRORS=$(grep "錯誤數:" "$PROGRESS_DIR/initial_stats.txt" | grep -o '[0-9]\+')
            
            if [ -n "$INITIAL_PROBLEMS" ] && [ "$INITIAL_PROBLEMS" -gt 0 ]; then
                PROBLEMS_REDUCED=$((INITIAL_PROBLEMS - FINAL_PROBLEMS))
                REDUCTION_RATE=$((PROBLEMS_REDUCED * 100 / INITIAL_PROBLEMS))
                echo "問題減少數: $PROBLEMS_REDUCED" | tee -a "$MASTER_LOG"
                echo "問題減少率: $REDUCTION_RATE%" | tee -a "$MASTER_LOG"
            fi
        fi
        
    else
        echo "⚠️  無法產生最終 Lint 報告" | tee -a "$MASTER_LOG"
    fi
    
    # 執行測試驗證
    echo -e "\n🧪 功能測試驗證:" | tee -a "$MASTER_LOG"
    npm test > "$PROGRESS_DIR/final_test_report.txt" 2>&1 || true
    TEST_RESULT=$?
    
    if [ $TEST_RESULT -eq 0 ]; then
        echo "✅ 所有測試通過 - 修正沒有破壞現有功能" | tee -a "$MASTER_LOG"
    else
        echo "❌ 測試失敗 - 需要檢查修正內容" | tee -a "$MASTER_LOG"
        echo "測試報告已保存至: $PROGRESS_DIR/final_test_report.txt" | tee -a "$MASTER_LOG"
    fi
}

# 主要執行流程
echo -e "\n🔍 檢查所需腳本..." | tee -a "$MASTER_LOG"

# 檢查所有腳本
SCRIPTS=(
    "$PROJECT_ROOT/scripts/comprehensive-lint-fix.sh:綜合修正腳本"
    "$PROJECT_ROOT/scripts/fix-standard-error-imports.sh:StandardError引入修正"
    "$PROJECT_ROOT/scripts/fix-template-string-errors.sh:模板字串語法修正"
)

ALL_SCRIPTS_READY=true

for script_info in "${SCRIPTS[@]}"; do
    IFS=':' read -r script_path script_name <<< "$script_info"
    if ! check_script "$script_path" "$script_name"; then
        ALL_SCRIPTS_READY=false
    fi
done

if [ "$ALL_SCRIPTS_READY" = false ]; then
    echo "❌ 部分腳本檢查失敗，無法繼續執行" | tee -a "$MASTER_LOG"
    exit 1
fi

# 生成初始狀態報告
generate_initial_report

# 執行修正階段
echo -e "\n🚀 開始執行修正階段..." | tee -a "$MASTER_LOG"

# 階段 1: 綜合修正 (ESLint --fix + 基本修正)
if ! execute_phase "1" "綜合修正 (ESLint --fix)" "$PROJECT_ROOT/scripts/comprehensive-lint-fix.sh"; then
    echo "❌ 階段 1 失敗，停止執行" | tee -a "$MASTER_LOG"
    exit 1
fi

# 階段 2: StandardError 引入修正
if ! execute_phase "2" "StandardError 引入修正" "$PROJECT_ROOT/scripts/fix-standard-error-imports.sh"; then
    echo "⚠️  階段 2 失敗，但繼續執行後續階段" | tee -a "$MASTER_LOG"
fi

# 階段 3: 模板字串語法修正
if ! execute_phase "3" "模板字串語法修正" "$PROJECT_ROOT/scripts/fix-template-string-errors.sh"; then
    echo "⚠️  階段 3 失敗，但繼續執行後續階段" | tee -a "$MASTER_LOG"
fi

# 生成最終報告
generate_final_report

# 生成完整總結
echo -e "\n🎯 主控修正流程完成總結" | tee -a "$MASTER_LOG"
echo "================================" | tee -a "$MASTER_LOG"
echo "完成時間: $(date)" | tee -a "$MASTER_LOG"

# 檢查各階段完成狀態
echo -e "\n📊 階段執行狀態:" | tee -a "$MASTER_LOG"
for i in 1 2 3; do
    if [ -f "$PROGRESS_DIR/phase_${i}_completed" ]; then
        completion_time=$(cat "$PROGRESS_DIR/phase_${i}_completed")
        echo "階段 $i: ✅ 已完成 ($completion_time)" | tee -a "$MASTER_LOG"
    else
        echo "階段 $i: ❌ 未完成" | tee -a "$MASTER_LOG"
    fi
done

# 提供後續建議
echo -e "\n🎯 後續建議行動:" | tee -a "$MASTER_LOG"
echo "1. 檢查最終 Lint 報告: cat $PROGRESS_DIR/final_lint_report.txt" | tee -a "$MASTER_LOG"
echo "2. 檢查測試結果: cat $PROGRESS_DIR/final_test_report.txt" | tee -a "$MASTER_LOG"
echo "3. 手動處理剩餘問題: 參考各階段的詳細日誌" | tee -a "$MASTER_LOG"
echo "4. 若結果滿意: 使用 /commit-as-prompt 提交修正" | tee -a "$MASTER_LOG"
echo "5. 清理進度檔案: rm -rf $PROGRESS_DIR (可選)" | tee -a "$MASTER_LOG"

echo -e "\n📁 重要檔案位置:" | tee -a "$MASTER_LOG"
echo "主日誌: $MASTER_LOG" | tee -a "$MASTER_LOG"
echo "進度目錄: $PROGRESS_DIR" | tee -a "$MASTER_LOG"
echo "初始報告: $PROGRESS_DIR/initial_lint_report.txt" | tee -a "$MASTER_LOG"
echo "最終報告: $PROGRESS_DIR/final_lint_report.txt" | tee -a "$MASTER_LOG"

echo -e "\n✅ 主控 Lint 修正流程完成!" | tee -a "$MASTER_LOG"