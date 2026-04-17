---
id: PC-088
title: LLM 對 tool call 路徑的步驟數估算偏誤（單步敏感、總步驟盲）
category: process-compliance
severity: high
created: 2026-04-18
updated: 2026-04-18
---

# PC-088: LLM 對 tool call 路徑的步驟數估算偏誤

> **框架重大修訂（2026-04-18）**：原 v1 框架為「LLM 偏好低摩擦路徑是架構層 bias 需對抗」。用戶指出此框架與 `.claude/methodologies/friction-management-methodology.md` 衝突——**摩擦力是中性工具，短路徑偏好本身是正確預設**。真實問題不是「偏好」，而是**路徑步驟數的估算偏誤**：LLM 對單步複雜度敏感但對總步驟數盲。本 v2 版依此重構。

## 症狀

LLM 面對多步驟任務時，會把**實際步驟多但每步簡單**的路徑**誤估為短路徑**，選擇後才發現總成本高於替代方案。

### 實證案例對照

| 情境 | LLM 誤選路徑 | 實際總步驟 | 真正短路徑 | 真正總步驟 |
|------|-----------|-----------|-----------|-----------|
| 傳遞長文字到 CLI | Write /tmp → cat → pipe | **3 步** | heredoc 內嵌 | **1 步** |
| 改大檔案 | Read → Write 整檔 | 2 步但每步重 | Edit 精確替換 | 1 步 |
| 查詢程式碼 | 逐檔 Read → 人工比對 | N 步 | Grep pattern | 1 步 |
| 多檔案搜尋 | Bash find + grep 組合 | 2 步 | Grep 或 Glob | 1 步 |
| 執行分析 | 自己逐步推理 | 10+ 步 | 派發 Agent | 1 步 |

**關鍵觀察**：在每個誤選案例中，LLM 以為自己選的是「輕路徑」，但計算下來反而是「長路徑」。問題不在偏好，在**無法準確估算路徑總長度**。

## 真實根因（架構層，三點）

### 1. 單步敏感、總步驟盲

LLM 是 autoregressive，**每個 next-token 的 perplexity 是直接感受**，但「10 個 next-token 組成的序列」只能靠推理總計：

- 生成 `Write("/tmp/x.md", content)` 的每個 token 都低 perplexity → **感覺簡單**
- 需要「預想」後續還要 `cat` + `append-log` → **不會被直覺感受**
- 真正簡單的 heredoc 每個 token perplexity 較高 → **感覺複雜**

結果：LLM 對「每步感覺」敏感，對「路徑總長度」盲。

### 2. Tool result 回饋的進度錯覺

每步 tool call 都有 tool_result 回饋。多步驟路徑每步都「有回饋 = 進度」，給 LLM **虛假的推進感**。單步 heredoc 沒有中途回饋，感覺「風險更高」。

但實際上：有回饋不等於進度，多步驟反而增加失敗風險面。

### 3. 訓練資料頻率 ≠ 最佳實踐

訓練資料含大量「Write file → process」sysadmin tutorials，這是歷史 shell 限制的產物，不是現代最佳實踐。LLM 把**訓練頻率誤讀為權威性**。

## 框架：與 friction-management 的正確關係

### 短路徑偏好 = 正確預設（象限 A / 執行點）

摩擦力方法論明確指出：
- 高頻 + 可逆 + 只影響當前任務 → **降低摩擦，直接執行**
- Phase 3b 實作執行 → 低摩擦
- LLM 選短路徑本身符合此預設，不該被「對抗」

### 真正的問題在估算偏誤

當 LLM **誤認為**自己選的是短路徑（實際是長路徑），低摩擦預設就失效——此時 PM 在 Phase 3b 類場景選了 3 步路徑做 1 步能完成的事。

**這不是偏好問題，是事實判斷錯誤**。

### 決策點加摩擦仍屬必要（象限 C / 前期階段）

摩擦力方法論也指出：低頻 + 不可逆 + 跨版本影響 → 加摩擦。這與短路徑偏好並不衝突：
- 執行點保留短路徑預設
- 決策點強制 WRAP / 多視角 / two-phase reflection
- 兩者並存，不互斥

