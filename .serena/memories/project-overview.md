# Readmoo Book Extractor - 專案概覽

## 專案目的

一個專為 Readmoo 電子書平台設計的 Chrome 擴充功能，能夠自動提取使用者書庫資料，並提供本地化的書目管理與匯出功能。

## 技術棧

- **平台**: Chrome Extension (Manifest V3)
- **語言**: JavaScript (ES6+)
- **測試框架**: Jest + Chrome Extension API Mocks
- **程式碼檢查**: ESLint (Standard config)
- **建置工具**: Node.js scripts
- **無外部執行時依賴**: 為了安全性和效能考量

## 核心架構原則

1. **事件驅動架構**: 所有模組通過中央化事件系統通訊
2. **單一責任原則**: 每個模組、處理器和組件只有一個明確目的
3. **TDD 優先**: 所有程式碼必須先寫測試，使用 Red-Green-Refactor 循環
4. **Chrome Extension 最佳實踐**: 遵循 Manifest V3 規範

## 主要組件

- **Background Service Worker** (`src/background/`): 處理擴展生命週期和跨上下文事件
- **Content Scripts** (`src/content/`): 從 Readmoo 頁面提取資料
- **Popup 界面** (`src/popup/`): 主要使用者互動界面
- **儲存系統** (`src/storage/`): 管理資料持久化，支援多種適配器
- **事件系統** (`src/core/`): 模組通訊的中央事件總線

## 當前版本

v0.9.8 - 重構和準備階段，為 v1.0 做準備
