# W1-024 唯讀審查報告：tool-output-trust / bash-rules / PC-166 / IMP-056 未推送變更一致性

審查範圍：`git -C /Users/tarragon/Projects/book_overview_v1 diff origin/main..HEAD` 涵蓋之 4 檔（150 insertions / 3 deletions）：

- `.claude/rules/core/tool-output-trust-rules.md`（新檔，96 行）
- `.claude/rules/core/bash-tool-usage-rules.md`（規則一改寫 + 新增「輸出可疑/被淹沒當下的即時協議」節）
- `.claude/error-patterns/process-compliance/PC-166-...md`（症狀分類表 + 防護 E + 相關清單）
- `.claude/error-patterns/implementation/IMP-056-...md`（新增「主線程 PM 自身同樣適用（受眾擴展）」節）

審查方式：唯讀（grep / cat / git diff / git show），無任何檔案修改與 git 寫入。

---

## 檢查點 1：交叉引用正確性

### 已驗證通過的引用（grep 實證）

| 引用來源 | 引用標的 | 驗證結果 |
|---------|---------|---------|
| tool-output-trust:6,89 | PC-166 防護 A-E | 防護 A/B/C/D/E 標題實際存在於 PC-166:89/100/114/124/144 |
| tool-output-trust:23,58 | PC-166 L1 | PC-166:46「L1 預期填補」存在 |
| tool-output-trust:81,90 | bash-tool-usage-rules 規則一（git -C 首選） | bash-rules:10 規則一存在，:22 git -C 列為首選 |
| tool-output-trust:6,79,91 | IMP-056（chpwd 淹沒） | 檔案存在，主題一致 |
| bash-rules:27,35-38 | tool-output-trust 規則 1/2/3/4 | 規則 1-4 全部存在於新檔（:19/:42/:54/:75），名稱一致 |
| bash-rules:43 | IMP-056 變體 | IMP-056:70「變體：chpwd 輸出被捕獲進 redirect」存在 |
| IMP-056:55 | PC-166 + tool-output-trust 規則 1/4 | 均存在 |

### 發現 C1-1（severity: medium）— ai-communication-rules 引用描述與實際內容不符

- 證據：`tool-output-trust-rules.md:92` 邊界表稱 `ai-communication-rules` 聚焦「並行多工具的 token 效率」。
- 實測：`grep -n "並行\|多工具\|parallel" .claude/rules/core/ai-communication-rules.md` 零命中。該檔最接近的內容是規則 4「Token 節省」，無任何「並行多工具」論述。
- 影響：路由表把讀者導向不存在的章節，違反引用一致性（PC-173 漂移同型風險）。
- 建議：改述為「`ai-communication-rules` 規則 4 Token 節省」，或將「並行鼓勵」出處改指 harness 系統指令／`pm-rules/parallel-first.md`。

### 發現 C1-2（severity: low）— PC-166 無回鏈到新規則檔（單向引用）

- 證據：`grep -n "tool-output-trust" PC-166-...md` 零命中（exit 1）。新規則自稱「PC-166 防護 E 的規則層固化」（tool-output-trust:89），但 PC-166「規則層銜接」節（:162-165）僅列 pm-role / quality-baseline，未同步列入。
- 影響：後人讀 PC-166 不知防護 E 已有自動載入的規則層，雙層防護鏈不可追蹤（與 ai-communication-rules 規則 6 的「雙向交叉引用」慣例不一致）。
- 建議：PC-166「規則層銜接」補一行指向 `.claude/rules/core/tool-output-trust-rules.md`。

### 發現 C1-3（severity: low）— IMP-056 新段落自稱「本 PC」

- 證據：`IMP-056-...md:53`「本 PC 防護易被讀成…」。IMP-056 屬 implementation 類（IMP），非 process-compliance（PC）。
- 建議：改為「本 pattern」或「本 IMP」。

---

## 檢查點 2：bash-rules 即時協議四步 vs tool-output-trust 規則 1-3

**通過（無矛盾、無重複定義）。**

- bash-rules:33-38 四步表每步均顯式路由至 tool-output-trust 對應規則（步驟 1→規則 1、步驟 3→規則 2、步驟 4→規則 3），屬「現場速查 + 路由」分層設計，非平行重複定義；語意方向（停手、不續寫、raw stdout、固定值）完全一致。
- 補充觀察（severity: info，不構成矛盾）：bash-rules 步驟 2「重發乾淨原子命令」允許改寫命令形式（換 git -C／子 shell），而 tool-output-trust:71「同命令重發一次，兩次 raw stdout 逐字一致才採信」預設同命令比對。兩者情境不同（前者脫離淹沒、後者鑑別虛構），但讀者可能混用；可選擇性在任一側加一句邊界說明，非必改。

---

## 檢查點 3：三明示（Why / Consequence / Action）完整性（針對新增段落）

