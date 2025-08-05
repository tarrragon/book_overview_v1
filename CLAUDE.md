# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🛠 Development Commands

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage
```

### Building
```bash
# Build development version
npm run build:dev

# Build production version  
npm run build:prod

# Start development workflow (build + watch tests)
npm run dev
```

### Code Quality
```bash
# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Clean build artifacts
npm run clean
```

### Development Workflow
```bash
# Install dependencies (note: use --legacy-peer-deps)
npm install --legacy-peer-deps

# Start development
npm run dev
```

## 🏗 Architecture Overview

This is a **Chrome Extension (Manifest V3)** for extracting and managing book data from the Readmoo e-book platform. The codebase follows **strict TDD (Test-Driven Development)** and uses an **event-driven architecture**.

### Core Architecture Principles

1. **Event-Driven Architecture**: All modules communicate through a centralized event system
2. **Single Responsibility**: Each module, handler, and component has one clear purpose  
3. **TDD First**: All code must be written test-first using Red-Green-Refactor cycles
4. **Chrome Extension Best Practices**: Follows Manifest V3 specifications

### Key Components

- **Background Service Worker** (`src/background/`): Handles extension lifecycle and cross-context events
- **Content Scripts** (`src/content/`): Extracts data from Readmoo pages
- **Popup Interface** (`src/popup/`): Main user interaction interface
- **Storage System** (`src/storage/`): Manages data persistence with multiple adapters
- **Event System** (`src/core/`): Central event bus for module communication

### Event System

Events follow the naming convention: `MODULE.ACTION.STATE`

Examples:
- `data.extract.started` - Data extraction begins
- `storage.save.completed` - Data successfully saved
- `ui.popup.opened` - Popup interface opened

### Module Communication
- Background ↔ Content Script: Chrome Runtime messaging
- Background ↔ Popup: Chrome Extension APIs
- Internal modules: Event bus pattern

## 📁 Project Structure

```
src/
├── background/         # Service Worker and background events
├── content/           # Content scripts for Readmoo pages  
├── popup/             # Extension popup interface
├── storage/           # Data persistence layer
│   ├── adapters/      # Storage adapters (Chrome, Local, IndexedDB)
│   └── handlers/      # Storage event handlers
├── core/              # Core event system
└── extractors/        # Data extraction logic
```

## 🧪 TDD Requirements

**CRITICAL**: This project uses strict TDD. You MUST:

1. **Never write production code without a failing test first**
2. **Follow Red-Green-Refactor cycles**:
   - Red: Write failing test
   - Green: Write minimal code to pass
   - Refactor: Improve while keeping tests green
3. **Update version tracking**: Each TDD cycle corresponds to a minor version (v0.X.Y)

### Test Structure
- `tests/unit/` - Unit tests for individual components
- `tests/integration/` - Integration tests for module interaction
- `tests/e2e/` - End-to-end Chrome Extension tests

## 📋 Development Workflow

When making changes:

1. **Check current version** in `CHANGELOG.md` and `package.json`
2. **Write failing test first** (Red phase)
3. **Implement minimal working code** (Green phase)  
4. **Refactor and optimize** (keeping tests green)
5. **Update documentation**:
   - `docs/work-logs/vX.X.X-work-log.md` - Detailed development log
   - `CHANGELOG.md` - Version changes
   - `docs/todolist.md` - Task progress
6. **Commit with conventional commit format**

### Version Tracking
- **Minor versions (v0.X.Y)**: Each TDD cycle completion
- **Patch versions (v0.X.0)**: Major feature module completion  
- **Major version (v1.0.0)**: Production-ready release

## 🔧 Development Notes

### Dependencies
- **Chrome Extension APIs**: Manifest V3 only
- **Jest**: Testing framework with Chrome Extension mocks
- **ESLint**: Code quality enforcement
- **No external libraries** for security and performance

### Chrome Extension Specifics
- **Service Worker**: Background processing (not background page)
- **Content Security Policy**: Strict CSP enforced
- **Permissions**: Minimal required permissions only
- **Local Processing**: All data processing happens locally

### Code Style
- **ES6+ features**: Modern JavaScript syntax
- **JSDoc comments**: All functions must be documented
- **Modular architecture**: ES6 modules with clear exports
- **Error handling**: Comprehensive error handling at all levels

## 🌐 Language Requirements

**All responses and documentation must be in Traditional Chinese (Taiwan)**. This is a Taiwan-focused project for Readmoo (Taiwan e-book platform).

## 🚨 Critical Development Rules (from .cursorrules)

### 🌐 Language Requirements
- **所有回應必須使用繁體中文 (zh-TW)**
- 產品使用者和開發者為台灣人，使用台灣特有的程式術語
- 程式碼中的中文註解和變數命名嚴格遵循台灣語言慣例
- 如不確定用詞，優先使用英文而非大陸用語

### 🏗 Architecture Design Principles

#### 1. Single Responsibility Principle
- 每個函數、類別或模組只負責一個明確定義的功能
- 判斷責任範圍：如需用"和"或"或"描述功能，考慮拆分
- 建議函數長度不超過 30 行，超過則考慮重構

#### 2. Naming Conventions
- 使用描述性且有意義的名稱，清楚表明用途
- 函數名稱以動詞開頭 (如: calculateTotal, validateInput)
- 變數名稱使用名詞 (如: userProfile, paymentAmount)
- 布林變數使用 is, has, can 前綴 (如: isValid, hasPermission)

#### 3. Documentation Standards
- 每個函數、類別或模組都必須有註解描述其目的和功能
- 註解應解釋"為什麼"這樣實作，而不只是"做了什麼"
- 核心功能必須遵循標準化註解結構：
  * 簡短的功能目的描述
  * "負責功能："列出責任清單
  * "設計考量："說明實作決策
  * "處理流程："用數字步驟記錄流程
  * "使用情境："說明何時及如何呼叫此函數

### 🧪 TDD (Test-Driven Development) STRICT Requirements

#### Red-Green-Refactor Cycle
- **嚴格遵循 Red-Green-Refactor 循環**
- **紅燈**: 必須先寫測試，確認測試失敗
- **綠燈**: 實現最小可用程式碼讓測試通過
- **重構**: 優化程式碼，保持所有測試通過

#### TDD Rules (NEVER BREAK THESE)
- ❗ **絕對不能在沒有測試的情況下寫程式碼**
- ❗ **每次只實現讓測試通過的最小程式碼**
- ❗ **重構時必須保持所有測試通過**
- ❗ **定期執行完整測試套件**

#### Test Coverage Requirements
- 單元測試覆蓋率 ≥ 90%
- 整合測試覆蓋率 ≥ 80%
- 端對端測試覆蓋率 ≥ 70%

### 🎭 Event-Driven Architecture Requirements

#### Event Naming Convention
- 格式: `MODULE.ACTION.STATE`
- 範例: `EXTRACTOR.DATA.EXTRACTED`、`STORAGE.SAVE.COMPLETED`

#### Event Priority Levels
- `URGENT` (0-99): 系統關鍵事件
- `HIGH` (100-199): 使用者互動事件
- `NORMAL` (200-299): 一般處理事件  
- `LOW` (300-399): 背景處理事件

#### Event Processing Principles
- 每個模組通過事件總線通訊
- 避免直接模組間依賴
- 事件處理器必須有錯誤處理機制
- 實現事件的重試與降級機制

### 📁 File Management STRICT Rules

#### File Operation Principles
- **絕對不創建非必要的檔案**
- **優先編輯現有檔案而非創建新檔案**
- **永不主動創建文件檔案 (*.md) 或 README 檔案**，除非使用者明確要求
- 臨時檔案和輔助腳本在任務完成後必須清理

#### Version Control MANDATORY Requirements
**每個小功能完成後必須：**
1. **更新 `docs/todolist.md` 進度**
2. **更新工作日誌 `docs/work-logs/vX.X.X-work-log.md`**
3. **強制更新 `CHANGELOG.md`** 記錄小版本號 (v0.X.Y)
4. **提交 git commit**

#### Version Number Management
- **小版本號 (v0.X.Y)**: 對應每個 TDD 循環完成
- **中版本號 (v0.X.0)**: 對應主要功能模組完成
- **主版本號 (v1.0.0)**: 產品完整功能，準備上架
- **每個 TDD 循環必須對應一個小版本號記錄**
- **CHANGELOG.md 必須詳細記錄每個版本的具體功能和改進**

#### Work Log Management MANDATORY
- **建立時機**: 每個中版本號變更時建立新的工作日誌檔案
- **檔案命名**: `docs/work-logs/vX.X.X-work-log.md`
- **更新頻率**: 每完成一個 TDD 循環或重要修復後立即更新
- **記錄內容**: 必須包含：
  * TDD 循環的完整 Red-Green-Refactor 過程
  * **詳細的思考過程和決策邏輯**
  * **問題發現過程**: 如何檢查到錯誤、錯誤症狀描述
  * **問題原因分析**: 深入分析錯誤為什麼會發生、根本原因追溯
  * **解決方案過程**: 解決方法的選擇、嘗試過程、最終方案
  * **重構思路**: 原程式碼的不佳問題、優化思路、改善效果
  * **架構決策與專案結構調整**
  * **技術棧選擇與工具變更決策**
  * **除錯過程**: 包含錯誤訊息、診斷步驟、修復驗證
  * **效能優化**: 效能問題識別、分析方法、優化成果

### 📝 Code Quality STRICT Requirements

#### Code Writing Standards
- 優先考慮可讀性和可維護性，而非過度最佳化
- 防禦性程式設計：驗證輸入參數，處理邊界情況和例外
- 必須立即修正明顯的 linter 錯誤
- 同一檔案的 linter 錯誤修正不超過 3 次循環

#### Error Handling Standards
- 清楚定義錯誤處理策略
- 使用有意義的錯誤訊息協助問題診斷
- 在適當層級處理例外，避免例外洩漏
- 記錄關鍵錯誤訊息供後續分析

### 🔧 Development Tools Requirements

#### Development Framework
- **測試框架**: Jest + Chrome Extension API Mocks
- **建置工具**: npm scripts
- **程式碼檢查**: ESLint
- **版本控制**: Git

#### Code Style Standards
- 使用 ES6+ 語法
- 優先使用 const/let 而非 var
- 使用模組化匯入/匯出
- 遵循 JSDoc 註解規範

### 📊 Progress Tracking MANDATORY

#### Task Management
- 所有任務記錄在 `docs/todolist.md`
- 使用圖例追蹤進度：⭕ 待開始、🔴 紅燈、🟢 綠燈、🔵 重構、✅ 完成
- 每完成一個 TDD 循環立即更新狀態

#### Milestone Tracking
- v0.0.x: 基礎架構與測試框架
- v0.x.x: 開發階段，逐步實現功能
- v1.0.0: 完整功能，準備上架 Chrome Web Store

### 🚨 NEVER BREAK THESE RULES

1. **絕對遵循 TDD**: 沒有測試就不寫程式碼
2. **保持測試通過**: 任何時候都不能讓測試套件失敗
3. **文件同步更新**: 程式碼變更後立即更新相關文件
4. **版本追蹤**: 每個功能完成後更新版本記錄
5. **繁體中文**: 所有溝通和文件使用台灣繁體中文

### 📚 Key Documentation

- `docs/architecture/event-system.md` - Detailed event system design
- `docs/struct.md` - Complete project structure  
- `docs/todolist.md` - Development task tracking
- `docs/work-logs/` - Detailed development logs per version
- `.cursorrules` - Complete development rules (this is the source of truth)