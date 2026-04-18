# Designing Fields — Ticket / Schema / Configuration Fields

本文件為「設計欄位」情境的完整指引。適用於 ticket 模板、YAML frontmatter、API response、database schema、配置檔案等任何**多欄位結構**的設計。

> **為什麼獨立成篇**：欄位設計的錯誤會被模板放大。一個設計不良的 ticket 模板會產生上百個混淆 ticket、上千則語意空洞的資料。欄位一旦上線就難以撤回，因為後續所有資料都已按此格式寫入。

> **自包含聲明**：閱讀本文件不需要先讀其他 reference。五大原則的精要在本文件內展開於「欄位設計」情境；需要跨情境套用時，才去讀對應的 `writing-*.md`。

---

## TL;DR（30 秒版本）

1. **每個欄位承載一個維度**，不同欄位描述同一件事的不同面向（what 描述動作、why 陳述動機、acceptance 定義可驗證條件）。
2. **frontmatter 欄位為程式化查詢服務**，ID 格式、enum 值、布林命名要穩定可 grep。
3. **欄位名稱暗示其問什麼問題**（`why` 問動機，`how` 問策略，`blockedBy` 問阻塞關係）。
4. **欄位值格式一致**，enum 有限集優於自由文字，複合值用穩定分隔符。
5. **新增欄位前問七個問題**（見「新增欄位的決策框架」章節），避免欄位膨脹。

---

## 目錄

1. 原子化 × 欄位：每個欄位承載一個維度
2. 索引 × 欄位：程式化查詢、ID 格式、frontmatter 設計
3. 意圖顯性 × 欄位：欄位名稱即提問
4. 可查詢性 × 欄位：值格式一致性、enum 命名
5. 欄位設計 meta：新增欄位的決策框架
6. Ticket 六欄位角度解析（12 個具體項目）
7. 非 ticket 情境：YAML 配置、API response

---

## 1. 原子化 × 欄位：每個欄位承載一個維度

**原則**：每個欄位只回答一個問題。若一個欄位同時承載兩個維度，填寫者會混淆，查詢者會誤讀。

### 判斷標準

一個欄位的內容若出現以下徵兆，代表「承載太多維度」，應拆分：

| 徵兆 | 範例 | 拆分方式 |
|------|------|---------|
| 描述需要「和」連接 | `status: "in_progress 且 blocked by API"` | 拆成 `status` + `blockedBy` |
| 同一欄位混用動作與動機 | `what: "修 bug 因為用戶回報崩潰"` | 拆成 `what`（修 bug）+ `why`（用戶回報崩潰影響可用性） |
| 單欄位塞多個可查詢值 | `tags: "p0 security urgent"` | 改為 `priority: p0` + `category: security` + `urgency: high` |
| 用自由文字藏結構資料 | `notes: "owner=alice, due=2026-04-20"` | 拆成 `owner: alice` + `due: 2026-04-20` |

### 反例：一個欄位承載兩個維度

```yaml
# 錯誤：status 同時表達「進度」和「阻塞原因」
status: "in_progress_waiting_for_api_team"
```

問題：
- 查詢「所有 in_progress 的 ticket」需要字串前綴比對，不穩定。
- 改阻塞對象時，狀態字串也要改，污染查詢歷史。
- 報表無法分別統計「進度分佈」和「阻塞分佈」。

### 正確：兩個維度各自一個欄位

```yaml
status: in_progress
blockedBy:
  - team: api
    reason: "等待 /v2/users 端點上線"
```

每個欄位**只回答一個問題**：`status` 回答「目前在哪個階段」，`blockedBy` 回答「被什麼擋住」。

### 原子化測試

拿一個欄位問三個問題：

1. **這個欄位回答什麼問題？** — 若答案需要「和」連接兩個問題，必須拆分。
2. **這個欄位的值能獨立變更嗎？** — 若必須連動其他資訊，代表混在一起了。
3. **能用此欄位單獨做統計/排序嗎？** — 若不能，代表它混入了其他維度。

---

## 2. 索引 × 欄位：程式化查詢、ID 格式、frontmatter 設計

