# Hook 降級觀察期方法論

本方法論規範 Phase 3b Hook 降級後的 2 Wave 觀察期計畫、統計追蹤、rollback 觸發條件與快速恢復 SOP。

> **背景**：W10-035.3 ANA 對 11 個 Phase 3b 候選 hook 量化 3 天觸發頻率（4915 觸發 / 36 Action，<1%），W10-047 拆 4 子 ticket 執行 M-3 降級計畫；W10-047.1 + W10-047.2 已完成 8 hook 降級，預估累計削減 Phase 3b Hook 摩擦約 85%。本文件提供觀察期框架，確保降級後若有未察覺風險可快速 rollback。

---

## 觀察期啟動點

| 階段 | Commit SHA | Git Tag | 涵蓋 Hook | 預估削減 |
|------|-----------|---------|----------|---------|
| P1 baseline | `05f328b7` | `hook-downgrade-p1-baseline` | parallel-dispatch-verification / bash-edit-guard / acceptance-gate | ~50% |
| P3 baseline | `4a225bcf` | `hook-downgrade-p3-baseline` | worklog-format-check / utf8-integrity-check / language-guard / comment-qa / file-type-permission | 加權至 ~85% |

**觀察期長度**：2 Wave（自 P3 baseline 起算；P1 與 P3 可獨立 rollback）。

---

## 8 Hook 觸發頻率與 Action 比追蹤表

每 Wave 結尾（PM 在版本回顧 / Wave 收斂時）更新本表。資料來源：

| 來源 | 路徑 | 用途 |
|------|------|------|
| Hook log | `.claude/hook-logs/<hook-name>/` | 觸發次數（按日期 grep INFO 入口行） |
| Sampling counter | `.claude/hook-logs/_sampling/<hook>.count` | 候選 3 抽樣 hook 的累計觸發 |
| Action 紀錄 | hook log 中的 deny / warning 輸出 | Action 比分子 |

### 追蹤表（每 Wave 更新一列）

| Wave | 日期 | Hook | 觸發次數 | Action 次數 | Action 比 | 變化 vs baseline | 備註 |
|------|------|------|---------|------------|----------|----------------|------|
| baseline | 2026-05-06 | parallel-dispatch-verification | 1586 | 0 | 0% | — | W10-035.3 3d 統計 |
| baseline | 2026-05-06 | bash-edit-guard | 1662 | ~0 | <1% | — | 同上 |
| baseline | 2026-05-06 | acceptance-gate | 1667 | 36 | 2.2% | — | 同上 |
| baseline | 2026-05-06 | worklog-format-check | — | — | — | — | 候選 3 抽樣 N=10 |
| baseline | 2026-05-06 | utf8-integrity-check | — | — | — | — | 候選 3 抽樣 N=10 |
| baseline | 2026-05-06 | language-guard | — | — | — | — | 候選 3 抽樣 N=10 |
| baseline | 2026-05-06 | comment-qa | — | — | — | — | 候選 4 matcher 限定 |
| baseline | 2026-05-06 | file-type-permission | — | — | — | — | 候選 1 提醒級別降級 |
| Wave +1 | （待填寫） | … | … | … | … | … | … |
| Wave +2 | （待填寫） | … | … | … | … | … | … |

> **使用方式**：每 Wave 收斂時新增資料列；超過 2 Wave 後依「觀察期結束評估標準」決定收斂或延長。

---

## Rollback 觸發條件

任一條件成立即啟動 rollback SOP。

| 條件 | 訊號 | 嚴重度 |
|------|------|-------|
| False-negative 出現 | 降級後遇到該 hook 原本應擋的反模式案例（PC 新增或既有 PC 案例增量） | 高（立即 rollback 對應 hook） |
| Action 比異常上升 | 觀察期 Action 比相對 baseline > 2x（且絕對值 > 1%） | 中（評估後 rollback 或調整抽樣 N） |
| 觸發頻率異常上升 | 降級後觸發頻率反而高於 baseline 50%+ | 中（檢查降級邏輯是否破損） |
| 用戶體感劣化回報 | 連續 2+ 案例反映「該擋的沒擋」 | 高（立即 rollback） |
| Sampling counter 異常 | counter 檔不增長 / 暴衝 | 低（先檢查實作再判斷 rollback） |

