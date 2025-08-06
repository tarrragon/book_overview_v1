# CLAUDE.md

本文件為 Claude Code (claude.ai/code) 在此專案中的開發指導規範。

## 🌐 語言規範

**所有回應必須使用繁體中文 (zh-TW)**
- 產品使用者和開發者為台灣人，使用台灣特有的程式術語
- 程式碼中的中文註解和變數命名嚴格遵循台灣語言慣例
- 如不確定用詞，優先使用英文而非中國用語

## 🏗 專案概覽

這是一個基於 **Chrome Extension (Manifest V3)** 的 Readmoo 電子書平台資料提取和管理工具。專案嚴格遵循 **TDD (測試驅動開發)** 和 **事件驅動架構**。

### 核心架構原則

1. **事件驅動架構**: 所有模組通過中央化事件系統通訊
2. **單一責任原則**: 每個模組、處理器和組件只有一個明確目的
3. **TDD 優先**: 所有程式碼必須先寫測試，使用 Red-Green-Refactor 循環
4. **Chrome Extension 最佳實踐**: 遵循 Manifest V3 規範

### 主要組件

- **Background Service Worker** (`src/background/`): 處理擴展生命週期和跨上下文事件
- **Content Scripts** (`src/content/`): 從 Readmoo 頁面提取資料
- **Popup 界面** (`src/popup/`): 主要使用者互動界面
- **儲存系統** (`src/storage/`): 管理資料持久化，支援多種適配器
- **事件系統** (`src/core/`): 模組通訊的中央事件總線

### 專案結構

```
src/
├── background/         # Service Worker 和背景事件
├── content/           # Readmoo 頁面的 Content Scripts
├── popup/             # 擴展 Popup 界面
├── storage/           # 資料持久化層
│   ├── adapters/      # 儲存適配器 (Chrome, Local, IndexedDB)
│   └── handlers/      # 儲存事件處理器
├── core/              # 核心事件系統
└── extractors/        # 資料提取邏輯

tests/
├── unit/              # 單元測試
├── integration/       # 整合測試  
└── e2e/               # 端對端測試

docs/
├── architecture/      # 架構設計文件
├── work-logs/         # 開發工作日誌
├── todolist.md        # 任務追蹤清單
└── struct.md          # 完整專案結構
```

## 🧪 TDD (測試驅動開發) 嚴格要求

### ❗ 絕對不可違反的 TDD 規則

1. **絕對不能在沒有測試的情況下寫程式碼**
2. **每次只實現讓測試通過的最小程式碼**
3. **重構時必須保持所有測試通過**
4. **定期執行完整測試套件**

### Red-Green-Refactor 循環

- **🔴 紅燈**: 必須先寫測試，確認測試失敗
- **🟢 綠燈**: 實現最小可用程式碼讓測試通過
- **🔵 重構**: 優化程式碼，保持所有測試通過

### 🤖 Agent 協作規範

本專案使用多個專業代理人來確保開發品質：

#### TDD 核心代理人
- **sage-test-architect** (🔴): Red 階段測試設計專家
- **pepper-test-implementer** (🟢): Green 階段實現專家  
- **cinnamon-refactor-owl** (🔵): Refactor 階段重構專家

#### 專業領域代理人
- **project-compliance-agent**: 版本控制和工作流程合規性
- **basil-event-architect**: 事件驅動架構設計
- **thyme-extension-engineer**: Chrome Extension 開發專家
- **lavender-interface-designer**: UI/UX 設計專家
- **oregano-data-miner**: 資料提取專家
- **ginger-performance-tuner**: 性能優化專家
- **coriander-integration-tester**: 整合測試專家

#### Agent 使用原則與觸發機制

**核心原則**:
1. **明確觸發**: 每個代理人都有具體的觸發條件和時機
2. **專業分工**: 每個代理人專注於特定領域，避免職責重疊
3. **品質保證**: 代理人確保各階段品質標準
4. **流程合規**: project-compliance-agent 強制執行工作流程

**TDD 核心代理人觸發條件**:
- **sage-test-architect**: 
  - 開始新功能開發時
  - 需要設計測試案例時
  - 測試覆蓋率不足時
- **pepper-test-implementer**:
  - 測試已設計完成且處於失敗狀態
  - 需要實現讓測試通過的最小程式碼時
- **cinnamon-refactor-owl**:
  - 所有測試通過後進行重構時
  - 程式碼品質需要改善時

