# 未推送 ticket 鏈一致性審計報告（1.0.0-W1-021 / W1-023 鏈 / W1-024 鏈 / W1-025 / W1-026）

審計範圍：origin/main..HEAD 共 50 個未推送 commit。所有 commit hash 以 `git cat-file -t` 固定值驗證、測試以實際重跑驗證、檔案以 `ls`/`grep -c` 驗證。唯讀執行，未修改任何檔案。

---

## 檢查點 1：completed ticket acceptance 勾選 vs body 實證

### 通過項（有實際指令與輸出，且 ground truth 驗證一致）

| Ticket | 驗證結果 |
|--------|---------|
| W1-021 | Test Results 含指令+輸出+smoke test 四分支表。commit `f8f552b6` 存在；hook 檔 + 測試檔 + settings.json 註冊（grep -c = 2，Edit+Write 兩 block 如宣稱）均存在。重跑：20 tests 含於全套 **2744 passed, 48 skipped** 全綠（2716+28 與 W1-021 宣稱 2716 + W1-026 新增 28 吻合） |
| W1-023.1 | commit `74e095b2` 存在且 stat 與宣稱完全一致（2 files / 120 insertions）。`tool-output-trust-rules.md` 存在且含規則 1-4 |
| W1-023.2 | commit `348d0886` 存在，同時觸及 bash-tool-usage-rules.md 與 IMP-056（與宣稱一致）。bash-rules 現檔含「輸出可疑/被淹沒當下的即時協議」章節 + git -C 首選 |
| W1-023.4.1 | commit `f52feaee` 存在（3 files / +295，含 203 行測試）。本次審計期間裸 cd 實際觸發本 hook warn（含 git -C 建議）——**production runtime 活體驗證通過**，非僅 pytest 綠燈 |
| W1-024.1 | commit `5df3d5f4` 存在。新增 6 測試重跑 **6 passed** 與宣稱一致。全套件 2317 passed（468s）未重跑（成本），以 commit + 重現綠燈接受 |
| W1-026 | commit `c6809c1f` 存在。重跑 test_bash_edit_guard_hook.py **28 passed** 與宣稱一致 |

### 發現 1-1（LOW）：W1-021 執行者欄位與 body 敘事不符

- 證據：`1.0.0-W1-021.md` frontmatter `who.current: saffron-system-analyst`、Completion Info `Executing Agent: saffron-system-analyst`；但 Solution 明寫「派發 basil-hook-architect 背景執行被 deny...改由 PM 親自落地」。
- 影響：後人審計無法從 metadata 得知真實執行者（saffron 僅為建票時預指派）。
- 建議：metadata 更正屬 bookkeeping，可併入下次該檔編輯；或記入 W1-024 B 類（dispatch 可觀測性）素材。

### 發現 1-2（LOW）：W1-023.4.1 執行者跨票矛盾

- 證據：`1.0.0-W1-023.4.1.md` Completion Info 記 `rosemary-project-manager`；`1.0.0-W1-024.md` 重現實驗 B2 列明寫「派發 basil 實作 W1-023.4.1...feat f52feaee...證實完整完成」。
- 影響：B2（最終訊息劫持）實證的歸屬鏈與 ticket metadata 互相矛盾，正是 B2 問題本身的又一例。
- 建議：同發現 1-1，作為 W1-024 B2 的佐證素材記錄。

### 發現 1-3（LOW）：W1-023.2 未在 ticket body 記錄 commit SHA + bash-rules footer 未 bump

- 證據 a：W1-023.1 記錄了 `74e095b2`，但 W1-023.2 Solution 只寫「依報告補修後再 commit」無 SHA（實際 commit `348d0886` 存在，需 git log 考古才能對上）。
- 證據 b：`348d0886` 對 bash-tool-usage-rules.md 新增整個章節，但檔尾仍為 `Last Updated: 2026-05-29 | Version: 2.2.0`（grep 確認該 commit 未觸及 footer 行），違反本 repo 規則檔「實質變更須 bump 版本/日期」慣例（同檔 2.0→2.2 歷史皆有 bump）。
- 建議：footer bump 可併入下次 DOC 編輯；SHA 補記為選擇性。

### 發現 1-4（LOW）：placeholder 殘留（均屬 schema 選填章節，不阻擋）

- W1-023.1 / W1-023.2 / W1-023.4.1 / W1-026 的 Problem Analysis 留「（待填寫…）」placeholder——DOC/小型 IMP 該章節為選填，schema 合規；W1-026/W1-023.4.1 實質根因已寫在 Context Bundle，資訊未遺失。僅列出供知悉。

---

## 檢查點 2：ANA Solution spawn 規劃 vs frontmatter 落地（quality-baseline 規則 5）

### W1-023（completed）：通過

