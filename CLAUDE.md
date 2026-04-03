# CLAUDE.md

本文件為 Claude Code 在此專案中的開發指導規範。

---

## 1. 專案身份

**專案名稱**: Readmoo 書庫管理器 (readmoo-book-extractor)

**專案目標**: 專為 Readmoo 電子書平台設計的 Chrome 擴充功能，提供書庫資料自動提取、本地化書目管理、搜尋篩選和批量匯出功能

**專案類型**: Chrome Extension (Manifest V3)

| 項目 | 值 |
|------|------|
| 開發語言 | JavaScript (ES Module) |
| 編譯工具 | npm, Babel, 自訂 build.js |
| 測試框架 | Jest (單元/整合), Puppeteer (E2E) |
| 目標平台 | Chrome Web Store / Chromium 瀏覽器 |
| 專案識別 | `package.json`, `manifest.json`, `src/` 目錄 |

**啟用的 MCP/Plugin**:

- serena - 語意程式碼操作
- context7 - 文件查詢

---

## 2. 核心價值

@.claude/rules/core/quality-baseline.md

---

## 3. 規則系統

@.claude/rules/README.md

---

## 4. 語言特定規範

| 項目 | 值 |
|------|------|
| **語言** | JavaScript (ES Module) |
| **實作代理人** | thyme-extension-engineer（Chrome Extension 開發） |

---

## 4.1 專案重啟狀態 (2026-03-26)

**背景**: 專案自 2025-09 起暫停約半年，現重新啟動開發。

**重要事項**:
- 先前的 ticket（todolist.md）規格不完整，需要**全面重新製作 ticket**
- 既有 todolist.md 內容僅供歷史參考，不作為當前開發依據
- 需重新評估專案現況、測試狀態、架構健康度後，再制定新的開發計畫

---

## 5. 開發指令

### 測試指令

```bash
# 執行核心測試（單元 + 整合）
npm test

# 執行單元測試
npm run test:unit

# 執行整合測試
npm run test:integration

# 監視模式
npm run test:watch

# 產生覆蓋率報告
npm run test:coverage

# 執行所有測試（含 E2E）
npm run test:comprehensive
```

### 建置指令

```bash
# 安裝依賴項
npm install

# 開發版本建置（預設，保留所有 log 輸出）
npm run build:dev

# 生產版本建置（正式發布用，移除 log 輸出）
npm run build:prod

# 驗證生產建置
npm run validate:build:prod

# 清理建置產物
npm run clean
```

**建置模式說明**：

| 模式 | 指令 | Log 輸出 | 用途 |
|------|------|---------|------|
| development | `npm run build:dev` | 保留 | 日常開發、測試、除錯 |
| production | `npm run build:prod` | 移除 | 正式發布至 Chrome Web Store |

**預設行為**：除非明確要做正式發布版，所有「編譯」「建置」「build」指令一律使用 `npm run build:dev`。

### 程式碼品質指令

```bash
# 執行 ESLint 分析
npm run lint

# 自動修復 ESLint 問題
npm run lint:fix

# 格式化程式碼 (Prettier)
npm run format

# 檢查格式
npm run format:check
```

---

## 6. 專案特定規範

### 錯誤處理體系

專案採用分層錯誤處理，基於 ErrorCodes 常數和專用錯誤類別：

| 錯誤類型 | 檔案位置 | 用途 |
|---------|---------|------|
| ErrorCodes | `src/core/errors/ErrorCodes.js` | 核心錯誤代碼常數 |
| NetworkError | `src/core/errors/NetworkError.js` | 網路相關錯誤 |
| BookValidationError | `src/core/errors/BookValidationError.js` | 書籍資料驗證錯誤 |
| ErrorHelper | `src/core/errors/ErrorHelper.js` | 統一錯誤處理工具 |
| OperationResult | `src/core/errors/OperationResult.js` | 統一操作結果結構 |
| UC0X ErrorFactory/Adapter | `src/core/errors/UC0XError*.js` | 用例特定錯誤工廠 |

**強制規範**：

- 禁止 `throw 'error message'` 或 `throw new Error('message')`，使用專案錯誤類別
- 使用 `OperationResult` 統一回應格式
- 詳見：`src/core/errors/` 目錄

### 專案架構

