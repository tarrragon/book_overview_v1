# Claude 指令：Commit-As-Prompt

此命令可協助您建立格式良好的提交。

## 使用方法

要建立提交，只需輸入：

```
/commit-as-prompt
```

## 📝 背景 (Background)

本提示用於將 **Git 提交記錄** 轉換為供其他 AI 參考的問題上下文 Prompt，幫助其在程式碼審查、技術債評估或文件編寫時快速了解變更的 **目標 (WHAT)／動機 (WHY)／手段 (HOW)**。

---

## 🗣️ System

你是一名 **Commit-to-Prompt Engineer**。
你的職責：

1. 分析待提交的內容，以建立清晰的問題上下文為前提，精心挑選相關的文件聚合，拆分成多次提交
2. 為提交寫標題與內文，抽取 WHAT／WHY／HOW。
3. 產生遵循「Prompt 範本」的上下文，不添加任何多餘解釋或格式。

---

### 🏷️ Commit 類型與標題前綴

- **Context Prompt 提交**：標題請以 `prompt:` 開頭，例如 `prompt(dark-mode): 場景上下文`
- 適用於需被轉換為上下文 Prompt 的提交。
- **常規功能/修復提交**：沿用 Conventional Commits 前綴，如 `feat:`、`fix:`、`docs:` 等。
- 這些提交不進入 Prompt 轉換流程，但仍需遵守 WHAT/WHY/HOW 規範。

在同一分支工作時，若同時存在兩類提交，應分別提交，避免混合。

---

## 🤖 Assistant（執行步驟，必須依序執行）

以下步驟幫助你快速整理變更並產出符合 WHAT / WHY / HOW 規範的提交：

0. **工作日誌記錄檢查** ⭐ 新增步驟

```bash
# 執行工作日誌檢查腳本
./scripts/check-work-log.sh
```

**檢查項目**：
- 最新工作日誌是否包含今日日期記錄
- 當前變更是否已記錄在工作日誌中
- 文件同步狀態（工作日誌、TODO、CHANGELOG）

**如果檢查不通過**：
1. 開啟最新的工作日誌檔案 (`docs/work-logs/v*.*.*.md`)
2. 記錄今日的開發工作內容
3. 同時暫存工作日誌變更: `git add docs/work-logs/`
4. 重新執行 `/commit-as-prompt`

1. **檢查工作區變更**

```bash
# 查看工作區與暫存區的差異
git status -s
# 看尚未暫存的修改詳情
git diff
# 查看已暫存但未提交的修改詳情
git diff --cached
```

2. **理解並清理程式碼與檔案**

在任何自動化清理或重新命名前，**先閱讀並理解相關程式碼，確認改動不會破壞現有功能，沒有把握的程式碼請不要修改**。

- 刪除無用匯入、死程式碼

- 移除臨時日誌 / 偵錯語句（`console.log`, `debugger` 等）

- 重新命名臨時或非正式識別（如 `V2`, `TEMP`, `TEST` 等）

- 刪除臨時測試、鷹架或文檔
  如需自動修復，可執行： validate-redux --project-root 加指定路徑解決問題，例如 validate-redux --project-root /Users/link/github/redux-realtime-starter

3. **選擇應納入本次提交的文件**

使用互動式暫存精準挑選相關變更：

```bash
git add -p # 按下區塊暫存
git add <file> ... # 或按檔案暫存
```

僅保留實現當前需求所需的程式碼、配置、測試、文件。
將純格式化、依賴升級或大規模重命名等雜訊變更**拆分為獨立提交**。4. **編寫提交資訊（Prompt 結構）**
對於**每個 `prompt:` 類型的提交**，其訊息正文應遵循 WHAT/WHY/HOW 結構，但不帶編號。這部分內容將用於後續的 prompt 生成。

**單一提交訊息正文格式：**

```bash
WHAT: ...
WHY: ...
HOW: ...
```

5. **推送並同步文件**

```bash
# ⚠️  提交前最後確認：確保工作日誌已更新並包含在提交中
if git diff --cached --name-only | grep -q "docs/work-logs/"; then
    echo "✅ 工作日誌已包含在提交中"
else
    echo "⚠️  工作日誌未包含，建議加入: git add docs/work-logs/"
fi

# 範例：提交一條 prompt 類型的變更
git commit -m "prompt(auth): 支援 OAuth2 登入" -m "WHAT: ...
WHY: ...
HOW: ..."
git push
```

之後：

```bash
# 檢查是否需要更新其他文件記錄
if [[ -f "docs/todolist.md" ]]; then
    echo "📋 檢查 TODO 清單是否需要更新"
fi

if [[ -f "CHANGELOG.md" ]]; then
    echo "📝 檢查變更記錄是否需要更新"
fi
```

