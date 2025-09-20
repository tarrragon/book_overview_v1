# 測試相關警告修復實作規劃

## 功能實作規劃

根據 TDD Phase 3 實作規劃階段的要求，為測試相關警告修復提供完整的實作策略和指引。

### 1. 實作策略設計階段

#### 整體架構決策
- **策略模式**：採用不同的修復策略處理不同類型的警告
- **批次處理架構**：將所有測試檔案分批處理，避免記憶體過載
- **安全優先原則**：每次修復前備份，確保可以回滾

#### 技術選擇理由
- **檔案操作**：使用 Node.js fs 模組進行同步檔案操作，確保順序執行
- **正則表達式**：精確匹配特定的警告模式，避免誤修
- **ESLint 整合**：利用 ESLint 的 `--fix` 功能處理格式化問題

#### 最小實作原則
1. **只處理測試檔案中的警告**，不影響源碼
2. **使用 eslint-disable 註解**而非修改邏輯
3. **保持測試功能完整性**，只修復 linting 問題

#### 漸進式開發計劃
- **階段1**：修復 `no-unused-vars` 警告（最常見）
- **階段2**：修復 `no-console` 警告
- **階段3**：修復其他類型警告（`no-new`, `multiline-ternary` 等）

### 2. 詳細實作指引階段

#### 第一階段實作指引：no-unused-vars 修復

**目標測試群組**：所有引入但未使用 `ErrorCodes` 和 `StandardError` 的測試檔案

**核心程式碼範例**：
```javascript
// 檢測模式
const unusedImportPattern = /^const\s+\{\s*(ErrorCodes|StandardError)\s*\}\s*=\s*require\([^)]+\)$/gm

// 使用情況檢查
function isVariableActuallyUsed(content, varName) {
  // 移除 require 語句後檢查使用次數
  const withoutRequire = content.replace(unusedImportPattern, '')
  const usageCount = (withoutRequire.match(new RegExp(`\\b${varName}\\b`, 'g')) || []).length
  return usageCount > 0
}

// 修復策略
function addDisableComment(content, importLine) {
  return content.replace(importLine, `// eslint-disable-next-line no-unused-vars\n${importLine}`)
}
```

**實作步驟**：
1. 掃描所有 `/tests/` 目錄下的 `.js` 檔案
2. 檢查是否包含 `ErrorCodes` 或 `StandardError` 的 require 語句
3. 分析變數實際使用情況
4. 對未使用的變數添加 `eslint-disable-next-line no-unused-vars` 註解

**預期問題解決方案**：
- **問題**：誤判已使用的變數
- **解決**：使用更精確的正則表達式，檢查 `變數名.` 的使用模式
- **問題**：檔案讀寫錯誤
- **解決**：添加 try-catch 錯誤處理，記錄失敗檔案

#### 第二階段實作指引：no-console 修復

**下一組目標測試**：包含 `console.log`, `console.error` 等語句的測試檔案

**程式碼範例**：
```javascript
// 檢測 console 語句
const consolePattern = /^(\s*)(console\.(log|warn|error|info|debug)\([^)]*\);?)$/gm

// 修復方法
function fixConsoleStatements(content) {
  return content.replace(consolePattern, (match, indent, statement) => {
    return `${indent}// eslint-disable-next-line no-console\n${match}`
  })
}
```

**整合策略**：
- 在第一階段完成後執行
- 確保不會重複添加 eslint-disable 註解
- 保持測試的除錯功能

#### 關鍵程式碼範例：主要修復引擎

```javascript
class TestWarningFixer {
  constructor() {
    this.fixedFiles = []
    this.statistics = {}
  }

  async fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8')
    let modified = false

    // 套用各種修復策略
    const strategies = [
      this.fixUnusedVariables,
      this.fixConsoleStatements,
      this.fixOtherWarnings
    ]

    for (const strategy of strategies) {
      const result = strategy.call(this, content)
      if (result.modified) {
        content = result.content
        modified = true
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8')
      this.fixedFiles.push(filePath)
    }
  }

