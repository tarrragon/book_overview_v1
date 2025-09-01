# Content.js 檔案拆分設計策略 - v1.0 重構規劃

## 📋 摘要

基於 v1.0 重構目標，分析 1,737 行 content.js 檔案的職責混合問題，並設計符合單一職責原則的模組化拆分策略。本分析專注於 Readmoo 邏輯抽象化和架構清理，為未來擴展建立清晰介面。

## 🔍 當前檔案分析

### 檔案基本資訊

- **檔案路徑**: `src/content/content.js`
- **檔案大小**: 1,737 行程式碼
- **主要職責**: Readmoo 頁面資料提取的完整流程管理

### 職責混合分析

透過深入分析，識別出以下職責混合問題：

#### 1. **事件系統實作 (Line 74-445)**

- **佔比**: 371 行 (21.4%)
- **職責**: EventBus、ChromeEventBridge 的完整實作
- **問題**: 通用事件系統與 Content Script 特定邏輯混合

#### 2. **資料提取器實作 (Line 451-807)**

- **佔比**: 356 行 (20.5%)
- **職責**: BookDataExtractor 的完整流程管理
- **問題**: 流程管理與平台特定邏輯混合

#### 3. **Readmoo 適配器實作 (Line 809-1385)**

- **佔比**: 576 行 (33.2%)
- **職責**: DOM 操作、資料解析、安全過濾
- **問題**: 最大的單一職責塊，包含過多細節實作

#### 4. **頁面檢測與初始化 (Line 1387-1487)**

- **佔比**: 100 行 (5.8%)
- **職責**: 頁面類型檢測、Content Script 初始化
- **問題**: 初始化邏輯與頁面檢測混合

#### 5. **事件橋接與生命週期 (Line 1488-1575)**

- **佔比**: 87 行 (5.0%)
- **職責**: 事件轉發、生命週期管理
- **問題**: 多個管理職責混合

#### 6. **Chrome API 訊息處理 (Line 1577-1683)**

- **佔比**: 106 行 (6.1%)
- **職責**: Background 訊息處理、狀態回報
- **問題**: 訊息處理與狀態管理混合

#### 7. **錯誤處理與啟動 (Line 1684-1737)**

- **佔比**: 53 行 (3.1%)
- **職責**: 全域錯誤處理、初始化入口
- **問題**: 多個系統層級職責混合

## 🎯 拆分設計策略

### 核心設計原則

#### 1. **單一職責原則嚴格遵循**

- 每個拆分檔案只負責一個明確定義的職責
- 檔案大小控制在 200-300 行範圍內
- 避免跨領域職責混合

#### 2. **Readmoo 邏輯抽象化**

- 將 Readmoo 特定實作封裝在抽象介面後
- 建立通用的平台適配器介面
- 為未來多平台擴展預留架構彈性

#### 3. **Chrome Extension 最佳實踐**

- 遵循 Manifest V3 Content Script 設計模式
- 優化記憶體使用和效能表現
- 確保與現有背景服務的無縫整合

### 拆分檔案規劃

#### 📂 `src/content/` 目錄重構

```
src/content/
├── content.js                     # 主入口點 (簡化至 80-100 行)
├── core/                          # 核心系統模組
│   ├── content-event-bus.js       # Content Script 事件系統 (~250 行)
│   ├── content-chrome-bridge.js   # Chrome API 橋接器 (~180 行)
│   └── content-lifecycle-manager.js # 生命週期管理 (~200 行)
├── extraction/                    # 資料提取模組
│   ├── content-extraction-coordinator.js # 提取流程協調器 (~280 行)
│   └── extraction-state-manager.js      # 提取狀態管理 (~150 行)
├── platform/                     # 平台適配模組
│   ├── platform-adapter-interface.js    # 抽象適配器介面 (~100 行)
│   └── readmoo/                          # Readmoo 特定實作
│       ├── readmoo-page-adapter.js      # 頁面適配器 (~300 行)
│       ├── readmoo-dom-parser.js        # DOM 解析器 (~250 行)
│       └── readmoo-data-sanitizer.js    # 資料清理器 (~180 行)
├── communication/                 # 通訊模組
│   ├── background-message-handler.js    # Background 訊息處理 (~150 行)
│   └── event-forwarding-manager.js      # 事件轉發管理 (~120 行)
└── utils/                         # 工具模組
    ├── page-detection-utils.js    # 頁面檢測工具 (~120 行)
    └── error-handling-utils.js    # 錯誤處理工具 (~100 行)
```

