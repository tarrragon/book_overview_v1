# 模組系統架構決策記錄 (ADR)

## 背景

在實作 UC-02 ErrorCodes 遷移過程中，遇到 ES modules (生產環境) 與 CommonJS (測試環境) 的相容性問題。

## 問題分析

### 初始錯誤做法

**❌ 錯誤方案：自建模組橋接系統**

建立了 `test-exports.cjs` 檔案，使用以下架構：

```javascript
// test-exports.cjs - 錯誤的複雜解決方案
function loadESModule(filename, dependencies = {}) {
  // 1. 手動移除 import 語句
  code = code.replace(/import\s+.*?from\s+['"].*?['"];?\s*\n?/g, '')
  
  // 2. 使用 eval 執行轉換後的程式碼
  const compiledFunction = eval(wrappedCode)
  
  // 3. 手動注入依賴項到全域範圍
  if (_ErrorCodes) globalThis.ErrorCodes = _ErrorCodes;
}
```

### 錯誤決策的根本問題

#### 1. **架構設計違反原則**
- **單一職責原則**：橋接檔案承擔了模組載入、依賴注入、程式碼轉換等多重職責
- **依賴倒置原則**：高層模組直接依賴底層實作細節
- **開放封閉原則**：每次新增模組都需要修改橋接檔案

#### 2. **命名衝突的表象問題**
```javascript
// 出現 _ErrorCodes 而不是 ErrorCodes 的症狀
const wrappedCode = `(function(..., _ErrorCodes, _UC02ErrorAdapter) {
    if (_ErrorCodes) globalThis.ErrorCodes = _ErrorCodes; // 全域污染
})`
```

**核心問題**：`ErrorCodes` 在專案中具有明確語義，不應該因為技術限制而出現 `_ErrorCodes` 這種臨時命名。

#### 3. **過度工程化**
- 為了解決簡單的模組相容性問題，建立了複雜的自定義解決方案
- 增加了維護負擔和除錯困難
- 違背了「使用標準工具解決標準問題」的原則

## 正確的解決方案

### ✅ 標準方案：Jest + Babel Transform

**原理**：使用業界標準的 Babel 轉換器，在 Jest 執行時自動將 ES modules 轉換為 CommonJS

#### 配置步驟

1. **安裝標準依賴**
```bash
npm install --save-dev @babel/core @babel/preset-env babel-jest
```

2. **Jest 配置 (package.json)**
```json
{
  "jest": {
    "transform": {
      "^.+\\.js$": "babel-jest"
    }
  }
}
```

3. **Babel 配置 (babel.config.js)**
```javascript
module.exports = {
  presets: [
    ['@babel/preset-env', { 
      targets: { node: 'current' },
      modules: 'commonjs' // 在測試環境轉換為 CommonJS
    }]
  ]
}
```

4. **測試檔案恢復標準語法**
```javascript
// 恢復原始的 import 語法
import { ErrorCodes } from 'src/core/errors/ErrorCodes.js'
import { UC02ErrorAdapter } from 'src/core/errors/UC02ErrorAdapter.js'
import { UC02ErrorFactory } from 'src/core/errors/UC02ErrorFactory.js'
```

## 決策對比

| 方面 | 自建橋接 (錯誤) | Babel Transform (正確) |
|------|----------------|----------------------|
| 複雜度 | 極高，需要手動處理所有語法 | 低，配置後自動處理 |
| 維護成本 | 高，每個新語法都需更新 | 零，由 Babel 團隊維護 |
| 除錯體驗 | 困難，Stack trace 不清楚 | 優秀，完整 Source Map 支援 |
| 效能 | 差，每次都需要 eval | 好，編譯時轉換 + 快取 |
| 標準化 | 自創方案，團隊學習成本高 | 業界標準，易於協作 |
| 語義完整性 | 破壞 (`_ErrorCodes`) | 保持 (`ErrorCodes`) |

## 經驗教訓

### 🚨 避免的反模式

1. **不要為了技術限制而破壞語義**
   - `ErrorCodes` 在專案中有明確含義，不應該因為技術問題變成 `_ErrorCodes`
   
2. **不要重新發明輪子**
   - ES modules ↔ CommonJS 轉換是已解決的問題
   - 使用 Babel 等成熟工具，而不是自建解決方案

3. **不要過度工程化**
   - 簡單問題用簡單方案
   - 複雜的自建方案通常隱藏更多問題

### ✅ 正確的決策流程

1. **識別問題本質**：模組系統相容性問題
2. **調研標準方案**：檢查業界如何解決相同問題
3. **選擇最簡單的可行方案**：Babel Transform
4. **驗證方案完整性**：確保不破壞既有語義

## 實施檢查清單

在類似情況下，使用此清單避免重複錯誤：

- [ ] 問題是否為業界常見問題？
- [ ] 是否有標準工具可以解決？
- [ ] 自建方案是否破壞了專案既有語義？
- [ ] 方案是否增加了不必要的複雜度？
- [ ] 團隊其他成員是否容易理解和維護？

## 參考資料

- [Babel 官方文檔：Usage with Jest](https://babeljs.io/docs/en/usage)
- [Jest 官方文檔：Using Babel](https://jestjs.io/docs/getting-started#using-babel)
- [ES modules vs CommonJS 相容性指南](https://nodejs.org/api/esm.html)

---

**總結**：技術決策應該服務於專案目標，而不是讓專案適應技術限制。保持語義完整性和使用標準工具是長期維護性的關鍵。