- Solution spawn 規劃：保留 3 項 DOC + 評估 1 項 ANA + 火星追查 1 項 ANA + 否決 3 項（含理由）。
- frontmatter `children: [.1, .2, .3, .4]`：DOC 3 項合併落地為 .1（PC-166 升級+協議規則）+ .2（bash-rules+IMP-056），ANA 2 項 = .3（火星）+ .4（hook 評估）。覆蓋 1:1（合併有記載），4 children 全 completed，commit `23936ef4` 記錄 spawn。否決項顯性標註理由，符合規則 5 豁免要求。

### W1-023.3 / W1-023.4（completed）：通過

- .3 顯性寫「無需 spawn 落地 + 理由」（避免 PC-091 重複，hook 後續由 .4 承接）。
- .4 spawn 子 IMP .4.1 並回填 children，已 completed。

### W1-024（in_progress）：尚未到 complete 閘門，但有 2 項待 PM 注意

**發現 2-1（MEDIUM）：W1-024.1 委回 parent 的裁決項未出現在 W1-024 body**

- 證據：`1.0.0-W1-024.1.md` Problem Analysis（line 82）寫「decision-tree 驗證提前退出屬同模式第三來源...裁決留待**本票 complete 前的多視角審查**」，但該票已 complete（03:03:58）且無審查記錄；Solution 改錨「由 parent W1-024 複審裁決」。然而 `1.0.0-W1-024.md`（Solution 寫於 02:08，早於 W1-024.1 發現）**全文無 decision-tree 提前退出任何字樣**。
- 影響：trigger 形式上合法（綁 W1-024 ticket ID），但 W1-024 complete 時若 PM 未回讀 W1-024.1 body，此項會靜默蒸發（PC-093 模式的實際風險點）。另 PA 與 Solution 兩處錨點不一致（本票審查 vs parent 複審）。
- 建議：W1-024 complete 前將「decision-tree 提前退出第三來源裁決」補入其 Solution 逐項評估表（裁決 spawn 或顯性否決）。

**發現 2-2（LOW）：W1-024 spawn 表 4 列 vs frontmatter 連結僅 1 筆**

- 證據：Solution spawn 表 4 列——A2+A3 → children `W1-024.1` 已落地；A4 → 「併入 W1-025（已存在，建議 broaden）」已執行（commit `47b5edf7`）；裸 cd 排除過寬 → W1-026 已存在（其 relatedTo 指 W1-023.4.1 非 W1-024）；A5 → W1-025 已存在。frontmatter `spawned_tickets: []`、`relatedTo: []`。
- 影響：4 項規劃實質全落地（無遺漏），但 W1-024 frontmatter 對 W1-025/W1-026 零連結，acceptance-gate Step 2.5.2 在 complete 時做「Solution spawn 規劃 vs spawned_tickets+children 數量一致性」偵測可能阻擋或需豁免標註。
- 建議：complete 前將 W1-025 / W1-026 加入 `relatedTo`（或表內加「已存在 ticket 非本票 spawn」顯性標註），降低 gate 誤擋與追溯成本。

---

## 檢查點 3：W1-025 是否真的 broaden 納入 W1-024 A4

**通過。**

- `1.0.0-W1-025.md` acceptance 第 2 項：「append-log section 白名單與 ticket-body-schema 必填章節對齊（含 Completion Info 等缺漏項，**W1-024 A4 併入**）」——A4 的「白名單 vs schema 對齊」與具體缺漏項（Completion Info）皆已寫入。
- commit `47b5edf7 chore(1.0.0-W1-025): broaden 範圍納入 W1-024 A4` 存在。
- 票仍 pending、Solution/Test Results 留 placeholder——與 pending 狀態一致，正常。

---

## 檢查點 4：status / completed_at 欄位 vs 實際狀態

**通過（含 2 個低度觀察）。**

| Ticket | status | completed_at | 一致性 |
|--------|--------|--------------|--------|
| W1-021 / .1 / .2 / .3 / .4 / .4.1 / W1-024.1 / W1-026 | completed | 均非 null | 一致；各有 metadata sync post-completion commit |
| W1-024 | in_progress | null | 一致（Completion Info 為 (pending)，acceptance 未勾） |
| W1-025 | pending | null（started_at 亦 null） | 一致 |

- 觀察 a（LOW）：W1-025 `who.current: thyme-python-developer` 但 `assigned: false`——pending 票預指派執行者，非錯誤，claim 時會正規化。
- 觀察 b：執行者欄位失真見發現 1-1 / 1-2。
- 觀察 c（LOW）：multi_view 欄位 key 命名不一致——W1-023.3 用 `multi_view_reason:`，W1-023.4 與 W1-024 用裸 `reason:`（PC-117 flat YAML 教訓的延伸面：欄位名漂移可能影響 hook regex 判定）。建議統一為 `multi_view_reason`。

---

## 檢查點 5：無 trigger 延後話術掃描

主要話術（之後再/以後再/暫緩/待後續/下次再/將來）全檔掃描：**零命中**。軟性話術掃描命中 4 處，逐一判定：

