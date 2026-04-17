# PC-066: 輔助決策系統未在 Context 沉重時主動觸發

## 錯誤症狀

PM 在 context 沉重的 session 中做出本可透過 WRAP/多視角避免的錯誤決策。典型表現：

1. **連續失敗仍重複嘗試**：同一問題修改 2+ 次失敗，PM 繼續調整核心程式碼，未停下執行 WRAP
2. **宣告「做不到」採限制性解法**：PM 輸出「無法」「禁止」「CLI 不支援」前未先窮盡 WRAP 的「擴增選項」階段
3. **ANA Ticket 跳過分析框架**：claim ANA Ticket 後直接寫 Solution，未執行錨點確認與選項擴增
4. **重大決策未經多視角審查**：升級規則、新建 Skill、改架構等影響跨專案的決策，產出後未派發三人組審查
5. **元層悖論**：PM 在分析「為何不主動用輔助系統」的 ANA Ticket 中，自己也未用輔助系統

## 根因分析

### 表層原因：依賴 PM 自律的觸發機制

WRAP 與 multi-perspective 兩套輔助系統的觸發完全仰賴 PM 主動回想與選擇。當 context 沉重時，PM 的工作記憶縮小，難以同時記住「我現在應該用 WRAP」與「正在做的任務本身」。

### 深層原因：自律機制在高壓下的系統性失效

> 關鍵洞察：原則正確但執行落差是反覆出現的元模式。

| 階段 | 系統狀態 | PM 行為 |
|------|---------|---------|
| Context 輕（< 30% 使用） | 工作記憶充足 | 能主動回想 WRAP 觸發條件 |
| Context 中（30-60%） | 工作記憶部分擠壓 | 依賴規則/Skill 引導才會用 |
| Context 重（> 60%） | 工作記憶嚴重縮小 | 傾向「快速判斷完結案」，跳過所有引導 |

context 沉重時 PM 反而更需要輔助系統，但這時也是最不會主動觸發的時刻。**自律機制與最需要它的場景負相關**。

### 次要原因：限制性解法是 context 沉重時的預設反應

context 沉重時 PM 傾向「禁止 X」「規避 X」「防護 X」（限制性解法），而非「找正確工具做 X」（探索性解法）。WRAP 的 W 階段（擴增選項）正是防護此反應的機制，但若不主動觸發 WRAP，PM 直接以限制性解法結案。

### 第三層原因：輔助系統觸發條件靜態化

WRAP skill description 列出 7 種觸發條件（連續失敗、被困住、ANA Ticket 等），但條件以靜態文字描述，沒有自動偵測機制。PM 必須先回想條件，才能匹配當下情境，再決定是否觸發——三步路徑在 context 沉重時容易斷裂。

## 實際案例

### 案例 1：宣告 transcript「無法可靠讀取」

PM 在處理代理人觀察問題時，連續修改錯誤模式規則多次後，宣稱「PM 無法可靠讀取 transcript」並規則化「禁止讀取」。

- WRAP 符合條件：「被困住（宣稱做不到）」明確觸發
- 實際：未觸發 WRAP，採限制性解法
- 後果：次日另一場 ANA 發現 deferred tool（TaskOutput）早已可用，限制性規則必須調整為「TaskOutput 安全使用範本」
- 成本：規則反覆，且限制性解法存在期間遮蔽了正確工具的能力

### 案例 2：Hook error 三次錯誤假設修改

session 持續排查 hook 異常，已修改核心 hook 工具 2 次皆失敗。PM 第三次繼續修改（先假設 exit code、再假設 stderr、再假設空 stdout）。

- WRAP 符合條件：「連續失敗 2+ 次」明確觸發
- 實際：未觸發 WRAP，第三次後才搜社群發現是 CLI 已知 bug
- 後果：三次修改全部回退
- 成本：大量 session 時間、誤改核心程式碼

### 案例 3：原則建立反覆只寫 memory 不升級框架

PM 多次在 session 末尾建立跨專案適用的原則，將其寫入 feedback memory 但未升級為 `.claude/` 框架規則。

- WRAP 符合條件：「重大決策（原則建立影響跨專案）」符合條件
- 實際：未觸發 WRAP，多筆 memory 未升級
- 後果：跨專案原則延遲惠及其他專案
- 成本：新專案 sync `.claude/` 後無法繼承這些原則

