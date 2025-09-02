#!/bin/bash

# tmux-collaboration.sh
# TMux 面板協作系統 - 面板0分派工作給面板2的Claude實例

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# 協作狀態檔案
COLLAB_STATUS_FILE="/tmp/tmux_collaboration_status"
TASK_QUEUE_FILE="/tmp/tmux_task_queue"
PANE2_READY_FILE="/tmp/pane2_claude_ready"

# 檢查TMux環境和面板狀態
check_tmux_environment() {
    if [[ -z "$TMUX" ]]; then
        echo -e "${RED}[ERROR]${NC} 此功能需要在TMux環境中執行"
        exit 1
    fi
    
    # 檢查面板2是否存在
    if ! tmux list-panes 2>/dev/null | grep -q "^2:"; then
        echo -e "${RED}[ERROR]${NC} 面板2不存在，請確認TMux佈局正確"
        exit 1
    fi
    
    echo -e "${GREEN}[INFO]${NC} TMux協作環境檢查通過"
}

# 檢查面板2的Claude狀態
check_pane2_claude_status() {
    local pane2_command=$(tmux display-message -t 2 -p '#{pane_current_command}')
    
    if [[ "$pane2_command" == "node" ]]; then
        echo -e "${GREEN}[INFO]${NC} 面板2已運行Claude Code"
        return 0
    else
        echo -e "${YELLOW}[WARNING]${NC} 面板2未運行Claude Code (當前: $pane2_command)"
        return 1
    fi
}

# 自動啟動面板2的Claude Code
auto_start_pane2_claude() {
    echo -e "${BLUE}[INFO]${NC} 正在自動啟動面板2的Claude Code..."
    
    # 檢查面板2當前狀態
    local pane2_command=$(tmux display-message -t 2 -p '#{pane_current_command}')
    
    if [[ "$pane2_command" == "node" ]]; then
        echo -e "${GREEN}[INFO]${NC} 面板2已運行Claude Code，無需啟動"
        return 0
    fi
    
    # 在面板4顯示啟動狀態
    if tmux list-panes 2>/dev/null | grep -q "^4:"; then
        tmux send-keys -t 4 "clear" C-m
        tmux send-keys -t 4 "echo '🚀 正在啟動面板2的Claude Code...'" C-m
        tmux send-keys -t 4 "echo '⏳ 請稍候，預計需要10-15秒'" C-m
    fi
    
    # 清空面板2並啟動Claude
    tmux send-keys -t 2 "clear" C-m
    tmux send-keys -t 2 "# 自動啟動Claude Code協作模式" C-m
    tmux send-keys -t 2 "claude" C-m
    
    # 等待Claude啟動
    echo -e "${BLUE}[INFO]${NC} 等待Claude Code啟動 (最多30秒)..."
    local wait_time=0
    local max_wait=30
    
    while [[ $wait_time -lt $max_wait ]]; do
        sleep 2
        wait_time=$((wait_time + 2))
        
        local current_command=$(tmux display-message -t 2 -p '#{pane_current_command}')
        if [[ "$current_command" == "node" ]]; then
            echo -e "${GREEN}[SUCCESS]${NC} Claude Code已成功啟動 (耗時: ${wait_time}秒)"
            
            # 更新面板4狀態
            if tmux list-panes 2>/dev/null | grep -q "^4:"; then
                tmux send-keys -t 4 "clear" C-m
                tmux send-keys -t 4 "echo '✅ Claude Code啟動成功 (${wait_time}秒)'" C-m
                tmux send-keys -t 4 "echo '🤝 協作模式準備就緒'" C-m
            fi
            
            # 給Claude一點時間完全載入
            sleep 3
            return 0
        fi
        
        # 更新等待進度
        if tmux list-panes 2>/dev/null | grep -q "^4:"; then
            local progress=$((wait_time * 100 / max_wait))
            tmux send-keys -t 4 "clear" C-m
            tmux send-keys -t 4 "echo '🚀 正在啟動面板2的Claude Code...'" C-m
            tmux send-keys -t 4 "echo '⏳ 啟動進度: ${wait_time}/${max_wait}秒 (${progress}%)'" C-m
        fi
    done
    
    # 啟動超時
    echo -e "${RED}[ERROR]${NC} Claude Code啟動超時 (超過${max_wait}秒)"
    if tmux list-panes 2>/dev/null | grep -q "^4:"; then
        tmux send-keys -t 4 "clear" C-m
        tmux send-keys -t 4 "echo '❌ Claude Code啟動超時'" C-m
        tmux send-keys -t 4 "echo '🔧 請手動檢查面板2狀態'" C-m
    fi
    return 1
}

