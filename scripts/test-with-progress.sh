#!/bin/bash

# test-with-progress.sh
# 帶進度條的測試執行腳本
# 根據是否在 TMux 環境決定進度條顯示位置

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# 進度條字符
PROGRESS_CHAR="█"
EMPTY_CHAR="░"
PROGRESS_WIDTH=50

# 測試階段定義
declare -a TEST_STAGES=(
    "unit:單元測試"
    "integration:整合測試" 
    "lint:程式碼檢查"
    "build:建置驗證"
)

# 全域變數
CURRENT_STAGE=0
TOTAL_STAGES=${#TEST_STAGES[@]}
PROGRESS_TARGET=""
IS_TMUX_ENV=""

# 檢查是否在 TMux 環境
check_tmux_environment() {
    if [[ -n "$TMUX" ]]; then
        IS_TMUX_ENV="true"
        # 檢查面板4是否存在
        if tmux list-panes 2>/dev/null | grep -q "^4:"; then
            PROGRESS_TARGET="pane4"
            echo -e "${BLUE}[INFO]${NC} 偵測到 TMux 環境，進度條將顯示在面板4 (監控區)"
        else
            PROGRESS_TARGET="main"
            echo -e "${YELLOW}[WARNING]${NC} TMux 環境中但面板4不存在，進度條顯示在主面板"
        fi
    else
        IS_TMUX_ENV="false"
        PROGRESS_TARGET="main"
        echo -e "${BLUE}[INFO]${NC} 非 TMux 環境，進度條將顯示在主畫面"
    fi
}

# 發送進度條到指定目標
send_progress() {
    local message="$1"
    local progress="$2"
    local stage_info="$3"
    
    if [[ "$PROGRESS_TARGET" == "pane4" ]]; then
        # 發送到 TMux 面板4
        tmux send-keys -t 4 "clear" C-m
        tmux send-keys -t 4 "echo '$message'" C-m
        tmux send-keys -t 4 "echo '$progress'" C-m
        if [[ -n "$stage_info" ]]; then
            tmux send-keys -t 4 "echo '$stage_info'" C-m
        fi
    else
        # 顯示在當前終端
        echo -e "$message"
        echo -e "$progress"
        if [[ -n "$stage_info" ]]; then
            echo -e "$stage_info"
        fi
    fi
}

# 生成進度條
generate_progress_bar() {
    local current=$1
    local total=$2
    local stage_name="$3"
    local sub_progress=${4:-0}
    
    # 計算整體進度 (包含子進度) - 使用 awk 替代 bc 以提高相容性
    local overall_progress=$(awk "BEGIN {printf \"%.0f\", ($current + $sub_progress) / $total * 100}")
    local filled=$(awk "BEGIN {printf \"%.0f\", $overall_progress * $PROGRESS_WIDTH / 100}")
    
    # 生成進度條
    local bar=""
    for ((i=0; i<PROGRESS_WIDTH; i++)); do
        if [[ $i -lt $filled ]]; then
            bar+="$PROGRESS_CHAR"
        else
            bar+="$EMPTY_CHAR"
        fi
    done
    
    # 格式化輸出
    local progress_text="${WHITE}[$bar]${NC} ${CYAN}${overall_progress%.*}%${NC}"
    local stage_text="${YELLOW}階段 $((current+1))/$total:${NC} ${stage_name}"
    local title="${BLUE}📊 測試執行進度${NC}"
    
    send_progress "$title" "$progress_text" "$stage_text"
}

# 執行單元測試
run_unit_tests() {
    local stage_name="單元測試 (Unit Tests)"
    echo -e "${GREEN}[START]${NC} 開始執行 $stage_name..."
    
    generate_progress_bar $CURRENT_STAGE $TOTAL_STAGES "$stage_name" 0.1
    
    # 執行測試並捕獲結果
    local test_output
    local test_result=0
    
    if test_output=$(npm run test:unit 2>&1); then
        echo -e "${GREEN}[SUCCESS]${NC} $stage_name 完成"
        generate_progress_bar $CURRENT_STAGE $TOTAL_STAGES "$stage_name" 0.9
    else
        echo -e "${RED}[ERROR]${NC} $stage_name 失敗"
        echo -e "${RED}錯誤輸出：${NC}"
        echo "$test_output" | tail -10
        test_result=1
    fi
    
    generate_progress_bar $CURRENT_STAGE $TOTAL_STAGES "$stage_name" 1.0
    ((CURRENT_STAGE++))
    return $test_result
}

# 執行整合測試
run_integration_tests() {
    local stage_name="整合測試 (Integration Tests)"
    echo -e "${GREEN}[START]${NC} 開始執行 $stage_name..."
    
    generate_progress_bar $CURRENT_STAGE $TOTAL_STAGES "$stage_name" 0.1
    
    local test_output
    local test_result=0
    
    if test_output=$(npm run test:integration 2>&1); then
        echo -e "${GREEN}[SUCCESS]${NC} $stage_name 完成"
        generate_progress_bar $CURRENT_STAGE $TOTAL_STAGES "$stage_name" 0.9
    else
        echo -e "${RED}[ERROR]${NC} $stage_name 失敗"
        echo -e "${RED}錯誤輸出：${NC}"
        echo "$test_output" | tail -10
        test_result=1
    fi
    
    generate_progress_bar $CURRENT_STAGE $TOTAL_STAGES "$stage_name" 1.0
    ((CURRENT_STAGE++))
    return $test_result
}

# 執行程式碼檢查
run_lint_check() {
    local stage_name="程式碼檢查 (ESLint)"
    echo -e "${GREEN}[START]${NC} 開始執行 $stage_name..."
    
    generate_progress_bar $CURRENT_STAGE $TOTAL_STAGES "$stage_name" 0.1
    
    local lint_output
    local lint_result=0
    
    if lint_output=$(npm run lint 2>&1); then
        echo -e "${GREEN}[SUCCESS]${NC} $stage_name 完成"
        generate_progress_bar $CURRENT_STAGE $TOTAL_STAGES "$stage_name" 0.9
    else
        echo -e "${YELLOW}[WARNING]${NC} $stage_name 發現問題"
        echo -e "${YELLOW}警告輸出：${NC}"
        echo "$lint_output" | head -10
        # Lint 警告不算失敗，繼續執行
    fi
    
    generate_progress_bar $CURRENT_STAGE $TOTAL_STAGES "$stage_name" 1.0
    ((CURRENT_STAGE++))
    return $lint_result
}

# 執行建置驗證
run_build_validation() {
    local stage_name="建置驗證 (Build Validation)"
    echo -e "${GREEN}[START]${NC} 開始執行 $stage_name..."
    
    generate_progress_bar $CURRENT_STAGE $TOTAL_STAGES "$stage_name" 0.1
    
    local build_output
    local build_result=0
    
    if build_output=$(npm run build:dev 2>&1); then
        echo -e "${GREEN}[SUCCESS]${NC} $stage_name 完成"
        generate_progress_bar $CURRENT_STAGE $TOTAL_STAGES "$stage_name" 0.9
    else
        echo -e "${RED}[ERROR]${NC} $stage_name 失敗"
        echo -e "${RED}錯誤輸出：${NC}"
        echo "$build_output" | tail -10
        build_result=1
    fi
    
    generate_progress_bar $CURRENT_STAGE $TOTAL_STAGES "$stage_name" 1.0
    ((CURRENT_STAGE++))
    return $build_result
}

# 顯示最終結果
show_final_results() {
    local total_errors=$1
    local total_warnings=$2
    
    echo ""
    echo "========================================"
    
    if [[ $total_errors -eq 0 ]]; then
        echo -e "${GREEN}✅ 所有測試階段完成${NC}"
        local final_message="${GREEN}📊 測試完成${NC} - ${GREEN}✅ 全部通過${NC}"
    else
        echo -e "${RED}❌ 發現 $total_errors 個錯誤${NC}"
        local final_message="${RED}📊 測試完成${NC} - ${RED}❌ $total_errors 個錯誤${NC}"
    fi
    
    if [[ $total_warnings -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  發現 $total_warnings 個警告${NC}"
        final_message="$final_message, ${YELLOW}⚠️  $total_warnings 個警告${NC}"
    fi
    
    echo "========================================"
    
    # 發送最終結果到進度區
    if [[ "$PROGRESS_TARGET" == "pane4" ]]; then
        tmux send-keys -t 4 "clear" C-m
        tmux send-keys -t 4 "echo '$final_message'" C-m
        tmux send-keys -t 4 "echo ''" C-m
        tmux send-keys -t 4 "echo '測試摘要:'" C-m
        tmux send-keys -t 4 "echo '- 單元測試: 執行完成'" C-m
        tmux send-keys -t 4 "echo '- 整合測試: 執行完成'" C-m
        tmux send-keys -t 4 "echo '- 程式碼檢查: 執行完成'" C-m
        tmux send-keys -t 4 "echo '- 建置驗證: 執行完成'" C-m
        if [[ $total_errors -eq 0 ]]; then
            tmux send-keys -t 4 "echo ''" C-m
            tmux send-keys -t 4 "echo '🎉 準備開始開發工作！'" C-m
        fi
    fi
    
    return $total_errors
}

# 快速測試模式 (僅執行關鍵測試)
run_quick_tests() {
    echo -e "${BLUE}[INFO]${NC} 執行快速測試模式..."
    
    local errors=0
    
    # 只執行 lint 和基本建置檢查
    TOTAL_STAGES=2
    CURRENT_STAGE=0
    
    run_lint_check || ((errors++))
    run_build_validation || ((errors++))
    
    return $errors
}

# 完整測試模式
run_full_tests() {
    echo -e "${BLUE}[INFO]${NC} 執行完整測試模式..."
    
    local errors=0
    
    run_unit_tests || ((errors++))
    run_integration_tests || ((errors++))
    run_lint_check || ((errors++))
    run_build_validation || ((errors++))
    
    return $errors
}

# 主程序
main() {
    local mode=${1:-"full"}
    local errors=0
    local warnings=0
    
    echo -e "${BLUE}[INFO]${NC} 開始執行測試流程..."
    echo ""
    
    # 檢查環境
    check_tmux_environment
    echo ""
    
    # 初始化進度顯示
    if [[ "$PROGRESS_TARGET" == "pane4" ]]; then
        tmux send-keys -t 4 "clear" C-m
        tmux send-keys -t 4 "echo '🚀 準備執行測試...'" C-m
    fi
    
    # 根據模式執行測試
    case "$mode" in
        "quick"|"q")
            run_quick_tests
            errors=$?
            ;;
        "full"|"f"|*)
            run_full_tests
            errors=$?
            ;;
    esac
    
    # 顯示最終結果
    show_final_results $errors $warnings
    
    return $errors
}

# 檢查是否提供了幫助參數
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "測試進度條腳本 - 帶視覺化進度的測試執行工具"
    echo ""
    echo "使用方法:"
    echo "  $0 [模式]"
    echo ""
    echo "模式:"
    echo "  full, f     執行完整測試 (預設)"
    echo "  quick, q    執行快速測試 (僅 lint + build)"
    echo ""
    echo "功能:"
    echo "  - TMux 環境中進度條顯示在面板4 (監控區)"
    echo "  - 非 TMux 環境中進度條顯示在主畫面"
    echo "  - 彩色進度條和狀態指示"
    echo "  - 錯誤和警告統計"
    echo ""
    exit 0
fi

# 執行主程序
main "$@"