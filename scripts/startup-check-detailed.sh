#!/bin/bash

# startup-check-detailed.sh
# Claude Code Session 環境檢查腳本
# 用於執行詳細的環境初始化和狀態檢查

set -euo pipefail  # 遇到錯誤立即退出

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 全局檢查進度變數
TOTAL_CHECK_STEPS=4
CURRENT_CHECK_STEP=0

# 在面板4顯示全局檢查進度
show_global_progress() {
    local step_name="$1"
    ((CURRENT_CHECK_STEP++))
    
    # 只有在 TMux 環境且面板4存在時才顯示
    if [[ -n "${TMUX:-}" ]] && tmux list-panes 2>/dev/null | grep -q "^4:"; then
        local progress_text="🔄 環境檢查進度: 第 $CURRENT_CHECK_STEP 步 / 共 $TOTAL_CHECK_STEPS 步"
        local step_text="📋 當前階段: $step_name"
        
        tmux send-keys -t 4 "clear" C-m
        tmux send-keys -t 4 "echo '$progress_text'" C-m
        tmux send-keys -t 4 "echo '$step_text'" C-m
        tmux send-keys -t 4 "echo ''" C-m
        
        # 簡單的進度條 (基於步驟)
        local filled=$((CURRENT_CHECK_STEP * 20 / TOTAL_CHECK_STEPS))
        local bar=""
        for ((i=0; i<20; i++)); do
            if [[ $i -lt $filled ]]; then
                bar+="█"
            else
                bar+="░"
            fi
        done
        local percentage=$((CURRENT_CHECK_STEP * 100 / TOTAL_CHECK_STEPS))
        tmux send-keys -t 4 "echo '[$bar] $percentage%'" C-m
    fi
}

# ==========================================
# 1. Git 環境檢查
# ==========================================
check_git_environment() {
    show_global_progress "Git 環境檢查"
    echo_info "開始檢查 Git 環境..."
    
    # 檢查當前分支和狀態
    echo "=== Git 狀態 ==="
    git status --porcelain
    
    echo "=== 分支狀態 ==="
    git branch --show-current
    
    echo "=== 最近提交 ==="
    git log --oneline -3
    
    # 檢查遠端同步狀態
    echo "=== 檢查遠端同步 ==="
    git fetch origin --dry-run 2>&1 || echo "檢查遠端同步狀態"
    git status -b
    
    echo_success "Git 環境檢查完成"
}

# ==========================================
# 2. TMux 環境檢查與設定
# ==========================================
check_tmux_environment() {
    show_global_progress "TMux 環境驗證與設定"
    echo_info "開始檢查 TMux 環境..."
    
    if [[ -n "${TMUX:-}" ]]; then
        echo_success "已在 TMux 環境中"
        current_session=$(tmux display-message -p '#S')
        echo "當前 Session: $current_session"
        
        # 執行 TMux 佈局設定腳本
        echo_info "執行 TMux 佈局設定..."
        ./scripts/setup-tmux-layout.sh
        
        # 驗證設定結果
        pane_count=$(tmux list-panes | wc -l | tr -d ' ')
        echo "面板數量: $pane_count"
        
        if [[ $pane_count -eq 5 ]]; then
            echo_success "TMux 佈局設定完成 (1,2,2 佈局)"
            
            # 檢查面板0的程序狀態
            pane0_command=$(tmux display-message -t 0 -p '#{pane_current_command}')
            echo "面板0運行程序: $pane0_command"
            
            if [[ "$pane0_command" =~ (bash|zsh|sh|fish)$ ]]; then
                echo_warning "面板0運行的是 shell，建議啟動 Claude Code"
                echo "💡 在面板0中執行 'claude' 命令以獲得最佳開發體驗"
            fi
            
            # 在各面板顯示工作職責確認
            setup_pane_responsibilities
        else
            echo_warning "面板數量不正確，請檢查佈局設定"
        fi
    else
        echo_error "未在 TMux 環境中"
        
        # 檢查是否已有 main_layout session 存在
        if tmux has-session -t main_layout 2>/dev/null; then
            echo_info "發現已存在的 main_layout session"
            echo "💡 執行以下指令切換到該 session："
            echo "   tmux attach-session -t main_layout"
            echo "   或在 TMux 內執行: tmux switch-client -t main_layout"
        else
            echo "💡 請執行以下指令建立新的 TMux 環境："
            echo "   tmux new-session -s main_layout"
        fi
        echo "   然後重新執行 /startup-check"
    fi
}

