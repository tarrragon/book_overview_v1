---
id: TEST-V1-001
title: 多書城擴展時測試體系未同步演進導致實機全壞
severity: high
category: test
created: 2026-07-14
source_ticket: 1.6.0-W2-003, 1.6.0-W4-001, 1.6.0-W2-004
---

# TEST-V1-001: 多書城擴展時測試體系未同步演進導致實機全壞

## 症狀

- 6002 單元測試全數通過（lint 0 warnings），但實機測試發現三個嚴重問題：
  1. 所有書城提取後書城來源都顯示 `readmoo`
  2. 博客來和 Kobo 提取缺作者欄位（adapter 有回傳但下游管線丟失）
  3. 後提取的書城資料覆蓋先前的書城資料（共用同一 storage key）
- 問題在 v1.5.0 完整開發週期中未被任何測試捕捉，直到用戶手動在兩個書城間切換操作才暴露

## 根因

### 直接原因

測試體系在 Readmoo 單書城時期設計，新增博客來和 Kobo 書城時只增加了 adapter 層的單元測試（mock 環境），未建立跨元件的整合驗證。

### 結構性缺口（三層）

| 缺口層 | 描述 | 遮蔽機制 |
|--------|------|---------|
| Model 轉換測試 | adapter 的 parseBookElement / mapApiRecord 未驗證所有 BookSchemaV2 必填欄位（如 author） | mock 直接回傳預期值，跳過真實轉換邏輯 |
| 欄位完整性驗證 | 無真實 DOM fixture 驗證提取欄位完整性 | 用簡化 DOM 或字串替代真實頁面結構 |
| 端到端資料驗證 | adapter → data-processing-service → storage → overview 鏈路無整合測試 | 每層獨立 mock 上下游，管線硬編碼（`readmoo_books`）在單元測試中不可見 |

### 設計債務

- `event-coordinator.js:586`：storage key 硬編碼 `readmoo_books`
- `data-processing-service.js:196`：processor 只註冊 `readmoo_books`
- `popup-message-handler.js:385-389`：讀取 `readmoo_books` 硬編碼
- `book-data-extractor.js:87-98`（已修復 W2-002）：`getPageType()` 硬編碼只認 `/library` `/shelf` `/book/` 路徑
- 上述所有硬編碼在單元測試中被 mock 遮蔽，新書城加入時沒有測試暴露不相容

## 解決方案

### 每個書城必須建立三層測試

1. **Model 轉換測試** — 驗證 adapter output 包含 BookSchemaV2 全部必填欄位（title, author, bookId, source 等），不允許 undefined/空字串通過
2. **欄位完整性驗證** — 用該書城真實 DOM 的 HTML fixture 作為測試輸入，驗證 parseBookElement 的每個欄位
3. **端到端資料驗證** — 不 mock 中間層，驗證 adapter 產出 → data-processing-service 正規化 → storage 寫入的完整鏈路，確認 storage key 正確（非 `readmoo_books`）、書城來源正確、欄位完整

### Use Case 同步審查

每次新增書城時，審查 `docs/use-cases.md` 是否涵蓋該書城的使用場景（提取/合併顯示/匯出/切換），缺漏立即補充。

## 預防措施

### 新書城加入 Checklist

新增書城時除了 adapter 實作，必須同時完成：

- [ ] Model 轉換測試（adapter output → BookSchemaV2 全欄位驗證）
- [ ] 真實 DOM fixture 欄位完整性測試
- [ ] 端到端資料鏈路整合測試（adapter → storage → overview）
- [ ] Use Case 審查（docs/use-cases.md 多書城場景覆蓋）
- [ ] 實機測試（chrome-in-chrome MCP 驗證提取 + 顯示）

### 相關 Hook 建議

考慮建立 pre-commit hook 偵測 `src/content/adapters/` 新增檔案時，檢查對應的 `tests/integration/` 整合測試是否存在。

## 相關 Ticket

- 1.6.0-W2-003：storage 隔離修復（覆蓋/來源/作者三問題）
- 1.6.0-W4-001：多書城整合測試建立
- 1.6.0-W2-004：Use Case 多書城缺漏審查
- 1.6.0-W2-002：extractor getPageType 委派修復（已完成）

## 相關規則

- `.claude/rules/core/quality-baseline.md` 規則 1：「測試綠燈不等於 Runtime 正確」
- `.claude/error-patterns/process-compliance/PC-165-false-positive-fix-chain.md`：mock 替代真實依賴遮蔽 runtime 失效