### 詳細模組設計

#### 🎯 **1. content.js (主入口點) - 80-100 行**

**核心職責**: 統一入口點和模組協調

```javascript
/**
 * Content Script 主入口點
 *
 * 負責功能：
 * - 模組載入和初始化協調
 * - 頁面檢測和條件性啟動
 * - 全域錯誤處理設置
 * - 模組間依賴注入管理
 */
```

**主要功能**:

- 模組載入順序控制
- 條件性初始化 (只在 Readmoo 頁面啟動)
- 全域錯誤捕獲設定
- 清理和卸載協調

#### 🎭 **2. core/content-event-bus.js - ~250 行**

**核心職責**: Content Script 內部事件系統

```javascript
/**
 * Content Script Event Bus
 *
 * 負責功能：
 * - 內部事件註冊、觸發和管理
 * - 優先級排序和異步處理
 * - 錯誤隔離和統計追蹤
 * - 效能監控和記憶體管理
 */
```

**主要功能**:

- 事件監聽器管理 (on/off/emit)
- 優先級事件處理
- 統計和除錯資訊
- 記憶體洩漏防護

#### 🌉 **3. core/content-chrome-bridge.js - ~180 行**

**核心職責**: Chrome API 通訊橋接

```javascript
/**
 * Chrome API 通訊橋接器
 *
 * 負責功能：
 * - 與 Background Service Worker 雙向通訊
 * - 訊息封裝和錯誤處理
 * - 通訊效能監控
 * - 失敗重試和回復機制
 */
```

**主要功能**:

- Background 訊息發送 (sendToBackground)
- 訊息格式標準化
- 通訊統計追蹤
- 錯誤處理和重試

#### 🔄 **4. core/content-lifecycle-manager.js - ~200 行**

**核心職責**: Content Script 生命週期管理

```javascript
/**
 * Content Script 生命週期管理器
 *
 * 負責功能：
 * - 頁面載入和卸載處理
 * - URL 變更監聽 (SPA 導航)
 * - 資源清理和記憶體管理
 * - 狀態同步和恢復
 */
```

**主要功能**:

- DOM 準備狀態檢測
- URL 變更觀察器
- beforeunload 清理處理
- 模組生命週期協調

#### 🎯 **5. extraction/content-extraction-coordinator.js - ~280 行**

**核心職責**: 資料提取流程協調

```javascript
/**
 * 資料提取流程協調器
 *
 * 負責功能：
 * - 事件驅動的提取流程管理
 * - 多並行提取流程支援
 * - 即時進度回報和錯誤處理
 * - 頁面類型檢測和相容性驗證
 */
```

**主要功能**:

- 提取流程狀態管理
- 平台適配器協調
- 進度事件發布
- 錯誤處理和恢復

#### 📊 **6. extraction/extraction-state-manager.js - ~150 行**

**核心職責**: 提取狀態和歷史管理

```javascript
/**
 * 提取狀態管理器
 *
 * 負責功能：
 * - 活動提取流程追蹤
 * - 提取歷史記錄管理
 * - 流程取消和清理
 * - 統計資料收集
 */
```

**主要功能**:

- 活動流程 Map 管理
- 歷史記錄維護
- 流程生命週期追蹤
- 記憶體限制控制

#### 🔌 **7. platform/platform-adapter-interface.js - ~100 行**

**核心職責**: 平台適配器抽象介面 (關鍵抽象化設計)

```javascript
/**
 * 平台適配器抽象介面
 *
 * 負責功能：
 * - 定義通用的平台適配器契約
 * - 抽象化頁面檢測、DOM 解析、資料提取介面
 * - 為未來多平台擴展提供統一接口
 * - 確保 Readmoo 實作符合通用標準
 */
```

**抽象方法定義**:

