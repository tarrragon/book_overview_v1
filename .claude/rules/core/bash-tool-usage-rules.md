# Bash 工具使用規則

Claude Code Bash 工具的使用規範，涵蓋工作目錄、輸出處理、git 串接三大核心問題。

> **持久狀態意識**：Bash 在同一 session 內共享 shell。`cd` 會永久改變工作目錄；大輸出會存為暫存檔。
> **詳細案例、根因圖解、chpwd 深度說明**：`.claude/references/bash-tool-usage-details.md`

---

## 規則一：禁止使用 cd 改變持久工作目錄

| 場景 | 錯誤做法 | 正確做法 |
|------|---------|---------|
| 在特定目錄執行命令 | `cd .claude/skills/ticket && uv run ...` | `(cd .claude/skills/ticket && uv run ...)` |
| uv 指定目錄 | `cd .claude/skills/ticket && uv run ...` | `uv -d .claude/skills/ticket run ...` |
| 工作目錄已污染 | 無操作 | `cd /your/project/root && ...` |

**三種安全做法速查**：

| 方法 | 指令形式 | 適用情境 |
|------|---------|---------|
| 子 shell（推薦） | `(cd path && command)` | 任何命令，通用最廣 |
| uv -d 參數 | `uv -d path run ...` | 僅限 uv 指令 |
| 絕對路徑還原 | `cd /project/root && ...` | 污染後補救 |

> **chpwd 警告**：本環境 zsh 有 `chpwd` hook，裸 `cd` 觸發 `ls` 淹沒工具結果。必須用子 shell `()`。

---

## 規則二：正確區分 TaskOutput vs 暫存輸出檔案

| 機制 | 觸發條件 | 識別特徵 | 正確處理工具 |
|------|---------|---------|------------|
| 背景任務 | `run_in_background: true` | 訊息含「background task」 | `TaskOutput` |
| 暫存輸出檔案 | 輸出 > 2KB | `Full output saved to: /path/...txt` | `Read` |

**判斷速查**：
- 呼叫時設 `run_in_background: true` → `TaskOutput(taskId: "...")`
- 輸出含 "Full output saved to: /path/xxx.txt" → `Read(file_path: "/path/xxx.txt")`
- 兩者皆非 → 直接讀取對話中的輸出

**主動預防大輸出**：

| 工具 | 大輸出防護 |
|------|----------|
| Bash（測試） | `flutter test 2>&1 \| tail -20` |
| Bash（一般） | `命令 \| head -100` 或 `\| wc -l` 確認大小 |
| Grep | 使用 `head_limit` 限制回傳行數 |
| Read | 使用 `offset` + `limit` 分頁讀取 |

---

## 規則三：禁止串接多個 git 寫入操作

| 組合 | 允許 | 原因 |
|------|------|------|
| `git add && git commit` | 允許 | add 不觸發 Hook，commit 是唯一寫入 |
| `git commit && git merge` | 禁止 | Hook 和 merge 競爭 index.lock |
| `git commit && git push` | 禁止 | push 可能觸發遠端 Hook |
| `git merge && git push` | 禁止 | 同上 |

**正確做法**：每個 git 寫入操作（commit/merge/rebase/push）獨立一個 Bash 呼叫。

---

## 統一檢查清單

執行 Bash 命令前：

- [ ] 命令含 `cd`？→ 改用子 shell `()` 或 `uv -d`
- [ ] 多步驟序列？→ 第一步加絕對路徑 `cd /project/root &&`
- [ ] 輸出可能很大？→ 提前加 `head` / `tail`
- [ ] `run_in_background: true`？→ 用 `TaskOutput(taskId)`
- [ ] 輸出含「Full output saved to」？→ 用 `Read(file_path)`
- [ ] 串接多個 git 寫入（commit/merge/rebase/push）？→ 拆成獨立呼叫
- [ ] 看到 `index.lock` 錯誤？→ 確認是否有 git 串接

---

## 相關文件

- `.claude/references/bash-tool-usage-details.md` — 詳細案例、根因圖解、chpwd 深度說明
- `.claude/references/quality-python.md` — Python 執行規則
- `.claude/error-patterns/implementation/IMP-008-bash-working-directory-pollution.md`
- `.claude/error-patterns/implementation/IMP-009-taskoutput-confusion.md`
- CLAUDE.md — 專案開發規範

---

**Last Updated**: 2026-04-16
**Version**: 2.0.0 — 骨架保留 + 詳細案例遷 references（W10-077.4）
**Source**: IMP-008、IMP-009、index.lock 競爭
