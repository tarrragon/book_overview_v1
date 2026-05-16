---
id: PC-148
title: Hook 雙重註冊：settings.local.json python3 直呼繞過 shebang pep723 deps
category: process-compliance
severity: medium
source_case: 0.18.0-W11-030
created: 2026-05-16
---

# PC-148: Hook 雙重註冊 shebang bypass

## 症狀

派發 Agent / 觸發 Hook 事件時，UI 出現以下並存訊號：

- `.claude/hook-logs/<hook-name>/...log` 顯示 `INFO` 成功通過
- Claude Code UI 同時顯示 `PreToolUse:Agent hook error: Failed with non-blocking status code: Traceback (most recent call last): ModuleNotFoundError: No module named 'yaml'`（或其他模組）

兩條訊號矛盾——log 說成功、UI 說失敗。雖 non-blocking 不阻擋執行，但污染 UI 與用戶信任。

## 觸發條件

以下三條件同時成立：

1. **同一 hook 在 `.claude/settings.json` 與 `.claude/settings.local.json` 都被註冊**
2. **兩處註冊形式不同**：
   - `settings.json` 用 `$CLAUDE_PROJECT_DIR/.claude/hooks/foo-hook.py`（依 shebang 執行，hook 必有 `#!/usr/bin/env -S uv run --quiet --script` + pep723 deps）
   - `settings.local.json` 用 `python3 $CLAUDE_PROJECT_DIR/.claude/hooks/foo-hook.py`（強制系統 python3，繞過 shebang 與 pep723）
3. **hook 程式碼或其 import 的 lib 模組頂層 import 非 stdlib 套件**（如 `pyyaml`），pep723 deps 已宣告

## 根因

Claude Code runtime 對同一事件同一 matcher 的多處註冊會**逐一執行**，兩條執行路徑：

| 來源 | 執行方式 | pep723 deps | 結果 |
|------|---------|-------------|------|
| settings.json | shebang `uv run --script` | 生效 | hook 正常執行，寫 INFO log |
| settings.local.json | `python3 ...` 直呼 | **繞過** | top-level `import yaml` 觸發 ModuleNotFoundError，吐 stderr traceback |

「hook log 顯示成功」與「stderr 吐 traceback」並存是雙重註冊的指紋。

## 與相鄰 PC 模式區分

| 模式 | 觸發 | 本案區別 |
|------|------|---------|
| PC-124 (subagent pytest vs hook subprocess env) | uv ephemeral env transitive deps 不裝 | 本案 deps 已宣告，問題在「執行路徑繞過 pep723」 |
| PC-135 (lib refactor caller sync) | caller hook 漏宣告新 lib 引入的 deps | 本案三個 caller (agent-dispatch-validation / layer-boundary-validator / commit-msg-layer2-marker-check) 都已宣告 pyyaml，問題在第二處註冊形式 |

本案為**全新模式**：deps 完整、caller 同步、ephemeral env 也正常，但設定檔層級的重複註冊用了「強制 python3」形式打破單一執行路徑假設。

## 防護措施

| 層級 | 動作 |
|------|------|
| 規則層 | 規範 `settings.local.json` 不重複註冊 `settings.json` 已有的 hook；若需 local override 應明示移除 base 對應 entry |
| Hook 層 | 新增 `settings-duplicate-hook-registration-check-hook.py` 比對 `settings.json` 與 `settings.local.json` 同事件同 matcher 的命令前綴，若重複則啟動時 warn |
| 文件層 | `.claude/references/hook-architect-technical-reference.md` 補「禁止用 `python3` 直呼形式註冊 hook」章節，統一以 `$CLAUDE_PROJECT_DIR/.claude/hooks/foo-hook.py`（依 shebang） |
| 自檢層 | session 啟動 hook 健康檢查補「PreToolUse Agent matcher 註冊數 > 預期」訊號偵測 |

## 修正動作

1. 確認 `settings.json` 該 hook 註冊形式正確（shebang 路徑）
2. 從 `settings.local.json` 對應 event/matcher block 移除重複條目
3. 跑 smoke test 派發任意 agent，確認 UI 無 traceback
4. shebang 路徑直接 exec hook（`echo '{}' | .claude/hooks/foo-hook.py`），確認 exit 0

## 自我檢查清單

- [ ] 同一 hook 是否在 settings.json + settings.local.json 都註冊？
- [ ] 兩處註冊形式是否一致（都走 shebang）？
- [ ] settings.local.json 是否有 `python3` 或其他語言直接呼叫 hook 的字串？
- [ ] hook log 顯示成功時，UI 是否仍出現 traceback？

## 案例

- 0.18.0-W11-030 ANA 發現本模式（basil-hook-architect 調查）
- 0.18.0-W11-030.1 修復 `.claude/settings.local.json:199-209`，commit 0208d13d
