# W1-024 唯讀審查：bash-edit-guard 裸 cd 偵測（f52feaee）+ 收窄修正（c6809c1f）

審查日期：2026-06-10
審查範圍：`.claude/hooks/bash-edit-guard-hook.py`、`.claude/hooks/tests/test_bash_edit_guard_hook.py`、`.claude/hooks/lib/hook_messages.py`
方法：git show 兩 commit + 現行檔案閱讀 + 邊界案例以等價邏輯實機重現（15 案例）+ 全測試套件執行（28 passed in 0.05s）

**實機旁證**：審查過程中本人一次含 `cd /tmp` 的命令即時觸發本 hook 的 BARE_CD_WARNING（warn 不 deny、訊息走 ValidationMessages 常數、附 git -C 建議），且 chpwd ls 淹沒隨即發生——hook 偵測目標問題真實存在、production 路徑已生效。

---

## 檢查點 1：裸 cd 偵測 false positive 風險

整體判定：**設計取捨合理**（warn-only、FP 成本低、docstring 已明示「無完整 shell parse」務實邊界），但有 1 個未文件化的 false negative 與數個 FP 邊界值得記錄。

### 1.1 子 shell `(cd ...)`

- 基本形式 `(cd path && cmd)`、含空白 `( cd path)`、`$(cd x && pwd)`、`` `cd x && pwd` `` 均正確排除（command substitution 因 `(` / backtick 前置巧合不命中，實測 False）。**通過**。
- **[Low] 巢狀第二個 cd FP**：`(cd a && cd b)` 中第二個 cd 的 connector 是 `&&` 非 `(`，命中 warn（實測 True）。子 shell 內的 cd 不改變持久 cwd，屬誤報。
  - 證據：`bash-edit-guard-hook.py:115-121`（排除僅檢查 match 自身 connector，無括號平衡追蹤）
  - 建議：可接受不修（warn-only + 此 pattern 罕見）。若要修，需追蹤未閉合括號深度，成本與收益不成比例；建議在 docstring「務實邊界」段補一句「子 shell 內串接的後續 cd 可能誤報」。

### 1.2 git -C / uv -d

- `git -C /abs status`、`uv -d path run` 實測 False，且 `\bcd\s+` 要求空白後接引數，`cdrom` 等字面不命中。**通過**。
- [Info] `bash-edit-guard-hook.py:114` 註解寫 `\bcd\b`，實際 regex 是 `\bcd\s+`（無尾 `\b`，靠 `\s+` 排除 cdrom）；行為正確，註解與 regex 字面不符。

### 1.3 引號字串內 cd 字面

- **[Low] FP 已知邊界**：`echo "foo; cd bar"`、`git commit -m "x && cd subdir fix"` 實測 True（誤報）。docstring `bash-edit-guard-hook.py:97-99` 已明示此限制且 warn 不 deny。本 repo 大量撰寫關於 cd 的規則文件，commit 訊息含「&& cd」字面的機率高於一般專案，但 PC-079/規則五已要求 commit 訊息用 heredoc（heredoc 行首 cd 不命中，見 1.4），實際干擾有限。**通過（接受的設計取捨）**。

### 1.4 heredoc 內 cd 字面

- heredoc body 行首的 `cd subdir` 實測 False（regex `^` 無 re.MULTILINE，只匹配字串開頭）——多數 heredoc 文件內容不誤報。
- **[Low] FP**：heredoc body 行內含 `&& cd` / `; cd`（如 append-log 貼規則表格）實測 True。docstring 已涵蓋此限制。**通過（已文件化）**。

### 1.5 [Medium-Low] 未文件化 false negative：換行分隔的裸 cd

- `echo hi\ncd subdir`（多行命令、第二行行首 cd）實測 **False**——真裸 cd 漏報。`^` 無 `re.MULTILINE` 是 1.4 不誤報的原因，同時也是此 FN 的原因（同一個設計的兩面）。Bash 工具多行命令常見，此為偵測空窗。
  - 證據：`bash-edit-guard-hook.py:115` regex `(^|&&|;|\|\||\()` 無 `\n` alternation、無 MULTILINE flag
  - 建議：在 connector alternation 加 `\n`（`(^|\n|&&|;|\|\||\()`）即可補上行首 cd 而不需 MULTILINE（避免 heredoc 行首 cd 誤報擴大——注意加 `\n` 後 heredoc body 行首 cd 也會命中，需與 1.4 取捨；或在 docstring 明示此 FN 為接受邊界）。二擇一即可，現狀至少應文件化。
