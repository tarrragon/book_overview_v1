# WEB 類專案測試脈絡

> 本檔承載 WEB 類專案（JS/TS + Jest/Vitest/Playwright 等）在各斷言類型上的考量脈絡差異。
> 內容為輕量脈絡提示，不含具體 API 用法或重構步驟。

---

## 適用專案類型

- 前端 SPA（React、Vue、Svelte 等）
- Chrome Extension
- Node.js 服務（含 REST API、GraphQL）
- 任何以 JS/TS 為主要語言、Jest/Vitest/Playwright 為測試框架的專案

---

## 各斷言類型的 WEB 脈絡

### 類型 8：非同步時序

WEB 環境中非同步問題最常見於：

- DOM 更新（React state change 後的 render cycle 未完成）
- `setTimeout` / `setInterval` 計時器回調
- `fetch` / `XMLHttpRequest` 網路請求完成前

**脈絡提示**：WEB 測試框架通常提供 fake timer 或 waitFor 等待工具。判斷此類問題時，識別信號是「斷言在觸發後但在回調執行前」。

### 類型 9：亂數輸出

WEB 環境中隨機性常見於：

- `Math.random()` 驅動的 UI 排序、顏色選擇、A/B 測試分組
- `crypto.getRandomValues()` 驅動的 UUID / token 生成

**脈絡提示**：全域 `Math.random` 可在測試環境替換為確定性函式，但替換後需確認斷言驗證的是演算法邏輯，而非特定輸出序列。

### 類型 10：測試隔離

WEB 環境中共享狀態常見於：

- 全域 DOM 狀態（jsdom 環境下測試間的 document 殘留）
- `localStorage` / `sessionStorage` 未清除
- ES module 快取（同一模組跨測試共享 singleton）

**脈絡提示**：Chrome Extension 專案需特別注意 `chrome.*` API mock 的重置，以及 service worker 狀態在測試間的隔離。

### 類型 11：快照過度覆蓋

WEB 環境中快照最常見於：

- Jest snapshot 對 React component tree 的全結構比對
- API response 快照

**脈絡提示**：WEB 專案的 UI component 變更頻率高，快照過度覆蓋問題尤為明顯。識別信號：CSS class 名稱更改、裝飾性屬性新增導致大量快照失敗。

### 類型 5、6（計時相關）

WEB 的 Jest/jsdom 環境下，`performance.now()` 和 `Date.now()` 受 fake timer 設定影響，計時值可能為 mock 固定值或真實計時——需區分。

**脈絡提示**：若計時值是 mock 回傳的固定數字，斷言該固定值是確定性的（見類型 1），不屬環境依賴 flaky。識別方式：追溯計時值來源，確認是否經過 `performance.now()` 的真實差值計算。

---

**Last Updated**: 2026-05-21
**Version**: 1.0.0 — 初始建立（Source: W1-024 AC1 專案類型差異欄）