### 案例 4：分析「為何不主動用 WRAP」的 ANA 自己也未用 WRAP

PM 接連執行兩個關於「PM 系統性盲點」的 ANA Ticket，第二個 ANA 直接進入 Solution 撰寫，未執行錨點確認與選項擴增。

- WRAP 符合條件：「ANA Ticket 分析過程（強制快速 WRAP）」明確觸發
- 實際：未觸發 WRAP
- 元層意義：本案例本身即「context 沉重時 PM 不會主動想起 WRAP」假設的元驗證

## 防護措施（單點強制 + fallback 結構）

### 設計原則：強制觸發只在一個節點

> **教訓**：W10-008 初版設計「規則層 + Skill 層 + 持續層」三處複述 WRAP 觸發條件，被 linux 多視角審查指出 DRY 違反（同概念在多處漂移）。修正後採用「Hook 唯一強制 + 規則人工 fallback」單點結構。

### 措施 1：decision-quality-guard-hook（強制節點，唯一強制觸發點，W10-009 追蹤）

`.claude/hooks/decision-quality-guard-hook.py`（待落地）為唯一自動強制觸發節點。偵測訊號：

- 連續失敗 ≥ 2 次（透過 ticket release/reclaim 計數）
- PM 輸出「做不到 / 無法 / 禁止」關鍵字（透過 UserPromptSubmit 正則）
- ANA Ticket claim（透過 PostToolUse 偵測 `ticket track claim`）

觸發後輸出 stderr 強制提示，節流：同訊號 10 分鐘內不重複。

> **觸發條件權威來源**：
> - 機器可讀（Hook 動態讀取）：`.claude/config/wrap-triggers.yaml`
> - 本專案對應表：`.claude/skills/wrap-decision/references/project-integration/triggers-alignment.md`
> - 通用原理（抽象類別）：`.claude/skills/wrap-decision/SKILL.md`「觸發條件」章節
>
> Hook 實作以 YAML 為 single source of truth，不在 Python 硬編碼。

### 措施 2：wrap-decision SKILL description 擴充（Skill matching 層）

`.claude/skills/wrap-decision/SKILL.md` description 擴充觸發關鍵字（做不到 / 無法 / 禁止 / 升級 / 重構 / 改架構 / 連續失敗 2+ / 高 context），讓 Skill matching 自動命中觸發場景。

> **權威清單仍在 SKILL 主文「觸發條件」章節**，description 為摘要關鍵字以提高 matching 命中率。

### 措施 3：parallel-evaluation SKILL description 補充（Skill matching 層）

`.claude/skills/parallel-evaluation/SKILL.md` description 補充 Use when 時機（Phase 3b 完成 / Phase 4 前 / 重大架構決策前 / ANA Ticket 結論審查 / 任何分析報告產出後），讓重大決策後的多視角審查能被 Skill matching 自動觸發。

### 措施 4：decision-tree.md Context 重度檢查層（人工 fallback）

`.claude/pm-rules/decision-tree.md` 派發閘門前新增「Context 重度檢查層」入口章節。**不複述觸發條件**，僅引用 wrap-decision SKILL 為權威來源。本層為 PM 主觀決策的 fallback——當 Hook 偵測不到的場景（如 PM 對非關鍵字的限制性思考）由 PM 自律觸發。

### 措施 5：AskUserQuestion 預設選項規則（路由層）

`.claude/pm-rules/askuserquestion-rules.md` 新增規則 6「預設選項設計規則」：

- 重大決策、ANA Ticket 路由、Session 關鍵分歧的 AUQ 提問，Recommended 選項必須為 WRAP 或多視角
- **禁止「跳過評估」「快速處理」作為 Recommended**

> 此規則獨立於上述強制節點，是 AUQ 工具升級後的新變體防護（PC-014 / PC-064 的工具升級延伸），與 WRAP 觸發機制無衝突。

### 措施 6：CLI claim 簡化 WRAP 三問（已落地）

`ticket track claim` 對所有 ticket 強制顯示簡化 WRAP 三問（W/A/P）。此為 ticket 認領節點的內建強制，與措施 1 Hook 互補但不重複（claim 是事件邊界，Hook 是訊號邊界）。

