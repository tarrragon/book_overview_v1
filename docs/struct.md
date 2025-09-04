# 📁 多平台電子書管理系統 - 專案結構設計 v2.0

## 🎯 結構設計原則

### Domain-Driven Design + 事件驅動架構 v2.0

專案基於Chrome Extension Manifest V3設計，採用領域驅動設計(DDD)配合事件驅動架構：

#### **核心架構原則**

- **領域分離 (Domain Separation)**：9個專業領域，各自負責明確的業務職責
- **三層架構 (Three-Layer Architecture)**：入口點 → 協調器 → 服務層
- **多平台支援 (Multi-Platform Support)**：支援5個主流書城平台
- **事件系統v2.0 (Event System v2.0)**：階層式命名 `DOMAIN.PLATFORM.ACTION.STATE` 格式
- **跨平台協調 (Cross-Platform Coordination)**：統一事件協調和資料同步機制
- **向後相容 (Backward Compatibility)**：100%支援既有v1.0功能，自動事件格式轉換
- **安全隔離 (Security Isolation)**：平台間資料完全隔離，敏感資料加密存儲
- **智能分析 (Intelligent Analytics)**：跨平台閱讀分析和個人化推薦系統

#### **支援平台**

- 📚 **Readmoo** - 台灣繁體中文電子書
- 📖 **博客來** - 台灣最大網路書店
- 🌐 **Amazon Kindle** - 全球電子書平台
- 🇯🇵 **樂天Kobo** - 日系國際電子書平台
- 🎌 **BookWalker** - ACG特化電子書平台

## 📂 完整專案結構