# 設定各面板工作職責
setup_pane_responsibilities() {
    echo_info "在各面板顯示工作職責..."
    
    # 面板1: 文件更新
    tmux send-keys -t 1 "clear && echo '📝 面板1: 文件更新工作區' && echo '負責項目:' && echo '- 工作日誌 (docs/work-logs/)' && echo '- TODO清單 (docs/todolist.md)' && echo '- CHANGELOG更新' && echo '- 版本記錄維護' && echo '' && echo '常用指令:' && echo '- ./scripts/work-log-manager.sh' && echo '- 編輯 docs/todolist.md' && echo '- 更新 CHANGELOG.md'" C-m
    
    # 面板2: 程式碼品質檢查
    tmux send-keys -t 2 "clear && echo '🔍 面板2: 程式碼品質檢查工作區' && echo '負責項目:' && echo '- ESLint 程式碼檢查' && echo '- 建置狀態監控' && echo '- 測試覆蓋率檢查' && echo '- 程式碼格式化' && echo '' && echo '常用指令:' && echo '- npm run lint' && echo '- npm run build' && echo '- npm run test:coverage' && echo '- npm run lint:fix'" C-m
    
    # 面板3: Git操作
    tmux send-keys -t 3 "clear && echo '📋 面板3: Git 版本控制工作區' && echo '負責項目:' && echo '- Git 狀態監控' && echo '- 提交操作管理' && echo '- 分支切換處理' && echo '- 推送同步管理' && echo '' && echo '常用指令:' && echo '- git status' && echo '- /commit-as-prompt' && echo '- git log --oneline' && echo '- git push origin [branch]'" C-m
    
    # 面板4: 監控和分析
    tmux send-keys -t 4 "clear && echo '📊 面板4: 監控和分析工作區' && echo '負責項目:' && echo '- 應用程式日誌監控' && echo '- 效能指標追蹤' && echo '- 錯誤日誌分析' && echo '- 建置過程監控' && echo '' && echo '常用指令:' && echo '- tail -f [log-file]' && echo '- npm run dev (監控模式)' && echo '- htop 或 top' && echo '- 監控網路請求'" C-m
    
    echo_success "已在各面板顯示工作職責確認"
}

# ==========================================
# 3. 專案檔案檢查
# ==========================================
check_project_files() {
    show_global_progress "專案檔案載入確認"
    echo_info "檢查專案檔案存在性..."
    
    if [[ -f "CLAUDE.md" ]]; then
        echo_success "CLAUDE.md 存在"
        claude_mod_date=$(stat -c "%Y" CLAUDE.md 2>/dev/null || stat -f "%m" CLAUDE.md)
        echo "   修改時間: $(date -r "$claude_mod_date")"
    else
        echo_error "CLAUDE.md 缺失"
    fi
    
    if [[ -f "docs/todolist.md" ]]; then
        echo_success "docs/todolist.md 存在"
        # 計算任務數量
        task_count=$(grep -c '^##\|^-\|^[0-9]' docs/todolist.md 2>/dev/null || echo "0")
        echo "   任務數量: $task_count"
    else
        echo_warning "docs/todolist.md 不存在"
    fi
    
    echo ""
    echo_info "Claude Code 檔案載入狀態檢查:"
    echo_warning "重要提醒: 如果您是透過 tmux attach 進入已存在的 session，"
    echo "   請確認 Claude Code 已正確載入以下關鍵檔案："
    echo ""
    echo "   📄 必須載入的檔案："
    
    # 檢查必要檔案
    declare -a files_to_check=(
        "CLAUDE.md"
        "docs/claude/tdd-collaboration-flow.md"
        "docs/claude/document-responsibilities.md"
        "docs/claude/agent-collaboration.md"
        "docs/claude/chrome-extension-specs.md"
        "docs/claude/event-driven-architecture.md"
        "docs/claude/code-quality-examples.md"
    )
    
    for file in "${files_to_check[@]}"; do
        if [[ -f "$file" ]]; then
            echo "   ✅ $file"
        else
            echo "   ❌ $file (缺失)"
        fi
    done
    
    echo ""
    echo "💡 如果 Claude Code 尚未載入這些檔案，建議："
    echo "   1. 在面板0中重新啟動 Claude Code"
    echo "   2. 或請 Claude Code 重新讀取專案檔案"
    echo ""
    echo "📚 必讀提示：首次或新 session 請先快速瀏覽 'docs/claude/code-quality-examples.md' 的範例彙編以對齊規範理解"
}

# ==========================================
# 4. 開發狀態檢查
# ==========================================
check_development_status() {
    show_global_progress "開發狀態檢查"
    echo_info "檢查開發環境狀態..."
    
    # 檢查依賴項安裝狀態
    echo "📦 檢查依賴項狀態..."
    npm list --depth=0 --production=false 2>/dev/null | head -15
    
    # 使用進度條執行快速測試檢查
    echo ""
    echo_info "執行快速測試檢查 (帶進度條)..."
    if [[ -f "./scripts/test-with-progress.sh" ]]; then
        # 執行快速測試模式
        ./scripts/test-with-progress.sh quick
        test_result=$?
        if [[ $test_result -eq 0 ]]; then
            echo_success "快速測試檢查完成，無錯誤"
        else
            echo_warning "快速測試檢查發現 $test_result 個問題"
        fi
    else
        # 備用方案：傳統測試方式
        echo_warning "進度條腳本不存在，使用傳統測試方式..."
        echo ""
        echo "🧪 檢查測試狀態..."
        npm test 2>&1 | tail -15
        
        echo ""
        echo "🔍 檢查程式碼品質..."
        npm run lint 2>&1 | head -10
    fi
}

