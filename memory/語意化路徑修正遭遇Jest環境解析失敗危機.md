---
id: semantic-path-migration-jest-crisis
type: issue
title: 語意化路徑修正遭遇 Jest 環境解析失敗危機
created: 2025-09-07
tags: [path-migration, jest, semantic-path, require-resolution, testing]
---

# 語意化路徑修正遭遇 Jest 環境解析失敗危機

## 一句話說明

> 大規模 JavaScript require 語句路徑修正過程中，發現 Jest 環境無法解析 `./src/` 前綴的語意化路徑，導致測試失敗率激增，需要緊急分析和修復方案

## 上下文連結

- 基於：[[文件路徑語意化修正專案啟動]]
- 導致：[[測試通過率從100%大幅下降至失敗]]
- 相關：[[路徑規範標準化需求與實施矛盾]]

## 核心內容

### 🚨 **問題分析與發現**

#### **1. Jest 環境下語意化路徑解析失敗**

**現象描述**：
- 使用 `./src/` 前綴的 require 語句在 Jest 測試環境中無法解析
- Node.js 環境下相同路徑可以正常解析
- 錯誤訊息：`Cannot find module './src/utils/file-reader-factory' from 'src/overview/overview-page-controller.js'`

**影響範圍**（已確認的問題檔案）：
- `src/overview/overview-page-controller.js` (第40行、第759行)
- `src/background/domains/platform/services/platform-detection-service.js`
- `src/platform/readmoo-platform-migration-validator.js`
- `src/data-management/SchemaMigrationService.js`

**技術根因分析**：
- Jest 的模組解析機制與 Node.js 原生機制存在差異
- moduleNameMapper 配置 `'^\\.\/src\/(.*)$': '<rootDir>/src/$1'` 未生效
- 可能是 Jest 版本相容性或配置語法問題

#### **2. 路徑規範標準存在矛盾**

**發現於 `format-fix-examples.md`**：

**矛盾情況一**（第58行）：
```javascript
// ✅ 修正後 - 使用 ./src/ 前綴
const BaseModule = require('./src/background/lifecycle/base-module')
```

**矛盾情況二**（第124行）：
```javascript
// ✅ 修正後 - 使用 src/ 前綴（無 ./）
const { BookValidationError } = require('src/core/errors/BookValidationError')
```

**問題嚴重性**：
- 規範文件內部標準不一致
- 導致實施過程中選擇混亂
- 無法確定統一的路徑格式目標

#### **3. Jest moduleNameMapper 配置問題**

**當前配置**（package.json 第87-92行）：
```json
"moduleNameMapper": {
  "^src/(.*)$": "<rootDir>/src/$1",
  "^@/(.*)$": "<rootDir>/src/$1",
  "^@tests/(.*)$": "<rootDir>/tests/$1",
  "^@mocks/(.*)$": "<rootDir>/tests/mocks/$1",
  "^@fixtures/(.*)$": "<rootDir>/tests/fixtures/$1"
}
```

**問題分析**：
- 只支援 `src/` 開頭的路徑，不支援 `./src/` 開頭
- 缺少針對 `./src/` 前綴的映射規則
- 自訂 Jest resolver 嘗試失敗（resolver 未被調用）

#### **4. 實際程式碼中的路徑使用情況**

**範例：overview-page-controller.js**
- 第40行：`require('../core/event-handler')` （相對路徑）
- 第759行：`require('../utils/file-reader-factory')` （相對路徑）

**當前狀態**：已回退到相對路徑以恢復測試通過

### 🔧 **臨時解決方案**

**針對 overview-page-controller.js**：
- **行動**：回退到標準相對路徑
- **修改**：
  - `require('./src/core/event-handler')` → `require('../core/event-handler')`
  - `require('./src/utils/file-reader-factory')` → `require('../utils/file-reader-factory')`
- **結果**：該檔案測試恢復通過

### ⚠️ **識別的風險與影響**

#### **測試通過率危機**：
- **當前狀況**：測試失敗率激增
- **目標違反**：與「100% 測試通過率鐵律」衝突
- **影響範圍**：多個核心模組受影響

#### **開發流程中斷**：
- **功能開發暫停**：需優先修復架構問題
- **技術債務累積**：部分檔案已修改路徑，部分尚未
- **一致性破壞**：專案內路徑格式不統一

#### **規範可信度下降**：
- **規範文件矛盾**：影響團隊執行標準
- **決策不確定**：無法確定正確的路徑策略
- **文件維護問題**：需要統一和更新規範

### 📋 **緊急行動計畫**

#### **Phase 1: 緊急修復測試通過率** ⚡
- **優先級**：Critical
- **目標**：恢復 100% 測試通過率
- **行動**：
  1. 識別所有使用語意化路徑的檔案
  2. 暫時回退到相對路徑
  3. 驗證測試全面通過

#### **Phase 2: 路徑策略重新評估** 🔍
- **優先級**：High
- **目標**：確定技術可行的路徑策略
- **行動**：
  1. 深入分析 Jest 路徑解析機制
  2. 測試各種 moduleNameMapper 配置
  3. 評估 `src/` vs `./src/` 的技術差異
  4. 制定統一的路徑格式決策

#### **Phase 3: 規範標準化** 📝
- **優先級**：High
- **目標**：統一和修正規範文件
- **行動**：
  1. 修正 format-fix-examples.md 中的矛盾
  2. 確定單一、明確的路徑格式標準
  3. 更新所有相關文件和範例

#### **Phase 4: 系統性路徑修正** 🔄
- **優先級**：Medium
- **目標**：在確定可行策略後重新執行
- **行動**：
  1. 基於最終決定的格式重新修正
  2. 批次處理，確保每批次後測試通過
  3. 完整驗證和文件更新

### 🧪 **技術方案探索**

#### **方案A: 修正 Jest 配置支援 `./src/` 前綴**
```json
"moduleNameMapper": {
  "^\\.\/src\/(.*)$": "<rootDir>/src/$1",
  "^src/(.*)$": "<rootDir>/src/$1"
}
```

#### **方案B: 統一使用 `src/` 前綴（不含 `./`）**
- 更新規範：所有引用使用 `src/` 開頭
- 當前 Jest 配置已支援此格式
- 需要驗證 Node.js 環境相容性

#### **方案C: 回退到標準相對路徑**
- 最保守但最穩定的選擇
- 完全相容現有環境
- 放棄語意化路徑的優勢

### 📊 **當前狀態統計**

**受影響檔案估計**：
- 已修正但失敗：~20-30個檔案
- 待修正：~100+個檔案（根據原始統計）
- 測試失敗：多個核心模組

**修復進度**：
- ✅ overview-page-controller.js（已回退修復）
- 🔄 其他檔案待處理

**測試通過率**：
- 目標：100%
- 當前：大幅下降（具體數值待測試確認）

### 🎯 **決策建議**

#### **立即行動**：
1. **暫停所有路徑修正工作**
2. **優先恢復測試通過率至 100%**
3. **不妥協架構債務零容忍原則**

#### **中期決策**：
1. **技術可行性評估優於理想化目標**
2. **選擇最穩定且一致的路徑策略**
3. **確保規範文件完全準確一致**

#### **長期考量**：
1. **建立路徑修正的自動化測試**
2. **制定防範類似問題的檢查機制**
3. **考慮引入路徑別名工具（如 webpack alias）**

## 關鍵文件

- `package.json` - Jest 配置和 moduleNameMapper 設定
- `docs/claude/format-fix-examples.md` - 路徑規範範例（存在矛盾）
- `src/overview/overview-page-controller.js` - 受影響的主要檔案
- `tests/` - 相關測試檔案