# 初始化面板2的Claude協作環境
init_pane2_claude() {
    echo -e "${BLUE}[INFO]${NC} 初始化面板2的Claude協作環境..."
    
    # 檢查面板2的Claude狀態，如果沒有運行則自動啟動
    if ! check_pane2_claude_status; then
        echo -e "${BLUE}[INFO]${NC} 偵測到面板2未運行Claude Code，將自動啟動..."
        
        # 詢問用戶是否要自動啟動
        echo -e "${CYAN}[QUESTION]${NC} 是否要自動啟動面板2的Claude Code? [Y/n]"
        read -t 10 -r response
        
        # 預設為 Yes (10秒無回應時)
        if [[ -z "$response" ]] || [[ "$response" =~ ^[Yy]$ ]]; then
            echo -e "${GREEN}[INFO]${NC} 開始自動啟動..."
            if ! auto_start_pane2_claude; then
                echo -e "${RED}[ERROR]${NC} 自動啟動失敗，請手動啟動面板2的Claude Code:"
                echo "  1. 切換到面板2: Ctrl+b 然後按 2"
                echo "  2. 執行指令: claude"
                echo "  3. 等待Claude Code啟動完成"
                echo "  4. 再次執行: ./scripts/tmux-collaboration.sh init"
                return 1
            fi
        else
            echo -e "${YELLOW}[INFO]${NC} 已選擇手動啟動，請手動啟動面板2的Claude Code:"
            echo "  1. 切換到面板2: Ctrl+b 然後按 2"
            echo "  2. 執行指令: claude"
            echo "  3. 等待Claude Code啟動完成"
            echo "  4. 再次執行: ./scripts/tmux-collaboration.sh init"
            return 1
        fi
    fi
    
    # 在面板2設定協作環境標誌
    tmux send-keys -t 2 "" C-m
    tmux send-keys -t 2 "# 🤝 面板2協作模式已啟動" C-m
    tmux send-keys -t 2 "# 📋 等待面板0分派任務..." C-m
    tmux send-keys -t 2 "" C-m
    
    # 創建狀態檔案
    echo "pane2_ready" > "$PANE2_READY_FILE"
    echo "idle" > "$COLLAB_STATUS_FILE"
    
    # 在面板4顯示協作就緒狀態
    if tmux list-panes 2>/dev/null | grep -q "^4:"; then
        tmux send-keys -t 4 "clear" C-m
        tmux send-keys -t 4 "echo '🤝 TMux面板協作系統已啟動'" C-m
        tmux send-keys -t 4 "echo '✅ 面板2: Claude Code 準備就緒'" C-m
        tmux send-keys -t 4 "echo '⏳ 狀態: 等待任務分派'" C-m
        tmux send-keys -t 4 "echo ''" C-m
        tmux send-keys -t 4 "echo '可用任務類型:'" C-m
        tmux send-keys -t 4 "echo '- code-review (程式碼審查)'" C-m
        tmux send-keys -t 4 "echo '- test-analysis (測試分析)'" C-m
        tmux send-keys -t 4 "echo '- documentation (文件撰寫)'" C-m
        tmux send-keys -t 4 "echo '- refactoring (重構任務)'" C-m
        tmux send-keys -t 4 "echo '- custom (自定義任務)'" C-m
    fi
    
    echo -e "${GREEN}[SUCCESS]${NC} 面板2協作環境初始化完成"
    echo -e "${CYAN}[INFO]${NC} 現在可以使用以下指令分派任務:"
    echo "  ./scripts/tmux-collaboration.sh code-review '<檔案>' '<重點>'"
    echo "  ./scripts/tmux-collaboration.sh test-analysis '<檔案>' '<類型>'"
    echo "  或使用 Claude 指令: /delegate <任務類型> [參數...]"
    
    return 0
}

