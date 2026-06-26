# 🏪 Chrome Store 上架指南

> **第三層參考文件** - 完整的 Chrome Web Store 上架流程與維護指南  
> **目標讀者**: DevOps 工程師、發布經理、專案維護者  
> **文件類型**: 發布作業手冊  

本文件提供 Readmoo 書庫提取器 Chrome Extension 的完整上架流程，涵蓋準備、提交、審核、維護等各階段作業指南。

## 🎯 上架流程總覽

### 上架階段劃分
- **準備階段**: 程式碼準備、資產製作、文件整理
- **提交階段**: 開發者帳號設置、Extension 套件上傳
- **審核階段**: Google 審核流程、問題回應處理
- **維護階段**: 版本更新、用戶回饋、效能監控

### 時間規劃
```
┌─────────────────────────────────────┐
│          上架時程規劃               │
├─────────────────────────────────────┤
│  準備階段: 1-2 天                  │
│  - 程式碼最終檢查                   │
│  - 商店資產製作                     │
│  - 隱私政策準備                     │
├─────────────────────────────────────┤
│  提交階段: 1 天                     │
│  - Developer Dashboard 設置         │
│  - ZIP 檔案上傳                     │
│  - 商店資訊填寫                     │
├─────────────────────────────────────┤
│  審核階段: 1-7 天 (Google 決定)     │
│  - 自動化檢查                       │
│  - 人工審核 (如需要)                │
│  - 政策合規檢查                     │
└─────────────────────────────────────┘
```

## 🛠️ 準備階段作業

### 程式碼最終檢查

#### 生產版本建置驗證
```bash
# 執行完整的生產建置流程
npm run build:prod

# 驗證建置產物
ls -la build/production/

# 檢查 manifest.json 版本
cat build/production/manifest.json | grep '"version"'

# 執行最終測試
npm run test:e2e:prod
```

#### 版本號確認
```javascript
// package.json 中的版本號
{
  "version": "1.0.0",  // 主版本號
  "name": "book-overview"
}

// manifest.json 中的版本號 (自動同步)
{
  "version": "1.0.0",
  "version_name": "1.0.0 - 首次發布版本"
}
```

#### 必要檔案檢查清單
- [ ] `build/production/manifest.json` - Extension 設定檔
- [ ] `build/production/background/` - Service Worker 檔案
- [ ] `build/production/content/` - Content Scripts
- [ ] `build/production/popup/` - Popup 介面檔案
- [ ] `build/production/assets/` - 圖示和靜態資源
- [ ] `build/production/icons/` - 各尺寸圖示檔案

### Chrome Web Store 資產準備

#### 必要圖示檔案
```bash
# 建立圖示檔案結構
mkdir -p store-assets/icons

# 必要圖示尺寸
store-assets/
├── icons/
│   ├── icon-16.png    # Extension 小圖示
│   ├── icon-48.png    # Extension 中圖示
│   ├── icon-128.png   # Chrome Web Store 圖示
│   └── icon-512.png   # Chrome Web Store 大圖示
├── screenshots/
│   ├── screenshot-1.png  # 1280x800 或 640x400
│   ├── screenshot-2.png
│   └── screenshot-3.png
└── promotional/
    ├── tile-small.png    # 440x280
    └── tile-marquee.png  # 1400x560
```

#### 商店截圖製作
```javascript
// 自動化截圖腳本
const puppeteer = require('puppeteer');

async function generateStoreScreenshots() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--load-extension=./build/production',
      '--disable-extensions-except=./build/production'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  // 截圖 1: Extension Popup
  await page.goto('chrome://extensions/');
  await page.screenshot({ 
    path: 'store-assets/screenshots/screenshot-1.png',
    clip: { x: 0, y: 0, width: 1280, height: 800 }
  });
  
  // 截圖 2: Readmoo 網站使用情境
  await page.goto('https://readmoo.com');
  await page.screenshot({ 
    path: 'store-assets/screenshots/screenshot-2.png'
  });
  
  await browser.close();
}
```

