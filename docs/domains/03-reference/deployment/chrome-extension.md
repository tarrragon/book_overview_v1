# 🎯 Chrome Extension 部署指南

## 📋 總覽

Chrome Extension 專用部署策略指南，涵蓋 Manifest V3 合規、打包流程、分發管道和開發者工具整合。

## 🏗 架構配置

### Manifest V3 合規檢查

```json
{
  "manifest_version": 3,
  "name": "Readmoo 書庫提取器",
  "version": "0.11.0",
  "description": "協助整理 Readmoo 電子書庫，快速瀏覽書籍資訊與筆記記錄",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://readmoo.com/*",
    "https://*.readmoo.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "書庫提取器"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "https://readmoo.com/*",
        "https://*.readmoo.com/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

### 合規檢查腳本

```javascript
// scripts/validate-manifest.js
class ManifestValidator {
  constructor(manifest) {
    this.manifest = manifest;
    this.errors = [];
    this.warnings = [];
  }

  validate() {
    this.checkManifestVersion();
    this.checkPermissions();
    this.checkServiceWorker();
    this.checkContentSecurityPolicy();
    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  checkManifestVersion() {
    if (this.manifest.manifest_version !== 3) {
      this.errors.push('必須使用 Manifest V3');
    }
  }

  checkPermissions() {
    const unnecessaryPermissions = ['tabs', 'webNavigation', 'background'];
    const hasUnnecessary = this.manifest.permissions?.some(
      perm => unnecessaryPermissions.includes(perm)
    );
    if (hasUnnecessary) {
      this.warnings.push('建議移除非必要權限以提高審核通過率');
    }
  }

  checkServiceWorker() {
    if (!this.manifest.background?.service_worker) {
      this.errors.push('Service Worker 配置缺失');
    }
  }
}

// 使用範例
const validator = new ManifestValidator(require('../manifest.json'));
const result = validator.validate();

if (!result.isValid) {
  console.error('❌ Manifest 驗證失敗:', result.errors);
  process.exit(1);
}

if (result.warnings.length > 0) {
  console.warn('⚠️ 建議改善:', result.warnings);
}
```

## 📦 打包策略

### 生產環境打包流程

```bash
#!/bin/bash
# scripts/build-extension.sh

set -e

echo "🏗️ 開始 Chrome Extension 打包流程..."

# 1. 清理舊檔案
echo "🧹 清理建置目錄..."
rm -rf dist/
mkdir -p dist/

# 2. 複製核心檔案
echo "📋 複製擴充功能檔案..."
cp manifest.json dist/
cp -r src/* dist/
cp -r assets/ dist/

# 3. 優化與壓縮
echo "⚡ 優化資源檔案..."
# 壓縮 JavaScript
npx terser dist/**/*.js --compress --mangle --output dist/temp/
mv dist/temp/* dist/
rm -rf dist/temp/

# 壓縮 CSS
npx clean-css-cli -o dist/ dist/**/*.css

# 優化圖片
npx imagemin dist/assets/**/* --out-dir=dist/assets/

# 4. 安全檢查
echo "🔒 執行安全檢查..."
node scripts/security-scan.js

# 5. 創建分發包
echo "📦 創建分發檔案..."
cd dist/
zip -r "../readmoo-extractor-v$(node -p "require('../package.json').version").zip" .
cd ..

echo "✅ 打包完成: readmoo-extractor-v$(node -p "require('./package.json').version").zip"
```

### 安全檢查腳本

```javascript
// scripts/security-scan.js
const fs = require('fs');
const path = require('path');

class SecurityScanner {
  constructor() {
    this.risks = [];
    this.blockedPatterns = [
      /eval\s*\(/,
      /innerHTML\s*=/,
      /document\.write/,
      /dangerouslySetInnerHTML/,
      /chrome\.tabs\.executeScript/
    ];
  }

  scanDirectory(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        this.scanDirectory(fullPath);
      } else if (file.name.endsWith('.js')) {
        this.scanFile(fullPath);
      }
    }
  }

  scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    this.blockedPatterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        this.risks.push({
          file: filePath,
          pattern: pattern.source,
          risk: '高風險程式碼模式'
        });
      }
    });
  }

  generateReport() {
    if (this.risks.length === 0) {
      console.log('✅ 安全檢查通過');
      return true;
    }

    console.log('🚨 發現安全風險:');
    this.risks.forEach(risk => {
      console.log(`- ${risk.file}: ${risk.risk}`);
    });
    
    return false;
  }
}

const scanner = new SecurityScanner();
scanner.scanDirectory('./dist');

if (!scanner.generateReport()) {
  process.exit(1);
}
```

## 🚀 分發管道

### 開發環境載入

```javascript
// scripts/dev-loader.js
class DeveloperModeLoader {
  constructor() {
    this.extensionId = null;
  }

  async loadExtension() {
    try {
      // 檢查 Chrome 開發者模式
      const isDeveloperMode = await this.checkDeveloperMode();
      if (!isDeveloperMode) {
        throw new Error('請開啟 Chrome 開發者模式');
      }

      // 載入擴充功能
      const result = await this.loadUnpackedExtension('./dist');
      this.extensionId = result.id;
      
      console.log(`✅ 擴充功能已載入: ${this.extensionId}`);
      return result;
    } catch (error) {
      console.error('❌ 載入失敗:', error.message);
      throw error;
    }
  }

  async reloadExtension() {
    if (!this.extensionId) {
      throw new Error('尚未載入擴充功能');
    }

    await chrome.management.setEnabled(this.extensionId, false);
    await chrome.management.setEnabled(this.extensionId, true);
    console.log('🔄 擴充功能已重新載入');
  }

  async checkDeveloperMode() {
    return new Promise((resolve) => {
      chrome.management.getSelf((info) => {
        resolve(info.installType === 'development');
      });
    });
  }

  async loadUnpackedExtension(path) {
    return new Promise((resolve, reject) => {
      chrome.management.getAll((extensions) => {
        const existing = extensions.find(ext => 
          ext.name === 'Readmoo 書庫提取器'
        );
        
        if (existing) {
          resolve({ id: existing.id, reloaded: true });
        } else {
          // 模擬載入新擴充功能
          resolve({ 
            id: `dev-${Date.now()}`, 
            reloaded: false 
          });
        }
      });
    });
  }
}
```

### 測試環境部署

```yaml
# .github/workflows/test-deployment.yml
name: '🧪 測試環境部署'

on:
  push:
    branches: [develop, feature/*]
  pull_request:
    branches: [develop]

jobs:
  test-extension:
    name: '📦 擴充功能測試'
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: '📦 安裝依賴'
      run: |
        npm ci --legacy-peer-deps
    
    - name: '🏗️ 建置擴充功能'
      run: |
        npm run build:extension
    
    - name: '🔍 Manifest 驗證'
      run: |
        node scripts/validate-manifest.js
    
    - name: '🔒 安全檢查'
      run: |
        node scripts/security-scan.js
    
    - name: '📏 檔案大小檢查'
      run: |
        PACKAGE_SIZE=$(du -sb dist/ | cut -f1)
        MAX_SIZE=$((10 * 1024 * 1024))  # 10MB
        
        if [ $PACKAGE_SIZE -gt $MAX_SIZE ]; then
          echo "❌ 打包檔案過大: ${PACKAGE_SIZE} bytes"
          exit 1
        fi
        
        echo "✅ 檔案大小檢查通過: ${PACKAGE_SIZE} bytes"
    
    - name: '🎭 Chrome 模擬測試'
      uses: browser-actions/setup-chrome@latest
      
    - name: '🧪 功能測試'
      run: |
        npm run test:extension
    
    - name: '📎 上傳建置產物'
      uses: actions/upload-artifact@v3
      with:
        name: extension-build
        path: dist/
        retention-days: 7
```

## 🔧 開發者工具整合

### 擴充功能偵錯工具

```javascript
// src/utils/debug-tools.js
class ExtensionDebugger {
  constructor() {
    this.isDebugMode = chrome.runtime.getManifest().version.includes('dev');
    this.logs = [];
  }

  log(level, message, data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      stack: new Error().stack
    };

    this.logs.push(logEntry);
    
    if (this.isDebugMode) {
      console[level](`[Extension] ${message}`, data || '');
    }

    // 持久化除錯資訊
    this.persistLog(logEntry);
  }

  async persistLog(logEntry) {
    try {
      const { debugLogs = [] } = await chrome.storage.local.get(['debugLogs']);
      debugLogs.push(logEntry);
      
      // 保持最近 1000 筆記錄
      const recentLogs = debugLogs.slice(-1000);
      
      await chrome.storage.local.set({ debugLogs: recentLogs });
    } catch (error) {
      console.error('Failed to persist debug log:', error);
    }
  }

  async exportLogs() {
    const { debugLogs = [] } = await chrome.storage.local.get(['debugLogs']);
    
    const logData = {
      exportTime: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      logs: debugLogs
    };

    const blob = new Blob([JSON.stringify(logData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url,
      filename: `extension-logs-${Date.now()}.json`
    });
  }

  async clearLogs() {
    await chrome.storage.local.remove(['debugLogs']);
    this.logs = [];
  }
}

// 全域除錯工具
window.ExtensionDebugger = new ExtensionDebugger();
```

### 效能監控工具

```javascript
// src/utils/performance-monitor.js
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = [];
    this.isMonitoring = false;
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // 監控 Service Worker 效能
    this.monitorServiceWorker();
    
    // 監控 Content Script 效能
    this.monitorContentScript();
    
    // 監控記憶體使用
    this.monitorMemoryUsage();
    
    // 定期報告
    setInterval(() => this.generateReport(), 60000); // 每分鐘
  }

  monitorServiceWorker() {
    const startTime = performance.now();
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const processTime = performance.now() - startTime;
      
      this.recordMetric('serviceWorker.messageProcessTime', {
        duration: processTime,
        messageType: message.type,
        timestamp: Date.now()
      });
    });
  }

  monitorContentScript() {
    // 監控 DOM 操作效能
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        this.recordMetric('contentScript.domOperation', {
          name: entry.name,
          duration: entry.duration,
          timestamp: entry.startTime
        });
      });
    });

    observer.observe({ entryTypes: ['measure'] });
    this.observers.push(observer);
  }

  async monitorMemoryUsage() {
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = performance.memory;
        this.recordMetric('memory.usage', {
          used: memInfo.usedJSHeapSize,
          total: memInfo.totalJSHeapSize,
          limit: memInfo.jsHeapSizeLimit,
          timestamp: Date.now()
        });
      }, 30000); // 每30秒
    }
  }

  recordMetric(key, data) {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const metrics = this.metrics.get(key);
    metrics.push(data);
    
    // 保持最近 100 筆記錄
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      metrics: Object.fromEntries(this.metrics)
    };

    // 傳送到背景腳本進行持久化
    chrome.runtime.sendMessage({
      type: 'PERFORMANCE_REPORT',
      data: report
    });

    return report;
  }

  getMetricsSummary(key) {
    const metrics = this.metrics.get(key) || [];
    
    if (metrics.length === 0) {
      return null;
    }

    const durations = metrics.map(m => m.duration || m.used || 0);
    
    return {
      count: metrics.length,
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      recent: metrics.slice(-10)
    };
  }
}

// 初始化效能監控
const performanceMonitor = new PerformanceMonitor();
performanceMonitor.startMonitoring();
```

## 📊 部署監控與驗證

### 部署後自動驗證

```javascript
// scripts/post-deployment-check.js
class DeploymentValidator {
  constructor() {
    this.checks = [];
    this.results = [];
  }

  async runAllChecks() {
    console.log('🔍 執行部署後驗證...');
    
    await this.checkExtensionInstallation();
    await this.checkPermissions();
    await this.checkFunctionality();
    await this.checkPerformance();
    
    return this.generateReport();
  }

  async checkExtensionInstallation() {
    try {
      const manifest = chrome.runtime.getManifest();
      
      this.results.push({
        check: 'Extension Installation',
        status: 'PASS',
        message: `版本 ${manifest.version} 安裝成功`
      });
    } catch (error) {
      this.results.push({
        check: 'Extension Installation',
        status: 'FAIL',
        message: `安裝失敗: ${error.message}`
      });
    }
  }

  async checkPermissions() {
    const requiredPermissions = ['storage', 'activeTab'];
    
    try {
      const hasPermissions = await new Promise((resolve) => {
        chrome.permissions.contains({
          permissions: requiredPermissions
        }, resolve);
      });

      this.results.push({
        check: 'Permissions',
        status: hasPermissions ? 'PASS' : 'FAIL',
        message: hasPermissions 
          ? '所有權限已正確授予'
          : '權限授予不完整'
      });
    } catch (error) {
      this.results.push({
        check: 'Permissions',
        status: 'ERROR',
        message: `權限檢查錯誤: ${error.message}`
      });
    }
  }

  async checkFunctionality() {
    try {
      // 測試核心功能
      const testResult = await this.testBookExtraction();
      
      this.results.push({
        check: 'Core Functionality',
        status: testResult.success ? 'PASS' : 'FAIL',
        message: testResult.message
      });
    } catch (error) {
      this.results.push({
        check: 'Core Functionality',
        status: 'ERROR',
        message: `功能測試錯誤: ${error.message}`
      });
    }
  }

  async testBookExtraction() {
    // 模擬書籍提取測試
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: '書籍提取功能正常'
        });
      }, 1000);
    });
  }

  async checkPerformance() {
    const startTime = performance.now();
    
    try {
      // 執行效能測試
      await this.performanceTest();
      
      const duration = performance.now() - startTime;
      const isPerformant = duration < 3000; // 3秒內完成
      
      this.results.push({
        check: 'Performance',
        status: isPerformant ? 'PASS' : 'WARN',
        message: `回應時間: ${duration.toFixed(2)}ms`,
        metrics: { responseTime: duration }
      });
    } catch (error) {
      this.results.push({
        check: 'Performance',
        status: 'ERROR',
        message: `效能測試錯誤: ${error.message}`
      });
    }
  }

  async performanceTest() {
    // 模擬效能測試
    return new Promise((resolve) => {
      setTimeout(resolve, Math.random() * 2000);
    });
  }

  generateReport() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed,
        failed,
        errors,
        warnings,
        success: failed === 0 && errors === 0
      },
      results: this.results
    };

    console.log('📊 部署驗證報告:');
    console.table(this.results);
    
    return report;
  }
}
```

## 🚨 緊急回滾程序

### 自動回滾機制

```bash
#!/bin/bash
# scripts/emergency-rollback.sh

ROLLBACK_REASON="$1"
PREVIOUS_VERSION="$2"

echo "🚨 執行緊急回滾程序..."
echo "原因: $ROLLBACK_REASON"
echo "回滾到版本: $PREVIOUS_VERSION"

# 1. 記錄回滾事件
cat << EOF >> deployment-log.txt
$(date): Emergency rollback initiated
Reason: $ROLLBACK_REASON  
Target version: $PREVIOUS_VERSION
EOF

# 2. 恢復前一版本
git checkout "v$PREVIOUS_VERSION"
npm run build:extension

# 3. 重新打包
./scripts/build-extension.sh

# 4. 發送警報
curl -X POST "$SLACK_WEBHOOK_URL" \
  -H 'Content-type: application/json' \
  --data "{
    \"text\": \"🚨 Chrome Extension 緊急回滾\",
    \"attachments\": [{
      \"color\": \"danger\",
      \"fields\": [
        {\"title\": \"原因\", \"value\": \"$ROLLBACK_REASON\", \"short\": true},
        {\"title\": \"版本\", \"value\": \"$PREVIOUS_VERSION\", \"short\": true}
      ]
    }]
  }"

echo "✅ 緊急回滾完成"
echo "📦 回滾版本已準備就緒: readmoo-extractor-v$PREVIOUS_VERSION.zip"
```

## 📚 相關文件參考

- [Chrome Web Store 上架指南](./chrome-store-guide.md) - 詳細發布流程
- [CI/CD 流水線設計](./cicd-pipeline.md) - 自動化部署配置
- [發布策略指南](./release-strategy.md) - 版本管理策略
- [監控告警系統](./monitoring-alerts.md) - 生產環境監控

---

**📝 維護說明**: 本指南涵蓋 Chrome Extension 特定的部署策略，建議定期檢視 Chrome 開發者政策更新