---
id: IMP-078
title: CE-Node 環境前提誤判 — Jest 測試綠燈但 CE Runtime 崩潰
category: implementation
severity: high
status: active
created: 2026-05-30
related:
- PC-165
- ARCH-013
---

# IMP-078: CE-Node 環境前提誤判 — Jest 測試綠燈但 CE Runtime 崩潰

`src/` 程式碼直接使用 Node.js 專屬 API（`global` / `process.*` / `require('crypto')` 等），在 Jest + jsdom（Node.js 環境）測試全綠，但部署至 Chrome Extension runtime（esbuild IIFE bundle + 瀏覽器，無 Node.js polyfill）時立即 `ReferenceError` 崩潰。開發者基於「acceptance 全勾 + commit = 修復已生效」假設推進後續 ticket，但實機 100% 不可用，導致多 ticket 連鎖回溯。

**Why**：Jest 測試環境和 CE runtime 的 API 可用性存在根本性差異，且這個差異對測試套件完全透明——Node.js 全域提供 `global` / `process` / `require` 等 API，Jest jsdom 並不報錯；但 esbuild 以 `platform: browser, format: iife` 打包時，不 polyfill 這些 Node.js API，CE runtime 執行時立即拋出 `ReferenceError`。

**Consequence**：

| 層級 | 影響 |
|------|------|
| 功能可用性 | 受影響的 CE runtime 功能 100% 不可用（非偶發，而是每次載入必崩） |
| 測試信任 | 測試套件「全綠 = 可發布」承諾被打破；開發者難以判斷哪些綠燈是真實保證 |
| 追溯成本 | 多 ticket 連鎖（W1-047.1~.5 五個修復 IMP → W1-001.2.1 阻塞 → W1-050 全域盤點 → W1-050.1~.6 修復鏈）才定位根因；單一根因可引發 8+ ticket 回溯 |
| 版本阻塞 | 實機驗證發現此類問題時，已 commit 的多個 ticket 全部需重工，阻塞版本里程碑 |

**Action**：三層防護（見「防護方向」章節）：短期 ESLint 靜態檢查 + 中期 esbuild define 配置 + 長期 build-time bundle scan。

---

## 基本資訊

- **Pattern ID**: IMP-078
- **分類**: 實作（implementation）
- **來源版本**: v0.19.0
- **發現日期**: 2026-05-23（W1-050 ANA 全 src 盤點）
- **風險等級**: 高

---

## 問題描述

### 症狀

1. `npm test` 全套件通過（195 suites 全綠）
2. acceptance 逐條勾選完成，執行 `ticket track complete`
3. 實機載入 Chrome Extension，功能立即崩潰
4. DevTools console 顯示 `Uncaught ReferenceError: global is not defined` 或 `Uncaught ReferenceError: process is not defined`
5. 受影響的 CE runtime 頁面（overview / popup / SW / content script）完全不可用

### 根本原因（5 Why 分析）

1. **Why 1**：CE runtime 出現 `ReferenceError: global is not defined`
   - 因為 `src/` 程式碼使用了 `global.FileReader`、`global.URL` 等 Node.js 全域變數

2. **Why 2**：為何 `src/` 使用 Node.js 全域變數？
   - 因為在 Node.js 開發環境（Jest 測試）下一切正常，開發者未意識到 CE runtime 差異

3. **Why 3**：為何 Jest 無法偵測此問題？
   - Jest 在 Node.js + jsdom 環境執行，`global` / `process` / `require` 天然可用；測試斷言聚焦邏輯正確性而非環境前提，測試設計無法覆蓋「API 是否在目標環境存在」這個維度

4. **Why 4**：為何 esbuild bundle 不自動解決？
   - esbuild 配置為 `platform: browser, bundle: true, format: iife`，設計上不 polyfill Node.js runtime API；`require('module')` 在 build 時解析為 inline，但 `global` / `process` 等 runtime 物件不在 esbuild 預設 define 範圍內