```
book_overview_v1/
├── 📄 manifest.json                    # Chrome Extension Manifest V3 配置
├── 📄 package.json                     # Node.js 專案配置
├── 📄 README.md                        # 專案說明文件
├── 📄 CLAUDE.md                        # 開發規範和架構指導
├── 📄 CHANGELOG.md                     # 版本變更記錄
├── 📄 .gitignore                       # Git 忽略檔案設定
│
├── 📂 src/                              # 主要原始碼目錄
│   │
│   ├── 📂 background/                   # Background Service Worker (v0.9.1 模組化架構)
│   │   ├── 📄 background.js             # Service Worker 主入口點
│   │   ├── 📄 background-coordinator.js  # 背景服務協調器
│   │   │
│   │   ├── 📂 domains/                  # 領域驅動設計 - 9個專業領域
│   │   │   │
│   │   │   ├── 📂 system/               # 🏗️ 系統管理領域
│   │   │   │   ├── 📄 system-domain-coordinator.js
│   │   │   │   └── 📂 services/
│   │   │   │       ├── 📄 config-management-service.js
│   │   │   │       ├── 📄 diagnostic-service.js
│   │   │   │       ├── 📄 health-monitoring-service.js
│   │   │   │       ├── 📄 lifecycle-service.js
│   │   │   │       └── 📄 version-control-service.js
│   │   │   │
│   │   │   ├── 📂 page/                 # 📄 頁面管理領域
│   │   │   │   ├── 📄 page-domain-coordinator.js
│   │   │   │   └── 📂 services/
│   │   │   │       ├── 📄 content-script-coordination-service.js
│   │   │   │       ├── 📄 navigation-service.js
│   │   │   │       ├── 📄 page-detection-service.js
│   │   │   │       ├── 📄 permission-service.js
│   │   │   │       └── 📄 tab-state-service.js
│   │   │   │
│   │   │   ├── 📂 extraction/           # 📚 資料提取領域
│   │   │   │   ├── 📄 extraction-domain-coordinator.js
│   │   │   │   └── 📂 services/
│   │   │   │       ├── 📄 data-processing-service.js
│   │   │   │       ├── 📄 export-service.js
│   │   │   │       ├── 📄 state-service.js
│   │   │   │       ├── 📄 quality-control-service.js
│   │   │   │       └── 📄 validation-service.js
│   │   │   │
│   │   │   ├── 📂 messaging/            # 💬 通訊管理領域
│   │   │   │   ├── 📄 messaging-domain-coordinator.js
│   │   │   │   └── 📂 services/
│   │   │   │       ├── 📄 chrome-runtime-service.js
│   │   │   │       ├── 📄 cross-context-service.js
│   │   │   │       ├── 📄 message-routing-service.js
│   │   │   │       ├── 📄 priority-service.js
│   │   │   │       └── 📄 strategy-service.js
│   │   │   │
│   │   │   ├── 📂 platform/             # 🌐 平台管理領域 (v2.0 新增)
│   │   │   │   ├── 📄 platform-domain-coordinator.js
│   │   │   │   └── 📂 services/
│   │   │   │       ├── 📄 platform-detection-service.js
│   │   │   │       ├── 📄 platform-registry-service.js
│   │   │   │       ├── 📄 platform-switcher-service.js
│   │   │   │       └── 📄 adapter-factory-service.js
│   │   │   │
│   │   │   ├── 📂 data-management/      # 💾 資料管理領域 (v2.0 新增)
│   │   │   │   ├── 📄 data-domain-coordinator.js
│   │   │   │   └── 📂 services/
│   │   │   │       ├── 📄 data-synchronization-service.js
│   │   │   │       ├── 📄 conflict-resolution-service.js
│   │   │   │       ├── 📄 data-validation-service.js
│   │   │   │       ├── 📄 schema-migration-service.js
│   │   │   │       └── 📄 backup-recovery-service.js
│   │   │   │
│   │   │   ├── 📂 user-experience/      # 🎨 用戶體驗領域 (v2.0 新增)
│   │   │   │   ├── 📄 ux-domain-coordinator.js
│   │   │   │   └── 📂 services/
│   │   │   │       ├── 📄 theme-management-service.js
│   │   │   │       ├── 📄 preference-service.js
│   │   │   │       ├── 📄 notification-service.js
│   │   │   │       ├── 📄 personalization-service.js
│   │   │   │       └── 📄 accessibility-service.js
│   │   │   │
│   │   │   ├── 📂 analytics/            # 📊 分析統計領域 (v2.0 新增)
│   │   │   │   ├── 📄 analytics-domain-coordinator.js
│   │   │   │   └── 📂 services/
│   │   │   │       ├── 📄 reading-analytics-service.js
│   │   │   │       ├── 📄 cross-platform-stats-service.js
│   │   │   │       ├── 📄 visualization-service.js
│   │   │   │       ├── 📄 report-generation-service.js
│   │   │   │       └── 📄 trend-analysis-service.js
│   │   │   │
│   │   │   └── 📂 security/             # 🔒 安全隱私領域 (v2.0 新增)
│   │   │       ├── 📄 security-domain-coordinator.js
│   │   │       └── 📂 services/
│   │   │           ├── 📄 data-encryption-service.js
│   │   │           ├── 📄 privacy-protection-service.js
│   │   │           ├── 📄 platform-isolation-service.js
│   │   │           ├── 📄 audit-logging-service.js
│   │   │           └── 📄 permission-control-service.js
│   │
│   ├── 📂 content/                      # 內容腳本 (Content Scripts) - 多平台支援
│   │   ├── 📄 main.content.js           # 內容腳本統一入口點
│   │   ├── 📂 platform-adapters/        # 平台適配器
│   │   │   ├── 📄 base-adapter.js            # 適配器基底類別
│   │   │   ├── 📄 readmoo-adapter.js         # Readmoo 適配器
│   │   │   ├── 📄 kindle-adapter.js          # Kindle 適配器
│   │   │   ├── 📄 kobo-adapter.js            # Kobo 適配器
│   │   │   ├── 📄 bookwalker-adapter.js      # BookWalker 適配器
│   │   │   └── 📄 books-com-adapter.js       # 博客來適配器
│   │   ├── 📂 extractors/               # 資料提取器 - 平台無關化
│   │   │   ├── 📄 book-data-extractor.js     # 統一書籍資料提取器
│   │   │   ├── 📄 progress-extractor.js      # 統一進度提取器
│   │   │   ├── 📄 metadata-extractor.js      # 統一元資料提取器
│   │   │   └── 📄 multi-platform-extractor.js # 多平台協調提取器
│   │   ├── 📂 converters/               # 資料格式轉換器
│   │   │   ├── 📄 data-normalizer.js         # 資料標準化轉換器
│   │   │   ├── 📄 metadata-converter.js      # 元資料轉換器
│   │   │   └── 📄 format-mapper.js           # 格式映射轉換器
│   │   ├── 📂 detectors/                # 平台檢測器
│   │   │   ├── 📄 platform-detector.js       # 平台自動識別
│   │   │   ├── 📄 page-analyzer.js           # 頁面結構分析
│   │   │   └── 📄 content-validator.js       # 內容驗證器
│   │   └── 📂 observers/                # 頁面觀察器 - 跨平台
│   │       ├── 📄 dom-observer.js            # 統一DOM變化觀察
│   │       ├── 📄 navigation-observer.js     # 跨平台導航觀察
│   │       └── 📄 platform-state-observer.js # 平台狀態觀察
│   │
│   ├── 📂 popup/                        # 彈出視窗 (Popup) - 多平台統一界面
│   │   ├── 📄 popup.html                # 彈出介面 - 響應式設計
│   │   ├── 📄 popup.css                 # 彈出樣式 - 主題支援
│   │   ├── 📄 popup.js                  # 彈出邏輯主檔案
│   │   ├── 📂 components/               # UI元件 - 平台無關設計
│   │   │   ├── 📄 platform-selector.component.js # 平台選擇器
│   │   │   ├── 📄 status-display.component.js    # 多平台狀態顯示
│   │   │   ├── 📄 action-button.component.js     # 統一操作按鈕
│   │   │   ├── 📄 progress-bar.component.js      # 跨平台進度條
│   │   │   ├── 📄 platform-status.component.js   # 平台狀態指示器
│   │   │   └── 📄 sync-indicator.component.js    # 同步狀態指示器
│   │   ├── 📂 controllers/              # 控制器 - 業務邏輯分離
│   │   │   ├── 📄 platform-controller.js         # 平台控制邏輯
│   │   │   ├── 📄 extraction-controller.js       # 提取控制邏輯
│   │   │   └── 📄 sync-controller.js             # 同步控制邏輯
│   │   └── 📂 utils/                    # Popup 專用工具
│   │       ├── 📄 platform-utils.js             # 平台工具函數
│   │       └── 📄 ui-state-manager.js           # UI狀態管理
│   │
│   ├── 📂 overview/                     # 多平台書庫統一瀏覽系統
│   │   ├── 📄 overview.html             # 主瀏覽頁面 - 響應式多平台設計
│   │   ├── 📄 overview.css              # 統一樣式系統 - 主題和平台適配
│   │   ├── 📄 overview.js               # 瀏覽頁面主控制器
│   │   ├── 📂 components/               # 多平台UI元件系統
│   │   │   ├── 📄 multi-platform-book-grid.component.js  # 跨平台書籍網格
│   │   │   ├── 📄 unified-search-bar.component.js       # 統一搜尋系統
│   │   │   ├── 📄 platform-filter-panel.component.js    # 平台篩選面板
│   │   │   ├── 📄 advanced-export-panel.component.js    # 進階匯出功能
│   │   │   ├── 📄 cross-platform-statistics.component.js # 跨平台統計
│   │   │   ├── 📄 platform-selector.component.js        # 平台選擇器
│   │   │   ├── 📄 sync-status.component.js              # 同步狀態顯示
│   │   │   └── 📄 data-visualization.component.js       # 資料視覺化
│   │   ├── 📂 managers/                 # 資料管理層
│   │   │   ├── 📄 multi-platform-data-manager.js       # 多平台資料管理
│   │   │   ├── 📄 unified-view-controller.js           # 統一視圖控制
│   │   │   ├── 📄 cross-platform-sync-manager.js       # 跨平台同步管理
│   │   │   └── 📄 conflict-resolution-manager.js       # 衝突解決管理
│   │   ├── 📂 analytics/                # 分析統計模組
│   │   │   ├── 📄 reading-analytics.js               # 閱讀分析
│   │   │   ├── 📄 platform-comparison.js             # 平台比較分析
│   │   │   └── 📄 trend-visualization.js             # 趨勢視覺化
│   │   └── 📂 utilities/                # Overview專用工具
│   │       ├── 📄 platform-data-merger.js           # 平台資料合併
│   │       ├── 📄 search-engine.js                  # 搜尋引擎
│   │       └── 📄 export-formatter.js               # 匯出格式化器
│   │
│   ├── 📂 storage/                      # 多平台統一儲存系統
│   │   ├── 📄 multi-platform-storage-manager.js # 多平台儲存管理器
│   │   ├── 📂 adapters/                 # 儲存適配器 - 平台隔離設計
│   │   │   ├── 📄 base-storage-adapter.js     # 儲存適配器基底類別
│   │   │   ├── 📄 chrome-storage-adapter.js   # Chrome Storage API適配器
│   │   │   ├── 📄 local-storage-adapter.js    # Local Storage適配器
│   │   │   ├── 📄 indexeddb-adapter.js        # IndexedDB適配器
│   │   │   └── 📄 platform-isolated-storage.js # 平台隔離儲存
│   │   ├── 📂 handlers/                 # 儲存處理器 - 跨平台操作
│   │   │   ├── 📄 multi-platform-save-handler.js    # 多平台儲存處理
│   │   │   ├── 📄 unified-load-handler.js           # 統一載入處理
│   │   │   ├── 📄 cross-platform-sync-handler.js   # 跨平台同步處理
│   │   │   ├── 📄 conflict-resolution-handler.js   # 衝突解決處理
│   │   │   └── 📄 data-migration-handler.js        # 資料遷移處理
│   │   ├── 📂 models/                   # 統一資料模型 v2.0
│   │   │   ├── 📄 unified-book-model.js           # 統一書籍資料模型
│   │   │   ├── 📄 platform-metadata-model.js      # 平台元資料模型
│   │   │   ├── 📄 cross-platform-collection-model.js # 跨平台集合模型
│   │   │   ├── 📄 sync-conflict-model.js          # 同步衝突模型
│   │   │   └── 📄 platform-isolation-model.js     # 平台隔離模型
│   │   ├── 📂 validators/               # 資料驗證器
│   │   │   ├── 📄 schema-validator.js             # 資料格式驗證
│   │   │   ├── 📄 platform-data-validator.js      # 平台資料驗證
│   │   │   └── 📄 integrity-validator.js           # 資料完整性驗證
│   │   └── 📂 migrations/               # 資料遷移系統
│   │       ├── 📄 schema-migration-engine.js      # 資料模型遷移引擎
│   │       ├── 📄 v1-to-v2-migrator.js           # v1.0到v2.0遷移器
│   │       └── 📄 platform-data-migrator.js       # 平台資料遷移器
│   │
│   ├── 📂 core/                         # 核心系統 - 事件驅動基礎設施
│   │   ├── 📄 event-bus.js              # 事件總線 v2.0 - 階層式命名系統
│   │   ├── 📄 event-handler.js          # 事件處理器基底類別
│   │   ├── 📄 chrome-event-bridge.js    # Chrome Extension 事件橋接
│   │   ├── 📄 cross-platform-coordinator.js # 跨平台事件協調器
│   │   ├── 📄 event-routing-engine.js   # 事件路由引擎
│   │   ├── 📄 event-aggregator.js       # 事件聚合器
│   │   └── 📄 backward-compatibility.js  # 向後相容性支援
│   │
│   ├── 📂 utils/                        # 工具函數 - 多平台支援
│   │   ├── 📄 constants.js              # 常數定義 - 平台配置
│   │   ├── 📄 multi-platform-helpers.js # 多平台輔助函數
│   │   ├── 📂 platform/                 # 平台相關工具
│   │   │   ├── 📄 platform-detector.util.js    # 平台檢測工具
│   │   │   ├── 📄 adapter-factory.util.js      # 適配器工廠工具
│   │   │   └── 📄 platform-config.util.js      # 平台配置工具
│   │   ├── 📂 data/                     # 資料處理工具 - 跨平台
│   │   │   ├── 📄 multi-platform-processor.util.js # 多平台資料處理
│   │   │   ├── 📄 unified-validator.util.js        # 統一驗證工具
│   │   │   ├── 📄 cross-platform-transformer.util.js # 跨平台轉換工具
│   │   │   └── 📄 data-normalizer.util.js          # 資料標準化工具
│   │   ├── 📂 export/                   # 匯出工具 - 多格式支援
│   │   │   ├── 📄 multi-platform-csv-exporter.js  # 多平台CSV匯出
│   │   │   ├── 📄 unified-json-exporter.js         # 統一JSON匯出
│   │   │   ├── 📄 cross-platform-excel-exporter.js # 跨平台Excel匯出
│   │   │   └── 📄 analytics-report-exporter.js     # 分析報告匯出
│   │   ├── 📂 security/                 # 安全工具
│   │   │   ├── 📄 data-encryption.util.js          # 資料加密工具
│   │   │   ├── 📄 platform-isolation.util.js       # 平台隔離工具
│   │   │   └── 📄 privacy-protection.util.js       # 隱私保護工具
│   │   ├── 📂 ui/                       # UI工具 - 主題和響應式
│   │   │   ├── 📄 multi-theme-manager.util.js      # 多主題管理工具
│   │   │   ├── 📄 responsive-design.util.js        # 響應式設計工具
│   │   │   ├── 📄 platform-ui-adapter.util.js      # 平台UI適配工具
│   │   │   └── 📄 accessibility.util.js            # 無障礙工具
│   │   └── 📂 analytics/                # 分析工具
│   │       ├── 📄 reading-analytics.util.js        # 閱讀分析工具
│   │       ├── 📄 performance-monitor.util.js      # 效能監控工具
│   │       └── 📄 user-behavior-tracker.util.js    # 用戶行為追蹤工具
│   │
│   ├── 📂 performance/                  # 效能優化模組 (v0.7.0)
│   │   ├── 📄 performance-optimizer.js  # 效能優化器
│   │   ├── 📄 loading-optimizer.js      # 載入優化器
│   │   ├── 📄 performance-integration.js # 效能整合管理
│   │   └── 📄 memory-manager.js         # 記憶體管理器
│   │
│   ├── 📂 extractors/                   # 資料提取器 - 統一介面
│   │   ├── 📄 book-data-extractor.js    # 統一書籍資料提取器
│   │   ├── 📄 readmoo-adapter.js        # Readmoo 適配器 (v0.2.0)
│   │   └── 📄 extraction-validator.js   # 提取資料驗證器
│   │
│   └── 📂 assets/                       # 靜態資源 - 多主題支援
│       ├── 📂 images/                   # 圖片資源
│       │   ├── 📂 icons/                # 圖示檔案 - 平台識別
│       │   │   ├── 📄 icon-16.png            # 主應用圖示 16x16
│       │   │   ├── 📄 icon-32.png            # 主應用圖示 32x32
│       │   │   ├── 📄 icon-48.png            # 主應用圖示 48x48
│       │   │   ├── 📄 icon-128.png           # 主應用圖示 128x128
│       │   │   └── 📂 platforms/             # 平台特定圖示
│       │   │       ├── 📄 readmoo-icon.svg       # Readmoo 平台圖示
│       │   │       ├── 📄 kindle-icon.svg        # Kindle 平台圖示
│       │   │       ├── 📄 kobo-icon.svg          # Kobo 平台圖示
│       │   │       ├── 📄 bookwalker-icon.svg    # BookWalker 平台圖示
│       │   │       └── 📄 books-com-icon.svg     # 博客來平台圖示
│       │   └── 📂 ui/                   # UI圖片 - 多主題資源
│       │       ├── 📄 loading-animation.svg      # 載入動畫 SVG
│       │       ├── 📄 sync-indicator.svg         # 同步指示器
│       │       └── 📄 platform-placeholder.svg   # 平台佔位圖
│       ├── 📂 styles/                   # 樣式系統 - 主題和平台適配
│       │   ├── 📄 global-variables.css  # 全域CSS變數 - 多主題支援
│       │   ├── 📄 platform-themes.css   # 平台主題樣式
│       │   ├── 📄 responsive-design.css # 響應式設計樣式
│       │   ├── 📄 component-library.css # 元件庫樣式
│       │   ├── 📄 dark-mode.css         # 深色模式主題
│       │   └── 📄 accessibility.css     # 無障礙樣式
│       ├── 📂 scripts/                  # JavaScript資源
│       │   ├── 📄 popup-controller.js   # Popup控制器
│       │   └── 📄 overview-manager.js   # Overview管理器
│       └── 📂 fonts/                    # 字體檔案 - 多語言支援
│           ├── 📄 chinese-traditional.woff2     # 繁體中文字體
│           ├── 📄 japanese-support.woff2        # 日文支援字體
│           └── 📄 international.woff2           # 國際字體
│
├── 📂 tests/                            # 測試檔案
│   ├── 📄 jest.config.js               # Jest 測試配置
│   ├── 📄 test-setup.js                # 測試環境設定
│   ├── 📂 unit/                         # 單元測試
│   │   ├── 📂 background/               # 背景服務測試
│   │   │   ├── 📄 service-worker.test.js      # Service Worker測試
│   │   │   ├── 📄 events.test.js              # 事件系統測試
│   │   │   └── 📄 handlers.test.js            # 處理器測試
│   │   ├── 📂 content-scripts/          # 內容腳本測試
│   │   │   ├── 📄 extractors.test.js          # 提取器測試
│   │   │   └── 📄 injectors.test.js           # 注入器測試
│   │   ├── 📂 popup/                    # 彈出視窗測試
│   │   │   └── 📄 popup.test.js               # 彈出邏輯測試
│   │   ├── 📂 overview/                 # 瀏覽頁面測試
│   │   │   ├── 📄 components.test.js          # 元件測試
│   │   │   └── 📄 handlers.test.js            # 處理器測試
│   │   ├── 📂 storage/                  # 儲存模組測試
│   │   │   ├── 📄 adapters.test.js            # 適配器測試
│   │   │   └── 📄 handlers.test.js            # 處理器測試
│   │   └── 📂 utils/                    # 工具函數測試
│   │       ├── 📄 data.test.js                # 資料工具測試
│   │       ├── 📄 export.test.js              # 匯出工具測試
│   │       └── 📄 ui.test.js                  # UI工具測試
│   ├── 📂 integration/                  # 整合測試
│   │   ├── 📄 data-flow.test.js         # 資料流測試
│   │   ├── 📄 event-system.test.js      # 事件系統整合測試
│   │   └── 📄 ui-interaction.test.js    # UI互動整合測試
│   ├── 📂 e2e/                          # 端對端測試
│   │   ├── 📄 extraction.e2e.test.js    # 資料提取端對端測試
│   │   ├── 📄 overview.e2e.test.js      # 瀏覽功能端對端測試
│   │   └── 📄 export.e2e.test.js        # 匯出功能端對端測試
│   ├── 📂 fixtures/                     # 測試資料
│   │   ├── 📄 sample-books.json         # 範例書籍資料
│   │   ├── 📄 mock-dom.html             # 模擬DOM結構
│   │   └── 📄 test-config.json          # 測試配置
│   └── 📂 mocks/                        # 模擬物件
│       ├── 📄 chrome-api.mock.js        # Chrome API模擬
│       ├── 📄 dom.mock.js               # DOM模擬
│       └── 📄 storage.mock.js           # 儲存模擬
│
├── 📂 docs/                             # 文件目錄
│   ├── 📄 api.md                        # API文件
│   ├── 📄 development.md                # 開發指南
│   ├── 📄 deployment.md                 # 部署指南
│   └── 📂 architecture/                 # 架構文件
│       ├── 📄 event-system.md           # 事件系統設計
│       ├── 📄 data-flow.md              # 資料流設計
│       └── 📄 security.md               # 安全性設計
│
├── 📂 build/                            # 建置目錄 (自動產生)
│   ├── 📂 development/                  # 開發建置
│   └── 📂 production/                   # 正式建置
│
└── 📂 scripts/                          # 建置腳本
    ├── 📄 build.js                      # 建置腳本
    ├── 📄 test.js                       # 測試腳本
    └── 📄 deploy.js                     # 部署腳本
```

