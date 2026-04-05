# Phase 3b 派發指南

本文件定義 TDD Phase 3b（實作執行）的代理人派發規範。

> **來源**：IMP-047 — Worktree subagent 在大型專案中反覆只讀不寫，回合耗盡前未產出程式碼。

---

## 核心原則

> Phase 3b 的 prompt **必須包含完整程式碼**（或至少 80% 骨架），不可只提供規格引用讓 agent 自行設計。

---

## Prompt 結構（強制）

```
## 直接實作：{模組名稱}

Ticket: {ticket-id}

**不要花時間研究，直接寫程式碼。**

### 要建立的檔案

**1. {src 路徑}**
```{語言}
{完整程式碼}
```

**2. {test 路徑}**
```{語言}
{完整測試程式碼}
```

### 步驟
1. 寫 src 檔案
2. 寫 test 檔案
3. 跑測試
4. 修復失敗（如有）

**目標：N 個測試全部 GREEN。**
```

---

## Agent 類型選擇

| 場景 | 推薦 Agent | 原因 |
|------|-----------|------|
| 程式碼已在 prompt 中 | general-purpose | 最直接，不會過度研究 |
| 需要 agent 自行設計 | specialized（如 thyme-extension-engineer） | 但風險高，可能只讀不寫 |
| 程式碼複雜需互動 | 前景 general-purpose | 可即時修正 |

---

## PM 準備程式碼的流程

1. 閱讀 Phase 1 功能規格（API 簽名、行為規則）
2. 閱讀相關共用模組介面（如 BookSchemaV2 的 exports）
3. 根據規格撰寫完整程式碼
4. 將程式碼嵌入 prompt 派發

**PM 寫程式碼的例外**：Phase 3b 的程式碼是根據已審核的規格機械轉換，不涉及設計決策，因此 PM 可以準備。

---

## 禁止行為

| 禁止 | 原因 |
|------|------|
| 只給規格引用讓 agent 自行研究和設計 | Agent 回合耗盡前只讀不寫（IMP-047） |
| 使用 specialized agent 不含程式碼 | 更謹慎，研究時間更長 |
| Prompt 中說「參考 spec 檔案」 | Agent 會花大量回合讀 spec |

---

## 相關文件

- .claude/error-patterns/implementation/IMP-047-worktree-subagent-read-only-exhaustion.md
- .claude/pm-rules/tdd-flow.md - TDD 流程

---

**Last Updated**: 2026-04-05
**Version**: 1.0.0 - 初始建立（0.17.2-W2-010）