5. **Why 5（根本原因）**：測試環境（Node.js + jsdom）與部署環境（瀏覽器 + esbuild IIFE bundle）的 API 可用性存在根本性差異，但專案缺乏靜態防護機制（ESLint 禁用規則）和建置期驗證（bundle scan），使這個差異對開發流程完全透明，「測試通過 = 可部署」假設在此情境下不成立。

---

## 觸發條件

以下情境聯集時必然觸發：

| 條件 | 具體表現 |
|------|---------|
| `src/` 使用 Node.js 專屬 API | `global.*`、`process.env.*`、`process.hrtime`、`process.nextTick`、`process.memoryUsage`、`process.on`、`require('crypto')` 等 |
| 無 `typeof` guard | 直接裸用，無 `typeof global !== 'undefined'` 檢查 |
| esbuild 未配置 polyfill/define | `scripts/build.js` 的 esbuild 配置無 `define: { 'process.env.NODE_ENV': ... }` 且無 inject polyfill |
| 測試斷言不覆蓋環境前提 | 斷言聚焦回傳值結構 / 業務邏輯，不斷言「某 API 在目標環境是否可用」 |

**高風險 API 清單**（在 CE bundle 中使用必致命）：

| API | 類別 | CE 替代方案 |
|-----|------|-----------|
| `global` 裸用 | Node.js 全域 | `globalThis`（ES2020+，CE 安全）|
| `process.env.NODE_ENV` | Node.js 環境變數 | esbuild `define` 在 build 時替換為字串常量 |
| `process.hrtime()` | Node.js 計時 | `performance.now()`（Web API）|
| `process.nextTick()` | Node.js 事件循環 | `queueMicrotask()` 或 `setTimeout(fn, 0)` |
| `process.memoryUsage()` | Node.js 記憶體 | `performance.memory`（Chrome-only）或移除 |
| `process.on('uncaughtException')` | Node.js 事件 | `self.addEventListener('error')` |
| `require('crypto').randomBytes()` | Node.js 模組 | `crypto.getRandomValues()`（Web Crypto API）|
| `require('crypto').createHash()` | Node.js 模組 | `crypto.subtle.digest()`（Web Crypto API）|
| `global.gc()` | Node.js debugging | 不可用（CE runtime 無 V8 GC 暴露，移除或改用 `FinalizationRegistry`）|

---

## 防護方向

### 防護一：ESLint `no-restricted-globals` 靜態檢查（短期，優先實施）

在 `.eslintrc` 或 `eslint.config.js` 加入禁用規則，阻止 `src/` 直接引用 Node.js 全域：

```json
{
  "rules": {
    "no-restricted-globals": [
      "error",
      {
        "name": "global",
        "message": "CE runtime 無 Node.js global，請改用 globalThis"
      },
      {
        "name": "process",
        "message": "CE runtime 無 process，env 請用 esbuild define，計時請用 performance.now()"
      },
      {
        "name": "Buffer",
        "message": "CE runtime 無 Node.js Buffer，請改用 Uint8Array 或 TextEncoder"
      },
      {
        "name": "__dirname",
        "message": "CE runtime 無 __dirname，此為 Node.js 模組 API"
      },
      {
        "name": "__filename",
        "message": "CE runtime 無 __filename，此為 Node.js 模組 API"
      }
    ],
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "crypto",
            "message": "CE runtime 無 Node.js crypto 模組，請改用 Web Crypto API (globalThis.crypto)"
          },
          {
            "name": "fs",
            "message": "CE runtime 無 Node.js fs 模組"
          },
          {
            "name": "path",
            "message": "CE runtime 無 Node.js path 模組"
          }
        ]
      }
    ]
  }
}
```

**注意**：`src/core/migration/` 下的工具腳本是 dev-only，不在 CE entry point 依賴鏈中，可用 `/* eslint-disable no-restricted-globals */` 豁免或移至 `scripts/` 目錄。