# 分派工作給面板2
delegate_task() {
    local task_type="$1"
    local task_description="$2"
    local additional_context="$3"
    
    if [[ ! -f "$PANE2_READY_FILE" ]]; then
        echo -e "${RED}[ERROR]${NC} 面板2協作環境未初始化，請先執行: ./scripts/tmux-collaboration.sh init"
        return 1
    fi
    
    echo -e "${BLUE}[INFO]${NC} 分派任務給面板2: $task_type"
    
    # 更新協作狀態
    echo "working" > "$COLLAB_STATUS_FILE"
    
    # 在面板4顯示協作狀態
    if tmux list-panes 2>/dev/null | grep -q "^4:"; then
        tmux send-keys -t 4 "clear" C-m
        tmux send-keys -t 4 "echo '🤝 TMux 面板協作模式'" C-m
        tmux send-keys -t 4 "echo '📋 任務類型: $task_type'" C-m
        tmux send-keys -t 4 "echo '⚡ 狀態: 面板2執行中...'" C-m
        tmux send-keys -t 4 "echo ''" C-m
        tmux send-keys -t 4 "echo '面板分工:'" C-m
        tmux send-keys -t 4 "echo '- 面板0: 主要開發 (分派任務)'" C-m
        tmux send-keys -t 4 "echo '- 面板2: 協作執行 ($task_type)'" C-m
    fi
    
    # 根據任務類型生成相應的指令
    case "$task_type" in
        "code-review")
            delegate_code_review "$task_description" "$additional_context"
            ;;
        "test-analysis")
            delegate_test_analysis "$task_description" "$additional_context"
            ;;
        "documentation")
            delegate_documentation "$task_description" "$additional_context"
            ;;
        "refactoring")
            delegate_refactoring "$task_description" "$additional_context"
            ;;
        "custom")
            delegate_custom_task "$task_description" "$additional_context"
            ;;
        *)
            echo -e "${RED}[ERROR]${NC} 不支援的任務類型: $task_type"
            return 1
            ;;
    esac
    
    echo -e "${GREEN}[SUCCESS]${NC} 任務已分派給面板2"
}

# 程式碼審查任務
delegate_code_review() {
    local files="$1"
    local focus_areas="$2"
    
    tmux send-keys -t 2 "clear" C-m
    tmux send-keys -t 2 "# 🔍 程式碼審查任務 (來自面板0)" C-m
    tmux send-keys -t 2 "# 審查檔案: $files" C-m
    if [[ -n "$focus_areas" ]]; then
        tmux send-keys -t 2 "# 重點關注: $focus_areas" C-m
    fi
    tmux send-keys -t 2 "" C-m
    
    # 發送實際的審查請求
    local review_prompt="請協助進行程式碼審查，檢查以下檔案: $files"
    if [[ -n "$focus_areas" ]]; then
        review_prompt="$review_prompt。請特別關注: $focus_areas"
    fi
    review_prompt="$review_prompt。請提供詳細的審查報告，包括潛在問題、改善建議和最佳實踐建議。"
    
    tmux send-keys -t 2 "$review_prompt" C-m
}

# 測試分析任務
delegate_test_analysis() {
    local test_files="$1"
    local analysis_type="$2"
    
    tmux send-keys -t 2 "clear" C-m
    tmux send-keys -t 2 "# 🧪 測試分析任務 (來自面板0)" C-m
    tmux send-keys -t 2 "# 分析檔案: $test_files" C-m
    if [[ -n "$analysis_type" ]]; then
        tmux send-keys -t 2 "# 分析類型: $analysis_type" C-m
    fi
    tmux send-keys -t 2 "" C-m
    
    local analysis_prompt="請分析以下測試檔案: $test_files"
    if [[ -n "$analysis_type" ]]; then
        analysis_prompt="$analysis_prompt，重點進行 $analysis_type 分析"
    fi
    analysis_prompt="$analysis_prompt。請提供測試覆蓋率分析、測試案例品質評估，以及改善建議。"
    
    tmux send-keys -t 2 "$analysis_prompt" C-m
}

# 文件撰寫任務
delegate_documentation() {
    local doc_type="$1"
    local target_files="$2"
    
    tmux send-keys -t 2 "clear" C-m
    tmux send-keys -t 2 "# 📚 文件撰寫任務 (來自面板0)" C-m
    tmux send-keys -t 2 "# 文件類型: $doc_type" C-m
    if [[ -n "$target_files" ]]; then
        tmux send-keys -t 2 "# 目標檔案: $target_files" C-m
    fi
    tmux send-keys -t 2 "" C-m
    
    local doc_prompt="請協助撰寫 $doc_type 文件"
    if [[ -n "$target_files" ]]; then
        doc_prompt="$doc_prompt，針對以下檔案: $target_files"
    fi
    doc_prompt="$doc_prompt。請遵循專案的文件規範，提供清晰、完整的文件內容。"
    
    tmux send-keys -t 2 "$doc_prompt" C-m
}

# 重構任務
delegate_refactoring() {
    local target_code="$1"
    local refactor_goal="$2"
    
    tmux send-keys -t 2 "clear" C-m
    tmux send-keys -t 2 "# 🔧 程式碼重構任務 (來自面板0)" C-m
    tmux send-keys -t 2 "# 目標程式碼: $target_code" C-m
    if [[ -n "$refactor_goal" ]]; then
        tmux send-keys -t 2 "# 重構目標: $refactor_goal" C-m
    fi
    tmux send-keys -t 2 "" C-m
    
    local refactor_prompt="請協助重構以下程式碼: $target_code"
    if [[ -n "$refactor_goal" ]]; then
        refactor_prompt="$refactor_prompt，重構目標: $refactor_goal"
    fi
    refactor_prompt="$refactor_prompt。請提供改善後的程式碼、重構理由和相關測試更新建議。"
    
    tmux send-keys -t 2 "$refactor_prompt" C-m
}