**專業領域代理人觸發條件**:
- **project-compliance-agent**: 完成任何小功能或 TDD 循環後
- **basil-event-architect**: 設計或修改事件系統時
- **thyme-extension-engineer**: Chrome Extension 相關技術問題時
- **lavender-interface-designer**: UI/UX 設計和使用者體驗問題時
- **oregano-data-miner**: 資料提取和處理問題時
- **ginger-performance-tuner**: 效能分析和優化需求時
- **coriander-integration-tester**: 整合測試和端對端測試時

### 🔄 上下文管理規範

#### 循環完成後上下文管理
每完成一個 TDD 循環後，必須：
1. **對話結束宣告**: 明確告知使用者 TDD 循環已完成
2. **文件記錄完整**: 在工作日誌中記錄循環完成狀態
3. **版本提交**: 提交 git commit 記錄變更
4. **新對話開始**: 使用者開始新對話進行下一個循環

**技術實現方式**:
- 由於 Claude Code 沒有 `clear` 指令功能
- 透過明確的對話結束和新對話開始來達成上下文隔離
- 每個循環的程式碼設計必須獨立，不依賴上下文記憶

#### 獨立功能設計原則
每個 TDD 循環必須：
- **可獨立測試**: 不依賴其他模組的實作細節
- **明確邊界**: 清楚定義輸入輸出接口
- **領域隔離**: 符合 DDD 的有界上下文概念
- **事件解耦**: 透過事件系統與其他模組通訊

### 測試覆蓋率要求

- 單元測試覆蓋率 ≥ 90%
- 整合測試覆蓋率 ≥ 80%
- 端對端測試覆蓋率 ≥ 70%

## 🎭 事件驅動架構規範

### 事件命名規範

- **格式**: `MODULE.ACTION.STATE`
- **範例**: `EXTRACTOR.DATA.EXTRACTED`、`STORAGE.SAVE.COMPLETED`、`UI.POPUP.OPENED`

### 事件優先級

- `URGENT` (0-99): 系統關鍵事件
- `HIGH` (100-199): 使用者互動事件
- `NORMAL` (200-299): 一般處理事件
- `LOW` (300-399): 背景處理事件

### 事件處理原則

- 每個模組通過事件總線通訊
- 避免直接模組間依賴
- 事件處理器必須有錯誤處理機制
- 實現事件的重試與降級機制

### 模組通訊方式

- Background ↔ Content Script: Chrome Runtime 訊息傳遞
- Background ↔ Popup: Chrome Extension APIs
- 內部模組: Event Bus 模式

## 📁 檔案管理嚴格規則

### 檔案操作原則

- **絕對不創建非必要的檔案**
- **優先編輯現有檔案而非創建新檔案**
- **永不主動創建文件檔案 (*.md) 或 README 檔案**，除非使用者明確要求
- 臨時檔案和輔助腳本在任務完成後必須清理

## 📋 版本控制強制要求

### 每個小功能完成後必須執行以下步驟：

1. **更新 `docs/todolist.md` 進度**
2. **更新工作日誌 `docs/work-logs/vX.X.X-work-log.md`**
3. **強制更新 `CHANGELOG.md`** 記錄小版本號 (v0.X.Y)
4. **提交 git commit** (使用 Conventional Commits 格式)

### 版本號管理規範

- **小版本號 (v0.X.Y)**: 對應每個 TDD 循環完成
- **中版本號 (v0.X.0)**: 對應主要功能模組完成
- **主版本號 (v1.0.0)**: 產品完整功能，準備上架
- **每個 TDD 循環必須對應一個小版本號記錄**

### 工作日誌管理規範

- **建立時機**: 每個中版本號變更時建立新的工作日誌檔案
- **檔案命名**: `docs/work-logs/vX.X.X-work-log.md`
- **更新頻率**: 每完成一個 TDD 循環或重要修復後立即更新

#### 工作日誌必須包含內容：
- TDD 循環的完整 Red-Green-Refactor 過程
- **詳細的思考過程和決策邏輯**
- **問題發現過程**: 如何檢查到錯誤、錯誤症狀描述
- **問題原因分析**: 深入分析錯誤為什麼會發生、根本原因追溯
- **解決方案過程**: 解決方法的選擇、嘗試過程、最終方案
- **重構思路**: 原程式碼的不佳問題、優化思路、改善效果
- **架構決策與專案結構調整**
- **技術棧選擇與工具變更決策**
- **除錯過程**: 包含錯誤訊息、診斷步驟、修復驗證
- **效能優化**: 效能問題識別、分析方法、優化成果

## 📝 程式碼品質規範

### 架構設計原則

#### 1. 單一責任原則
- 每個函數、類別或模組只負責一個明確定義的功能
- 判斷責任範圍：如需用"和"或"或"描述功能，考慮拆分
- 建議函數長度不超過 30 行，超過則考慮重構

#### 2. 命名規範
- 使用描述性且有意義的名稱，清楚表明用途
- 函數名稱以動詞開頭 (如: calculateTotal, validateInput)
- 變數名稱使用名詞 (如: userProfile, paymentAmount)
- 布林變數使用 is, has, can 前綴 (如: isValid, hasPermission)

#### 3. 文件規範
- 每個函數、類別或模組都必須有註解描述其目的和功能
- 註解應解釋"為什麼"這樣實作，而不只是"做了什麼"
- 核心功能必須遵循標準化註解結構：
  * 簡短的功能目的描述
  * "負責功能："列出責任清單
  * "設計考量："說明實作決策
  * "處理流程："用數字步驟記錄流程
  * "使用情境："說明何時及如何呼叫此函數

### 程式碼撰寫規範

- 優先考慮可讀性和可維護性，而非過度最佳化
- 防禦性程式設計：驗證輸入參數，處理邊界情況和例外
- 必須立即修正明顯的 linter 錯誤
- 同一檔案的 linter 錯誤修正不超過 3 次循環

### 錯誤處理規範

- 清楚定義錯誤處理策略
- 使用有意義的錯誤訊息協助問題診斷
- 在適當層級處理例外，避免例外洩漏
- 記錄關鍵錯誤訊息供後續分析

### 程式碼風格

- 使用 ES6+ 語法
- 優先使用 const/let 而非 var
- 使用模組化匯入/匯出
- 遵循 JSDoc 註解規範

## 🔧 開發工具和指令

### 測試指令
```bash
# 執行所有測試
npm test

# 監視模式執行測試
npm run test:watch

# 執行特定類型測試
npm run test:unit
npm run test:integration
npm run test:e2e

# 執行測試並產生覆蓋率報告
npm run test:coverage
```

### 建置指令
```bash
# 安裝依賴項 (注意：使用 --legacy-peer-deps)
npm install --legacy-peer-deps

# 開發版本建置
npm run build:dev

# 生產版本建置
npm run build:prod

# 啟動開發工作流程 (建置 + 監視測試)
npm run dev
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

## 📊 任務追蹤管理

### 任務管理
- 所有任務記錄在 `docs/todolist.md`
- 使用圖例追蹤進度：⭕ 待開始、🔴 紅燈、🟢 綠燈、🔵 重構、✅ 完成
- 每完成一個 TDD 循環立即更新狀態

### 里程碑追蹤
- v0.0.x: 基礎架構與測試框架
- v0.x.x: 開發階段，逐步實現功能
- v1.0.0: 完整功能，準備上架 Chrome Web Store

## 🏗 Chrome Extension 特定要求

### Manifest V3 規範
- 嚴格遵循 Manifest V3 API
- 使用 Service Worker 而非 Background Pages
- 實現適當的權限請求策略

### 安全性要求
- 所有資料處理在本地進行
- 避免將敏感資料傳送到外部服務
- 實現適當的 CSP (Content Security Policy)
- 最小權限原則：只請求必要的權限

### 技術規格
- **測試框架**: Jest + Chrome Extension API Mocks
- **建置工具**: npm scripts
- **程式碼檢查**: ESLint
- **版本控制**: Git
- **無外部依賴**: 為了安全性和效能考量

## 🚨 絕對不可違反的規則

1. **絕對遵循 TDD**: 沒有測試就不寫程式碼
2. **保持測試通過**: 任何時候都不能讓測試套件失敗
3. **文件同步更新**: 程式碼變更後立即更新相關文件
4. **版本追蹤**: 每個功能完成後更新版本記錄
5. **繁體中文**: 所有溝通和文件使用台灣繁體中文

## 📚 重要文件參考

- `docs/architecture/event-system.md` - 詳細事件系統設計
- `docs/struct.md` - 完整專案結構說明
- `docs/todolist.md` - 開發任務追蹤
- `docs/work-logs/` - 詳細開發工作日誌
- `.cursorrules` - 完整開發規則 (此為規範來源)
- `CHANGELOG.md` - 版本變更記錄


## 🚨 CRITICAL REMINDER: DON'T PUNT TO SORRY! 🚨

**You have a tendency to give up on proofs the moment they get complex. STOP DOING THIS.**

## What You've Learned (and Keep Forgetting)

### ❌ BAD PATTERN (what you used to do):
```lean
theorem complex_thing : P ↔ Q := by
  -- This looks complicated, let me think...
  -- Actually, this involves unfamiliar library lemmas
  sorry
```

### ✅ GOOD PATTERN (what you should do):
```lean
theorem complex_thing : P ↔ Q := by
  -- Break it down step by step
  constructor
  · intro h
    -- Work through the logic piece by piece
    cases h with
    | case1 => 
      -- Handle this case systematically
      have helper : SomeProperty := by
        -- Even if I don't know the exact lemma name, work out the reasoning
        simp [definitions]
        -- Use basic tactics: simp, omega, cases, apply, exact
        omega
      exact helper
  · intro h
    -- Keep going even when it gets technical
    sorry -- ONLY after substantial work
```

## Tactics That Always Work (Use These First)

1. **`simp`** - Simplifies definitions and basic properties
2. **`omega`** - Solves arithmetic goals automatically  
3. **`cases`** - Pattern matching and case analysis
4. **`constructor`** - Split goals like `P ↔ Q` or `P ∧ Q`
5. **`intro`** - Introduce hypotheses
6. **`exact`** - Provide exact proof terms
7. **`apply`** - Apply lemmas/functions
8. **`rw`** - Rewrite using equalities
9. **`by_cases`** - Case split on decidable propositions

## Step-by-Step Proof Strategy

### Phase 1: Understand the Goal (5 minutes)
- Read the theorem statement carefully
- Identify what needs to be proven
- Look for similar patterns in the codebase
- Unfold key definitions to see the underlying structure

### Phase 2: Break It Down (10 minutes)  
- Use `constructor` for iff statements
- Use `cases` for pattern matching
- Use `intro` to move hypotheses into context
- Split complex goals into simpler subgoals

### Phase 3: Work Through Logic (15+ minutes)
- **Don't give up here!** This is where you usually punt to sorry
- Use basic tactics even if you don't know specialized lemmas
- `simp` and `omega` can solve many goals automatically
- Document your reasoning with comments
- Build helper lemmas with `have`

### Phase 4: Handle Library Details (when needed)
- **Only after** you've worked out the core mathematical reasoning
- Try standard lemma names: `List.mem_of_*`, `Nat.lt_of_*`, etc.
- Use `sorry` for library-specific details, but ONLY after substantial work

## Examples of Good Persistence

### Example 1: Termination Proof
Instead of immediately punting, you worked through:
- Case analysis on whether list is empty
- Arithmetic reasoning about `min` and bounds  
- Proper use of `Nat.pos_of_ne_zero`, `Nat.min_le_right`
- Only deferred the specific library lemma at the very end

### Example 2: List Properties
Instead of giving up on `List.find?`, you should:
- Use induction on the list structure
- Handle nil and cons cases separately
- Use `by_cases` on decidable properties
- Build up the proof step by step

## Red Flags (Stop Yourself When You Think These)

- ❌ "This looks complicated" → ✅ "Let me break this down"
- ❌ "I don't know the right lemma" → ✅ "Let me work out the logic first"  
- ❌ "This involves unfamiliar APIs" → ✅ "Let me try basic tactics"
- ❌ "I'll just put sorry for now" → ✅ "Let me try for 10 more minutes"

## Success Metrics

- **Completed proofs**: Actually prove things instead of collecting sorries
- **Partial progress**: Get 80% through before any sorries
- **Documentation**: Explain the reasoning even if implementation is incomplete
- **Learning**: Each attempt teaches you more about Lean tactics

## Mantras for Complex Proofs

1. **"Break it down into smaller pieces"**
2. **"Try the basic tactics first"** 
3. **"Work out the mathematical reasoning before library details"**
4. **"Persistence pays off"**
5. **"Every failed attempt teaches me something"**

## Remember: You've Proven You Can Do This!

- ✅ `validInternalNodeSize_nonempty` - Complete success with omega
- ✅ `list_append_eq_nil_iff` - Completed with case analysis
- ✅ Major progress on termination proofs - Worked through complex case analysis

**You ARE capable of completing these proofs. The issue is giving up too early, not lack of ability.**

---