## 🎭 事件驅動架構 v2.0 - 多平台設計

### 命名與檔案對應補充

- 檔案命名採 `feature.type.js`（kebab-case + 角色後綴），建議「一檔一類」。
- 類別（Class）命名採 PascalCase：`readmoo-catalog.service.js` → `ReadmooCatalogService`。
- Domain 資料夾使用 kebab-case，確保「單看路徑即可理解來源與責任」；匯入禁止 `../../../`，請使用語意化根路徑。
- 範例彙編請見：`docs/claude/code-quality-examples.md`

### 1. 階層式事件命名規範 v2.0

```javascript
// v2.0 事件命名格式: [領域].[平台].[動作].[狀態]
// 支援平台標識符:
// - READMOO, KINDLE, KOBO, BOOKWALKER, BOOKS_COM (平台特定)
// - UNIFIED (跨平台統一操作)
// - MULTI (多平台協調操作)
// - GENERIC (平台無關操作)

// 單一平台事件範例
'EXTRACTION.READMOO.EXTRACT.STARTED'     // Readmoo資料提取開始
'EXTRACTION.KINDLE.EXTRACT.COMPLETED'    // Kindle資料提取完成
'DATA.BOOKS_COM.SAVE.FAILED'             // 博客來資料儲存失敗
'PLATFORM.KOBO.DETECTED'                 // Kobo平台檢測
'SECURITY.BOOKWALKER.ACCESS.GRANTED'     // BookWalker存取授權

// 跨平台統一事件範例
'EXTRACTION.UNIFIED.EXTRACT.STARTED'     // 統一提取開始
'DATA.UNIFIED.SYNC.COMPLETED'            // 統一同步完成
'PLATFORM.MULTI.SWITCH.REQUESTED'        // 多平台切換請求
'ANALYTICS.UNIFIED.REPORT.GENERATED'     // 統一分析報告生成

// 平台無關事件範例
'UX.GENERIC.THEME.CHANGED'               // 主題變更
'SECURITY.GENERIC.AUDIT.LOGGED'          // 安全審計記錄
'SYSTEM.GENERIC.HEALTH.CHECKED'          // 系統健康檢查

// 向後相容 - v1.0事件自動轉換
'EXTRACTION.COMPLETED' → 'EXTRACTION.READMOO.EXTRACT.COMPLETED'
'STORAGE.SAVE.COMPLETED' → 'DATA.READMOO.SAVE.COMPLETED'
'UI.POPUP.OPENED' → 'UX.GENERIC.OPEN.COMPLETED'
```

