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

## [0.1.0] - 2025-01-29 ✅

### 重大里程碑 🎉

- **完整事件系統核心實現完成**
- 107個測試全部通過 (100%)
- 3個完整TDD循環實現
- Observer模式事件驅動架構完成

### 新增 ✨

- **事件總線核心** (`src/core/event-bus.js`)
  - Observer模式事件系統
  - 優先級排序和一次性監聽器
  - 錯誤隔離和非同步處理支援
  - 統計追蹤和記憶體管理 (15個測試)

- **事件處理器基底類別** (`src/core/event-handler.js`)
  - 抽象基底類別強制子類別實現
  - 標準化事件處理生命週期
  - 統計追蹤和效能監控
  - 完整錯誤隔離機制 (20個測試)

- **Chrome Extension 事件橋接** (`src/core/chrome-event-bridge.js`)
  - 跨上下文通訊 (background ↔ content ↔ popup)
  - Promise包裝Chrome API呼叫
  - 多分頁事件分發機制
  - 錯誤容錯和資源管理 (22個測試)

### 技術架構 🏗

- **完整事件系統**: EventBus + EventHandler + ChromeEventBridge
- **測試覆蓋**: 57個事件系統測試，100%通過
- **高精度監控**: performance.now時間測量
- **多書城準備**: 可擴展的跨網站通訊基礎

### 技術改進 🔧

- Jest模組路徑映射修復 (moduleNameMapper)
- JavaScript falsy值處理優化
- 完整的JSDoc文檔標準
- v0.1.0 詳細工作日誌系統

---

## [0.0.1] - 2025-07-29

### 重大里程碑 🎉

- 100% 測試通過 (50/50)
- TDD基礎完成 (4個循環)
- 多書城架構設計

### 新增 ✨

- 完整的 TDD 測試框架基礎設施
- 多書城支援架構
- 書籍ID驗證邏輯 (域名+模式)
- 完整資料格式驗證
- Chrome Extension API 模擬機制
- 改善的儲存模擬機制

### 變更 🔄

- 檔案結構整理到 docs/
- 測試框架穩定性提升
- 書籍ID處理邏輯重構

### 技術架構 🏗

- **測試框架**: Jest + Chrome Extension API Mocks
- **專案結構**: 事件驅動的模組化設計
- **開發方法**: 嚴格的 TDD (Test-Driven Development)

### 技術改進 🔧

- 工作日誌管理系統
- 開發規範檔案 (.cursorrules)
- TDD循環追蹤機制
- Chrome Storage 配額錯誤處理
- localStorage 模擬修正
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