- [Info] 其他 FN（罕見，可接受不修）：`{ cd x; } && ls`（brace group 確實改 cwd，實測 False）、`ls | cd x`（無害）、單一 `&` 背景串接後 cd。

---

## 檢查點 2：W1-026 絕對路徑排除收窄邏輯

整體判定：**通過**。收窄方向正確且失效方向安全——所有邊界失敗都落在「多 warn」而非「漏放行」，與 warn-only 設計一致。

### 2.1 repo-root 判定方式

- 以 `CLAUDE_PROJECT_DIR` 環境變數為權威（`bash-edit-guard-hook.py:109`），由 Claude Code runtime 在 hook 呼叫時注入，是正確的專案根來源（優於自行 git rev-parse，零 subprocess 成本）。
- env 未設時 `project_root=None` → 排除完全停用，所有絕對路徑 cd 都 warn（保守 fallback），有測試覆蓋（`test_env_unset_repo_root_also_hits`）。**通過**。
- [Info] 病態邊界：`CLAUDE_PROJECT_DIR=/` 時 `rstrip('/')` 得空字串 → falsy → 排除停用，仍是保守方向，無風險。

### 2.2 symlink

- **[Low] 未處理**：比較為純字串（`bash-edit-guard-hook.py:125`），無 `os.path.realpath`。經 symlink 別名還原至專案根（或 `cd $ROOT/docs/..`，實測 True）會誤 warn 合法還原。
  - 失效方向安全（多 warn 非漏擋）；macOS 大小寫不敏感檔案系統的大小寫差異路徑同理（`cd /users/...` 實測 True warn）。
  - [Info] docstring `bash-edit-guard-hook.py:93` 寫「target 正規化後恰等於專案根」，實際「正規化」僅 `rstrip('/')`，無 normpath/realpath，用詞略高於實作。建議改為「去尾斜線後恰等於」或補實 `os.path.normpath`。
- [Low] 同類字串比較限制：`cd "$CLAUDE_PROJECT_DIR"`、`cd "/Users/.../book_overview_v1"`（引號包路徑）實測 True——引號字元進入 `\S+` capture 導致合法還原誤 warn。規則文件範例均用未加引號絕對路徑，實務影響小。

### 2.3 尾斜線

- 雙側 `rstrip('/')`（`:111` + `:125`），`cd /<root>/` 實測排除成功，有專屬測試（`test_repo_root_restore_trailing_slash`）。**通過**。

### 2.4 收窄本身的正確性

- 舊版 `target.startswith('/')` 確實放行 `cd /<root>/subdir`（最常見違規），W1-026 修正命中此缺口；`cd /<root>/.claude/...`、`cd /tmp/other` 恢復 warn 均有測試。修正的問題陳述（commit message + docstring W1-026 段）與 diff 一致。**通過**。

---

## 檢查點 3：測試覆蓋

整體判定：**通過（有可補強缺口，均 Low）**。28 passed；命中四形式（^/&&/;/||）、排除四分支、收窄五案例（subdir/other-abs/chained/env-unset×2）、trailing slash、regression（sed -i/perl -pi 共 6）、main() 端到端（allow 非 deny、非 Bash 跳過、乾淨命令零輸出）皆有覆蓋。

缺口（均未阻擋驗收，建議列入後續補強）：