```javascript
// 必須實作的抽象方法
;-getPageType() - // 頁面類型檢測
  isExtractablePage() - // 可提取性檢查
  getBookElements() - // 書籍元素查找
  parseBookElement() - // 單一書籍解析
  extractAllBooks() - // 批次書籍提取
  getBookCount() // 書籍數量統計
```

#### 📚 **8. platform/readmoo/readmoo-page-adapter.js - ~300 行**

**核心職責**: Readmoo 平台頁面適配 (實作 PlatformAdapter 介面)

```javascript
/**
 * Readmoo 平台頁面適配器
 *
 * 負責功能：
 * - 實作平台適配器抽象介面
 * - Readmoo 特定的頁面類型檢測
 * - 書籍容器元素查找和選擇器管理
 * - 批次處理和效能優化
 */
```

**主要功能**:

- Readmoo 頁面類型檢測 (library/shelf/reader)
- CSS 選擇器配置管理
- 書籍元素批次查找
- 效能統計和監控

#### 🧩 **9. platform/readmoo/readmoo-dom-parser.js - ~250 行**

**核心職責**: Readmoo DOM 元素解析

```javascript
/**
 * Readmoo DOM 解析器
 *
 * 負責功能：
 * - 書籍元素的詳細解析
 * - 封面、標題、進度、類型資料提取
 * - 穩定 ID 生成算法
 * - 完整書籍資料物件建構
 */
```

**主要功能**:

- 單一書籍元素解析
- 多種 ID 生成策略
- 進度和類型資料提取
- 完整資料物件組裝

#### 🧹 **10. platform/readmoo/readmoo-data-sanitizer.js - ~180 行**

**核心職責**: Readmoo 資料清理和安全過濾

```javascript
/**
 * Readmoo 資料清理器
 *
 * 負責功能：
 * - 安全性過濾和 XSS 防護
 * - URL 和文字內容清理
 * - 資料格式標準化
 * - 惡意內容檢測和移除
 */
```

**主要功能**:

- URL 安全性檢查
- 文字內容清理
- 圖片URL驗證
- 惡意協議過濾

#### 📨 **11. communication/background-message-handler.js - ~150 行**

**核心職責**: Background 訊息處理

```javascript
/**
 * Background 訊息處理器
 *
 * 負責功能：
 * - chrome.runtime.onMessage 事件處理
 * - 訊息類型路由和分派
 * - 健康檢查和狀態回報
 * - 錯誤處理和回應管理
 */
```

**主要功能**:

- 訊息類型識別和路由
- 提取指令處理
- 健康狀態回報
- 錯誤回應格式化

#### 🔀 **12. communication/event-forwarding-manager.js - ~120 行**

**核心職責**: 事件轉發管理

```javascript
/**
 * 事件轉發管理器
 *
 * 負責功能：
 * - 內部事件到 Background 的橋接
 * - 重要事件的選擇性轉發
 * - 事件轉發配置管理
 * - 轉發統計和監控
 */
```

**主要功能**:

- 事件轉發規則配置
- 選擇性事件橋接
- 轉發效能統計
- 轉發錯誤處理

#### 🔍 **13. utils/page-detection-utils.js - ~120 行**

**核心職責**: 頁面檢測工具

```javascript
/**
 * 頁面檢測工具
 *
 * 負責功能：
 * - Readmoo 網域檢測
 * - 頁面類型識別 (library/shelf/reader)
 * - URL 和路徑分析
 * - 頁面準備狀態檢查
 */
```

**主要功能**:

- 網域名稱檢測
- URL 模式匹配
- 頁面準備狀態評估
- 檢測結果快取

#### ⚠️ **14. utils/error-handling-utils.js - ~100 行**

**核心職責**: 錯誤處理工具

```javascript
/**
 * 錯誤處理工具
 *
 * 負責功能：
 * - 全域錯誤捕獲和格式化
 * - 錯誤分類和優先級評估
 * - 錯誤報告和記錄機制
 * - 錯誤恢復策略
 */
```

**主要功能**:

- 全域錯誤監聽器設定
- 錯誤訊息標準化
- 錯誤上報機制
- Promise 拒絕處理

## 🔗 模組間依賴關係圖

### 依賴層級架構

```
Level 1 (基礎工具層):
├── utils/page-detection-utils.js
├── utils/error-handling-utils.js
└── platform/platform-adapter-interface.js

Level 2 (核心系統層):
├── core/content-event-bus.js
├── core/content-chrome-bridge.js
└── core/content-lifecycle-manager.js

Level 3 (平台實作層):
├── platform/readmoo/readmoo-data-sanitizer.js
├── platform/readmoo/readmoo-dom-parser.js
└── platform/readmoo/readmoo-page-adapter.js

Level 4 (業務邏輯層):
├── extraction/extraction-state-manager.js
├── extraction/content-extraction-coordinator.js
├── communication/event-forwarding-manager.js
└── communication/background-message-handler.js

Level 5 (協調整合層):
└── content.js (主入口點)
```

### 依賴關係詳細說明

#### 📋 **依賴注入策略**

- **Level 1-2**: 無外部依賴，提供基礎服務
- **Level 3**: 依賴 Level 1 的工具和介面定義
- **Level 4**: 依賴 Level 2-3 的核心服務和平台實作
- **Level 5**: 協調所有 Level 的模組，負責依賴注入

#### 🔄 **模組互動流程**

1. **初始化階段**: content.js → Core 模組 → Platform 模組
2. **提取階段**: Coordinator → Platform Adapter → DOM Parser → Sanitizer
3. **通訊階段**: Event Bus → Chrome Bridge → Background Handler

## 🎯 Readmoo 邏輯抽象化策略

### 抽象化目標

#### 1. **平台特定邏輯封裝**

- 將所有 Readmoo 特定的 DOM 選擇器、URL 模式、資料格式封裝在 `platform/readmoo/` 目錄
- 透過 `platform-adapter-interface.js` 定義通用契約
- 確保核心提取流程與平台實作完全解耦

#### 2. **通用介面設計**

- **頁面檢測介面**: 抽象化網站檢測和頁面類型識別
- **元素查找介面**: 抽象化 DOM 元素查找和批次處理
- **資料解析介面**: 抽象化書籍資料提取和格式化
- **資料清理介面**: 抽象化安全過濾和標準化流程

#### 3. **擴展準備架構**

```javascript
// 未來擴展範例 (不在 v1.0 實作範圍)
platform/
├── platform-adapter-interface.js  # 通用介面定義
├── readmoo/                        # 現有 Readmoo 實作
│   ├── readmoo-page-adapter.js
│   └── ...
├── kobo/                           # 未來 Kobo 實作
│   ├── kobo-page-adapter.js
│   └── ...
└── kindle/                         # 未來 Kindle 實作
    ├── kindle-page-adapter.js
    └── ...
```

### 抽象化實作細節

#### 🔌 **PlatformAdapter 介面定義**

```javascript
/**
 * 平台適配器抽象介面
 * 所有平台實作都必須遵循此契約
 */
class PlatformAdapterInterface {
  // 頁面檢測方法
  async getPageType() {
    throw new Error('Must implement')
  }
  async isExtractablePage() {
    throw new Error('Must implement')
  }
  async checkPageReady() {
    throw new Error('Must implement')
  }

  // 元素查找方法
  getBookElements() {
    throw new Error('Must implement')
  }
  getBookCount() {
    throw new Error('Must implement')
  }

  // 資料提取方法
  parseBookElement(element) {
    throw new Error('Must implement')
  }
  async extractAllBooks() {
    throw new Error('Must implement')
  }

  // 工具方法
  sanitizeData(data) {
    throw new Error('Must implement')
  }
  getStats() {
    throw new Error('Must implement')
  }
}
```

#### 📚 **Readmoo 實作適配**

```javascript
/**
 * Readmoo 平台適配器實作
 * 繼承抽象介面，實作 Readmoo 特定邏輯
 */
class ReadmooPageAdapter extends PlatformAdapterInterface {
  constructor(domParser, dataSanitizer) {
    super()
    this.domParser = domParser
    this.dataSanitizer = dataSanitizer
    this.selectors = READMOO_SELECTORS // Readmoo 特定選擇器
  }

  async getPageType() {
    // Readmoo 特定的頁面檢測邏輯
    // 檢查 readmoo.com 網域和 URL 路徑
  }

  getBookElements() {
    // 使用 Readmoo 特定的 CSS 選擇器
    // 處理多種備用選擇器策略
  }

  // ... 其他 Readmoo 特定實作
}
```

## ⚠️ 重構風險評估與緩解措施

### 🚨 **高風險項目**

#### 1. **功能回歸風險 - 高風險**

- **風險描述**: 拆分過程中可能導致現有 Readmoo 功能失效
- **影響範圍**: 使用者無法正常提取書籍資料
- **緩解措施**:
  - 建立完整的 E2E 測試套件驗證 Readmoo 功能
  - 採用漸進式重構，每次只拆分一個模組
  - 保留原始 content.js 作為回退版本
  - 每個拆分階段都進行完整功能驗證

#### 2. **事件系統整合風險 - 中高風險**

- **風險描述**: 事件系統拆分可能影響與 Background 的通訊
- **影響範圍**: 跨上下文通訊失效，進度回報中斷
- **緩解措施**:
  - 建立事件系統整合測試
  - 保持事件介面 100% 向後相容
  - 分階段驗證事件轉發機制
  - 建立通訊降級和錯誤恢復機制

#### 3. **記憶體洩漏風險 - 中風險**

- **風險描述**: 模組間循環依賴可能導致記憶體洩漏
- **影響範圍**: 長時間使用後瀏覽器記憶體不斷增長
- **緩解措施**:
  - 嚴格控制模組依賴方向（單向依賴）
  - 實作完整的生命週期清理機制
  - 建立記憶體使用監控和測試
  - 避免事件監聽器和觀察器洩漏

### 🔄 **中風險項目**

#### 4. **效能退化風險 - 中風險**

- **風險描述**: 模組化可能增加函數調用層級，影響效能
- **影響範圍**: 提取速度變慢，使用者體驗下降
- **緩解措施**:
  - 建立效能基準測試
  - 優化模組間調用路徑
  - 使用效能分析工具監控
  - 必要時合併關鍵路徑模組

#### 5. **開發複雜度增加 - 中風險**

- **風險描述**: 模組數量增加可能提高維護複雜度
- **影響範圍**: 開發效率降低，bug 追蹤困難
- **緩解措施**:
  - 建立清晰的模組文件和架構圖
  - 使用統一的命名和組織規範
  - 建立模組間介面契約
  - 提供完整的開發工具和除錯支援

### ✅ **低風險項目**

#### 6. **相容性影響 - 低風險**

- **風險描述**: Chrome Extension API 變更影響
- **緩解措施**: 保持 Manifest V3 合規，使用穩定 API

#### 7. **測試覆蓋不足 - 低風險**

- **風險描述**: 新模組缺乏測試覆蓋
- **緩解措施**: 每個新模組都建立 100% 測試覆蓋

### 🛡️ **風險監控機制**

#### 持續監控指標

- **功能正確性**: E2E 測試通過率維持 100%
- **效能表現**: 提取時間不超過基準線 +10%
- **記憶體使用**: 長時間使用記憶體增長 <50MB
- **錯誤率**: 提取失敗率維持在 <1%
- **通訊穩定性**: Background 通訊成功率 >99%

#### 預警機制

- 任何監控指標超出閾值立即暫停重構
- 建立自動化回退機制
- 設定每日效能回歸測試
- 使用者回饋監控和快速響應流程

## 🔧 實作優先順序建議

### 🏗️ **Phase 1: 基礎設施準備 (Week 1)**

#### Step 1.1: 建立抽象介面 (1-2 天)

- [ ] 建立 `platform/platform-adapter-interface.js`
- [ ] 定義通用平台適配器契約
- [ ] 建立工具模組 (`utils/` 目錄)
- [ ] 設定基礎測試框架

#### Step 1.2: 事件系統拆分 (2-3 天)

- [ ] 拆分 `core/content-event-bus.js`
- [ ] 拆分 `core/content-chrome-bridge.js`
- [ ] 建立完整的事件系統測試
- [ ] 驗證與 Background 通訊正常

#### Step 1.3: 生命週期管理拆分 (1-2 天)

- [ ] 拆分 `core/content-lifecycle-manager.js`
- [ ] 建立模組載入和清理機制
- [ ] 測試頁面導航和資源清理

### 🎯 **Phase 2: 平台抽象化實作 (Week 2)**

#### Step 2.1: Readmoo 適配器重構 (3-4 天)

- [ ] 建立 `platform/readmoo/` 目錄結構
- [ ] 拆分 DOM 解析器和資料清理器
- [ ] 實作 Readmoo 平台適配器
- [ ] 建立完整的 Readmoo 功能測試

#### Step 2.2: 提取系統重構 (2-3 天)

- [ ] 拆分提取協調器和狀態管理器
- [ ] 整合平台適配器介面
- [ ] 建立提取流程測試
- [ ] 驗證進度回報機制

### 🔗 **Phase 3: 通訊和整合 (Week 3)**

#### Step 3.1: 通訊模組重構 (2-3 天)

- [ ] 拆分 Background 訊息處理器
- [ ] 建立事件轉發管理器
- [ ] 測試跨上下文通訊
- [ ] 驗證錯誤處理機制

#### Step 3.2: 主入口點簡化 (1-2 天)

- [ ] 重構 `content.js` 為簡潔入口點
- [ ] 建立模組依賴注入機制
- [ ] 實作條件性初始化
- [ ] 完整整合測試

#### Step 3.3: 最終驗證和優化 (1-2 天)

- [ ] 執行完整的 E2E 測試套件
- [ ] 效能基準測試和優化
- [ ] 記憶體洩漏檢測和修正
- [ ] 使用者體驗驗證

### 📊 **成功標準檢查清單**

#### 功能完整性 (必須 100%)

- [ ] Readmoo 書庫頁面正常提取
- [ ] Readmoo 書架頁面正常提取
- [ ] 進度回報機制正常運作
- [ ] 錯誤處理和恢復正常
- [ ] Background 通訊穩定

#### 架構品質 (必須達成)

- [ ] 所有檔案符合單一職責原則
- [ ] 檔案大小控制在 300 行以內
- [ ] 模組依賴關係清晰且單向
- [ ] 抽象介面設計完整
- [ ] 程式碼覆蓋率維持 100%

#### 擴展準備 (架構支援)

- [ ] 平台適配器介面定義完整
- [ ] Readmoo 邏輯完全封裝
- [ ] 新平台擴展路徑清晰
- [ ] 介面契約文件完整
- [ ] 未來擴展影響最小化

## 📋 總結與建議

### 🎯 **核心成果預期**

透過此拆分設計，將實現：

1. **模組化架構**: 14 個職責明確的模組，每個控制在 100-300 行
2. **抽象化設計**: 完整的平台適配器介面，Readmoo 邏輯完全封裝
3. **擴展準備**: 為未來多平台支援建立清晰的架構基礎
4. **功能保障**: Readmoo 使用者體驗 100% 保持不變
5. **程式碼品質**: 符合單一職責原則，可測試性和可維護性大幅提升

### 🔄 **後續階段規劃**

#### v1.0 完成後的自然演進路徑:

1. **v1.1**: 基於抽象介面添加 Kobo 平台支援
2. **v1.2**: 擴展支援 Kindle 和博客來平台
3. **v1.3**: 實作跨平台資料同步和統一管理
4. **v2.0**: 進階分析功能和個人化推薦系統

### ⚠️ **關鍵成功因素**

1. **漸進式重構**: 避免大爆炸式變更，每次只專注一個模組
2. **測試優先**: 每個拆分階段都有完整測試保護
3. **向後相容**: 確保既有 Readmoo 功能零影響
4. **文件同步**: 及時更新架構文件和 API 說明
5. **效能監控**: 持續監控效能指標，預防退化

此設計規劃為 v1.0 重構提供了完整的技術路線圖，確保在提升架構品質的同時，完全保留現有功能的穩定性和使用者體驗。

---

**規劃完成時間**: 2025-01-16  
**預計實作時間**: 2-3 週 (按 Phase 1-3 執行)  
**風險等級**: 中等 (有完整緩解措施)  
**預期效益**: 架構品質大幅提升，為未來擴展奠定堅實基礎
