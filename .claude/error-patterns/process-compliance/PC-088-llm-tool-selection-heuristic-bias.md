---
id: PC-088
title: LLM 預設 tool selection 走最低認知負擔路徑（架構層傾向）
category: process-compliance
severity: high
created: 2026-04-18
---

# PC-088: LLM 預設 tool selection 走最低認知負擔路徑

## 症狀

LLM（包含 Claude）在面對多步驟任務時，傾向選擇**單步複雜度低、總步驟多**的路徑，而非**單步複雜度高、總步驟少**的最優路徑。

這不是單一 bug，是橫跨多情境的**架構層傾向**：

| 情境 | 低認知路徑（誤選）| 最優路徑 |
|------|----------------|---------|
| 傳遞長文字到 CLI | Write /tmp → cat → pipe（3 步）| heredoc 內嵌（1 步）|
| 改大檔案 | Read → Write 整檔（2 步但每步長）| Edit 精確替換（1 步）|
| 查詢程式碼 | 逐檔 Read → 人工比對（N 步）| Grep pattern（1 步）|
| 多檔案搜尋 | Bash find + grep 組合（2 步）| Grep 或 Glob（1 步）|
| 執行分析 | 自己逐步推理（10+ 步）| 派發 Agent（1 步）|

## 根因（架構層）

### 為何這是預設演算法而非可根除的習慣

LLM 是 autoregressive，每步 next-token 選擇本能偏好「下一步 token 容易生成」：

1. **Next-token predictability 偏誤**：生成「Write(/tmp/x.md)」的每個 token perplexity 低；生成 80 行 heredoc 的 token 不確定度高
2. **Chain-of-Thought 副作用**：CoT 本質就是把大問題拆小步，訓練強化了「多步驟」偏好
3. **視覺偏見**：長 heredoc 在 terminal 看起來「髒」，LLM 從訓練資料學到「簡潔每步」的美學
4. **工具返回可見性**：多步驟每步都有 tool_result 回饋，給 LLM 虛假的「進度感」

**結論**：這是架構 tendency，**無法根除，只能加 meta-check**。

### 與人類 cognitive bias 的差異

| 維度 | 人類 | LLM |
|------|-----|-----|
| 來源 | 情緒規避、疲勞 | autoregressive 架構 |
| 觸發頻率 | 不一致（有好日子）| 幾乎 100%（每次 tool selection）|
| 介入時機 | 情緒平靜時能自我矯正 | 無自我覺察，需外部 meta-check |
| 根除可能 | 訓練 + 經驗可降低 | 架構層無法根除 |

## 防護（多層）

### Layer 1：Tool Selection Meta-Check（PC-087 延伸）

選 tool 前強制 4 問：

| 檢查 | 問題 | 觸發重選 |
|------|------|---------|
| 物化檢查 | 把字串當檔案了嗎？ | 是 → 考慮直接傳遞 |
| 步驟數檢查 | 總步驟 > 2？ | 是 → 問「能否合併？」 |
| 目的地檢查 | 最終目的地是什麼？ | 反推最短路徑 |
| 工具能力檢查 | 有專用工具嗎？（Edit/Grep/Glob）| 是 → 優先用 |

### Layer 2：WRAP skill 整合

W15-006 IMP 將此 4 問整合進 WRAP A 階段前置檢查。WRAP 是 PM 強制入口，此處落地覆蓋率最高。

### Layer 3：情境特定規則

| 情境 | 規則來源 |
|------|---------|
| 長文字傳遞 → heredoc 預設 | `.claude/rules/core/bash-tool-usage-rules.md` 規則五（W15-007）|
| 檔案搜尋 → Glob 優先 | 既有 tool-discovery 規則 |
| 內容搜尋 → Grep 優先 | CLAUDE.md Bash 工具使用規範 |
| 檔案編輯 → Edit/MultiEdit 優先 | 既有 Edit 工具描述 |

## 識別信號

| 信號 | 含義 |
|------|------|
| 準備執行 > 2 步才能達成目的 | 高機率觸發，過 meta-check |
| 準備 Write 到非最終目的地 | 物化檢查觸發 |
| 覺得「這樣比較乾淨」 | 視覺偏見觸發，質疑是否真的最優 |
| 看到長 heredoc / 長 Edit old_string 猶豫 | 心理障礙，不是技術限制 |

## 案例

- 2026-04-18（W15-001 session）：PM 選 Write /tmp → cat → append-log（3 步）而非 heredoc（1 步）。PC-087 記錄具體案例
- 2026-04-18（W15-005 session）：用戶質疑 PC-087 根因太淺，PM 深度反思識別出這是 LLM 架構層傾向，提煉為本 PC-088

## 方法論教訓

**「最佳實踐」的幻覺**：
- LLM 訓練資料中大量出現「寫檔案 + 處理」模式（sysadmin tutorials、Stack Overflow 回答）
- 這讓 LLM 誤認為是「最佳實踐」
- 事實上現代最佳實踐是直接傳遞（heredoc、Edit、Grep）
- **訓練資料頻率 ≠ 最佳實踐**

## 相關

- `.claude/error-patterns/process-compliance/PC-087-pm-tmp-detour-for-ticket-content.md`（具體案例）
- `.claude/error-patterns/process-compliance/PC-079-bash-backtick-command-substitution-in-cli-args.md`（同源）
- 0.18.0-W15-005（深度反思 ANA）
- 0.18.0-W15-006（WRAP skill tool-selection layer 整合）
- 0.18.0-W15-007（bash 規則五 heredoc 預設）
- `.claude/rules/core/tool-discovery.md`（工具發現規則）
