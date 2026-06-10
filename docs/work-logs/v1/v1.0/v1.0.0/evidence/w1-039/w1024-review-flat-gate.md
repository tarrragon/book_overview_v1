# W1-024 唯讀審查：error-pattern-flat-gate-hook + settings.json 註冊

審查範圍：origin/main..HEAD 未推送 commits（hook 本體 144 行 + 測試 148 行 + settings.json 註冊 2 處）。
審查方式：唯讀（git -C diff / Read / 唯讀 smoke test，未修改任何檔案、未做 git 寫入）。

---

## 檢查點 1：settings.json 註冊（IMP-051 模式）— 通過

- 證據：`.claude/settings.json` diff 顯示新增 2 處註冊，分別位於 PreToolUse 的
  `"matcher": "Edit"` 區塊（hook 列於 line 157）與 `"matcher": "Write"` 區塊（hook 列於 line 198）。
- 路徑形式正確：`$CLAUDE_PROJECT_DIR/.claude/skills/error-pattern/hooks/error-pattern-flat-gate-hook.py`，
  與 hook 實際落點一致（`find` 確認檔案存在於該路徑）。
- Event 類型正確：PreToolUse + permissionDecision 輸出是 deny gate 的正規組合；
  matcher（Write|Edit）與 hook 內部 `WRITE_TOOLS = frozenset({"Write", "Edit"})`（hook:48）一致，無漏接也無冗餘觸發。
- 結論：**非 IMP-051 模式**（新建已同步註冊）。

### 附帶觀察（severity: info，非阻擋）

Bash 重導向繞過面：`cat > .claude/error-patterns/.../PC-180-x.md` 不經 Write/Edit，
本 hook 不觸發。既有 `bash-edit-guard-hook.py`（PreToolUse Bash matcher）僅 warn 不 deny，
且檢測清單針對程式碼副檔名（.dart/.arb/.json），不含 .md（bash-edit-guard-hook.py:14-21）。
此為已知設計取捨（hook 防的是 LLM 慣用 Write/Edit 路徑），不建議本 ticket 擴 scope；
若要補強屬 follow-up 範圍。

## 檢查點 2：PEP 723 依賴宣告（PC-124/PC-135 模式）— 通過

- hook 宣告 `dependencies = []`（hook:2-5），shebang `#!/usr/bin/env -S uv run --quiet --script` 與全 repo hook 慣例一致。
- Transitive deps 全量驗證：hook import `hook_utils`（setup_hook_logging / run_hook_safely /
  read_json_from_stdin / emit_hook_output）與 `lib.pattern_id`。逐檔 grep 確認
  `hook_utils/{hook_base,hook_io,hook_logging,hook_ticket}.py` 與 `lib/pattern_id.py`
  的 import 全為 stdlib（logging/os/sys/json/re/subprocess/pathlib/datetime/typing），
  **無 pyyaml 等第三方依賴**。`dependencies = []` 宣告準確。
- 跨目錄 import 機制驗證：`parents[3] / "hooks"` 路徑計算正確
  （hooks→error-pattern→skills→.claude，hook:31-35），smoke test 實際以 uv shebang 執行成功（見檢查點 3）。

## 檢查點 3：stdout JSON 完整性（IMP-055 模式）— 通過

- hook 經 `emit_hook_output("PreToolUse", permission_decision=..., permission_decision_reason=...)`
  （hook:117-121, 135-139）輸出，底層 `generate_hook_output`（hook_io.py:508-546）保證
  `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": ..., "permissionDecisionReason": ...}}` 完整結構。
- 實機 smoke test（唯讀，不寫檔）：
  - deny 路徑（新建 flat 號 PC-999）：stderr 輸出引導訊息 + stdout 完整 JSON（含 hookEventName）+ EXIT=2
  - allow 路徑（前綴號 PC-V1-001）：stdout 完整 JSON + EXIT=0
- 空輸入 fallback 也走 emit_hook_output（hook:115-122），無半結構化輸出路徑。
- deny 的 exit 2 + JSON 並用與既有 `mcp-write-tool-on-text-file-guard-hook.py` 慣例一致
  （該檔 EXIT_BLOCK = 2，line 34/152）。