### 法務文件準備

#### 隱私權政策
```markdown
# Readmoo 書庫提取器 - 隱私權政策

## 資料收集說明
本 Extension 僅在本地處理資料，不會上傳任何個人資訊至外部伺服器。

## 權限使用說明
- **activeTab**: 僅在用戶主動點擊 Extension 時存取當前分頁
- **storage**: 僅儲存用戶設定至本地 Chrome 儲存空間
- **host permissions**: 僅限 readmoo.com 相關域名

## 資料安全
所有處理均在用戶本地裝置進行，不涉及雲端資料傳輸。
```

#### 使用條款
```markdown
# 使用條款

## 適用範圍
本 Extension 僅供個人合法使用，協助整理個人已購買的電子書資訊。

## 使用限制
- 不得用於商業用途
- 不得繞過版權保護
- 僅限整理個人已購買內容
```

## 📤 提交階段作業

### Chrome Web Store Developer Dashboard 設置

#### 開發者帳號註冊
1. 前往 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. 使用 Google 帳號登入
3. 繳交一次性註冊費用 $5 USD
4. 驗證身份資訊

#### Extension 基本資訊設定
```javascript
// Chrome Web Store 設定資訊
const storeConfig = {
  name: 'Readmoo 書庫提取器',
  description: '協助整理 Readmoo 電子書庫，快速瀏覽書籍資訊與筆記記錄',
  category: 'Productivity',
  language: 'zh-TW',
  regions: ['TW', 'HK', 'SG'], // 限制發布地區
  pricing: 'free',
  
  // SEO 關鍵字
  keywords: [
    'readmoo', '電子書', '書庫管理', '閱讀工具',
    'ebook', 'reading', 'productivity'
  ]
};
```

### ZIP 檔案準備與上傳

#### 建立發布 ZIP 檔案
```bash
# 建立乾淨的發布目錄
rm -rf dist/release
mkdir -p dist/release

# 複製生產建置檔案
cp -r build/production/* dist/release/

# 移除開發相關檔案
rm -f dist/release/sourcemap/*
rm -f dist/release/.DS_Store
find dist/release -name '*.map' -delete

# 建立 ZIP 檔案
cd dist/release
zip -r ../book-overview-v1.0.0.zip .
cd ../..

# 驗證 ZIP 檔案大小 (< 2MB 建議)
ls -lh dist/book-overview-v1.0.0.zip
```

#### 上傳前檢查清單
```bash
# 自動化檢查腳本
#!/bin/bash

ZIP_FILE="dist/book-overview-v1.0.0.zip"

echo "🔍 檢查 ZIP 檔案..."

# 檢查檔案大小
FILE_SIZE=$(stat -f%z "$ZIP_FILE" 2>/dev/null || stat -c%s "$ZIP_FILE")
if [ $FILE_SIZE -gt 2097152 ]; then  # 2MB
  echo "⚠️  警告: 檔案大小 $(($FILE_SIZE/1024))KB 超過建議上限"
fi

# 檢查必要檔案
unzip -l "$ZIP_FILE" | grep -E "(manifest.json|background/|content/|popup/)"

# 檢查不應包含的檔案
FORBIDDEN=$(unzip -l "$ZIP_FILE" | grep -E "(\.map|\.DS_Store|node_modules|test)")
if [ ! -z "$FORBIDDEN" ]; then
  echo "❌ 發現不應包含的檔案:"
  echo "$FORBIDDEN"
  exit 1
fi

echo "✅ ZIP 檔案檢查通過"
```

### 商店頁面資訊填寫