**Why**：靜態分析在撰寫程式碼時即攔截，不依賴開發者記憶 CE 限制清單。成本最低（lint 規則一次加入）、防護最早（IDE 即時提示）。

### 防護二：esbuild `define` 配置（中期，消除 process.env 致命點）

在 `scripts/build.js` 的 esbuild 配置加入 `define`，使 `process.env.NODE_ENV` 在 bundle 時被替換為字串常量：

```javascript
// scripts/build.js（esbuild 配置段）
const buildConfig = {
  platform: 'browser',
  bundle: true,
  format: 'iife',
  // 新增：在 build 時替換 Node.js 環境變數
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),  // mode = 'development' | 'production'
    'process.env.JEST_WORKER_ID': 'undefined',      // CE runtime 非 Jest 環境
  },
  // ...其他既有配置
};
```

**驗證方式**：build 完成後 `grep -c 'process\.env\.NODE_ENV' dist/*.js` 應回傳 0。

**Why**：`process.env.NODE_ENV` 是使用最廣（本專案 13 處）、影響範圍最大（全 4 個 CE runtime）的致命點。esbuild define 是零侵入性解法（不修改 src/ 程式碼），build 時一次性消除。

### 防護三：Bundle scan 腳本（長期，建置期驗證）

在 CI 或 npm scripts 加入 bundle 產物掃描，確認 dist/ 不含已知危險 API：

```bash
#!/bin/bash
# scripts/verify-bundle-ce-compat.sh
# 驗證 CE bundle 不含 Node.js API 殘留

DIST_DIR="dist"
ERRORS=0

echo "=== CE Bundle 相容性掃描 ==="

# 檢查 Node.js global（非 globalThis）
if grep -rn '\bglobal\.' "$DIST_DIR" --include="*.js" | grep -v 'globalThis'; then
  echo "[ERROR] 發現 global.* 裸用，請改用 globalThis"
  ERRORS=$((ERRORS + 1))
fi

# 檢查 process.* 殘留（排除 define 替換後的字串）
if grep -rn 'process\.\(hrtime\|nextTick\|memoryUsage\|on\)' "$DIST_DIR" --include="*.js"; then
  echo "[ERROR] 發現 process.* Node.js API，請替換為瀏覽器 API"
  ERRORS=$((ERRORS + 1))
fi

# 確認 process.env.NODE_ENV 已被 define 替換（不應出現在 bundle）
if grep -rn 'process\.env\.NODE_ENV' "$DIST_DIR" --include="*.js"; then
  echo "[ERROR] process.env.NODE_ENV 未被 esbuild define 替換，請檢查 build.js"
  ERRORS=$((ERRORS + 1))
fi

# 檢查 Node.js crypto 模組殘留
if grep -rn "require\(['\"]crypto['\"]\)\|\.randomBytes\b\|\.createHash\b" "$DIST_DIR" --include="*.js"; then
  echo "[ERROR] 發現 Node.js crypto 模組殘留，請改用 Web Crypto API"
  ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -eq 0 ]; then
  echo "[PASS] CE bundle 相容性檢查通過"
  exit 0
else
  echo "[FAIL] 發現 $ERRORS 項 CE 不相容問題"
  exit 1
fi
```

加入 `package.json`：

```json
{
  "scripts": {
    "verify:ce-compat": "bash scripts/verify-bundle-ce-compat.sh",
    "build:dev": "node scripts/build.js development && npm run verify:ce-compat",
    "build:prod": "node scripts/build.js production && npm run verify:ce-compat"
  }
}
```

**Why**：ESLint 防護 src/ 層，但 bundle scan 防護的是「esbuild define 是否實際生效」和「是否有 API 從依賴鏈滲入」。兩層防護的覆蓋範圍互補。

---

<!-- PC-093-exempt: history:W1-050 + W1-001.2.1 + W1-047.1~.5 為已完成歷史錨點，非延後決策 -->
## 動機案例

### W1-050 ANA + W1-047.1~.5（2026-05-23，v0.19.0）

**事件鏈**：