---

## 快速恢復 SOP

### 場景 A：完全 rollback 一個降級階段

| 階段 | 指令 | 說明 |
|------|------|------|
| P1 整批 rollback | `git revert 05f328b7` | parallel-dispatch / bash-edit-guard / acceptance-gate 全部恢復 |
| P3 整批 rollback | `git revert 4a225bcf` | worklog-format / utf8-integrity / language-guard / comment-qa / file-type-permission 全部恢復 |

P1 與 P3 commit 獨立，可分別 rollback 不互相干擾。

### 場景 B：單一 hook rollback（精準恢復）

1. `git show 05f328b7 -- .claude/hooks/<hook-name>.py .claude/settings.json` 取得降級前後 diff
2. 用 `git checkout <pre-baseline-sha> -- .claude/hooks/<hook-name>.py` 還原該檔
3. 若涉及 settings.json 區段（如 parallel-dispatch-verification 的註冊），手動 patch 對應 PostToolUse 區段
4. 新建 commit：`refactor(rollback): 還原 <hook-name> 降級（觀察期觸發 X 條件）`

### 場景 C：抽樣 N 值調整（不 rollback，僅微調）

候選 3 抽樣機制 hook（worklog-format / utf8-integrity / language-guard）若觀察到 false-negative 但不需完全 rollback：

1. 編輯對應 hook 的 `SAMPLE_N` 常數（從 N=10 降至 N=5 或 N=3）
2. 清除 counter：`rm .claude/hook-logs/_sampling/<hook>.count`（讓新 N 從 0 起算）
3. commit：`tune(<hook>): 抽樣 N 從 10 調整至 X（觀察期 Action 比 Y%）`

---

## 觀察期結束評估標準

2 Wave 結束時（W10-047.4 啟動條件），依以下三項判斷收斂或延長：

| 判斷項 | 收斂條件 | 延長條件 |
|--------|---------|---------|
| False-negative 案例 | 0 件 | ≥ 1 件 |
| Action 比變化 | 全 8 hook < baseline × 2 | 任一 hook ≥ baseline × 2 |
| 用戶體感 | 無劣化回報 | ≥ 2 件回報 |

**收斂行為**：建立 `W10-047.4` 完成 ticket，標記降級為長期生效；本方法論進入「歷史紀錄」狀態。

**延長行為**：依觸發條件啟動對應 rollback SOP；建新 ticket 處理（如 `W10-047.5` 部分 rollback + 重新觀察）。

---

## 與 W10-047.4 的銜接

W10-047.4（驗證 85% 削減）依賴本觀察期數據：

| 啟動條件 | 說明 |
|---------|------|
| 至少 1 Wave 觀察期完成 | 追蹤表至少有 1 筆 Wave +1 資料 |
| 無 rollback 觸發條件命中 | 觀察期內未啟動任何 rollback SOP |
| Hook log 充足 | 8 hook 在觀察期內均有觸發紀錄（避免 zero-data 評估） |

W10-047.4 啟動時讀取本文件追蹤表，用觀察期數據驗證 ~85% 削減假設是否成立。

---

## 相關文件

- `.claude/methodologies/friction-management-methodology.md` — Hook 降級的上位摩擦力管理理論
- `.claude/methodologies/hook-system-methodology.md` — Hook 系統設計原則（含降級判斷依據）
- W10-035.3 ANA — 11 個 Phase 3b 候選 hook 量化分析來源
- W10-047 parent — 4 子 ticket 拆分結構（.1 P1 / .2 P3 / .3 觀察期 / .4 驗證）

---

**Last Updated**: 2026-05-06
**Version**: 1.0.0 — 從 W10-047.3 落地：8 hook 降級觀察期框架（P1 + P3 兩階段獨立 rollback、追蹤表、結束評估標準）
