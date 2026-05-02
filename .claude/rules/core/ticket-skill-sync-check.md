# Ticket Skill 行為變更同步檢查規則

本文件規範 ticket skill 源碼（`.claude/skills/ticket/ticket_system/`）發生行為變更時，必須同步掃描決策層文件，防止行為層與決策層脫節。

> **來源**：W17-115.2 — 落地 ANA W17-115 的 B 路徑（rules/core 規則補強），與 PC-118（error-pattern）+ W17-115.3（commit-level hook）形成三層防護組合。

---

## 適用範圍

| 對象 | 是否適用 |
|------|---------|
| PM（主線程）修改 ticket skill src | 是 |
| 代理人修改 ticket skill src | 是 |
| 修改 `.claude/rules/`、`.claude/pm-rules/`、`.claude/skills/ticket/SKILL.md` 本身 | 否（不觸發本規則，但若內容涉及 ticket skill 行為，仍需人工確認一致性） |

---

## 強制規則

### 規則 1：ticket skill 行為變更必須觸發同步掃描

**觸發情境**：對 `.claude/skills/ticket/ticket_system/` 目錄下任何 `.py` 檔案進行 Write / Edit（屬於新增命令、變更現有命令語意、調整 flag 行為、修改 complete 條件、更換子命令名稱等行為變更性質的改動）。

**待掃描目標清單**：

| 目標文件 | 說明 | 掃描指令 |
|---------|------|---------|
| `.claude/skills/ticket/SKILL.md` | ticket CLI 對外契約（子命令清單、flag 說明） | `grep -n "ticket track\|/ticket" .claude/skills/ticket/SKILL.md` |
| `.claude/pm-rules/decision-tree.md` | PM 決策路由（Re-center / claim / complete 路徑） | `grep -n "ticket track\|/ticket\|runqueue\|next\|schedule\|resume-hint" .claude/pm-rules/decision-tree.md` |
| `.claude/pm-rules/*.md` | 所有情境 SOP（ticket-lifecycle / session-switching / behavior-loop-details / handoff 等） | `grep -rln "ticket track\|/ticket" .claude/pm-rules/` |

**Why**：ticket skill 是 PM 操作 ticket 的唯一介面。子命令語意、flag 行為、complete 條件一旦改變，決策樹與 SOP 中的引用若未同步，PM 執行既有流程時會靜默失效——命令仍然可以執行，但語意已不同，後人照 SOP 操作會得到錯誤的結果。W17-113（禁用無 trigger 延後決策）和 W17-114（決策樹閉環流程）即此類事後補償的具體案例。

**Consequence**：跳過同步掃描會讓決策層文件逐漸累積過時引用。過時引用不會直接報錯，會在 PM 或代理人引用時產生「文件說可以這樣做但實際行為不同」的靜默失效。補償成本隨時間遞增：發現越晚，需要追溯的 SOP 越多，修正範圍越難界定。

**Action**：

1. 完成 ticket skill src 改動後，commit 之前執行上方掃描指令。
2. 對每個含舊行為引用的文件，評估是否需要更新：
   - 文件引用仍正確 → 無需改動
   - 文件引用舊命令名稱 / 舊 flag / 舊 complete 條件 → 當場更新，納入同一 commit 範圍
3. 若範圍過大（> 5 個文件需更新），建立獨立 DOC Ticket 追蹤後再繼續其他工作。**禁止只口頭記錄「之後再更新」而不建立 Ticket**（違反 `quality-baseline.md` 規則 5）。

### 規則 2：重大行為變更範例與掃描重點

以下歷史案例作為「哪些改動屬於行為變更」的判別參考：

| 歷史案例 | 性質 | 影響到的決策層文件 |
|---------|------|-----------------|
| `runqueue` 取代 `next` / `schedule` / `resume-hint` | 子命令名稱更換 | `decision-tree.md`（Re-center Protocol）、`session-switching-sop.md` |
| `append-log` 加入 `--section` 必填參數 | flag 語意新增 | `pm-role.md`、所有引用 `append-log` 的 SOP |
| type-aware body schema（IMP/ANA/DOC 各有必填章節） | `complete` 條件改變 | `ticket-lifecycle.md`、`agent-definition-standard.md` |
| `show` 子命令引入（取代直接 cat ticket md） | 新增子命令 | `decision-tree.md`（查詢路徑）、`behavior-loop-details.md` |
| Context Bundle 自動抽取（claim 時自動填入） | 命令副作用改變 | `pm-role.md`（派發前必讀）、`agent-dispatch-template.md` |

**使用方式**：看到類似性質的改動時（命令名稱 / flag 必填性 / 副作用 / 隱式前提），對應觸發同步掃描。

### 規則 3：純修復型改動豁免