**原則**：frontmatter 欄位存在的理由之一是**讓程式能查詢**。人眼看不出結構，程式才看得出。所以 ID 格式、enum 值、布林欄位的命名要為「程式化查詢」服務。

### ID 格式設計

好的 ID 同時對人和程式友善。以下是穩定 ID 格式的檢查點：

| 要求 | 正確範例 | 錯誤範例 | 原因 |
|------|---------|---------|------|
| 分層結構可拆解 | `v1.2.0-W03-021.4` | `ticket_74_sub7` | 前者可用分隔符拆成版本/wave/序號/子序號 |
| 穩定分隔符 | 用 `-` 分層、`.` 分子層 | 混用 `_`、`-`、` ` | 程式 regex 才能一致比對 |
| 固定位數（可選） | `P001`、`P002` | `P1`、`P10`、`P100` | 字典序排序才會等於數值序 |
| 不含空白與特殊字元 | `prop-cache-cleanup` | `prop cache cleanup!` | 避免需要引號與跳脫 |
| 可預測的命名空間 | `PROP-` / `UC-` / `SPEC-` 前綴 | 無前綴純數字 | 能靠前綴快速過濾類別 |

### frontmatter 為查詢服務

frontmatter 的目的不是「把資訊塞進去」，而是「讓特定查詢變快」。

```yaml
---
id: ticket-001
title: "修復登入崩潰"
status: in_progress
priority: P0
blockedBy: []
version: v1.2.0
wave: 3
---
```

每個欄位服務一種查詢需求：

| 欄位 | 服務什麼查詢 |
|------|------------|
| `status` | 列出所有「進行中」的項目 |
| `priority` | 依優先順序排序 |
| `blockedBy` | 找出被阻塞的項目 |
| `version` / `wave` | 按發佈批次篩選 |

**欄位不服務的查詢就不要存**。例如「建立者的辦公座位」放在 frontmatter 只會污染欄位密度。

### 為「程式能看」優先，為「人能看」是加分

frontmatter 的值優先讓程式 grep/parse，再由顯示層（UI、報表）翻譯給人。

| 優先程式 | 優先人 |
|---------|-------|
| `status: in_progress` | `status: "進行中（已派發工程師）"` |
| `priority: P0` | `priority: "緊急 — 阻塞發佈"` |
| `blockedBy: [ticket-042]` | `blockedBy: "等 ticket-042 的 API 做完"` |

若需要給人看的補充描述，用獨立的自由文字欄位承接（如 `blockedByReason`），frontmatter 主欄位保持結構化。

---

## 3. 意圖顯性 × 欄位：欄位名稱即提問

**原則**：欄位名稱本身就是一個問題。填寫者看到欄位名，應立刻知道要填什麼答案。若欄位名需要額外文件解釋，代表命名不夠顯性。

### 好欄位名 = 好問題

| 欄位名 | 它問的問題 | 填寫者的思考 |
|-------|-----------|------------|
| `what` | 「做了什麼？」 | 描述動作/內容 |
| `why` | 「為什麼需要？」 | 陳述動機/業務理由 |
| `when` | 「什麼時候觸發？」 | 條件/時機 |
| `where` | 「影響範圍？」 | 檔案/模組/層級 |
| `how` | 「怎麼做？」 | 實作策略 |
| `acceptance` | 「怎樣算完成？」 | 可驗證條件 |
| `blockedBy` | 「被什麼擋住？」 | 依賴項目 |
| `owner` | 「誰負責？」 | 單一責任人 |
| `deprecatedAt` | 「何時廢棄？」 | 日期或版本號 |

### 反例：名稱無法暗示問題

| 模糊欄位名 | 問題 | 改善 |
|----------|------|------|
| `data` | 什麼資料？ | `payload` / `userProfile` / `metrics` 依內容 |
| `info` | 什麼資訊？ | `description` / `errorDetail` / `author` |
| `meta` | 描述什麼？ | `createdBy` / `source` / `tags` |
| `config` | 配置什麼？ | `retryPolicy` / `cacheTtl` |
| `flag` | 什麼旗標？ | `isPublished` / `hasWarning` |
| `type` | 什麼類型？ | `eventType` / `userRole` / `errorCategory` |

