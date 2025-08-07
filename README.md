# 📚 Readmoo 書庫數據提取器 Chrome Extension

> 專為 Readmoo 電子書平台設計的 Chrome 擴充功能，能夠自動提取使用者書庫資料，並提供本地化的書目管理與匯出功能。

[![Version](https://img.shields.io/badge/version-v0.5.33-blue.svg)](./CHANGELOG.md)
[![Tests](https://img.shields.io/badge/tests-810%20passing-green.svg)](#testing)
[![Coverage](https://img.shields.io/badge/coverage-99.7%25-green.svg)](#testing)
[![Manifest](https://img.shields.io/badge/manifest-v3-orange.svg)](./manifest.json)

## 🎯 功能特色

### 📖 核心功能
- **自動資料提取**: 一鍵提取完整書庫資訊
- **本地資料管理**: Chrome Storage 安全儲存
- **多格式匯出**: 支援 CSV 格式匯出
- **響應式界面**: 適配不同螢幕尺寸
- **即時進度追蹤**: 提取過程可視化

### 🔧 技術特點
- **Manifest V3**: 最新 Chrome Extension 標準
- **事件驅動架構**: 模組化設計，易於維護
- **完整測試覆蓋**: 99.7% 測試通過率
- **TDD 開發**: 測試驅動開發確保品質
- **TypeScript 支援**: 完整的型別定義

## 🚀 快速開始

### 先決條件
- Chrome 88+ 瀏覽器
- Node.js 16+ 和 npm
- 有效的 Readmoo 帳戶

### 安裝開發環境

```bash
# 複製專案
git clone <repository-url>
cd readmoo-book-extractor

# 安裝依賴項（使用 legacy-peer-deps 以相容性）
npm install --legacy-peer-deps

# 執行測試確認環境正常
npm test

# 建置生產版本
npm run build:prod
```

## 📋 手動測試指南

### 步驟 1: 載入 Chrome Extension

1. **開啟 Chrome 擴充功能管理頁面**
   ```
   在網址列輸入：chrome://extensions/
   ```

2. **啟用開發人員模式**
   - 點選右上角「開發人員模式」開關
   - 確保開關呈現藍色啟用狀態

3. **載入擴充功能**
   - 點選「載入解壓縮的擴充功能」
   - 選擇目錄：`build/production/`
   - 確認「Readmoo 書庫數據提取器 v0.5.33」出現在列表中

### 步驟 2: 基本功能驗證

**✅ 界面檢查清單**
- [ ] 工具列出現擴充功能圖示
- [ ] 點擊圖示能開啟 Popup 界面
- [ ] Popup 界面佈局正常，無錯位或缺失元素
- [ ] 狀態指示正確顯示

### 步驟 3: Readmoo 網站實測

1. **準備測試環境**
   ```
   前往：https://readmoo.com
   登入你的 Readmoo 帳戶
   進入「我的書櫃」或書庫頁面
   ```

2. **執行提取流程**
   - 點擊擴充功能圖示開啟 Popup
   - 確認頁面識別狀態顯示為「✓ Readmoo 書庫頁面」
   - 點擊「開始提取書籍資料」按鈕
   - 觀察進度條和狀態訊息更新

3. **驗證提取結果**
   - 等待提取完成（顯示成功訊息）
   - 點擊「查看提取結果」或「打開書庫總覽」
   - 驗證書籍資料正確性（書名、作者、封面、進度等）

### 步驟 4: 完整功能測試

**✅ 資料提取功能**
- [ ] 成功識別 Readmoo 書庫頁面
- [ ] 提取進度正常顯示 (0% → 100%)
- [ ] 成功提取所有書籍資料
- [ ] 資料包含：書名、作者、封面圖、閱讀進度、書籍狀態

**✅ 資料管理功能**
- [ ] 資料自動儲存到 Chrome Storage
- [ ] Overview 頁面正常載入儲存的資料
- [ ] 書籍網格佈局響應式正常
- [ ] 搜尋和篩選功能運作正常

**✅ 匯出功能**
- [ ] CSV 匯出按鈕可點擊
- [ ] 成功產生並下載 CSV 檔案
- [ ] CSV 內容格式正確，包含所有欄位
- [ ] 檔案名稱包含時間戳記

**✅ 錯誤處理**
- [ ] 在非 Readmoo 頁面顯示適當提示
- [ ] 未登入狀態的錯誤處理
- [ ] 網路錯誤的適當回饋
- [ ] 無書籍資料時的友善訊息

### 步驟 5: 開發者工具檢查

1. **Console 日誌檢查**
   ```
   按 F12 開啟開發者工具
   切換到 Console 標籤
   重新執行提取流程
   確認沒有錯誤或警告訊息
   ```

2. **Network 請求檢查**
   - 切換到 Network 標籤
   - 檢查是否有失敗的 HTTP 請求
   - 確認 API 調用正常

3. **Storage 資料檢查**
   ```
   在 Console 中執行：
   chrome.storage.local.get(null, console.log)
   
   確認儲存的資料結構正確
   ```

### 常見問題排除

**🔧 載入失敗**
- 確認 `manifest.json` 語法正確
- 檢查所有引用的檔案路徑存在
- 確保開發人員模式已啟用

**🔧 提取失敗**
- 確認已登入 Readmoo 帳戶
- 檢查是否在正確的書庫頁面
- 確認網路連線正常

**🔧 介面異常**
- 重新載入擴充功能
- 檢查瀏覽器 Console 錯誤訊息
- 確認 Chrome 版本符合要求

## 🛠 開發指令

```bash
# 測試相關
npm test                    # 執行所有測試
npm run test:watch          # 監視模式執行測試
npm run test:coverage       # 產生覆蓋率報告
npm run test:unit          # 只執行單元測試
npm run test:integration   # 只執行整合測試

# 建置相關
npm run build:dev          # 建置開發版本
npm run build:prod         # 建置生產版本
npm run clean              # 清理建置目錄

# 程式碼品質
npm run lint               # 執行 ESLint 檢查
npm run lint:fix           # 自動修正 ESLint 問題
```

## 📊 專案狀態

**當前版本**: v0.5.33  
**開發階段**: 🟢 生產就緒  
**測試狀態**: ✅ 810/810 測試通過  
**覆蓋率**: 📈 99.7%  

### 完成度評估
- **核心功能**: ✅ 100% 完成
- **測試覆蓋**: ✅ 99.7% 覆蓋率
- **文件品質**: ✅ 完整文檔
- **Chrome Store 準備度**: ✅ 95% 就緒

## 📁 專案結構

```
readmoo-book-extractor/
├── manifest.json           # Chrome Extension 配置
├── src/                   # 原始碼
│   ├── background/        # Background Service Worker
│   ├── content/           # Content Scripts
│   ├── popup/            # Popup 界面
│   ├── overview/         # 書庫總覽頁面
│   ├── core/             # 核心事件系統
│   ├── extractors/       # 資料提取邏輯
│   ├── storage/          # 資料儲存處理
│   └── ui/               # UI 組件
├── tests/                # 測試檔案
│   ├── unit/             # 單元測試
│   ├── integration/      # 整合測試
│   └── fixtures/         # 測試資料
├── assets/               # 靜態資源
│   ├── icons/            # 擴充功能圖示
│   └── css/              # 樣式檔案
├── build/                # 建置輸出
│   └── production/       # 生產版本
└── docs/                 # 專案文件
```

## 🔧 技術架構

### 核心技術棧
- **Chrome Extension Manifest V3**: 最新標準
- **JavaScript ES6+**: 現代 JavaScript 語法
- **Event-Driven Architecture**: 模組化事件系統
- **Jest Testing Framework**: 完整測試套件
- **Chrome Storage API**: 安全本地儲存

### 設計模式
- **事件驅動**: 解耦模組間通訊
- **單一責任**: 每個模組職責明確
- **依賴注入**: 提升可測試性
- **工廠模式**: 統一物件建立
- **觀察者模式**: 事件監聽機制

## 📚 文件參考

### 核心文件
- [📋 完整專案說明](./docs/README.md)
- [🏗 架構設計文件](./docs/architecture/)
- [📝 開發工作日誌](./docs/work-logs/)
- [✅ 版本變更記錄](./CHANGELOG.md)

### 開發參考
- [🎯 開發任務清單](./docs/todolist.md)
- [🔧 API 參考文件](./docs/API.md)
- [🚀 部署指南](./docs/DEPLOYMENT.md)
- [🤝 貢獻指南](./docs/CONTRIBUTING.md)

## 🎯 下一步計劃

### 即將推出
- [ ] Chrome Web Store 正式上架
- [ ] 多格式匯出支援 (Excel, PDF)
- [ ] 進階搜尋和篩選功能
- [ ] 使用者偏好設定

### 未來規劃
- [ ] Firefox Extension 支援
- [ ] 多書城平台擴展
- [ ] 行動端支援
- [ ] 雲端同步功能

## 📄 授權條款

MIT License - 詳見 [LICENSE](./LICENSE) 檔案

## 🤝 貢獻

歡迎提交問題報告和功能請求！請參閱 [貢獻指南](./docs/CONTRIBUTING.md)。

---

**🔗 相關連結**
- [Readmoo 官方網站](https://readmoo.com)
- [Chrome Extension 開發文件](https://developer.chrome.com/docs/extensions/)
- [專案問題追蹤](./docs/todolist.md)

> 📧 如有問題或建議，請透過 GitHub Issues 聯繫我們。