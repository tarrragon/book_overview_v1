# Chrome Extension 開發注意事項

本文件彙整 v0.15.0 至 v0.15.2 修復過程中發現的 Chrome Extension 環境限制和開發最佳實踐。

---

## 1. 模組系統限制

### 問題描述

Chrome Extension 不支援 Node.js 的 `require()` 語法。Service Worker 支援 ES module（需在 manifest 中宣告 `"type": "module"`），但 content script 不支援 ES module。

### 錯誤寫法

```javascript
// content.js — 在 Chrome Extension content script 中使用 require
const { BookExtractor } = require('./extractors/BookExtractor');
```

### 正確做法

使用 esbuild 在 build 階段將各入口點 bundle 為 IIFE 格式，消除所有 `require()` 和 `import` 語句。

```javascript
// build.js — 使用 esbuild bundle 為 IIFE
await esbuild.build({
  entryPoints: ['src/content/content.js'],
  bundle: true,
  format: 'iife',
  outfile: 'dist/content.js',
});
```

### 相關版本

v0.15.0 基礎建置修復

---

## 2. ES Module import 路徑

### 問題描述

Chrome Extension 的 ES module 不支援 bare specifier（如 `import x from 'src/core/...'`）。必須使用相對路徑（`./`、`../`）。使用 esbuild bundling 後此限制不再適用，因為 bundle 後不存在 import 語句。

### 錯誤寫法

```javascript
// 錯誤：bare specifier 在 Chrome Extension 環境中無法解析
import { ErrorCodes } from 'src/core/errors/ErrorCodes';
```

### 正確做法

```javascript
// 正確：使用相對路徑
import { ErrorCodes } from '../../core/errors/ErrorCodes.js';

// 或者：使用 esbuild alias 在 build 階段解析 bare specifier
// build.js 中設定 alias
await esbuild.build({
  alias: {
    'src': './src',
  },
  // ...
});
```

### 相關版本

v0.15.0 基礎建置修復

---

## 3. 全域物件差異

### 問題描述

`global` 是 Node.js 專有物件，在 Chrome Extension 環境中不存在。`window` 在 Service Worker 中不存在，僅在 content script 和 popup 中可用。`globalThis` 是 ES2020 標準，所有 JavaScript 環境通用。

### 錯誤寫法

```javascript
// 錯誤：global 在瀏覽器環境不存在
global.myConfig = { debug: true };

// 錯誤：window 在 Service Worker 中不存在
window.addEventListener('load', init);
```

### 正確做法

```javascript
// 正確：使用 globalThis（ES2020 標準，所有環境通用）
globalThis.myConfig = { debug: true };

// 正確：在 Service Worker 中使用 self 或 globalThis
self.addEventListener('install', handleInstall);
```

### 相關版本

v0.15.1 content.js 缺失修復

---

## 4. Chrome Storage API 參數格式

### 問題描述

`chrome.storage.local.get()` 和 `chrome.storage.local.remove()` 的 keys 參數必須是陣列格式 `['key']`，不能是單純字串 `'key'`。傳入包含 `undefined` 值的陣列（如 `[undefined]`）會拋出 TypeError。

### 錯誤寫法

```javascript
// 錯誤：keys 參數不是陣列
const result = await chrome.storage.local.get('bookData');

// 錯誤：陣列中包含 undefined
const key = someFunction(); // 可能回傳 undefined
await chrome.storage.local.remove([key]); // TypeError
```

### 正確做法

```javascript
// 正確：使用陣列格式
const result = await chrome.storage.local.get(['bookData']);

// 正確：移除前驗證 key 值
const key = someFunction();
if (key !== undefined && key !== null) {
  await chrome.storage.local.remove([key]);
}
```

### 相關版本

v0.15.2 執行階段錯誤修復

---

## 5. CJS/ESM 雙模式 export

### 問題描述

如果模組需要同時在 Node.js（Jest 測試環境）和瀏覽器（bundled Extension）環境中使用，可以同時保留 `module.exports` 和 `export {}` 兩種匯出方式。esbuild bundling 時會正確處理 CJS require。

### 錯誤寫法

```javascript
// 錯誤：只用 ES module export，Jest 無法直接載入
export class BookExtractor { /* ... */ }
// Jest 在沒有 transform 的情況下會報錯
```

### 正確做法

```javascript
// 正確：雙模式 export
class BookExtractor { /* ... */ }

// CJS export（Node.js / Jest 使用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BookExtractor };
}

// ESM export（esbuild bundle 使用）
export { BookExtractor };
```

### 相關版本

v0.15.0 基礎建置修復

---

## 6. manifest.json 配置

### 問題描述

Service Worker 使用 ES module 需在 manifest 中宣告 `"type": "module"`。但如果使用 esbuild 將 Service Worker 打包為 IIFE bundle，則不需要此宣告。`validate-build.js` 驗證腳本中引用的檔名必須與 manifest 中宣告的檔名一致。

### 錯誤寫法

```json
// 錯誤：使用 IIFE bundle 但仍宣告 type: module
{
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

### 正確做法

```json
// 正確：IIFE bundle 不需要 type: module
{
  "background": {
    "service_worker": "background.js"
  }
}