### 布林欄位用 `is_` / `has_` / `can_` 開頭

| 錯誤 | 正確 | 原因 |
|------|------|------|
| `active` | `isActive` | 看到就知道是 true/false |
| `permission` | `hasPermission` | 暗示「擁有關係」 |
| `edit` | `canEdit` | 暗示「能力檢查」 |
| `visible` | `isVisible` | 避免與名詞混淆 |

### 欄位名稱體現抽象層

一份文件內的欄位應處於**同一抽象層**。混層會讓讀者不知道該看哪個。

```yaml
# 錯誤：混抽象層
what: "修 bug"                           # 業務層
implementationDetail: "修改 auth.py 第 42 行"  # 實作層
```

改善：`what` 留在業務層，實作細節進 `how` 或 `where.files`。

---

## 4. 可查詢性 × 欄位：值格式一致性、enum 命名

**原則**：同一個欄位的值要有**穩定格式**，讓 grep/filter/sort 可預測。格式不一致會讓查詢需要 N 個 regex 才能覆蓋，最終退化成「用肉眼翻」。

### enum 優於自由文字

有限集合的欄位應列出所有合法值：

```yaml
# 正確：status 有固定集合
status: in_progress    # 僅限 pending / in_progress / blocked / completed / cancelled

# 錯誤：狀態用自由文字
status: "進行中，但有點卡"
```

enum 的三個好處：
1. grep 精確（`status: in_progress` 無歧義）
2. 值變更能被編譯器/驗證器捕捉
3. 統計時不用做語意聚類

### enum 命名規則

| 要求 | 正確 | 錯誤 |
|------|------|------|
| 全小寫、單字用 `_` 連接 | `in_progress` | `inProgress` / `In-Progress` |
| 語意中立（不帶情緒） | `cancelled` | `abandoned_by_team` |
| 涵蓋周延（加 `unknown` 或 `other` 兜底） | `unknown` | 漏 fallback 導致必填卡關 |
| 避免數字後綴（除非真的有序） | `high` / `medium` / `low` | `level1` / `level2` |

### 複合值的穩定分隔符

若欄位必須承載複合值，用**穩定的分隔符**讓 regex 可拆。

```yaml
# 正確：用 : 分隔方向和目標
direction: "to-sibling:ticket-045"

# 錯誤：自由文字
direction: "指向兄弟 ticket 045"
```

常見分隔符慣例：

| 分隔符 | 用途 | 範例 |
|-------|------|------|
| `:` | 維度:值 | `scope:api`、`type:bug` |
| `/` | 路徑 | `src/auth/login.py` |
| `,` | 多值列表（若不用陣列） | `a11y,i18n,perf` |
| `→` / `->` | 流向 | `pending → in_progress` |

**禁止混用分隔符**。若一個欄位用 `:`，整個系統都要用 `:`。

### 欄位值前綴做分類

當同類型但需細分時，用固定前綴而非混在自由文字中。

```yaml
# 正確：ID 前綴暗示類別
id: PROP-042    # proposal (portability-allow: teaching example)
id: UC-007      # use case
id: SPEC-012    # spec

# 錯誤：自由文字描述類別
id: "proposal 42"
```

### 日期時間統一 ISO 8601

```yaml
# 正確
createdAt: "2026-04-16"
startedAt: "2026-04-16T09:30:00+08:00"

# 錯誤
createdAt: "2026/4/16"       # 分隔符不穩
createdAt: "April 16, 2026"  # 不可排序
createdAt: "昨天"             # 不可重複解析
```

---

## 5. 欄位設計 meta：新增欄位的決策框架

**原則**：欄位一旦加入就難以撤回。新增前必問以下七個問題，避免欄位膨脹、語意重疊。

### 新增欄位前必問清單

