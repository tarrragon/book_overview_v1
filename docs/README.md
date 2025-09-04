# 🏗️ 開發者文檔總覽

> **多書城書庫管理器** Chrome Extension 完整開發文檔  
> 提供架構設計、職責劃分、開發流程、未來規劃等內部開發資訊

---

## 📍 文檔導覽

### 📚 根目錄必要文件（全部被此 README 引用）

- **[📋 專案結構](./struct.md)** - 完整檔案結構和資料夾組織
- **[📝 開發任務](./todolist.md)** - 當前任務清單和進度追蹤
- **[🗂️ 使用情境](./use-cases.md)** - 主要使用場景與流程
- 其餘所有文件請從下方 Domain 入口進入

### 📂 Domain 入口索引

- **API**: `domains/api/` → [⚙️ API 文檔](./domains/api/API.md)
- **Deployment**: `domains/deployment/` → [🚀 部署指南](./domains/deployment/DEPLOYMENT.md)
- **Architecture**: `domains/architecture/` → 事件系統、資料流、安全性、平台域規劃
- **Guidelines**: `domains/guidelines/` → 程式碼品質、命名與路徑語意、範例彙編
- **Workflows**: `domains/workflows/` → TDD 協作、Agent 協作
- **Testing**: `domains/testing/` → 覆蓋分析、改進計畫、測試設計
- **Performance**: `domains/performance/` → 效能優化報告
- **Project**: `domains/project/` → 發展路線、核心功能、里程碑
- **Context**: `domains/context/` → 規劃輸出、模板、會議紀要
- **Refactoring**: `domains/refactoring/` → 重構範例與計畫
- **Error Handling**: `domains/error-handling/` → 使用者錯誤指南、錯誤處理架構
- **Archive**: `domains/archive/` → 歷史資料與備份
- **Analysis**: `domains/analysis/` → 分析與研究
- **Work Logs**: `work-logs/`（維持原位，不調整階層）
- **版本記錄**: `../CHANGELOG.md`

### 📋 專案管理

- **[📝 工作日誌](./work-logs/)** - 詳細開發過程和技術決策

---

## 🎯 專案目標與理念

### 項目願景

為電子書用戶提供**跨平台完整書庫管理解決方案**，讓數位閱讀更有條理、更有效率。支援多個主流書城平台，實現統一管理。

### 產品價值

1. **多平台整合** - 統一管理不同書城的書籍，消除平台隔閡
2. **資料最佳化** - 從各書城分散的頁面資訊整理為統一結構化資料
3. **隱私保護** - 全本地處理，絕不上傳雲端，完全保護用戶隱私
4. **效率提升** - 一鍵提取、快速搜尋、智能篩選，大幅提升書庫管理效率
5. **資料永久化** - 不依賴任何書城網站，隨時查看完整閱讀紀錄

## 🏠 技術架構概述

### 🔄 事件驅動設計

採用**去耦合事件架構**，核心理念：

- **Event Bus 中心化通訊** - 所有模組通過事件系統通訊
- **Publisher-Subscriber 模式** - 面向事件的鬆耦合設計
- **單一責任原則** - 每個模組只負責一個明確功能
- **依賴注入** - 提升可測試性和維護性

### 📦 模組責任劃分

| 模組                | 核心責任           | 主要事件                    |
| ------------------- | ------------------ | --------------------------- |
| **Background**      | 擴展生命周期管理   | `EXTENSION.*`, `STORAGE.*`  |
| **Content Scripts** | 多書城頁面資料提取 | `EXTRACTOR.*`, `DATA.*`     |
| **Popup**           | 使用者互動控制面板 | `UI.POPUP.*`, `USER.*`      |
| **Overview**        | 書庫管理主頁面     | `UI.OVERVIEW.*`, `SEARCH.*` |
| **Storage**         | 資料持久化管理     | `STORAGE.*`, `SYNC.*`       |
| **Export**          | 多格式資料匯出     | `EXPORT.*`, `FILE.*`        |

### 🔁 資料流管理

```
使用者觸發 → 事件發布 → 資料提取 → 資料處理 → 儲存更新 → UI 更新
     │              │             │             │             │            │
  Popup Click  → EXTRACT.START → DOM Analysis → Data Format → Chrome API → Component
```

## 📋 職責區塊劃分

### 🔴 核心功能區塊 (v1.0 已完成)

#### 資料提取層 (Content Scripts)

- **責任範圍**: 多書城 DOM 解析、書籍資料提取、進度追蹤
- **v1.0 支援**: Readmoo 平台完整實現
- **v2.0+ 規劃**: Kobo, Kindle, BookWalker, 博客來等書城擴展
- **主要檔案**: `src/extractors/`, `src/content/`
- **事件接口**: `EXTRACTOR.DATA.EXTRACTED`, `EXTRACTOR.PROGRESS.UPDATED`

#### 資料管理層 (Storage)