| 位置 | 字面 | 判定 | Severity |
|------|------|------|----------|
| W1-024.1:82 | 「裁決留待本票 complete 前的多視角審查」 | 已 complete 但無審查記錄；Solution 改錨 parent W1-024（合法 trigger），但 parent body 未承接 → 見發現 2-1 | MEDIUM |
| W1-023.4:102 | 「殘留率需後續觀察」 | 無 ticket 錨點的軟延後。緩解：決策（建 hook）已下，觀察非決策前提；acceptance 漂移已在同段顯性記錄 | LOW |
| W1-023.1:95 | 「basil-writing-critic 複審中」 | completed 票內殘留進行式陳述。實際已解決：commit `f39446b9 fix(1.0.0-W1-023.1): basil Layer 2 修正` 存在，僅 body 未回寫結果 | LOW |
| W1-023.4:145 | 「最終路徑待用戶定奪」 | 同票後段「最終決策(用戶定奪)：擴充宿主」已收斂，非延後 | 通過 |

---

## 檢查點 6：tickets/ 目錄下 1.0.0-W1-024.md.lock

**通過（by-design，非垃圾檔，無需動作）。**

- 證據鏈：(a) `.gitignore` line 22-24 含 `*.lock`，註解明寫「W14-042: per-ticket-file advisory lock 殘留（fcntl.flock，crash 自動釋放）」；(b) `git ls-files ... | grep -c '\.lock$'` = **0**（零追蹤）；(c) `git status --porcelain --untracked=all` 對該目錄輸出為空（被 ignore）；(d) 該目錄幾乎每張 ticket 都有對應 0-byte .lock（021/023 全鏈/024/024.1/025/026），非 W1-024 獨有。
- 結論：ticket CLI 的 advisory lock 殘留為已知設計（fcntl.flock 不需檔案內容、crash 自動釋放鎖），不進 git、不污染 commit。可選擇性清掃但無風險與必要性。

---

## 附帶活體觀察（非檢查點，供 PM 參考）

本次審計執行中審計者自身一次裸 `cd /tmp && grep ...` 實際觸發：(1) chpwd ls 淹沒（grep 結果被 /tmp 目錄列表取代）；(2) bash-edit-guard hook warn 正確發出（含 git -C 建議與規則引用）。此為 W1-023.4.1 + W1-026 交付物在 production 環境的第三方活體驗證——hook 偵測、warn-not-deny、訊息引導全部如規格運作；同時也再次自證 soft rule 失效論（審計者讀過全部規則仍裸 cd），與 W1-023.4 dogfooding 結論一致。

---

## 結論總表

| 檢查點 | 結果 | 發現 |
|--------|------|------|
| 1 acceptance vs 實證 | 通過 | 1-1/1-2 執行者欄位失真（LOW x2）、1-3 SHA 未記+footer 未 bump（LOW）、1-4 選填 placeholder（知悉） |
| 2 spawn 1:1 落地 | completed ANA 全通過 | 2-1 decision-tree 裁決項未進 W1-024 body（**MEDIUM**）、2-2 W1-024 frontmatter 零連結 W1-025/026（LOW） |
| 3 W1-025 broaden | 通過 | 無 |
| 4 status 一致性 | 通過 | multi_view 欄位 key 漂移（LOW） |
| 5 延後話術 | 通過 | W1-023.4 後續觀察無錨點（LOW）、W1-023.1 複審中已過期（LOW） |
| 6 .lock 檔 | 通過（by-design） | 無 |

無任何 HIGH 級發現；無 confabulation 跡象（全部 commit hash / 測試數字 / 檔案宣稱經固定值驗證為真）。唯一 MEDIUM（2-1）建議在 W1-024 complete 前處理。

---

## 附錄：審計期間 Hook 錯誤訊號核查（SubagentStop 摘要回應）

SubagentStop 摘要報告 3 個 hook 近 5 分鐘有錯誤記錄，已逐一核查 `.claude/hook-logs/`：

| Hook | 錯誤內容（2026-06-10 03:12） | 影響審計？ |
|------|---------------------------|-----------|
| uv-tool-staleness-check | `hash computation failed for <skill>: disk error` x N（mermaid-ascii/worktree/branch-worktree-guardian/project-init 等） | 否（skill hash 計算瞬時 disk error，與審計工具呼叫無關） |
| ticket-quality-gate | `tool_input 缺少必要欄位: content` + `輸入格式錯誤`（同日誌另有大量正常「驗證通過/短路放行」記錄） | 否（單筆輸入格式異常，疑似並行 session 工具呼叫形狀異常；本審計所有 Write/Edit 均成功） |
| command-entrance-gate | 同時段 1 筆錯誤記錄 | 否 |

判定依據：本審計全程工具呼叫無 deny / 無失敗（僅一次裸 cd warn，allow 放行），所有驗證命令均回傳真實資料，報告寫入成功。錯誤屬環境瞬時 + 並行 session 雜訊，未污染本報告任何結論。同時段日誌顯示 03:14:08 有並行代理人寫 `/tmp/w1024-review-hook-fix.json`（疑為同 wave 另一審計子任務）。