| # | 問題 | 若答「否」的處理 |
|---|------|----------------|
| 1 | **這個欄位回答什麼問題？（單一維度）** | 若回答多個問題 → 拆成多欄位 |
| 2 | **是否已有欄位涵蓋同一維度？** | 若有 → 擴充既有欄位或重新命名，不新增 |
| 3 | **至少有一個查詢情境需要它嗎？** | 若無 → 放入自由文字 notes，不進 frontmatter |
| 4 | **值域是否有限可枚舉？** | 若是 → 用 enum；若否 → 確認自由文字真的必要 |
| 5 | **缺省值（missing）有明確語意嗎？** | 若無 → 補上預設值或註明 `nullable` |
| 6 | **填寫者有能力正確填寫嗎？** | 若否 → 改成程式自動填，或提供 enum 選單 |
| 7 | **停用時如何淘汰？** | 若無計畫 → 先標註 `deprecatedAt` 欄位策略 |

### 欄位語意重疊檢查

新增欄位時最常見的錯誤是「與既有欄位語意重疊」。檢查方式：

1. 列出新欄位的**提問**（它要回答什麼問題）。
2. 對照既有欄位的**提問**，找是否有重複。
3. 若有重複，選其一：
   - **合併**：新增的維度其實可以塞進既有欄位（若不違反原子化）。
   - **改名**：讓兩個欄位的提問有明確區別。
   - **捨棄**：若既有欄位已能滿足，不新增。

### 欄位膨脹的警訊

| 警訊 | 意義 | 行動 |
|------|------|------|
| 一個 schema 超過 15 個 frontmatter 欄位 | 單一物件承載過多責任 | 分拆為子物件（nested）或獨立 schema |
| 有些欄位在 > 80% 的資料中為空 | 該欄位的查詢需求薄弱 | 降級為自由文字 notes |
| 欄位的填寫規則寫在多份 wiki | 規則太複雜 | 改為 enum 或引入驗證器 |
| 兩個欄位經常「一起填/一起空」 | 語意耦合 | 合併或用 nested 結構 |

---

## 6. Ticket 六欄位角度解析（12 個具體項目）

這是本文件的核心範例。ticket 模板的 `what / why / when / where / how / acceptance` 六欄位是**刻意設計的多角度描述系統**。每個欄位從不同角度描述同一個 ticket，合起來才是完整規格。

下列每個欄位提供 1 個正確範例 + 1 個常見混淆範例（共 12 項）。

---

### 6.1 `what`（正確）

**欄位提問**：這個 ticket 要做什麼？（描述動作/內容，不含動機）

```yaml
what: "在使用者設定頁新增「雙因素驗證（2FA）」開關，支援 TOTP 與 email 驗證碼兩種方式"
```

**為什麼正確**：
- 描述「做了什麼」（新增開關、支援兩種方式）
- 不解釋為什麼做（動機屬於 `why`）
- 不描述怎麼做（實作策略屬於 `how`）
- 範圍具體（使用者設定頁、TOTP + email），閱讀者能立刻想像成品

---

### 6.2 `what`（常見混淆：把動機寫進 what）

```yaml
# 錯誤
what: "因為最近有用戶帳號被盜，所以要加強安全，做一個 2FA"
```

**為什麼混淆**：
- 「因為...所以」的結構顯示這是動機（why），不是動作（what）
- 讀者需要剝離「因為...」才能看到真正的動作
- 與 `why` 欄位內容重複，降低欄位密度
- 查詢「做了什麼」時會讀到動機雜訊

**改善**：動機搬到 `why`，`what` 只留動作：

```yaml
what: "新增 2FA 設定開關，支援 TOTP 與 email 驗證碼"
why:  "最近三個月有 N 起帳號盜用事件，2FA 可降低風險"
```

---

### 6.3 `why`（正確）

**欄位提問**：為什麼需要做這件事？（業務動機，不含實作原因）

```yaml
why: "過去三個月登入頁崩潰影響 8% 活躍用戶，平均每位受影響用戶嘗試 3 次才成功登入。修復後預期可提升首週留存 1.5 個百分點，並減少客服工單量（當前每週 40 張與登入相關）"
```

