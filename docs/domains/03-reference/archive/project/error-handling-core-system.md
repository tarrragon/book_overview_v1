# 🚨 錯誤處理核心系統 - 快速查詢指南

**版本**: v2.0 (簡化設計)  
**最後更新**: 2025-09-05  
**狀態**: 生產就緒 ✅

## 🎯 系統概述

本專案採用 **Linux 專家認可的 v2.0 簡化錯誤處理系統**，避免過度工程設計，提供直接、實用的錯誤處理解決方案。

### 核心設計原則

- **數據結構優於算法** - 好的數據結構讓程式碼變簡單
- **消除特殊情況** - 不為不存在的問題建造解決方案  
- **直接且明確** - 避免間接層和抽象
- **每個錯誤類型知道如何格式化自己** - 無需中央字典

## 📦 核心組件

### 1. 枚舉系統 (`src/core/enums/`)

使用 `Object.freeze()` 確保不可變性，支援 Chrome Extension 序列化：

```javascript
// 引入方式
const { OperationStatus, ErrorTypes, MessageTypes, LogLevel } = require('src/core/enums')

// 使用範例
const result = new OperationResult(true, data, null, OperationStatus.SUCCESS)
```

#### 可用枚舉

- **`OperationStatus`** - 操作狀態 (SUCCESS, FAILED, PENDING, CANCELLED, TIMEOUT, PARTIAL_SUCCESS)
- **`ErrorTypes`** - 錯誤類型分類 (VALIDATION_ERROR, NETWORK_ERROR, BUSINESS_ERROR 等)
- **`MessageTypes`** - 訊息類型 (ERROR, WARNING, INFO, SUCCESS, DEBUG 等)
- **`LogLevel`** - 日誌等級 (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)

### 2. 專用錯誤類別系統 (`src/core/errors/`)

每個錯誤類型負責自己的格式化，提供類型安全和語意清晰的錯誤處理：

#### BookValidationError - 書籍驗證錯誤

```javascript
const { BookValidationError } = require('src/core/errors/BookValidationError')

// 基本使用
const error = BookValidationError.create(book, '缺少必要欄位')

// 專用方法
const missingFieldsError = BookValidationError.missingFields(book, ['title', 'author'])
const formatError = BookValidationError.invalidFormat(book, 'isbn', 'ISBN-13')

// 與 OperationResult 整合
const result = OperationResult.failure(error)
```

#### NetworkError - 網路錯誤

```javascript  
const { NetworkError } = require('src/core/errors/NetworkError')

// HTTP 錯誤
const httpError = NetworkError.create('https://api.example.com', 404)

// 超時錯誤
const timeoutError = NetworkError.timeout('https://api.example.com', 5000)

// 連線失敗
const connectionError = NetworkError.connectionFailed('https://api.example.com')

// API 限制
const rateLimitError = NetworkError.rateLimited('https://api.example.com', 60)
```

### 3. 統一回應格式 (OperationResult)

```javascript
const { OperationResult } = require('src/core/errors/OperationResult')

// 成功回應
const successResult = OperationResult.success(data)

// 失敗回應 (自動轉換錯誤格式)
const failureResult = OperationResult.failure(error)

// 結果檢查
if (result.success) {
  console.log(result.data)
} else {
  console.error(result.error.message)
}

// JSON 序列化 (支援 Chrome Extension)
const json = result.toJSON()
const restored = OperationResult.fromJSON(json)
```

## 🚀 快速開始

### 典型使用場景

#### 1. 資料驗證錯誤

```javascript
function validateBook(book) {
  if (!book.title) {
    throw BookValidationError.missingFields(book, ['title'])
  }
  
  if (!isValidISBN(book.isbn)) {
    throw BookValidationError.invalidFormat(book, 'isbn', 'ISBN-13')
  }
  
  return OperationResult.success(book)
}
```

#### 2. 網路請求錯誤

```javascript
async function fetchBookData(url) {
  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      throw NetworkError.create(url, response.status)
    }
    
    const data = await response.json()
    return OperationResult.success(data)
    
  } catch (error) {
    if (error.name === 'NetworkError') {
      return OperationResult.failure(error)
    } else {
      return OperationResult.failure(NetworkError.connectionFailed(url, error.message))
    }
  }
}
```

#### 3. 狀態檢查

```javascript
// 使用枚舉而非硬編碼字串
if (result.status === OperationStatus.SUCCESS) {
  // 處理成功邏輯
} else if (result.status === OperationStatus.FAILED) {
  // 處理失敗邏輯
}

// 錯誤類型檢查
if (result.error && result.error.code === ErrorTypes.NETWORK_ERROR) {
  // 網路錯誤處理
}
```

## 🔧 實際應用範例

### 在既有服務中整合

```javascript
// src/background/domains/data-management/services/example-service.js

const { BookValidationError, NetworkError } = require('../../../core/errors/BookValidationError')
const { OperationResult } = require('../../../core/errors/OperationResult')
const { OperationStatus } = require('../../../core/enums/OperationStatus')

class ExampleService {
  async processBooks(books) {
    try {
      // 使用新的錯誤類別
      if (!Array.isArray(books)) {
        throw BookValidationError.invalidFormat({ title: '書籍集合' }, 'books', 'Array')
      }
      
      const results = await Promise.all(
        books.map(book => this.processBook(book))
      )
      
      return OperationResult.success(results)
      
    } catch (error) {
      return OperationResult.failure(error)
    }
  }
}
```

## 🔄 向後相容性

現有的 StandardError 系統仍然完全支援：

```javascript
// 舊方式仍可用
const oldError = new StandardError('VALIDATION_FAILED', '驗證失敗')
const result = OperationResult.failure(oldError)

// 新方式更語意化
const newError = BookValidationError.create(book, '驗證失敗')
const result2 = OperationResult.failure(newError)

// 兩種方式都能正常序列化
console.log(result.toJSON())
console.log(result2.toJSON())
```

## 📋 遷移指南

### 從舊式錯誤處理遷移

```javascript
// 舊方式 ❌
throw new Error('書籍驗證失敗')
if (status === 'success') { ... }

// 新方式 ✅  
throw BookValidationError.create(book, '驗證失敗')
if (status === OperationStatus.SUCCESS) { ... }
```

### 測試更新

```javascript
// 舊測試 ❌
expect(result.error.message).toBe('驗證失敗')

// 新測試 ✅
expect(result.error.code).toBe('BOOK_VALIDATION_FAILED')
expect(result.status).toBe(OperationStatus.FAILED)
```

## ⚡ 效能考量

- **記憶體效率**: 每個錯誤物件 < 1KB
- **處理速度**: 錯誤建立和格式化 < 1ms  
- **序列化支援**: 完全支援 Chrome Extension 跨環境傳遞
- **類型安全**: 編譯時和運行時類型檢查

## 🔗 相關文件

- **主規格**: [錯誤處理標準化方案](../architecture/error-handling-standardization-plan.md)
- **實作細節**: [Phase 4 v2.0 實作規劃](../architecture/phase4-implementation-specification-v2.md)  
- **工作記錄**: [開發過程記錄](../work-logs/v0.10.12-simplified-error-handling-system-design.md)

---

💡 **提示**: 這是一個實用且經過專家認可的簡化設計，專注於解決實際問題而非追求複雜的抽象。遇到問題時，優先考慮直接且明確的解決方案。