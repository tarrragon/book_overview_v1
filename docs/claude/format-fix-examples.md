# 📋 文件格式化與修正案例範例集

**文件版本**: v1.0  
**建立日期**: 2025-09-06  
**適用範圍**: 主線程、sub-agent (mint-format-specialist)  
**用途**: 標準化修正模式，確保一致性和品質

---

## 🎯 使用指南

### 📖 **如何使用此範例集**

**主線程開發者**:
- 遇到格式化問題時，參考對應章節的修正模式
- 按照「Before → After」模式進行修正
- 確保符合專案程式碼規範要求

**Sub-Agent (mint-format-specialist)**:
- 作為批量處理的標準參考
- 確保所有修正都符合既定模式
- 產生報告時引用相關範例說明修正邏輯

**工作流程整合**:
- 修正前：查閱相關章節確認修正方式
- 修正中：嚴格按照範例模式執行
- 修正後：驗證結果符合範例標準

---

## 📁 文件路徑語意化修正範例

### 🔧 **1. 單層相對路徑修正**

#### ❌ **修正前 (Before)**
```markdown
## 相關文件
- [開發實戰指南](../02-development/) - 具體開發流程和規範
- [領域設計詳解](../02-development/architecture/domain-design.md) - DDD 實踐細節
- [測試策略文件](../02-development/testing/) - 深入學習測試最佳實踐
```

#### ✅ **修正後 (After)**
```markdown
## 相關文件
- [開發實戰指南](docs/domains/02-development/) - 具體開發流程和規範
- [領域設計詳解](docs/domains/02-development/architecture/domain-design.md) - DDD 實踐細節
- [測試策略文件](docs/domains/02-development/testing/) - 深入學習測試最佳實踐
```

**修正原則**:
- 所有文件引用使用 `docs/domains/` 為起始路徑
- 保持路徑的完整語意性
- 確保每個路徑段都具有明確意義

### 🔧 **2. 雙層相對路徑修正**

#### ❌ **修正前 (Before)**
```markdown
參考文件：
- [事件驅動架構規範](../../claude/event-driven-architecture.md)
- [專案用語規範字典](../../claude/terminology-dictionary.md)
- [TDD 協作開發流程](../../claude/tdd-collaboration-flow.md)
```

#### ✅ **修正後 (After)**
```markdown
參考文件：
- [事件驅動架構規範](docs/claude/event-driven-architecture.md)
- [專案用語規範字典](docs/claude/terminology-dictionary.md)
- [TDD 協作開發流程](docs/claude/tdd-collaboration-flow.md)
```

**修正原則**:
- Claude 文檔使用 `docs/claude/` 為起始路徑
- 專案規範類文檔統一路徑格式
- 保持連結的語意化和可讀性

### 🔧 **3. 三層相對路徑修正**

#### ❌ **修正前 (Before)**
```javascript
// 程式碼中的相對路徑引用
const { BookValidationError, NetworkError } = require('../../../core/errors/BookValidationError')
const { OperationResult } = require('../../../core/errors/OperationResult')
const { OperationStatus } = require('../../../core/enums/OperationStatus')
```

#### ✅ **修正後 (After)**
```javascript
// 使用語意化根路徑引用
const { BookValidationError, NetworkError } = require('src/core/errors/BookValidationError')
const { OperationResult } = require('src/core/errors/OperationResult')
const { OperationStatus } = require('src/core/enums/OperationStatus')
```

**修正原則**:
- 程式碼引用使用 `src/` 為起始路徑
- 避免任何 `../` 相對深度計算
- 確保模組引用語意清晰

### 🔧 **4. 混合路徑修正**

#### ❌ **修正前 (Before)**
```markdown
### 快速導覽
1. [核心架構總覽](./core-architecture.md) - 當前檔案同層引用
2. [開發問題診斷](../03-reference/troubleshooting/) - 跨域引用  
3. [專案規範](../../claude/chrome-extension-specs.md) - Claude文檔引用
```

#### ✅ **修正後 (After)**
```markdown
### 快速導覽  
1. [核心架構總覽](docs/domains/01-getting-started/core-architecture.md) - 完整語意路徑
2. [開發問題診斷](docs/domains/03-reference/troubleshooting/) - 完整語意路徑
3. [專案規範](docs/claude/chrome-extension-specs.md) - 完整語意路徑
```