### 2. 多平台事件流程圖

```
使用者操作 → 平台檢測 → 事件路由引擎 → 平台適配器工廠 → 平台特定處理器
          ↓                                                            ↓
   UI狀態更新 ← 跨平台同步 ← 統一儲存 ← 安全隔離中介軟體 ← 資料標準化轉換
          ↓
   事件聚合器 → 跨平台協調器 → 衝突解決器 → 分析統計 → 個人化推薦 → 通知系統
                    ↓              ↓           ↓          ↓
              審計日誌記錄 → 權限檢查 → 資料加密 → 趨勢分析 → 智能推薦
```

### 3. 領域驅動設計 (DDD) 架構

#### **9個專業領域及職責分離**

**既有領域重構 (v1.0 → v2.0)**

1. **🏗️ System Domain** - 系統管理：多平台配置、診斷、健康監控、生命週期、版本控制
2. **📄 Page Domain** - 頁面管理：多平台內容腳本協調、跨平台導航、平台檢測、權限、標籤狀態
3. **📚 Extraction Domain** - 資料提取：多適配器協調、資料格式標準化、提取策略選擇、品質控制、驗證
4. **💬 Messaging Domain** - 通訊管理：跨平台訊息路由、多上下文通訊、優先級管理、Chrome Runtime整合

