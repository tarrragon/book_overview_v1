# 📚 Readmoo書庫數據提取器 Chrome Extension

一個專為Readmoo電子書平台設計的Chrome擴充功能，能夠自動提取使用者書庫資料，並提供本地化的書目管理與匯出功能。

## 🎯 專案目的

### 核心功能

- **自動數據提取**：從Readmoo書庫頁面自動提取書籍資訊（書名、封面、ID、閱讀進度等）
- **本地化瀏覽**：在extension內建的overview頁面中瀏覽個人書庫
- **資料匯出**：支援JSON、CSV格式匯出，方便資料管理與備份
- **離線存取**：提取的資料儲存在本地，無需重複載入網頁即可瀏覽

### 設計理念

- **事件驅動架構**：基於Chrome extension的事件系統設計，實現高效的資料流管理
- **使用者體驗優先**：簡潔直觀的介面，一鍵操作完成資料提取與管理
- **數據安全**：所有資料處理均在本地進行，保護使用者隱私
- **擴展性設計**：模組化架構，便於未來功能擴展

## 🏗 系統架構

### Chrome Extension 結構

```
book_overview_v1/
├── manifest.json              # Extension配置檔案
├── background/                # 背景服務
│   ├── service-worker.js      # 主要背景處理邏輯
│   └── events/                # 事件處理模組
├── content-scripts/           # 內容腳本
│   ├── extractor.js          # 數據提取腳本
│   └── injector.js           # 頁面注入腳本
├── popup/                     # 彈出視窗
│   ├── popup.html            # 彈出介面
│   ├── popup.css             # 彈出樣式
│   └── popup.js              # 彈出邏輯
├── overview/                  # 書庫瀏覽頁面
│   ├── overview.html         # 主瀏覽頁面
│   ├── assets/               # 靜態資源
│   └── modules/              # 功能模組
├── storage/                   # 數據儲存
│   └── handlers/             # 儲存處理器
├── utils/                     # 工具函數
│   ├── data-processor.js     # 資料處理工具
│   └── export-manager.js     # 匯出管理工具
└── tests/                     # 測試檔案
    ├── unit/                 # 單元測試
    ├── integration/          # 整合測試
    └── e2e/                  # 端對端測試
```

### 事件驅動流程

1. **觸發事件**：使用者在Readmoo頁面點擊extension圖示
2. **資料提取**：Content script執行extractBooksData函數
3. **資料處理**：Background service處理並儲存資料
4. **介面更新**：Popup/Overview頁面即時更新顯示
5. **使用者操作**：搜尋、篩選、匯出等互動功能

## 🔧 技術棧

### 前端技術

- **HTML5 + CSS3**：現代化的使用者介面
- **Vanilla JavaScript (ES6+)**：原生JS實現，避免外部依賴
- **Chrome Extension APIs**：深度整合Chrome瀏覽器功能

### 開發方法論

- **測試驅動開發 (TDD)**：先寫測試，後實現功能
- **事件驅動設計**：基於事件的鬆耦合架構
- **模組化開發**：單一責任原則，功能模組化

### 品質保證

- **單元測試**：使用Jest進行單元測試
- **整合測試**：驗證模組間協作
- **端對端測試**：使用Puppeteer模擬使用者操作

## 📋 資料格式

### 提取的書籍資料結構

```javascript
{
  "id": "書籍唯一識別碼",
  "title": "書籍標題",
  "cover": "封面圖片URL",
  "progress": "閱讀進度百分比",
  "type": "書籍類型（流式/版式）",
  "isNew": "是否為新書",
  "isFinished": "是否已完讀",
  "extractedAt": "提取時間戳記"
}
```

### 儲存格式

- **Local Storage**：即時存取的快取資料
- **Chrome Storage API**：持久化的使用者資料
- **匯出格式**：JSON（完整資料）、CSV（表格資料）

## 🚀 開發路線圖

### 第一階段：基礎架構建立

- [x] 專案結構設計
- [ ] Chrome Extension manifest配置
- [ ] 基礎事件系統建立
- [ ] 測試框架搭建

### 第二階段：核心功能開發

- [ ] 資料提取模組實現
- [ ] 資料儲存與管理
- [ ] Overview頁面整合
- [ ] 基礎使用者介面

### 第三階段：功能增強

- [ ] 進階搜尋與篩選
- [ ] 多格式匯出功能
- [ ] 使用者設定與偏好
- [ ] 效能最佳化

### 第四階段：品質提升

- [ ] 完整測試覆蓋
- [ ] 錯誤處理與回復
- [ ] 使用者體驗優化
- [ ] 文件完善

## 🎮 使用方式

1. **安裝Extension**：將專案載入Chrome開發者模式
2. **瀏覽Readmoo**：前往個人書庫頁面
3. **提取資料**：點擊extension圖示開始提取
4. **管理書目**：在Overview頁面瀏覽和管理
5. **匯出資料**：使用內建匯出功能備份資料

## 🛠 開發環境設定

### 必要條件

- Chrome瀏覽器 (版本88+)
- Node.js (版本14+)
- npm或yarn包管理器

### 開發指令

```bash
# 安裝依賴
npm install

# 執行測試
npm test

# 開發模式
npm run dev

# 建置發布版本
npm run build
```

## 🤝 貢獻指南

我們歡迎所有形式的貢獻！請閱讀我們的貢獻指南並遵循以下原則：

- 遵循TDD開發模式
- 保持程式碼簡潔可讀
- 撰寫完整的測試案例
- 詳細的commit訊息
- 適當的文件更新

## 📄 授權條款

本專案採用MIT授權條款，詳情請參閱LICENSE檔案。

---

**注意：本專案僅供個人學習與研究使用，請尊重Readmoo平台的使用條款。**
