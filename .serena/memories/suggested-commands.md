# 開發指令速查

## 測試指令
```bash
# 執行核心測試 (單元+整合)
npm test
npm run test:core

# 執行所有測試
npm run test:all

# 監視模式執行測試
npm run test:watch

# 測試覆蓋率
npm run test:coverage

# 分類測試
npm run test:unit          # 單元測試
npm run test:integration   # 整合測試
```

## 品質檢查指令
```bash
# 程式碼檢查
npm run lint

# 自動修正程式碼檢查問題
npm run lint:fix
```

## 建置指令
```bash
# 開發版本建置
npm run build:dev

# 生產版本建置
npm run build:prod

# 開發工作流程 (建置 + 監視測試)
npm run dev
```

## 任務完成時必須執行的指令
```bash
# 1. 執行所有測試
npm test

# 2. 程式碼品質檢查
npm run lint

# 3. 建置驗證
npm run build:dev
```

## 系統工具 (macOS)
- `git` - 版本控制
- `ls` - 列出檔案
- `find` - 搜尋檔案
- `grep` - 搜尋內容