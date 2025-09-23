#!/bin/bash

# 版本推進檢查腳本 - 判斷是否需要版本推進
# 功能：整合工作日誌和 todolist 分析，決定版本推進策略

set -e

# 腳本配置
SCRIPTS_DIR="$(dirname "$0")"
PACKAGE_JSON="package.json"

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 日誌函數
log_info() {
    echo -e "${BLUE}[版本推進]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[版本推進]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[版本推進]${NC} $1"
}

log_error() {
    echo -e "${RED}[版本推進]${NC} $1"
}

log_decision() {
    echo -e "${PURPLE}[版本決策]${NC} $1"
}

# 獲取當前版本號
get_current_version() {
    if [[ -f "$PACKAGE_JSON" ]]; then
        grep '"version"' "$PACKAGE_JSON" | sed 's/.*"version": *"\([^"]*\)".*/\1/'
    else
        log_error "找不到 package.json 檔案"
        exit 1
    fi
}

# 解析版本號
parse_version() {
    local version="$1"
    local major minor patch
    
    major=$(echo "$version" | cut -d. -f1)
    minor=$(echo "$version" | cut -d. -f2)
    patch=$(echo "$version" | cut -d. -f3)
    
    echo "$major $minor $patch"
}

# 計算下一個版本號
calculate_next_version() {
    local current_version="$1"
    local progression_type="$2"
    
    read -r major minor patch <<< "$(parse_version "$current_version")"
    
    case "$progression_type" in
        "patch")
            echo "${major}.${minor}.$((patch + 1))"
            ;;
        "minor")
            echo "${major}.$((minor + 1)).0"
            ;;
        "major")
            echo "$((major + 1)).0.0"
            ;;
        *)
            echo "$current_version"
            ;;
    esac
}

# 執行工作日誌檢查
check_work_log_status() {
    if [[ -f "$SCRIPTS_DIR/check-work-log.sh" ]]; then
        if "$SCRIPTS_DIR/check-work-log.sh" >/dev/null 2>&1; then
            echo "work_log_complete"
        else
            echo "work_log_incomplete"
        fi
    else
        echo "unknown"
    fi
}

# 執行下一步目標檢查
check_objectives_status() {
    if [[ -f "$SCRIPTS_DIR/check-next-objectives.sh" ]]; then
        local result
        # 使用臨時檔案來確保輸出分離
        local temp_file="/tmp/objectives_check_$$"
        "$SCRIPTS_DIR/check-next-objectives.sh" >"$temp_file" 2>/dev/null
        
        result=$(grep '"status"' "$temp_file" | sed 's/.*"status": *"\([^"]*\)".*/\1/' 2>/dev/null || echo "unknown")
        rm -f "$temp_file"
        
        echo "$result"
    else
        echo "unknown"
    fi
}

# 版本推進決策邏輯
make_progression_decision() {
    local work_log_status="$1"
    local objectives_status="$2"
    local current_version="$3"
    
    log_info "分析版本推進需求..."
    echo ""
    echo "📊 當前狀態分析:"
    echo "   工作日誌狀態: $work_log_status"
    echo "   任務完成狀態: $objectives_status"
    echo "   當前版本: $current_version"
    echo ""
    
    # 決策矩陣
    local decision_case="$work_log_status-$objectives_status"
    
    case "$decision_case" in
        "work_log_complete-series_completed")
            log_decision "🎯 建議：中版本推進 (Minor Version)"
            echo "理由：當前工作完成且版本系列目標達成"
            echo "建議版本：$(calculate_next_version "$current_version" "minor")"
            echo "操作：需要更新 todolist.md 規劃新版本系列"
            return 2  # minor version
            ;;
        "work_log_complete-near_completion"|"work_log_complete-focus_mode")
            log_decision "🔧 建議：小版本推進 (Patch Version)"
            echo "理由：當前工作完成但版本系列仍在進行中"
            echo "建議版本：$(calculate_next_version "$current_version" "patch")"
            echo "操作：繼續當前版本系列，新增工作日誌"
            return 1  # patch version
            ;;
        "work_log_complete-needs_prioritization")
            log_decision "🎯 建議：小版本推進並重新規劃"
            echo "理由：當前工作完成但需要重新排序任務優先級"
            echo "建議版本：$(calculate_next_version "$current_version" "patch")"
            echo "操作：更新 todolist.md 重新排序任務"
            return 1  # patch version
            ;;
        *"work_log_incomplete"*)
            log_decision "⏳ 建議：繼續當前版本開發"
            echo "理由：當前工作尚未完成"
            echo "維持版本：$current_version"
            echo "操作：更新工作日誌記錄進度"
            return 0  # no version change
            ;;
        *)
            log_decision "❓ 狀態不明確，需要手動決策"
            echo "理由：決策條件 '$decision_case' 未匹配到預設情境"
            echo "建議：檢查工作日誌和 todolist.md 內容"
            return 99  # manual decision needed (避免與系統 exit code 衝突)
            ;;
    esac
}