## 結構說明

| 節點 | 強制性 | 角色 |
|------|-------|------|
| Hook（措施 1） | 強制 | 唯一自動強制節點，覆蓋訊號偵測場景 |
| CLI claim（措施 6） | 強制 | 唯一事件邊界強制節點，覆蓋 ticket 認領場景 |
| Skill matching（措施 2/3） | 引導 | 提高 PM 主動使用 wrap-decision/parallel-evaluation 的命中率 |
| decision-tree fallback（措施 4） | 人工 | Hook 與 CLI 都無法偵測的 PM 主觀場景由 PM 自律觸發 |
| AUQ 規則 6（措施 5） | 設計約束 | 預設選項不得引導用戶跳過評估，與其他措施正交 |

**反設計**：本結構**避免**「規則層 + Skill 層 + 持續層」三處複述觸發條件的初版設計（W10-008 多視角審查發現 DRY 違反）。觸發條件 single source of truth = wrap-decision SKILL；其他位置只引用不複述。

> **與 PC-060/PC-061 的關係**：三 ANA 暴露同樣的結構問題（原則正確但執行落差），但**防護方式因領域差異而不同**：PC-060 是工具發現規則化（tool-discovery rule）、PC-061 是 memory 升級評估規則化（quality-baseline 規則 7）、PC-066 是決策觸發 Hook 化（W10-009）。**三者沒有可重用的「三層元架構」**，將其抽象為通用結構是錯誤的概念升維。

## 自我檢查清單

PM 在重大決策節點自問（Hook 強制節點之外的人工 fallback）：

- [ ] 我是否處於 wrap-decision SKILL「觸發條件」章節列出的任一情境？
- [ ] 我是否在輸出「無法 / 禁止 / 規避」前先執行了 WRAP 的 W 階段？
- [ ] 我的 AUQ 提問 Recommended 選項是否為「跳過評估」？（若是，必須改為 WRAP 或補充跳過理由）

> 觸發條件清單以 wrap-decision SKILL 為唯一權威來源，本檔案不複述。

## 關聯

- **相關模式**：PC-060（Meta-tool 發現未窮盡，「規則正確但未執行」結構）
- **相關模式**：PC-061（Memory 升級未評估，「原則建立後執行斷裂」結構）
- **相關模式**：PC-014（AskUserQuestion 合理化跳過，本模式「Recommended 不得跳過評估」的成因）
- **相關模式**：PC-050 模式 D（PM 在代理人仍在工作時誤判完成/失敗，焦慮性檢查的下游症狀）
- **相關 Skill**：`.claude/skills/wrap-decision/SKILL.md`（WRAP 框架通用原理）
- **本專案整合**：`.claude/skills/wrap-decision/references/project-integration/`（觸發條件對應、案例、Hook 設計）
- **相關 Skill**：`.claude/skills/parallel-evaluation/SKILL.md`（多視角審查本體）
- **相關規則**：`.claude/pm-rules/decision-tree.md`（Context 重度檢查層）
- **相關規則**：`.claude/pm-rules/askuserquestion-rules.md`（預設選項規則）
- **相關 Hook**：`decision-quality-guard-hook.py`（自動偵測層，待實作）

---

**Created**: 2026-04-15
**Last Updated**: 2026-04-15（多視角審查後修訂：拆除「三層防護元架構」抽象，採用單點強制 + fallback 結構）
**Category**: process-compliance
**Severity**: P1（直接導致決策品質下降，元層上抑制其他防護機制生效）
**Key Lesson**: 自律機制在 context 沉重時系統性失效——PM 最需要輔助系統時，也是最不會主動觸發的時刻。**正確修正方向**：將強制觸發收斂到單一節點（Hook + CLI claim），其他位置只引用觸發條件而不複述（避免 DRY 違反）。多層複寫同一條件不是防護，是讓概念在多處漂移。
**Meta Lesson**: 本錯誤模式自身的初版設計（「三層防護元架構」）即犯了同類錯誤——將「規則 + Skill + 持續層」三處複寫包裝為元架構。多視角審查（linux 視角）揭示：真正可重用的元架構是「single source of truth + 多入口引用」，不是「同概念多處複述」。
