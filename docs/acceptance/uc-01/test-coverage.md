# UC-01: 首次安裝與設定 - 測試覆蓋分析

## 🎯 測試覆蓋目標
確保 UC-01 的所有 StandardError 都有對應的測試案例，驗證錯誤處理機制的完整性和正確性。

## 📊 現有測試覆蓋狀況

### ✅ 已覆蓋的 Exception

#### 1. DOM_READMOO_PAGE_NOT_DETECTED
**現有測試**:
- `tests/unit/popup/popup-controller.test.js:45`
- `tests/integration/first-time-setup.test.js:23`

**測試場景**:
- ✅ 非 Readmoo 頁面上點擊 Extension
- ✅ URL 模式不匹配檢測
- ✅ 錯誤訊息內容驗證

**覆蓋程度**: 🟢 完整 (95%)

#### 2. SYSTEM_STORAGE_QUOTA_EXCEEDED
**現有測試**:
- `tests/unit/storage/chrome-storage.test.js:67`
- `tests/integration/large-library-handling.test.js:89`

**測試場景**:
- ✅ 儲存空間限制模擬
- ✅ 錯誤處理和使用者通知
- ✅ 清理建議功能

**覆蓋程度**: 🟢 完整 (90%)

### 🟡 部分覆蓋的 Exception

#### 3. DOM_BOOK_ELEMENTS_NOT_FOUND
**現有測試**:
- `tests/unit/extractors/readmoo-adapter.test.js:112`

**測試場景**:
- ✅ 基本元素找不到的情況
- 🔶 缺少: Readmoo 頁面結構變更的模擬
- 🔶 缺少: 降級選擇器嘗試機制
- 🔶 缺少: 空書庫情況的處理

**覆蓋程度**: 🟡 部分 (60%)

**需要補強**:
```javascript
describe('DOM_BOOK_ELEMENTS_NOT_FOUND 完整測試', () => {
  it('應該嘗試多種選擇器策略', async () => {
    // 模擬 Readmoo 頁面結構變更
    // 驗證降級選擇器機制
    // 確認錯誤訊息包含正確的技術細節
  })

  it('應該正確識別空書庫與頁面載入問題', async () => {
    // 區分真正的空書庫與頁面載入不完整
    // 提供不同的使用者引導
  })
})
```

#### 4. NETWORK_READMOO_UNREACHABLE
**現有測試**:
- `tests/unit/network/connection-handler.test.js:34`

**測試場景**:
- ✅ 基本網路連接失敗
- 🔶 缺少: 不同類型網路錯誤的區分
- 🔶 缺少: 重試機制的詳細測試
- 🔶 缺少: 離線模式切換

**覆蓋程度**: 🟡 部分 (55%)

**需要補強**:
```javascript
describe('NETWORK_READMOO_UNREACHABLE 重試機制', () => {
  it('應該按指數退避策略重試', async () => {
    // 驗證重試次數和間隔
    // 確認最終放棄條件
  })

  it('應該提供有意義的網路診斷資訊', async () => {
    // 區分 DNS 解析失敗、連接超時、服務器錯誤
    // 提供對應的解決建議
  })
})
```

### ❌ 未覆蓋的 Exception

#### 5. DOM_EXTRACTION_PARTIAL_FAILURE
**測試狀況**: 🔴 無現有測試

**需要建立的測試**:
```javascript
describe('DOM_EXTRACTION_PARTIAL_FAILURE', () => {
  it('應該處理部分書籍資料缺失', async () => {
    // 模擬某些書籍缺少封面、標題或進度
    // 驗證錯誤統計的正確性
    // 確認可以繼續處理其他書籍
  })

  it('應該生成詳細的失敗報告', async () => {
    // 記錄每個失敗書籍的具體原因
    // 提供使用者可理解的說明
  })

  it('應該在失敗率過高時提醒使用者', async () => {
    // 失敗率 > 20% 時的特殊處理
    // 建議重新載入頁面或檢查網路
  })
})
```

**優先級**: 🔴 高 (影響使用者體驗)

#### 6. NETWORK_SLOW_CONNECTION
**測試狀況**: 🔴 無現有測試

**需要建立的測試**:
```javascript
describe('NETWORK_SLOW_CONNECTION', () => {
  it('應該在載入緩慢時提供進度指示', async () => {
    // 模擬慢速網路環境
    // 驗證進度條和預估時間
  })

  it('應該提供跳過圖片載入的選項', async () => {
    // 輕量模式的啟用和效果
    // 確認核心功能不受影響
  })
})
```

**優先級**: 🟡 中 (改善使用者體驗)

#### 7. SYSTEM_MEMORY_PRESSURE
**測試狀況**: 🔴 無現有測試

