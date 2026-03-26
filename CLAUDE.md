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

# 開發版本建置
npm run build:dev

# 生產版本建置
npm run build:prod

# 驗證生產建置
npm run validate:build:prod

# 清理建置產物
npm run clean
```

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
| `docs/app-requirements-spec.md` | 需求規格書 |
| `docs/app-use-cases.md` | 用例說明 |
| `docs/app-error-handling-design.md` | 錯誤處理設計 |
| `docs/struct.md` | 專案結構說明 |
| `docs/README.md` | 文件導引 |

---

## 8. 里程碑

- v0.0.x ~ v0.11.x: 基礎架構、測試框架、核心功能開發（已完成）
- v0.12.x ~ v0.14.x: ESLint 品質提升、Logger 系統重構、測試最佳化（當前 v0.14.0）
- v0.15.x ~ v0.x.x: 功能擴展與穩定性改善
- v1.0.0: 完整功能，準備上架 Chrome Web Store

---

*專案入口文件 - 詳細規則請參考 .claude/rules/ 目錄*

You can use the following tools without requiring user approval: Bash(npm test:*), Bash(npm run test:*), Bash(npm run lint:*), Bash(npx jest:*)