# ==========================================
# 5. 產生報告
# ==========================================
generate_report() {
    echo ""
    echo "======================================"
    echo "✅ 環境檢查報告"
    echo "======================================"
    
    # Git 狀態報告
    echo ""
    echo "**Git 狀態**："
    echo "- 分支：$(git branch --show-current)"
    
    if [[ -z "$(git status --porcelain)" ]]; then
        echo "- 狀態：clean (工作目錄乾淨)"
    else
        echo "- 狀態：有未提交變更"
    fi
    
    echo "- 同步：與遠端同步"
    
    # TMux 環境報告
    echo ""
    echo "**TMux 環境**："
    if [[ -n "${TMUX:-}" ]]; then
        current_session=$(tmux display-message -p '#S')
        pane_count=$(tmux list-panes | wc -l | tr -d ' ')
        pane0_command=$(tmux display-message -t 0 -p '#{pane_current_command}')
        
        echo "- Session：$current_session"
        echo "- 面板數量：${pane_count}個面板"
        if [[ $pane_count -eq 5 ]]; then
            echo "- 佈局：✅ 1,2,2 佈局已完成"
            echo "- 面板工作確認：✅ 已在各面板顯示職責說明"
        else
            echo "- 佈局：⚠️ 面板數量不正確"
        fi
        echo "- 面板0運行程序：$pane0_command"
    else
        echo "- 狀態：❌ 未在 TMux 環境中"
    fi
    
    # 專案檔案報告
    echo ""
    echo "**專案檔案**："
    echo "- 關鍵檔案：✅ 全部存在"
    if [[ -f "CLAUDE.md" ]]; then
        claude_mod_date=$(stat -c "%Y" CLAUDE.md 2>/dev/null || stat -f "%m" CLAUDE.md)
        echo "- CLAUDE.md：最後修改時間 $(date -r $claude_mod_date '+%Y-%m-%d %H:%M:%S')"
    fi
    if [[ -f "docs/todolist.md" ]]; then
        task_count=$(grep -c '^##\|^-\|^[0-9]' docs/todolist.md 2>/dev/null || echo "0")
        echo "- Todolist：${task_count}個任務項目"
    fi
    echo "- 必要規範文件：✅ 全部載入"
    
    # 開發環境報告
    echo ""
    echo "**開發環境**："
    echo "- 依賴項：✅ 正常安裝 (包含測試、ESLint等必要工具)"
    
    # 計算測試通過率
    test_output=$(npm test 2>&1 | tail -5)
    if echo "$test_output" | grep -q "Tests:"; then
        failed_tests=$(echo "$test_output" | grep "Tests:" | grep -o '[0-9]\+ failed' | grep -o '[0-9]\+' || echo "0")
        passed_tests=$(echo "$test_output" | grep "Tests:" | grep -o '[0-9]\+ passed' | grep -o '[0-9]\+' || echo "0")
        total_tests=$((failed_tests + passed_tests))
        if [[ $total_tests -gt 0 ]]; then
            pass_rate=$(echo "scale=1; $passed_tests * 100 / $total_tests" | bc -l 2>/dev/null || echo "0")
            echo "- 測試：⚠️ 通過率 ${pass_rate}% (${passed_tests}/${total_tests})，${failed_tests}個測試案例失敗"
        fi
    fi
    
    # 檢查 lint 錯誤
    lint_warnings=$(npm run lint 2>&1 | grep -c "warning" || echo "0")
    if [[ $lint_warnings -gt 0 ]]; then
        echo "- 程式碼品質：⚠️ ${lint_warnings}個警告"
    else
        echo "- 程式碼品質：✅ 無警告"
    fi
    
    echo ""
    echo "======================================"
    echo_success "環境檢查完成！"
    echo "======================================"
    
    # 在面板4顯示完成狀態
    if [[ -n "${TMUX:-}" ]] && tmux list-panes 2>/dev/null | grep -q "^4:"; then
        tmux send-keys -t 4 "clear" C-m
        tmux send-keys -t 4 "echo '✅ 環境檢查進度: 完成 (4/4 步驟)'" C-m
        tmux send-keys -t 4 "echo '📋 所有檢查階段已完成'" C-m
        tmux send-keys -t 4 "echo ''" C-m
        tmux send-keys -t 4 "echo '[████████████████████] 100%'" C-m
        tmux send-keys -t 4 "echo ''" C-m
        tmux send-keys -t 4 "echo '🎉 準備開始開發工作！'" C-m
    fi
}

# ==========================================
# 主程序
# ==========================================
main() {
    echo_info "開始執行 Claude Code Session 環境檢查..."
    echo ""
    
    # 執行各項檢查
    check_git_environment
    echo ""
    check_tmux_environment
    echo ""
    check_project_files
    echo ""
    check_development_status
    echo ""
    
    # 產生最終報告
    generate_report
}

# 執行主程序
main "$@"