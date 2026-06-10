# W1-024 對抗性盲點掃描報告

**目標**：反證「W1-024 的問題已被完整解決」。
**方法**：唯讀追蹤 create.py 全流程 + 裁決表逐項對照專案自有證據（PC-115、SKILL.md、其他建票路徑、argparse 註冊掃描）。
**總結**：5 項挑戰中 2 項成立、2 項部分成立、1 項大部分不成立。「完整解決」不成立——A2 修復只統一了 checklist 階段內的報錯，跨階段分批報錯仍在；其他建票路徑完全繞過必填驗證；B1 裁決與專案自有 PC-115 收斂結論直接矛盾。

---

## 挑戰 1：A2 修復後是否仍有分批報錯 — **部分成立（severity: Medium-Low）**

### execute() 提前退出點完整順序（create.py）

| 順序 | 退出點 | 位置 | errno |
|------|--------|------|-------|
| 0 | argparse `required=True`（--action/--target，單一訊息一次列出兩者） | create.py:1616-1617 | argparse exit 2 |
| 0' | `--how` 攔截（A3 修復） | create.py:1632-1634 | parser.error |
| 1 | 版本偵測失敗 | create.py:1277-1285 | VERSION_NOT_DETECTED |
| 2 | 版本未註冊 | create.py:1288-1297 | VERSION_NOT_REGISTERED |
| 3 | 根任務缺 --wave | create.py:592-599 | MISSING_WAVE_PARAMETER |
| 4 | Ticket ID 格式 | create.py:605-611 | INVALID_TICKET_ID_FORMAT |
| 5 | --source-ticket 驗證（互斥/格式/存在） | create.py:1305-1308（實作 1159-1228） | SOURCE_* |
| 6 | decision-tree 缺失（**獨立提前退出，在 checklist 之前**） | create.py:204-215, 227-249 | DECISION_TREE_MISSING_ALL / PARTIAL |
| 7 | blockedBy 不存在/循環 | create.py:1111（實作 78-130） | BLOCKED_BY_* |
| 8 | checklist 一次列全（where.files/acceptance/when/who/what/why/how_strategy/decision_tree_path） | create.py:1114-1117（實作 862-967） | CHECKLIST_VALIDATION_FAILED |

### 「全部欄位都缺」模擬（裸 `ticket create` 起步）

| 輪次 | 報錯 |
|------|------|
| 1 | argparse：--action, --target required（一次列兩個） |
| 2 | MISSING_WAVE_PARAMETER |
| 3 | DECISION_TREE_MISSING_ALL |
| 4 | CHECKLIST_VALIDATION_FAILED（when/who/why/how_strategy/where.files/acceptance 一次列全） |
| 5 | 建立成功 |

**4 輪報錯才建成**（修復前為 5 輪）。若同時帶錯誤 --blocked-by 或 --source-ticket，各再 +1 輪（順位 5/7 在 checklist 之前）。

### 結論

A2 修復屬實但範圍有限：只把 `WHY_REQUIRED` 併入 checklist（commit 5df3d5f4），「一次列全」僅在 checklist 階段內成立。decision-tree（create.py:209）與 wave（create.py:592）仍是獨立提前退出。**緩解因素**：W1-024.1 Problem Analysis「已識別未納入本票範圍」明文記錄 decision-tree 同模式，且裁決綁定「parent W1-024 複審」trigger（本掃描即為該複審）——符合 decision-trigger-binding 狀態 (b)。但 wave 階段未被任何文件記錄為已知分批來源。

**對抗性裁定**：「分批報錯已完整解決」不成立；「A2 acceptance 範圍內（why/when/who/how_strategy）已解決」成立。**待 W1-024 複審裁決：decision-tree 提前退出是否併入 checklist（同 A2 手法，刪路徑而非加聚合層；checklist 本含 decision_tree_path 檢查，create.py:888-900，雙軌冗餘與 why 修復前同構）。**

---

## 挑戰 2：A1 裁決是否構成無 trigger 延後 — **部分成立（severity: Low-Medium）**

### 證據

