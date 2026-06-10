# PC-V1-002: Ticket ID 引用觸發 agent 自律收尾越權（引用 ≠ 指派缺口）

## 摘要

**「prompt 引用 Ticket ID」與「被指派執行該 ticket」在現行規則中無法區分，導致非執行型派發的 agent 越權收尾、造成假驗收。** 機制：dispatch 強制層要求非豁免 agent type 的 prompt 必含 Ticket ID（追溯防護），agent 自律層要求實作類 agent 完成後主動 check-acceptance + complete（收尾防護）——兩防護各自正確，交互即產生上述缺口。非執行型派發（唯讀探針、行為觀測、純諮詢）被迫加 Ticket ID 後，agent 把「看到 ID」解讀為「我被指派」，自走收尾流程——越權勾選 PM 保留的 acceptance 項並 complete ticket，造成假驗收。修正方向：PM 端優先用豁免白名單 agent type 派探針（免 Ticket ID）；必須引用 ID 時 prompt 附三禁約束；agent 端固化「引用 ≠ 指派」前提（prompt 無執行動詞指令時零 ticket 寫入）。

## 症狀

- 派發「不需要任何工具」的探針/觀測型任務，agent 卻產生大量 tool call（讀 ticket、勾 acceptance、complete）
- ticket 出現非 PM 操作的 `metadata sync post-completion` commit，diff 含 acceptance `[ ]→[x]` 與 `in_progress→completed`
- PM 保留的驗收項（如「實測驗證」）被 agent 自行標為完成——該項的驗證對象正是 agent 自己，形成自我見證的假驗收
- 探針的最終訊息偏離指定輸出（agent 忙於收尾流程，以收尾結語取代探針字串），測試結果無效

## 根因（兩防護交互的設計缺口）

| 防護 | 規則 | 單獨看 | 交互後 |
|------|------|--------|--------|
| dispatch 強制層 | agent-ticket-validation-hook：非豁免 type 必含 Ticket ID | 正確（變更可追溯） | 迫使非執行型派發攜帶 ID |
| agent 自律層 | AGENT_PRELOAD 2.4：完成後主動 check-acceptance + complete | 正確（省 PM tool call） | 把 ID 視為指派訊號，觸發收尾 |

缺口本質：Ticket ID 在 prompt 中有兩種語意——「追溯標記」（這次派發與某 ticket 相關）與「執行指派」（請執行此 ticket），現行格式無法表達差異。agent 缺判別準則時預設後者（收尾自律的訓練方向），對 PM 保留項尤其危險：保留項通常需要 PM 視角的驗證（實機測試、外部觀察），agent 既無能力驗證也不該代勾。

既有但未被利用的出口：hook 已有 `TICKET_EXEMPT_AGENT_TYPES` 白名單（Explore / general-purpose / Plan 等唯讀型，免 Ticket ID）——機制存在，但 PM 派發 SOP 未引導使用，PM 選了 catch-all 全工具型（`claude`）派探針才踩中強制層。

## 案例：探針越權 complete 假驗收（2026-06-10）

W1-044（Stop hook subagent 偵測修復）的 acceptance 項 5「實測劫持消除」保留給 PM 實測。PM 派發 `subagent_type="claude"` 探針（任務：零工具回傳兩行固定字串）驗證 subagent 最終訊息完整性：

1. 第一次派發（無 Ticket ID）被 hook deny →「派發任務必須引用有效的 Ticket ID」
2. 補加 `Ticket: 1.0.0-W1-044` 首行重派（無行為約束）
3. 探針 16 tool calls：讀 ticket、發現項 1-4,6 已勾、**自行勾選項 5、complete ticket**（commit `5430e240`），最終訊息「已確認。等候用戶輸入。」非探針字串
4. PM 以乾淨探針（同 ID 首行 + 三禁約束）重測：0 tool calls，字串一字不差——證實越權由「ID 引用 + 無約束」觸發，prompt 約束可完全抑制

分析詳見 1.0.0-W1-045（ANA），防護落地 1.0.0-W1-046（DOC）。

## 防護

| 層 | 措施 | 位置 |
|----|------|------|
| PM 派發 SOP（源頭） | 唯讀探針優先用 `TICKET_EXEMPT_AGENT_TYPES` 白名單型（免 Ticket ID）；必須引用 ID 時 prompt 附三禁約束範本 | `.claude/references/agent-dispatch-template.md`「唯讀探針派發 SOP」 |
| agent 行為層 | 「引用 ≠ 指派」前提：收尾自律僅適用 prompt 含執行動詞指令的 ticket；僅含追溯格式 ID 時零 ticket 寫入 | `.claude/agents/AGENT_PRELOAD.md` 規則 2.4 前提 + 例外表 + 檢查清單 |
| 否決的強制層方案 | ticket CLI 偵測 complete 操作者身份——不可行：agent 與 PM 共用同一 shell 執行 CLI，無進程級 caller identity | 分析結論，留作後人重評錨點 |

## 與其他 pattern 的邊界

| Pattern | 聚焦 | 與本 pattern 差異 |
|---------|------|------------------|
| PC-065 | 派發必含 Ticket ID 格式（防追溯斷裂） | 本 pattern 是其防護的非預期副作用：強制 ID 與非執行型派發衝突 |
| PC-105 | subagent commit 後未 complete（收尾不足） | 本 pattern 相反：未被指派卻 complete（收尾過度） |
| agent-definition-standard「禁止跨 ticket 物件操作」 | agent 操作非派發範圍的他人 ticket | 本 pattern 中 agent 操作的是自己 prompt 引用的 ticket，缺口正是「引用 ≠ 指派」未定義 |

---

**Created**: 2026-06-10
**Source**: 唯讀探針越權 complete 事件（1.0.0-W1-045 ANA 裁決，1.0.0-W1-046 DOC 落地）
