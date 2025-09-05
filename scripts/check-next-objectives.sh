#!/bin/bash

# 下一步目標檢查腳本 - 從 todolist.md 讀取下一個中版本目標
# 功能：分析 todolist.md 內容，識別當前版本系列的下一步發展需求

set -e

# 腳本配置
TODOLIST_FILE="docs/todolist.md"
PACKAGE_JSON="package.json"

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日誌函數
log_info() {
    echo -e "${BLUE}[下一步目標]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[下一步目標]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[下一步目標]${NC} $1"
}

log_error() {
    echo -e "${RED}[下一步目標]${NC} $1"
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

# 分析 todolist.md 內容
analyze_todolist() {
    local current_version="$1"
    
    if [[ ! -f "$TODOLIST_FILE" ]]; then
        log_error "找不到 todolist.md 檔案: $TODOLIST_FILE"
        return 1
    fi
    
    log_info "分析 todolist.md 內容"
    
    # 解析當前版本
    read -r major minor patch <<< "$(parse_version "$current_version")"
    local current_series="v${major}.${minor}"
    
    log_info "當前版本系列: $current_series"
    
    # 尋找當前版本系列的任務
    local in_current_section=false
    local next_version_found=false
    local pending_tasks=()
    local completed_count=0
    local total_count=0
    
    while IFS= read -r line; do
        # 檢查是否進入當前版本區段
        if [[ "$line" =~ ^##.*$current_series ]]; then
            in_current_section=true
            log_info "找到當前版本區段: $(echo "$line" | sed 's/^## *//')"
            continue
        fi
        
        # 檢查是否離開當前版本區段
        if [[ "$in_current_section" == true ]] && [[ "$line" =~ ^##[[:space:]] ]]; then
            if [[ ! "$line" =~ $current_series ]]; then
                break
            fi
        fi
        
        # 在當前區段內分析任務
        if [[ "$in_current_section" == true ]]; then
            # 檢查任務項目 - 支援 [x], [ ], 和 ⭕ 格式
            if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[(.)\] ]] || [[ "$line" =~ ^[[:space:]]*-[[:space:]]*⭕ ]]; then
                ((total_count++))
                
                if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*⭕ ]]; then
                    # ⭕ 符號表示待開始任務
                    local task_content=$(echo "$line" | sed 's/^[[:space:]]*-[[:space:]]*⭕[[:space:]]*//')
                    pending_tasks+=("$task_content")
                else
                    # 標準 [x] 或 [ ] 格式
                    local status="${BASH_REMATCH[1]}"
                    local task_content=$(echo "$line" | sed 's/^[[:space:]]*-[[:space:]]*\[[[:space:]]*.\][[:space:]]*//')
                    
                    if [[ "$status" == " " ]]; then
                        pending_tasks+=("$task_content")
                    elif [[ "$status" == "x" || "$status" == "X" ]]; then
                        ((completed_count++))
                    fi
                fi
            fi
        fi
    done < "$TODOLIST_FILE"
    
    # 計算完成度
    local completion_rate=0
    if [[ $total_count -gt 0 ]]; then
        completion_rate=$((completed_count * 100 / total_count))
    fi
    
    # 輸出結果
    echo "{"
    echo "  \"current_version\": \"$current_version\","
    echo "  \"current_series\": \"$current_series\","
    echo "  \"total_tasks\": $total_count,"
    echo "  \"completed_tasks\": $completed_count,"
    echo "  \"completion_rate\": $completion_rate,"
    echo "  \"pending_tasks\": ["
    
    local first=true
    for task in "${pending_tasks[@]}"; do
        if [[ "$first" != true ]]; then
            echo ","
        fi
        echo "    \"$(echo "$task" | sed 's/"/\\"/g')\""
        first=false
    done
    
    echo "  ],"
    
    # 判斷下一步建議
    if [[ ${#pending_tasks[@]} -eq 0 ]]; then
        echo "  \"status\": \"series_completed\","
        echo "  \"recommendation\": \"當前版本系列已完成，建議規劃下一個中版本\""
    elif [[ $completion_rate -ge 80 ]]; then
        echo "  \"status\": \"near_completion\","
        echo "  \"recommendation\": \"版本接近完成，專注完成剩餘任務\""
    elif [[ ${#pending_tasks[@]} -le 3 ]]; then
        echo "  \"status\": \"focus_mode\","
        echo "  \"recommendation\": \"任務數量適中，可以專注執行\""
    else
        echo "  \"status\": \"needs_prioritization\","
        echo "  \"recommendation\": \"任務較多，建議優先處理關鍵項目\""
    fi
    
    echo "}"
}

# 顯示下一步目標建議
display_next_objectives() {
    local analysis_result="$1"
    
    echo ""
    log_info "📋 下一步目標分析結果"
    echo "$analysis_result" | while IFS= read -r line; do
        echo "   $line"
    done
    echo ""
    
    # 解析 JSON 並顯示建議
    local status
    status=$(echo "$analysis_result" | grep '"status"' | sed 's/.*"status": *"\([^"]*\)".*/\1/')
    
    case "$status" in
        "series_completed")
            log_success "🎉 當前版本系列已完成！"
            echo ""
            echo "💡 建議下一步行動："
            echo "1. 更新 package.json 版本號到下一個中版本"
            echo "2. 建立新的工作日誌檔案"
            echo "3. 在 todolist.md 中規劃下一版本系列目標"
            ;;
        "near_completion")
            log_success "🎯 版本接近完成！"
            echo ""
            echo "💡 建議專注完成："
            echo "$analysis_result" | grep -A 10 '"pending_tasks"' | grep -o '"[^"]*"' | sed 's/"//g' | head -5 | while read -r task; do
                echo "   • $task"
            done
            ;;
        "focus_mode")
            log_info "🔍 專注模式：任務數量適中"
            echo ""
            echo "📝 待處理任務："
            echo "$analysis_result" | grep -A 10 '"pending_tasks"' | grep -o '"[^"]*"' | sed 's/"//g' | while read -r task; do
                echo "   • $task"
            done
            ;;
        "needs_prioritization")
            log_warning "🚨 需要任務優先排序"
            echo ""
            echo "📝 建議優先處理："
            echo "$analysis_result" | grep -A 10 '"pending_tasks"' | grep -o '"[^"]*"' | sed 's/"//g' | head -3 | while read -r task; do
                echo "   • $task"
            done
            ;;
    esac
    echo ""
}

# 主執行邏輯
main() {
    log_info "開始檢查下一步目標"
    
    # 獲取當前版本
    local current_version
    current_version=$(get_current_version)
    log_info "當前版本: $current_version"
    
    # 分析 todolist.md
    local analysis_result
    if analysis_result=$(analyze_todolist "$current_version"); then
        display_next_objectives "$analysis_result"
        return 0
    else
        log_error "無法分析 todolist.md 內容"
        return 1
    fi
}

# 如果腳本被直接執行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi