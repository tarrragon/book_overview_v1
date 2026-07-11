---
id: PROP-014
title: Design token 值層統一——token manifest 雙向校驗層 + 平台覆蓋機制
status: confirmed
evaluation_level: heavy
created: "2026-07-11"
confirmed_date: "2026-07-11"
target_version: v1.5.0
priority: P2
related_proposals: [PROP-008, PROP-013]
---

# PROP-014: Design token 值層統一——token manifest 雙向校驗層 + 平台覆蓋機制

> **Sibling 提案**：APP 端 `book_overview_app/docs/proposals/PROP-018-design-token-value-unification.md`。
> **與 PROP-013 的分層**：PROP-013 管元件層命名契約（工廠函式 / variant 名），本提案管 token 值層（色值 / 間距 / 字級 / 陰影參數的單一真實來源）。兩者正交，PROP-013 不依賴本提案。

## 需求來源

2026-07-11 用戶決策（design-system 統一強度評估，載體：本 repo session 前台評估 + AskUserQuestion 二問）：

1. 統一強度採「值層也統一」——不滿足於契約層（markdown 表格 + 人工 diff），要求 token 值有機器可讀的單一真實來源。
2. 色值分歧仲裁結果：「補記差異標記」——V1 的 WCAG AA 校色（primary `#1A56DB`）與 APP 原值（`#2196F3`）屬**平台校準層**，雙端各自維持，不強制歸一；本提案的平台覆蓋機制即為此仲裁結果的技術承載。

## 問題描述

2026-07-11 雙端盤點（V1 + APP 各一 Explore agent 實測）確認：

1. **無中介格式**：token 值分別硬編碼在 APP 的 Dart 檔（`lib/core/design_system/*.dart`）與 V1 的 JS 檔（`src/core/design-system/*.js`），無 JSON/YAML 機器可讀 SSOT。
2. **同步靠人工**：跨端同步機制是 spec 的 markdown 對齊表（§12 token / §14.6 元件）+ contract-version 標記 + 人工 diff；PROP-008 失敗防護明言「升級時必須 diff 對齊」，即承認人工同步是常態風險。
3. **值已出現未記錄的分歧**：V1 primary 於 0.19.1-W3-001 改為 `#1A56DB`（WCAG AA 有意校色），與 APP `#2196F3` 分歧，但 §14.6 差異標記僅記載單位差異（rsp vs px），**色值分歧未入契約**——證明人工同步已漏記一次。
4. **token 覆蓋面已不對稱**：APP 有 divider 系列 token（dividerSubtle/Normal/Strong）、石碑刻痕陰影（raised/inset/engraved/pressed）、`xxxl` 間距、vertical 間距系列；V1 皆無。缺口靠人工盤點才發現。

## 影響範圍

| 影響項目 | 說明 |
|---------|------|
| V1 模組 | `src/core/design-system/`（4 個 JS token 檔改為生成物或消費生成物）、`scripts/generate-design-system-css.js`（改讀中介格式）、`scripts/build.js`（pipeline 接線） |
| V1 測試 | design-system.css snapshot test 遷移；token 值斷言測試連動 |
| APP 模組 | `lib/core/design_system/*.dart`（sibling PROP-018 承擔） |
| 規格 | APP 端 spec §12 / §14.6 差異標記增補「色值屬平台校準層」；中介格式 schema 文件 |

## 範圍界定

### 本提案要做的（In Scope，V1 端）

1. **中介 token 格式設計**：與 APP 端共同定義 JSON token schema（候選：Style Dictionary 格式或自訂精簡 schema），含 base 值 + 平台覆蓋（platform overrides）兩層。schema 檔的存放位置與 repo 歸屬（APP 端 / 獨立 repo / 雙端各持副本 + 校驗）為本提案評估時的核心決策點。
2. **平台覆蓋機制**：色值校準（V1 primary `#1A56DB`）以 `overrides.extension` 層表達，base 值維持 APP `#2196F3`；覆蓋項必須附理由欄位（如 `reason: "WCAG AA 校色 0.19.1-W3-001"`）。
3. **V1 生成 pipeline 改造**：`generate-design-system-css.js` 改讀中介 JSON 生成 JS token 檔 + design-system.css（或 JS 檔直接消費 JSON）；snapshot test 隨遷。
4. **token 覆蓋面補齊**：以中介格式為準補齊 V1 缺口 token（divider 系列、石碑刻痕陰影中 Extension 需要者），不需要者以顯性排除清單記錄。
5. **同步校驗**：CI 或 hook 層校驗雙端生成物與中介格式一致（取代人工 diff）。

### 本提案不做的（Out of Scope）