# 顯示版本推進指引
display_progression_guide() {
    local decision_code="$1"
    local current_version="$2"
    
    echo ""
    echo "🚀 版本推進指引："
    echo ""
    
    case $decision_code in
        2)  # minor version
            local next_version
            next_version=$(calculate_next_version "$current_version" "minor")
            echo "1. 更新 package.json 版本到 $next_version"
            echo "2. 建立新的工作日誌: docs/work-logs/v${next_version}-[描述].md"
            echo "3. 更新 todolist.md 規劃新版本系列目標"
            echo "4. 更新 CHANGELOG.md 記錄版本變更"
            echo ""
            echo "💡 自動化指令："
            echo "   ./scripts/work-log-manager.sh  # 選擇「開始新的工作項目」"
            ;;
        1)  # patch version
            local next_version
            next_version=$(calculate_next_version "$current_version" "patch")
            echo "1. 更新 package.json 版本到 $next_version"
            echo "2. 建立新的工作日誌: docs/work-logs/v${next_version}-[描述].md"
            echo "3. 根據 todolist.md 繼續當前版本系列任務"
            echo ""
            echo "💡 自動化指令："
            echo "   ./scripts/work-log-manager.sh  # 選擇「開始新的工作項目」"
            ;;
        0)  # no change
            echo "1. 更新現有工作日誌記錄今日進度"
            echo "2. 繼續執行當前任務"
            echo "3. 定期檢查版本推進條件"
            echo ""
            echo "💡 自動化指令："
            echo "   ./scripts/work-log-manager.sh  # 選擇「更新進行中的工作」"
            ;;
        99)  # manual decision
            echo "1. 檢查並更新工作日誌內容"
            echo "2. 檢查 todolist.md 任務狀態"
            echo "3. 根據實際情況決定版本推進策略"
            echo ""
            echo "💡 手動檢查指令："
            echo "   ./scripts/check-work-log.sh"
            echo "   ./scripts/check-next-objectives.sh"
            ;;
        *)  # other codes
            echo "1. 檢查腳本執行結果"
            echo "2. 檢視系統狀態和錯誤訊息"
            echo "3. 必要時重新執行檢查"
            ;;
    esac
    echo ""
}

# 主執行邏輯
main() {
    log_info "開始版本推進檢查"
    echo ""
    
    # 獲取當前版本
    local current_version
    current_version=$(get_current_version)
    
    # 檢查工作日誌狀態
    log_info "檢查工作日誌狀態..."
    local work_log_status
    work_log_status=$(check_work_log_status)
    
    # 檢查目標狀態  
    log_info "檢查 todolist 目標狀態..."
    local objectives_status
    objectives_status=$(check_objectives_status)
    
    # 做出推進決策
    local decision_code
    make_progression_decision "$work_log_status" "$objectives_status" "$current_version"
    decision_code=$?
    
    # 顯示推進指引
    display_progression_guide "$decision_code" "$current_version"
    
    return "$decision_code"
}

# 如果腳本被直接執行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi