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

## 🎯 5W1H 自覺決策框架

**每個開發決策必須經過 5W1H 系統化思考框架**，確保決策品質和防止重複實作：

### 🔍 5W1H 強制決策流程

**每個 todo 建立前必須回答**：
- ✅ **Who (誰)**：責任歸屬明確，檢查避免重複實作
- ✅ **What (什麼)**：功能定義清晰，符合單一職責原則
- ✅ **When (何時)**：觸發時機明確，副作用完整識別
- ✅ **Where (何地)**：執行位置正確，符合架構分層
- ✅ **Why (為什麼)**：需求依據充分，非逃避性動機
- ✅ **How (如何)**：實作策略完整，遵循TDD原則

### 🚨 5W1H 品質標準

**Who - 避免重複實作**：
- Domain已存在相同功能 → 禁止新建，必須重用
- 責任歸屬不明 → 禁止執行，必須先釐清

**What - 功能定義準則**：
- 多重職責 → 必須拆分為單一職責
- 與既有功能重疊 → 必須整合既有實作

**When - 時機確定性**：
- 觸發時機不明 → 必須釐清事件來源
- 副作用未識別 → 禁止執行

**Where - 架構正確性**：
- 位置違反Clean Architecture → 重新定位
- UseCase不明確 → 必須找出正確呼叫鏈

**Why - 需求真實性**：
- 無需求編號 → 禁止執行，必須補充需求依據
- 逃避性動機 → 立即阻止

**How - 實作完整性**：
- 非TDD驅動 → 違反流程，必須測試先行
- 包含技術債務 → 立即修正

### ⚡ 逃避行為自動識別

**5W1H階段逃避語言檢測**：
- Who: 「新建比較簡單」「直接寫在這裡」
- What: 「先實作基本功能」「複雜部分之後再說」
- When: 「需要時再觸發」「副作用不重要」
- Where: 「放在方便地方」「架構問題之後處理」
- Why: 「順便做功能」「優化程式品質」(無具體需求)
- How: 「先寫程式後補測試」「臨時解法」

**檢測到逃避語言 → 立即阻止決策**

### 📋 詳細方法論引用

**完整的5W1H決策框架請參考**：[5W1H 自覺決策方法論](./.claude/5w1h-self-awareness-methodology.md)

---

## 🤖 Hook 系統 (品質保證機制)

本專案採用 Hook 系統作為 **5W1H 決策框架的技術實施**，提供自動化品質保證。

### 🔧 Hook 系統核心定位

**Hook 系統角色**：
- **主要機制**：5W1H 決策框架強制實施
- **品質保證**：自動化檢查和驗證
- **持續監控**：全方位開發品質追蹤

#### Hook 系統執行的檢查項目

- ✅ **環境檢查** - SessionStart Hook 於啟動時執行
- ✅ **合規性檢查** - UserPromptSubmit Hook 於每次用戶輸入時檢查
- ✅ **5W1H 決策檢查** - 5W1H Compliance Hook 確保每個todo經過完整思考
- ✅ **永不放棄鐵律** - Task Avoidance Detection Hook 偵測逃避行為並**進入修復模式**
- ✅ **程式碼品質** - Code Smell Detection Hook 即時偵測程式異味並追蹤問題
- ✅ **文件同步** - PostEdit Hook 於程式碼變更時提醒文件更新
- ✅ **效能監控** - Performance Monitor Hook 持續監控系統效能
- ✅ **版本推進** - Version Check Hook 分析工作狀態並建議版本推進策略
- ✅ **PM 觸發檢查** - PM Trigger Hook 檢測專案管理介入時機並啟動 PM 檢視

### 📋 Hook 系統參考文件

**詳細技術說明**：

- [🚀 Hook 系統方法論](./.claude/hook-system-methodology.md) - 完整的設計原理和執行邏輯
- [🔧 Hook 系統快速參考](./.claude/hook-system-reference.md) - 日常使用指南和故障排除

**關鍵特色**：