- **責任範圍**: Chrome Storage API 封裝、資料持久化、同步管理
- **主要檔案**: `src/storage/`, `src/handlers/`
- **事件接口**: `STORAGE.SAVE.COMPLETED`, `STORAGE.LOAD.COMPLETED`

#### 使用者介面層 (UI Components)

- **責任範圍**: Popup 控制面板、Overview 主頁面、互動組件
- **主要檔案**: `src/popup/`, `src/overview/`, `src/ui/`
- **事件接口**: `UI.POPUP.OPENED`, `UI.SEARCH.TRIGGERED`

### 🔶 支援服務區塊 (v1.0 已完成)

#### 事件系統 (Event Bus)

- **責任範圍**: 中央化事件傳遞、跨模組通訊管理
- **主要檔案**: `src/core/`, `src/events/`
- **核心 API**: `EventBus.emit()`, `EventBus.on()`, `EventBus.off()`

#### 資料轉換與匯出 (Export)

- **責任範圍**: CSV/JSON 匯出、資料格式化、檔案管理
- **主要檔案**: `src/export/`, `src/utils/export/`
- **支援格式**: CSV (已完成), JSON (已完成)

#### 日誌與錯誤處理 (Logging)

- **責任範圍**: 事件日誌、錯誤回報、性能監控
- **主要檔案**: `src/utils/logger/`, `src/error/`
- **檔案等級**: ERROR, WARN, INFO, DEBUG

### 🔵 多書城擴展區塊 (v2.0+ 核心功能)

#### 多書城支援 (Multi-Platform) - 專案核心目標

- **設計理念**: 以支援多書城為核心目標設計
- **v1.0 策略**: 先完善 Readmoo 單一平台，確保架構穩定和用戶體驗
- **擴展計劃**:
  - **v2.0**: Kobo 電子書店、BookWalker 角川書城
  - **v2.1**: Kindle 雲端閱讀器、博客來電子書城
  - **v2.2**: HyRead、Pubu 等台灣本土平台
- **技術挑戰**: 適配器模式、統一資料格式、跨平台認證、DOM 解析適配

#### 進階節能 (Advanced Features)

- **計劃範圍**: 用戶標籤系統、閱讀統計分析、書籍推薦
- **設計挑戰**: 機器學習演算法、個人化推薦、資料視覺化
- **預計時程**: v2.1 版本 (2025 Q4)

#### 跨平台擴展 (Cross-Platform)

- **計劃範圍**: Firefox Extension, Edge Extension
- **設計挑戰**: WebExtension 標準相容性、統一建置流程
- **預計時程**: v2.2 版本 (2026 Q1)

## 🛤️ 開發流程指南

### 🔄 TDD 循環紀律

本專案**嚴格遵循 TDD 開發方法論**，每個功能都必須遵循：

#### 🔴 Red 階段 - 測試設計

1. **分析需求** - 明確功能規格和期望行為
2. **設計測試案例** - 寫出導致失敗的測試
3. **定義介面** - 確定 API 和資料結構
4. **執行測試** - 確認測試失敗（紅燈）

#### 🟢 Green 階段 - 實現功能

1. **最小可行實現** - 只寫讓測試通過的程式碼
2. **通過測試** - 確認所有測試都通過
3. **基本功能驗證** - 手動測試核心功能
4. **提交程式碼** - Git commit 線上版本

#### 🔵 Refactor 階段 - 程式碼優化

1. **檢視程式碼品質** - 找出可改善的地方
2. **重構優化** - 保持測試通過下改善程式碼
3. **性能優化** - 測量和改善具體效能
4. **文件更新** - 同步更新相關文件

### 📑 程式碼品質規範

#### 命名規範

- **事件命名**: `MODULE.ACTION.STATE` 格式
- **檔案命名**: `feature.type.js` 格式 (e.g., `book-extractor.handler.js`)
- **函式命名**: 動詞開頭的駝駝式 (e.g., `extractBookData`, `handleStorageEvent`)
- **變數命名**: 名詞或算子語句 (e.g., `bookList`, `isExtracting`)

#### 類別/檔案/Domain 命名與路徑語意（擴充）

- **類別（Class）**: PascalCase，建議 `<Domain><核心概念><角色>`（如 `ReadmooCatalogService`, `OverviewPageController`）
- **檔案（File）**: `feature.type.js`（kebab-case + 角色後綴；一檔一類優先，例：`readmoo-catalog.service.js`）
- **資料夾（Domain）**: kebab-case；單看路徑能理解來源與責任；禁止 `../../../` 相對深度，使用語意化根路徑
- 範例彙編：見 `docs/guidelines/code-quality-examples.md`

#### 注釋與文件

- **檔案標頭** - 每個 JS 檔案都必須有此檔案的目的、功能、依賴關係
- **函式註釋** - 複雜函式必須說明參數、返回值、副作用
- **事件註釋** - 每個事件發布和監聽都必須說明目的和資料格式
- **TODO 標記** - 暫時權宜實現必須以 `//todo: <後續修正方向>` 註記