- 規則 4 雙通道符合：deny 時 stderr（hook:131）+ logger.info（hook:130）並行。

## 檢查點 4：執行權限位（PC-086 模式）— 通過

- `ls -l` 證據：`-rwxr-xr-x  .claude/skills/error-pattern/hooks/error-pattern-flat-gate-hook.py`（755）。
- uv shebang 直呼成功（smoke test 即透過 shebang 執行），無 Permission denied 風險。

## 檢查點 5：測試覆蓋主路徑 — 部分通過，1 項發現

- 測試現況：`test_error_pattern_flat_gate_hook.py` 共 14 個 test 函式（參數化展開後 20 cases），
  `uv run --project . pytest` 實跑 **20 passed in 0.02s**。
- 覆蓋內容：`decide()` 純函式四分支（deny 新建 flat / allow 前綴新建 / allow 既有 flat 編輯
  含 Write 覆蓋 / allow 非範圍工具與空 input）+ `is_flat_id` / `is_error_pattern_file` 輔助判定。
  deny message 含 `/error-pattern add` 引導也有斷言（test:87）。

### 發現 5-1（severity: low）：無 subprocess 整合測試覆蓋 main() 路徑

- 證據：測試以 `importlib.util.spec_from_file_location` 載入模組（test:26-39），
  僅呼叫 `decide()` 與 helpers；`main()`（stdin 解析 → emit_hook_output → exit code，hook:110-140）
  與 `run_hook_safely` wrapper（hook:144）無自動化覆蓋。
- 對照：repo 內已有 8+ 個 hook 測試檔使用 subprocess（如 `test_uv_tool_ownership_guard_hook.py`），
  慣例存在；但本檔 docstring 明示「與 test_error_pattern_allocator.py 同慣例，
  skill 完整 package 化屬 W1-001 上架範圍」（test:3-5），屬有意識的範圍決策而非遺漏。
- 緩解：本次審查已手動 smoke test main 主路徑（deny: stderr+JSON+exit 2；allow: JSON+exit 0），
  端到端行為正確；風險殘留在「未來改 main()/IO 層時無回歸防護」。
- 建議：W1-001（skill package 化）落地時補 1-2 個 subprocess 整合測試
  （echo JSON | hook; 斷言 exit code + stdout JSON shape），與既有 subprocess 測試慣例對齊。
  不阻擋本 ticket。

---

## 額外品質觀察（severity: info）

1. SSOT 遵循良好：ID 解析複用 `lib/pattern_id.py` 的 `extract_pattern_id`（ARCH-020），
   未再造 regex。pattern_id 的 IGNORECASE 使小寫檔名 `pc-179-x.md` 也被正確攔截。
2. 邊界 case：理論上 `PC-2-179-foo.md`（純數字專案碼）會被判為 3 段前綴號放行；
   專案碼慣例（V1/APP/C2C）含字母，實務上不構成漏洞，僅記錄。
3. 測試檔位置 `.claude/hooks/tests/` 與 hook 本體 `.claude/skills/error-pattern/hooks/`
   分離，docstring 已明示為暫借 pytest env 的過渡安排（綁定 W1-001 trigger，符合決策 trigger 綁定規則）。

## 結論

| 檢查點 | 結果 |
|--------|------|
| 1. settings.json 註冊 | 通過（雙 matcher 正確、$CLAUDE_PROJECT_DIR 形式、非 IMP-051） |
| 2. PEP 723 依賴 | 通過（`dependencies = []` 準確，transitive 全 stdlib） |
| 3. stdout JSON | 通過（完整 hookSpecificOutput，deny/allow 雙路徑實測） |
| 4. 執行權限 | 通過（755） |
| 5. 測試主路徑 | 部分通過（decide 純函式 20/20 綠；main() 無 subprocess 整合測試 → low，綁 W1-001 補） |

無 blocking 發現；1 項 low（5-1）+ 2 項 info，均不阻擋未推送 commits 推進。
