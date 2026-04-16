# 規則系統

> **平台機制**：Claude Code 啟動時自動載入 `CLAUDE.md` + `.claude/rules/**/*.md`。其他 `.claude/` 子目錄不會自動載入，必須主動 Read。

本目錄只放**所有角色通用**的品質規則（7 檔）。PM 流程規則在 `pm-rules/`，技術參考在 `references/`。

| 目錄 | 載入方式 | 內容 |
|------|---------|------|
| `rules/core/` | 自動載入 | 通用品質基線、Bash 規則、認知負擔、文件格式、語言約束 |
| `pm-rules/` | PM 按需讀取 | 決策樹、TDD、Ticket、事件回應、Skip-gate |
| `references/` | 代理人按需讀取 | 語言品質（dart/go/python）、Ticket ID 規範 |
| `agents/` | 派發時讀取 | 代理人定義（含技術知識庫） |

## 專案設定與代理人知識的職責分離

| 歸屬 | 位置 | 內容 | 範例 |
|------|------|------|------|
| **專案設定** | `CLAUDE.md` | 技術選型、架構決策、測試指令 | 「本專案用 Riverpod 3.0 + MVVM」 |
| **代理人知識** | `.claude/agents/` | 技術最佳實踐、框架寫法 | 「Riverpod 3.0 Notifier 怎麼寫」 |
| **品質規則** | `.claude/rules/` | 跨專案通用品質標準 | 「函式長度上限 30 行」 |

代理人帶著多種技術的知識（如 Riverpod 2.0、3.0、BLoC），根據 CLAUDE.md 的專案設定選擇適用方案。

**禁止**：建立獨立的語言設定檔（如 FLUTTER.md、PYTHON.md）。所有專案設定統一在 CLAUDE.md。

## 框架資產與專案產物的職責分離

框架與專案是兩個獨立生命週期，必須在目錄上嚴格分離。

| 類別 | 位置 | 典型內容 | 判斷標準 |
|------|------|---------|---------|
| **框架資產** | `.claude/` | 模板、規範、Skill、Hook、CLI、規則、方法論 | 會 sync 到其他專案共用 |
| **專案產物** | `docs/`、`src/`、`tests/` | 需求文件、設計稿、程式碼、工作日誌 | 僅屬本專案 |

**強制規則**：

| 禁止 | 原因 |
|------|------|
| 將模板 / 規範放在 `docs/` 下 | 模板屬於框架資產，應放在 `.claude/skills/` 或 `.claude/methodologies/` |
| 在 `docs/` 產物中加註解指向 Skill | 以「指向」彌補目錄混放是錯誤的修正；應直接搬遷到正確位置 |
| 在 `.claude/` 內放專案特定 ticket ID / commit hash / worklog 路徑 | 跨專案 sync 會產生死連結（見 `.claude/references/reference-stability-rules.md` 規則 8） |

**建立新文件系統或 Skill 時**：先問「這是模板/規範還是產物？」
- 模板 / 規範 → 放 `.claude/skills/` 或 `.claude/methodologies/`
- 產物 → 放 `docs/` 或專案目錄

---

**Last Updated**: 2026-04-13
**Version**: 9.0.0 - 新增框架資產與專案產物職責分離章節（升級自 auto-memory feedback_framework_product_separation）