1. **SKILL.md 未標註慣例**：grep `/Users/tarragon/Projects/book_overview_v1/.claude/skills/ticket/SKILL.md` 全文，僅有 `ticket create` 用法範例（line 51/119/152 等），**無任何「create 是頂層命令、claim/complete/append-log 在 track 之下，勿用 track create」的慣例說明**。A1 的觸發場景（PM 誤打 `ticket track create` 得 INVALID_CHOICE）的最低成本防護（一行文件標註）未落地。
2. **裁決文字**：「無需 spawn：低收益高風險。可選 DOC（SKILL 標註慣例或加 track create alias），**不強制本 wave**」（W1-024.md:127）。

### 分析

- 「無需 spawn：低收益高風險」對 **alias 修改**是合法狀態 (a)（已決策 + 理由），符合 quality-baseline 規則 5 豁免格式。
- 但「可選 DOC……不強制本 wave」是第三態：既非「無需建 ticket：理由」的明確豁免，也非綁 ticket ID 的延後。依 decision-trigger-binding 規則 1「兩種合法狀態，沒有第三種」與規則 1.5（ticket body 禁述未綁錨點的未來考量），「可選、不強制」= 無 trigger 延後變體。
- DOC 標註與 alias 修改的風險不同質：標註 SKILL.md 慣例**零 Never-break-userspace 風險**（純文件），「低收益高風險」理由只覆蓋 alias，不覆蓋 DOC——豁免理由與豁免對象錯位。

**對抗性裁定**：成立（針對「可選 DOC」半截決策）。修正方向：W1-024 complete 前改寫 A1 裁決為（a）「無需任何動作：理由」或（b）spawn 一張 DOC ticket 標註 SKILL.md 慣例。

---

## 挑戰 3：B1-B4「無需 spawn」是否有可框架修復項被誤歸 runtime limitation — **B1 成立、B2 部分成立、B3/B4 不成立**

### B1（severity: Medium）— 裁決與專案自有結論直接矛盾

W1-024 B1 裁決：「**CC runtime hardcoded 保護，非框架可改**……subagent 完全做不了 → 框架開發任務無法派發，全壓 PM」（W1-024.md:82, 138）。

但 `PC-115-subagent-claude-dir-edit-runtime-deny-without-log.md` 的收斂結論相反：

- line 112：「W17-097.1-.4 DENY 4/4 真實根因 = **transient runtime fluctuation**」
- line 142：「三個獨立 session 共 6 次 Edit 全部 success，0 deny，base rate 0%」
- 防護表：「subagent 對主 repo 樹內 `.claude/` Edit **可預期 success**（9 次連續 success）」
- line 227+：W1-068 三方 deadlock 變體已收錄於 PC-115 末章節，含升級 trigger（「再次出現時評估升級獨立 PC」）

「hardcoded 保護、完全做不了」是對單一事件（W1-068 三次 deny）的過度泛化，與專案兩輪受控實驗（W17-099~109）矛盾。此誤定性有實際決策後果：PM 會系統性放棄派發 `.claude/` 修改類任務，而證據顯示通常成功（PC-137 統計：≤2 並行 7-0 全勝）。另外 W1-068 的 deny 未計入 PC-115 累積表（表末筆為 2026-05-09 W17-174.*；W1-068 為 2026-05-25，僅以變體章節收錄）——若依累積表 trigger 機制，3 次 deny 應觸發記錄審查。

**裁定**：B1「無需 spawn」結論可維持（PC-115 已有事件 trigger 承接），但**裁決理由錯誤**，須在 W1-024 Solution 更正定性（transient + 條件性，非 hardcoded 絕對），否則本 ANA 成為與 PC-115 衝突的第二權威來源（違反 error-pattern 衝突同步處理原則）。

### B2（severity: Medium-Low）— 未驗證劫持來源即歸為 runtime limitation

裁決稱「回合結束 hook 覆寫 agent 回傳值……屬已知 workaround」（W1-024.md:139），但未調查劫持訊息的**來源**。settings.json 註冊了 **7 個專案自有 Stop hooks**（evaluate-session.py、handoff-auto-resume-stop-hook.py、session-experience-persistence-reminder-hook.py、worktree-auto-commit-hook.py、stop-worklog-handoff-sync-check-hook.py、malformed-tool-call-detector-hook.py、context-depth-warning-hook.py）。若劫持提示中任何部分源自這些 hooks，則「在 subagent context 靜默」是框架可修的（hook 內偵測 subagent session 即跳過輸出）。裁決把「未調查」寫成「不可修」，屬證據不足的限制性結論（tool-discovery 規則 2：採限制性解法前先問探索性框架）。

