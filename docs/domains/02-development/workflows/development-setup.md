# 🔧 開發環境配置指南

> **第二層開發文件** - 詳細開發環境設置與配置指南  
> **目標讀者**: 新加入開發者、環境配置維護人員  
> **預估時間**: 30-45 分鐘完成完整配置  

本文件提供 Readmoo 書庫提取器 Chrome Extension 的完整開發環境設置指南，確保所有開發者能快速建立一致的開發環境。

## 🎯 開發環境總覽

### 技術棧架構
- **平台**: Chrome Extension (Manifest V3)
- **主要語言**: JavaScript (ES6+)
- **測試框架**: Jest + Testing Library
- **程式碼品質**: ESLint + Prettier
- **建置工具**: 自訂 Node.js 腳本
- **協作工具**: TMux + Git

### 核心開發工具
- **Node.js**: v18+ (建議使用 v20 LTS)
- **npm**: v9+ (隨 Node.js 安裝)
- **TMux**: 協作開發環境管理
- **Chrome**: 89+ (Extension 開發與測試)

## 🚀 快速開始 (5分鐘設置)

### 步驟 1: 基礎環境檢查

```bash
# 檢查 Node.js 版本 (需要 v18+)
node --version

# 檢查 npm 版本
npm --version

# 檢查 Git 配置
git --version
git config --global user.name
git config --global user.email
```

### 步驟 2: 專案複製與依賴安裝

```bash
# 複製專案
git clone [repository-url]
cd readmoo-book-extractor

# 安裝依賴項 (使用 legacy-peer-deps 確保相容性)
npm install --legacy-peer-deps

# 驗證安裝結果
npm run build:dev
npm run test:unit
```

### 步驟 3: 環境驗證

```bash
# 執行完整環境檢查
/startup-check

# 預期結果: 所有檢查項目顯示 ✅
```

## 📋 詳細安裝指南

### Node.js 環境設置

#### 推薦版本管理
使用 nvm (Node Version Manager) 管理多版本 Node.js：

```bash
# macOS/Linux 安裝 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新載入 shell 配置
source ~/.bashrc  # 或 ~/.zshrc

# 安裝並使用推薦版本
nvm install 20
nvm use 20
nvm alias default 20
```

#### Windows 使用者
推薦使用 [nvm-windows](https://github.com/coreybutler/nvm-windows) 或直接從 [Node.js 官網](https://nodejs.org/) 下載 v20 LTS。

### TMux 協作環境設置

#### 安裝 TMux
```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt-get install tmux

# CentOS/RHEL
sudo yum install tmux
```

#### 專案專用 TMux 配置
```bash
# 啟動專案協作環境
./scripts/attach-main-layout.sh

# 或手動建立 5 個面板協作環境
tmux new-session -s main_layout
./scripts/setup-tmux-layout.sh
```

**面板分工**:
- **面板 0**: 主要開發 (測試、編碼)
- **面板 1**: 文件更新 (日誌、TODO)
- **面板 2**: 程式碼品質檢查 (lint、build)
- **面板 3**: Git 操作 (commit、push)
- **面板 4**: 監控和分析 (日誌、效能)

## 🔧 開發工具配置

### VSCode 推薦配置

#### 必要擴充功能
```json
{
  "recommendations": [
    "ms-vscode.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-json",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.chrome-debug"
  ]
}
```

#### 工作區配置 (.vscode/settings.json)
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": ["javascript"],
  "files.associations": {
    "*.js": "javascript"
  },
  "chrome.executable": "/usr/bin/google-chrome"
}
```

### Chrome Extension 開發配置

#### 開發者模式啟用
1. 開啟 Chrome，前往 `chrome://extensions/`
2. 啟用右上角「開發人員模式」
3. 點擊「載入未封裝項目」
4. 選擇專案的 `build/development` 資料夾

#### 除錯設置
```bash
# 啟動開發模式建置 (含 source map)
npm run build:dev

# 啟動本地測試伺服器
npm run serve

# 開啟 Chrome DevTools 除錯
# Extension 頁面 → 「檢查檢視畫面」
```

## 🧪 測試環境配置

### Jest 測試框架
專案使用 Jest 作為主要測試框架，支援多種測試類型：

```bash
# 單元測試
npm run test:unit

# 整合測試  
npm run test:integration

# 監視模式 (開發時推薦)
npm run test:watch

# 覆蓋率報告
npm run test:coverage
```