#### 詳細說明撰寫
```markdown
## 功能特色

🔸 **快速書庫概覽**: 一鍵顯示所有已購買電子書列表  
🔸 **書籍詳細資訊**: 查看書籍封面、作者、出版資訊  
🔸 **筆記與劃線**: 整理個人閱讀筆記和重點劃線  
🔸 **本地資料處理**: 所有操作均在本地進行，保護隱私安全  
🔸 **輕量快速**: 體積小巧，不影響瀏覽器效能  

## 使用方式

1. 前往 Readmoo 網站並登入帳號
2. 點擊瀏覽器工具列的 Extension 圖示
3. 選擇「同步書庫」開始整理書籍資訊
4. 瀏覽整理後的書庫內容

## 技術規格

- 支援 Chrome 89+ 版本
- 使用 Manifest V3 標準
- 僅需最小權限運行
- 完全離線作業
```

#### 版本更新說明範本
```markdown
# v1.0.0 更新說明

## 🆕 新功能
- 首次發布 Readmoo 書庫提取器
- 支援完整書庫同步功能
- 本地資料安全處理

## 🛠️ 技術改進
- 採用 Manifest V3 標準
- 優化記憶體使用效率
- 加強錯誤處理機制

## 🔒 安全性
- 僅在本地處理資料
- 不收集用戶個人資訊
- 符合 Chrome Web Store 政策
```

## 🔍 審核階段處理

### Google 審核流程理解

#### 自動化檢查項目
```javascript
// Chrome Web Store 自動檢查重點
const autoChecks = {
  security: {
    'malware_scan': '惡意軟體掃描',
    'code_obfuscation': '程式碼混淆檢查',
    'external_requests': '外部請求驗證'
  },
  
  policy_compliance: {
    'permissions_usage': '權限使用合理性',
    'privacy_policy': '隱私權政策完整性',
    'content_guidelines': '內容指引遵循'
  },
  
  technical_standards: {
    'manifest_v3': 'Manifest V3 合規性',
    'performance': '效能標準',
    'compatibility': '相容性測試'
  }
};
```

#### 人工審核觸發條件
- Extension 涉及敏感權限 (如 `webRequest`, `cookies`)
- 首次發布的開發者帳號
- 使用者檢舉過多的類似 Extension
- 商業用途或付費功能

### 常見審核問題與解決方案

#### 權限過度申請
**問題**: "Extension requests unnecessary permissions"

```javascript
// 修正前 - 過度申請權限
{
  "permissions": [
    "tabs",           // 不必要
    "storage", 
    "webRequest",     // 過度權限
    "<all_urls>"      // 過廣域名
  ]
}

// 修正後 - 最小權限原則
{
  "permissions": [
    "activeTab",      // 僅當前分頁
    "storage"
  ],
  "host_permissions": [
    "https://readmoo.com/*",
    "https://*.readmoo.com/*"
  ]
}
```

#### 隱私權政策不完整
**問題**: "Privacy policy missing or incomplete"

**解決方案**: 確保隱私權政策涵蓋所有權限使用說明
```markdown
## 權限使用詳細說明

### activeTab 權限
- **用途**: 僅在用戶主動點擊 Extension 時存取當前 Readmoo 頁面
- **資料處理**: 提取書籍資訊並在本地處理，不上傳至任何伺服器
- **安全保護**: 離開 Readmoo 網站後自動失效

### storage 權限  
- **用途**: 儲存用戶個人設定和書庫資訊至 Chrome 本地儲存
- **資料範圍**: 僅包含用戶選擇同步的書籍元資料
- **隱私保護**: 所有資料僅存於用戶裝置，不進行雲端同步
```

#### 功能描述不清楚
**問題**: "Extension functionality unclear"

**解決方案**: 提供詳細的使用說明和截圖
```markdown
## 詳細功能說明

### 主要功能: 書庫整理
1. **觸發方式**: 用戶在 Readmoo 網站點擊 Extension 圖示
2. **處理流程**: 讀取當前頁面的書籍資訊
3. **資料輸出**: 在 Extension popup 中顯示整理後的書單
4. **儲存機制**: 用戶可選擇將書單儲存至本地

### 次要功能: 閱讀紀錄
- 協助使用者追蹤閱讀進度
- 整理個人筆記和劃線
- 提供書籍評分和標籤功能
```

