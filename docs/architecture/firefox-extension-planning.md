# 🦊 Firefox Extension 跨平台支援規劃

**版本**: v0.7.0 規劃  
**建立日期**: 2025-08-06  
**目標**: Chrome Extension 跨平台擴展至 Firefox WebExtension

## 🎯 目標與動機

### 為什麼支援 Firefox？
1. **市場覆蓋**: 擴大使用者基數，涵蓋 Firefox 使用族群
2. **技術多樣性**: 降低對單一平台的依賴風險
3. **功能完整性**: Firefox 用戶也需要相同的書庫管理功能
4. **開源精神**: 與 Firefox 的開源理念相符

### 主要挑戰
- **API 差異**: Chrome Extensions vs Firefox WebExtensions
- **權限機制**: 不同的權限請求和管理方式
- **儲存系統**: 儲存 API 的實作差異
- **CSP 限制**: Content Security Policy 的不同限制
- **建置流程**: 需要支援雙平台的建置和部署

## 🏗 架構重構設計

### 跨平台架構原則
1. **核心邏輯分離**: 平台無關的業務邏輯獨立於平台特定代碼
2. **適配器模式**: 使用適配器模式處理平台差異
3. **統一介面**: 提供統一的 API 接口供核心邏輯使用
4. **配置驅動**: 透過配置文件區分平台特定設置

### 目標架構結構
```
src/
├── core/                    # 🎯 平台無關核心邏輯
│   ├── models/              # 資料模型
│   ├── services/            # 業務服務
│   ├── events/              # 事件系統
│   └── utils/               # 工具函數
├── platforms/               # 🔧 平台特定實現
│   ├── chrome/              # Chrome Extension 特有
│   │   ├── manifest.json    # Manifest V3
│   │   ├── background/      # Service Worker
│   │   ├── storage/         # Chrome 儲存適配器
│   │   └── permissions/     # Chrome 權限管理
│   └── firefox/             # Firefox WebExtension 特有
│       ├── manifest.json    # WebExtension Manifest
│       ├── background/      # Background Script
│       ├── storage/         # Firefox 儲存適配器
│       └── permissions/     # Firefox 權限管理
├── shared/                  # 🤝 共用組件
│   ├── ui/                  # 用戶界面組件
│   ├── content/             # Content Scripts
│   ├── popup/               # Popup 界面
│   └── extractors/          # 資料提取器
└── adapters/                # 🔄 平台適配層
    ├── storage-adapter.js   # 儲存系統適配器
    ├── runtime-adapter.js   # 運行時適配器
    ├── tabs-adapter.js      # 分頁管理適配器
    └── permissions-adapter.js # 權限適配器
```

## 🔍 平台差異分析

### Manifest 差異
```javascript
// Chrome Extension (Manifest V3)
{
  "manifest_version": 3,
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  },
  "permissions": ["storage", "activeTab"]
}

// Firefox WebExtension (Manifest V2/V3)
{
  "manifest_version": 2,
  "background": {
    "scripts": ["background.js"],
    "persistent": false
  },
  "browser_action": {
    "default_popup": "popup.html"
  },
  "permissions": ["storage", "activeTab"]
}
```

### API 差異處理
```javascript
// 統一 API 適配器
class RuntimeAdapter {
  constructor() {
    this.browser = this.getBrowserAPI();
  }
  
  getBrowserAPI() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome;
    }
    if (typeof browser !== 'undefined' && browser.runtime) {
      return browser;
    }
    throw new Error('No supported browser API found');
  }
  
  async sendMessage(message) {
    if (this.browser === chrome) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, resolve);
      });
    } else {
      return this.browser.runtime.sendMessage(message);
    }
  }
}
```

### 儲存系統適配
```javascript
class StorageAdapter {
  constructor(platform) {
    this.platform = platform;
    this.api = platform === 'chrome' ? chrome.storage : browser.storage;
  }
  
  async save(key, data) {
    try {
      if (this.platform === 'chrome') {
        return new Promise((resolve, reject) => {
          this.api.local.set({[key]: data}, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      } else {
        return this.api.local.set({[key]: data});
      }
    } catch (error) {
      throw new StorageError(`Failed to save ${key}`, error);
    }
  }
}
```

## 🔄 重構階段規劃

### Phase 1: 架構重構 (v0.7.0)
**目標**: 分離核心邏輯與平台特定代碼

#### TDD 循環 #43: 平台適配器基礎架構
**預估時間**: 3-4 天

**🔴 Red 階段**:
```javascript
// tests/unit/adapters/platform-adapter.test.js
describe('PlatformAdapter', () => {
  test('應該正確識別運行平台', () => {
    const adapter = new PlatformAdapter();
    expect(['chrome', 'firefox']).toContain(adapter.getPlatform());
  });
  
  test('應該提供統一的儲存接口', async () => {
    const adapter = new PlatformAdapter();
    await adapter.storage.save('test', 'data');
    const result = await adapter.storage.load('test');
    expect(result).toBe('data');
  });
});
```

**🟢 Green 階段**:
- 實現基礎平台適配器
- 統一儲存、運行時、權限接口
- 平台檢測和初始化邏輯

**🔵 Refactor 階段**:
- 優化適配器設計模式
- 改善錯誤處理機制
- 加強平台相容性測試

#### TDD 循環 #44: 核心邏輯平台無關化
**預估時間**: 2-3 天

**🔴 Red 階段**:
```javascript
// tests/integration/cross-platform.test.js
describe('CrossPlatform', () => {
  test('核心邏輯應該在不同平台正常運作', async () => {
    // 模擬 Chrome 環境
    const chromeCore = new BookDataExtractor('chrome');
    const chromeResult = await chromeCore.extractBooks();
    
    // 模擬 Firefox 環境
    const firefoxCore = new BookDataExtractor('firefox');
    const firefoxResult = await firefoxCore.extractBooks();
    
    expect(chromeResult).toEqual(firefoxResult);
  });
});
```

**🟢 Green 階段**:
- 重構核心類別移除平台依賴
- 注入平台適配器依賴
- 確保業務邏輯平台無關

**🔵 Refactor 階段**:
- 依賴注入優化
- 介面設計改善
- 測試覆蓋率提升

### Phase 2: Firefox 特定實現 (v0.7.1)
**目標**: 實現 Firefox WebExtension 特定功能

#### TDD 循環 #45: Firefox Manifest 和背景腳本
**預估時間**: 2-3 天

**🔴 Red 階段**:
```javascript
// tests/integration/firefox-manifest.test.js
describe('Firefox Manifest', () => {
  test('Firefox manifest 應該正確載入', () => {
    const manifest = require('../../platforms/firefox/manifest.json');
    expect(manifest.manifest_version).toBe(2);
    expect(manifest.background.scripts).toContain('background.js');
  });
});
```

**🟢 Green 階段**:
- 建立 Firefox 專用 manifest.json
- 實現 Firefox 背景腳本
- 配置 Firefox 特有權限

**🔵 Refactor 階段**:
- Manifest 版本相容性處理
- 背景腳本效能優化
- 權限最小化原則

#### TDD 循環 #46: Firefox 儲存和權限
**預估時間**: 2-3 天

**🔴 Red 階段**:
```javascript
// tests/unit/firefox/firefox-storage.test.js
describe('FirefoxStorage', () => {
  test('應該正確處理 Firefox 儲存 API', async () => {
    const storage = new FirefoxStorageAdapter();
    await storage.save('books', testData);
    const result = await storage.load('books');
    expect(result).toEqual(testData);
  });
});
```

**🟢 Green 階段**:
- 實現 Firefox 儲存適配器
- Firefox 權限管理系統
- 錯誤處理和降級機制

**🔵 Refactor 階段**:
- 儲存效能優化
- 權限請求最佳化
- 錯誤恢復機制

### Phase 3: 統一建置系統 (v0.7.2)
**目標**: 建立支援雙平台的建置和部署流程

#### TDD 循環 #47: 多平台建置配置
**預估時間**: 2-3 天

**🔴 Red 階段**:
```javascript
// tests/build/build-system.test.js
describe('BuildSystem', () => {
  test('應該能正確建置 Chrome 版本', async () => {
    await buildForPlatform('chrome');
    expect(fs.existsSync('dist/chrome/manifest.json')).toBe(true);
  });
  
  test('應該能正確建置 Firefox 版本', async () => {
    await buildForPlatform('firefox');
    expect(fs.existsSync('dist/firefox/manifest.json')).toBe(true);
  });
});
```

**🟢 Green 階段**:
- 建立多平台建置腳本
- 平台特定資源處理
- 自動化測試和驗證

**🔵 Refactor 階段**:
- 建置流程最佳化
- 並行建置支援
- CI/CD 整合

## 📦 建置和部署策略

### 建置指令擴展
```bash
# 現有指令
npm run build:dev          # Chrome 開發版本
npm run build:prod         # Chrome 生產版本

# 新增指令
npm run build:firefox:dev  # Firefox 開發版本  
npm run build:firefox:prod # Firefox 生產版本
npm run build:all          # 同時建置雙平台
npm run test:cross-platform # 跨平台測試
```

### 部署流程
```bash
# 自動化部署腳本
npm run deploy:chrome       # 部署到 Chrome Web Store
npm run deploy:firefox      # 部署到 Firefox Add-ons
npm run deploy:all          # 同時部署雙平台
```

### 版本管理策略
- **統一版本號**: 兩平台使用相同版本號
- **平台標識**: 在 manifest 中添加平台識別
- **功能標記**: 標註平台特有功能差異

## 🧪 測試策略

### 跨平台測試框架
```javascript
// 統一測試環境
class CrossPlatformTestSuite {
  async runTests(platform) {
    const adapter = new PlatformAdapter(platform);
    const testCases = this.getTestCases();
    
    for (const testCase of testCases) {
      await this.runTestCase(testCase, adapter);
    }
  }
  
  async runTestCase(testCase, adapter) {
    // 在指定平台環境下運行測試
    const result = await testCase.run(adapter);
    expect(result).toBeTruthy();
  }
}
```

### 測試覆蓋目標
- **核心邏輯**: 100% 跨平台測試覆蓋
- **平台適配器**: 95% 測試覆蓋
- **整合測試**: 85% 跨平台整合測試
- **E2E 測試**: 雙平台端對端測試

## 📊 開發時程

### 總體規劃 (6-8 週)
- **Week 1-2**: 架構重構和平台適配器
- **Week 3-4**: Firefox 特定實現和測試
- **Week 5-6**: 統一建置系統和 CI/CD
- **Week 7-8**: 整合測試和部署準備

### 里程碑檢查點
- **v0.7.0**: 架構重構完成，Chrome 功能不受影響
- **v0.7.1**: Firefox 基礎功能實現，雙平台功能一致
- **v0.7.2**: 建置系統完成，可同時部署雙平台

## 🚨 風險管理

### 技術風險
- **API 不相容**: 深入研究和測試平台 API 差異
- **效能影響**: 監控重構對現有功能的效能影響
- **測試複雜度**: 建立完善的跨平台測試框架

### 時程風險
- **範圍蔓延**: 嚴格控制功能範圍，專注核心移植
- **測試時間**: 預留充足時間進行跨平台測試
- **相依性**: 確保核心功能穩定後才開始平台擴展

### 品質風險
- **功能一致性**: 確保兩平台功能完全一致
- **使用者體驗**: 維持相同的使用者體驗品質
- **安全性**: 遵循兩平台的安全最佳實踐

---

**架構負責人**: 開發團隊  
**開始條件**: v0.6.x 書籍元資料增強完成  
**預計完成**: v0.7.2 跨平台支援上線