### 📦 版本控制流程

#### 提交訊息範例

```bash
# 功能新增
feat(extractor): add book progress extraction

# 錯誤修復
fix(storage): resolve data persistence issue

# 程式碼重構
refactor(events): improve event naming consistency

# 測試新增
test(export): add CSV export integration tests
```

#### 分支管理

- **main** - 穩定版本，隨時可以部署
- **develop** - 開發中版本，功能測試中
- **feature/\*** - 個別功能開發分支
- **hotfix/\*** - 緊急修復分支

🔍 **詳細開發規範請參考**: [CONTRIBUTING.md](./CONTRIBUTING.md)

## 🗺️ 規劃中 Roadmap 與未來展望

### 🎆 v1.0 上架成功 (2025 Q2 已完成) - Readmoo 專版

✅ **核心功能 100% 完成**

- Readmoo 書庫資料完整提取（多書城架構的第一個實現）
- Chrome Storage 本地安全儲存
- 響應式書庫管理介面
- CSV 格式資料匯出
- **為多書城擴展預留的可擴展架構**

### 🚀 v1.1 用戶體驗優化 (2025 Q3 發布)

🟡 **進階功能增強**

- [ ] 🎨 深色主題模式
- [ ] 📊 閱讀統計分析儀表板
- [ ] 🏷️ 個人標籤和書籍分類系統
- [ ] 🔍 進階搜尋篩選 (作者、年份、類型)

🟡 **可用性改善**

- [ ] 📱 行動裝置优源介面
- [ ] ⚡ 大量書籍處理性能優化
- [ ] 🔄 書庫資料自動同步功能
- [ ] 🚑 快速設定和使用教學

### 🌍 v2.0 多書城正式擴展 (2025 Q4 規劃) - 實現核心目標

🔵 **多書城支援 - 專案核心功能實現**

- [ ] 📚 Kobo 電子書店完整支援
- [ ] 🏪 BookWalker 角川書城支援
- [ ] 📖 Kindle 雲端閱讀器支援（技術挑戰較高）
- [ ] 🏢 博客來電子書城支援
- [ ] 📱 統一跨平台書庫管理介面

🔵 **跨瀏覽器支援**

- [ ] 🦊 Firefox Extension 版本
- [ ] 🌐 Edge Extension 版本
- [ ] 🔄 跨平台資料同步

### 🚀 v2.1 智能分析 (2026 Q1 未來展望)

🟣 **人工智能功能**

- [ ] 🤖 書籍推薦算法 (ML 機器學習)
- [ ] 📈 閱讀習慣深度分析
- [ ] 🎯 個人化閱讀目標設定
- [ ] 💡 閱讀效率優化建議

🟣 **社群互動功能**

- [ ] 👥 好友閱讀動態分享
- [ ] 📝 書籍評論和筆記功能
- [ ] 🏆 閱讀成就系統
- [ ] 📊 書友圈閱讀排行榜

---

### 👀 目前開發重點

**短期目標** (1-3 個月):

1. v1.0 用戶回饋優化和錯誤修復
2. v1.1 版本新功能設計和開發
3. 使用者社群經營和交流

**中期目標** (6-12 個月):

1. **多書城平台技術調研和測試** - 實現專案核心目標
2. Kobo、BookWalker 等平台 DOM 解析和資料提取方案
3. 統一資料格式和跨平台相容性架構
4. 大量用戶流量性能優化

## 🔧 技術細節與架構文件

### 🏠 核心架構文件

- **[🔄 事件系統設計](./architecture/event-system.md)** - 中央化事件總線架構
- **[📊 資料流設計](./architecture/data-extractor-design.md)** - 資料提取和處理流程
- **[🔒 安全性設計](./architecture/)** - Chrome Extension 安全性規範

### 📝 技術決策記錄

- **[📝 依賴注入債務分析](./architecture/dependency-injection-debt-analysis.md)**
- **[🔄 重構執行計劃](./architecture/refactoring-execution-plan.md)**
- **[🚀 效能優化報告](./performance-optimization-report.md)**

### 📋 開發管理文件

- **[⚙️ 開發環境設置](./DEPLOYMENT.md)** - 本地開發和 CI/CD 配置
- **[🐛 用戶錯誤指南](./USER_ERROR_GUIDE.md)** - 常見問題診斷和解決
- **[🤝 貢獻指南](./CONTRIBUTING.md)** - 外部開發者參與流程

---

📚 **更多技術細節和開發文件請瀏覽** [📁 docs/ 目錄](./)

🚀 **立即開始開發請參考** [🏠 專案結構設計](./struct.md) 和 [⚙️ API 文檔](./API.md)

---

<div align="center">

[🐛 GitHub Issues](https://github.com/your-username/readmoo-book-manager/issues) •
[💡 Feature Requests](https://github.com/your-username/readmoo-book-manager/discussions) •
[👨‍💻 貢獻指南](./CONTRIBUTING.md) •
[📚 API 文件](./API.md)

---

</div>
