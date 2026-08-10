# 團隊設計評估記錄：.claude agent 框架（發射管制隊視角）

- 受評對象：book_overview_app 與 book_overview_v1 共用的 `.claude` agent 框架（subtree sync、上游 tarrragon/claude）
- 評估日期：2026-08-10
- 承擔者：tarragonstop（發起與歸檔）
- 評估方法：team-design-evaluation 五 lens 判讀協議（發射管制隊視角）；skill 出處：https://github.com/tarrragon/claude-skills
- 觸發緣由：基線（第一次評估）
- 前置定位：agent 團隊（編組成本趨近零端、主 context 為混合節點）——編組數量軸找「多的與有名無實的」、協調結構查缺口
- 任務單位：ticket（執行）→ wave（規劃）→ version（交付），`{version}-W{wave}-{seq}`，前置條件滿足

## 總表

| Lens               | 現狀                                                            | 判讀                                                     | 行動                          |
| ------------------ | --------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------- |
| 常設 vs 編成       | registry 常設層 + dispatch log 歷史、rosemary（主 context）為唯一調度點 | 編成可事後重建（log 過濾）、非一等公民記錄；解編有 hook 自動化；一等記錄的維護成本未過正當化門檻、保留成立 | 保留                          |
| 執行與安全監理分線 | 六個審查 agent 全數只回報、否決權收斂在派發與彙整同一方（PM）   | 驗收 gate 讀 ticket 關鍵字、含「PM 直接驗收」自我通過路徑；clove「強制觸發」無機制且 0 派發 | 改（issue #70、#71）          |
| 業務 vs 編組       | 30 名冊約 1/3 零派發、2 名 deprecated 在冊、mint 可規則化       | 零編組成本增生證實；project-compliance 高權限 + 零使用   | 改（issue #72、#73、#74）     |
| 指揮中樞           | 狀態散 8+ 來源、runqueue 聚合視圖讀取失敗靜默                   | 「恢復中斷要拼多來源」症狀有機器證據（data_source_errors）| 改（issue #75、#76）          |
| 對外協作面         | handoff CLI + 雙軌不同步偵測 hook + archive、承擔者明確為 PM    | 交接已出口條件化、五個 lens 裡最健康                     | 保留                          |

## 主要證據

1. **驗收訊號可自我寫入**：acceptance-gate 讀 ticket frontmatter checkbox 與 body 關鍵字（`hooks/acceptance_checkers/acceptance_checker.py:129-157`、關鍵字含「PM 直接驗收」）、警告級不阻擋；acceptance-auditor 文件自承「Hook 通過 ≠ 驗收通過」。六個審查 agent 定義全部明文「只提供建議、決策由 PM 負責」。
2. **名冊膨脹**：registry 登記 30 名、含 2 名 deprecated（兩專案名冊差一名：app 為 29、少 dill-javascript-developer）。dispatch log 約 1000 筆（`.claude/logs/agent-dispatch.jsonl`、含 rotated 檔）中 10 名零派發；impeccable 有實質工作卻未登記；mint 的工作是 `dart fix` / `dart format` 的 agent 包裝。
3. **聚合層靜默失敗**：v1 `logs/pm-automation-metrics.jsonl` snapshot 帶 `data_source_errors`（dispatch-active / handoff-pending / ticket-query）；全局狀態散在 8+ 來源、runqueue 是計算視圖。
4. **文字介面脆弱殘留**：兩專案根目錄有 hook 提示文字誤建的目錄（「（待恢復 handoff）…」）——指揮中樞 lens 的周邊觀察、行動走缺口分流的專案 ticket。
5. **健康面**：handoff 純指針結構 + `stop-worklog-handoff-sync-check-hook` 雙軌偵測、archive 累積 93 筆；dispatch 生命週期三 hook 自動管理；phase4 延後話術與 hook 測試紅燈有硬阻擋。

## 缺口分流

框架設計問題（tarrragon/claude issues）：

| Issue | 主題 |
| ----- | ---- |
| [#70](https://github.com/tarrragon/claude/issues/70) | acceptance-gate 驗收訊號可被裁量方自我寫入 → verdict 檔機制 |
| [#71](https://github.com/tarrragon/claude/issues/71) | clove-security-reviewer「強制觸發」宣稱無執行機制 |
| [#72](https://github.com/tarrragon/claude/issues/72) | mint-format-specialist 可規則化、降為 hook / script |
| [#73](https://github.com/tarrragon/claude/issues/73) | registry 名冊衛生（deprecated 除籍、impeccable 登記、零派發分層） |
| [#74](https://github.com/tarrragon/claude/issues/74) | project-compliance-agent 高權限與零派發並存 |
| [#75](https://github.com/tarrragon/claude/issues/75) | runqueue 聚合失敗靜默（data_source_errors） |
| [#76](https://github.com/tarrragon/claude/issues/76) | PM_INTERVENTION_REQUIRED / pm-status 機制遺跡 |

專案修正 ticket：app `0.38.1-W2-029`、v1 `1.6.1-W4-001`（誤建目錄清理與原因確認）。

## 下次觸發

- 整套評估：框架重組時（issue #70-#76 處理完後重跑一次對照）
- 單 lens：症狀觸發表命中時（名冊再膨脹 → 業務 vs 編組；block 後仍上線 → 安全分線；狀態拼湊 → 指揮中樞）
