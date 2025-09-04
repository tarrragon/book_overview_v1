#!/bin/bash

# TMux Main Layout 連接腳本
# 統一處理 session 切換和文件載入一致性

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

# 檢查是否已在 TMux 環境中
check_current_tmux_status() {
    if [[ -n "$TMUX" ]]; then
        local current_session=$(tmux display-message -p '#S')
        log_info "已在 TMux 環境中，當前 session: $current_session"
        
        if [[ "$current_session" == "main_layout" ]]; then
            log_success "已在 main_layout session 中"
            return 0
        else
            log_info "當前在 '$current_session' session，將切換到 main_layout"
            return 1
        fi
    else
        log_info "未在 TMux 環境中"
        return 2
    fi
}

# 連接或切換到 main_layout session
connect_to_main_layout() {
    local tmux_status
    check_current_tmux_status
    tmux_status=$?
    
    case $tmux_status in
        0)
            # 已在 main_layout session
            log_success "無需切換 session"
            ;;
        1)
            # 在其他 session 中，需要切換
            log_info "切換到 main_layout session..."
            if tmux has-session -t main_layout 2>/dev/null; then
                tmux switch-client -t main_layout
                log_success "已切換到 main_layout session"
            else
                log_error "main_layout session 不存在"
                return 1
            fi
            ;;
        2)
            # 不在 TMux 環境中
            if tmux has-session -t main_layout 2>/dev/null; then
                log_info "連接到已存在的 main_layout session..."
                tmux attach-session -t main_layout
                log_success "已連接到 main_layout session"
            else
                log_info "建立新的 main_layout session..."
                tmux new-session -s main_layout
                log_success "已建立 main_layout session"
            fi
            ;;
    esac
}

# 設定 TMux 佈局
setup_layout() {
    log_info "執行佈局設定..."
    if ./scripts/setup-tmux-layout.sh; then
        log_success "佈局設定完成"
    else
        log_error "佈局設定失敗"
        return 1
    fi
}

# 檢查面板0中的程序狀態並給予建議
check_pane0_status() {
    local pane0_command=$(tmux display-message -t 0 -p '#{pane_current_command}')
    
    log_info "面板0中運行的程序: $pane0_command"
    
    if [[ "$pane0_command" =~ (bash|zsh|sh|fish)$ ]]; then
        log_warning "面板0中運行的是 shell"
        echo ""
        echo "🎯 重要提醒："
        echo "為確保最佳的開發體驗和文件載入一致性，建議在面板0中："
        echo ""
        echo "1. 啟動 Claude Code: 'claude'"
        echo "2. 確保載入專案關鍵檔案："
        echo "   - CLAUDE.md"
        echo "   - docs/workflows/tdd-collaboration-flow.md"
        echo "   - docs/guidelines/document-responsibilities.md"
        echo "   - docs/workflows/agent-collaboration.md"
        echo "   - docs/project/chrome-extension-specs.md" 
        echo "   - docs/architecture/event-driven-architecture.md"
        echo "   - docs/guidelines/code-quality-examples.md"
        echo ""
        echo "3. 執行 '/startup-check' 進行完整檢查"
    else
        log_success "面板0中運行程序: $pane0_command"
        echo ""
        echo "💡 如果這是 Claude Code，請確認是否已載入專案檔案"
        echo "   可執行 '/startup-check' 進行完整檢查"
    fi
}

# 顯示使用說明
show_usage_info() {
    echo ""
    echo "🚀 TMux Main Layout 使用指南："
    echo ""
    echo "面板配置 (1,2,2 佈局)："
    echo "┌─────────────────────────────────────┐"
    echo "│      面板0: 主要開發工作            │"
    echo "│      (Claude Code 推薦)             │"  
    echo "├─────────────────┬───────────────────┤"
    echo "│    面板1:       │     面板2:        │"
    echo "│   文件更新      │   程式碼品質檢查   │"
    echo "├─────────────────┼───────────────────┤"
    echo "│    面板3:       │     面板4:        │"
    echo "│   Git 操作      │   監控和分析      │"
    echo "└─────────────────┴───────────────────┘"
    echo ""
    echo "快捷鍵："
    echo "- Ctrl+b 然後按數字 (0-4): 直接切換面板"
    echo "- Ctrl+b 然後按方向鍵: 切換面板"
}

# 主執行函數
main() {
    log_info "開始 TMux Main Layout 連接流程..."
    
    # 連接或切換到 main_layout
    connect_to_main_layout
    
    # 設定佈局（如果需要）
    setup_layout
    
    # 檢查面板0狀態並給予建議
    check_pane0_status
    
    # 顯示使用說明
    show_usage_info
    
    log_success "TMux Main Layout 連接完成！"
}

# 如果直接執行腳本則執行 main 函數
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi