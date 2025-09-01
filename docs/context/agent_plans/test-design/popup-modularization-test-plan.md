# Popup 模組化重構 TDD 測試設計計劃

**建立日期**: 2025-08-18  
**分析員**: TDD 單元測試設計專家  
**版本**: v1.0.0  
**專案版本**: v0.9.12+

## 🎯 重構分析與測試策略概述

### 當前代碼結構分析

#### 📊 現有檔案結構評估

**popup.js (1077行) - 單一巨型檔案問題**

- **業務邏輯混雜**: DOM 操作、狀態管理、通訊處理、錯誤處理全部混合
- **職責不清**: 單一檔案包含 8+ 個不同的職責領域
- **測試困難**: 由於高耦合，單元測試需要模擬大量依賴
- **維護性低**: 修改任何功能都可能影響其他不相關功能

**popup-ui-manager.js (1187行) - 複雜 DOM 管理器**

- **過度抽象**: 配置化設計導致複雜度反而增加
- **與 popup-ui-components.js 功能重疊**: 存在職責重複和競爭關係
- **記憶體管理問題**: 複雜的快取機制和事件監聽器管理

**popup-ui-components.js (490行) - 現有組件系統**

- **設計良好**: 組件化設計原則，職責明確
- **未被使用**: 現有系統未整合此檔案
- **潛力高**: 適合作為重構的核心基礎

### 🎯 重構目標與測試需求分析

#### 模組拆分方案設計

**目標模組架構**:

```
src/popup/
├── popup.js (重構後 < 150行) - 主要入口和協調器
├── components/
│   ├── popup-ui-components.js (現有，整合改善)
│   ├── popup-status-manager.js (新建)
│   ├── popup-progress-manager.js (新建)
│   └── popup-error-manager.js (新建)
├── services/
│   ├── popup-communication-service.js (新建)
│   ├── popup-state-service.js (新建)
│   └── popup-extraction-service.js (新建)
└── utils/
    ├── popup-dom-utils.js (新建)
    └── popup-constants.js (新建)
```

#### 職責重新分配原則

**Domain 驅動分離**:

1. **UI 組件層** - 純粹的視覺元素管理
2. **服務層** - 業務邏輯處理
3. **通訊層** - 與 Background/Content Script 通訊
4. **協調層** - 模組間協調和生命週期管理

## 🧪 TDD 測試設計策略

### 階段一：需求分析與測試清單建立

#### 📋 功能需求分析完整記錄

**核心功能分析** (從 popup.js 提取):

1. **狀態管理功能**
   - 更新擴展狀態顯示 (updateStatus)
   - 更新按鈕狀態 (updateButtonState)
   - 版本資訊顯示 (updateVersionDisplay)
   - 定期狀態更新 (periodicStatusUpdate)

2. **進度顯示功能**
   - 進度條更新 (updateProgress)
   - 進度隱藏 (hideProgress)
   - 視覺回饋管理

3. **結果展示功能**
   - 提取結果顯示 (displayExtractionResults)
   - 結果匯出功能 (exportResults)
   - 操作按鈕狀態管理

4. **錯誤處理功能**
   - 錯誤訊息顯示 (handleExtractionError)
   - 重試機制 (retryExtraction)
   - 取消操作 (cancelExtraction)

5. **通訊管理功能**
   - Background Service Worker 檢查 (checkBackgroundStatus)
   - 當前標籤頁檢查 (checkCurrentTab)
   - Chrome Extension API 通訊

6. **操作處理功能**
   - 資料提取啟動 (startExtraction)
   - 設定界面顯示 (showSettings)
   - 說明資訊顯示 (showHelp)
   - 書庫總覽開啟 (openLibraryOverview)

7. **事件管理功能**
   - 事件監聽器設定 (setupEventListeners)
   - DOM 事件處理

8. **初始化功能**
   - 完整初始化流程 (initialize)
   - 生命週期管理

#### 🎯 模組化測試需求設計

**測試優先級分類**:

**P0 (關鍵核心功能)**:

- 狀態管理模組測試
- 通訊服務模組測試
- 初始化協調器測試

**P1 (重要使用者功能)**:

- UI 組件整合測試
- 進度管理模組測試
- 錯誤處理模組測試

**P2 (輔助功能)**:

- 工具模組測試
- 常數管理測試

### 階段二：單元測試架構設計

#### 🏗 測試架構分層設計

**Layer 1: 組件單元測試**

