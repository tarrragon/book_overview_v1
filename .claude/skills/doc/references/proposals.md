# Proposal 文件規範

## 核心原則

> **一個提案 = 一個版本的明確功能範圍**

| 原則 | 說明 |
|------|------|
| 單版本綁定 | 提案必須綁定 target_version，禁止跨大版本設計 |
| 明確做與不做 | 必須列出 In Scope 和 Out of Scope |
| 不做 → 新提案 | Out of Scope 的項目如果未來需要，建立獨立提案 |
| 驗收對應做 | 驗收條件必須與 In Scope 項目一一對應 |

## 狀態流轉

```
draft → discussing → confirmed → implemented
                  ↘ withdrawn
```

| 狀態 | 觸發動作 |
|------|---------|
| draft | 建立提案文件 |
| discussing | 開始評估可行性 |
| confirmed | 轉化為 spec/usecase，開 ticket |
| implemented | 所有相關 ticket 完成 |
| withdrawn | 決定不做，記錄理由 |

## 與 Ticket 的關係

提案是 ticket 的上游：

1. 提案 confirmed → 開立 ticket，ticket.why 引用 PROP-NNN
2. ticket 完成 → 更新 proposals-tracking.yaml checklist
3. 所有 checklist 完成 → 提案 status 改為 implemented

## 模板

模板位置：`.claude/skills/doc/templates/proposal-template.md`

### 必填欄位

| frontmatter | 正文章節 |
|-------------|---------|
| id, title, status | 需求來源 |
| source, target_version | 問題描述 |
| outputs.spec_refs/usecase_refs/ticket_refs | 範圍界定（In Scope / Out of Scope） |
| | 驗收條件 |

## 命名規範

格式：`PROP-{NNN}-{簡短描述}.md`
範例：`PROP-001-multi-platform-isolation.md`