```
src/
├── background/       # Service Worker 和後台邏輯
├── content/          # Content Script（頁面注入）
├── popup/            # 彈出視窗 UI
├── core/             # 核心模組（errors, enums 等）
├── extractors/       # 資料提取器
├── handlers/         # 事件處理器
├── storage/          # 儲存管理
├── export/           # 匯出功能
├── ui/               # 通用 UI 元件
├── utils/            # 工具函式
├── data-management/  # 資料管理
├── overview/         # 書庫總覽
├── performance/      # 效能相關
└── platform/         # 平台抽象層
```

---

## 7. 專案文件

### 任務追蹤

| 文件 | 用途 |
|------|------|
| `docs/todolist.md` | 開發任務追蹤 |
| `docs/work-logs/` | 版本工作日誌 |
| `CHANGELOG.md` | 版本變更記錄 |

### 專案規格文件

| 文件 | 用途 |
|------|------|
| `docs/app-requirements-spec.md` | APP 版需求規格書（Flutter，v2.0+ 規劃） |
| `docs/use-cases.md` | Chrome Extension 用例規格（v1.0 基線，7 個 UC） |
| `docs/app-use-cases.md` | APP 版用例說明（Flutter，v2.0+ 規劃） |
| `docs/app-error-handling-design.md` | 錯誤處理設計 |
| `docs/struct.md` | 專案結構說明 |
| `docs/README.md` | 文件導引 |
| `docs/data-flow-architecture.md` | 資料流架構與已知陷阱（必讀） |
| `docs/proposals-tracking.yaml` | 提案追蹤索引 |

### Chrome Extension 開發規範（必讀）

Chrome Extension 環境有多項與 Node.js 不同的限制，開發和修改程式碼前**必須閱讀**：

**完整規範**：`docs/chrome-extension-dev-guide.md`

**關鍵限制速查**：

| 限制 | 說明 | 解法 |
|------|------|------|
| 禁用 `require()` | Content Script 不支援 CJS | esbuild IIFE bundle |
| 禁用 bare specifier | `import x from 'src/...'` 無效 | 相對路徑或 esbuild alias |
| 禁用 `global` | 非 Node.js 環境 | 使用 `globalThis` |
| `window` 限制 | Service Worker 無 `window` | 使用 `self` 或 `globalThis` |
| Storage API | keys 必須是陣列 `['key']` | 非 `'key'` 字串 |
| 事件監聽器 | 必須在 SW 頂層註冊 | 禁止 async 延遲註冊 |
| Build 必須 bundle | 不能只複製檔案 | esbuild 三入口點 bundle |

**測試環境差異**（常見測試失敗根因）：

| 問題 | 說明 |
|------|------|
| Jest 用 jsdom，非真實 Chrome 環境 | Chrome API（storage/runtime/tabs）需 mock |
| CJS/ESM 雙模式 | 模組需同時支援 `module.exports` 和 `export` |
| `performance.now` mock | 遞增值需手動管理，否則 OOM |
| DOM 選擇器 | Readmoo 頁面結構會變更，選擇器需多層 fallback |

---

## 8. 里程碑

- v0.0.x ~ v0.11.x: 基礎架構、測試框架、核心功能開發（已完成）
- v0.12.x ~ v0.14.x: ESLint 品質提升、Logger 系統重構、測試最佳化（已完成）
- v0.15.x ~ v0.16.x: 專案重啟、測試修復、同步機制、文件系統（已完成 v0.16.3）
- v0.17.x: Tag-based Book Model 重構（PROP-007，含 Schema/Storage/匯出/搜尋適配）
- v0.18.x: 測試重寫與品質恢復（對齊新 model，失敗測試歸零）
- v0.19.x: 端到端驗證、打包與內測準備（實機測試 + 可分發打包 + 安裝指南）
- v0.20.x: 中文圖書分類法 + Tag 管理功能
- v1.0.0: 內測版本（可打包分發，Readmoo 提取 + 匯出入 + 跨裝置同步正常）
- v2.0.0: 多書城支援（博客來/Kindle/Kobo）+ Chrome Web Store 上架

---

*專案入口文件 - 詳細規則請參考 .claude/rules/ 目錄*

You can use the following tools without requiring user approval: Bash(npm test:*), Bash(npm run test:*), Bash(npm run lint:*), Bash(npx jest:*)