## 防護（三層）

### Layer 1：路徑步驟數計算工具（核心防護）

選 tool 前強制估算**總步驟數**（不只單步感覺）：

| 檢查 | 問題 | 觸發重選 |
|------|------|---------|
| 完整路徑數算 | 從現在到目的地共幾步 tool call？ | > 2 步 → 問「有無 1 步解」 |
| 訓練偏誤自檢 | 我選這路徑是因為「看過很多這樣寫」還是「實測最短」？ | 前者 → 找替代 |
| Tool result 進度陷阱 | 多步驟的中途回饋是否讓我覺得「比較穩」？ | 是 → 警覺，單步風險未必高 |
| 專用工具檢查 | 有 Edit / Grep / Glob / heredoc 等 1 步工具嗎？ | 是 → 優先 |

### Layer 2：情境特定規則（執行點）

高頻執行情境的路徑規則：

| 情境 | 短路徑（預設）| 規則來源 |
|------|-----------|---------|
| 長文字傳遞 | heredoc | 規則五（W15-007）|
| 檔案搜尋 | Glob | tool-discovery |
| 內容搜尋 | Grep | CLAUDE.md Bash 規範 |
| 檔案編輯 | Edit/MultiEdit | Edit 工具描述 |
| 多步推理 | 派發 Agent | agent tool 描述 |

### Layer 3：決策點摩擦（與短路徑預設並行）

決策點（象限 C）不因「短路徑是預設」而降摩擦：
- ANA Ticket claim → Phase 1+2 反思（W15-009 設計）
- Phase 4 重構評估 → Phase 2 WRAP
- 規則/規格修改 → parallel-evaluation

## 識別信號

| 信號 | 含義 |
|------|-----|
| 準備 > 2 步 tool call 達成目的 | 過 Layer 1 總步驟檢查 |
| 覺得「多步驟每步有回饋比較穩」 | Tool result 進度錯覺觸發 |
| 「這樣比較乾淨」「訓練資料常見」 | 訓練偏誤信號 |
| 看到長 heredoc / 長 Edit old_string 猶豫 | 單步感覺 bias，非技術限制 |

## 案例

- 2026-04-18（W15-001 session）：PM 選 Write /tmp → cat → append-log（**3 步**）而非 heredoc（**1 步**）。PC-087 記錄具體案例
- 2026-04-18（W15-005 session）：用戶質疑 PC-087 根因太淺，PM 深度反思識別到「檔案感物化 + 認知負擔規避」，但此第二層深因仍未達真根因
- 2026-04-18（W15-008 後 reframe）：用戶指出此與 friction-methodology 衝突，真根因是**步驟數估算偏誤**而非「短路徑偏好 bias」。PC-088 v2 依此重寫

## 方法論教訓

### 「深度反思」本身也有盲點

W15-005 的 two-phase reflection 產出了「認知負擔規避」作為根因。但用戶的摩擦力視角 reframe 揭示：
- Phase 1 的多假設 Reality Test 深度仍不夠
- 缺少「與既有方法論對照」檢查
- 真根因再深一層（估算偏誤）

**啟示**：深度反思 + WRAP + 結論後對照權威方法論（third-phase check）才是完整流程。

### 概念使用需 second-order 檢驗

我在 PC-088 v1 用「bias」「對抗」「架構偏誤」等詞，**與本專案 friction-methodology 詞彙系統不一致**。概念挪用需確認是否與既有權威 source 衝突。

## 相關

- `.claude/error-patterns/process-compliance/PC-087-pm-tmp-detour-for-ticket-content.md`（具體案例）
- `.claude/methodologies/friction-management-methodology.md`（摩擦力權威 source）
- `.claude/methodologies/three-phase-reflection-methodology.md`（反思方法論，W15-009 將補 Phase 3 方法論對照檢查）
- 0.18.0-W15-005（深度反思 ANA）
- 0.18.0-W15-009（決策樹反思觸發點細化，方向調整為「決策點摩擦 + 執行點短路徑預設」）
- `.claude/rules/core/tool-discovery.md`（工具發現規則）