**為什麼正確**：
- 陳述業務動機（用戶影響、留存、客服成本）
- 含具體數字讓重要性可衡量
- 不解釋「怎麼修」（那是 how 的責任）
- 不描述「做什麼」（那是 what 的責任）

---

### 6.4 `why`（常見混淆：把 what 寫進 why）

```yaml
# 錯誤
why: "要修復登入頁的崩潰 bug，會修改 auth.py 第 42 行並加 try-catch"
```

**為什麼混淆**：
- 「修復崩潰 bug」是 what，不是 why
- 「修改 auth.py 第 42 行」是 how（實作細節）
- 完全沒回答「為什麼要修」的業務問題
- 讀者讀完 `why` 仍不知道這個 ticket 的價值在哪

**改善**：動機與實作各歸各位：

```yaml
why:  "登入崩潰導致 8% 用戶流失，每週產生 40 張客服工單"
what: "修復登入頁 authentication flow 的 null pointer"
how:  "在 auth.py token 解析前加 guard clause；補 unit test 覆蓋 null token 情境"
```

---

### 6.5 `when`（正確）

**欄位提問**：什麼時候觸發/執行這個 ticket？（條件/時機，不是動作內容）

```yaml
when: "v1.2.0 發佈前（預計 2026-05-10），依賴 W03-021 架構草案完成後即可啟動"
```

**為什麼正確**：
- 回答「什麼時候」的問題（版本截止、前置依賴）
- 條件可被驗證（檢查 W03-021 狀態即可）
- 不混入「要做什麼」或「為什麼」

---

### 6.6 `when`（常見混淆：把 what 重述一遍）

```yaml
# 錯誤
when: "當使用者點擊登入按鈕時，系統會驗證帳密並嘗試登入"
```

**為什麼混淆**：
- 這描述的是**產品行為的觸發時機**，不是 ticket 執行的時機
- 把 `what`（驗證流程）用時序包裝後重述
- 真正的 `when`（ticket 啟動條件）完全缺失
- 讀者不知道何時該開始做這個 ticket

**改善**：分清「ticket 啟動時機」與「產品行為時機」：

```yaml
when: "登入崩潰回報量超過每週 20 起即啟動；最遲在下一個 minor 版本發佈前完成"
what: "修復登入流程：驗證帳密 → 產生 session → 導向首頁"
```

---

### 6.7 `where`（正確）

**欄位提問**：影響哪些檔案/模組/層級？（範圍定位，不是做什麼）

```yaml
where:
  layer: Application
  files:
    - src/auth/login_service.py
    - src/auth/session_manager.py
    - tests/auth/test_login_flow.py
```

**為什麼正確**：
- 明確列出修改範圍（檔案 + 層級）
- 讓驗收者知道要檢查哪些檔案
- 協作者能預判 merge 衝突
- 不混入動作描述

---

### 6.8 `where`（常見混淆：寫抽象功能而非具體位置）

```yaml
# 錯誤
where: "使用者登入流程相關的所有地方"
```

**為什麼混淆**：
- 「所有地方」無法定位，等於沒說
- 驗收者無法確認範圍是否完整
- 協作者無法預判衝突
- 若未來 refactor，沒有具體檔案可追溯

**改善**：改為具體檔案清單與層級：

```yaml
where:
  layer: Application + Infrastructure
  files:
    - src/auth/login_service.py        # 主邏輯
    - src/auth/token_validator.py      # token 驗證
    - src/infra/redis_session_store.py # session 儲存
```

---

### 6.9 `how`（正確）

**欄位提問**：用什麼策略/順序實作？（實作計畫，不是業務內容）

```yaml
how:
  task_type: Implementation
  strategy: |
    1. 在 token_validator 加 guard clause 處理 null/malformed token
    2. 將 session_manager 的錯誤處理改為 Result 模式而非例外
    3. 補 unit test 覆蓋 6 種失敗情境（null / expired / malformed / revoked / ip_mismatch / ua_mismatch）
    4. 跑 integration test 驗證與 Redis 互動正確
```

