---
id: PC-087
title: PM 寫 /tmp 中介檔作為 ticket 內容寫入繞路
category: process-compliance
severity: medium
created: 2026-04-18
---

# PC-087: PM 寫 /tmp 中介檔作為 ticket 內容寫入繞路

## 症狀

PM 主線程準備寫長篇 Solution/分析內容到 ticket 時，先 Write 到 `/tmp/xxx.md` 作為中介檔，打算後續用 `cat /tmp/xxx.md | ticket track append-log` 的方式注入 ticket。

實際觸發：main-thread-edit-restriction-hook 攔截 `/tmp` 路徑不在白名單，工作流中斷。

## 根因

PM 習慣「先寫檔案再引用」的 shell 傳統做法，未意識到：

1. **主線程編輯白名單**（W10-033）僅含：`.claude/`、`docs/**`、`CLAUDE.md`、`CHANGELOG.md`、`.gitignore`。`/tmp/` 不在其中。
2. Ticket 內容寫入有**兩條直接路徑**不需中介檔：
   - `ticket track append-log <id> --section X "$(cat <<'EOF' ... EOF)"` 直接 heredoc
   - `Edit` ticket md 檔本身（ticket 在 `docs/work-logs/` 白名單內）

中介檔 = 多餘的一層，無收益且違反白名單。

## 防護

### 規則（即時）

PM 寫 ticket 內容時禁止使用 `/tmp/` 或任何白名單外路徑作為中介檔。直接用 heredoc 或 Edit ticket md。

### 識別信號

| 信號 | 含義 |
|------|------|
| 準備 Write 到 `/tmp/*.md` | 99% 是繞路，停下來問：目的是什麼？ |
| 目的是「準備 append-log 內容」 | 改用 heredoc 內嵌 |
| 目的是「準備 Edit ticket 區段」 | 直接 Edit ticket 檔 |
| 目的是「分享給其他代理人」 | 寫入 ticket body 或 `.claude/plans/` |

### Bash 規則四擴充適用

PC-079（Bash 規則四）禁止 backtick 被 command substitution。本 PC-087 與其同源——都是「透過 shell 中介傳遞長文字」引發的工作流阻塞。

統一解法：**heredoc with quoted delimiter 是 PM 傳遞長文字的預設選擇**。

## 案例

- 2026-04-18 (W15-001 session)：PM 準備 WRAP 分析結論寫入 W15-001 ticket，先 Write `/tmp/w15_001_solution.md` → hook 攔截 → 改用 heredoc 內嵌 append-log 成功。用戶質疑「為什麼寫 /tmp 而不寫 ticket？」暴露此繞路習慣。

## 相關

- `.claude/rules/core/bash-tool-usage-rules.md` 規則四（backtick）
- `.claude/error-patterns/process-compliance/PC-079-bash-backtick-command-substitution-in-cli-args.md`
- W10-033：`.gitignore` 加入白名單的前例（白名單擴充需走 Ticket 流程）
