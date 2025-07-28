# 版本變更紀錄

此檔案記錄了 Readmoo 書庫數據提取器 Chrome Extension 的所有重要變更。

格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，
版本號遵循 [語意化版本控制](https://semver.org/lang/zh-TW/)。

## [未發布]

### 計劃功能

- Chrome Extension 核心架構實現
- 資料提取器模組實際實現
- Overview 頁面功能整合
- 使用者介面開發

---

## [0.0.2] - TBD

### 重大里程碑 🎉

- 100% 測試通過 (50/50)
- TDD基礎完成 (4個循環)
- 多書城架構設計

### 新增 ✨

- 多書城支援架構
- 書籍ID驗證邏輯 (域名+模式)
- 完整資料格式驗證
- 改善的儲存模擬機制

### 變更 🔄

- 檔案結構整理到 docs/
- 測試框架穩定性提升
- 書籍ID處理邏輯重構

### 技術改進 🔧

- 工作日誌管理系統
- 開發規範檔案 (.cursorrules)
- TDD循環追蹤機制

---

## [0.0.1] - 2025-07-29

### 新增 ✨

- 建立完整的專案架構設計
- 實現事件驅動的模組化結構設計
- 建立完整的 TDD 測試框架基礎設施
- 配置 Jest 測試環境與 Chrome Extension 模擬環境
- 建立資料提取器、儲存適配器、事件系統的單元測試骨架
- 提供完整的測試工具、模擬物件和測試資料
- 建立詳細的專案文件系統

### 技術架構 🏗

- **測試框架**: Jest + Chrome Extension API Mocks
- **專案結構**: 事件驅動的模組化設計
- **開發方法**: 嚴格的 TDD (Test-Driven Development)
- **文件系統**: 完整的架構設計文件

### 檔案新增 📁

- `package.json` - Node.js 專案配置與腳本
- `tests/test-setup.js` - Jest 測試環境設定
- `tests/jest.config.js` - Jest 主要配置檔案
- `tests/unit/content-scripts/extractors.test.js` - 資料提取器測試
- `tests/unit/storage/adapters.test.js` - 儲存適配器測試
- `tests/unit/background/events.test.js` - 事件系統測試
- `tests/fixtures/sample-books.json` - 測試用書籍資料
- `tests/mocks/chrome-api.mock.js` - Chrome API 模擬
- `tests/fixtures/mock-dom.html` - DOM 測試環境
- `docs/architecture/event-system.md` - 事件系統架構設計
- `docs/struct.md` - 專案結構設計文件
- `docs/todolist.md` - TDD 開發任務清單
- `docs/README.md` - 詳細專案說明文件

### 開發環境 🛠

- **Node.js**: v24.4.1
- **npm**: v11.4.2  
- **測試覆蓋率目標**: 單元測試 ≥ 90%, 整合測試 ≥ 80%, E2E ≥ 70%

### 專案狀態 📊

- **開發階段**: 基礎架構建立完成
- **TDD 狀態**: 測試骨架建立，等待紅燈-綠燈循環開始
- **下一里程碑**: Chrome Extension manifest 配置與核心功能實現

---

## 版本說明

### 版本編號規則

- **主版本號 (Major)**: 重大功能變更或不相容的 API 變更
- **次版本號 (Minor)**: 向下相容的新功能
- **修訂版本號 (Patch)**: 向下相容的問題修正

### 發布計劃

- **v1.0.0**: 完整功能的 Chrome Extension，準備上架 Chrome Web Store
- **v0.x.x**: 開發階段版本，逐步實現核心功能
- **v0.0.x**: 基礎架構與測試框架建立階段

### 變更類型標籤

- **新增** ✨ - 新功能
- **變更** 🔄 - 現有功能的變更
- **棄用** ⚠️ - 即將移除的功能
- **移除** ❌ - 已移除的功能
- **修正** 🐛 - 錯誤修正
- **安全性** 🔒 - 安全性相關修正
