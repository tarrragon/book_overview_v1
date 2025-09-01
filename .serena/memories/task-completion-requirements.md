# 任務完成要求

## TDD 循環合規檢查

每個 TDD 循環完成後必須執行：

### 1. 完整合規檢查

```bash
npm test && npm run test:coverage && npm run lint && npm run build:dev
```

### 品質標準驗證

- [ ] 測試覆蓋率達到 100%
- [ ] 所有 linter 檢查通過
- [ ] 建置成功無錯誤
- [ ] 效能沒有明顯退化

### 2. Git 操作驗證

```bash
git status      # 檢查變更狀態
git diff        # 確認變更內容
```

### 3. 文件同步更新

必須更新的文件：

1. 更新 `docs/todolist.md` 進度
2. 更新工作日誌 `docs/work-logs/vX.X.X-work-log.md`
3. 強制更新 `CHANGELOG.md` 記錄小版本號

### 4. 絕對禁止的妥協行為

- ❌ 「先這樣，之後再改」: 架構問題必須當下解決
- ❌ 「測試之後再寫」: 違反 TDD 原則
- ❌ 「複製貼上這段程式碼」: 重複程式碼必須立即重構

## 程式碼品質標準

- Five Lines 規則 (每個方法不應超過5行程式碼)
- 單一責任原則
- 語意化命名
- 防禦性程式設計