- 每個新建模組的獨立功能測試
- Mock 所有外部依賴
- 專注於輸入輸出驗證

**Layer 2: 服務整合測試**

- 模組間協作測試
- 模擬真實 Chrome Extension 環境
- 事件流程完整性驗證

**Layer 3: 系統回歸測試**

- 重構前後功能一致性驗證
- 效能回歸測試
- 使用者體驗保證測試

#### 📝 詳細測試案例設計

### 組件層測試設計

#### popup-ui-components.js 整合改善測試

**測試場景 1: 現有功能保持性驗證**

```javascript
describe('PopupUIComponents 整合改善', () => {
  describe('🔍 現有功能保持性驗證', () => {
    test('應保持現有狀態顯示功能不變', () => {
      // Given: 現有的 PopupUIComponents 實例
      // When: 呼叫狀態更新方法
      // Then: 狀態正確顯示且格式一致
    })

    test('應保持現有進度顯示功能不變', () => {
      // Given: 現有的進度顯示介面
      // When: 更新進度數值
      // Then: 進度條和百分比正確顯示
    })
  })
})
```

**測試場景 2: 新增功能擴展驗證**

```javascript
describe('🚀 新增功能擴展驗證', () => {
  test('應支援批量狀態更新', () => {
    // Given: 多個狀態更新請求
    // When: 呼叫批量更新方法
    // Then: 所有狀態正確更新且效能良好
  })

  test('應支援狀態變化事件通知', () => {
    // Given: 事件監聽器設定
    // When: 狀態發生變化
    // Then: 正確觸發事件並傳遞狀態資料
  })
})
```

#### popup-status-manager.js 新建模組測試

**測試場景 1: 狀態管理核心功能**

```javascript
describe('PopupStatusManager 核心功能', () => {
  describe('📊 狀態更新功能', () => {
    test('應正確更新擴展狀態', () => {
      // Given: 狀態管理器和初始狀態
      // When: 呼叫狀態更新方法
      // Then: 狀態正確更新並觸發相關事件
    })

    test('應正確處理狀態類型驗證', () => {
      // Given: 無效的狀態類型
      // When: 嘗試更新狀態
      // Then: 拋出適當錯誤並保持原始狀態
    })
  })

  describe('🔄 狀態同步功能', () => {
    test('應與 Background Service Worker 狀態同步', () => {
      // Given: Background 狀態變化
      // When: 接收狀態同步事件
      // Then: 本地狀態正確更新
    })
  })
})
```

#### popup-communication-service.js 新建模組測試

**測試場景 1: Chrome Extension API 通訊**

```javascript
describe('PopupCommunicationService 通訊功能', () => {
  describe('📡 Background Service Worker 通訊', () => {
    test('應正確檢查 Background 狀態', () => {
      // Given: Mock Chrome Runtime API
      // When: 檢查 Background 狀態
      // Then: 正確處理回應並更新本地狀態
    })

    test('應正確處理通訊超時', () => {
      // Given: 模擬通訊超時
      // When: 執行狀態檢查
      // Then: 正確處理超時並提供使用者回饋
    })
  })

  describe('📋 Content Script 通訊', () => {
    test('應正確發送提取開始訊息', () => {
      // Given: 有效的標籤頁 ID
      // When: 發送提取開始訊息
      // Then: 訊息正確發送並處理回應
    })
  })
})
```

### 服務層測試設計

#### popup-extraction-service.js 新建模組測試

**測試場景 1: 提取流程協調**

```javascript
describe('PopupExtractionService 提取服務', () => {
  describe('🚀 提取流程管理', () => {
    test('應正確啟動提取流程', () => {
      // Given: 有效的頁面環境
      // When: 啟動資料提取
      // Then: 正確協調各模組並更新狀態
    })

    test('應正確處理提取錯誤', () => {
      // Given: 模擬提取錯誤
      // When: 執行提取流程
      // Then: 正確處理錯誤並恢復狀態
    })
  })
})
```

### 協調層測試設計

#### popup.js 重構後協調器測試

**測試場景 1: 模組載入協調**

```javascript
describe('Popup 協調器功能', () => {
  describe('🔧 模組初始化協調', () => {
    test('應正確載入所有必要模組', () => {
      // Given: 初始化環境
      // When: 執行初始化流程
      // Then: 所有模組正確載入並建立依賴關係
    })

    test('應正確處理模組載入失敗', () => {
      // Given: 模擬模組載入失敗
      // When: 執行初始化
      // Then: 正確處理失敗並提供降級功能
    })
  })
})
```

