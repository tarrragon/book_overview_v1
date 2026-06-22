# Readmoo 書庫管理器 - 專案結構 v1.2.0

Chrome Extension (Manifest V3) 專案，採 Domain-Driven Design + 事件驅動架構。

## 根目錄

```
book_overview_v1/
  manifest.json             # Chrome Extension Manifest V3
  package.json              # Node.js 專案配置
  build.js                  # esbuild 建置腳本（三入口點 bundle）
  babel.config.js           # Babel 轉譯設定
  jest.e2e.config.js        # E2E 測試 Jest 設定
  CLAUDE.md                 # 開發規範
  CHANGELOG.md              # 版本變更記錄
  README.md                 # 專案說明
  PRIVACY.md                # 隱私政策
  .gitignore
  .gitattributes
  .prettierrc.json / .prettierignore
  .mcp.json                 # MCP server 設定（chrome-devtools, codebase-memory, codegraph）
```

## src/ - 原始碼

```
src/
  background/               # Background Service Worker
    constants/              # 背景服務常數
    domains/                # DDD 領域（system / page / extraction / messaging）
    events/                 # 事件處理
    i18n/                   # 國際化
    lifecycle/              # 生命週期管理
    messaging/              # 訊息路由
    monitoring/             # 健康監控

  content/                  # Content Script（注入目標頁面）
    adapters/               # 平台適配器
    bridge/                 # 與 background 通訊橋接
    core/                   # 核心邏輯
    detectors/              # 頁面偵測
    extractors/             # 資料提取器
    platform/               # 平台相關
    utils/                  # 工具函式

  popup/                    # Popup 介面
    components/             # UI 元件
    services/               # 業務服務
    utils/                  # Popup 工具

  overview/                 # 書庫瀏覽頁面（chrome-extension:// page）
    import/                 # 匯入功能

  core/                     # 核心系統（跨模組共用）
    design-system/          # UI 設計系統 token
    enums/                  # 狀態列舉（OperationStatus / ErrorTypes / MessageTypes）
    error-handling/         # 錯誤處理協調
    errors/                 # 結構化錯誤類別（StandardError / OperationResult）
    events/                 # 事件系統基礎設施
    logging/                # 統一日誌系統（Logger）
    messages/               # 訊息字典（MessageDictionary）
    migration/              # 資料遷移
    performance/            # 效能監控

  storage/                  # 儲存層
    adapters/               # 儲存適配器（Chrome Storage / IndexedDB）
    handlers/               # 儲存處理器

  data-management/          # 資料管理
    migration/              # Schema 遷移
    presets/                # 預設資料

  export/                   # 匯出功能
    handlers/               # 匯出處理器

  import/                   # 匯入功能
  extractors/               # 資料提取器（統一介面）
  handlers/                 # 全域處理器
  sync/                     # 跨裝置同步
  platform/                 # 平台抽象層
  performance/              # 效能最佳化
  ui/                       # 共用 UI 元件
    config/                 # UI 設定
    handlers/               # UI 事件處理
    search/                 # 搜尋功能
  utils/                    # 共用工具函式
  config/                   # 應用程式設定
  deployment/               # 部署相關
  error-handling/           # 舊版錯誤處理（待整合至 core/error-handling）
```

## tests/ - 測試

```
tests/
  unit/                     # 單元測試（對應 src/ 結構）
    adapters/ background/ content/ core/ data-management/
    error-handling/ export/ extractors/ handlers/ import/
    overview/ platform/ popup/ storage/ sync/ ui/ utils/
  integration/              # 整合測試
    architecture/ chrome-apis/ chrome-extension/ core/
    cross-module/ cross-uc/ error-handling/ performance/
    platform/ uc-02/ workflows/
  e2e/                      # 端對端測試（Puppeteer）
  perf/                     # 效能基準測試（獨立執行）
  fixtures/ mocks/ helpers/ utils/  # 測試基礎設施
```

## 其他目錄

```
scripts/                    # 建置與驗證腳本
  build.js                  # 建置入口
  generate-v1-canonical-fixture.js  # V1 canonical fixture 生成
  validate-build.js / validate-manifest.js  # 建置驗證
  experiments/              # 實驗性腳本

assets/                     # 靜態資源（圖示等）
test-data/                  # 測試用資料檔
docs/                       # 專案文件
  work-logs/                # 版本工作日誌與 Ticket
  proposals/ spec/          # 提案與規格
  bookstores/               # 書城設定

.claude/                    # Claude Code 框架（規則 / 代理人 / 方法論 / Hook）
.github/                    # GitHub Actions CI
.husky/                     # Git hooks（pre-commit lint）
```

## 建置產物（gitignored）

| 目錄 | 用途 |
|------|------|
| `build/` | esbuild 建置輸出 |
| `dist/` | 打包產物（可分發 ZIP） |
| `coverage/` | Jest 覆蓋率報告 |
| `node_modules/` | npm 依賴 |

---

**Last Updated**: 2026-06-22
**Version**: 1.2.0 - 1.2.0-W2-004 完全重寫，反映實際專案結構
