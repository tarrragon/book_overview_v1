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

## 11. E2E 測試本地執行與除錯

### E2E 測試環境概述

E2E 測試使用 Puppeteer（`^22.15.0`）操控真實 Chromium 瀏覽器，並透過 `--load-extension` flag 載入已建置的 Extension。其設計與單元/整合測試有本質差異：

| 項目 | 單元/整合測試 | E2E 測試 |
|------|-------------|---------|
| Jest 配置 | `jest.config.js` | `jest.e2e.config.js` |
| 測試環境 | jsdom（模擬 DOM） | node（真實 Chrome） |
| Chrome API | `jest-chrome` mock | 真實 Chrome Extension API |
| 執行模式 | headed/headless 皆可 | 必須 headed（Manifest V3 限制） |
| 測試逾時 | 5000ms（預設） | 30000ms |
| 前置條件 | 無 | `build/development/` 必須存在 |

**Why**：Manifest V3 的 Chrome 目前不支援在 headless 模式下載入 Extension。E2E 測試執行時 Chrome 視窗會短暫可見，這是預期行為。

### 本地執行 E2E 測試

```bash
# 前提：確保 Extension 已建置
npm run build:dev

# 執行全部 E2E 測試（排除 browser 子目錄）
npm run test:e2e

# 執行特定子套件
npm run test:e2e:workflow      # tests/e2e/workflows/（端到端工作流程）
npm run test:e2e:integration   # tests/e2e/integration/（整合流程）
npm run test:e2e:performance   # tests/e2e/performance/（效能測試）
npm run test:e2e:browser       # tests/e2e/browser/（需 headed Chrome）

# 完整流程（自動 build + 執行所有子套件 + 生成報告）
npm run test:e2e:full
```

### 常見失敗與除錯步驟

#### 問題 1：Chrome 找不到

```
Error: Could not find Chrome (ver. XXX)
```

**根因**：Puppeteer 的 Chromium 未下載，且系統無 Chrome。

**除錯步驟**：

```bash
# 確認 Puppeteer 能否找到 Chrome
node -e "const puppeteer = require('puppeteer'); console.log(puppeteer.executablePath())"

# 若上面指令報錯，重新安裝 Puppeteer（觸發 Chromium 下載）
npm install puppeteer --legacy-peer-deps
```

若系統已安裝 Chrome，`extension-setup.js` 的 `resolveChromePath()` 會自動偵測以下路徑：
- `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- `/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary`
- `/Applications/Chromium.app/Contents/MacOS/Chromium`

#### 問題 2：Extension ID 取得失敗

```
Error: 取得 Extension ID 失敗
```

**根因**：Extension 未成功載入（`build/development/` 不存在或 manifest 有誤）。

**除錯步驟**：

```bash
# 確認 build 產物存在
ls -la build/development/manifest.json

# 重新建置
npm run build:dev

# 手動驗證 manifest 語法
node -e "require('./build/development/manifest.json'); console.log('manifest 語法正確')"
```

#### 問題 3：測試 timeout

```
Timeout - Async callback was not invoked within the 30000 ms timeout
```

**根因**：Chrome 啟動慢、Service Worker 初始化慢、或系統資源不足。

**除錯步驟**：

```bash
# 觀察 Chrome 啟動情況（E2E 測試執行時 Chrome 視窗是否出現）
# 若視窗完全不出現，是 Chrome 啟動失敗問題
# 若視窗出現但空白，是 Extension 載入問題

# 在 CI 環境關閉 headed 模式（注意：Manifest V3 Extension 在 headless Chrome 可能無法正常運作）
HEADLESS=false npm run test:e2e
```

若需要調高逾時，可修改 `jest.e2e.config.js` 的 `testTimeout` 值（不建議長期保留，應排查根因）。

#### 問題 4：`Cannot find module 'src/core/...'`

**根因**：誤用了預設的 `jest.config.js`（不含 E2E 的 `moduleNameMapper`），未使用 `jest.e2e.config.js`。

**除錯步驟**：確認執行的是 `npm run test:e2e`（會帶 `--config jest.e2e.config.js`），而非 `npx jest tests/e2e/`（會使用預設配置）。

### 截圖與 Debug 輔助

E2E 測試失敗時，`ExtensionTestSetup.takeScreenshot()` 可擷取當下的瀏覽器畫面：

```javascript
// tests/e2e/ 測試檔中使用
await setup.takeScreenshot('after-extraction-failure');
// 截圖儲存至 tests/e2e/screenshots/<name>.png
```

DevTools Console 中的錯誤會被攔截並輸出到測試 stdout：

```javascript
// extension-setup.js 已設置攔截，測試輸出中會見到：
// [WARNING] 頁面 Console Error: <錯誤訊息>
// [WARNING] 頁面錯誤: <錯誤訊息>
```

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
| E2E headed 模式 | Manifest V3 不支援 headless + Extension | 以 headed 模式執行（視窗短暫可見屬正常）|
| E2E build 前置 | 測試前需 `build/development/` 存在 | 執行 `npm run build:dev` |

---

**Last Updated**: 2026-05-22 | **Version**: 1.1.0 — 新增 §11 E2E 測試本地執行與除錯（Source: `0.19.0-W5-005`）
**Version**: 1.0.0 — v0.15.0 ~ v0.15.2 修復經驗彙整（2026-03-28）
