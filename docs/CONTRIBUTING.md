# 🤝 貢獻指南

**歡迎參與 Readmoo 書庫提取器專案！**

此文件將協助您了解如何為專案做出貢獻，包括程式碼提交、錯誤報告、功能建議等。

## 📋 快速開始

### 開發環境設定

1. **Fork 專案**

   ```bash
   git clone https://github.com/你的用戶名/book_overview_v1.git
   cd book_overview_v1
   ```

2. **安裝依賴**

   ```bash
   npm install --legacy-peer-deps
   ```

3. **執行測試**

   ```bash
   npm test
   ```

4. **建置專案**
   ```bash
   npm run build:dev
   ```

### 開發工具需求

- **Node.js**: >= 16.0.0
- **npm**: >= 7.0.0
- **Chrome 瀏覽器**: 最新版本
- **程式碼編輯器**: 建議使用 VS Code

## 🏗 開發流程

### TDD (測試驅動開發) 流程

本專案嚴格遵循 TDD 開發模式：

#### 🔴 Red 階段 - 撰寫測試

1. 理解需求和功能規格
2. 撰寫失敗的測試案例
3. 確認測試正確失敗
4. 使用 `sage-test-architect` 代理人協助測試設計

#### 🟢 Green 階段 - 實現功能

1. 撰寫最小可行程式碼讓測試通過
2. 不過度設計，專注讓測試通過
3. 使用 `pepper-test-implementer` 代理人協助實現

#### 🔵 Refactor 階段 - 重構優化

1. 保持測試通過的前提下重構程式碼
2. 改善程式碼品質、可讀性、效能
3. 使用 `cinnamon-refactor-owl` 代理人協助重構

### Git 工作流程

#### 分支命名規範

- `feature/功能名稱`: 新功能開發
- `bugfix/問題描述`: 錯誤修復
- `hotfix/緊急修復`: 緊急修復
- `docs/文件更新`: 文件更新
- `refactor/重構內容`: 程式碼重構

#### 提交訊息規範 (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Type 類型**:

- `feat`: 新功能
- `fix`: 錯誤修復
- `docs`: 文件更新
- `style`: 程式碼格式調整
- `refactor`: 重構
- `test`: 測試相關
- `chore`: 建置或輔助工具變動

**範例**:

```
feat(extractor): 新增 BookWalker 適配器支援

- 實現 BookWalker 平台的書籍資料提取
- 支援閱讀進度和狀態解析
- 新增相關測試案例

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## 🧪 測試要求

### 測試覆蓋率標準

- 單元測試覆蓋率: >= 90%
- 整合測試覆蓋率: >= 80%
- 端對端測試覆蓋率: >= 70%

### 測試類型

#### 單元測試

```bash
# 執行所有單元測試
npm run test:unit

# 執行特定模組測試
npm run test:unit -- --testPathPattern=extractor

# 監視模式
npm run test:watch
```

#### 整合測試

```bash
# 執行整合測試
npm run test:integration

# Chrome Extension 整合測試
npm run test:integration:chrome
```

#### 端對端測試

```bash
# 執行端對端測試
npm run test:e2e
```

### 測試撰寫指南

#### 測試結構

```javascript
describe('ModuleName', () => {
  beforeEach(() => {
    // 測試前設定
  })

  afterEach(() => {
    // 測試後清理
  })

  describe('methodName', () => {
    it('should do something when condition', async () => {
      // Arrange: 準備測試資料
      const input = 'test data'

      // Act: 執行被測試的功能
      const result = await module.methodName(input)

      // Assert: 驗證結果
      expect(result).toBe('expected result')
    })
  })
})
```

#### 測試最佳實踐

- 每個測試只測試一個功能點
- 測試名稱清楚描述測試內容
- 使用 AAA 模式 (Arrange-Act-Assert)
- Mock 外部依賴
- 測試邊界條件和錯誤情況

## 📝 程式碼風格

### ESLint 規則

專案使用 ESLint 進行程式碼檢查：

```bash
# 檢查程式碼風格
npm run lint

# 自動修復可修復的問題
npm run lint:fix
```

### 程式碼撰寫規範

#### 命名規則

- **變數和函數**: camelCase (`getUserData`)
- **常數**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **類別**: PascalCase (`BookDataExtractor`)
- **檔案**: kebab-case (`book-data-extractor.js`)

#### 函數設計原則

- 單一責任原則
- 函數長度不超過 30 行
- 避免深層嵌套 (最多 3 層)
- 使用純函數 (沒有副作用)

#### 註解規範

```javascript
/**
 * 提取書籍資料
 * @param {string} platform - 平台名稱
 * @param {Object} options - 提取選項
 * @param {boolean} options.includeProgress - 是否包含進度資訊
 * @returns {Promise<Array<Book>>} 書籍資料陣列
 * @throws {ExtractorError} 當平台不支援時拋出錯誤
 */
async function extractBooks(platform, options = {}) {
  // 實作內容
}
```

## 🐛 錯誤報告

### 報告錯誤前的檢查

- [ ] 確認是否為已知問題 (檢查 GitHub Issues)
- [ ] 嘗試重現問題
- [ ] 收集錯誤資訊 (錯誤訊息、瀏覽器版本等)
- [ ] 準備最小重現案例

### 錯誤報告模板

```markdown
## 問題描述

簡潔描述遇到的問題

## 重現步驟

1. 開啟 Readmoo 網站
2. 點擊「提取書籍資料」
3. 觀察錯誤發生

## 預期行為

描述應該發生的正確行為

## 實際行為

描述實際發生的錯誤行為

## 環境資訊

- Chrome 版本:
- Extension 版本:
- 作業系統:
- 錯誤訊息:

## 額外資訊

其他相關資訊或截圖
```

## 💡 功能建議

### 建議新功能前的考量

- 功能是否符合專案目標
- 是否有足夠的使用者需求
- 實作複雜度評估
- 是否與現有功能衝突

### 功能建議模板

```markdown
## 功能描述

詳細描述建議的新功能

## 使用情境

說明什麼情況下需要這個功能

## 預期效益

這個功能能帶來什麼好處

## 實作建議

如果有實作想法，可以在此描述

## 替代方案

是否有其他解決方案
```

## 🔄 Pull Request 流程

### 提交前檢查清單

- [ ] 程式碼遵循 TDD 流程
- [ ] 所有測試通過
- [ ] 程式碼風格檢查通過
- [ ] 相關文件已更新
- [ ] 提交訊息符合規範
- [ ] 沒有不必要的檔案變動

### PR 描述模板

```markdown
## 變更摘要

簡述這個 PR 的主要變更

## 相關 Issue

Fixes #issue_number

## 變更類型

- [ ] 新功能
- [ ] 錯誤修復
- [ ] 文件更新
- [ ] 重構
- [ ] 其他

## 測試

說明如何測試這個變更

## 檢查清單

- [ ] 程式碼遵循專案規範
- [ ] 新增或更新了相關測試
- [ ] 文件已更新
- [ ] 自我檢查通過
```

### 程式碼審查標準

- 程式碼邏輯正確性
- 測試覆蓋率和品質
- 效能影響評估
- 安全性檢查
- 與現有架構的一致性

## 📚 文件貢獻

### 文件類型

- **API 文件**: 程式碼介面說明
- **使用指南**: 用戶操作說明
- **架構文件**: 系統設計說明
- **貢獻指南**: 開發者指南

### 文件撰寫原則

- 清晰、準確、完整
- 提供實際範例
- 保持更新與程式碼同步
- 使用繁體中文 (zh-TW)

## 🏆 貢獻者獎勵

### 認可制度

- GitHub 貢獻者列表
- CONTRIBUTORS.md 檔案記錄
- 版本發布感謝名單
- 特殊貢獻者專項感謝

### 成就等級

- **初次貢獻者**: 完成第一個 PR
- **活躍貢獻者**: 持續貢獻 3 個月以上
- **核心貢獻者**: 重要功能實現或維護
- **專案維護者**: 長期維護和指導

## 📞 聯絡方式

### 討論和提問

- **GitHub Discussions**: 一般討論和提問
- **GitHub Issues**: 錯誤報告和功能建議
- **Pull Request**: 程式碼審查和討論

### 即時溝通

- 開發者聊天室 (如有設立)
- 社群平台討論區

## 🎉 感謝

感謝所有對專案做出貢獻的開發者！每一個 PR、Issue、建議都是專案進步的動力。

特別感謝：

- 提供 TDD 開發指導的貢獻者
- 協助文件翻譯和校對的貢獻者
- 回報和修復錯誤的貢獻者
- 提供功能建議和設計想法的貢獻者

---

**文件版本**: v1.0.0  
**最後更新**: 2025-08-06  
**維護者**: 開發團隊
