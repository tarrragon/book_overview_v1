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

# 檢查工作日誌是否有今日記錄
check_todays_entry() {
    local log_file="$1"
    local today=$(get_today_date)
    
    log_info "檢查工作日誌: $log_file"
    log_info "尋找今日日期記錄: $today"
    
    if grep -q "$today" "$log_file"; then
        log_success "✅ 找到今日日期記錄"
        return 0
    else
        log_warning "⚠️  未找到今日日期記錄"
        return 1
    fi
}

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

# 提示用戶更新工作日誌
prompt_update_work_log() {
    local log_file="$1"
    
    echo ""
    log_warning "⚠️  工作日誌檢查不通過！"
    echo ""
    echo "🔧 請先更新工作日誌再進行提交："
    echo ""
    echo "1. 開啟工作日誌檔案:"
    echo "   $log_file"
    echo ""
    echo "2. 記錄今日的開發工作內容，包括："
    echo "   - 完成的功能或修復"
    echo "   - 遇到的問題和解決方案" 
    echo "   - 程式碼變更說明"
    echo "   - 測試結果"
    echo ""
    echo "3. 更新完成後重新執行 /commit-as-prompt"
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
    
    # 獲取最新工作日誌
    local latest_log
    if ! latest_log=$(get_latest_work_log); then
        log_error "無法找到工作日誌檔案"
        exit 1
    fi
    
    # 顯示當前變更
    get_git_changes
    echo ""
    
    # 顯示工作日誌相關變更
    show_work_log_changes
    echo ""
    
    # 檢查今日是否有記錄
    if check_todays_entry "$latest_log"; then
        log_success "✅ 工作日誌檢查通過，可以進行提交"
        return 0
    else
        prompt_update_work_log "$latest_log"
        return 1
    fi
}

# 如果直接執行腳本則執行 main 函數
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi