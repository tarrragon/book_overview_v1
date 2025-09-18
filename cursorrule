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

## 🚀 Claude Session 啟動檢查流程

每次啟動新的 Claude Code session 時，必須執行以下標準檢查流程，確保開發環境準備就緒且狀態同步。

### 📋 強制啟動檢查清單

**使用 `/startup-check` 命令執行完整檢查，或手動依序確認：**

#### 1. Git 狀態同步檢查
- [ ] 檢查遠端分支狀態: `git fetch origin`
- [ ] 比較本地與遠端進度: `git status -uno`
- [ ] **如果遠端領先**: 執行 `git pull origin [branch]` 同步
- [ ] **如果本地領先**: 確認是否需要推送或繼續開發
- [ ] 確認工作目錄狀態: 無未提交的重要變更

#### 2. 專案文件載入確認
- [ ] 確認已載入 CLAUDE.md 主文件
- [ ] 確認已載入參考文件:
  - [ ] docs/claude/tdd-collaboration-flow.md
  - [ ] docs/claude/document-responsibilities.md
  - [ ] docs/claude/agent-collaboration.md
  - [ ] docs/claude/chrome-extension-specs.md
  - [ ] docs/claude/event-driven-architecture.md
  - [ ] docs/claude/code-quality-examples.md
- [ ] 檢查 todolist.md 當前狀態和優先級

#### 4. 開發狀態確認
- [ ] 檢查當前版本號: 查看最新工作日誌
- [ ] 確認最新 CHANGELOG.md 版本記錄
- [ ] 識別當前階段: 開發/測試/重構/發布
- [ ] 確認待處理的緊急問題或技術債務

### ⚡ 快速啟動檢查命令

**建議的啟動檢查指令**:
```bash
# 使用 Claude 命令快速檢查
/startup-check

# 或手動執行關鍵檢查
git fetch origin && git status -uno
echo "當前版本: $(ls docs/work-logs/ | grep '^v[0-9]' | sort -V | tail -1)"
```

### 🔧 常見啟動情境處理

#### 情境A: 遠端分支領先
```bash
git fetch origin
git pull origin [current-branch]  # 同步遠端變更
# 檢查是否有合併衝突，如有則先解決
```

#### 情境B: 文件載入不完整
- 確認所有參考文件都在 Claude 的 context 中
- 重新讀取缺失的關鍵指導文件
- 檢查 todolist.md 以了解當前工作重點

### 🚨 啟動檢查失敗處理

**如果啟動檢查發現問題**：
1. **立即停止開發工作**
2. **優先解決環境同步問題**
3. **確保所有檢查項目通過後才開始開發**
4. **記錄問題和解決方案以改善未來啟動流程**

**避免在不完整的環境狀態下開始開發，這會導致：**
- 版本衝突和合併問題
- 重複工作和效率損失
- 不一致的開發決策
- 技術債務累積

---

## 📝 標準提交流程

### 🎯 Commit-As-Prompt 標準流程

**所有 Git 提交必須使用 `/commit-as-prompt` 指令**，確保高品質的提交訊息和完整的變更管理。