**為什麼正確**：
- 提供實作步驟與順序
- 選擇具體技術方案（guard clause、Result 模式）
- 不重述業務需求（那是 what）
- 不寫動機（那是 why）

---

### 6.10 `how`（常見混淆：把 acceptance 寫進 how）

```yaml
# 錯誤
how:
  strategy: "做完要通過所有單元測試，且 login 成功率回到 99.5% 以上"
```

**為什麼混淆**：
- 「通過測試」「成功率 99.5%」是驗收條件（acceptance），不是實作策略
- 沒回答「怎麼做」的問題
- 讀者不知道實際要改什麼
- 驗收與實作責任混淆

**改善**：分離「做法」與「驗收標準」：

```yaml
how:
  strategy: "先加 guard clause → 改為 Result 模式 → 補單元測試 → 跑整合測試"
acceptance:
  - "[ ] 所有單元測試通過"
  - "[ ] Staging 環境 login 成功率 ≥ 99.5%（觀察 24 小時）"
```

---

### 6.11 `acceptance`（正確）

**欄位提問**：怎樣算完成？（可驗證的條件清單）

```yaml
acceptance:
  - "[ ] auth 模組所有單元測試通過（含新增的 6 個失敗情境測試）"
  - "[ ] Staging 環境連續 24 小時 login 成功率 ≥ 99.5%"
  - "[ ] 客服工單中「登入無法使用」類別在部署後 7 天內下降 ≥ 50%"
  - "[ ] Code review 由另一位後端工程師核可（需涵蓋錯誤處理章節）"
```

**為什麼正確**：
- 每條都**可驗證**（有明確判斷標準）
- 每條都**可觀察**（測試結果、指標、核可紀錄）
- 數字具體（99.5%、24 小時、50%、7 天）
- 不抽象（沒有「讓系統更穩定」這種不可驗證的描述）

---

### 6.12 `acceptance`（常見混淆：不可驗證的模糊條件）

```yaml
# 錯誤
acceptance:
  - "[ ] 使用者體驗變好"
  - "[ ] 程式碼品質提升"
  - "[ ] 沒有引入新的 bug"
```

**為什麼混淆**：
- 「體驗變好」無法量測（多好算好？）
- 「品質提升」主觀（誰評？）
- 「沒有新 bug」無法證明（只能證偽）
- 驗收者無法勾選，ticket 永遠完不成或隨意完成

**改善**：每條都要能「勾得下去」：

```yaml
acceptance:
  - "[ ] 登入完成時間 p95 從 3.2s 降至 ≤ 1.5s（1 週平均）"
  - "[ ] Linter 無新增 warning；cyclomatic complexity 不增加"
  - "[ ] 迴歸測試套件（237 個）全數通過，且新增至少 6 個測試"
```

### 六欄位角度總表

| 欄位 | 角度 | 不該寫什麼 | 檢驗標準 |
|------|------|----------|---------|
| `what` | 做什麼 | 動機、實作、驗收 | 讀者能立刻想像成品 |
| `why` | 為什麼做 | 動作、實作細節 | 含業務指標或成本數字 |
| `when` | 何時做 / 何時觸發 | 產品行為時序 | 條件可被程式或人工驗證 |
| `where` | 影響範圍 | 抽象功能名 | 有具體檔案/模組清單 |
| `how` | 怎麼做 | 驗收條件、動機 | 有步驟、順序、技術選擇 |
| `acceptance` | 怎樣算完成 | 做法、動機 | 每條都能被勾選（量化或證據性） |

---

## 7. 非 ticket 情境：YAML 配置、API response

五大原則不只適用 ticket。以下兩個情境示範同樣的思維。

### 7.1 YAML 配置檔案

**原則應用**：

| 原則 | 在配置檔案的具體形式 |
|------|-------------------|
| 原子化 | 每個配置鍵承載一個決定（超時、重試、快取各自獨立） |
| 索引 | 用 namespace 分組（`database.pool.size` 而非 `dbPoolSize`） |
| 意圖顯性 | `retryMaxAttempts` 優於 `retry` 或 `attempts` |
| 可查詢性 | 布林用 `isEnabled` / `hasFallback`；時長用 `timeoutSeconds` 後綴 |
| 欄位設計 | 新增配置前問「這個值會隨環境變嗎？（是→配置；否→常數）」 |