### 📂 檔案挑選原則

- 僅包含實現本需求所必需的程式碼、配置、測試、文件。
- 排除格式化、依賴升級、產生檔案等雜訊變更。
- 純重命名或大規模格式化應作為獨立提交。
- 暫存中如含多個主題，請拆分為多次提交。

### 💡 提交資訊通用原則

- **有意義的命名與描述**：提交標題應簡潔、明確，描述變更內容和目的，避免“修復 bug”“更新代碼”等模糊詞。
- **結構化與規範化**：推薦採用 Conventional Commits（如 `feat`, `fix`, `docs` 等）並包含作用域與簡短主題，正文補充細節，便於自動產生變更日誌。
- **解釋 Why 而非列舉 What**：正文重點說明動機或背景，而不僅僅是修改了哪些文件。

### 📝 WHAT / WHY / HOW 寫重點

- **WHAT（做什麼）**：一句話描述動作與對象，使用祈使動詞，不包含實現細節。例如 `Add dark theme to UI`。
- **WHY（為什麼做）**：深入闡述業務、用戶需求、架構權衡或缺陷背景，避免泛泛而談；可引用 Issue / 需求編號，如 `Fixes #1234`、`Improve a11y for dark environments`。
- **HOW（怎麼做）**：概述採用的整體策略、相容性 / 依賴、驗證方式、風險提示及業務（用戶）影響；可補充上下文依賴或前置條件；無需羅列具體文件（diff 已體現細節）。

### 🚀 高品質提交最佳實踐

1. **結構化與聚合**：一次提交聚焦單一主題；大型變更可拆分多步，每步都有獨立 WHAT/WHY/HOW。
2. **深入 WHY**：在 WHY 關聯業務目標、使用者需求或瑕疵編號；若為架構決策，簡述權衡背景。
3. **具體 HOW**：描述整體改動策略、相容性 / 依賴、驗證方式、風險提示及業務影響，而非逐條羅列文件。
4. **清晰語言與格式**：標題和正文避免模糊詞（如“調整”），使用英文祈使句；遵循 Conventional Commits。
5. **自動化與追溯**：內文引用 Issue/PR/需求編號，保持與 changelog、CI 流程連動。
6. **上下文完整性**：對 prompt: 提交，在 `<Context>` 中補充依賴或前置信息，方便 AI 理解。

7. 輸出結果必須嚴格符合以下“Prompt 範本”，除模板內容外不得輸出解釋、標題、程式碼區塊標記或空白行。

### Prompt 生成模板

此範本用於**聚合多個 `prompt:` 類型的提交**，產生最終的上下文。每個編號項（`1.`, `2.`）對應一個獨立的提交。

```
<Context>
1. [WHAT] ...
 [WHY] ...
 [HOW] ...
2. [WHAT] ...
 [WHY] ...
 [HOW] ...
</Context>
```

---

## ✅ 範例：從獨立提交到聚合提示

**第 1 步：進行兩次獨立的 `prompt:` 提交**

_提交 1:_

```bash
git commit -m "prompt(auth): 支援 OAuth2 登入" -m "WHAT: 重構認證中間件以支援 OAuth2 登入
WHY: 符合新的安全策略，允許第三方登錄，對應需求 #2345
HOW: 引入 OAuth2 授權碼流程替換 BasicAuth；向下相容舊 Token；透過單元測試驗證；需更新用戶端設定"
```

_提交 2:_

```bash
git commit -m "prompt(api): 移除廢棄介面" -m "WHAT: 移除廢棄 API 端點
WHY: 為 v2.0 版本做清理，減少維護成本
HOW: 下線 v1 Legacy 端點並更新 API 文件；版本標識提升至 v2；通知客戶端遷移"
```

**第 2 步：工具根據這兩次提交，自動產生聚合後的 Prompt**

_產生的 Prompt 輸出:_

```text
<Context>
1. [WHAT] 重構認證中間件以支援 OAuth2 登入
 [WHY] 符合新的安全策略，允許第三方登錄，對應需求 #2345
 [HOW] 引進 OAuth2 授權碼流程取代 BasicAuth；向下相容舊 Token；透過單元測試驗證；需更新用戶端設定
2. [WHAT] 移除廢棄 API 端點
 [WHY] 為 v2.0 版本做清理，減少維護成本
 [HOW] 下線 v1 Legacy 端點並更新 API 文件；版本標識提升至 v2；通知客戶端遷移
</Context>
```

---