### 審核回應範本

#### 回應權限質疑
```markdown
感謝審核團隊的回饋。關於權限使用說明如下：

**activeTab 權限必要性**:
- 本 Extension 專為 Readmoo 用戶設計，需要讀取 Readmoo 網頁上的書籍資訊
- 使用 activeTab 而非 tabs 權限，確保僅在用戶主動觸發時存取
- 符合最小權限原則，提升用戶隐私保護

**storage 權限必要性**:
- 儲存用戶個人書庫整理結果和偏好設定
- 所有資料僅存於用戶本地 Chrome 儲存空間
- 不涉及任何雲端上傳或第三方資料分享

附上更新後的隱私權政策連結: [隱私權政策 URL]
```

#### 回應功能質疑
```markdown
感謝提供寶貴意見，現補充功能說明：

**核心價值**: 
本 Extension 解決 Readmoo 用戶「書庫分散難以統整」的痛點

**具體使用場景**:
1. 用戶在 Readmoo 各個頁面瀏覽時，無法快速查看完整書庫
2. 本 Extension 提供統一介面，讓用戶快速瀏覽已購買書籍
3. 協助整理個人閱讀筆記，提升閱讀體驗

**與 Readmoo 官方功能的差異**:
- 專注於個人書庫管理，非重複既有功能
- 提供離線瀏覽能力
- 個人化整理和標籤功能

附上實際使用截圖和影片示範: [Demo URL]
```

## 🚀 維護階段作業

### 版本更新管理

#### 自動化更新腳本
```bash
#!/bin/bash
# scripts/release-update.sh

VERSION=$1
if [ -z "$VERSION" ]; then
  echo "請提供版本號: ./release-update.sh 1.0.1"
  exit 1
fi

echo "🚀 準備發布版本 $VERSION"

# 1. 更新版本號
npm version $VERSION --no-git-tag-version

# 2. 建置生產版本
npm run build:prod

# 3. 執行測試
npm run test:e2e:prod
if [ $? -ne 0 ]; then
  echo "❌ 測試失敗，取消發布"
  exit 1
fi

# 4. 建立發布 ZIP
./scripts/create-release-zip.sh $VERSION

# 5. 產生更新說明
echo "📝 請手動更新 Chrome Web Store 的版本說明:"
echo "- 修正錯誤: [具體說明]"
echo "- 新增功能: [具體說明]"
echo "- 效能改善: [具體說明]"

echo "✅ 版本 $VERSION 準備完成，請至 Developer Dashboard 上傳"
```

#### 版本發布檢查清單
```markdown
## 版本發布前檢查 (Pre-release Checklist)

### 程式碼品質
- [ ] 所有測試通過 (100% pass rate)
- [ ] 程式碼覆蓋率 > 90%
- [ ] ESLint 檢查無錯誤
- [ ] 生產建置成功

### 功能驗證
- [ ] 在 3 種不同 Chrome 版本測試
- [ ] 測試 Readmoo 網站各主要頁面
- [ ] 驗證 Extension popup 正常顯示
- [ ] 確認本地儲存功能正常

### 合規檢查
- [ ] 權限使用符合最小原則
- [ ] 隱私權政策更新到位
- [ ] 版本號正確更新
- [ ] CHANGELOG.md 記錄完整

### 發布準備
- [ ] ZIP 檔案大小 < 2MB
- [ ] 商店截圖為最新版本
- [ ] 版本說明撰寫完成
- [ ] 回滾計劃準備就緒
```

### 用戶回饋處理

#### 回饋分類系統
```javascript
// 用戶回饋分類與優先級
const feedbackCategories = {
  critical: {
    priority: 1,
    examples: ['Extension 無法啟動', '資料遺失', '安全性問題'],
    response_time: '24小時內',
    action: '立即修正並發布緊急更新'
  },
  
  high: {
    priority: 2, 
    examples: ['功能異常', '相容性問題', '效能問題'],
    response_time: '72小時內',
    action: '下個版本修正'
  },
  
  medium: {
    priority: 3,
    examples: ['介面改善建議', '新功能請求', '使用體驗'],
    response_time: '1週內',
    action: '評估後納入開發計劃'
  },
  
  low: {
    priority: 4,
    examples: ['一般問題', '使用教學', '建議'],
    response_time: '2週內', 
    action: '提供解答或說明'
  }
};
```

#### 標準回應範本
```markdown
## Critical 問題回應範本

感謝您的回饋，我們已確認此問題並將其標記為高優先級。

**問題確認**: [具體問題描述]
**影響範圍**: [受影響的功能或使用者]
**預估修復時間**: 24-48小時
**臨時解決方案**: [如有可提供]

我們將在修復完成後立即發布更新版本，並透過 Extension 更新機制通知所有使用者。

---

## Medium 問題回應範本

感謝您提供的改善建議！

**建議評估**: 我們認為這是個很好的建議，能夠提升使用者體驗
**實作計劃**: 已納入 v[下個版本] 開發計劃
**預估完成**: [時程估計]

如果您有其他想法或建議，歡迎隨時與我們分享。
```

### Chrome Web Store 分析數據

#### 關鍵指標監控
```javascript
// Chrome Web Store 分析指標
const storeMetrics = {
  usage: {
    'daily_active_users': '每日活躍用戶',
    'weekly_active_users': '每週活躍用戶', 
    'install_rate': '安裝率',
    'uninstall_rate': '解除安裝率'
  },
  
  quality: {
    'user_rating': '用戶評分 (目標: > 4.0)',
    'review_sentiment': '評論情感分析',
    'crash_rate': '崩潰率 (目標: < 1%)',
    'performance_score': '效能分數'
  },
  
  business: {
    'search_ranking': '搜尋排名',
    'category_ranking': '分類排名',
    'organic_install': '自然安裝數',
    'referral_source': '安裝來源分析'
  }
};

// 定期監控腳本
function generateMetricsReport() {
  const report = {
    date: new Date().toISOString().split('T')[0],
    metrics: {
      users: getActiveUserCount(),
      rating: getCurrentRating(),
      reviews: getRecentReviews(),
      performance: getPerformanceMetrics()
    },
    alerts: identifyAnomalies(),
    recommendations: generateActionItems()
  };
  
  return report;
}
```

#### 效能監控整合
```javascript
// 與內建效能監控系統整合
class ChromeStoreMonitoring {
  constructor() {
    this.metricsCollector = new MetricsCollector();
    this.alertThresholds = {
      crash_rate: 0.01,      // 1%
      response_time: 1000,   // 1秒
      memory_usage: 50,      // 50MB
      user_rating: 4.0       // 4.0星
    };
  }
  
  async collectStoreMetrics() {
    // 從 Chrome Web Store Developer API 收集數據
    const storeData = await this.fetchStoreAnalytics();
    
    // 與本地效能數據結合
    const localMetrics = await this.metricsCollector.getMetrics();
    
    // 產生綜合分析報告
    return this.correlateMetrics(storeData, localMetrics);
  }
  
  checkAlerts(metrics) {
    const alerts = [];
    
    if (metrics.crash_rate > this.alertThresholds.crash_rate) {
      alerts.push({
        type: 'critical',
        message: `崩潰率過高: ${metrics.crash_rate * 100}%`,
        action: '立即調查並修復'
      });
    }
    
    if (metrics.user_rating < this.alertThresholds.user_rating) {
      alerts.push({
        type: 'warning',
        message: `用戶評分偏低: ${metrics.user_rating}`,
        action: '分析負面評論並改善'
      });
    }
    
    return alerts;
  }
}
```

## 🚨 緊急處理程序

### 緊急下架處理

#### 觸發條件
- Chrome Web Store 政策違規通知
- 嚴重安全漏洞發現
- 用戶資料洩漏風險
- 惡意程式碼植入

#### 緊急回應腳本
```bash
#!/bin/bash
# scripts/emergency-response.sh

REASON=$1
if [ -z "$REASON" ]; then
  echo "請提供下架原因: security/policy/bug/other"
  exit 1
fi

echo "🚨 啟動緊急回應程序: $REASON"

# 1. 立即備份當前狀態
git tag emergency-backup-$(date +%Y%m%d%H%M%S)
git push origin --tags

# 2. 記錄緊急事件
echo "$(date): Emergency response triggered - $REASON" >> emergency.log

# 3. 通知相關人員 (如果有配置)
if [ -f "scripts/notify-team.sh" ]; then
  ./scripts/notify-team.sh "緊急事件: Extension 需要立即處理 - $REASON"
fi

# 4. 準備緊急修復分支
git checkout -b emergency-fix-$(date +%Y%m%d)

echo "✅ 緊急回應程序完成，請手動至 Chrome Web Store 下架 Extension"
echo "📝 下架後請立即開始修復作業"
```

### 快速修復流程
```markdown
## 緊急修復檢查清單

### 立即行動 (15分鐘內)
- [ ] 確認問題範圍和影響
- [ ] 在 Chrome Web Store 暫停發布
- [ ] 建立緊急修復分支
- [ ] 通知使用者 (如可能)

### 修復階段 (2小時內)
- [ ] 識別問題根本原因
- [ ] 實作最小修復方案
- [ ] 執行緊急測試驗證
- [ ] 準備緊急版本說明

### 重新發布 (4小時內)
- [ ] 建立緊急修復版本
- [ ] 上傳至 Chrome Web Store
- [ ] 要求快速審核 (如可申請)
- [ ] 監控修復效果

### 事後檢討 (24小時內)
- [ ] 撰寫事件報告
- [ ] 分析預防措施
- [ ] 更新緊急程序
- [ ] 加強相關測試
```

## 📚 相關資源

### 內部文件連結
- [CI/CD 管線設置](./cicd-pipeline.md)
- [版本發布策略](./release-strategy.md)
- [監控與警報](./monitoring-alerts.md)
- [Chrome Extension 技術規範](../chrome-extension/README.md)

### 外部參考資源
- [Chrome Web Store 開發者政策](https://developer.chrome.com/docs/webstore/program_policies/)
- [Chrome Web Store API 文件](https://developers.google.com/chrome/web-store/docs/)
- [Extension 審核指南](https://developer.chrome.com/docs/webstore/review-process/)
- [Chrome Web Store 最佳實踐](https://developer.chrome.com/docs/webstore/best_practices/)

## ✅ 上架檢查清單

完成 Chrome Web Store 上架的完整檢查項目：

### 準備階段
- [ ] 生產版本建置完成且測試通過
- [ ] 版本號在 package.json 和 manifest.json 中一致
- [ ] 必要圖示檔案準備完成 (16, 48, 128, 512px)
- [ ] 商店截圖製作完成 (至少3張)
- [ ] 隱私權政策和使用條款準備完整
- [ ] ZIP 檔案建立且大小合理 (< 2MB)

### 提交階段
- [ ] Chrome Web Store 開發者帳號設置完成
- [ ] Extension 基本資訊填寫完整
- [ ] ZIP 檔案上傳成功
- [ ] 商店頁面資訊填寫完成
- [ ] 隱私權和權限說明詳細填寫
- [ ] 提交審核申請

### 審核階段
- [ ] 監控審核狀態
- [ ] 準備回應審核問題
- [ ] 如需修正立即處理並重新提交
- [ ] 審核通過後確認發布設定

### 維護階段
- [ ] 設置用戶回饋監控
- [ ] 建立版本更新流程
- [ ] 準備緊急回應程序
- [ ] 定期檢查商店分析數據
- [ ] 維持與 Chrome Web Store 政策的合規性

---

**🏪 Chrome Web Store 上架完成，開始為使用者提供優質的書庫管理體驗！**