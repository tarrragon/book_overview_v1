# 二階段派發規範

> **目標**：解決代理人因「探索 + 大量寫入」導致 context 耗盡的問題。將設計和注入分離為兩個獨立子任務。

---

## 觸發條件

以下任一條件符合時，必須使用二階段派發：

| 條件 | 說明 |
|------|------|
| 預期寫入量 > 150 行 | 參見 task-splitting.md 寫入量閾值 |
| 需要大量探索才能寫出程式碼 | 代理人需讀取 5+ 檔案才能理解風格/結構 |
| 前次派發因 context 耗盡失敗 | 同一任務已失敗 1 次以上 |

---

## 二階段流程

### Stage 1：設計代理人（產出程式碼到 Ticket）

**角色**：sage-test-architect（測試）/ pepper-test-implementer（實作策略）/ 主線程

**任務**：
1. 閱讀規格和現有程式碼
2. 設計完整的程式碼片段
3. 將程式碼寫入 Ticket 的 Solution 區段或獨立設計文件

**產出物**：
- 設計文件（含完整可直接貼入的程式碼）
- 或 Ticket Solution 區段中的程式碼片段

**不做的事**：不修改 src/ 或 tests/ 下的檔案

### Stage 2：注入代理人（從 Ticket 讀取程式碼並寫入）

**角色**：general-purpose / thyme / parsley

**Prompt 模板**：
```
讀取 {Ticket 路徑或設計文件路徑} 中的程式碼片段。
將程式碼注入 {目標檔案路徑}。
注入位置：{檔案尾部 / 特定 old_string 之後}。
寫入後執行 {測試指令} 確認結果。
Commit 變更。
```

**特點**：
- Prompt 極短（< 200 字）
- 代理人只需 Read → Edit → Bash → commit
- 探索量接近零
- Context 充裕

---

## 範例

### 範例：Phase 2 測試寫入（W2-005 場景）

**Stage 1**：sage 產出 `0.17.2-W2-005-phase2-test-design.md`，含 12 個 GWT 案例的完整程式碼

**Stage 2 prompt**：
```
讀取 docs/work-logs/v0/v0.17/v0.17.2/tickets/0.17.2-W2-005-phase2-test-design.md。
將設計文件第 3 節的測試案例轉換為 Jest 測試程式碼。
注入 tests/unit/ui/search/core/search-engine.test.js 檔案尾部（最後一個 }) 之前）。
執行 npm test -- tests/unit/ui/search/core/search-engine.test.js。
Commit。
```

---

## 與其他規則的關係

| 規則 | 關係 |
|------|------|
| task-splitting.md | 寫入量 > 150 行時觸發二階段 |
| IMP-047 | 程式碼放 Ticket 而非 prompt |
| parallel-dispatch.md | Stage 1 和 Stage 2 為序列關係，不可並行 |
| cognitive-load.md | 每個 Stage 的認知負擔指數應 < 10 |

---

## 禁止行為

| 禁止 | 原因 |
|------|------|
| Stage 2 prompt 包含完整程式碼 | 佔用代理人 context，與本規範目的矛盾 |
| 跳過 Stage 1 直接派發大量寫入 | 代理人 context 耗盡風險高 |
| Stage 1 代理人寫入 src/tests 檔案 | 設計和注入職責混淆 |

---

**Last Updated**: 2026-04-06
**Version**: 1.0.0 - 初始建立（0.17.2-W2-020，基於 W2-019 分析）