| 缺口 | severity | 說明 |
|------|----------|------|
| 雙警告合併路徑 | Low | `sed -i ... && cd subdir` 同時命中兩偵測時 `"\n\n".join(warnings)`（hook.py:210）無測試；單一 JSON 輸出契約（IMP-055）值得鎖定 |
| 換行 FN 特性化 | Low | 1.5 的多行命令 FN 無測試亦無 docstring 記載——至少加 xfail/特性化測試把已知邊界固定下來 |
| 引號/heredoc FP 特性化 | Low | docstring 宣告的務實邊界無對應特性化測試，行為變更時無回歸訊號 |
| symlink / 引號 root / `$VAR` root | Low | 2.2 的三個合法還原誤 warn 情境無測試 |
| 測試硬編碼 `_REPO_ROOT` | Info | `test_bash_edit_guard_hook.py:118` 硬編碼本機絕對路徑，但全部配合 monkeypatch.setenv 使用，環境無關、可移植，無實際問題 |

---

## 檢查點 4：hook 失敗可見性（quality-baseline 規則 4）

整體判定：**通過（含一項 pre-existing 觀察）**。

- 未捕獲異常路徑：`run_hook_safely`（hook.py:228）→ `_log_exception`（hook_utils/hook_logging.py:221-237）→ logger.critical 寫檔案日誌 + `sys.stderr.write("[Hook Error] ...")`，且日誌寫入失敗時備援直寫 stderr——雙通道完整。**通過**。
- [Low / pre-existing，非本二 commit 引入] main() 內層 `except Exception`（hook.py:221-224）僅 `logger.error` 後 return 0。StreamHandler 正常模式 level=CRITICAL（hook_logging.py:44），ERROR 級不達 stderr → 內層異常僅檔案日誌單通道。此為 IMP-048（stderr 觸發 UI hook error）的刻意取捨，但與規則 4 表格「Hook 異常：stderr 必須 + 日誌必須」存在張力。本二 commit 未新增任何 except 區塊，不在 diff 範圍；建議另行以 ANA 釐清 IMP-048 取捨與規則 4 的優先序（或在規則 4 補豁免註記）。
- [Info / pre-existing] `_print_warning_message`（hook.py:136-150）docstring 寫「輸出警告訊息到 stderr」、型別註記 `-> None`，實際回傳 str 且不寫 stderr——f52feaee 重構為回傳值合併輸出後 docstring 未同步。新增的 `_bare_cd_warning_message` 註記正確（`-> str`），對照可證舊函式為遺留。建議順手修 docstring + 註記。
- 新增偵測路徑的可觀測性：命中時 `logger.info("提示: 偵測到裸 cd...")`（hook.py:199）留檔案日誌、警告經 `emit_hook_output` additionalContext 上送（實機已驗證可見）。**通過**。

---

## 檢查點 5：測試檔 mode 644→755 變更必要性

整體判定：**非必要但無害；機制層面建議收斂範圍**。

- 事實鏈：f52feaee 以 644 新增測試檔 → 後續 commit `c517a939`（chore: HookCheck IMP-054 自動 chmod +x）由 `hook-completeness-check.py` 的 `_check_and_fix_permissions` 自動改 755 並 auto-commit。該函式 `rglob("*.py")` 掃描 hooks_dir 全樹僅排除 `__pycache__/.venv/node_modules`，**未排除 `tests/`**（hook-completeness-check.py:54-58）。
- [Low] pytest 測試檔不需執行位（經 `npm run test:hooks` → `uv run pytest` 執行）。IMP-054 的動機（PC-086：hook 入口檔缺執行位致 Permission denied）只適用於被 settings.json 直呼的 hook 入口，tests/ 不在此列。
- [Low] 加執行位的輕微反效果：本測試檔 shebang 為 `#!/usr/bin/env python3`（test_bash_edit_guard_hook.py:1，非 uv pep723 script shebang），755 後可被 `./test_...py` 直接執行，落入系統 python3（可能無 pytest），形成 PC-148 同型的「shebang 繞過 uv 環境」誤用入口。
- 建議：`_check_and_fix_permissions` 的 skip 清單加入 `tests`（一行修改），使 IMP-054 自動修權限聚焦 hook 入口檔；既有測試檔 755 可不回退（無安全影響，回退反而會被現機制再次 chmod 形成乒乓）。
- 註：當前 working tree 的 `M .claude/hooks/tests/test_error_pattern_flat_gate_hook.py` 為同一 auto-chmod commit 的姊妹檔案，與本審查二 commit 無關。

