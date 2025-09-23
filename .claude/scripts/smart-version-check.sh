#!/bin/bash

# /smart-version-check 指令實現
# 功能：整合腳本分析與 Claude 邏輯判斷的版本推進檢查
# 設計：為 Claude Code 內建指令提供數據收集，由 Claude 進行綜合分析決策

set -e

SCRIPTS_DIR="$(dirname "$0")"
PACKAGE_JSON="package.json"

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日誌函數
log_info() {
    echo -e "${BLUE}[Version Check]${NC} $1"
}

log_data() {
    echo -e "${CYAN}[資料收集]${NC} $1"
}

log_analysis() {
    echo -e "${PURPLE}[狀態分析]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[完成]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

log_error() {
    echo -e "${RED}[錯誤]${NC} $1"
}

# 獲取當前版本和基本資訊
get_basic_info() {
    local current_version
    current_version=$(grep '"version"' "$PACKAGE_JSON" | sed 's/.*"version": *"\([^"]*\)".*/\1/' 2>/dev/null || echo "unknown")
    
    local current_branch
    current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
    
    echo "{
        \"current_version\": \"$current_version\",
        \"current_branch\": \"$current_branch\",
        \"timestamp\": \"$(date -Iseconds)\"
    }"
}

# 收集測試狀態資料
collect_test_status() {
    log_data "收集測試狀態資料..."
    
    local temp_file="/tmp/test_results_$$"
    
    # 執行測試但控制輸出
    if npm test --silent > "$temp_file" 2>&1; then
        local test_passed="true"
    else
        local test_passed="false"
    fi
    
    # 解析測試結果
    local failed_suites passed_suites total_suites
    local failed_tests passed_tests total_tests
    
    failed_suites=$(grep "Test Suites:" "$temp_file" | sed 's/.*Test Suites: \([0-9]*\) failed.*/\1/' 2>/dev/null || echo "0")
    passed_suites=$(grep "Test Suites:" "$temp_file" | sed 's/.*\([0-9]*\) passed.*/\1/' 2>/dev/null || echo "0")
    total_suites=$(grep "Test Suites:" "$temp_file" | sed 's/.*\([0-9]*\) total.*/\1/' 2>/dev/null || echo "0")
    
    failed_tests=$(grep "Tests:" "$temp_file" | sed 's/.*Tests: *\([0-9]*\) failed.*/\1/' 2>/dev/null || echo "0")
    passed_tests=$(grep "Tests:" "$temp_file" | sed 's/.*\([0-9]*\) passed.*/\1/' 2>/dev/null || echo "0")
    total_tests=$(grep "Tests:" "$temp_file" | sed 's/.*\([0-9]*\) total.*/\1/' 2>/dev/null || echo "0")
    
    # 計算通過率
    local pass_rate="0"
    if [[ $total_tests -gt 0 ]]; then
        pass_rate=$(echo "scale=2; $passed_tests * 100 / $total_tests" | bc -l 2>/dev/null || echo "0")
    fi
    
    # 檢查是否有新的錯誤
    local has_new_errors="false"
    if grep -q "Error\|ERROR\|Failed\|FAILED" "$temp_file"; then
        has_new_errors="true"
    fi
    
    rm -f "$temp_file"
    
    echo "{
        \"test_passed\": $test_passed,
        \"failed_suites\": $failed_suites,
        \"passed_suites\": $passed_suites,
        \"total_suites\": $total_suites,
        \"failed_tests\": $failed_tests,
        \"passed_tests\": $passed_tests,
        \"total_tests\": $total_tests,
        \"pass_rate\": $pass_rate,
        \"has_new_errors\": $has_new_errors
    }"
}

# 收集程式碼品質資料
collect_code_quality() {
    log_data "收集程式碼品質資料..."
    
    local lint_issues="0"
    local lint_passed="true"
    
    # 檢查 lint 狀態
    if command -v npm >/dev/null && npm run lint >/dev/null 2>&1; then
        lint_passed="true"
    else
        lint_passed="false"
        # 嘗試計算警告數量
        local lint_output
        lint_output=$(npm run lint 2>&1 || true)
        lint_issues=$(echo "$lint_output" | grep -c "warning\|error" || echo "0")
    fi
    
    # 檢查 git 狀態
    local uncommitted_changes
    uncommitted_changes=$(git status --porcelain | wc -l | tr -d ' ')
    
    local untracked_files
    untracked_files=$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')
    
    echo "{
        \"lint_passed\": $lint_passed,
        \"lint_issues\": $lint_issues,
        \"uncommitted_changes\": $uncommitted_changes,
        \"untracked_files\": $untracked_files
    }"
}