| 新增段落 | Why | Consequence | Action | 判定 |
|---------|-----|------------|--------|------|
| tool-output-trust 規則 1 | 有 | 有 | 有 | 通過 |
| tool-output-trust 規則 2 | 有 | 有 | 有 | 通過 |
| tool-output-trust 規則 3 | 有 | 有 | 有 | 通過 |
| bash-rules「即時協議」節 | 有 | 有 | 有 | 通過 |
| PC-166 防護 E | 有 | 有 | 有 | 通過 |
| tool-output-trust 規則 4 | 有 | **缺** | 有 | 發現 C3-1 |
| tool-output-trust 規則 1 邊界小節 | 有 | 缺顯式（內嵌於 Why 的「Never break userspace」） | 有（「辨識」段） | 發現 C3-2 |
| IMP-056「受眾擴展」節 | 隱含 | 隱含 | 有（第二段「正確反應」） | 發現 C3-3 |

### 發現 C3-1（severity: low）

- 證據：`tool-output-trust-rules.md:75-81` 規則 4 僅有 Why + Action，無 **Consequence** 標籤。
- 建議：補一句，例如「**Consequence**：裸 cd 一旦觸發 chpwd 淹沒，即進入觸發鏈第 2 環，後續需依 bash-rules 即時協議停手重發，成本高於事前避免」。

### 發現 C3-2（severity: low）

- 證據：`tool-output-trust-rules.md:29-38` 邊界小節 Consequence 內嵌於 Why 末句。
- 建議：可將「誤禁並行 → 違反 Never break userspace／效率倒退」抽為顯式 Consequence；屬風格層級，非阻擋。

### 發現 C3-3（severity: low）

- 證據：`IMP-056-...md:51-55` 新節為兩段敘述，無三明示標籤（document-writing-style 適用 error-patterns）。Action 實質存在（停手重發），Why/Consequence 隱含。
- 建議：短節可共用一組三明示；至少把「Consequence：把淹沒輸出當『正常但吵』接受即滑入 confabulation」顯式標出。

---

## 檢查點 4：禁用詞 / 簡體字 / emoji（整檔掃描）

- 禁用詞掃描（數據/代碼/默認/信息/軟件/智能/文檔）：tool-output-trust、bash-rules、PC-166 三檔零命中 — **通過**。
- emoji 掃描（codepoint >= U+1F000 與 U+2600-27BF 與常見符號）：四檔零命中 — **通過**。
- 簡體字掃描：以簡體專屬字元集 heuristic（環境無 OpenCC，無法依 language-constraints 規則 5 動態驗證，已用人工挑選之簡體專屬字集近似）四檔零命中 — **通過（附方法限制聲明）**。

### 發現 C4-1（severity: low，pre-existing，非本次 diff 引入）

- 證據：`IMP-056-...md:70`「…致下游處理拿到**假數據**」、`:95` footer「…comm 假數據…」。「數據」為禁用詞（應為「資料」）。
- 已驗證：`git show origin/main:...IMP-056...md | grep -c "假數據"` = 2，origin/main 已存在，非本次變更引入。
- 建議：依 quality-baseline 規則 5 建低優先 DOC ticket 或順手修（本次 ticket 唯讀，不得修改）。

---

## 檢查點 5：Version / Last Updated 標記

| 檔案 | 現況 | 判定 |
|------|------|------|
| tool-output-trust-rules.md:96 | 2026-06-09 / 1.0.0，描述與內容相符 | 通過 |
| bash-tool-usage-rules.md:195 | 仍為 2026-05-29 / **2.2.0**（描述停在規則六變更） | 發現 C5-1 |
| IMP-056:95 | 仍為 2026-06-07（描述停在 W1-018 變體） | 發現 C5-2 |
| PC-166 | 無 Last Updated footer，frontmatter 無 updated 欄位（僅 created: 2026-05-29） | 發現 C5-3 |

### 發現 C5-1（severity: medium）

- bash-rules 本次新增整節「即時協議」+ 安全做法表 3→4 種 + chpwd 警告改寫，footer 未 bump。依該檔自身慣例（每次規則層變更 bump minor 並摘要），應更新為 2.3.0 / 2026-06-09 並補變更摘要。

### 發現 C5-2（severity: low）

- IMP-056 新增「受眾擴展」節未反映於 Last Updated 行。建議追加日期與一句摘要。

### 發現 C5-3（severity: low）

- PC-166 新增防護 E + 症狀分類表屬重大內容擴充，但檔案完全無版本標記可更新（與 IMP-056 有 footer 的慣例不一致）。建議補 Last Updated footer 或 frontmatter `updated` 欄位。

---

## 範圍外觀察（severity: info）

- `.claude/rules/README.md:5` 稱 rules/core「7 檔」，實際現有 17 檔（含本次新檔）。長期 stale（非本次引入），建議建 DOC ticket 同步。

---

## 結論摘要

| 檢查點 | 結果 |
|--------|------|
| 1 交叉引用 | 主鏈全部驗證存在；2 個低 + 1 個中度發現（C1-1 引用描述失準 / C1-2 單向引用 / C1-3 IMP 自稱 PC） |
| 2 協議矛盾/重複 | 通過（分層路由設計，無矛盾） |
| 3 三明示 | 主要段落通過；3 個低度缺口（C3-1/2/3） |
| 4 禁用詞/簡體/emoji | 本次新增內容全通過；1 個 pre-existing 禁用詞（C4-1） |
| 5 版本標記 | 新檔通過；3 檔標記未隨變更更新（C5-1 medium / C5-2 / C5-3） |

無 high severity 發現；變更整體一致性良好，建議在推送前修補 C1-1 與 C5-1（皆為單行級修改）。
