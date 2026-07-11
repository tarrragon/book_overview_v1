---
id: PROP-014
title: Design token 值層統一——中介 token 格式（JSON SSOT）+ 雙端生成 + 平台覆蓋機制
status: draft
evaluation_level: heavy
created: "2026-07-11"
confirmed_date: null
target_version: null
priority: P2
related_proposals: [PROP-008, PROP-013]
---

# PROP-014: Design token 值層統一——中介 token 格式（JSON SSOT）+ 雙端生成 + 平台覆蓋機制

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

## 提案方案（初步，heavy 評估時細化）

方案候選（confirmed 前需完成 heavy 級評估：3+ 候選逐一評估表）：

| 候選 | 說明 | 初步觀察 |
|------|------|---------|
| A：Style Dictionary | Amazon 開源 token 轉換工具，JSON SSOT → 多平台輸出（含 Dart/CSS/JS transform） | 生態成熟；引入 npm build 依賴；Flutter 端輸出需自訂 format |
| B：自訂精簡 JSON schema + 雙端各自小型生成器 | 依現有 `generate-design-system-css.js` 模式擴展 | 零新依賴；schema 治理自負；V1 已有生成器基礎 |
| C：維持現狀（契約層統一） | markdown 契約 + 人工 diff | 已被用戶決策否決，列為對照基線 |

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

## 風險與權衡

| 風險 | 影響 | 緩解措施 |
|------|------|---------|
| 中介格式 schema 治理成本 | 雙 repo 需協調 schema 版本 | schema 帶版本號；變更走雙端 sibling 提案流程 |
| 生成 pipeline 故障使 build 失敗 | 開發阻塞 | 生成物 commit 進 repo（非 build 時生成），生成器僅在 token 變更時執行 + snapshot test 護欄 |
| 2-repo 規模下投資回報偏低 | 機會成本 | heavy 評估時以「多書城 UI 面擴張計畫（v1.5~v1.11）」的 token 消費成長作為收益量化輸入 |

## 討論記錄

### 2026-07-11

隨統一強度評估建立（用戶決策：值層也統一 + 色值補記差異標記）。與 PROP-013 分層：013 元件層命名、014 token 值層。sibling PROP-018（APP 端）同日建立。confirmed 前置：heavy 級評估（3+ 候選逐一評估表 + 多視角審查），由後續 ticket 承載。

## 轉化記錄

| 轉化類型 | 檔案 | 日期 | 狀態 |
|---------|------|------|------|
| Ticket | 1.5.0-W6-006（heavy 評估與確認） | 2026-07-11 | pending |