### 整合測試設計

#### 模組間協作測試

**測試場景 1: 完整提取流程測試**

```javascript
describe('模組間協作整合測試', () => {
  describe('📋 完整提取流程', () => {
    test('應正確執行從啟動到完成的完整流程', () => {
      // Given: 所有模組正確初始化
      // When: 使用者點擊提取按鈕
      // Then: 完整流程正確執行並顯示結果
    })
  })
})
```

### 回歸測試設計

#### 功能一致性驗證

**測試場景 1: 重構前後一致性**

```javascript
describe('重構回歸測試', () => {
  describe('✅ 功能一致性驗證', () => {
    test('重構後所有原有功能保持不變', () => {
      // Given: 重構前後的功能比較基準
      // When: 執行相同的操作序列
      // Then: 結果完全一致
    })
  })
})
```

## 🔄 TDD 實作階段規劃

### Red 階段測試設計

#### 階段 R1: 組件模組測試設計

- **目標**: 設計所有新建模組的失敗測試
- **重點**: 確保測試覆蓋所有核心功能
- **預期結果**: 所有新模組測試失敗 (紅燈狀態)

#### 階段 R2: 整合測試設計

- **目標**: 設計模組間協作的失敗測試
- **重點**: 驗證模組間的介面設計
- **預期結果**: 整合測試失敗 (紅燈狀態)

#### 階段 R3: 回歸測試設計

- **目標**: 設計功能一致性驗證測試
- **重點**: 確保重構不會破壞現有功能
- **預期結果**: 回歸測試失敗 (紅燈狀態)

### Green 階段實作策略

#### 階段 G1: 最小模組實作

- **策略**: 實作剛好讓單元測試通過的最小代碼
- **重點**: 建立基本的模組結構和介面
- **預期結果**: 單元測試通過 (綠燈狀態)

#### 階段 G2: 模組整合實作

- **策略**: 實作模組間的基本協作功能
- **重點**: 建立模組間的通訊機制
- **預期結果**: 整合測試通過 (綠燈狀態)

#### 階段 G3: 功能遷移實作

- **策略**: 將 popup.js 中的功能遷移到各模組
- **重點**: 保持功能完整性和正確性
- **預期結果**: 回歸測試通過 (綠燈狀態)

### Refactor 階段最佳化

#### 階段 B1: 程式碼品質改善

- **目標**: 改善程式碼結構和可讀性
- **重點**: 消除重複代碼，改善命名
- **品質檢查**: 代碼複雜度、測試覆蓋率

#### 階段 B2: 效能最佳化

- **目標**: 改善記憶體使用和執行效能
- **重點**: 最佳化事件處理和 DOM 操作
- **效能指標**: 載入時間、記憶體使用量

#### 階段 B3: 可維護性提升

- **目標**: 提升長期維護性
- **重點**: 完善文件、改善錯誤處理
- **維護指標**: 代碼註解、錯誤處理覆蓋率

## 📊 測試覆蓋率要求

### 單元測試覆蓋率標準

**組件層覆蓋率**: 100%

- 所有公開方法必須有測試
- 所有錯誤處理路徑必須測試
- 所有邊界條件必須驗證

**服務層覆蓋率**: 100%

- 所有業務邏輯必須測試
- 所有外部依賴必須模擬
- 所有非同步操作必須驗證

**協調層覆蓋率**: 100%

- 所有模組載入路徑必須測試
- 所有錯誤恢復機制必須驗證
- 所有生命週期事件必須測試

### 整合測試覆蓋率標準

**模組間通訊**: 100%

- 所有模組間的事件通訊必須測試
- 所有資料傳遞必須驗證
- 所有錯誤傳播必須測試

**使用者流程**: 100%

- 所有主要使用者操作流程必須測試
- 所有錯誤恢復流程必須驗證
- 所有邊界情況必須處理

## 🛡 品質保證機制

### Mock 設計策略

#### Chrome Extension API Mock

```javascript
const mockChromeAPI = {
  runtime: {
    sendMessage: jest.fn(),
    getManifest: jest.fn(() => ({ version: '0.9.12' })),
    openOptionsPage: jest.fn()
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  }
}
```

#### DOM Environment Mock

```javascript
const createMockDOMEnvironment = () => {
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM(mockHTML, {
    url: 'chrome-extension://test/popup.html',
    pretendToBeVisual: true,
    resources: 'usable'
  })
  return dom.window.document
}
```