- **修復模式機制** - Task Avoidance Detection Hook 發現逃避行為時進入修復模式，允許修正而非阻止操作
- **上下文分析機制** - Hook 系統區分計畫性延後和逃避性行為，支援分階段開發和 TDD 實踐
- **技術描述識別** - Hook 系統識別程式碼片段和技術文檔中的詞彙，避免誤報
- **問題追蹤機制** - Hook 系統啟動 agents 處理問題追蹤，不中斷開發
- **即時反饋** - 問題發生時立即檢測和記錄
- **持續監控** - 全方位的品質和效能監控
- **PM 觸發機制** - PM Trigger Hook 檢測 5 種專案管理介入時機：
  - TDD 階段轉換完成時
  - 工作進度停滯超過 2 天時
  - 技術債務或品質問題累積時
  - Agent 升級請求時
  - 版本里程碑接近時

### 🚨 重要提醒

1. **不要嘗試繞過 Hook 系統** - 它是品質保證的核心機制
2. **理解修復模式** - 系統檢測到問題時會進入修復模式，專注於修正問題
3. **查看報告** - Hook 系統會生成詳細報告，幫助理解和解決問題
4. **信任 Hook 系統** - Hook 系統比手動檢查更可靠和完整
5. **善用修復指引** - 修復模式提供具體步驟，完成後執行 `./.claude/scripts/fix-mode-complete.sh`

### 🔧 逃避檢測機制詳解

#### 可接受的開發模式
- ✅ **分階段開發**: 「v0.1 階段實作」、「v0.2 階段實作」
- ✅ **TDD 最小實現**: 「最小可行實作」、「重構階段優化」
- ✅ **計畫性規劃**: 「規劃於後續版本」、「列入下一個迭代」
- ✅ **技術文檔**: 程式碼片段中的技術描述（如 `eslint-disable`）

#### 不可容忍的逃避行為
- ❌ **責任逃避**: 「先將就」、「症狀緩解」、「不想處理」
- ❌ **問題忽視**: 「發現問題但不處理」、「架構問題先不管」
- ❌ **品質妥協**: 「簡化測試」、「降低測試標準」
- ❌ **技術債務**: 「只加個 TODO」、「問題太多先跳過」

### ⚙️ Hook 系統環境要求

**關鍵配置文件**：Hook 系統依賴 `.claude/settings.local.json` 配置文件才能正常運作

#### 🔧 配置文件檢查

```bash
# 檢查配置文件是否存在
ls -la .claude/settings.local.json

# 如果檔案不存在，Hook 系統將無法執行
# 此時需要確保配置文件存在且包含正確的 Hook 配置

# 檢查 PM 觸發狀態和專案健康度
./.claude/scripts/pm-status-check.sh

# 手動執行 PM 觸發檢查
./.claude/scripts/pm-trigger-hook.sh
```

#### 🚨 常見問題排除

- **Hook 沒有執行**: 檢查 `.claude/settings.local.json` 是否存在
- **被 gitignore 忽略**: 使用 `git add -f .claude/settings.local.json` 強制加入
- **環境不一致**: 確保所有開發環境都有相同的配置文件

**重要**: 此配置文件包含專案的核心品質控制機制，必須在所有開發環境中保持一致。

---

## 📝 標準提交流程

### 🎯 Hook 系統提交管理

**所有提交相關的檢查和文件管理都由 Hook 系統執行**。

#### 可用指令

- `/commit-as-prompt` - Hook 系統提交流程（Claude Code 內建指令）

#### Hook 系統執行項目

- 🔍 **工作日誌檢查** - Work Log Check Hook 識別工作狀態（更新/新建/完成）
- 📝 **版本管理** - Version Check Hook 判斷版本推進策略
- 🧹 **程式碼清理** - Code Cleanup Hook 檢查和清理臨時程式碼
- 🚨 **問題追蹤** - Issue Tracking Hook 強制將發現的問題加入 todolist
- 📋 **文件同步** - Document Sync Hook 確保工作日誌和相關文件包含在提交中

詳細流程請參考：[📝 標準提交流程文件](./.claude/commit-workflow.md)

---

## 📚 分層文件管理規範

### 🏗 三層架構文件責任

本專案採用三層文件管理架構，**版本推進決策由 Version Check Hook 執行**：

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

### 🤖 Hook 系統版本推進

**Version Check Hook 分析工作狀態並提供版本推進建議**：

- **小版本推進** (v0.10.12 → v0.10.13) - 當前工作完成，版本系列未完成
- **中版本推進** (v0.10.x → v0.11.x) - 版本系列目標全部達成
- **繼續開發** - 工作未完成，更新進度並繼續

詳細規範請參考：[📚 文件管理規範](./.claude/document-responsibilities.md)

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

**所有錯誤修復和重構必須遵循**：[🔧 錯誤修復和重構方法論](./.claude/error-fix-refactor-methodology.md)

### 強制規範

1. **禁止字串錯誤拋出**
   ```javascript
   // ❌ 違規 - ESLint 報錯
   throw 'error message'

   // ✅ 正確 - 符合規範（基本使用）
   throw new Error('User-friendly error message')

   // ✅ 最佳實踐 - 帶錯誤代碼
   import { ErrorCodes } from 'src/core/errors/ErrorCodes'
   throw new Error(`${ErrorCodes.VALIDATION_ERROR}: Email is required`)

   // ✅ 結構化錯誤（需要程式化處理時）
   const error = new Error('Email is required')
   error.code = ErrorCodes.VALIDATION_ERROR
   throw error
   ```

2. **強制使用 ErrorCodes 常數**
   - 避免魔法字串，使用 `ErrorCodes` 常數
   - 支援 17 個核心錯誤代碼
   - 零運行時開銷，編譯時常數

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

### Package 導入路徑語意化規範（強制）

**所有程式碼必須遵循「[Package 導入路徑語意化方法論](./.claude/package-import-methodology.md)」**

**核心原則**：
- **架構透明性**：導入路徑清楚表達模組架構層級和責任
- **語意化格式**：使用 `src/` 開頭格式，禁用深層相對路徑
- **禁用別名**：不允許使用過度縮寫，強制重構命名解決衝突
- **依賴來源即時識別**：從導入聲明立即理解依賴性質和架構位置

**JavaScript/Node.js 標準格式**：
```javascript
// ✅ 正確：清楚表達架構層級
const Logger = require('src/core/logging/Logger')
const BaseModule = require('src/background/lifecycle/base-module')

// ❌ 錯誤：隱藏架構關係
const Logger = require('../../../core/logging/Logger')
const BaseModule = require('../../lifecycle/base-module')
```

**強制要求**：
- 100% 使用 `src/` 格式導入，0% 深層相對路徑
- 禁用過度縮寫和模糊別名，發現重名衝突必須重構命名
- 導入路徑必須立即表達依賴來源的架構責任
- 測試環境同樣遵循語意化導入規範

### 程式碼自然語言化撰寫規範（強制）

**所有程式碼必須遵循「[程式碼自然語言化撰寫方法論](./.claude/natural-language-programming-methodology.md)」**

**核心原則**：
- **自然語言可讀性**：程式碼如同閱讀自然語言般流暢
- **五行函式單一職責**：每個函式控制在5-10行，確保單一職責
- **事件驅動語意化**：if/else 判斷必須正確分解為事件處理
- **變數職責專一化**：每個變數只承載單一類型資料，無縮寫

**語意化命名標準**：
- **函式命名**: 動詞開頭，完整描述業務行為和意圖
- **變數命名**: 完整描述內容物，無縮寫，專用於單一職責
- **類別命名**: PascalCase，格式：`<Domain><核心概念><角色/類型>`

**強制要求**：
- 函式超過10行必須拆分
- 包含多個事件邏輯必須分解為事件驅動架構
- 變數不可兼用於不同用途
- 所有命名必須在任何上下文都能理解

### 註解撰寫規範（強制）

**所有程式碼必須遵循「[程式碼註解撰寫方法論](./.claude/comment-writing-methodology.md)」**

**核心原則**：
- **程式碼自說明**：函式和變數命名必須完全可讀，不依賴註解理解
- **註解記錄需求**：註解不解釋程式做什麼，而是記錄為什麼這樣設計
- **維護指引**：提供修改約束和相依性警告，保護原始需求意圖

**強制要求**：
- 業務邏輯函式必須包含需求編號和業務描述
- 複雜邏輯必須說明約束條件和修改警告
- 所有註解必須連結回需求規格或設計文件

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
- [🔧 錯誤修復和重構方法論](./.claude/error-fix-refactor-methodology.md) - 物件導向和測試驅動的修復標準

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