---

## 結論摘要

| # | 檢查點 | 判定 | 發現數（severity） |
|---|--------|------|--------------------|
| 1 | 裸 cd FP 風險 | 通過（設計取捨合理） | 1 Medium-Low FN（換行 cd 漏報，未文件化）、3 Low FP（巢狀子 shell/引號/heredoc，後二者已文件化）、2 Info |
| 2 | W1-026 收窄邏輯 | 通過（失效方向安全） | 2 Low（symlink 與引號路徑誤 warn 合法還原）、2 Info（docstring「正規化」用詞、`/` 病態邊界） |
| 3 | 測試覆蓋 | 通過 | 4 Low 缺口（雙警告合併/FN 特性化/FP 特性化/symlink 系列）、1 Info |
| 4 | 失敗可見性 | 通過 | 1 Low pre-existing（內層 except 單通道 vs 規則 4 張力）、1 Info pre-existing（stale docstring） |
| 5 | mode 644→755 | 非必要但無害 | 2 Low（auto-chmod 範圍含 tests/ 過寬；python3 shebang + 執行位的直呼誤用入口） |

無任何 High/Critical 發現；兩 commit 方向正確、收窄修正解決了真實缺口（絕對子目錄放行）、warn-only 設計使所有殘餘 FP/邊界的成本維持在可接受範圍。建議落地項（依價值排序）：(a) 換行 FN 文件化或補 `\n` connector、(b) `_check_and_fix_permissions` 排除 tests/、(c) `_print_warning_message` docstring/型別註記修正、(d) 雙警告合併測試、(e) 附錄 A 的測試日誌隔離。

---

## 附錄 A：審查期間 SubagentStop「Hook 錯誤摘要」查證（順帶發現）

審查結束時 SubagentStop 摘要回報 command-entrance-gate / uv-tool-staleness-check-hook / ticket-quality-gate 三個 hook 近 5 分鐘有錯誤記錄。逐一查證結果：**三者均非 production 失效，未影響本審查執行**。

| Hook | 日誌證據 | 判定 |
|------|---------|------|
| command-entrance-gate | `command-entrance-gate-20260610-031206.log`：CRITICAL traceback 經 `unittest/mock.py`、`Exception: 讀取錯誤`（mock side_effect 字面）、含虛構 ticket（0.20.0-W1-013「實作使用者登入流程」、0.1.0-W39-*） | pytest 測試案例執行 main() 的錯誤路徑，非 production 錯誤 |
| ticket-quality-gate | `ticket-quality-gate-20260610-031208.log`：`ERROR - tool_input 缺少必要欄位: content`，與上者同一秒級時間窗 | 同上，invalid-input 測試路徑 |
| uv-tool-staleness-check-hook | `uv-tool-staleness-check-hook-20260610-024505.log`：僅兩條 WARNING（source missing: version-release / branch-worktree-guardian skill 源目錄） | 真實 staleness 提醒，非錯誤，與本審查無關 |

### [Low] 系統性發現：hook pytest 套件污染 production hook-logs

`setup_hook_logging` 無測試隔離機制，測試直呼 `hook_module.main()` 時日誌寫入真實 `.claude/hook-logs/<hook>/`。實證：本審查執行 `pytest tests/test_bash_edit_guard_hook.py` 後，`.claude/hook-logs/bash-edit-guard/` 即出現 03:06-03:11 多個新日誌檔——**本次審查的標的測試檔（TestMainBehavior 直呼 main()）也是此模式的貢獻者**。

- 後果：測試的 ERROR/CRITICAL 級日誌觸發 hook-health-monitor / SubagentStop「Hook 錯誤摘要」誤報，稀釋告警可信度（與 quality-baseline 規則 4 的可見性設計對沖——誤報多了之後真錯誤會被忽略）。
- 建議：hook 測試共用 fixture 將日誌導向 tmp_path（patch `setup_hook_logging` 或其 log_base_dir），或 hook-health-monitor 摘要過濾含 `unittest/mock.py` 的 traceback。建議依規則 5 另建 ticket 追蹤（本審查唯讀，不落地）。
