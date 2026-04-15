# PC-067: 執行 ANA 規劃時未質疑規劃本身的設計品質

## 錯誤症狀

PM 在 ANA Ticket 完成後執行其規劃內容（建立 follow-up tickets 或直接實作）時，傾向把 ANA Solution 視為「已驗證的設計」，直接執行，而**不質疑 ANA 規劃本身的設計品質**。典型表現：

- ANA Ticket 規劃出 N 個 follow-up tickets，PM 直接照單建立並執行，未審查方案品質
- ANA Solution 提出的「方法論抽象」「元架構」未經多視角驗證即被當作既定設計
- ANA 與執行 Ticket 由同一 PM 進行時，執行階段繼承 ANA 階段的同一視角偏誤
- 多視角審查在執行**完成後**才介入，不在執行**規劃時**介入

## 根因分析

### 表層原因：ANA Ticket 的 Solution 區段被視為「已決定」

ANA Ticket 的目的是「分析與規劃」，Solution 區段是分析產出。但執行階段的 PM 易將其當作「已通過審查的設計」，跳過質疑步驟。

### 深層原因：同一 PM 跨階段的視角繼承

ANA 與後續執行 Ticket 由同一 PM 主線程處理時，執行階段繼承 ANA 階段的所有設計假設、偏好、盲點。這違反多視角審查的核心精神——**獨立性**。

### 第三層原因：parallel-evaluation Use when 缺失「ANA 規劃完成後」明示

`parallel-evaluation` SKILL 原本列出的觸發時機聚焦在「程式碼 / 架構 / 重構 / 結論」，未明示「ANA Solution 規劃完成、follow-up tickets 建立前」這個關鍵節點。導致 PM 自然不會在此節點觸發多視角。

### 第四層原因：ANA 視角效率優化的副作用

ANA 階段為了快速產出方案，常採用「快速 WRAP」模式。快速模式以速度換深度，產出方案常含未經 Reality Test 的假設。執行階段若不補多視角，這些假設直接成為實作。

## 實際案例

### 案例：W10-008 執行 W9-004 規劃的「三層防護元架構」

W9-004（決策品質防護分析）規劃出 S2-S7 五個方案，包含「規則層 + Skill 層 + 持續層」三層防護元架構。W10-008 PM 直接執行此規劃：

- 6 處變更全部依規劃落地
- 過程中無人質疑「三層複寫同概念」是 DRY 違反
- 多視角審查（含 linux）在執行**完成後**才介入
- linux 視角直接給出 Acceptable 偏 Garbage 評分，揭示「元架構是空洞包裝」「WRAPCheck 是儀式稅」
- 用戶選擇全盤接受批評，回退 WRAPCheck 欄位、PC-066 改寫為「single source of truth + fallback」結構

**代價**：
- 完整實作 6 處變更後再回退其中 1 處（5w1h-format WRAPCheck）
- PC-066 文件需重寫核心抽象結構（從「三層元架構」改為「單點強制 + fallback」）
- 多視角審查的 context 成本（4 個代理人 + 整合決策）原可避免

**根本原因**：ANA Solution 區段被當作既定設計，未在執行**規劃時**啟動多視角審查。

## 防護措施

### 措施 1：parallel-evaluation SKILL Use when 補強

`.claude/skills/parallel-evaluation/SKILL.md` description 已含「ANA Ticket 結論審查」「任何分析報告產出後」（W10-008 落地）。本錯誤模式進一步要求：**ANA Solution 規劃完成 + 建立 follow-up tickets 前**必須執行多視角，不可等執行**完成後**才補。

### 措施 2：執行 Ticket claim 時的設計品質自省

ANA 衍生的執行 Ticket（如 IMP / DOC type）認領時，PM 必須自問：

- ANA Solution 中的設計選擇是否已通過多視角審查？
- 若沒有，是否應在執行前先補審查？
- 我（執行階段 PM）是否與 ANA 階段 PM 是同一視角？是 → 多視角審查不可省

### 措施 3：ticket CLI claim 提示（待落地）

`ticket track claim` 在偵測 ticket 為「ANA 衍生」時，輸出提醒：

```
[提示] 本 Ticket 為 ANA 衍生（source: <ana_id>）。
       執行前建議先確認 ANA Solution 是否經過多視角審查。
       若無，可派發 parallel-evaluation 後再執行。
```

### 措施 4：ANA Ticket Solution 區段加註審查狀態

ANA Ticket 完成時 Solution 區段必須註明：

- [ ] 多視角審查狀態（已執行 / 未執行 / 不適用）
- [ ] 若未執行，理由（如：方案僅為事實陳述，非設計選擇）

未註明的 ANA Ticket 視為「未審查」，後續執行 Ticket 必須補審。

## 自我檢查清單

執行 ANA 衍生 Ticket 前自問：

- [ ] ANA Solution 區段是否註明多視角審查狀態？
- [ ] 若未審查，本執行 Ticket 是否包含設計選擇（非單純執行）？
- [ ] 若包含設計選擇，是否能識別 ANA 設計中的潛在 DRY / 過度設計風險？
- [ ] 若無法獨立識別，是否應派發 parallel-evaluation 含 linux 常駐委員？

任一答「否」→ 補多視角審查，或在執行 Ticket Problem Analysis 中說明跳過理由。

## 關聯

- **相關模式**：PC-066（決策系統未主動觸發，本模式為其執行階段的具體變體）
- **相關模式**：PC-063（ANA Premature Solution Convergence，本模式聚焦執行階段繼承 ANA 偏誤）
- **相關 Skill**：`.claude/skills/parallel-evaluation/SKILL.md`（措施 1 落點）
- **相關 Skill**：`.claude/skills/wrap-decision/SKILL.md`（執行階段觸發 WRAP 補審查）
- **相關 ARCH**：ARCH-018（Hook × 架構規則衝突也屬同類「執行階段未質疑既定設計」）

---

**Created**: 2026-04-15
**Last Updated**: 2026-04-15
**Category**: process-compliance
**Severity**: P2（單次成本中等，但累積成本高——每個 ANA 都可能複現）
**Key Lesson**: ANA Solution 不是已驗證的設計，是「分析階段的方案草稿」。執行階段必須將 ANA 視為輸入而非結論，獨立啟動多視角審查（至少含 linux good-taste），特別是當 ANA 與執行由同一 PM 主線程處理時。多視角的價值來自獨立性，繼承同一視角的執行不是審查。