### 測試資料管理

#### 標準測試案例資料

```javascript
const testCases = {
  validStatus: {
    status: '就緒',
    text: 'Content Script 連線正常',
    info: '可以開始提取書庫資料',
    type: 'ready'
  },
  errorStatus: {
    status: '錯誤',
    text: '無法連線到 Background Service Worker',
    info: '請重新載入擴展',
    type: 'error'
  }
}
```

### 效能基準設定

#### 載入時間基準

- **模組載入時間**: < 50ms
- **初始化完成時間**: < 200ms
- **首次狀態更新**: < 100ms

#### 記憶體使用基準

- **基本記憶體佔用**: < 5MB
- **峰值記憶體佔用**: < 10MB
- **記憶體洩漏檢測**: 0 洩漏

## 📋 測試執行計劃

### TDD 循環排程

#### 第一週期 (W1): 組件層模組化

- **Day 1-2**: 建立組件模組測試
- **Day 3-4**: 實作組件模組基本功能
- **Day 5**: 組件模組重構和最佳化

#### 第二週期 (W2): 服務層模組化

- **Day 1-2**: 建立服務模組測試
- **Day 3-4**: 實作服務模組基本功能
- **Day 5**: 服務模組重構和最佳化

#### 第三週期 (W3): 協調層整合

- **Day 1-2**: 建立協調器測試
- **Day 3-4**: 實作協調器功能
- **Day 5**: 整體重構和最佳化

### 驗證標準檢查點

#### 每個 TDD 循環後檢查

- [ ] 所有測試通過 (100% 通過率)
- [ ] 測試覆蓋率達標 (100% 覆蓋率)
- [ ] 效能基準符合要求
- [ ] 代碼品質標準達成
- [ ] 功能回歸驗證通過

#### 完整重構後檢查

- [ ] 所有原有功能保持完整
- [ ] 新架構符合設計原則
- [ ] 效能較重構前提升或相等
- [ ] 可維護性明顯改善
- [ ] 與 UX Domain 協調機制整合準備

## 🔗 與 UX Domain 整合準備

### 整合接口設計

#### 事件驅動接口

```javascript
const uxDomainIntegration = {
  // 狀態事件
  'UX.POPUP.STATUS_CHANGED': (statusData) => {},
  'UX.POPUP.PROGRESS_UPDATED': (progressData) => {},
  'UX.POPUP.ERROR_OCCURRED': (errorData) => {},

  // 使用者操作事件
  'UX.POPUP.USER_ACTION': (actionData) => {},
  'UX.POPUP.EXTRACTION_STARTED': (extractionData) => {},
  'UX.POPUP.EXTRACTION_COMPLETED': (resultData) => {}
}
```

#### 服務注入點準備

```javascript
const serviceInjectionPoints = {
  themeService: null, // 主題管理服務注入點
  preferenceService: null, // 偏好設定服務注入點
  notificationService: null, // 通知服務注入點
  personalizationService: null // 個人化服務注入點
}
```

## 📚 文件更新需求

### 技術文件更新

- **架構文件**: 更新 popup 模組架構圖
- **API 文件**: 新增各模組的 API 說明
- **測試文件**: 記錄測試策略和覆蓋率

### 開發文件更新

- **工作日誌**: 記錄詳細的重構過程
- **決策記錄**: 記錄重構中的技術決策
- **最佳實踐**: 記錄可供其他模組參考的模式

## 🎯 成功指標定義

### 技術指標

- **測試覆蓋率**: 100% (所有新模組)
- **代碼複雜度**: 單一函數 < 10 (圈複雜度)
- **效能改善**: 載入時間改善 > 20%
- **記憶體優化**: 記憶體使用減少 > 15%

### 品質指標

- **可維護性**: 模組耦合度 < 0.3
- **可測試性**: 所有公開方法可獨立測試
- **可擴展性**: 新功能新增不影響現有模組
- **相容性**: 與現有系統 100% 相容

### 開發體驗指標

- **開發效率**: 新功能開發時間減少 > 30%
- **除錯效率**: 問題定位時間減少 > 50%
- **測試效率**: 測試執行時間 < 30秒
- **整合效率**: 與 UX Domain 整合準備完成

---

**測試設計完成**: ✅  
**準備進入 Red 階段**: ✅  
**測試覆蓋策略**: 已設計完成  
**品質保證機制**: 已建立完成

**下一步行動**: 開始 Red 階段測試實作，建立第一個失敗的組件模組測試。