> ⚠️ **重要**: `/commit-as-prompt` 是 Claude Code 內建指令，在繼續對話或恢復 session 時可能不可用。若指令無效，請使用 `./scripts/check-work-log.sh` + 標準 `git commit` 流程。詳見 [🚀 Claude Code 專用指令說明](#-claude-code-專用指令說明) 區段。

### 🤖 自動化工作日誌管理系統

**每次提交前強制執行工作日誌檢查**，自動化腳本會根據規則比對識別以下三種工作狀態：

#### 📊 三種工作狀態分類

1. **🔄 更新進行中的工作**
   - 當前工作項目仍在進行中
   - 在現有工作日誌中新增今日記錄
   - 保持工作的連續性和完整性

2. **🆕 開始新的工作項目**  
   - 上一個工作已經完成並有總結
   - 建立新的版本工作日誌檔案
   - 確保版本號正確 (避免錯誤的 v1.0.0 標記)

3. **✅ 完成當前工作**
   - 當前工作項目已達成目標
   - 新增完成總結和成果記錄
   - 明確標記工作完成狀態

#### 🚨 版本管理關鍵原則

**避免版本號錯誤判斷**：
- ⚠️ **禁止使用不當版本號**: 如當前處於 0.9.x 階段卻使用 v1.0.0 標記
- ✅ **版本號必須反映真實進度**: 基於 package.json 或實際開發狀態
- 📝 **完成標記規範**: 工作完成時必須有明確的總結和狀態標記
- 🔄 **連續性保證**: 確保工作記錄的時間線和狀態轉換清晰

#### 🛠 自動化管理工具使用

**主要指令**：
```bash
# 工作日誌自動化管理 (選擇合適的工作狀態)
./scripts/work-log-manager.sh

# 工作日誌檢查 (提交前自動執行)  
./scripts/check-work-log.sh

# 完整提交流程 (包含工作日誌檢查)
/commit-as-prompt
```

#### 📋 提交前必要步驟

1. **環境檢查**: 確保已執行 `/startup-check` 且所有項目通過
2. **變更分析**: 理解所有待提交的變更內容和影響
3. **程式碼清理**: 移除臨時程式碼、無用匯入、除錯語句
4. **檔案挑選**: 使用 `git add -p` 精準選擇相關變更
5. **🚨 強制問題追蹤**: 發現任何問題、疑慮、技術債務必須立即更新到 `todolist.md`

#### 🚨 強制問題追蹤規範

**核心原則**: 絕不允許問題只在工作回報中提到，必須轉化為可追蹤的任務

**觸發條件 - 以下情況必須立即更新 todolist.md**:
- 🔍 **測試執行時發現問題**: 測試失敗、設計缺陷、效能問題
- 🔍 **重構時發現疑慮**: 架構問題、程式碼異味、依賴問題
- 🔍 **開發中遇到阻礙**: 技術限制、相容性問題、工具問題
- 🔍 **程式碼審查發現**: 品質問題、安全隱憂、最佳實踐違反
- 🔍 **整合測試異常**: 跨模組問題、API 不一致、回應格式問題

**更新格式要求**:
```markdown
- 🔄 **[問題分類] 具體問題描述** - 簡要說明影響範圍和修復策略
  - 發現位置: 檔案路徑或測試名稱
  - 影響評估: Critical/High/Medium
  - 預期修復時間: 立即/下一循環/規劃中
```

**禁止行為**:
- ❌ 在工作日誌中提到問題但不加入 todolist
- ❌ 認為「小問題」不需要追蹤
- ❌ 延遲更新「等一起處理」
- ❌ 只口頭提及不做文件記錄

**強制執行**:
- 每次 `/commit-as-prompt` 前檢查是否有未追蹤問題
- TodoWrite 工具必須用於所有問題追蹤更新
- 工作日誌中提到的問題必須對應 todolist 項目

#### 🏷️ 提交類型規範

- **prompt:** - 需要轉換為 AI 上下文的功能變更
- **feat:** - 新增功能
- **fix:** - 錯誤修復  
- **docs:** - 文件更新
- **refactor:** - 重構

#### 📝 WHAT/WHY/HOW 強制格式

每個提交必須包含：
- **WHAT**: 具體動作與對象（使用祈使句）
- **WHY**: 業務需求、技術債務背景、問題根因
- **HOW**: 實作策略、相容性考量、驗證方式

#### 🚀 面板3標準作業

```bash
# 在面板3執行標準提交流程
/commit-as-prompt

# 系統將引導完成：
# 1. 變更檢查與清理
# 2. 檔案挑選與暫存  
# 3. 提交訊息撰寫（WHAT/WHY/HOW）
# 4. 推送與文件同步
```

---

## 📋 分層文件管理規範

### 🏗 三層架構文件責任劃分

#### 1️⃣ **工作日誌 (docs/work-logs/)** - 小版本開發追蹤
**檔案格式**: `v0.10.x-[feature-name].md`

**責任範圍**：
- ✅ **小版本開發需求記錄** (如 v0.10.12, v0.10.13)
- ✅ **TDD 四階段詳細進度** (Phase 1-4 完整追蹤)
- ✅ **技術實作過程文檔** (程式碼變更、問題解決)
- ✅ **完成狀態確認與成果** (✅/🔄 明確標示)
- ✅ **效益評估與品質驗證** (測試結果、效能指標)

#### 2️⃣ **todolist.md** - 中版本功能規劃
**責任範圍**：
- 🎯 **當前中版本系列目標** (如 v0.10.x 整體規劃)
- 🎯 **功能模組優先級排序** (Critical/High/Medium)
- 🎯 **下一步開發方向指引** (基於當前完成狀態)
- 🎯 **技術債務管理策略** (lint 問題、測試修復)

**內容原則**: 精簡化，移除歷史詳細進度，專注當前中版本規劃

#### 3️⃣ **ROADMAP.md** - 大版本戰略藍圖
**責任範圍**：
- 🚀 **大版本里程碑定義** (v0.x → v1.0 戰略目標)
- 🚀 **長期功能演進藍圖** (核心功能發展路徑)
- 🚀 **架構演進計畫** (技術選型與重構計畫)
- 🚀 **市場需求與技術對照** (用戶價值與實現可行性)

### 🔄 版本推進決策機制

#### **版本層級判斷邏輯**：
1. **小版本推進** (v0.10.12 → v0.10.13)：
   - 觸發條件：當前工作日誌標記 ✅ 完成
   - 自動化檢查：commit-as-prompt 執行工作日誌完成確認
   - 推進方式：自動建立下一版本工作日誌

2. **中版本推進** (v0.10.x → v0.11.x)：
   - 觸發條件：todolist.md 中版本目標全部達成
   - 確認機制：Claude Code 提示確認是否推進
   - 推進方式：更新 todolist.md 中版本規劃

3. **大版本推進** (v0.x → v1.x)：
   - 觸發條件：**僅依用戶明確指令**
   - 確認機制：用戶主動要求大版本升級
   - 推進方式：更新 ROADMAP.md 和 todolist.md

### 🤖 commit-as-prompt 整合機制

#### **提交前自動檢查流程**：

```bash
# 1. 工作日誌狀態檢查
./scripts/check-work-log.sh
# 檢查當前工作是否完成，標記完成狀態

# 2. 下一步目標確認  
./scripts/check-next-objectives.sh
# 從 todolist.md 讀取下一步開發方向

# 3. 版本推進判斷
./scripts/version-progression-check.sh
# 判斷是否需要版本推進，提供建議
```

#### **工作流程整合**：
- **每次提交**: 自動更新當前工作日誌進度
- **功能完成**: 標記工作日誌 ✅，從 todolist 確認下一步
- **中版本完成**: 提示檢查 todolist 是否需要更新中版本目標
- **大版本**: 等待用戶指令，不自動推進

### 📊 文件同步更新原則

#### **優先級與更新頻率**：
1. **工作日誌**: 每日更新，實時記錄開發進度
2. **todolist.md**: 每個小版本完成後檢查更新
3. **ROADMAP.md**: 每個中版本完成後檢查更新
4. **CHANGELOG.md**: 每次 commit-as-prompt 自動更新

#### **一致性維護**：
- 版本號必須跨文件一致 (package.json 為準)
- 完成狀態標記統一格式 (✅/🔄/❌)
- 功能描述用語遵循專案規範字典

---

### 📚 核心規範快速導覽

**日常開發必讀**：
[- 🤝 TDD 協作開發流程](./docs/claude/tdd-collaboration-flow.md) - 四階段開發流程
[- 📚 專案文件責任明確區分](./docs/claude/document-responsibilities.md) - 文件寫作規範
[- 🤖 Agent 協作規範](./docs/claude/agent-collaboration.md) - Sub-agent 使用指南

**專案特定規範**：
[- 📦 Chrome Extension 與專案規範](./docs/claude/chrome-extension-specs.md) - 平台特定要求
[- 🎭 事件驅動架構規範](./docs/claude/event-driven-architecture.md) - 架構模式指引

**格式化與品質修正**：
[- 📋 格式化修正案例範例集](./docs/claude/format-fix-examples.md) - 標準化修正模式與最佳實踐
[- 🤖 Mint Format Specialist](./docs/claude/mint-format-specialist.md) - 專業格式化 sub-agent

### 🔍 詳細執行指導

[- 🚨 違規警報與預防](./docs/claude/violation-prevention.md)
[- 📋 關鍵情境決策流程](./docs/claude/decision-workflows.md)
[- 🔍 自我監控與糾錯機制](./docs/claude/self-monitoring.md)
[- 🧭 程式碼品質範例彙編](./docs/claude/code-quality-examples.md)

---

## 🚀 Claude Code 專用指令說明

### 🚨 指令可用性重要說明

**Claude Code 內建指令僅在特定情況下可用**：

- ✅ **新的 Claude Code session**: 指令完全可用
- ⚠️ **繼續先前對話**: 指令可能不可用或功能受限  
- ⚠️ **恢復中斷的 session**: 指令狀態不確定

**遇到指令不可用時的處理原則**：
1. **不要在檔案系統中尋找這些指令** - 它們是 Claude Code 內建功能，不是腳本檔案
2. **直接使用對應的替代方案** - 每個指令下方都列出了手動執行的方法
3. **避免浪費時間** - 立即轉換到腳本或手動流程

---

### `/startup-check` - 環境檢查指令

**功能**: 執行完整的開發環境檢查和初始化

**檢查項目**:
1. **Git 狀態同步**: 檢查本地與遠端分支狀態
2. **專案檔案載入**: 確認關鍵檔案存在且 Claude Code 已正確載入
3. **開發狀態確認**: 檢查版本、測試狀態、程式碼品質

**使用時機**:
- 每次啟動新的 Claude Code session
- 切換專案或分支後
- 環境配置出現問題時

**⚠️ 指令不可用時的替代方案**:
```bash
# 手動執行啟動檢查
git fetch origin && git status -uno
```

### `/smart-version-check` - 版本推進檢查指令

**功能**: 檢查工作狀態並自動決定版本推進策略

**決策邏輯**:

1. **小版本推進**: 當前工作完成，版本系列未完成 → 推進 patch (0.12.0 → 0.12.1)
2. **中版本推進**: 版本系列目標完成 → 推進 minor (0.12.x → 0.13.0)  
3. **繼續開發**: 工作未完成 → 更新進度並繼續當前開發

**自動執行動作**:

- 更新 package.json 版本號
- 建立新工作日誌檔案
- 重新排序 todolist.md 任務優先級
- 提供明確的下一步建議

**使用時機**:

- 完成一個功能或修復後
- 需要確認是否應該推進版本時
- 不確定當前開發狀態和下一步動作時

### `/commit-as-prompt` - 自動化提交指令

**功能**: 執行完整的自動化提交流程，包含工作日誌管理

**執行步驟**:
0. **自動化工作日誌檢查**: 腳本規則比對判斷工作狀態並管理日誌
1. **變更分析**: 檢查工作區和暫存區狀態
2. **程式碼清理**: 移除臨時程式碼和無用內容  
3. **檔案挑選**: 使用 `git add -p` 精準選擇變更
4. **提交資訊**: 遵循 WHAT/WHY/HOW 格式
5. **推送同步**: 確保工作日誌和相關文件已包含

**自動化工作日誌功能**:
- 自動檢測版本號正確性
- 規則比對識別三種工作狀態 (更新/新建/完成)
- 提供互動式工作日誌管理
- 防止版本錯誤判斷 (如錯誤的 v1.0.0 標記)

**⚠️ 指令不可用時的替代方案**:
```bash
# 手動執行標準提交流程
./scripts/check-work-log.sh        # 1. 工作日誌檢查
git add <files>                    # 2. 暫存變更
git commit -m "$(cat <<'EOF'       # 3. 提交 (WHAT/WHY/HOW格式)
<type>(<scope>): <description>

## WHAT
具體動作與對象

## WHY  
業務需求、技術債務背景、問題根因

## HOW
實作策略、相容性考量、驗證方式

🤖 Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### `./scripts/work-log-manager.sh` - 工作日誌管理腳本

**功能**: 互動式工作日誌管理系統

**三種狀態選擇**:
1. **📝 更新進行中的工作**: 在現有日誌中新增今日記錄  
2. **🆕 開始新的工作項目**: 建立新版本的工作日誌檔案
3. **✅ 完成當前工作**: 新增工作完成總結和狀態標記

**版本管理特色**:
- 自動從 package.json 獲取正確版本號
- 分析歷史工作日誌推斷下一版本
- 避免版本號錯誤判斷
- 提供標準化的工作日誌模板


---

## 📖 文件驅動開發流程

### 敏捷機制核心要求

- **任務設計與分派**: 預設目標為「最小、最快可交付」（MVP）
- **階段性交付**: 將大型重構分解成小型、可驗證的交付階段
- **高頻工作日誌更新**: 工作日誌作為站立會議，高頻更新進度、阻礙與決策
- **程式碼協作標註**: 使用 `//todo:` 標註協作溝通和改善方向
- **文件同步更新**: 程式碼變更後立即更新相關文件，包括工作日誌和版本記錄

### 技術文件寫作規範

**務實記錄風格**：使用具體數據和客觀描述，避免誇大用語

- ✅ 功能性描述："實作了 5層驗證策略"
- ✅ 量化效果："測試通過率從 92% 提升到 100%"
- ❌ 誇飾用語："完美解決"、"卓越表現"、"企業級"

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

2. **禁止測試中字串錯誤比較**
   ```javascript
   // ❌ 違規 - ESLint 報錯
   expect(...).toThrow('error message')

   // ✅ 正確 - 符合規範
   expect(...).toMatchObject({ code: 'ERROR_CODE', details: {...} })
   ```

3. **強制使用 StandardError 體系**
   - `StandardError` - 基礎錯誤類別
   - `BookValidationError` - 書籍驗證專用錯誤
   - `OperationResult` - 統一回應格式

### ESLint 規則狀態
- ✅ **已啟用並強制執行** - 違規代碼無法通過 lint 檢查
- 🔍 **當前專案狀況**: ~585+ 處違規待修復
- 📋 **詳細規則說明**: [ESLint 錯誤處理規則文件](./docs/claude/eslint-error-handling-rules.md)

**檢查指令**: `npm run lint | grep "🚨"` 顯示所有違規

---

## 🎯 測試設計哲學強制原則

**核心原則**: 測試必須精確驗證我們可控制的行為，絕不依賴外部資源或假設性限制

### 🚨 嚴格禁止的測試模式

#### ❌ 外部資源依賴
```javascript
// ❌ 錯誤 - 測試 Chrome 系統限制
expect(chromeStorage.quota).toBe(5 * 1024 * 1024)
expect(chromeStorage.available).toBeGreaterThan(4.9 * 1024 * 1024)

// ✅ 正確 - 測試我們的行為
expect(storageResult.success).toBe(true)
expect(storageResult.data).toBeDefined()
```

#### ❌ 假設性數字限制
```javascript
// ❌ 錯誤 - 百分比評估
expect(通過率).toBeGreaterThan(0.7)  // 70%
expect(成功率).toBeGreaterThan(0.8)  // 80%

// ✅ 正確 - 精確驗證
// Mock 10筆資料 → 必須得到 10筆結果
expect(results).toHaveLength(10)
expect(results.every(r => r.processed)).toBe(true)
```

#### ❌ 任意效能限制
```javascript
// ❌ 錯誤 - 憑空限制執行時間
expect(executionTime).toBeLessThan(1000)
expect(memoryUsage).toBeLessThan(50 * 1024 * 1024)

// ✅ 正確 - 驗證功能行為
expect(operation.completed).toBe(true)
expect(operation.result).toMatchObject(expectedResult)
```

#### ❌ 容差性測試設計
```javascript
// ❌ 錯誤 - 為系統差異設計容差
expect(actualValue).toBeCloseTo(expectedValue, 1)
expect(actualValue).toBeGreaterThan(expectedValue - 100)

// ✅ 正確 - 測試我們可控制的部分
expect(ourCalculatedValue).toBe(expectedCalculatedValue)
expect(ourProcessedData).toEqual(expectedProcessedData)
```

### ✅ 正確的測試設計原則

#### 1. **精確輸入輸出驗證**
- Mock N筆資料 → 必須產生 N筆結果
- 特定輸入 → 特定預期輸出
- 錯誤條件 → 明確錯誤回應

#### 2. **行為驗證優於指標驗證**
```javascript
// ✅ 驗證我們的邏輯行為
expect(validator.validate(validData)).toBe(true)
expect(validator.validate(invalidData)).toBe(false)
expect(processor.process(data)).toEqual(expectedOutput)
```

#### 3. **問題暴露策略**
- 效能問題 → 修改程式架構，不調整測試標準
- 記憶體問題 → 重構演算法，不放寬記憶體限制
- 時間問題 → 優化邏輯，不延長時間限制

#### 4. **可控資源原則**
- 只測試我們完全控制的輸入、處理、輸出
- 不測試外部系統的限制或特性
- 使用 Mock 替代所有外部依賴

### 🔍 測試審查檢查清單

**需要立即修正的模式**:
- [ ] `expect(...).toBeGreaterThan(百分比)`
- [ ] `expect(時間).toBeLessThan(...)`
- [ ] `expect(記憶體).toBeLessThan(...)`
- [ ] `expect(配額).toBe(硬編碼數值)`
- [ ] `expect(...).toBeCloseTo(..., tolerance)`
- [ ] 任何基於「系統差異容忍」的測試設計

**正確驗證模式**:
- [x] 精確的輸入輸出對應
- [x] 明確的成功/失敗狀態檢查
- [x] 完整的資料結構驗證
- [x] 純粹的邏輯行為測試

---

## 🏗 架構債務管理核心原則

**核心原則**: 架構問題和設計債務是第一優先修正目標，絕不可「先將就」或「之後再處理」

### 🚨 立即處理原則

1. **架構問題發現 = 立即修正**: 一旦識別出架構債務，立即停止功能開發，優先修正
2. **修復成本會指數增長**: 架構問題拖延修復的成本隨時間呈指數增長
3. **絕不妥協的品質標準**: 寧可延遲功能發布，也不允許技術債務累積
4. **根本原因必須徹底解決**: 不接受「暫時性修正」或「症狀緩解」

### 🔍 架構債務分類與優先級

**🔴 Critical (必須立即停止開發修正)**:
- 違反 SOLID 原則的設計
- 模組間高耦合或循環依賴
- 不一致的錯誤處理模式
- 測試困難或無法測試的程式碼

**🟡 High (下一個TDD循環前必須修正)**:
- 程式碼重複超過 3 次
- 函數超過 30 行
- 模組責任不明確

### 程式碼品質規範

**語意化命名與單一句意原則**:
- 每個函式必須能以「一句話」清楚描述其目的與產出；無法以一句話表述時，優先檢視是否需「拆分職責」或「調整命名」。
- 函式名稱以動詞開頭，直接揭示行為與意圖；看到名稱即可推測輸入、輸出與副作用範圍。
- 變數名稱使用名詞，表意單一且不含糊；布林變數使用 `is`、`has`、`can` 前綴。
- 一致性：遵循專案既定命名風格與用語，避免非必要縮寫。

範例：請見 `docs/claude/code-quality-examples.md`

**檔案路徑語意規範（強制）**:

**採用 `src/` 開頭的語意化路徑格式**:
- ✅ **語意清晰**: 一眼就能理解模組在專案中的位置和責任邊界
- ✅ **Chrome Extension 相容**: Service Worker 環境完全支援
- ✅ **Jest 支援**: 測試環境透過 moduleNameMapper 完全支援 (`^src/(.*)$: <rootDir>/src/$1`)
- ✅ **重構安全**: 移動檔案時影響範圍明確可控，降低破壞性變更風險

**路徑格式要求**:
- **JavaScript 模組引用**: 使用 `require('src/模組路徑')` 格式
- **禁止深層相對路徑**: 絕不使用 `../../../` 等相對深度計算
- **⚠️ 測試執行限制**: `src/` 路徑僅在 Jest 測試環境中有效，詳見「測試執行規範」
- **Jest 相容性**: 配合 Jest moduleNameMapper 確保測試正常執行

**正確範例**:
```javascript
// ✅ 正確 - Jest 相容的 src/ 格式
const Logger = require('src/core/logging/Logger')
const BaseModule = require('src/background/lifecycle/base-module')

// ❌ 錯誤 - 深層相對路徑
const Logger = require('../../../core/logging/Logger')

// ❌ 錯誤 - Jest 測試環境無法解析
const Logger = require('./src/core/logging/Logger')
```

詳細範例：請見 `docs/claude/format-fix-examples.md`

**五事件評估準則（非硬性上限）**:
- 本專案採事件驅動；函式可協調多個事件/子作業以達成目標。「5」為責任複雜度的警示值，不是硬性行數限制。
- 若函式內直接協調「超過五個」離散事件或明確步驟，請檢查是否：a) 職責過於臃腫、b) 函式名稱未準確對齊行為、c) 應拆分為多個較小函式或委派至協調器。
- 評估面向：事件（或步驟）數量、分支層級、外部依賴數、狀態轉換次數；任一過高皆應發出重構信號。
- 行動指引：提煉私有輔助函式以維持公開 API 的單一句意；必要時引入事件總線/協調器拆分責任，確保函式名稱與實際行為保持一致。

範例：請見 `docs/claude/code-quality-examples.md`

**類別命名規範（Class）**:
- 命名採 PascalCase，格式建議：`<Domain><核心概念><角色/類型>`（例如：`ReadmooCatalogService`、`OverviewPageController`、`StandardError`）。
- 角色/類型常用後綴：`Service`、`Controller`、`Repository`、`Adapter`、`Coordinator`、`Factory`、`Validator`。
- 單一句意原則：類別名稱必須讓讀者立即理解責任邊界與用途；避免含糊名稱如 `Utils`、`Helper`（除非在該 domain 下有明確職責）。
- 位置與名稱對齊：類別應放在對應的 domain 路徑下，類別名稱與路徑語意一致（見「檔案路徑語意規範」）。
- 公開 API 範圍最小化：只暴露必要的公開方法，其餘以私有方法維持內聚。

**檔案與資料夾命名（File/Domain）**:
- 檔案命名沿用 `docs/README.md` 規範：`feature.type.js`（例如：`book-extractor.handler.js`）。
- 類別導向檔案：建議一檔一類；檔名以 kebab-case 對應類別語意與角色（例如：`readmoo-catalog.service.js` 對應 `ReadmooCatalogService`）。
- 資料夾（Domain）採 kebab-case，依功能域劃分；單看路徑即可理解來源與責任（domain-oriented path）。
- 聚合匯出使用 `index.js` 僅作 barrel；避免在 `index.js` 混合過多邏輯。
- 匯入寫法需避免相對深度，改用語意化根路徑（見「檔案路徑語意規範」）。

**類別/單檔複雜度拆分準則**:
- 五協作者/五事件警示：若單一類別或檔案直接協調的事件、外部依賴、協作者超過 5，需檢討是否職責臃腫或命名不符，考慮拆分或引入協調器。
- 公開方法數警示：公開方法數 > 5 應評估拆分為更聚焦的角色（如 `Validator`、`Repository`、`Coordinator`）。
- 匯出數警示：單一檔案匯出（default + named）> 3 應評估分檔或聚合至 barrel。
- 控制流程警示：巢狀層級 > 3、跨域依賴過多、狀態轉換複雜時，優先降低協作面或抽出子模組。
- 行動指引：
  - 提煉子服務：把驗證、轉換、存取層抽為專責類別/模組。
  - 引入協調器：以 `Coordinator` 組裝多個專職服務，維持單一句意的公開 API。
  - 調整命名：讓名稱與實際責任對齊，避免名不副實導致誤用。

範例：請見 `docs/claude/code-quality-examples.md`

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

# ✅ 正確 - 執行特定測試
npx jest tests/unit/specific-test.test.js
```

**錯誤方式**:
```bash
# ❌ 錯誤 - 直接使用 Node.js (會導致模組解析失敗)
node tests/integration/architecture/messaging-services-integration.test.js
node -e "const Service = require('src/background/...')" 
```

**技術原因**:
- 專案使用 `src/` 語意化路徑，透過 Jest 的 `moduleNameMapper` 配置支援
- Chrome Extension 環境支援 `src/` 路徑，但 Node.js 環境需要 Jest 的模組映射
- 直接使用 Node.js 會導致 "Cannot find module 'src/..." 錯誤

**除外情況**:
- 僅當需要測試純粹的模組匯入時，可以暫時使用相對路徑進行 Node.js 測試
- 生產環境和 Chrome Extension 中的 `src/` 路徑解析正常運作

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

## 🚨 絕對禁止的妥協行為

- ❌ **「先這樣，之後再改」**: 架構問題必須當下解決
- ❌ **「測試之後再寫」**: 違反 TDD 原則
- ❌ **「這個 bug 不影響功能」**: 所有已知問題都必須修復
- ❌ **「複製貼上這段程式碼」**: 重複程式碼必須立即重構
- ❌ **「暫時用 try-catch 包起來」**: 錯誤處理必須有明確策略

---

## 📊 任務追蹤管理

### 任務管理

- 所有任務記錄在 `docs/todolist.md`
- 使用圖例追蹤進度：⭕ 待開始、🔴 紅燈、🟢 綠燈、🔵 重構、✅ 完成
- 每完成一個 TDD 循環立即更新狀態

### 里程碑追蹤

- v0.0.x: 基礎架構與測試框架
- v0.x.x: 開發階段，逐步實現功能
- v1.0.0: 完整功能，準備上架 Chrome Web Store

---

## 📚 重要文件參考

- `docs/todolist.md` - 開發任務追蹤
- `docs/work-logs/` - 詳細開發工作日誌
- `CHANGELOG.md` - 版本變更記錄
- `docs/domains/architecture/` - 架構設計文件
- `docs/domains/workflows/` - 開發流程規範
- `docs/domains/guidelines/` - 品質標準指引

---

## 語言規範

**所有回應必須使用繁體中文 (zh-TW)**

- 產品使用者和開發者為台灣人，使用台灣特有的程式術語
- 程式碼中的中文註解和變數命名嚴格遵循台灣語言慣例
- 如不確定用詞，優先使用英文而非中國用語

### 📚 專案用語規範

**參考文件**: [專案用語規範字典](./docs/claude/terminology-dictionary.md)

**核心原則**:
1. **精確性優先**: 使用具體、明確的技術術語，避免模糊概念詞彙
2. **台灣在地化**: 優先使用台灣慣用的程式術語
3. **技術導向**: 明確說明實際的技術實現方式和決策邏輯來源

**重要禁用詞彙**:
- ❌ 「智能」- 應使用「自動化腳本」、「規則比對」、「條件判斷」等精確術語
- ❌ 「文檔」- 應使用「文件」(台灣用語)
- ❌ 「數據」- 應使用「資料」(台灣用語)
- ❌ 「默認」- 應使用「預設」(台灣用語)

**正確用語範例**:
- ✅ 「自動化腳本檢查」而非「智能檢查」
- ✅ 「規則比對分析」而非「智能分析」
- ✅ 「系統提示」而非「智能建議」
- ✅ 「版號同步」、「狀態檢測」、「指令執行」等明確術語

---

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.