**新增專業領域 (v2.0)**  
5. **🌐 Platform Domain** - 平台管理：自動識別5個平台、適配器工廠、平台切換控制、資源管理6. **💾 Data Management Domain** - 資料管理：跨平台同步、智能衝突解決、資料驗證、模型遷移、備份恢復 7. **🎨 User Experience Domain** - 用戶體驗：多主題管理、跨平台偏好同步、智能通知、個人化服務、無障礙支援 8. **📊 Analytics Domain** - 分析統計：跨平台閱讀分析、統計視覺化、趨勢預測、個人化推薦、報告生成 9. **🔒 Security Domain** - 安全隱私：資料加密、平台隔離、隱私保護、審計日誌、權限控制

#### **三層架構設計**

```javascript
// Layer 1: 入口點 (Entry Points)
📄 background.js → 📄 background-coordinator.js

// Layer 2: 領域協調器 (Domain Coordinators)
📂 domains/*/
├── 📄 *-domain-coordinator.js  // 領域業務邏輯協調

// Layer 3: 專業服務層 (Specialized Services)
├── 📂 services/
    ├── 📄 *-service.js  // 具體業務功能實現
```

### 4. 模組間通訊協議 v2.0

**基礎通訊層**

- **Background ↔ Content Script**: Chrome Runtime API + 多平台事件路由引擎
- **Background ↔ Popup**: Chrome Extension APIs + 跨平台狀態同步
- **Background ↔ Overview**: Event Bridge + 統一資料管理層

**領域協調層**

- **領域間通訊**: 統一事件總線 + 領域邊界事件 + 依賴注入
- **跨平台協調**: 事件聚合器 + 跨平台事件協調器 + 統一資料格式
- **服務層通訊**: 協調器模式 + 服務注入 + 事件代理

**安全隔離層**

- **平台隔離**: 安全中介軟體 + 平台特定資料隔離機制
- **資料保護**: 加密服務 + 權限檢查 + 審計日誌追蹤
- **跨域安全**: 隱私保護服務 + 敏感資料匿名化

### 5. 向後相容性保證 v2.0

**事件系統相容性 100%**

- **自動事件轉換**: v1.0事件格式自動轉換為v2.0階層式命名
- **雙向事件支援**: 新版事件觸發時同時觸發對應的舊版事件
- **事件監聽器相容**: 既有事件監聽器繼續正常運作

**API接口相容性 100%**

- **方法簽名保持**: 所有既有API方法保持相同的調用方式
- **內部重新路由**: 舊方法內部自動路由到新的多平台實現
- **回傳格式一致**: 保持既有回傳資料格式和結構

**資料格式相容性 100%**

- **自動資料遷移**: v1.0資料結構自動遷移到v2.0統一格式
- **舊格式支援**: 持續支援讀取和處理v1.0格式的既有資料
- **無縫升級**: 使用者感知不到資料格式變更過程

**功能性相容性 100%**

- **既有功能保持**: 所有v1.0功能在新架構下完全正常運作
- **性能不劣化**: 確保既有功能性能不因架構升級而降低
- **零學習成本**: 使用者無需學習新的操作方式

## 🔧 開發與測試策略 v2.0

### TDD 測試層級 - 多平台覆蓋

1. **單元測試**: 每個 coordinator, service, adapter 都要有對應測試
2. **領域整合測試**: 測試領域間事件協作和資料流
3. **跨平台整合測試**: 測試多平台資料同步和衝突解決
4. **端對端測試**: 測試完整的跨平台使用者操作流程
5. **效能測試**: 多平台負載測試和記憶體使用監控

### 敏捷開發流程 - 文件先行策略

1. **文件先行 (Document First)**: 先撰寫架構設計和API接口文件
2. **測試驅動 (Test First)**: 基於文件撰寫測試案例
3. **最小實現 (Red-Green)**: 實現讓測試通過的最小程式碼
4. **重構優化 (Refactor)**: 基於架構債務零容忍原則重構
5. **文件同步 (Documentation Sync)**: 即時更新工作日誌和版本記錄

### 部署策略 - 多平台支援

#### **開發環境**

- 多平台模擬器和測試資料
- 即時重載和熱更新
- 詳細的除錯資訊和錯誤追蹤
- 跨平台相容性檢查

