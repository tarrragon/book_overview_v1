# CLAUDE.md

本文件為 Claude Code (claude.ai/code) 在此專案中的開發指導規範。

## 🚨 任何行動前的強制檢查清單

**💡 記憶口訣**: 測試先行，問題必解，架構為王，品質不妥協

### 三大不可違反的鐵律

1. **測試通過率鐵律**
   **100% 通過率是最低標準**
   - 任何測試失敗 = 立即修正，其他工作全部暫停
   - 不存在「夠好的通過率」，只有 100% 或失敗

2. **永不放棄鐵律**
   **沒有無法解決的問題**
   - 遇到複雜問題 → 設計師分析 → 分解 → 逐一解決
   - 禁用詞彙：「太複雜」「暫時」「跳過」「之後再改」

3. **架構債務零容忍鐵律**
   **架構問題 = 立即停止功能開發**
   - 發現設計缺陷 → 立即修正 → 繼續開發
   - 修復成本隨時間指數增長，立即處理是唯一選擇

### ⚡ 30秒快速檢查

- [ ] 測試通過率是否 100%？不是則立即修正
- [ ] 是否想跳過/暫緩任何問題？違反永不放棄原則
- [ ] 是否發現架構債務？立即停止功能開發優先修正

---

## 🤖 自動化 Hook 系統

本專案採用完全自動化的 Hook 系統來執行上述三大鐵律和所有開發規範。

### 🔧 Hook 系統概述

**所有品質控制、流程檢查、問題追蹤都已自動化**，無需手動執行檢查清單。

#### 自動執行的檢查項目：
- ✅ **環境檢查** - Session 啟動時自動執行
- ✅ **合規性檢查** - 每次用戶輸入時自動檢查
- ✅ **永不放棄鐵律** - 自動偵測逃避行為並**完全阻止**操作
- ✅ **程式碼品質** - 即時偵測程式異味並自動追蹤問題
- ✅ **文件同步** - 程式碼變更時自動提醒文件更新
- ✅ **效能監控** - 持續監控系統效能並優化建議
- ✅ **版本推進** - 智能分析工作狀態並建議版本推進策略
- ✅ **PM 自動觸發** - 智能檢測專案管理介入時機，自動啟動 PM 檢視

### 📋 Hook 系統參考文件

**詳細技術說明**：
- [🚀 Hook 系統方法論](./docs/claude/hook-system-methodology.md) - 完整的設計原理和執行邏輯
- [🔧 Hook 系統快速參考](./docs/claude/hook-system-reference.md) - 日常使用指南和故障排除

**關鍵特色**：
- **零容忍執行** - 發現逃避行為時完全阻止所有操作
- **智能追蹤** - 自動啟動 agents 處理問題追蹤，不中斷開發
- **即時反饋** - 問題發生時立即檢測和記錄
- **持續監控** - 全方位的品質和效能監控
- **智能 PM 觸發** - 自動檢測 5 種專案管理介入時機：
  - TDD 階段轉換完成時
  - 工作進度停滯超過 2 天時
  - 技術債務或品質問題累積時
  - Agent 升級請求時
  - 版本里程碑接近時

### 🚨 重要提醒

1. **不要嘗試繞過 Hook 系統** - 它是品質保證的核心機制
2. **理解阻止機制** - 被阻止時，專注於修正問題而非繞過檢查
3. **查看報告** - Hook 系統會生成詳細報告，幫助理解和解決問題
4. **信任自動化** - Hook 系統比手動檢查更可靠和完整

### ⚙️ Hook 系統環境要求

**關鍵配置文件**：Hook 系統依賴 `.claude/settings.local.json` 配置文件才能正常運作

#### 🔧 配置文件檢查
```bash
# 檢查配置文件是否存在
ls -la .claude/settings.local.json

# 如果檔案不存在，Hook 系統將無法執行
# 此時需要確保配置文件存在且包含正確的 Hook 配置

# 檢查 PM 觸發狀態和專案健康度
./scripts/pm-status-check.sh

# 手動執行 PM 觸發檢查
./scripts/pm-trigger-hook.sh
```

#### 🚨 常見問題排除
- **Hook 沒有執行**: 檢查 `.claude/settings.local.json` 是否存在
- **被 gitignore 忽略**: 使用 `git add -f .claude/settings.local.json` 強制加入
- **環境不一致**: 確保所有開發環境都有相同的配置文件

