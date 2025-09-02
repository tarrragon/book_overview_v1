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

### 2. 執行環境檢查腳本

執行專用的環境檢查腳本，該腳本會自動處理所有複雜的檢查邏輯：

```bash
# 執行完整的環境檢查腳本
./scripts/startup-check-detailed.sh
```

這個腳本會執行以下檢查：

**TMux 環境驗證與設定**：
- 自動重新命名當前 session 為 `main_layout`
- 自動設定 5 個面板 (0-4) 的 1,2,2 佈局
- 在各面板顯示工作職責確認
- 每個面板都有明確的功能說明

**專案檔案載入確認**：
- 檢查所有關鍵檔案存在性
- 驗證 CLAUDE.md 包含最新規範
- 確認 Claude Code 已正確載入專案文件上下文

**開發狀態檢查**：
- 檢查依賴項安裝狀態
- 檢查測試通過率
- 檢查程式碼品質狀態

## 📊 腳本執行流程

腳本會按照以下順序執行檢查：

1. **Git 環境檢查**
2. **TMux 環境驗證與設定**  
3. **專案檔案載入確認**
4. **開發狀態檢查**
5. **生成完整報告**

### ✅ 環境檢查報告

腳本執行完成後，會自動生成包含以下內容的詳細報告：

**Git 狀態**：
- 分支：當前分支名稱
- 狀態：clean/有未提交變更
- 同步：與遠端同步狀態

**TMux 環境**：
- Session：session名稱
- 面板數量：面板數量
- 佈局：佈局狀態
- 面板工作確認：是否已顯示職責說明

**專案檔案**：
- 關鍵檔案：存在狀態
- CLAUDE.md：最後修改時間
- Todolist：任務數量統計
- 必要規範文件：載入狀態

**開發環境**：
- 依賴項：安裝狀態
- 測試：通過率/失敗數量
- 程式碼品質：警告數量

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