1. **W1-047.1~.5**（五個 BookFileImporter 相關 IMP）：BookFileImporter 版本偵測、v2 結構提取、覆蓋/合併模式、UI 接線等五個連鎖修復。所有 ticket acceptance 全勾、npm test 通過、git commit 完成。
2. **W1-001.2.1**（實機驗證）：執行 UC-04 JSON 匯入流程，overview runtime 立即崩潰。DevTools 顯示 `Uncaught ReferenceError: global is not defined` at `file-reader-factory.js:24`。W1-047 系列修復全部實機不可用。
3. **W1-050**（全域盤點 ANA）：系統性掃描全 src，發現致命 21 處、潛在 17 處 CE 不相容問題。四大類型：`global` 裸用（6 處）、`process.env.NODE_ENV`（13 處）、`process.hrtime/nextTick/memoryUsage/on`（多處）、`require('crypto')`（6 處）。
4. **W1-050.1~.4**（修復 IMP）：依 ANA 拆分，修復 global/process.env/process.*/crypto 四類問題。
5. **本 ticket W1-050.5**（本 error-pattern）：記錄此 anti-pattern，防護後續同類事件。

**代價量化**：單一根因（CE-Node 環境前提未防護）引發 8+ ticket 連鎖，阻塞版本里程碑。

### W1-001.2.1 觸發細節（2026-05-23，v0.19.0）

**觸發點**：`src/utils/file-reader-factory.js` L24 / L37：

```javascript
// 錯誤：裸用 global（Node.js 全域，CE runtime 無此物件）
const FileReader = global.FileReader || window.FileReader;
```

**CE runtime 行為**：esbuild IIFE bundle 執行時，`global` 識別符查找失敗，立即拋出 `ReferenceError: global is not defined`，整個 IIFE 執行中斷，overview 頁面完全空白。

**正確做法**：

```javascript
// 正確：使用 globalThis（ES2020+，在所有 CE runtime context 安全）
const FileReader = globalThis.FileReader;
// 或直接引用（CE browser context 天然有 FileReader）
const reader = new FileReader();
```

---

## 與其他 error-pattern 的關係

| Error Pattern | 關聯性 | 說明 |
|--------------|--------|------|
| PC-165（false-positive-fix-chain） | 強相關（上位 pattern） | PC-165 描述「測試綠燈但 runtime 無效」的通用機制（mock 自洽 + 斷言不覆蓋 runtime 路徑 + 後續 ticket 信任前序綠燈）；IMP-078 是 PC-165 在「跨環境部署（Node.js 測試環境 vs 瀏覽器 CE runtime）」維度的特化版本 |
| ARCH-013（ESM/CJS 混合匯出）| 弱相關（同屬建置環境差異類） | ARCH-013 聚焦 ESM/CJS 模組格式差異；IMP-078 聚焦 Node.js API 與瀏覽器 API 可用性差異；兩者共同根因是「建置環境差異未被靜態防護」|
| ARCH-021（模組組裝遺漏靜默斷裂） | 弱相關（同屬靜默失效類） | 共通機制：問題在 unit test 層不可見，只在端到端執行時暴露；觸發維度不同（ARCH-021 是組裝遺漏，IMP-078 是 API 環境差異）|

**分類說明**：此 pattern 歸 `implementation/`（IMP）而非 `process-compliance/`（PC），理由是觸發點與防護機制均位於程式碼實作層（`src/` API 選擇 + ESLint 配置 + esbuild 配置 + bundle scan），而非流程協作層（PM 派發/代理人協作/ticket 生命週期）。

---

## 正確做法

### 新寫 CE src/ 程式碼前的自查清單

