# 📁 Readmoo書庫數據提取器 - 專案結構設計

## 🎯 結構設計原則

### 事件驅動架構 (Event-Driven Architecture)

專案基於Chrome Extension的事件系統設計，採用鬆耦合的模組化架構：

- **事件發布者 (Event Publishers)**：負責觸發和發送事件
- **事件監聽器 (Event Listeners)**：監聽並響應特定事件
- **事件處理器 (Event Handlers)**：執行事件相關的業務邏輯
- **資料流管理 (Data Flow Management)**：統一管理資料在不同模組間的流動

## 📂 完整專案結構

```
book_overview_v1/
├── 📄 manifest.json                    # Chrome Extension 配置檔案
├── 📄 package.json                     # Node.js 專案配置
├── 📄 README.md                        # 專案說明文件
├── 📄 struct.md                        # 專案結構設計文件
├── 📄 .gitignore                       # Git 忽略檔案設定
│
├── 📂 src/                              # 主要原始碼目錄
│   │
│   ├── 📂 background/                   # 背景服務 (Background Scripts)
│   │   ├── 📄 service-worker.js         # Service Worker 主檔案
│   │   ├── 📂 events/                   # 事件處理模組
│   │   │   ├── 📄 data-extract.event.js      # 資料提取事件
│   │   │   ├── 📄 storage.event.js           # 儲存事件
│   │   │   ├── 📄 navigation.event.js        # 導航事件
│   │   │   └── 📄 index.js                   # 事件註冊器
│   │   ├── 📂 handlers/                 # 事件處理器
│   │   │   ├── 📄 extract-data.handler.js    # 資料提取處理器
│   │   │   ├── 📄 store-data.handler.js      # 資料儲存處理器
│   │   │   └── 📄 sync-ui.handler.js         # UI同步處理器
│   │   └── 📂 listeners/                # 事件監聽器
│   │       ├── 📄 extension.listener.js      # Extension事件監聽
│   │       ├── 📄 tab.listener.js            # Tab事件監聽
│   │       └── 📄 message.listener.js        # 訊息事件監聽
│   │
│   ├── 📂 content-scripts/              # 內容腳本 (Content Scripts)
│   │   ├── 📄 main.content.js           # 內容腳本主檔案
│   │   ├── 📂 extractors/               # 資料提取器
│   │   │   ├── 📄 book-data.extractor.js     # 書籍資料提取器
│   │   │   ├── 📄 progress.extractor.js      # 進度資料提取器
│   │   │   └── 📄 metadata.extractor.js      # 元資料提取器
│   │   ├── 📂 injectors/                # 頁面注入器
│   │   │   ├── 📄 ui-overlay.injector.js     # UI覆蓋層注入器
│   │   │   └── 📄 data-bridge.injector.js    # 資料橋接注入器
│   │   └── 📂 observers/                # 頁面觀察器
│   │       ├── 📄 dom.observer.js            # DOM變化觀察器
│   │       └── 📄 navigation.observer.js     # 導航變化觀察器
│   │
│   ├── 📂 popup/                        # 彈出視窗 (Popup)
│   │   ├── 📄 popup.html                # 彈出介面
│   │   ├── 📄 popup.css                 # 彈出樣式
│   │   ├── 📄 popup.js                  # 彈出邏輯主檔案
│   │   ├── 📂 components/               # UI元件
│   │   │   ├── 📄 status-display.component.js    # 狀態顯示元件
│   │   │   ├── 📄 action-button.component.js     # 操作按鈕元件
│   │   │   └── 📄 progress-bar.component.js      # 進度條元件
│   │   ├── 📂 events/                   # 彈出視窗事件
│   │   │   ├── 📄 click.event.js             # 點擊事件
│   │   │   ├── 📄 update.event.js            # 更新事件
│   │   │   └── 📄 close.event.js             # 關閉事件
│   │   └── 📂 handlers/                 # 彈出視窗處理器
│   │       ├── 📄 extract-trigger.handler.js     # 提取觸發處理器
│   │       └── 📄 status-update.handler.js       # 狀態更新處理器
│   │
│   ├── 📂 overview/                     # 書庫瀏覽頁面
│   │   ├── 📄 overview.html             # 主瀏覽頁面
│   │   ├── 📄 overview.css              # 瀏覽頁面樣式
│   │   ├── 📄 overview.js               # 瀏覽頁面邏輯主檔案
│   │   ├── 📂 components/               # 瀏覽頁面元件
│   │   │   ├── 📄 book-grid.component.js         # 書籍網格元件
│   │   │   ├── 📄 search-bar.component.js        # 搜尋列元件
│   │   │   ├── 📄 filter-panel.component.js      # 篩選面板元件
│   │   │   ├── 📄 export-panel.component.js      # 匯出面板元件
│   │   │   └── 📄 statistics.component.js        # 統計資訊元件
│   │   ├── 📂 events/                   # 瀏覽頁面事件
│   │   │   ├── 📄 search.event.js             # 搜尋事件
│   │   │   ├── 📄 filter.event.js             # 篩選事件
│   │   │   ├── 📄 export.event.js             # 匯出事件
│   │   │   └── 📄 data-load.event.js          # 資料載入事件
│   │   ├── 📂 handlers/                 # 瀏覽頁面處理器
│   │   │   ├── 📄 search.handler.js           # 搜尋處理器
│   │   │   ├── 📄 filter.handler.js           # 篩選處理器
│   │   │   ├── 📄 export.handler.js           # 匯出處理器
│   │   │   └── 📄 render.handler.js           # 渲染處理器
│   │   └── 📂 modules/                  # 功能模組
│   │       ├── 📄 data-manager.module.js      # 資料管理模組
│   │       ├── 📄 view-controller.module.js   # 視圖控制模組
│   │       └── 📄 interaction.module.js       # 互動邏輯模組
│   │
│   ├── 📂 storage/                      # 資料儲存模組
│   │   ├── 📄 storage.manager.js        # 儲存管理器主檔案
│   │   ├── 📂 adapters/                 # 儲存適配器
│   │   │   ├── 📄 chrome-storage.adapter.js   # Chrome Storage API適配器
│   │   │   ├── 📄 local-storage.adapter.js    # Local Storage適配器
│   │   │   └── 📄 indexeddb.adapter.js        # IndexedDB適配器
│   │   ├── 📂 handlers/                 # 儲存處理器
│   │   │   ├── 📄 save.handler.js             # 儲存處理器
│   │   │   ├── 📄 load.handler.js             # 載入處理器
│   │   │   ├── 📄 delete.handler.js           # 刪除處理器
│   │   │   └── 📄 sync.handler.js             # 同步處理器
│   │   ├── 📂 events/                   # 儲存事件
│   │   │   ├── 📄 data-saved.event.js         # 資料已儲存事件
│   │   │   ├── 📄 data-loaded.event.js        # 資料已載入事件
│   │   │   └── 📄 sync-complete.event.js      # 同步完成事件
│   │   └── 📂 models/                   # 資料模型
│   │       ├── 📄 book.model.js               # 書籍資料模型
│   │       ├── 📄 collection.model.js         # 集合資料模型
│   │       └── 📄 metadata.model.js           # 元資料模型
│   │
│   ├── 📂 utils/                        # 工具函數
│   │   ├── 📄 constants.js              # 常數定義
│   │   ├── 📄 helpers.js                # 輔助函數
│   │   ├── 📂 data/                     # 資料處理工具
│   │   │   ├── 📄 processor.util.js           # 資料處理工具
│   │   │   ├── 📄 validator.util.js           # 資料驗證工具
│   │   │   └── 📄 transformer.util.js         # 資料轉換工具
│   │   ├── 📂 export/                   # 匯出工具
│   │   │   ├── 📄 csv-exporter.util.js        # CSV匯出工具
│   │   │   ├── 📄 json-exporter.util.js       # JSON匯出工具
│   │   │   └── 📄 pdf-exporter.util.js        # PDF匯出工具
│   │   ├── 📂 ui/                       # UI工具
│   │   │   ├── 📄 dom.util.js                 # DOM操作工具
│   │   │   ├── 📄 animation.util.js           # 動畫工具
│   │   │   └── 📄 responsive.util.js          # 響應式工具
│   │   └── 📂 browser/                  # 瀏覽器工具
│   │       ├── 📄 extension.util.js           # Extension工具
│   │       ├── 📄 tab.util.js                # Tab工具
│   │       └── 📄 message.util.js            # 訊息傳遞工具
│   │
│   └── 📂 assets/                       # 靜態資源
│       ├── 📂 images/                   # 圖片資源
│       │   ├── 📂 icons/                # 圖示檔案
│       │   │   ├── 📄 icon-16.png            # 16x16 圖示
│       │   │   ├── 📄 icon-32.png            # 32x32 圖示
│       │   │   ├── 📄 icon-48.png            # 48x48 圖示
│       │   │   └── 📄 icon-128.png           # 128x128 圖示
│       │   └── 📂 ui/                   # UI圖片
│       │       ├── 📄 loading.gif            # 載入動畫
│       │       └── 📄 placeholder.png        # 佔位圖片
│       ├── 📂 styles/                   # 樣式檔案
│       │   ├── 📄 global.css            # 全域樣式
│       │   ├── 📄 variables.css         # CSS變數
│       │   ├── 📄 components.css        # 元件樣式
│       │   └── 📄 themes.css            # 主題樣式
│       └── 📂 fonts/                    # 字體檔案
│           └── 📄 custom-font.woff2     # 自訂字體
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

## 🎭 事件驅動架構詳細設計

### 1. 事件命名規範

```javascript
// 事件命名格式: [模組].[動作].[狀態]
// 例如:
'data.extract.started'     // 資料提取開始
'data.extract.completed'   // 資料提取完成
'data.extract.failed'      // 資料提取失敗
'storage.save.completed'   // 儲存完成
'ui.search.triggered'      // 搜尋觸發
'popup.show.requested'     // 彈出視窗顯示請求
```

### 2. 事件流程圖

```
使用者操作 → 事件觸發 → 事件監聽器 → 事件處理器 → 業務邏輯 → 狀態更新 → UI更新
```

### 3. 模組間通訊

- **Background ↔ Content Script**: Chrome Extension Message API
- **Background ↔ Popup**: Chrome Extension Runtime API
- **Overview ↔ Storage**: Custom Event System
- **Components**: Event Delegation Pattern

### 4. 責任分離

- **Events/**: 純事件定義，不包含邏輯
- **Handlers/**: 事件處理邏輯，可重複使用
- **Listeners/**: 事件監聽註冊，系統級別
- **Components/**: UI元件，只負責渲染和使用者互動

## 🔧 開發與測試策略

### TDD 測試層級

1. **單元測試**: 每個 handler, component, util 都要有對應測試
2. **整合測試**: 測試事件系統的模組間協作
3. **端對端測試**: 測試完整的使用者操作流程

### 開發流程

1. 先寫測試 (Test First)
2. 實現最小可用功能 (Red-Green)
3. 重構優化 (Refactor)
4. 文件更新 (Documentation)

### 部署策略

- **Development**: 即時重載，詳細錯誤訊息
- **Production**: 最小化檔案，錯誤監控
- **Testing**: 模擬環境，自動化測試

這個結構設計確保了：

- ✅ 高內聚低耦合
- ✅ 易於測試和維護
- ✅ 擴展性良好
- ✅ 符合Chrome Extension最佳實踐 