  async run() {
    const testFiles = this.getAllTestFiles()
    for (const file of testFiles) {
      await this.fixFile(file)
    }

    // 執行 ESLint --fix 進行格式化
    execSync('npm run lint:fix')
  }
}
```

#### API介面實作

**主要函數簽名**：
```javascript
// 主要修復函數
async function fixTestWarnings(options = {})

// 參數處理
const defaultOptions = {
  testDirectory: 'tests/',
  dryRun: false,
  includePatterns: ['**/*.test.js', '**/*.spec.js'],
  excludePatterns: ['**/*.backup.*', '**/*.deprecated.*']
}

// 回傳值設計
return {
  success: boolean,
  fixedFiles: string[],
  statistics: {
    unusedVars: number,
    consoleStatements: number,
    otherWarnings: number
  },
  errors: string[]
}
```

### 3. 權宜方案與技術債務規劃階段

#### 最小可用實作
1. **基礎版本**：只修復 `no-unused-vars` 和 `no-console` 警告
2. **使用 eslint-disable 註解**而非重構代碼邏輯
3. **保持測試功能完整性**

#### 已知限制記錄
- **限制1**：無法處理動態生成的變數名稱
- **限制2**：可能會對某些複雜的使用模式產生誤判
- **限制3**：添加的註解會增加代碼行數

#### //todo: 改善方向
```javascript
// TODO: 升級為 AST 解析，提高準確性
// TODO: 添加互動式確認模式
// TODO: 整合到 pre-commit hook 中
// TODO: 支援自定義修復規則
// TODO: 添加修復效果統計報告
```

#### 重構準備
- **階段1**：收集修復統計數據，分析效果
- **階段2**：基於數據優化修復策略
- **階段3**：整合到 CI/CD 流程中

### 4. 驗證與品質保證規劃階段

#### 測試通過策略
1. **修復前測試**：記錄當前測試通過狀況
2. **修復後測試**：確保所有測試仍然通過
3. **回歸測試**：運行完整的測試套件

**驗證指令序列**：
```bash
# 修復前檢查
npm test:unit > before-fix-test-results.txt

# 執行修復
node fix-test-warnings.js

# 修復後檢查
npm test:unit > after-fix-test-results.txt
npm run lint tests/ > after-fix-lint-results.txt

# 比較結果
diff before-fix-test-results.txt after-fix-test-results.txt
```

#### 程式碼品質檢查
- **ESLint 規則遵循**：確保修復後通過所有 ESLint 檢查
- **最佳實踐應用**：保持代碼可讀性和維護性
- **一致性檢查**：確保修復方式在所有檔案中一致

#### 邊界條件處理
1. **空檔案處理**：跳過空的測試檔案
2. **權限問題**：處理無法寫入的檔案
3. **編碼問題**：處理非 UTF-8 編碼的檔案
4. **循環引用**：避免修復過程中的無限循環

#### 效能考量
- **記憶體使用**：分批處理大量檔案，避免記憶體溢出
- **執行時間**：提供進度顯示，估算完成時間
- **並發處理**：考慮使用 worker threads 提高效率

### 實作驗證檢查清單

**修復前檢查**：
- [ ] 當前測試通過率是多少？
- [ ] 有多少個警告需要修復？
- [ ] 哪些警告類型最常見？

**修復中檢查**：
- [ ] 每個檔案修復前是否備份？
- [ ] 修復策略是否按計劃執行？
- [ ] 有沒有檔案修復失敗？

**修復後檢查**：
- [ ] 所有測試是否仍然通過？
- [ ] ESLint 警告數量是否減少？
- [ ] 代碼功能是否完整保持？

**交接標準**：
- [ ] 修復策略完整且可執行
- [ ] 程式碼範例覆蓋所有核心邏輯
- [ ] 權宜方案明確標註
- [ ] 驗證策略讓所有測試案例都有對應的修復方法

## 總結

本實作規劃提供了修復測試相關 ESLint 警告的完整策略，遵循 TDD Phase 3 的要求，確保主線程可以直接按照指引進行實作。修復過程將保持測試功能的完整性，同時大幅減少 linting 警告，提高代碼品質。