// 正確：如果不做 bundle，保留 ES module 原始檔案時才需要
{
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

**注意**：建置驗證腳本（如 `validate-build.js`）中檢查的檔案清單必須與 manifest.json 中實際宣告的檔案一致，否則驗證會誤報。

### 相關版本

v0.15.0 基礎建置修復

---

## 7. Service Worker 事件監聽器限制

### 問題描述

`error` 和 `unhandledrejection` 事件處理器必須在 Service Worker script 的 initial evaluation 階段（即頂層作用域）註冊。如果延遲註冊（例如在 async init 函式中），Chrome 會發出警告。

### 錯誤寫法

```javascript
// 錯誤：在 async 初始化中延遲註冊事件處理器
async function init() {
  await loadConfig();
  // Chrome 警告：事件處理器未在 initial evaluation 中註冊
  self.addEventListener('error', handleError);
  self.addEventListener('unhandledrejection', handleRejection);
}

init();
```

### 正確做法

```javascript
// 正確：在頂層作用域立即註冊事件處理器
self.addEventListener('error', handleError);
self.addEventListener('unhandledrejection', handleRejection);

// 其他初始化可以放在 async 函式中
async function init() {
  await loadConfig();
  // 業務邏輯初始化...
}

init();
```

### 相關版本

v0.15.2 執行階段錯誤修復

---

## 8. 健康檢查設計

### 問題描述

服務啟動後但尚未處理任何業務時，統計值都是初始值（如 0）。健康檢查邏輯應考慮「無業務記錄」的狀態，避免將初始狀態誤判為不健康。此外，不同模組可能有不同的狀態介面（如 BaseModule 與 DomainCoordinator），健康檢查需要適配不同介面。

### 錯誤寫法

```javascript
// 錯誤：將無業務記錄視為不健康
function checkHealth(stats) {
  if (stats.successCount === 0) {
    return { healthy: false, reason: 'No successful operations' };
  }
  // ...
}
```

### 正確做法

```javascript
// 正確：區分「無業務記錄」和「業務失敗」
function checkHealth(stats) {
  const hasActivity = stats.totalCount > 0;

  if (!hasActivity) {
    return { healthy: true, reason: 'No activity yet (just started)' };
  }

  if (stats.errorRate > ERROR_RATE_THRESHOLD) {
    return { healthy: false, reason: `Error rate ${stats.errorRate} exceeds threshold` };
  }

  return { healthy: true };
}
```

### 相關版本

v0.15.2 執行階段錯誤修復

---

## 9. Build Script 注意事項

### 問題描述

Build script 需要執行 bundling 而非僅複製檔案，才能解決模組系統差異問題。esbuild alias 可用於解析 bare specifier。建議為三個入口點（background、content、popup）都做 bundle。

### 錯誤寫法

```javascript
// 錯誤：只是複製檔案，不做 bundling
fs.copyFileSync('src/background/background.js', 'dist/background.js');
fs.copyFileSync('src/content/content.js', 'dist/content.js');
```

### 正確做法

```javascript
// 正確：為所有入口點做 bundle
const entryPoints = [
  { in: 'src/background/background.js', out: 'background' },
  { in: 'src/content/content.js', out: 'content' },
  { in: 'src/popup/popup.js', out: 'popup' },
];

for (const entry of entryPoints) {
  await esbuild.build({
    entryPoints: [entry.in],
    bundle: true,
    format: 'iife',
    outfile: `dist/${entry.out}.js`,
    alias: {
      'src': './src',
    },
  });
}
```

### 相關版本

v0.15.0 基礎建置修復

---

## 10. 權限監控設計

### 問題描述

避免使用高頻率定時檢查（如每 5 秒），這會造成不必要的資源消耗。建議使用較低頻率（如 5 分鐘以上），並搭配快取比對機制，只在狀態實際變更時才輸出日誌。

### 錯誤寫法

```javascript
// 錯誤：每 5 秒輪詢，頻率過高
setInterval(async () => {
  const permissions = await chrome.permissions.getAll();
  console.log('Current permissions:', permissions);
}, 5000);
```

### 正確做法

```javascript
const PERMISSION_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 分鐘
let cachedPermissions = null;

setInterval(async () => {
  const currentPermissions = await chrome.permissions.getAll();
  const permissionsString = JSON.stringify(currentPermissions);

  // 只在狀態變更時輸出日誌
  if (permissionsString !== cachedPermissions) {
    console.log('Permissions changed:', currentPermissions);
    cachedPermissions = permissionsString;
  }
}, PERMISSION_CHECK_INTERVAL_MS);
```

### 相關版本

v0.15.2 執行階段錯誤修復

---

## 快速參考表

| 項目 | 限制 | 解法 |
|------|------|------|
| `require()` | 不可用 | esbuild IIFE bundle |
| Bare specifier | 不可用 | 相對路徑或 esbuild alias |
| `global` | 不存在 | 使用 `globalThis` |
| `window` | Service Worker 不可用 | 使用 `self` 或 `globalThis` |
| Storage API keys | 必須是陣列 | `['key']` 而非 `'key'` |
| CJS/ESM 並存 | Jest 需要 CJS | 雙模式 export |
| manifest type: module | IIFE bundle 不需要 | 依 bundle 策略決定 |
| 事件監聽器 | 必須在頂層註冊 | 避免 async 延遲註冊 |
| 健康檢查 | 初始狀態非異常 | 區分「無記錄」和「失敗」 |
| Build script | 需 bundling | esbuild 三入口點 bundle |
| 權限監控 | 避免高頻輪詢 | 5 分鐘間隔 + 快取比對 |

---

**Last Updated**: 2026-03-28
**Version**: 1.0.0
**Source**: v0.15.0 ~ v0.15.2 修復經驗彙整