**裁定**：部分成立。不要求立刻 spawn IMP，但「無需 spawn」的前提（劫持源頭=CC runtime 而非專案 hooks）未驗證，應降級為「待驗證」或 spawn 一張小 ANA（重現一次劫持並比對 7 個 Stop hooks 的輸出指紋）。

### B3 — 不成立（裁決可辯護）

「hook 難在 PreToolUse 知 agent role」基本屬實：PreToolUse hook 輸入無 agent 身分欄位，並行派發下無法歸因。粗粒度替代（read-only dispatch 活躍期間全域 deny `git checkout --`/`git restore`）技術上可行但誤傷面大（PM 自己也會被擋）。「prompt 明示 + 審查上報」為現行解的裁決合理。輕微保留：裁決未列「粗粒度 guard 已評估且不採」的理由，但此屬論述完整度，非誤分類。

### B4 — 不成立

W1-023 鏈產物可驗證存在：`tool-output-trust-rules.md`（自動載入）、PC-166 防護 A-E、裸 cd hook（W1-026 commit c6809c1f）。覆蓋宣稱屬實。

---

## 挑戰 4：其他建票路徑必填驗證缺口 — **成立（severity: Medium-High）**

### 證據

`_validate_create_checklist` / `_enforce_create_checklist`（W11-003.5 阻擋層）**只存在於 create.py 命令層**，三條旁路全部繞過：

| 路徑 | 證據 | 建出的 ticket 欄位 |
|------|------|------------------|
| `ticket batch-create`（bulk_create.py） | bulk_create.py:115-130 `_create_ticket_config` → :241-251 直接 `create_ticket_frontmatter` + `save_ticket`，全檔 0 處 checklist 引用 | `why=""`（:127）、`when="待定義"`（:124）、`who="pending"`（:122）、`where_files=[]`（:126）、無 acceptance、無 decision_tree_path |
| `ticket generate`（generate.py → ticket_generator.py） | generate.py:114-147 `_save_tickets` 直接 `save_ticket`；ticket_generator.py:232-242 | `who="pending"`（:232）、`when="待定義"`（:234）、`acceptance=None`（:242）；why 有 fallback（plan_description or "Plan 來源"，:237） |
| `ticket migrate` / version_shift | migrate.py:198, 419 直接 `save_ticket`（搬移既有票，欄位缺失屬繼承非新建，影響較低） | — |

且無 hook 安全網：PostToolUse Write hooks（ticket-creation-validation-hook 等）只攔 Write 工具，CLI 經 Python `save_ticket` 寫檔不觸發；post-ticket-lifecycle-hook.py 與 ticket-creation-validation-hook.py 中 grep `batch-create|bulk|generate` 零命中。

### 分析

W11-003.5 把「5W1H 必填」升級為**阻擋**，其不變量宣稱是「不可建出缺必填欄位的票」；但驗證放在 create.py 命令層而非 ticket_builder 持久化層，等同「前門裝鎖、側門敞開」。`ticket create --type IMP` 缺 why 被擋（A2 修復場景），`ticket batch-create --template x --targets "a"` 建出 why="" 的 IMP 卻靜默成功——同一不變量在不同入口執法不一致。batch-create 模板可提供預設值屬設計意圖，但模板未覆蓋時的 fallback 是空字串而非阻擋或警告。

**裁定**：成立。這是 W1-024「必填驗證」問題域內未被識別的盲點（ANA 的 A2 只看 create 單一路徑）。建議 spawn IMP：將 checklist 驗證下沉至 builder 層或在 bulk_create/generate 寫檔前複用 `_validate_create_checklist`（warning 級起步避免 break 既有模板流程）。

---

## 挑戰 5：其他子命令 argparse 縮寫歧義同模式 — **成立（severity: Medium-Low）**

### 證據

