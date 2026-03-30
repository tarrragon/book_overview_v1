# 用例（Use Cases）

用例文件目錄。定義使用場景、驗收標準和例外處理，供測試設計和驗收參考。

> UseCase 是**跨 domain** 的使用場景，一個 UC 可能涉及多個 domain。

## 使用方式

建立新用例時，從 Skill 模板複製：

```bash
cp .claude/skills/doc/templates/usecase-template.md docs/usecases/UC-{XX}-{簡短描述}.md
```

> 模板規範和欄位說明見 `.claude/skills/doc/references/usecases.md`

## 用例索引

| 用例 ID | 名稱 | 平台 | Extension 狀態 | 相關 Spec |
|---------|------|------|---------------|-----------|
| [UC-01](UC-01-import.md) | 匯入 Chrome Extension 書庫資料 | both | implemented | SPEC-004, SPEC-002 |
| [UC-02](UC-02-export.md) | 匯出書庫資料 | both | implemented | SPEC-004 |
| [UC-03](UC-03-isbn-scan.md) | ISBN 條碼掃描新增書籍 | app | not-applicable | - |
| [UC-04](UC-04-search-enrich.md) | 關鍵字搜尋補充書籍資訊 | both | partial | SPEC-002, SPEC-008 |
| [UC-05](UC-05-library-display.md) | 雙模式書庫展示系統 | both | implemented | SPEC-008, SPEC-006 |
| [UC-06](UC-06-loan-management.md) | 借閱管理系統 | app | not-applicable | SPEC-004 |
| [UC-07](UC-07-sync.md) | 跨平台資料同步準備 | both | partial | SPEC-004, SPEC-003 |
| [UC-08](UC-08-error-handling.md) | 系統錯誤處理與恢復 | both | implemented | SPEC-001, SPEC-007 |

## 平台歸屬說明

| 標記 | 說明 |
|------|------|
| both | Chrome Extension 和 Flutter APP 都適用 |
| app | 僅 Flutter APP（如需相機、SQLite 等） |
| extension | 僅 Chrome Extension |

## Extension 實作狀態

| 狀態 | 說明 | 數量 |
|------|------|------|
| implemented | Chrome Extension 已完整實作 | 4 |
| partial | 部分實作或概念相通但細節不同 | 2 |
| not-applicable | 不適用於 Chrome Extension | 2 |

## 來源

原始用例文件：`../app-use-cases.md`（保留為歷史參考）