以下性質的改動**豁免本規則**（不需執行全量掃描）：

| 豁免類型 | 範例 | 判別方式 |
|---------|------|---------|
| 純 bug fix（語意不變，僅修正錯誤行為） | 修正 YAML 解析 None guard、修正狀態轉移邏輯錯誤 | commit msg type 為 `fix` 且不新增 / 移除 / 重命名任何子命令或 flag |
| 測試程式碼改動 | `tests/` 目錄下 | 路徑不在 `ticket_system/` 下 |
| 僅改動輸出格式（顯示對齊、色彩、log level） | terminal 對齊、欄位對齊 | 命令執行語意不變，只影響人眼可讀性 |

**判別準則**：改動後 PM 依舊有流程文件中的命令形式操作，能得到等效結果 → 豁免。反之（命令名稱改、flag 新增必填、隱式行為改）→ 觸發同步掃描。

---

## 同步掃描執行流程（快速版）

```bash
# Step 1: 確認 ticket skill src 改動範圍
git diff --name-only | grep ".claude/skills/ticket/ticket_system/"

# Step 2: 掃描 SKILL.md 對外契約
grep -n "ticket track\|/ticket" .claude/skills/ticket/SKILL.md

# Step 3: 掃描 decision-tree.md（重點掃舊命令名稱）
grep -n "ticket track\|/ticket\|runqueue\|next\|schedule\|resume-hint" .claude/pm-rules/decision-tree.md

# Step 4: 找出所有含 ticket CLI 引用的 pm-rules 檔案（需檢查清單）
grep -rln "ticket track\|/ticket" .claude/pm-rules/
```

---

## 與其他規則的邊界

| 規則 | 聚焦 | 與本規則差異 |
|------|------|------------|
| `decision-trigger-binding.md` 規則 1-2 | 決策必須綁定明確 trigger、禁止無 trigger 延後 | 本規則為執行面同步機制（什麼時候 + 掃描哪裡），decision-trigger-binding 為聲明層（決策合法狀態） |
| `document-format-rules.md` | 文件格式與引用路徑格式 | 本規則聚焦「行為變更時的決策層同步」，非格式問題 |
| `quality-baseline.md` 規則 5 | 所有發現必須追蹤（建 Ticket） | 本規則的規則 1 第 3 步直接援引：範圍過大時建 DOC Ticket，符合規則 5 要求 |
| `.claude/hooks/ticket-skill-sync-check-hook.py`（W17-115.3） | commit-level 自動偵測並提醒 | 本規則為人工自律層（規則層）；hook 為強制提醒層（機制層）；兩者互補，hook 兜底規則 |
| `PC-118`（W17-115.1） | 描述「ticket skill 行為變更未同步決策層」反模式 | PC-118 為事後描述（為何會發生、歷史案例）；本規則為事前規範（何時必須掃描、怎麼掃） |

---

## 檢查清單

修改 `.claude/skills/ticket/ticket_system/` 下任何 `.py` 前後確認：

- [ ] 改動性質：屬行為變更（觸發同步掃描）？還是純 bug fix / 格式調整（豁免）？
- [ ] 若屬行為變更，已執行四步掃描指令？
- [ ] `SKILL.md` 對外契約已更新（子命令名稱 / flag / 說明）？
- [ ] `decision-tree.md` 無過時的命令引用？
- [ ] `grep -rln` 列出的 `pm-rules/` 檔案已逐一確認？
- [ ] 需更新的文件已納入同一 commit？（或已建 DOC Ticket 追蹤）
- [ ] commit msg type 正確反映性質（`feat` / `refactor` 行為變更 vs `fix` 純修復）？

---

## 相關文件

- `.claude/rules/core/decision-trigger-binding.md` — 決策合法狀態規則（規則 1 援引）
- `.claude/rules/core/quality-baseline.md` 規則 5 — 所有發現必須追蹤（範圍過大時建 Ticket）
- `.claude/error-patterns/process-compliance/PC-118-ticket-skill-behavior-change-without-decision-layer-sync.md` — 同一問題的反模式描述（W17-115.1）
- `.claude/hooks/ticket-skill-sync-check-hook.py` — commit-level 自動偵測 hook（W17-115.3）
- `.claude/skills/ticket/SKILL.md` — ticket CLI 對外契約（同步目標之一）
- `.claude/pm-rules/decision-tree.md` — PM 決策路由（同步目標之一）

---

**Last Updated**: 2026-05-03
**Version**: 1.0.0 — 初始建立（W17-115.2：落地 ANA W17-115 的 B 路徑 rules/core 規則補強）
**Source**: W17-113（禁用無 trigger 延後決策）/ W17-114（決策樹閉環流程補強）事後補償案例；memory feedback「ticket skill 行為變更需同步檢查決策樹」的結構化落地