# 自定義任務
delegate_custom_task() {
    local task_description="$1"
    local additional_context="$2"
    
    tmux send-keys -t 2 "clear" C-m
    tmux send-keys -t 2 "# ⚡ 自定義任務 (來自面板0)" C-m
    tmux send-keys -t 2 "# 任務描述: $task_description" C-m
    if [[ -n "$additional_context" ]]; then
        tmux send-keys -t 2 "# 額外背景: $additional_context" C-m
    fi
    tmux send-keys -t 2 "" C-m
    
    tmux send-keys -t 2 "$task_description" C-m
}

# 檢查協作狀態
check_collaboration_status() {
    if [[ ! -f "$COLLAB_STATUS_FILE" ]]; then
        echo -e "${YELLOW}[INFO]${NC} 協作系統尚未初始化"
        return 1
    fi
    
    local status=$(cat "$COLLAB_STATUS_FILE")
    case "$status" in
        "idle")
            echo -e "${GREEN}[INFO]${NC} 面板2協作系統就緒，等待任務分派"
            ;;
        "working")
            echo -e "${BLUE}[INFO]${NC} 面板2正在執行協作任務"
            ;;
        *)
            echo -e "${YELLOW}[INFO]${NC} 協作狀態: $status"
            ;;
    esac
    
    return 0
}

# 清理協作環境
cleanup_collaboration() {
    echo -e "${BLUE}[INFO]${NC} 清理協作環境..."
    
    rm -f "$COLLAB_STATUS_FILE" "$TASK_QUEUE_FILE" "$PANE2_READY_FILE"
    
    if tmux list-panes 2>/dev/null | grep -q "^4:"; then
        tmux send-keys -t 4 "clear" C-m
        tmux send-keys -t 4 "echo '📊 面板4: 監控和分析工作區'" C-m
        tmux send-keys -t 4 "echo '協作模式已結束'" C-m
    fi
    
    echo -e "${GREEN}[SUCCESS]${NC} 協作環境清理完成"
}

# 顯示使用說明
show_help() {
    echo "TMux面板協作系統 - 讓面板0和面板2的Claude實例協作開發"
    echo ""
    echo "使用方法:"
    echo "  $0 <指令> [參數...]"
    echo ""
    echo "可用指令:"
    echo "  init                     初始化面板2協作環境"
    echo "  status                   檢查協作狀態"
    echo "  cleanup                  清理協作環境"
    echo ""
    echo "任務分派指令:"
    echo "  code-review <檔案> [重點]     分派程式碼審查任務"
    echo "  test-analysis <檔案> [類型]   分派測試分析任務" 
    echo "  documentation <類型> [檔案]   分派文件撰寫任務"
    echo "  refactoring <程式碼> [目標]   分派重構任務"
    echo "  custom <描述> [背景]          分派自定義任務"
    echo ""
    echo "範例:"
    echo "  $0 init"
    echo "  $0 code-review 'src/main.js' '效能和安全性'"
    echo "  $0 test-analysis 'tests/unit/' '覆蓋率分析'"
    echo "  $0 documentation 'API文件' 'src/api/'"
    echo ""
}

# 主程序
main() {
    local command="$1"
    
    if [[ -z "$command" ]] || [[ "$command" == "--help" ]] || [[ "$command" == "-h" ]]; then
        show_help
        exit 0
    fi
    
    # 檢查TMux環境
    check_tmux_environment
    
    case "$command" in
        "init")
            init_pane2_claude
            ;;
        "status")
            check_collaboration_status
            ;;
        "cleanup")
            cleanup_collaboration
            ;;
        "code-review")
            delegate_task "code-review" "$2" "$3"
            ;;
        "test-analysis")
            delegate_task "test-analysis" "$2" "$3"
            ;;
        "documentation")
            delegate_task "documentation" "$2" "$3"
            ;;
        "refactoring")
            delegate_task "refactoring" "$2" "$3"
            ;;
        "custom")
            delegate_task "custom" "$2" "$3"
            ;;
        *)
            echo -e "${RED}[ERROR]${NC} 未知指令: $command"
            echo "執行 '$0 --help' 查看可用指令"
            exit 1
            ;;
    esac
}

# 執行主程序
main "$@"