- APP 端 Dart 生成 pipeline → sibling PROP-018（APP repo）承擔
- 元件層命名契約 → PROP-013 既有範圍
- 色值歸一（強制雙端同色）→ 已由用戶仲裁為「平台校準層分歧」，本提案僅承載不推翻
- §14.6 差異標記補記的 spec 編輯 → APP 端契約權威，由 PROP-018 工作項承擔

## 替代方案（候選逐一評估表，heavy 級評估產出 2026-07-11）

| 候選 | 類型 | 說明 | 審查結論 |
|------|------|------|---------|
| A：Style Dictionary | 新增工具 | JSON SSOT → 多平台生成（Dart 需自訂 format） | **否決**——148 行 token + 年 1 次值變更，複雜度超過問題一個數量級；另有 npm audit 表面擴大 + fail-fast 前置驗證（W1-080 模式）隱含債務 |
| B：自訂 JSON SSOT + 雙端生成器 | 改造既有 | 擴展 V1 既有生成器模式 + APP 端新建 Dart 生成器 | **否決（保留為升級路徑）**——為年 1 次值變更維護兩個生成器不合比例；且 V1 palette 全量為有意校準，base+overrides 結構下覆蓋將常態化 |
| C：契約層維持 | 零工具 | markdown 契約 + 人工 diff | 基線（用戶已否決）——同步已實證失效 1 次 |
| D：token manifest 雙向校驗層 | 改造既有（輕量） | 機器可讀 manifest（token 名對照 + base 值 + 平台覆蓋 + 理由）+ 雙向校驗（npm script + CI step），值仍雙端手寫 | **採用**——唯一與實測對齊（漂移是偵測問題）；平台校準為一等公民；對 V1 pipeline 零改動 |
| E：單向提取生成（APP→V1） | 改造既有 | 從 Dart 檔解析生成 V1 JS | **否決**——與「平台校準層」用戶仲裁正面衝突；Dart 解析脆弱；build 不再自我完備 |

## 提案方案：D（token manifest 雙向校驗層）

1. **manifest schema**：機器可讀 JSON，每 token 一列——語意名、base 值、各平台實際值、覆蓋標記與理由（如 `reason: "WCAG AA 校色 0.19.1-W3-001"`）。「值層統一」語意 = **分歧受控可見**（漂移不可能靜默），非分歧為零。
2. **雙向校驗（成立的必要條件）**：manifest 所列 token 檢查端內存在且值符；端內存在的 token 檢查 manifest 有記載（新增 token 未入 manifest 即紅燈）。單向校驗只是把「spec 漏記」搬家成「manifest 漏記」。
3. **落點**：V1 端新增 npm script（比照 `validate:design-system` 模式）+ 接入 `.github/workflows/lint.yml`；非 `.claude/hooks`（session-scoped 防不了非 Claude Code 來源變更）。順帶接線既有孤兒腳本 `validate:design-system`（實測未入 CI）。
4. **分階段**：第一階段 V1 單端校驗（repo 內自足）；第二階段跨 repo 比對（APP 端 sibling PROP-018 承擔 Dart 端校驗）。
5. **升級路徑**：manifest schema 可演化為 B/A 的 SSOT 輸入。升級 trigger：token 值變更頻率顯著上升時建評估 ticket（依 decision-trigger-binding，屆時包裝為監測/評估 ticket，不預設排程）。
6. **前置工作項**：全量 token 分歧盤點（量化「共值 vs 平台校準」比例），作為 manifest 初版的資料輸入。

## 驗收條件（草案）

- [ ] 中介 token 格式 schema 定案且雙端提案（PROP-014/PROP-018）採用同一 schema
- [ ] V1 token 值全數由中介格式生成或消費，`src/core/design-system/` 無手工維護的值
- [ ] 平台覆蓋機制承載 primary 色值校準，且覆蓋項含理由欄位
- [ ] 同步校驗機制存在（CI/hook），人工 diff 退役
- [ ] 既有測試 100% 通過，snapshot test 遷移完成

## Reality Test / 觸發案例實證

### 觸發案例

2026-07-11 統一強度評估中實測：(1) §14.6 差異標記漏記色值分歧（人工同步已實際失效一次）；(2) V1 缺 divider 系列 token 需人工盤點才發現（token 覆蓋面漂移無機制偵測）。

### 假設列舉與驗證

| 假設 | 驗證方式 | 結果 |
|------|---------|------|
| 假設 1：V1 生成 pipeline 可改讀中介格式 | 檢視 generate-design-system-css.js 架構 | 已驗證：JS 常數 → CSS 的生成器已存在（含 snapshot test），改造輸入端可行 |
| 假設 2：APP 端可接受 Dart 生成物 | 需 APP 端評估（build_runner 或 pre-build script） | 未驗證：PROP-018 heavy 評估時驗證 |
| 假設 3：色值以外的 token 值雙端可完全共值 | 抽樣比對 spacing/radius/fontSize | 部分驗證：間距/圓角 key 與數值一致（PROP-008 移植對應），但單位轉換（rsp/.w vs px）屬實作層需生成器各自處理；字級/陰影覆蓋面不對稱需逐項盤點 |