#### **測試環境**

- 5個平台的模擬環境
- 自動化跨平台測試套件
- 效能基準測試和記憶體監控
- 安全漏洞掃描和隱私保護驗證

#### **生產環境**

- 最小化檔案和程式碼混淆
- 即時錯誤監控和回報系統
- 效能指標收集和分析
- A/B測試和功能旗標管理

### 品質保證標準

#### **技術指標**

- ✅ 測試覆蓋率: 單元測試 100%，整合測試 95%+
- ✅ 效能基準: 5個平台同時操作延遲 < 2秒
- ✅ 記憶體使用: 比v1.0增長 < 30%
- ✅ 向後相容: 既有功能 100% 正常運作

#### **用戶體驗指標**

- ✅ 平台切換響應時間 < 1秒
- ✅ 資料同步準確率 > 99.5%
- ✅ 衝突自動解決率 > 90%
- ✅ 界面一致性和無障礙支援

#### **安全隱私指標**

- ✅ 平台資料完全隔離
- ✅ 敏感資料加密存儲
- ✅ 審計日誌完整記錄
- ✅ Chrome Web Store 安全規範 100% 合規

### v2.0 架構優勢與實現路線圖

#### **可擴展性 🚀**

- **5個主流平台支援**: Readmoo、博客來、Kindle、Kobo、BookWalker統一管理
- **模組化領域設計**: 9個專業領域，易於添加新平台和功能
- **事件系統v2.0**: 階層式命名支援複雜跨平台協調和事件聚合
- **三層架構**: 入口點→協調器→服務層確保業務邏輯和技術實現分離
- **適配器模式**: 新平台只需實現BaseAdapter接口即可整合

#### **維護性 🛠️**

- **Domain-Driven Design**: 9個領域各自負責明確業務職責，邊界清晰
- **單一責任原則**: 檔案大小控制在300-500行，功能職責單一
- **完整測試覆蓋**: 單元測試100%，整合測試95%+，TDD開發流程
- **詳細架構文件**: ADR決策記錄、工作日誌、技術文件完整
- **自動化CI/CD**: 建置驗證、品質保證、部署檢查完全自動化

#### **用戶價值 💎**

- **統一多平台管理**: 一個工具管理5個平台的電子書庫
- **智能資料同步**: 自動跨平台同步，>90%衝突自動解決
- **跨平台閱讀分析**: 統一的閱讀統計、趨勢分析、個人化推薦
- **零學習成本**: 既有功能100%保持，新功能漸進式引入
- **企業級安全**: 平台資料完全隔離，敏感資料加密存儲

#### **實現路線圖 📅**

- **Phase 1 (v2.1.0)**: Platform Domain + Data Management Domain 基礎架構
- **Phase 2 (v2.2.0)**: 博客來 + Kindle 適配器，Security Domain 資料隔離
- **Phase 3 (v2.3.0)**: User Experience Domain + Analytics Domain，Kobo + BookWalker支援
- **Phase 4 (v2.4.0)**: 完整生態，智能推薦和進階分析功能

#### **技術債務管理 🔧**

- **架構債務零容忍**: 發現架構問題立即修正，絕不妥協
- **永不放棄原則**: 複雜問題必須找到根本解法，不允許暫時處理
- **最低完成策略**: 允許權宜實作但必須`//todo:`註記後續重構方向
- **文件先行策略**: 任何重構必須先撰寫設計文件和風險評估

---

**架構版本**: v2.0.0  
**維護者**: Claude Code 架構設計團隊  
**最後更新**: 2025-08-13  
**審核週期**: 每月檢視架構演進和最佳實踐更新