**範例（正確）**：

```yaml
database:
  host: "db.internal"
  port: 5432
  pool:
    minSize: 5
    maxSize: 50
    acquireTimeoutSeconds: 10

retry:
  maxAttempts: 3
  initialDelayMs: 100
  backoffMultiplier: 2
  retryableErrors:
    - connection_timeout
    - transient_network_error
```

**範例（常見混淆）**：

```yaml
# 錯誤：單位混亂、命名模糊、enum 變自由文字
db:
  timeout: 10          # 秒？毫秒？
  retry: true          # 布林還是次數？
  errors: "timeout,network"  # 為何不用列表？
  mode: "production, maybe"  # enum 還是形容詞？
```

**混淆分析**：
- `timeout` 沒標單位 → 應為 `timeoutSeconds` 或 `timeoutMs`
- `retry: true` 語意不清 → 改為 `retry.isEnabled` + `retry.maxAttempts`
- `errors` 用字串列表 → 應為 YAML 陣列以利 parse
- `mode` 含「maybe」 → enum 必須是有限集合

---

### 7.2 API Response Schema

**原則應用**：

| 原則 | 在 API response 的具體形式 |
|------|-------------------------|
| 原子化 | 資料欄位與 meta 欄位分開（資料放 `data`，狀態放 `status`） |
| 索引 | 穩定 ID 欄位（`id`、`cursor`）讓分頁與查詢可預測 |
| 意圖顯性 | `isPaginated`、`hasMore`、`totalCount` 各司其職 |
| 可查詢性 | 錯誤碼用 enum（`errorCode: "INVALID_TOKEN"`）而非自由文字 |
| 欄位設計 | 新增欄位前問「client 真的會用嗎？還是只是 server 方便？」 |

**範例（正確）**：

```json
{
  "status": "success",
  "data": {
    "users": [
      { "id": "usr_001", "email": "alice@example.com", "role": "admin" }
    ]
  },
  "pagination": {
    "hasMore": true,
    "nextCursor": "eyJpZCI6InVzcl8wMDEifQ==",
    "totalCount": 1247
  },
  "meta": {
    "requestId": "req_abc123",
    "serverTime": "2026-04-16T09:30:00Z"
  }
}
```

**範例（常見混淆）**：

```json
{
  "ok": 1,
  "data": {
    "result": "...",
    "error": null,
    "nextPage": "yes"
  },
  "info": "取得 10 筆資料，還有更多"
}
```

**混淆分析**：
- `ok: 1` 數字當布林 → 應為 `status: "success"` enum
- `data` 同時放業務資料與錯誤（`result` + `error`）→ 原子化違反，應分開
- `nextPage: "yes"` 字串當布林 → 應為 `hasMore: true`
- `info` 為自由文字夾帶結構資訊 → 拆成 `totalCount: 10` + `hasMore: true`

---

## 可攜性自檢

本文件可獨立閱讀，不引用任何特定專案的路徑、ticket ID、commit hash 或 hook 系統。五大原則與 ticket 六欄位範例皆為通用概念，可套用於任何採用多欄位結構的文件系統。

---

## 速查表

| 想做的事 | 看哪一節 |
|---------|---------|
| 判斷欄位是否承載太多維度 | 第 1 節「原子化測試」 |
| 設計 ID 格式 | 第 2 節「ID 格式設計」 |
| 讓欄位名自我說明 | 第 3 節「好欄位名 = 好問題」 |
| enum 命名規則 | 第 4 節「enum 命名規則」 |
| 新增欄位前的檢核 | 第 5 節「新增欄位前必問清單」 |
| ticket what vs why 混淆 | 第 6.1–6.4 |
| 可驗證的 acceptance 寫法 | 第 6.11–6.12 |
| YAML 配置命名 | 第 7.1 |
| API response 欄位設計 | 第 7.2 |
