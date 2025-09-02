# Claude 指令：Startup-Check

此命令協助您在 Claude Code session 開始時執行完整的環境檢查。

## 使用方法

要執行啟動檢查，輸入：

```
/startup-check
```

## 🚀 系統指令

你是一名 **Claude Code Session 環境檢查專家**，負責確保每個開發 session 都在最佳狀態下啟動。

## 🔍 檢查執行流程

### 1. Git 環境檢查

執行以下指令並分析結果：

```bash
# 檢查當前分支和狀態
git status --porcelain
git branch --show-current
git log --oneline -3

# 檢查遠端同步狀態
git fetch --dry-run
git status -b --ahead-behind
```

**預期結果**：
- 工作目錄乾淨（無未提交變更）
- 在正確的開發分支
- 與遠端同步

### 2. TMux 環境驗證與設定

```bash
# 檢查 TMux 環境和 session 狀態
if [[ -n "$TMUX" ]]; then
    echo "✅ 已在 TMux 環境中"
    current_session=$(tmux display-message -p '#S')
    echo "當前 Session: $current_session"
    
    # 執行 TMux 佈局設定腳本
    echo "🔧 執行 TMux 佈局設定..."
    ./scripts/setup-tmux-layout.sh
    
    # 驗證設定結果
    pane_count=$(tmux list-panes | wc -l | tr -d ' ')
    echo "面板數量: $pane_count"
    
    if [[ $pane_count -eq 5 ]]; then
        echo "✅ TMux 佈局設定完成 (1,2,2 佈局)"
        
        # 檢查面板0的程序狀態
        pane0_command=$(tmux display-message -t 0 -p '#{pane_current_command}')
        echo "面板0運行程序: $pane0_command"
        
        if [[ "$pane0_command" =~ (bash|zsh|sh|fish)$ ]]; then
            echo "⚠️  面板0運行的是 shell，建議啟動 Claude Code"
            echo "💡 在面板0中執行 'claude' 命令以獲得最佳開發體驗"
        fi
    else
        echo "⚠️  面板數量不正確，請檢查佈局設定"
    fi
else
    echo "❌ 未在 TMux 環境中"
    
    # 檢查是否已有 main_layout session 存在
    if tmux has-session -t main_layout 2>/dev/null; then
        echo "📋 發現已存在的 main_layout session"
        echo "💡 執行以下指令切換到該 session："
        echo "   tmux attach-session -t main_layout"
        echo "   或在 TMux 內執行: tmux switch-client -t main_layout"
    else
        echo "💡 請執行以下指令建立新的 TMux 環境："
        echo "   tmux new-session -s main_layout"
    fi
    echo "   然後重新執行 /startup-check"
fi
```

**預期結果**：
- 自動重新命名當前 session 為 `main_layout`
- 自動設定 5 個面板 (0-4) 的 1,2,2 佈局
- 每個面板都有明確的功能說明

### 3. 專案檔案載入確認

```bash
# 檢查關鍵專案檔案
echo "📋 檢查專案檔案存在性..."
if [[ -f "CLAUDE.md" ]]; then
    echo "✅ CLAUDE.md 存在"
    claude_mod_date=$(stat -c "%Y" CLAUDE.md 2>/dev/null || stat -f "%m" CLAUDE.md)
    echo "   修改時間: $(date -r $claude_mod_date)"
else
    echo "❌ CLAUDE.md 缺失"
fi

if [[ -f "docs/todolist.md" ]]; then
    echo "✅ docs/todolist.md 存在"
else
    echo "⚠️  docs/todolist.md 不存在"
fi

# 檢查 Claude Code 是否已載入專案檔案
echo ""
echo "🔍 Claude Code 檔案載入狀態檢查:"
echo "⚠️  重要提醒: 如果您是透過 tmux attach 進入已存在的 session，"
echo "   請確認 Claude Code 已正確載入以下關鍵檔案："
echo ""
echo "   📄 必須載入的檔案："
echo "   - CLAUDE.md (主要開發規範)"
echo "   - docs/workflows/tdd-collaboration-flow.md"
echo "   - docs/guidelines/document-responsibilities.md" 
echo "   - docs/workflows/agent-collaboration.md"
echo "   - docs/project/chrome-extension-specs.md"
echo "   - docs/architecture/event-driven-architecture.md"
echo ""
echo "💡 如果 Claude Code 尚未載入這些檔案，建議："
echo "   1. 在面板0中重新啟動 Claude Code"
echo "   2. 或請 Claude Code 重新讀取專案檔案"
```

**預期結果**：
- 所有關鍵檔案存在且可讀取
- CLAUDE.md 包含最新規範
- Claude Code 已正確載入專案文件上下文

### 4. 開發狀態檢查

```bash
# 檢查依賴項安裝狀態
npm list --depth=0 --production=false 2>/dev/null | head -10

# 檢查測試狀態
npm run test 2>&1 | tail -10

# 檢查建置狀態
npm run lint 2>&1 | head -10
```

**預期結果**：
- 依賴項正確安裝
- 瞭解當前測試通過率
- 瞭解程式碼品質狀態

## 📊 報告格式

檢查完成後，提供以下格式的狀態報告：

### ✅ 環境檢查報告

**Git 狀態**：
- 分支：[當前分支名稱]
- 狀態：[clean/有未提交變更]
- 同步：[與遠端同步狀態]

**TMux 環境**：
- Session：[session名稱]
- 面板數量：[面板數量]
- 佈局：[佈局狀態]

**專案檔案**：
- 關鍵檔案：[存在狀態]
- CLAUDE.md：[最後修改時間]
- Todolist：[任務數量統計]

**開發環境**：
- 依賴項：[安裝狀態]
- 測試：[通過率/失敗數量]
- 程式碼品質：[lint 錯誤數量]

## ⚠️ 問題處理指引

### 常見問題與解決方案

**Git 狀態異常**：
```bash
# 如有未提交變更，詢問是否提交
git add -A
git commit -m "session startup: commit pending changes"
```

**TMux 環境問題**：
```bash
# 如果不在 TMux 環境中
tmux new-session -s main_layout

# 如果在 TMux 但非 main_layout session
# startup-check 會自動執行 setup-tmux-layout.sh 進行設定

# 手動執行佈局設定 (如有需要)
./scripts/setup-tmux-layout.sh
```

**檔案載入失敗**：
```bash
# 檢查檔案權限和存在性
ls -la [問題檔案]
```

**開發環境問題**：
```bash
# 重新安裝依賴項
npm install --legacy-peer-deps
```

