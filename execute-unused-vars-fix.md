# 執行 No-Unused-Vars 修復的具體步驟

## 🚀 立即執行步驟

### 步驟 1: 檢查當前狀態
```bash
cd /Users/tarragon/Projects/book_overview_v1
npm run lint 2>&1 | grep "no-unused-vars" | wc -l
```

### 步驟 2: 執行自動修復
```bash
npm run lint:fix
```

### 步驟 3: 再次檢查剩餘問題
```bash
npm run lint 2>&1 | grep "no-unused-vars"
```

### 步驟 4: 手動處理剩餘問題
使用以下其中一個修復腳本：
```bash
node fix-remaining-unused-vars.js
# 或
node comprehensive-unused-vars-fix.js
# 或
node manual-unused-vars-fix.js
```

## 📋 已準備的修復工具

1. **comprehensive-unused-vars-fix.js** - 最完整的修復方案
   - 先執行 npm run lint:fix
   - 然後手動處理剩餘問題
   - 最後驗證結果

2. **manual-unused-vars-fix.js** - 針對特定模式修復
   - 處理常見的測試變數模式
   - 添加 eslint-disable 註釋

3. **targeted-unused-vars-fix.js** - 智能分析修復
   - 掃描 JavaScript 檔案
   - 識別常見未使用變數模式
   - 提供不同類型的修復策略

## ✅ 已確認修復的問題

- `src/background/domains/user-experience/services/personalization-service.js` - 移除未使用的 ErrorCodes 導入

## 🎯 修復原則

### 1. 安全第一
- 只修復確實未使用的變數
- 保留所有有實際用途的變數

### 2. 優先順序
1. 移除確實未使用的導入
2. 為測試變數添加 eslint-disable
3. 為函數參數添加 _ 前綴

### 3. 驗證方法
- 每次修復後執行 `npm run lint`
- 確保測試仍然通過: `npm test`

## 📊 預期結果

完成後應該達到：
- ✅ `npm run lint` 沒有 no-unused-vars 警告
- ✅ 所有測試通過
- ✅ 程式碼功能完整保留

## 🔧 如果自動修復不夠完整

可以手動檢查以下常見模式：

### 1. 測試相關變數
```javascript
// 添加 eslint-disable 註釋
// eslint-disable-next-line no-unused-vars
const mockEventBus = createMockEventBus()
```

### 2. 錯誤處理相關
檢查是否真的有使用：
```javascript
// 如果沒有使用到 ErrorCodes.SOME_ERROR，則移除導入
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
```

### 3. 函數參數
```javascript
// 添加 _ 前綴表示未使用
function handleEvent(_eventType, data) {
  return processData(data)
}
```

---

**重要**: 請在執行任何修復前先備份重要檔案，並在修復後驗證所有功能正常運作。