## 失敗防護

| 失敗情境 | 早期警訊（可觀測） | 防護措施 |
|---------|------------------|---------|
| 校驗誤報造成 warning fatigue，開發者繞過 | 校驗 fail 被 --no-verify / skip 繞過 >= 2 次 | 校驗訊息含修復指令；誤報視為 schema bug 立即修 |
| manifest 淪為第三份手寫副本（雙寫變三寫） | PR 中 token 檔變更但 manifest 未同 commit | 雙向校驗強制：token 檔與 manifest 不一致即 CI 紅燈（本提案採用方案第 2 點） |
| APP 端 sibling（PROP-018）不落地，跨端校驗缺一半 | PROP-018 draft 停留 > 1 個月無討論記錄 | 第一階段 V1 單端校驗自足運作，不依賴 APP 端；跨 repo 比對為第二階段 |
| 全量分歧盤點發現校準比例極高，manifest base 值失去意義 | 盤點結果校準比例 > 50% | manifest schema 允許「無 base 值、僅雙端各值 + 對照語意」的列型態，schema 設計時保留 |

## 風險與權衡

| 風險 | 影響 | 緩解措施 |
|------|------|---------|
| 2-repo 規模下再輕量的機制仍是維護面 | 機會成本 | D 投入約 0.5 wave，遠低於生成方案；且順帶修補既有孤兒腳本缺口 |
| 「消費者成長 ≠ 變更頻率成長」誤判導致過早升級 B/A | 過度工程 | 升級 trigger 綁定值變更頻率實測，非多書城消費面成長（多視角審查 linux 訊號） |

## 多視角審查記錄

### 2026-07-11 heavy 級審查（linux + thyme-extension-engineer，載體 ticket 1.5.0-W6-006 Solution 章全文）

兩視角排序一致：**D > B >> A ≈ E**。linux：D 唯一與實測對齊（漂移是偵測問題）、A/B 複雜度超過問題量級、E 方向性錯誤；關鍵發現——V1 palette 全量為有意校準（base+overrides 結構下覆蓋將常態化）、token 行內註解是資產不可生成物化、雙向校驗是 D 成立必要條件。thyme：D 對 V1 pipeline 零改動、落點 npm script + CI step（非 .claude/hooks）、`validate:design-system` 為孤兒腳本順帶接線、跨 repo 校驗次階段化。

## 機會成本

D 方案投入約 0.5 wave（manifest schema + 校驗 script + CI 接線 + 分歧盤點）。同期擠壓對象為 v1.5.0 多書城主線與 PROP-013 W6 元件庫 tickets，但 D 與兩者無檔案衝突可並行。不做 D 的代價：token 覆蓋面漂移持續靠人工盤點（已實證漏過 1 次），且 PROP-013 W6-004 將新增 divider tokens——正是「新增 token 未同步」的高風險時點。生成方案（A/B）的機會成本為 D 的 2-4 倍且收益依賴未實證的變更頻率成長。

## 討論記錄

### 2026-07-11

隨統一強度評估建立（用戶決策：值層也統一 + 色值補記差異標記）。與 PROP-013 分層：013 元件層命名、014 token 值層。sibling PROP-018（APP 端）同日建立。confirmed 前置：heavy 級評估（3+ 候選逐一評估表 + 多視角審查），由後續 ticket 承載。

### 2026-07-11（heavy 評估完成，ticket 1.5.0-W6-006）

WRAP 完整四階段 + 雙視角審查完成。重現實驗修正根因假設：漂移主因是覆蓋面不同步（值變更年約 1 次）。「值層統一」語意修正為「分歧受控可見」（Consider the Opposite + 用戶色值仲裁的延伸）。採用方案收斂為 D（token manifest 雙向校驗層），升級路徑 B/A 保留 trigger 綁定。待用戶最終確認 confirmed + target_version。

## 轉化記錄

| 轉化類型 | 檔案 | 日期 | 狀態 |
|---------|------|------|------|
| Ticket | 1.5.0-W6-006（heavy 評估與確認） | 2026-07-11 | completed |
| Ticket | 1.5.0-W6-007（分歧盤點 + manifest schema + 初版） | 2026-07-11 | pending |
| Ticket | 1.5.0-W6-008（雙向校驗 + CI 接線） | 2026-07-11 | pending |