### 測試環境分類
- **Unit Tests**: `tests/unit/` - 個別函數和元件測試
- **Integration Tests**: `tests/integration/` - 模組間協作測試  
- **E2E Tests**: `tests/e2e/` - 完整使用者流程測試 (目前停用)

### Chrome Extension 測試特殊設置
```javascript
// tests/test-setup.js
import 'jest-chrome';
import '@testing-library/jest-dom';

// Mock Chrome API
global.chrome = require('jest-chrome');
```

## 🏗️ 建置流程配置

### 開發模式建置
```bash
# 開發版本 (包含 source map、除錯資訊)
npm run build:dev

# 自動監視檔案變更並重建
npm run dev
```

### 生產模式建置
```bash
# 生產版本 (最佳化、壓縮)
npm run build:prod

# 驗證建置結果
npm run validate:build:prod
```

### 建置產物結構
```
build/
├── development/          # 開發版本
│   ├── manifest.json
│   ├── background/
│   ├── content/
│   ├── popup/
│   └── assets/
└── production/          # 生產版本
    └── [相同結構，已最佳化]
```

## 🔍 程式碼品質設置

### ESLint 配置
專案使用 JavaScript Standard Style：

```bash
# 執行 Lint 檢查
npm run lint

# 自動修復可修復的問題
npm run lint:fix
```

### Prettier 格式化
```bash
# 格式化所有檔案
npm run format

# 檢查格式化狀態
npm run format:check

# 僅格式化 Markdown 文件
npm run format:docs
```

### Pre-commit Hook 設置
建議配置 pre-commit hook 確保提交前通過品質檢查：

```bash
# 在 .git/hooks/pre-commit 建立
#!/bin/sh
npm run lint
npm run format:check  
npm run test:unit
```

## 🚨 常見問題與解決方案

### 依賴安裝問題
```bash
# 清除快取重新安裝
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# 如果仍有問題，檢查 Node.js 版本
node --version  # 應該是 v18+
```

### TMux 環境問題
```bash
# 如果 TMux session 異常
tmux kill-server
./scripts/attach-main-layout.sh

# 檢查面板配置
tmux list-panes -t main_layout
```

### Chrome Extension 載入問題
1. 確認已啟用開發者模式
2. 檢查 `build/development/manifest.json` 是否存在
3. 查看 Chrome Extensions 頁面的錯誤訊息
4. 重新執行 `npm run build:dev`

### 測試執行問題
```bash
# 清除測試快取
npm run clean
npm run test:unit

# 如果 Chrome API 測試失敗
rm -rf node_modules/jest-chrome
npm install --legacy-peer-deps
```

## 📚 下一步學習資源

### 專案內部文件
- **架構概觀**: [核心架構文件](../01-getting-started/core-architecture.md)
- **錯誤處理**: [錯誤處理總覽](../01-getting-started/error-handling-overview.md)
- **測試指南**: [測試金字塔](../testing/test-pyramid.md)
- **Git 工作流程**: [Git 工作流程](./git-workflow.md)

### 外部參考資源
- [Chrome Extension 開發指南](https://developer.chrome.com/docs/extensions/mv3/)
- [Jest 測試框架文件](https://jestjs.io/docs/getting-started)
- [JavaScript Standard Style](https://standardjs.com/)
- [TMux 快速上手](https://tmuxcheatsheet.com/)

## ✅ 環境配置檢查清單

完成以下檢查後，您的開發環境即已完整配置：

- [ ] Node.js v18+ 已安裝
- [ ] 專案依賴項安裝完成 (`npm install --legacy-peer-deps`)
- [ ] TMux 環境已設置 (`./scripts/attach-main-layout.sh`)
- [ ] Chrome 開發者模式已啟用
- [ ] Extension 已成功載入 (`build/development/`)
- [ ] 所有測試通過 (`npm run test:unit`)
- [ ] 程式碼品質檢查通過 (`npm run lint`)
- [ ] 建置流程正常 (`npm run build:dev`)
- [ ] `/startup-check` 執行所有項目顯示 ✅

---

**🎉 恭喜！您的開發環境已準備就緒，可以開始貢獻程式碼了！**

> 💡 **建議**: 第一次設置完成後，建議先閱讀 [TDD 開發流程](./tdd-process.md) 了解專案的開發方法論。