**修正原則**:
- 即使是同層文件，也使用完整語意化路徳
- 統一所有引用格式，提升維護性
- 讓路徑「單看就理解」來源與責任

---

## 🧹 Lint 問題修正範例

### 🔧 **1. 格式化問題修正**

#### ❌ **修正前 (Before)**
```javascript
// trailing spaces, 不正確的縮排和分號
function validateBookData( bookData ){
if(bookData.title&&bookData.author)  {
console.log( "Validating book data..." )  
return true    
}
return false
}
```

#### ✅ **修正後 (After)**
```javascript
// 正確的格式化
function validateBookData(bookData) {
    if (bookData.title && bookData.author) {
        console.log("Validating book data...");
        return true;
    }
    return false;
}
```

**修正項目**:
- ✅ 移除尾隨空格 (trailing spaces)
- ✅ 修正函數括號前的空格 (space-before-function-paren)
- ✅ 統一縮排格式 (4空格)
- ✅ 加入必要的分號
- ✅ 優化運算符空格

### 🔧 **2. 未使用變數清理**

#### ❌ **修正前 (Before)**
```javascript
import { BookDataExtractor, ValidationHelper, StorageManager } from './extractors';
import { NetworkService } from './services';

function extractBookData(url) {
    const extractor = new BookDataExtractor();
    const unusedHelper = new ValidationHelper(); // 未使用
    const unusedService = new NetworkService(); // 未使用
    
    return extractor.extract(url);
}
```

#### ✅ **修正後 (After)**
```javascript
import { BookDataExtractor } from './extractors';

function extractBookData(url) {
    const extractor = new BookDataExtractor();
    return extractor.extract(url);
}
```

**修正項目**:
- ✅ 移除未使用的匯入 (unused imports)
- ✅ 移除未使用的變數宣告
- ✅ 簡化程式碼結構
- ✅ 提升程式碼可讀性

### 🔧 **3. Console.log 警告處理**

#### ❌ **修正前 (Before)**
```javascript
function processBookData(data) {
    console.log("Processing book data:", data); // 開發除錯用
    console.log("Data validation started"); // 開發除錯用
    
    if (!data.title) {
        console.log("Title is missing"); // 開發除錯用
        return null;
    }
    
    console.log("Processing completed"); // 開發除錯用
    return processedData;
}
```

#### ✅ **修正後 (After)**
```javascript
import { Logger } from 'src/core/utils/Logger';

function processBookData(data) {
    Logger.debug("Processing book data:", data);
    Logger.debug("Data validation started");
    
    if (!data.title) {
        Logger.warn("Title is missing");
        return null;
    }
    
    Logger.debug("Processing completed");
    return processedData;
}
```

**修正項目**:
- ✅ 使用專案 Logger 系統替換 console.log
- ✅ 適當的日誌等級 (debug, warn, error)
- ✅ 統一日誌管理機制
- ✅ 生產環境日誌控制

---

## 📝 Markdown 格式標準化範例

### 🔧 **1. 標題格式標準化**

#### ❌ **修正前 (Before)**
```markdown
##核心功能
### 資料提取
####驗證機制
```

#### ✅ **修正後 (After)**
```markdown
## 核心功能

### 資料提取

#### 驗證機制
```

**修正項目**:
- ✅ 標題符號後加空格
- ✅ 標題前後加空行分隔
- ✅ 統一標題層級結構

### 🔧 **2. 程式碼區塊格式化**

#### ❌ **修正前 (Before)**
````markdown
```
function test() {
return true;
}
```
````

#### ✅ **修正後 (After)**
````markdown
```javascript
function test() {
    return true;
}
```
````

**修正項目**:
- ✅ 指定程式語言類型
- ✅ 正確縮排格式
- ✅ 提升語法高亮效果

### 🔧 **3. 清單格式統一**

#### ❌ **修正前 (Before)**
```markdown
* 項目一
- 項目二  
+ 項目三
    * 子項目a
    - 子項目b
```

#### ✅ **修正後 (After)**
```markdown
- 項目一
- 項目二
- 項目三
  - 子項目a
  - 子項目b
```

**修正項目**:
- ✅ 統一使用 `-` 作為清單符號
- ✅ 正確的巢狀縮排 (2空格)
- ✅ 一致的格式風格

---

## 🎯 檔案命名規範修正範例

### 🔧 **1. 檔名格式標準化**

#### ❌ **修正前 (Before)**
```
BookDataExtractor.js          # PascalCase 檔名
book_data_extractor.js        # snake_case 檔名
bookdataextractor.js          # 無分隔符檔名
BookData-Extractor.js         # 混合格式檔名
```

#### ✅ **修正後 (After)**
```
book-data-extractor.js        # kebab-case 檔名
validation-helper.service.js  # feature.type.js 格式
domain-coordinator.js         # 語意化命名
error-handler.util.js         # 功能責任清晰
```

**修正原則**:
- ✅ 使用 kebab-case 命名格式
- ✅ 採用 `feature.type.js` 結構  
- ✅ 檔名反映功能責任
- ✅ 避免縮寫和模糊名稱

### 🔧 **2. 目錄結構語意化**

#### ❌ **修正前 (Before)**
```
src/
├── utils/
├── helpers/
├── misc/
└── stuff/
```

#### ✅ **修正後 (After)**
```
src/
├── core/
│   ├── errors/
│   ├── validators/  
│   └── coordinators/
├── domains/
│   ├── data-management/
│   ├── book-extraction/
│   └── storage-sync/
└── infrastructure/
    ├── adapters/
    └── services/
```

**修正原則**:
- ✅ 目錄名稱具體表意
- ✅ 反映 domain 責任邊界
- ✅ 避免模糊的通用名稱
- ✅ 支援語意化路徑引用

---

## 🚀 批量處理最佳實踐

### 🔧 **1. 分批處理策略**

```markdown
## 批次處理計劃

**Phase 1**: 文檔類路徑修正 (150個文件)
- 批次大小: 25個文件/批
- 驗證重點: 連結完整性
- 預估時間: 6批次

**Phase 2**: 程式碼類路徑修正 (89個文件)  
- 批次大小: 15個文件/批
- 驗證重點: 模組引用正確性
- 預估時間: 6批次

**Phase 3**: Lint問題修正 (3760個問題)
- 批次大小: 500個問題/批
- 驗證重點: 功能無破壞性
- 預估時間: 8批次
```

### 🔧 **2. 品質確認檢查點**

```markdown
## 每批次完成後檢查

**連結完整性驗證**:
- [ ] 所有修正後的連結都能正確訪問
- [ ] 沒有產生 404 或破壞的連結
- [ ] 路徑語意與實際位置一致

**功能無破壞性驗證**:
- [ ] 修正後程式碼能正常執行
- [ ] 模組引用沒有產生錯誤
- [ ] 測試仍然通過

**格式一致性驗證**:
- [ ] 所有修正都符合專案標準
- [ ] 命名規範統一執行
- [ ] 程式碼風格一致
```

---

## 📊 修正效果評估標準

### 🎯 **成功指標**

**文件路徑語意化**:
- ✅ 轉換準確率: 100%
- ✅ 連結有效率: 100%  
- ✅ 語意清晰度: 95% 以上

**Lint 問題修復**:
- ✅ 自動修復率: 95% 以上
- ✅ 功能無破壞: 100%
- ✅ 程式碼品質提升: ESLint score 提升 80%

**整體品質提升**:
- ✅ 新人理解時間縮短 50%
- ✅ 文件維護成本降低 40%
- ✅ 開發效率提升 30%

---

## 🔄 持續改善機制

### 📋 **範例更新流程**

1. **新問題類型發現** → 記錄到範例集
2. **修正方式驗證** → 更新最佳實踐
3. **效果評估完成** → 調整修正策略
4. **工具優化需求** → 改善自動化流程

**範例集維護**:
- 每月回顧並更新範例
- 新增常見問題的修正模式
- 移除過時或不適用的範例
- 持續優化修正效率

---

**📚 Reference Index**:
- [Mint Format Specialist](./mint-format-specialist.md) - 專業格式化 sub-agent
- [程式碼品質範例](./code-quality-examples.md) - 程式碼品質標準  
- [檔案路徑語意規範](../CLAUDE.md#檔案路徑語意規範) - 路徑規範詳細說明

**🔧 Tool Integration**: 此範例集與 `mint-format-specialist` sub-agent 完全整合，確保修正的一致性和標準化。