**重要**: 此配置文件包含專案的核心品質控制機制，必須在所有開發環境中保持一致。

---

## 📝 標準提交流程

### 🎯 自動化提交管理

**所有提交相關的檢查和文件管理都已自動化**。

#### 可用指令
- `/commit-as-prompt` - 自動化提交流程（Claude Code 內建指令）
- `./scripts/check-work-log.sh` - 工作日誌檢查（指令不可用時的替代方案）

#### 自動執行項目
- 🔍 **工作日誌檢查** - 自動識別工作狀態（更新/新建/完成）
- 📝 **版本管理** - 智能判斷版本推進策略
- 🧹 **程式碼清理** - 自動檢查和清理臨時程式碼
- 🚨 **問題追蹤** - 強制將發現的問題加入 todolist
- 📋 **文件同步** - 確保工作日誌和相關文件包含在提交中

詳細流程請參考：[📝 標準提交流程文件](./docs/claude/commit-workflow.md)

---

## 📚 分層文件管理規範

### 🏗 三層架構文件責任

本專案採用三層文件管理架構，**版本推進決策已完全自動化**：

#### 1️⃣ **工作日誌 (docs/work-logs/)** - 小版本開發追蹤
- 詳細的開發過程記錄
- TDD 四階段進度追蹤
- 技術實作過程文檔

#### 2️⃣ **todolist.md** - 中版本功能規劃
- 當前版本系列目標規劃
- 功能模組優先級排序
- 下一步開發方向指引

#### 3️⃣ **ROADMAP.md** - 大版本戰略藍圖
- 大版本里程碑定義
- 長期功能演進藍圖
- 架構演進計畫

### 🤖 自動化版本推進

**Hook 系統自動分析工作狀態並提供版本推進建議**：
- **小版本推進** (v0.10.12 → v0.10.13) - 當前工作完成，版本系列未完成
- **中版本推進** (v0.10.x → v0.11.x) - 版本系列目標全部達成
- **繼續開發** - 工作未完成，更新進度並繼續

詳細規範請參考：[📚 文件管理規範](./docs/claude/document-responsibilities.md)

---

## 🔧 開發工具和指令

### 測試指令

```bash
# 執行所有測試
npm test

# 執行特定類型測試
npm run test:unit
npm run test:integration
npm run test:e2e

# 執行測試並產生覆蓋率報告
npm run test:coverage
```

### ⚠️ 測試執行規範 (重要)

**強制要求**: 所有測試必須透過 Jest 執行，**絕不可直接使用 Node.js**

**正確方式**:
```bash
# ✅ 正確 - 透過 Jest 執行測試
npx jest tests/integration/architecture/messaging-services-integration.test.js --verbose
npm test
```

**錯誤方式**:
```bash
# ❌ 錯誤 - 直接使用 Node.js (會導致模組解析失敗)
node tests/integration/architecture/messaging-services-integration.test.js
```

### 建置指令

```bash
# 安裝依賴項
npm install --legacy-peer-deps

# 開發版本建置
npm run build:dev

# 生產版本建置
npm run build:prod
```

### 程式碼品質指令

```bash
# 執行程式碼檢查
npm run lint

# 自動修正程式碼檢查問題
npm run lint:fix

# 清理建置產物
npm run clean
```

---

## 🚨 錯誤處理規範強制要求

**專案採用標準化錯誤處理體系，ESLint 自動強制執行規範**

### 強制規範

1. **禁止字串錯誤拋出**
   ```javascript
   // ❌ 違規 - ESLint 報錯
   throw 'error message'
   throw new Error('message')

   // ✅ 正確 - 符合規範
   throw new StandardError('ERROR_CODE', 'message', details)
   ```

2. **強制使用 StandardError 體系**
   - `StandardError` - 基礎錯誤類別
   - `BookValidationError` - 書籍驗證專用錯誤
   - `OperationResult` - 統一回應格式

**檢查指令**: `npm run lint | grep "🚨"` 顯示所有違規

詳細規則說明：[📋 ESLint 錯誤處理規則](./docs/claude/eslint-error-handling-rules.md)

---

## 🎯 測試設計哲學強制原則

**核心原則**: 測試必須精確驗證我們可控制的行為，絕不依賴外部資源或假設性限制

### ✅ 正確的測試設計原則

