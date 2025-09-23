#!/bin/bash

# 工作日誌檢查腳本
# 檢查當前提交內容是否已記錄到工作日誌中

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日誌函數
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 獲取最新的工作日誌檔案
get_latest_work_log() {
    local work_log_dir="docs/work-logs"
    
    if [[ ! -d "$work_log_dir" ]]; then
        log_error "工作日誌目錄不存在: $work_log_dir"
        return 1
    fi
    
    # 尋找最新的版本工作日誌 (v*.*.*)
    local latest_log=$(ls "$work_log_dir"/v*.*.*.md 2>/dev/null | sort -V | tail -1)
    
    if [[ -z "$latest_log" ]]; then
        log_warning "找不到版本工作日誌檔案"
        return 1
    fi
    
    echo "$latest_log"
}

# 獲取今日日期 (YYYY-MM-DD)
get_today_date() {
    date +%Y-%m-%d
}

# 這些函數已不再需要，因為改用直接確認方式
# check_todays_entry() 和 check_work_content_completeness() 已移除

# 檢查 git 變更內容
get_git_changes() {
    log_info "分析 Git 變更內容..."
    
    echo "🔍 工作區狀態:"
    git status --porcelain
    
    echo ""
    echo "📝 已暫存的變更:"
    git diff --cached --name-only
    
    echo ""
    echo "📄 未暫存的變更:"
    git diff --name-only
}

# 自動化工作日誌管理提示
prompt_smart_work_log_management() {
    local log_file="$1"
    
    echo ""
    log_warning "⚠️  工作日誌檢查不通過！"
    echo ""
    echo "🤖 自動化工作日誌管理系統已啟動"
    echo ""
    echo "💡 建議操作："
    echo "1. 執行工作日誌管理腳本："
    echo "   ./scripts/work-log-manager.sh"
    echo ""
    echo "2. 或手動更新現有工作日誌："
    echo "   $log_file"
    echo ""
    echo "3. 工作日誌更新完成後重新執行 /commit-as-prompt"
    echo ""
    echo "📋 工作日誌管理的三種狀況："
    echo "   🔄 更新進行中的工作記錄"
    echo "   🆕 開始新的工作項目"
    echo "   ✅ 完成當前工作並新增總結"
    echo ""
    
    return 1
}

# 提示建立新工作日誌
prompt_create_new_work_log() {
    echo ""
    log_warning "⚠️  未找到工作日誌檔案！"
    echo ""
    echo "🆕 需要建立新的工作日誌"
    echo ""
    echo "💡 建議執行："
    echo "   ./scripts/work-log-manager.sh"
    echo ""
    echo "這將引導您建立正確版本的工作日誌檔案"
    echo ""
    
    return 1
}

# 顯示工作日誌相關的變更
show_work_log_changes() {
    local changes_found=false
    
    echo "📋 檢查是否包含工作日誌相關變更..."
    
    # 檢查是否有工作日誌檔案的變更
    if git diff --cached --name-only | grep -q "docs/work-logs/"; then
        echo "✅ 發現工作日誌檔案變更:"
        git diff --cached --name-only | grep "docs/work-logs/"
        changes_found=true
    fi
    
    # 檢查是否有 todolist.md 的變更
    if git diff --cached --name-only | grep -q "docs/todolist.md"; then
        echo "✅ 發現 TODO 清單變更"
        changes_found=true
    fi
    
    # 檢查是否有 CHANGELOG.md 的變更
    if git diff --cached --name-only | grep -q "CHANGELOG.md"; then
        echo "✅ 發現變更記錄檔案更新"
        changes_found=true
    fi
    
    if [[ "$changes_found" == false ]]; then
        log_warning "⚠️  未發現文件記錄相關的變更"
    fi
}

# 主檢查函數
main() {
    log_info "開始工作日誌檢查..."
    
    # 首先檢查是否有要提交的變更
    if git diff --cached --quiet; then
        log_info "沒有待提交的變更，跳過工作日誌檢查"
        return 0
    fi
    
    # 獲取最新工作日誌
    local latest_log
    if ! latest_log=$(get_latest_work_log); then
        log_warning "無法找到工作日誌檔案，需要建立新的工作日誌"
        prompt_create_new_work_log
        return 1
    fi
    
    # 顯示當前變更
    get_git_changes
    echo ""
    
    # 顯示工作日誌相關變更
    show_work_log_changes
    echo ""
    
    # 🎯 核心修復：強制確認工作日誌
    log_info "🔍 檢測到待提交的變更"
    echo ""
    echo "❓ 本次提交的工作內容是否已記錄在工作日誌中？"
    echo ""
    echo "📋 待提交的變更："
    git diff --cached --name-only | head -10
    local total_staged=$(git diff --cached --name-only | wc -l)
    if [[ $total_staged -gt 10 ]]; then
        echo "... 以及其他 $((total_staged - 10)) 個文件"
    fi
    echo ""
    echo "📝 當前工作日誌: $latest_log"
    echo ""
    echo "💭 請確認："
    echo "   1. 這些變更代表的工作是否已記錄？"
    echo "   2. 工作進度和成果是否已更新？"
    echo "   3. 如有重要里程碑，是否已記錄？"
    echo ""
    echo "💡 如需更新工作日誌："
    echo "   ./scripts/work-log-manager.sh"
    echo ""
    
    # 🎯 關鍵：讓用戶確認，不做自動判斷
    read -p "✅ 工作日誌已完整記錄本次變更？ (y/N): " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_success "✅ 工作日誌檢查通過，可以進行提交"
        return 0
    else
        log_warning "⚠️  請先更新工作日誌再提交"
        echo ""
        echo "🤖 建議操作："
        echo "1. 執行工作日誌管理腳本："
        echo "   ./scripts/work-log-manager.sh"
        echo ""
        echo "2. 工作日誌更新完成後重新執行 /commit-as-prompt"
        return 1
    fi
}

# 如果直接執行腳本則執行 main 函數
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi