---
name: framework-issue
description: "Creates and lists framework issues on the canonical framework repo (tarrragon/claude) via gh CLI. Use when tracking a framework-level problem, error-pattern canonical reference, provenance anchor, or cross-consumer fix across projects. Triggers include: framework issue, canonical issue, 跨 consumer 修復追蹤, 框架 issue, error-pattern canonical. Do NOT use for project-local docs/work-logs tickets (use the ticket skill instead)."
---

# Framework Issue

於框架 canonical repo（`tarrragon/claude.git`）標準化建立與查詢 framework
issue。framework issue 三重用途：provenance 錨點、error-pattern canonical
去重 key、跨 consumer 修復追蹤。本 skill 僅包 `gh` CLI，所有不可用狀態優雅降級。

## Commands

| 命令 | 包裝 | 用途 |
|------|------|------|
| create | `gh issue create --repo tarrragon/claude.git` | 建立 framework issue |
| list | `gh issue list --repo tarrragon/claude.git` | 列出 / 去重查詢 framework issue |

> 範圍：本 skill 首建僅 create / list。link（canonical_issue stamp）與
> fix-status（修復矩陣）為後續 ticket，尚未實作。

## Usage

create：

```bash
python3 .claude/skills/framework-issue/scripts/create_issue.py \
  --title "標題" [--body "內文"] [--label bug] [--label canonical]
```

list：

```bash
python3 .claude/skills/framework-issue/scripts/list_issues.py \
  [--state open|closed|all] [--label X] [--limit 30] [--search "關鍵字"]
```

建 issue 前先用 `list --search "<關鍵字>"` 查既有 canonical issue 避免重複。

## Graceful Degradation

`scripts/gh_common.py` 的 `preflight()` 與 `run_gh()` 將下列狀態轉為清楚的
stderr 提示與 exit code `3`（`EXIT_DEGRADED`），不拋 traceback：

| 狀態 | 偵測 | 提示方向 |
|------|------|---------|
| gh 未安裝 | `shutil.which("gh")` 為 None | 安裝 GitHub CLI |
| gh 未登入 | `gh auth status` exit != 0 | 執行 `gh auth login` |
| 目標 repo Issues 停用 | gh stderr 含 disabled + issue | 於 repo Settings 啟用 Issues |
| gh 執行例外 | OSError / SubprocessError | 確認安裝完整與網路可用 |

exit code：`0` 成功、`3` 降級、其餘為 gh 原始錯誤碼經 `run_gh` 轉為 `3`。

## Examples

| 情境 | 動作 | 結果 |
|------|------|------|
| 建 canonical issue | `create --title "X" --label canonical` | 成功印 issue URL，exit 0 |
| 去重查詢 | `list --search "PC-V1-009"` | 列出符合 issue，exit 0 |
| gh 未登入 | 任一命令 | stderr 提示 `gh auth login`，exit 3 |

## Testing

```bash
uv run --project .claude/hooks pytest \
  .claude/skills/framework-issue/tests/ -v
```

測試以 mock 攔截 gh subprocess，不真打 GitHub API；涵蓋正常路徑與三種降級路徑。