- [ ] 是否使用 `global`？→ 改 `globalThis`
- [ ] 是否使用 `process.env.NODE_ENV`？→ 確認 `build.js` 有 `define` 配置；未有則先加
- [ ] 是否使用 `process.hrtime/nextTick/memoryUsage`？→ 改 `performance.now()` / `queueMicrotask()` / `performance.memory`
- [ ] 是否使用 `process.on('uncaughtException')`？→ 改 `self.addEventListener('error')`
- [ ] 是否使用 `require('crypto')`？→ 改 `globalThis.crypto.getRandomValues()` / `crypto.subtle.digest()`
- [ ] 是否使用 `global.gc()`？→ 移除（Node.js debugging API，CE runtime 無 V8 GC 暴露）
- [ ] 是否在 SW context 使用 `window.*`？→ 改 `self.*`（SW 使用 `self` 而非 `window`）

### 錯誤做法（避免）

```javascript
// 錯誤：所有以下用法在 CE bundle 均為致命
const reader = global.FileReader;             // global 裸用
const env = process.env.NODE_ENV;             // process.env 未 define
const t = process.hrtime.bigint();            // Node.js 計時
process.nextTick(() => { ... });              // Node.js 事件循環
const bytes = require('crypto').randomBytes(16); // Node.js 模組
process.on('unhandledRejection', handler);   // Node.js 事件
const mem = process.memoryUsage().heapUsed;  // Node.js 記憶體
```

### 正確做法

```javascript
// 正確：CE 安全等效替換
const reader = globalThis.FileReader;         // globalThis 跨 context 安全
const env = 'production';                     // esbuild define 替換後的字串常量
const t = performance.now();                  // Web API
queueMicrotask(() => { ... });               // Web API
const bytes = new Uint8Array(16);            // Web API
globalThis.crypto.getRandomValues(bytes);    // Web Crypto API
self.addEventListener('unhandledrejection', handler); // Service Worker event
const mem = performance.memory?.usedJSHeapSize; // Chrome-only，需 optional chaining
```

---

## 抽象層級分析（必填）

| 欄位 | 內容 |
|------|------|
| 症狀層級 | 工具層（CE DevTools ReferenceError）/ 實作層（`src/` 程式碼使用 Node.js API）|
| 根因層級 | 架構層（測試環境與部署環境 API 可用性差異未被靜態防護）|
| 跨層路徑 | 實作層（API 使用） → 工具層（Jest 測試通過）→ 架構層（環境差異無防護閘）；症狀表現在工具層，根因在架構層（防護機制缺失） |
| 防護層級 | 實作層：ESLint 禁用規則（`src/` 撰寫期）；工具層：esbuild define（build 時）；架構層：bundle scan（建置驗證流程）；落地至 `scripts/build.js` + `eslint.config.js` + `scripts/verify-bundle-ce-compat.sh` |
| 跨層警示 | 禁止提升至認知層（誤推為「開發者不夠細心」）；根因是架構防護機制缺失，非個人失誤 |

---

<!-- PC-093-exempt: history:W1-050 + W1-001.2.1 + W1-047.1~.5 為已完成歷史錨點，非延後決策 -->
## 相關資源

- `docs/work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W1-050.md` — W1-050 ANA 全 src 盤點（致命 21 處完整表格 + 修復 IMP 拆分）
- `docs/work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W1-001.2.1.md` — 觸發案例（file-reader-factory global 裸用實機崩潰）
- `docs/chrome-extension-dev-guide.md` — CE 開發規範（含 Manifest V3 API 限制完整說明）
- `.claude/references/chrome-extension-quickref.md` — CE 速查（關鍵限制速查表）
- `.claude/error-patterns/process-compliance/PC-165-false-positive-fix-chain.md` — 上位 pattern（測試綠燈不等於 runtime 正確）
- `scripts/build.js` — esbuild 配置（需加 define）

---

## 標籤

`#chrome-extension` `#nodejs-api` `#esbuild` `#runtime-mismatch` `#jest-false-positive` `#eslint` `#ce-runtime`

---

**Last Updated**: 2026-05-30
**Version**: 1.0.0 — 初始建立，源 W1-050 ANA（全 src CE 不相容盤點）+ W1-001.2.1（觸發案例）+ W1-047.1~.5（測試綠燈但實機失敗的修復鏈）
