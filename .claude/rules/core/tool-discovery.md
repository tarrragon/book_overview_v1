# 工具發現規則（Tool Discovery）

本文件定義遇到「我想做 X 但不知道怎麼做」情境時的工具發現流程。

> **核心理念**：在宣告「做不到」或選擇「限制性解法」（禁止、防護、規避）之前，必須先窮盡平台能力發現路徑。ToolSearch 是 Claude Code runtime 提供的通用 deferred tools 發現機制，非單一工具的專用鑰匙。

---

## 適用對象

- **PM（主線程）**：派發、觀察、路由、決策等所有情境
- **代理人**：遇到任務未覆蓋的能力需求時，先檢查後回報，禁止自行結論「平台不支援」

---

## 強制規則

### 規則 1：宣告「做不到」前必須完成五問檢查

當你準備告訴用戶「無法」「做不到」「目前不支援」，或準備採用「限制性解法」（禁止 X、防護 X、規避 X）時，必須先依序回答以下五問：

| 問題 | 檢查內容 |
|------|---------|
| (1) Hook 能推送嗎？ | `.claude/hooks/` 是否已有或可新增 Hook 處理此情境？ |
| (2) 檔案系統能追蹤嗎？ | 是否有既有持久化檔案（如 dispatch-active.json、worklog）可查？ |
| (3) 流程能繞過嗎？ | 是否可調整 Ticket/Wave/Phase 順序避免此需求？ |
| (4) 既有模組有 API 但沒接線嗎？ | `.claude/skills/` 或專案程式碼是否已有 API，只差接線？ |
| (5) CC runtime 有 deferred tool 嗎？ | **執行 `ToolSearch` 搜尋是否有對應的 deferred tool** |

**五個問題都回答「否」才能下結論「做不到」。**

### 規則 2：採「限制性解法」前必須先問探索性解法

問題框架會決定搜尋範圍。以下兩種框架會導向不同搜尋路徑：

| 限制性框架（傾向禁止） | 探索性框架（傾向找工具） |
|----------------------|------------------------|
| 「如何防止誤判 transcript？」 | 「如何正確取得代理人狀態？」 |
| 「如何阻止用戶輸入中文？」 | 「如何讓用戶選擇預定義選項？」 |
| 「如何避免併發衝突？」 | 「如何協調多個代理人？」 |

**採「禁止 X」解法之前，必須先嘗試「如何正確做 X」的框架，再執行五問。**

### 規則 3：ToolSearch 是通用發現機制，非單一用途

ToolSearch 是 Claude Code runtime 的**通用 deferred tools 發現入口**，用於：
- 發現當前 session 可用的 deferred tools
- 載入指定工具的 schema 以供呼叫

**禁止將 ToolSearch 框架為特定工具的專用前置步驟**（例如「AskUserQuestion 前置載入」）。具體工具的使用指南可引用此通用機制，但規則定義必須保持抽象。

### 規則 4：System-reminder 的 deferred tools 清單必須主動檢視

每個 session 啟動時，Claude Code runtime 會在 system-reminder 中列出當前可用的 deferred tools 名稱。遇到「找工具」需求時：

1. 先回想 system-reminder 中是否有匹配的工具名稱
2. 若不確定，執行 `ToolSearch(query="關鍵字", max_results=5)` 探索
3. 找到候選後，執行 `ToolSearch(query="select:<tool_name>")` 載入 schema

**禁止將 deferred tools 清單當成背景資訊忽略。**

---

## 使用方式速查

```
# 精確載入（已知工具名）
ToolSearch(query="select:TaskOutput")
ToolSearch(query="select:TaskOutput,SendMessage,TaskCreate")

# 關鍵字探索（未知能力）
ToolSearch(query="background task status", max_results=5)
ToolSearch(query="+task +output", max_results=5)
```

> 完整 deferred tools 對照表、使用情境、路由決策、反模式清單：`.claude/skills/search-tools-guide/SKILL.md`（Claude Code Meta-Tools 章節）

---

## 反模式

| 反模式 | 症狀 | 正確做法 |
|-------|------|---------|
| 單一用途框架 | 把 ToolSearch 當成特定工具的鑰匙 | 理解為通用 deferred tools 發現機制 |
| 忽略 system-reminder | 每 session 的 deferred tools 清單當背景資訊 | 遇到「找工具」需求時主動檢視 |
| 採限制性解法 | 問題框架為「如何防止 X」 | 改框架為「如何正確做 X」再問五問 |
| 跳過第五問 | 只檢查 Hook/檔案/流程/既有 API | 必須執行 ToolSearch 搜尋 CC runtime 能力 |
| 宣告「平台不支援」未窮盡 | 代理人或 PM 直接下結論 | 先完成五問，最後才下結論 |

---

## 相關文件

- `.claude/skills/search-tools-guide/SKILL.md` — 完整 deferred tools 對照表與路由決策
- `.claude/pm-rules/askuserquestion-rules.md` — AskUserQuestion 作為 deferred tool 的具體用例
- `.claude/references/pm-agent-observability.md` — TaskOutput 作為 deferred tool 的具體用例
- `.claude/error-patterns/process-compliance/PC-050-premature-agent-completion-judgment.md` — 未用 ToolSearch 導致採限制性解法的實際案例

---

**Last Updated**: 2026-04-13
**Version**: 1.0.0 — 初始建立