**需要建立的測試**:
```javascript
describe('SYSTEM_MEMORY_PRESSURE', () => {
  it('應該在大量書籍時自動分批處理', async () => {
    // 模擬 500+ 本書籍的情況
    // 驗證分批處理邏輯
    // 確認記憶體使用量控制
  })

  it('應該監控記憶體使用並動態調整', async () => {
    // 記憶體壓力檢測機制
    // 動態調整批次大小
  })
})
```

**優先級**: 🟡 中 (大用戶體驗)

#### 8. PLATFORM_EXTENSION_PERMISSIONS_DENIED
**測試狀況**: 🔴 無現有測試

**需要建立的測試**:
```javascript
describe('PLATFORM_EXTENSION_PERMISSIONS_DENIED', () => {
  it('應該檢測權限狀態並引導使用者', async () => {
    // 模擬權限被拒絕的情況
    // 驗證權限檢查邏輯
    // 確認引導流程清晰
  })

  it('應該提供權限修復的詳細步驟', async () => {
    // 權限重新授權流程
    // 不同 Chrome 版本的適配
  })
})
```

**優先級**: 🔴 高 (影響核心功能)

#### 9. PLATFORM_MANIFEST_V3_COMPATIBILITY
**測試狀況**: 🔴 無現有測試

**需要建立的測試**:
```javascript
describe('PLATFORM_MANIFEST_V3_COMPATIBILITY', () => {
  it('應該檢測 Chrome 版本並提供相容性資訊', async () => {
    // 不同 Chrome 版本的 API 可用性
    // 相容模式的啟用邏輯
  })
})
```

**優先級**: 🟡 中 (相容性保證)

#### 10. DATA_INITIAL_STORAGE_CORRUPTION & DATA_BOOK_VALIDATION_FAILED
**測試狀況**: 🔴 無現有測試

**需要建立的測試**:
```javascript
describe('DATA 相關錯誤處理', () => {
  describe('DATA_INITIAL_STORAGE_CORRUPTION', () => {
    it('應該檢測和修復損壞的儲存資料', async () => {
      // 模擬各種資料損壞情況
      // 驗證自動修復機制
    })
  })

  describe('DATA_BOOK_VALIDATION_FAILED', () => {
    it('應該驗證書籍資料格式並處理異常', async () => {
      // 各種資料格式錯誤的處理
      // 資料清理和修正機制
    })
  })
})
```

**優先級**: 🔴 高 (資料完整性)

## 📈 測試覆蓋率統計

### 總體覆蓋率
- **總 Exception 數量**: 10
- **已完整覆蓋**: 2 (20%)
- **部分覆蓋**: 2 (20%)
- **未覆蓋**: 6 (60%)

### 按嚴重程度分析
- **CRITICAL**: 1/1 未覆蓋 (100% 需補強)
- **SEVERE**: 2/3 未覆蓋 (67% 需補強)
- **MODERATE**: 3/4 未覆蓋 (75% 需補強)
- **MINOR**: 2/2 部分覆蓋 (需完善)

## 🚨 優先修復清單

### 第一優先級 (本週內完成)
1. **PLATFORM_EXTENSION_PERMISSIONS_DENIED** - 影響核心功能
2. **DATA_INITIAL_STORAGE_CORRUPTION** - 資料完整性關鍵
3. **DATA_BOOK_VALIDATION_FAILED** - 資料品質保證

### 第二優先級 (下週完成)
4. **DOM_EXTRACTION_PARTIAL_FAILURE** - 使用者體驗重要
5. **SYSTEM_MEMORY_PRESSURE** - 大用戶支援

### 第三優先級 (月底前完成)
6. **DOM_BOOK_ELEMENTS_NOT_FOUND** - 完善現有覆蓋
7. **NETWORK_READMOO_UNREACHABLE** - 完善網路處理
8. **NETWORK_SLOW_CONNECTION** - 網路體驗最佳化
9. **PLATFORM_MANIFEST_V3_COMPATIBILITY** - 相容性保證

## 🎯 測試品質目標

### 覆蓋率目標
- **總體覆蓋率**: 95% (目前: 40%)
- **CRITICAL 錯誤**: 100% 覆蓋
- **SEVERE 錯誤**: 100% 覆蓋
- **MODERATE 錯誤**: 90% 覆蓋
- **MINOR 錯誤**: 80% 覆蓋

### 測試品質指標
- **邊界條件測試**: 每個 Exception 至少 3 種觸發情境
- **恢復機制驗證**: 所有自動恢復邏輯都有測試
- **使用者體驗驗證**: 錯誤訊息內容和引導流程測試
- **效能影響評估**: 錯誤處理不影響正常流程效能