# 收集工作日誌分析
collect_work_log_analysis() {
    log_data "分析工作日誌狀態..."
    
    local work_log_status="unknown"
    local latest_work_log=""
    
    # 執行工作日誌檢查
    if [[ -f "$SCRIPTS_DIR/check-work-log.sh" ]]; then
        if "$SCRIPTS_DIR/check-work-log.sh" >/dev/null 2>&1; then
            work_log_status="complete"
        else
            work_log_status="incomplete"
        fi
    fi
    
    # 找到最新的工作日誌
    if [[ -d "docs/work-logs" ]]; then
        latest_work_log=$(ls -t docs/work-logs/*.md 2>/dev/null | head -1 || echo "")
    fi
    
    # 分析工作日誌內容 (如果存在)
    local has_completion_marker="false"
    local recent_progress="false"
    
    if [[ -n "$latest_work_log" && -f "$latest_work_log" ]]; then
        if grep -q "✅.*完成\|✅.*Complete\|Status.*✅" "$latest_work_log"; then
            has_completion_marker="true"
        fi
        
        # 檢查最近是否有更新 (24小時內)
        local file_age
        file_age=$(stat -f %m "$latest_work_log" 2>/dev/null || echo "0")
        local current_time
        current_time=$(date +%s)
        
        if [[ $((current_time - file_age)) -lt 86400 ]]; then
            recent_progress="true"
        fi
    fi
    
    echo "{
        \"work_log_status\": \"$work_log_status\",
        \"latest_work_log\": \"$latest_work_log\",
        \"has_completion_marker\": $has_completion_marker,
        \"recent_progress\": $recent_progress
    }"
}

# 收集 todolist 目標分析
collect_todolist_analysis() {
    log_data "分析 todolist 目標狀態..."
    
    local objectives_status="unknown"
    local high_priority_tasks="0"
    local completed_tasks="0"
    local total_tasks="0"
    
    # 執行目標檢查
    if [[ -f "$SCRIPTS_DIR/check-next-objectives.sh" ]]; then
        local temp_file="/tmp/objectives_$$"
        "$SCRIPTS_DIR/check-next-objectives.sh" >"$temp_file" 2>/dev/null || true
        
        if [[ -f "$temp_file" ]]; then
            objectives_status=$(grep '"status"' "$temp_file" | sed 's/.*"status": *"\([^"]*\)".*/\1/' 2>/dev/null || echo "unknown")
            rm -f "$temp_file"
        fi
    fi
    
    # 分析 todolist.md 內容
    if [[ -f "docs/todolist.md" ]]; then
        # 計算任務數量
        high_priority_tasks=$(grep -c "\*\*Critical\*\*\|\*\*High\*\*\|🔴\|⭕" docs/todolist.md || echo "0")
        completed_tasks=$(grep -c "✅\|完成" docs/todolist.md || echo "0")
        total_tasks=$(grep -c "^- \|^  - \|^\* \|^  \* " docs/todolist.md || echo "0")
    fi
    
    echo "{
        \"objectives_status\": \"$objectives_status\",
        \"high_priority_tasks\": $high_priority_tasks,
        \"completed_tasks\": $completed_tasks,
        \"total_tasks\": $total_tasks
    }"
}

# 執行基礎腳本分析
run_base_script_analysis() {
    log_data "執行基礎版本推進分析..."
    
    local script_result="unknown"
    local script_exit_code="99"
    
    if [[ -f "$SCRIPTS_DIR/version-progression-check.sh" ]]; then
        # 執行但捕獲輸出到臨時檔案
        local temp_file="/tmp/version_analysis_$$"
        
        "$SCRIPTS_DIR/version-progression-check.sh" >"$temp_file" 2>&1 || true
        script_exit_code=$?
        
        # 解析建議類型
        if grep -q "小版本推進" "$temp_file"; then
            script_result="patch_recommended"
        elif grep -q "中版本推進" "$temp_file"; then
            script_result="minor_recommended"
        elif grep -q "繼續當前版本" "$temp_file"; then
            script_result="continue_development"
        elif grep -q "手動決策" "$temp_file"; then
            script_result="manual_decision"
        fi
        
        rm -f "$temp_file"
    fi
    
    echo "{
        \"script_result\": \"$script_result\",
        \"script_exit_code\": $script_exit_code
    }"
}

# 主函數：整合所有資料收集
main() {
    log_info "開始版本推進檢查"
    echo ""
    
    # 檢查基本環境
    if [[ ! -f "$PACKAGE_JSON" ]]; then
        log_error "找不到 package.json，請確認在專案根目錄執行"
        exit 1
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔍 版本推進檢查 - 資料收集階段"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 收集所有分析資料
    log_analysis "整合分析資料中..."
    
    local basic_info test_status code_quality work_log_analysis todolist_analysis script_analysis
    
    basic_info=$(get_basic_info)
    test_status=$(collect_test_status)
    code_quality=$(collect_code_quality)
    work_log_analysis=$(collect_work_log_analysis)
    todolist_analysis=$(collect_todolist_analysis)
    script_analysis=$(run_base_script_analysis)
    
    # 輸出完整的 JSON 分析報告供 Claude 使用
    echo ""
    echo "📊 分析資料報告 (供 Claude 邏輯判斷使用)："
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    cat << EOF
{
    "analysis_timestamp": "$(date -Iseconds)",
    "basic_info": $basic_info,
    "test_status": $test_status,
    "code_quality": $code_quality,
    "work_log_analysis": $work_log_analysis,
    "todolist_analysis": $todolist_analysis,
    "script_analysis": $script_analysis,
    "analysis_summary": {
        "data_collection_complete": true,
        "requires_claude_decision": true,
        "critical_issues": [
            $(if [[ $(echo "$test_status" | grep -o '"test_passed": false') ]]; then echo '"test_failures"'; fi)
            $(if [[ $(echo "$code_quality" | grep -o '"lint_passed": false') ]]; then echo '"code_quality_issues"'; fi)
        ]
    }
}
EOF
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "資料收集完成，等待 Claude 綜合分析與決策"
    echo ""
    echo "💡 接下來 Claude 將基於以上資料進行綜合分析：" 
    echo "   • 評估實際任務完成品質"
    echo "   • 分析技術債務和風險"
    echo "   • 判斷版本推進的適當時機"
    echo "   • 提供具體可執行的建議"
    
    return 0
}

# 執行主邏輯
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi