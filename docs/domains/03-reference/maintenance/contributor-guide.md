# 🤝 貢獻者指南

## 📋 總覽

歡迎加入 Readmoo 書庫提取器專案！本指南將協助您了解如何有效貢獻程式碼、文件和改善建議。

## 🚀 快速開始

### 環境準備

```bash
# 1. Fork 並複製專案
git clone https://github.com/YOUR_USERNAME/book_overview_v1.git
cd book_overview_v1

# 2. 安裝依賴
npm install --legacy-peer-deps

# 3. 設定開發環境
./scripts/setup-dev-environment.sh

# 4. 執行測試確認環境正常
npm test
```

### 開發工作流程

```bash
# 1. 建立功能分支
git checkout -b feature/your-feature-name

# 2. 啟動開發環境
./scripts/setup-tmux-layout.sh

# 3. 開始開發 (遵循 TDD 流程)
npm run dev

# 4. 執行完整測試套件
npm run test:coverage

# 5. 使用標準提交流程
/commit-as-prompt
```

## 📝 貢獻類型

### 🔧 程式碼貢獻

#### **Bug 修復**
1. **建立 Issue**: 詳細描述問題重現步驟
2. **編寫測試**: 先寫失敗測試驗證 Bug
3. **修復實作**: 遵循專案程式碼規範
4. **驗證修復**: 確保測試通過且未引入新問題

```javascript
// Bug 修復範例：修復書籍提取錯誤
describe('BookExtractor Bug Fix', () => {
  it('should handle empty book data gracefully', () => {
    const extractor = new BookExtractor();
    const result = extractor.extractBook(null);
    
    expect(result).toEqual({
      success: false,
      error: 'Invalid book data',
      books: []
    });
  });
});
```

#### **功能開發**
1. **需求討論**: 在 Issue 中討論功能設計
2. **架構設計**: 遵循 DDD 和事件驅動架構原則
3. **TDD 實作**: Red-Green-Refactor 循環開發
4. **文件更新**: 同步更新相關技術文件

```javascript
// 新功能範例：書籍分類功能
class BookCategorizer {
  constructor(configService, eventBus) {
    this.config = configService;
    this.eventBus = eventBus;
  }

  categorizeBook(book) {
    const category = this.determineCategory(book);
    
    this.eventBus.emit('book:categorized', {
      bookId: book.id,
      category,
      timestamp: Date.now()
    });
    
    return category;
  }

  private determineCategory(book) {
    // 分類邏輯實作
    const rules = this.config.get('categorization.rules');
    return this.applyRules(book, rules);
  }
}
```

### 📚 文件貢獻

#### **文件類型與標準**

**技術文件**:
```markdown
# 標題使用 H1
## 主要章節使用 H2  
### 詳細內容使用 H3

- 使用清單組織資訊
- 程式碼範例必須可執行
- 包含具體的使用情境

```bash
# 指令範例必須完整
npm run build:production
```

**影響範圍**: 說明文件適用對象和場景
```

#### **文件維護流程**

```bash
# 1. 識別需要更新的文件
./scripts/validate-documentation-links.sh

# 2. 遵循三層架構組織文件
docs/domains/
├── 01-getting-started/     # 30分鐘快速上手  
├── 02-development/         # 1-2小時深度開發
└── 03-reference/          # 按需查閱參考

# 3. 更新工作日誌
docs/work-logs/vX.X.X-description.md

# 4. 驗證文件品質
npm run docs:validate
```

#### **程式碼註解規範**

```javascript
/**
 * 書籍資料提取器
 * 
 * 負責從 Readmoo 頁面提取書籍資訊，支援批次處理和錯誤重試。
 * 採用事件驅動架構，可與其他模組鬆散耦合。
 * 
 * @example
 * const extractor = new BookExtractor(configService, eventBus);
 * const books = await extractor.extractBooks(urls);
 * 
 * @author Contributors
 * @since v0.11.0
 */
class BookExtractor {
  /**
   * 從指定 URL 提取書籍資料
   * 
   * @param {string[]} urls - 書籍頁面 URL 清單
   * @param {Object} options - 提取選項
   * @param {boolean} options.includeNotes - 是否包含筆記
   * @param {number} options.timeout - 超時時間 (ms)
   * 
   * @returns {Promise<ExtractResult>} 提取結果
   * 
   * @throws {ExtractionError} 當提取失敗時拋出
   */
  async extractBooks(urls, options = {}) {
    // 實作邏輯
  }
}
```

## 🔍 程式碼審查

### 審查標準

#### **程式碼品質檢查清單**

**架構與設計**:
- [ ] 遵循單一職責原則
- [ ] 符合專案 DDD 領域劃分
- [ ] 正確使用事件驅動模式
- [ ] 依賴注入使用恰當

**程式碼風格**:
- [ ] 語意化命名 (函數、變數、類別)
- [ ] 單一句意原則 (每個函數可用一句話描述)
- [ ] 路徑語意清晰 (domain-oriented path)
- [ ] 五事件評估通過 (函數複雜度控制)

**測試覆蓋**:
- [ ] 單元測試覆蓋率 ≥ 90%
- [ ] 整合測試涵蓋主要流程
- [ ] 錯誤處理場景測試
- [ ] Edge case 測試

**效能考量**:
- [ ] 無明顯效能瓶頸
- [ ] 記憶體使用合理
- [ ] Chrome Extension 限制遵守
- [ ] 非同步操作適當處理

#### **自動化檢查工具**

```bash
# 程式碼品質檢查
npm run lint                # ESLint 檢查
npm run type-check         # TypeScript 檢查  
npm run test:coverage      # 測試覆蓋率
npm run audit             # 安全性檢查

# 效能分析
npm run performance:analyze  # 效能分析
npm run bundle:size         # 打包大小檢查
npm run memory:profile      # 記憶體分析
```

### 審查流程

#### **Pull Request 標準**

```markdown
## PR 標題
feat(extractor): 新增書籍分類功能

## 變更描述
### WHAT
新增自動書籍分類功能，支援文學、商業、技術等分類

### WHY  
使用者需要快速過濾和組織大量書籍，提升書庫管理效率

### HOW
- 實作 BookCategorizer 服務
- 整合 AI 分類 API
- 新增分類規則配置
- 提供手動覆寫機制

## 測試
- [ ] 單元測試通過 (覆蓋率 95%)
- [ ] 整合測試通過
- [ ] 手動測試驗證

## 檢查清單
- [ ] 程式碼符合專案規範
- [ ] 文件已同步更新
- [ ] 無破壞性變更
- [ ] 效能影響可接受

## 截圖/Demo
[如果是 UI 變更，附上截圖或 GIF]
```

#### **審查時程**

| PR 類型 | 審查時程 | 審查者數量 |
|---------|----------|------------|
| Bug 修復 | 24小時內 | 1人 |
| 小功能 | 48小時內 | 1-2人 |
| 重大功能 | 72小時內 | 2-3人 |
| 架構變更 | 1週內 | 3人+ |

## 🛠 開發工具配置

### IDE 設定

#### **VSCode 設定範例**
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "jest.autoEnable": true,
  "jest.showCoverageOnLoad": true
}
```

#### **推薦擴充功能**
- ESLint
- Prettier
- Jest
- GitLens
- Chrome Extension Development
- TypeScript Importer

### Git 設定

```bash
# Git Hooks 設定
npm run prepare  # 安裝 husky hooks

# 提交訊息規範檢查
git config --local commit.template .gitmessage.txt

# 設定預設編輯器
git config --local core.editor "code --wait"
```

## 👥 社群參與

### 溝通管道

**技術討論**:
- GitHub Issues: Bug 報告、功能需求
- GitHub Discussions: 架構討論、最佳實務分享
- Pull Requests: 程式碼審查、實作討論

**協作原則**:
- 尊重不同觀點和經驗背景
- 建設性回饋，避免人身攻擊
- 分享學習經驗，協助新貢獻者
- 遵循 Code of Conduct

### 貢獻等級

#### **初學者 (Beginner)**
- 修復明顯的 Bug
- 改善文件錯字和連結
- 新增測試案例
- 翻譯文件

**建議任務**:
- Good First Issue 標籤的任務
- 文件校對和改善
- 簡單功能實作

#### **中級 (Intermediate)**  
- 實作新功能
- 效能優化
- 重構現有程式碼
- 整合測試

**建議任務**:
- Medium Priority 功能開發
- Chrome Extension API 整合
- UI/UX 改善

#### **高級 (Advanced)**
- 架構設計
- 核心模組開發  
- 技術方案制定
- Code Review

**建議任務**:
- High Priority 架構變更
- 效能關鍵路徑優化
- 技術債務解決

## 🎖 貢獻認可

### 認可機制

#### **貢獻者名單**
定期更新 CONTRIBUTORS.md，包含：
- 貢獻者姓名/暱稱
- 主要貢獻領域
- 重要貢獻描述

#### **特殊認可**
- **核心維護者**: 長期活躍且高品質貢獻
- **領域專家**: 特定技術領域深度貢獻
- **社群建設者**: 協助新人、文件改善、社群營運

#### **年度總結**
- 年度貢獻者報告
- 重要功能實作回顧
- 社群成長統計

### 貢獻統計

```bash
# 檢視貢獻統計
./scripts/contributor-stats.sh

# 範例輸出
Contributors in the last 12 months:
Alice: 45 commits, 12 PRs, 8 issues
Bob: 32 commits, 15 PRs, 6 issues  
Carol: 28 commits, 9 PRs, 12 issues
```

## 📞 獲得協助

### 常見問題

**Q: 如何設定開發環境？**
A: 參考 [開發環境設定](./docs/domains/02-development/workflows/development-setup.md)

**Q: 測試要怎麼寫？**  
A: 參考 [測試金字塔實踐](./docs/domains/02-development/testing/test-pyramid.md)

**Q: 提交訊息格式？**
A: 使用 `/commit-as-prompt` 指令，遵循 WHAT/WHY/HOW 結構

**Q: 程式碼審查標準？**
A: 參考本文件「程式碼審查」章節和 [程式碼品質範例](./docs/claude/code-quality-examples.md)

### 聯絡方式

- **技術問題**: 建立 GitHub Issue
- **功能建議**: 使用 GitHub Discussions  
- **安全漏洞**: 私下聯絡維護者
- **其他協助**: 參考專案 README 聯絡資訊

---

## 📚 相關文件參考

- [Git 協作規範](./docs/domains/02-development/workflows/git-workflow.md) - 版本控制最佳實務
- [文件維護指南](./documentation-maintenance.md) - 文件品質標準
- [程式碼品質範例](./docs/claude/code-quality-examples.md) - 具體程式碼規範

---

**🙏 感謝您的貢獻！** 每一個改善都讓這個專案變得更好，幫助更多使用者有效管理他們的電子書庫。