1. **精確輸入輸出驗證** - Mock N筆資料 → 必須產生 N筆結果
2. **行為驗證優於指標驗證** - 驗證邏輯行為而非效能指標
3. **問題暴露策略** - 效能問題 → 修改程式架構，不調整測試標準
4. **可控資源原則** - 只測試我們完全控制的輸入、處理、輸出

詳細範例請參考：[🧭 程式碼品質範例彙編](./docs/claude/code-quality-examples.md)

---

## 🏗 程式碼品質規範

### 語意化命名與單一句意原則

- **函式命名**: 動詞開頭，一句話描述目的與產出
- **變數命名**: 使用名詞，表意單一且不含糊
- **類別命名**: PascalCase，格式：`<Domain><核心概念><角色/類型>`

### 檔案路徑語意規範（強制）

**採用 `src/` 開頭的語意化路徑格式**:
```javascript
// ✅ 正確 - Jest 相容的 src/ 格式
const Logger = require('src/core/logging/Logger')
const BaseModule = require('src/background/lifecycle/base-module')

// ❌ 錯誤 - 深層相對路徑
const Logger = require('../../../core/logging/Logger')
```

### 五事件評估準則

函式內直接協調「超過五個」離散事件或明確步驟時，檢查是否：
- 職責過於臃腫
- 函式名稱未準確對齊行為
- 應拆分為多個較小函式

詳細範例請參考：[🧭 程式碼品質範例彙編](./docs/claude/code-quality-examples.md)

---

## 📚 重要文件參考

### 核心規範文件
- [🤝 TDD 協作開發流程](./docs/claude/tdd-collaboration-flow.md) - 四階段開發流程
- [📚 專案文件責任明確區分](./docs/claude/document-responsibilities.md) - 文件寫作規範
- [🤖 Agent 協作規範](./docs/claude/agent-collaboration.md) - Sub-agent 使用指南

### 專案特定規範
- [📦 Chrome Extension 與專案規範](./docs/claude/chrome-extension-specs.md) - 平台特定要求
- [🎭 事件驅動架構規範](./docs/claude/event-driven-architecture.md) - 架構模式指引

### 自動化系統文件
- [🚀 Hook 系統方法論](./docs/claude/hook-system-methodology.md) - 完整技術說明
- [🔧 Hook 系統快速參考](./docs/claude/hook-system-reference.md) - 使用指南

### 品質標準文件
- [🧭 程式碼品質範例彙編](./docs/claude/code-quality-examples.md) - 具體範例
- [📋 格式化修正案例範例集](./docs/claude/format-fix-examples.md) - 標準化修正模式

---

## 語言規範

**所有回應必須使用繁體中文 (zh-TW)**

參考文件：[專案用語規範字典](./docs/claude/terminology-dictionary.md)

**核心原則**:
1. **精確性優先**: 使用具體、明確的技術術語
2. **台灣在地化**: 優先使用台灣慣用的程式術語
3. **技術導向**: 明確說明實際的技術實現方式

**重要禁用詞彙**:
- ❌ 「智能」→ ✅「自動化腳本」、「規則比對」、「條件判斷」
- ❌ 「文檔」→ ✅「文件」
- ❌ 「數據」→ ✅「資料」
- ❌ 「默認」→ ✅「預設」

---

## 📊 任務追蹤管理

### 自動化任務管理

**所有任務記錄和狀態追蹤都已自動化**：
- 🤖 **Code Smell Detection Hook** - 自動偵測程式異味並啟動 agents 更新 todolist
- 📋 **問題強制追蹤** - 發現問題時自動記錄到 `.claude/hook-logs/issues-to-track.md`
- 🔄 **狀態同步** - TodoWrite 工具自動管理任務狀態

### 任務管理檔案
- `docs/todolist.md` - 開發任務追蹤
- `docs/work-logs/` - 詳細開發工作日誌
- `CHANGELOG.md` - 版本變更記錄

### 里程碑追蹤
- v0.0.x: 基礎架構與測試框架
- v0.x.x: 開發階段，逐步實現功能
- v1.0.0: 完整功能，準備上架 Chrome Web Store

---

# important-instruction-reminders

**本專案所有品質控制、流程檢查、問題追蹤都已完全自動化。**

請信任並配合 Hook 系統的運作，專注於解決技術問題而非繞過檢查機制。Hook 系統是為了確保專案品質和開發效率的重要基礎設施。