# 框架資產與專案產物職責分離

本文件定義 `.claude/` 框架資產與專案產物之間的職責分離原則。設計新規則、建立 Skill、規劃文件系統時應讀取本文件。

> **載入方式**：按需讀取。非每 session 自動載入。從 `.claude/rules/README.md` 的索引指向此檔案。

---

## 1. 專案設定與代理人知識的職責分離

| 歸屬 | 位置 | 內容 | 範例 |
|------|------|------|------|
| **專案設定** | `CLAUDE.md` | 技術選型、架構決策、測試指令 | 「本專案用 Riverpod 3.0 + MVVM」 |
| **代理人知識** | `.claude/agents/` | 技術最佳實踐、框架寫法 | 「Riverpod 3.0 Notifier 怎麼寫」 |
| **品質規則** | `.claude/rules/` | 跨專案通用品質標準 | 「函式長度上限 30 行」 |

代理人帶著多種技術的知識（如 Riverpod 2.0、3.0、BLoC），根據 CLAUDE.md 的專案設定選擇適用方案。

**禁止**：建立獨立的語言設定檔（如 FLUTTER.md、PYTHON.md）。所有專案設定統一在 CLAUDE.md。

---

## 2. 框架資產與專案產物的職責分離

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

## 3. Skill Hook 雙層架構：命名、路徑與註冊規範

Skill 可附帶私有 Hook（僅服務於該 Skill 的觸發場景），與框架共用 Hook 並列形成雙層架構。本節規範私有 Hook 的命名、放置位置、註冊流程。

### 3.1 雙層 Hook 架構職責

| 層級 | 位置 | 服務範圍 | 範例 |
|------|------|---------|------|
| **框架共用 Hook** | `.claude/hooks/<name>.py` | 跨 Skill / 全 session 通用攔截 | `boundary-validation-hook.py`、`agent-dispatch-validation-hook.py` |
| **Skill 私有 Hook** | `.claude/skills/<skill>/hooks/<name>.py` | 僅該 Skill 觸發場景使用 | `.claude/skills/test-async-guardian/hooks/pre-test-scan.py` |

**判斷標準**：

| 問題 | 屬框架共用 | 屬 Skill 私有 |
|------|----------|--------------|
| Hook 觸發條件是否與單一 Skill 強耦合？ | 否（多 Skill / 全 session 場景） | 是 |
| 移除該 Skill 後 Hook 是否仍有價值？ | 是 | 否 |
| Hook 邏輯是否引用該 Skill 內部模組？ | 否 | 是 |

### 3.2 命名規範

| 規則 | 框架共用 | Skill 私有 |
|------|---------|-----------|
| 檔名格式 | `<domain>-<action>-hook.py`（如 `dispatch-validation-hook.py`） | `<action>-<scope>.py`（如 `pre-test-scan.py`，可省略 `-hook` 字尾） |
| 命名前綴 | 無強制前綴 | 不需重複 Skill 名稱（路徑已含 `<skill>/`） |
| 副檔名 | 必為 `.py` | 必為 `.py` |

**理由**：Skill 私有 Hook 路徑已含 Skill 名稱（如 `test-async-guardian/hooks/`），檔名再加 Skill 前綴造成冗餘；簡化為 `<action>-<scope>.py` 即可，閱讀時自然從路徑得知歸屬。

### 3.3 註冊流程

Skill 私有 Hook **必須在 `settings.json` 註冊**才會被觸發。註冊路徑須使用完整相對路徑：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/skills/test-async-guardian/hooks/pre-test-scan.py"
          }
        ]
      }
    ]
  }
}
```

**註冊規則**：

| 項目 | 要求 |
|------|------|
| 路徑前綴 | 必用 `$CLAUDE_PROJECT_DIR/.claude/skills/<skill>/hooks/<file>.py` |
| 執行權限 | `chmod +x` 必要（`hook-completeness-check` 會自動修復） |
| Hook event 選擇 | 與框架 Hook 相同（PreToolUse / PostToolUse / SessionStart / Stop 等） |

### 3.4 掃描器行為

`hook-completeness-check.py` 同時掃描兩層：

| 目錄 | 比對對象 |
|------|---------|
| `.claude/hooks/*.py` | settings.json 中所有 hook command 路徑 |
| `.claude/skills/*/hooks/*.py` | settings.json 中 `.claude/skills/<skill>/hooks/<file>.py` 模式 |

兩層分別產出獨立報告區段，避免命名衝突誤判（同名檔案在不同 skill 各自獨立）。

### 3.5 共用工具的歸屬

| 工具 | 放置位置 | 理由 |
|------|---------|------|
| `hook_utils.py` | `.claude/hooks/hook_utils.py` | 跨 Skill / 框架 Hook 共用 logging / safe runner |
| Skill 內部 lib | `.claude/skills/<skill>/<skill>_lib/` 或子套件 | 僅該 Skill Hook 使用的邏輯 |
| 跨 Skill 共用 lib | `.claude/skills/<shared-skill>/` 並由其他 Skill 依賴 | 避免在 `.claude/hooks/` 內塞 Skill 邏輯 |

### 3.6 遷移指引

既有 Hook 從框架共用層遷移到 Skill 私有層時：

1. 確認 Hook 觸發條件與單一 Skill 強耦合（如 ticket / worktree / wrap-decision 專屬）
2. 移檔：`.claude/hooks/<name>.py` → `.claude/skills/<skill>/hooks/<name>.py`
3. 更新 `settings.json` command 路徑
4. 執行 `hook-completeness-check.py` 確認兩層註冊狀態
5. 同 commit 提交檔案搬遷 + settings.json 變更，避免中途 hook 失效

---

## 相關規則

- `.claude/rules/README.md` - 規則系統導航（含本文件索引）
- `.claude/references/reference-stability-rules.md` - 規格引用穩定性規則（規則 8）
- `.claude/error-patterns/architecture/ARCH-012-agent-project-specific-hardcoding.md` - 代理人定義硬編碼專案特定內容的錯誤模式
- `.claude/error-patterns/process-compliance/PC-061-memory-upgrade-blindness.md` - Memory 跨專案原則升級遺漏的錯誤模式
- `.claude/hooks/hook-completeness-check.py` - 雙層 Hook 掃描器
- `.claude/plugin-dev/hook-development/SKILL.md`（plugin-dev plugin）- Claude Code Hook 開發通用指引（事件、API）

---

**Last Updated**: 2026-05-11
**Version**: 1.1.0 — 新增 §3 Skill Hook 雙層架構章節（命名 / 路徑 / 註冊規範 / 掃描器行為 / 遷移指引）
**Version**: 1.0.0 — 從 `.claude/rules/README.md` 拆出。原因：本章節屬情境觸發型知識（設計新規則/Skill/文件時才需），不符合 auto-load 原則。