全 ticket_system 無任何 `allow_abbrev=False`（grep 零命中），所有 subparser 保持 prefix matching。掃描「未註冊的自然前綴 token 同時匹配 2+ 已註冊旗標」（即 A3 `--how` 同構模式）：

| 子命令 | 歧義 token | 撞旗標 | 用戶誤打可能性 |
|--------|-----------|--------|--------------|
| `create` | `--decision-tree` | --decision-tree-entry / -decision / -rationale（create.py:1649-1651） | 高（三聯旗標，PM 易誤以為單一 `--decision-tree` 旗標，與 --how 誤打動機同構） |
| `handoff` | `--from` | --from-ticket-id / --from-worklog | 高（自然英文單詞） |
| `handoff` | `--to` | --to-child / --to-parent / --to-sibling | 高（自然英文單詞） |
| `track set-acceptance` | `--all` | --all-check / --all-uncheck | 高（`track check-acceptance --all` 為合法旗標，肌肉記憶遷移到 set-acceptance 即撞歧義） |

備註：`--where`（撞 --where-layer）與 `--reason`（track close，撞 --reason-note）因本身已顯式註冊，exact match 優先，無歧義——不列入。

### 分析

A3 修復（`_AmbiguousHowAction`，create.py:1578-1591）是 `--how` 單點攔截，設計決策明言不採 `allow_abbrev=False`（W1-024.1 Solution 決策 3，理由成立：避免關閉全部無歧義縮寫）。但同模式至少還有 4 個高可能性歧義 token 分布在 3 個子命令，均會吐 argparse 原生英文 ambiguous 訊息（A3 要修的正是這個 UX）。其中 `track set-acceptance --all` 與姊妹命令 `check-acceptance --all` 的旗標不對稱尤其易踩。

**裁定**：成立。A3 修的是實例不是模式。建議 spawn 小 IMP：對上表 4 個 token 套用同款攔截 action（或建共用 `AmbiguousPrefixAction(hint_map)` helper 消除重複）。

---

## 總裁定表

| # | 挑戰 | 裁定 | Severity | 關鍵證據 |
|---|------|------|----------|---------|
| 1 | A2 後仍分批報錯 | 部分成立（4 輪試錯；checklist 階段內已列全；decision-tree 缺口已綁 parent 複審 trigger） | Medium-Low | create.py:209/592/1111/1115 |
| 2 | A1「可選 DOC 不強制」 | 部分成立（第三態措辭違反 decision-trigger-binding 規則 1；SKILL.md 確無慣例標註） | Low-Medium | W1-024.md:127；SKILL.md grep 零命中 |
| 3 | B1-B4 誤歸 runtime limitation | B1 成立（定性與 PC-115 收斂結論矛盾）；B2 部分成立（劫持來源未驗證，7 個專案 Stop hooks 為嫌疑）；B3/B4 不成立 | B1 Medium / B2 Medium-Low | PC-115:112/142/防護表；settings.json Stop 區段 |
| 4 | 其他建票路徑驗證缺口 | 成立（bulk_create/generate 完全繞過 checklist，無 hook 安全網） | Medium-High | bulk_create.py:115-130, 241-251；ticket_generator.py:232-242 |
| 5 | argparse 縮寫歧義同模式 | 成立（--decision-tree / --from / --to / --all 四處同構歧義；無 allow_abbrev 治理） | Medium-Low | create.py:1649-1651；handoff.py；track.py set-acceptance |

### 對 W1-024 complete 前的建議動作

1. **A1 裁決改寫**：消除「可選……不強制」第三態（spawn DOC 或明確「無需建 ticket：理由」）。
2. **B1 定性更正**：Solution 中「hardcoded 保護、完全做不了」改為「transient deny（PC-115 base rate 0%）+ W1-068 deadlock 變體已含升級 trigger」，避免雙權威衝突。
3. **挑戰 4/5 為新發現**：依 quality-baseline 規則 5，complete 前需 spawn（bulk_create/generate 驗證下沉 IMP；4 token 歧義攔截 IMP）或顯性豁免。
4. **decision-tree 提前退出**：本複審建議併入 checklist（與 A2 同手法），由 PM 裁決是否 spawn。
