# Error-pattern 來源前綴編號方法論

本方法論規範跨專案共用框架下，error-pattern（PC / IMP / ARCH / DOC / TEST / CQ / PROC 等全 category）的編號分配方式，防止多專案併發分配同號造成知識庫指涉碰撞。

> **適用前提**：一套 `.claude/` 框架透過共享 repo 同步至多個專案（full-overlay sync）。若框架僅單一專案使用，本方法論不適用，沿用 flat 編號即可。

---

## 核心原則：凍結 flat base，新編號用來源前綴

| 編號層 | 格式 | 語意 |
|--------|------|------|
| 凍結核心（canonical base） | `<CATEGORY>-NNN`（如 `PC-093`） | 既有 flat 編號，視為共享 canonical 知識，**凍結不再新增 flat 號** |
| 來源前綴（staging） | `<CATEGORY>-<PROJ>-NNN`（如 `PC-V1-001`） | 各專案新發現的 error-pattern，前綴取自來源專案代號 |

**Why**：flat 序列把「發現時機」當主鍵。多專案從相同 base 各自累加，併發分配必然撞號（同號指向不同教訓）；full-overlay sync 後同號異義檔因 slug 不同而並存，知識庫失去「一個編號 = 一個教訓」的唯一指涉。來源前綴讓每個專案在自己的命名空間單調遞增，碰撞在資料結構層消失，不靠事後協調。

**Consequence**：未採來源前綴時，每次跨專案 sync 都可能引入同號異義；解法退化為「碰撞後重編號」，而重編號會 churn 所有引用（規則 / 方法論 / 各 pattern 的 `related:` 欄 / 工作日誌），成本隨專案數與引用密度上升。

**Action**：新增任何 category 的 error-pattern 時，一律使用 `<CATEGORY>-<PROJ>-NNN`，`<PROJ>` 取自來源專案代號（見「專案代號註冊表」）；**禁止**新增無前綴的 flat 號。

---

## 凍結 flat base 的語意

凍結指「不再新增 flat 號」，**不是**「改寫既有 flat 號」。既有 `<CATEGORY>-NNN` 全部原樣保留——這是維持向後相容（既有引用不破）的前提。

### 協議字串豁免（永不重編）

部分 flat 編號已成為**協議字串**（protocol marker），被 hook / 規則 / 測試以字面 hardcode 解析。這類 ID 屬凍結 base，**永不重編**，避免任何 remediation 誤觸破壞協議。

| 協議字串範例 | 使用處 |
|-------------|--------|
| `PC-093-exempt: <category>:<reason>` | 延後決策豁免 marker（hook 字面解析） |

**Action**：remediation（去重 / 整理）若涉及重編號，須先確認目標 ID 非協議字串；協議字串一律跳過。

---

## canonical 升格機制（凍結 base = canonical 層 / 前綴 = staging 層）

凍結 base 不是終局封死，而是**分層**：

| 層 | 角色 |
|----|------|
| 凍結 base（`<CAT>-NNN`） | canonical 層：已被識別為通用、單一指涉的教訓 |
| 來源前綴（`<CAT>-<PROJ>-NNN`） | staging 層：各專案新發現，尚未整合 |

**Why**：多數 error-pattern 是框架通用知識（適用任何專案）。前綴記錄「發現位置」，但通用教訓的價值不依賴發現位置。

**Consequence**：若無回流通道，同一通用教訓會以多個前綴版本永久碎片化於各專案命名空間，dedup 候選清單隨專案數無限增長，知識庫退化為「N 份重複教訓」而非「一份 canonical 集」。

**Action**：當某 staging 教訓被識別為通用且穩定，可**升格**——於凍結 base 賦予一個 canonical alias（或在共享 repo 將其視為 canonical），前綴版標註指向 canonical。升格屬低頻、刻意動作，不是每筆 staging 都需升格。

---

## dedup：偵測「異號同義」

來源前綴消除「同號異義」碰撞，但引入新類別：同一通用教訓在多專案各自發現 → 不同前綴號、內容雷同（異號同義）。

**Why**（偵測而非阻擋）：新增時阻擋「疑似重複」會在合法情境誤殺——多專案各自真實踩到同一坑、獨立寫下教訓是正當行為，且新增當下無法可靠判定「雷同」與「真重複」。故以事後偵測 + 人工裁決取代前置阻擋。

**Action**：定期（如 sync-pull 後）跑 detect，以內容雜湊（content-hash）找跨前綴的雷同 pattern，列為候選 dedup / 升格清單，人工裁決保留哪個為 canonical。detect 偵測重複，升格機制決定歸併方向。

---

## 專案代號註冊表

| 項目 | 規範 |
|------|------|
| SSOT 位置 | `.claude/error-patterns/_project-registry.yaml`（隨 `.claude/` sync 至所有專案，全域一致） |
| 自我識別 | tooling 取 `git rev-parse --show-toplevel` 的 basename，對應註冊表 `dir` 欄 → 得 `code`；不需 project-local 設定檔 |
| 代號規則 | 短大寫英數（2-5 字元）、全域唯一（含退役保留）、新專案首次新增 pattern 前先登錄 |
| 唯一性 | 新專案 code 不得與既有或退役 code 重複，否則前綴空間內重演同號碰撞 |

---

## Rejected options（決策完整性記錄）

| 方案 | 淘汰理由 |
|------|---------|
| slug-as-identity（slug 當主鍵，編號降排序號） | 理論上 root-fix 碰撞與 dedup（sync 同 slug 自動互蓋），但既有大量 `<CAT>-NNN` 字面引用需全改 slug、放棄簡短編號慣例，遷移成本過高 |
| 弱協調 append-only 分配日誌 | git 式分散 append + merge 偵測；可行但仍需各專案 pull 後跑 detect，未優於前綴的零協調 |
| 按 domain（適用範圍）分前綴 | 語意較佳，但 domain 內多專案併發分配仍會撞號，未解碰撞核心 |
| content-hash / UUID 主鍵 | 無人類可讀性、斷裂既有慣例；hash 改用於 dedup 偵測鍵 |
| 日期序 / commit 衍生號 | 同日同序仍可能撞 / commit hash 不穩定且分配時尚未產生 |

---

## 與既有規則的邊界

| 規則 | 聚焦 | 與本方法論關係 |
|------|------|--------------|
| PC-122（error-pattern-conflict-not-synced） | 新 pattern 推翻舊 pattern 須同步 deprecated | 本方法論處理「併發分配同號」，PC-122 處理「同步時的版本衝突」，互補 |
| PC-180（dual-project-sync-scope-conflation） | 「本地保留」vs「共享納入」兩決策軸分離 | PC-180 的 preserve 機制只防覆蓋 / 刪除，**無法**防同號異義新增；編號碰撞需本方法論的前綴分配獨立處理 |

---

## 檢查清單

新增 error-pattern 前：

- [ ] 使用 `<CATEGORY>-<PROJ>-NNN` 格式（非 flat `<CATEGORY>-NNN`）？
- [ ] `<PROJ>` 取自註冊表（git toplevel basename 對應 `dir`）？
- [ ] 新專案已先於 `_project-registry.yaml` 登錄 code？
- [ ] remediation 重編號前已排除協議字串（如 `PC-093-exempt`）？

---

**Last Updated**: 2026-06-09
**Version**: 1.0.0
