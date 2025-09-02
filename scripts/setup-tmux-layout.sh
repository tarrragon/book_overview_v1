#!/bin/bash

# TMux Main Layout 設定腳本
# 用於設定標準的 1,2,2 佈局 (5個面板)

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

# 檢查 TMux 環境和 session 狀態
check_tmux_environment() {
    if [[ -z "$TMUX" ]]; then
        log_error "未在 TMux 環境中運行"
        
        # 檢查是否已有 main_layout session 存在
        if tmux has-session -t main_layout 2>/dev/null; then
            log_info "發現已存在的 main_layout session"
            log_info "請執行: tmux attach-session -t main_layout"
            exit 1
        else
            log_info "請先執行: tmux new-session -s main_layout"
            exit 1
        fi
    fi
    
    log_success "已在 TMux 環境中"
}

# 取得當前 session 名稱
get_current_session() {
    tmux display-message -p '#S'
}

# 重新命名當前 session 為 main_layout
rename_session_to_main_layout() {
    local current_session=$(get_current_session)
    
    if [[ "$current_session" != "main_layout" ]]; then
        log_info "重新命名 session '$current_session' 為 'main_layout'"
        tmux rename-session main_layout
        log_success "Session 已重新命名為 'main_layout'"
    else
        log_info "當前已在 'main_layout' session"
    fi
}

# 清理現有面板 (保留第一個面板)
cleanup_existing_panes() {
    local pane_count=$(tmux list-panes | wc -l | tr -d ' ')
    
    if [[ $pane_count -gt 1 ]]; then
        log_info "清理現有面板 (共 $pane_count 個面板)"
        # 從最後一個面板開始刪除，保留面板0
        for ((i=$pane_count-1; i>0; i--)); do
            tmux kill-pane -t $i
        done
        log_success "已清理額外面板"
    fi
}

# 設定 1,2,2 佈局
setup_main_layout() {
    log_info "設定 TMux 1,2,2 佈局 (5個面板)"
    
    # 確保從面板0開始
    tmux select-pane -t 0
    
    # 第一層分割: 上下分割 (面板0在上，新面板在下)
    tmux split-window -v
    
    # 選中下面的面板並再次上下分割
    tmux select-pane -t 1
    tmux split-window -v
    
    # 選中中間面板並左右分割
    tmux select-pane -t 1
    tmux split-window -h
    
    # 選中最下面的面板並左右分割
    tmux select-pane -t 3
    tmux split-window -h
    
    # 調整面板大小比例
    # 上層面板 (面板0) 佔 40% 高度
    tmux resize-pane -t 0 -y 40%
    
    # 中層面板 (面板1,2) 佔 30% 高度，左右各50%
    tmux resize-pane -t 1 -y 30%
    tmux resize-pane -t 2 -x 50%
    
    # 下層面板 (面板3,4) 佔 30% 高度，左右各50% 
    tmux resize-pane -t 4 -x 50%
    
    log_success "TMux 佈局設定完成"
}

# 檢查面板0是否已有 Claude Code 運行
check_claude_in_pane0() {
    local pane0_command=$(tmux display-message -t 0 -p '#{pane_current_command}')
    local pane0_tty=$(tmux display-message -t 0 -p '#{pane_tty}')
    
    log_info "檢查面板0中的程序: $pane0_command"
    
    # 檢查是否為互動式 shell 或可能的 Claude Code 環境
    if [[ "$pane0_command" =~ (bash|zsh|sh|fish)$ ]]; then
        log_warning "面板0中運行的是 shell ($pane0_command)"
        log_info "建議在面板0中啟動 Claude Code 以確保最佳開發體驗"
        return 1
    else
        log_info "面板0中運行程序: $pane0_command"
        return 0
    fi
}

# 設定面板標題和初始命令
setup_pane_titles() {
    log_info "設定面板標題和功能"
    
    # 面板0: 主要開發工作 - 特別處理
    if check_claude_in_pane0; then
        log_info "面板0似乎已有程序運行，跳過初始化"
    else
        tmux send-keys -t 0 'echo "面板0: 主要開發工作 (測試、編碼)"' Enter
        tmux send-keys -t 0 'echo "💡 建議在此面板啟動 Claude Code"' Enter
        tmux send-keys -t 0 'clear' Enter
    fi
    
    # 面板1: 文件更新
    tmux send-keys -t 1 'echo "面板1: 文件更新 (日誌、TODO等)"' Enter
    tmux send-keys -t 1 'clear' Enter
    
    # 面板2: 程式碼品質檢查
    tmux send-keys -t 2 'echo "面板2: 程式碼品質檢查 (lint、build等)"' Enter
    tmux send-keys -t 2 'clear' Enter
    
    # 面板3: Git 操作
    tmux send-keys -t 3 'echo "面板3: Git 操作 (提交、狀態等)"' Enter
    tmux send-keys -t 3 'clear' Enter
    
    # 面板4: 監控和分析
    tmux send-keys -t 4 'echo "面板4: 監控和分析 (日誌、效能等)"' Enter
    tmux send-keys -t 4 'clear' Enter
    
    # 回到面板0 (主要開發面板)
    tmux select-pane -t 0
    
    log_success "面板功能設定完成"
}

# 顯示佈局資訊
show_layout_info() {
    log_info "TMux 佈局配置資訊:"
    echo ""
    echo "┌─────────────────────────────────────┐"
    echo "│      面板0: 主要開發工作            │  (上層全幅)"
    echo "│      (測試、編碼)                   │"
    echo "├─────────────────┬───────────────────┤"
    echo "│    面板1:       │     面板2:        │  (中層左右)"
    echo "│   文件更新      │   程式碼品質檢查   │"
    echo "│ (日誌、TODO等)  │ (lint、build等)   │"
    echo "├─────────────────┼───────────────────┤"
    echo "│    面板3:       │     面板4:        │  (下層左右)"
    echo "│   Git 操作      │   監控和分析      │"
    echo "│ (提交、狀態等)  │ (日誌、效能等)    │"
    echo "└─────────────────┴───────────────────┘"
    echo ""
    echo "快捷鍵操作:"
    echo "- Ctrl+b 然後按方向鍵: 切換面板"
    echo "- Ctrl+b 然後按數字 (0-4): 直接切換到指定面板"
    echo "- Ctrl+b 然後按 s: 選擇 session"
}

# 主執行函數
main() {
    log_info "開始設定 TMux Main Layout"
    
    check_tmux_environment
    rename_session_to_main_layout
    cleanup_existing_panes
    setup_main_layout
    setup_pane_titles
    show_layout_info
    
    log_success "TMux Main Layout 設定完成！"
}

# 如果直接執行腳本則執行 main 函數
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi