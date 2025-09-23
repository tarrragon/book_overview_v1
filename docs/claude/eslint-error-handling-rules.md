# 📋 ESLint 錯誤處理規範強制規則

**版本**: v1.0  
**建立日期**: 2025-09-11  
**狀態**: 已實施並啟用  

## 🎯 目的

基於專案的錯誤處理標準化規範 ([error-handling-standardization-plan.md](../domains/03-reference/archive/architecture/error-handling-standardization-plan.md))，建立 ESLint 規則自動檢測和防止違反規範的程式碼。

### 強制執行的規範

1. **禁止字串錯誤拋出**: 禁止直接拋出字串，強制使用 `Error` 物件
2. **ErrorCodes 常數使用**: 推薦使用 `ErrorCodes` 常數，避免魔法字串
3. **結構化測試方法**: 禁止測試中的字串錯誤比較，推薦使用 `toThrow(ErrorCodes.*)` 或結構化驗證
4. **原生 JavaScript Error**: 採用原生 `Error` + `ErrorCodes` 模式，追求簡單高效

## 🚨 規則詳情

### 規則 1: 禁止字串錯誤拋出
**規則 ID**: `no-restricted-syntax` (ThrowStatement > Literal)

```javascript
// ❌ 違規 - 會被 ESLint 報錯
throw 'This is an error message'
throw "Another error message"

// ✅ 正確 - 符合規範
const { StandardError } = require('src/core/errors')
throw new StandardError('ERROR_CODE', 'This is an error message', { details })
```

**錯誤訊息**: `🚨 不允許拋出字串錯誤。請使用 StandardError 或其子類 (如 BookValidationError)`

### 規則 2: 推薦使用 ErrorCodes 常數
**規則 ID**: `推薦性規則` (不強制執行，但建議使用)

```javascript
// ✅ 基本正確 - 原生 Error 完全可接受
throw new Error('Something went wrong')

// ✅ 更佳實踐 - 使用 ErrorCodes 常數
import { ErrorCodes } from 'src/core/errors/ErrorCodes'
throw new Error(`${ErrorCodes.OPERATION_FAILED}: Something went wrong`)

// ✅ 結構化錯誤 - 需要程式化處理時
const error = new Error('Something went wrong')
error.code = ErrorCodes.OPERATION_FAILED
error.context = { user_action: true, timestamp: Date.now() }
throw error
```

**設計理念**: 採用原生 JavaScript Error，追求簡單高效，零學習成本

### 規則 3: 推薦結構化錯誤設計
**規則 ID**: `建議性實踐` (設計指引，非強制規則)

```javascript
// ✅ 簡單錯誤 - 適用於使用者介面
throw new Error('操作失敗，請稍後再試')

// ✅ 帶代碼的錯誤 - 適用於需要程式化處理
import { ErrorCodes } from 'src/core/errors/ErrorCodes'
throw new Error(`${ErrorCodes.VALIDATION_FAILED}: 電子郵件格式不正確`)

// ✅ 結構化錯誤 - 適用於複雜錯誤處理
const error = new Error('驗證失敗')
error.code = ErrorCodes.VALIDATION_FAILED
error.field = 'email'
error.category = 'format'
throw error
```

**設計考量**: 根據使用場景選擇適當的錯誤格式，平衡簡單性和功能性

### 規則 4: 推薦結構化錯誤測試
**適用範圍**: `**/*.test.js`, `**/test/**/*.js`
**規則 ID**: `建議性實踐` (推薦使用結構化測試)

```javascript
// ✅ 可接受 - 基本字串測試
expect(() => someFunction()).toThrow('Email is required')

// ✅ 更好 - ErrorCodes 常數測試
import { ErrorCodes } from 'src/core/errors/ErrorCodes'
expect(() => someFunction()).toThrow(ErrorCodes.VALIDATION_ERROR)

// ✅ 最佳 - 結構化錯誤測試（適用於複雜錯誤）
try {
  someFunction()
  fail('Expected error to be thrown')
} catch (error) {
  expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
  expect(error.message).toContain('Email is required')
  expect(error.field).toBe('email')
}

// ✅ 異步錯誤測試
await expect(asyncFunction()).rejects.toThrow(ErrorCodes.NETWORK_ERROR)
```

**設計考量**: 根據錯誤複雜度選擇適當的測試方法，簡單錯誤用簡單測試

## 📊 檢測結果

### 專案目前狀況 (2025-09-24)

```bash
npm run lint 2>&1 | grep "🚨" | wc -l
```

- **字串錯誤拋出**: 檢測並防止
- **ErrorCodes 使用率**: 推薦採用，但不強制
- **原生 Error 使用**: ✅ 完全可接受，符合新設計
- **測試方法**: 支援多種測試模式，從簡單到複雜

### 規則生效驗證

```bash
# 執行 lint 檢查所有違規
npm run lint

# 僅檢查錯誤處理規範違規
npm run lint 2>&1 | grep "🚨"

# 統計各類違規數量
npm run lint 2>&1 | grep "🚨.*不允許使用原生 Error" | wc -l
npm run lint 2>&1 | grep "🚨.*不允許在 StandardError 中使用魔法字串" | wc -l
npm run lint 2>&1 | grep "🚨.*測試中不允許使用字串比較錯誤" | wc -l
```

## 🛠 規則配置檔案

### 主配置檔案: `package.json` 中的 `eslintConfig`

**✅ 保留原本所有 ESLint 規則，並加入錯誤處理規範**

```json
{
  "eslintConfig": {
    "extends": ["standard"],
    "env": {
      "browser": true,
      "node": true,
      "jest": true,
      "webextensions": true
    },
    "globals": {
      "chrome": "readonly"
    },
    "rules": {
      // 原本的所有規則保持不變
      "no-console": "warn",
      "no-debugger": "error",
      "prefer-const": "error",
      // ... 其他原本規則
    },
    // 🚨 新增的錯誤處理規範 (不影響原本規則)
    "overrides": [
      {
        "files": ["**/*.js"],
        "rules": {
          "no-restricted-syntax": [
            "error",
            {
              "selector": "ThrowStatement > Literal",
              "message": "🚨 不允許拋出字串錯誤。請使用 StandardError 或其子類"
            },
            {
              "selector": "ThrowStatement > NewExpression[callee.name=\"Error\"]",
              "message": "🚨 不允許使用原生 Error。請使用 StandardError 或其子類"
            },
            {
              "selector": "NewExpression[callee.name=\"StandardError\"] > Literal:first-child",
              "message": "🚨 不允許在 StandardError 中使用魔法字串。請使用 ErrorCodes 常量"
            }
          ]
        }
      },
      {
        "files": ["**/*.test.js", "**/test/**/*.js"],
        "rules": {
          "no-restricted-syntax": [
            "error",
            {
              "selector": "ThrowStatement > Literal",
              "message": "🚨 測試中不允許拋出字串錯誤。請使用 StandardError 或其子類"
            },
            {
              "selector": "CallExpression[callee.property.name=\"toThrow\"] > Literal",
              "message": "🚨 測試中不允許使用字串比較錯誤。請使用 toMatchObject() 驗證錯誤結構"
            },
            {
              "selector": "CallExpression[callee.object.property.name=\"rejects\"][callee.property.name=\"toThrow\"] > Literal",
              "message": "🚨 測試中不允許使用字串比較錯誤。請使用 toMatchObject() 驗證錯誤結構"
            },
            {
              "selector": "NewExpression[callee.name=\"StandardError\"] > Literal:first-child",
              "message": "🚨 測試中不允許在 StandardError 中使用魔法字串。請使用 ErrorCodes 常量"
            }
          ]
        }
      }
    ]
  }
}
```

## 🔧 ErrorCodes 使用範例

### 1. 基本錯誤處理

```javascript
// ✅ 基本使用 - 完全可接受
function validateData(data) {
  if (!data) {
    throw new Error('Data is required')
  }
}

// ✅ 最佳實踐 - 使用 ErrorCodes
import { ErrorCodes } from 'src/core/errors/ErrorCodes'

function validateData(data) {
  if (!data) {
    throw new Error(`${ErrorCodes.VALIDATION_ERROR}: Data is required`)
  }
}

// ✅ 結構化錯誤 - 需要程式化處理時
function validateDataStructured(data) {
  if (!data) {
    const error = new Error('Data is required')
    error.code = ErrorCodes.VALIDATION_ERROR
    error.field = 'data'
    error.category = 'required_field'
    throw error
  }
}
```

### 2. 測試錯誤處理的多種方法

```javascript
import { ErrorCodes } from 'src/core/errors/ErrorCodes'

// ✅ 基本測試 - 完全可接受
test('should throw error for invalid data', () => {
  expect(() => validateData(null)).toThrow('Data is required')
})

// ✅ 更好 - 使用 ErrorCodes
test('should throw validation error', () => {
  expect(() => validateData(null)).toThrow(ErrorCodes.VALIDATION_ERROR)
})

// ✅ 最佳 - 結構化錯誤測試（適用於複雜錯誤）
test('should throw structured validation error', () => {
  try {
    validateDataStructured(null)
    fail('Expected error to be thrown')
  } catch (error) {
    expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(error.message).toBe('Data is required')
    expect(error.field).toBe('data')
    expect(error.category).toBe('required_field')
  }
})
```

### 3. 異步錯誤測試

```javascript
import { ErrorCodes } from 'src/core/errors/ErrorCodes'

// ✅ 基本異步測試
test('should reject with error message', async () => {
  await expect(asyncFunction()).rejects.toThrow('Async operation failed')
})

// ✅ ErrorCodes 異步測試
test('should reject with specific error code', async () => {
  await expect(asyncFunction()).rejects.toThrow(ErrorCodes.NETWORK_ERROR)
})

// ✅ 結構化異步錯誤測試
test('should reject with structured error', async () => {
  try {
    await asyncFunction()
    fail('Expected promise to reject')
  } catch (error) {
    expect(error.code).toBe(ErrorCodes.NETWORK_ERROR)
    expect(error.message).toContain('operation failed')
  }
})
```

## 📋 實施狀態

### 已完成
1. **✅ 錯誤處理系統簡化** - 採用原生 Error + ErrorCodes 模式
2. **✅ 文件更新** - CLAUDE.md 和規則文件已同步更新
3. **✅ 設計理念確立** - 簡單、高效、零學習成本

### 當前狀態
1. **字串錯誤拋出**: ESLint 規則有效防止
2. **ErrorCodes 採用**: 推薦使用，但不強制
3. **測試方法**: 支援從簡單到複雜的多種模式
4. **設計哲學**: 回歸 JavaScript 原生，追求實用主義

### CI/CD 整合建議
```bash
# 在 CI/CD pipeline 中加入錯誤處理規範檢查
npm run lint | grep "🚨" && exit 1 || echo "錯誤處理規範檢查通過"
```

## 📝 相關文件

- [專案錯誤處理標準化方案](../domains/03-reference/archive/architecture/error-handling-standardization-plan.md)
- [StandardError 使用指引](../../../src/core/errors/README.md) (待建立)
- [TDD 協作開發流程](./tdd-collaboration-flow.md)
- [CLAUDE.md 主規範](../../CLAUDE.md)

---

**建立者**: Claude Code  
**最後更新**: 2025-09-11  
**規則狀態**: ✅ 已實施並啟用  
**預期效果**: 防止未來違反錯誤處理規範，自動化品質控制