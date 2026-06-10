# 1.0.0-W1-024.1 create 命令 UX 修復審查報告

審查對象：commit `5df3d5f4`（feat(1.0.0-W1-024.1): create UX — 必填欄位一次列全 + --how 友善提示）。
注意：派發描述為「工作區未提交 diff」，實際審查時工作區已乾淨（`git status --porcelain` 空），目標變更已在 `5df3d5f4` 提交（其後尚有 append-log chore commits 至 `c517a939`）。本審查以該 commit 的內容為準。

審查檔案：
- `.claude/skills/ticket/ticket_system/commands/create.py`
- `.claude/skills/ticket/ticket_system/tests/test_create_ux_merged_validation.py`（新檔）
- `.claude/skills/ticket/ticket_system/tests/test_create_error_envelope.py`（測試 4 改寫）

結論速覽：無 critical / major；3 項 minor、4 項 info。13 個相關測試實跑全綠且無檔案副作用。

---

## 檢查點 1：_parse_cli_args_to_config 呼叫路徑是否都經過 _validate_create_checklist

**結論：通過。**

- `_parse_cli_args_to_config` 全 skill codebase 唯一呼叫點為 `create.py:1315`（`execute()` 內）。
- 流程：`execute()` → `_persist_and_report()`（`create.py:1320`）→ 步驟 1.5 `_validate_create_checklist`（`create.py:1115`）+ `_enforce_create_checklist`（`create.py:1117`），無條件執行於持久化（`create.py:1120`）之前。
- 中途 early return（parse 失敗 `create.py:1316`、`_validate_before_persist` 失敗 `create.py:1111`）皆不持久化 ticket，why 必填語意不會靜默消失。

**[minor] create.py:916-917 註解過時**
`_validate_create_checklist` 內 why 檢查的註解仍寫「CLI 端已對 IMP/ANA/ADJ 做必填驗證，此處為清單一致性」。A2 已移除 CLI 端提前退出，checklist 現在是 why 的唯一驗證點，註解與現實矛盾，會誤導後續維護者以為有雙重防線。
建議：改為「why 唯一驗證點（1.0.0-W1-024.1 A2 起，CLI 端提前退出已移除）」。

**[info] 其他建立路徑本來就不經過此驗證（pre-existing，非本 diff 引入）**
`bulk_create.py:127`（why 預設 `""`）與 `lib/ticket_generator.py:246`（plan-to-tickets）直接呼叫 `create_ticket_frontmatter`，既不經 `_parse_cli_args_to_config` 也不經 checklist。舊 WHY_REQUIRED 早退同樣管不到這些路徑，故非回歸；但若要求「why 必填」全域成立，此為既有缺口。建議依 quality-baseline 規則 5 建 pending ticket 追蹤。

---

## 檢查點 2：--force 現在可豁免 why（舊行為不可豁免）

**結論：行為變更屬實，但未發現依賴舊語意的文件 / hook / 測試。**

- 變更確認：舊 WHY_REQUIRED 早退（`sys.exit(1)`）不檢查 `--force`；新行為下 why 併入 checklist，`--force` 走 `_enforce_create_checklist` 逃生閥（`create.py:942-949`）印 WARNING 放行，可建立 `why: 待定義` 的非 DOC ticket。
- 全 repo grep `WHY_REQUIRED`（排除 logs/worklogs）僅剩 3 個測試檔：
  - `.claude/skills/ticket/tests/test_error_channel_integration.py:220-225`：容忍清單同時接受 `CHECKLIST_VALIDATION_FAILED` 與 `WHY_REQUIRED`，相容新舊行為，無需修改（commit message 的判斷正確）。
  - 新測試與改寫測試均斷言 `WHY_REQUIRED` 不出現。
- `.claude/skills/ticket/SKILL.md`、`references/create-command.md`、`.claude/pm-rules/` 均無「--force 不可豁免 why」的描述。
- `.claude/hooks/cli-error-feedback-hook.py` 等錯誤回饋 hooks 以 stderr+stdout 合併偵測，無 errno 特定依賴。

**[info] 錯誤輸出通道由 stderr 變為 stdout**
舊 WHY_REQUIRED 用 `sys.stderr.write`；新 `CHECKLIST_VALIDATION_FAILED` 用 `print` 走 stdout（`create.py:953`）。此與 create.py 其他 ErrorEnvelope 慣例一致（如 VERSION_NOT_DETECTED `create.py:1291` 也是 stdout），舊 stderr 反而是 outlier；`test_create_error_envelope.py` 測試 4 已同步改斷言 stdout。未發現只 grep stderr 的消費者，但外部腳本若依 stderr 過濾錯誤會漏接，列為已知行為變更。

**[info] 整合測試含死容忍項**
`test_error_channel_integration.py:223-224` 容忍 `WHEN_REQUIRED` / `HOW_STRATEGY_REQUIRED`，這兩個 errno 在 create.py 從未存在（grep 0 hit）。pre-existing，可順手清理。

---

## 檢查點 3：_AmbiguousHowAction 邊界

**結論：通過。** 以 `uv run python` 實機驗證 7 個邊界案例（standalone parser，read-only）：

| 輸入 | 結果 |
|------|------|
| `--how=xx`（等號形式） | exit 2 + 中文友善提示（含 --how-type / --how-strategy 與用途說明） |
| 參數列尾端 `--how`（無值） | exit 2 + 友善提示（`nargs="?"` 正確避免 `expected one argument`） |
| `--how val` | exit 2 + 友善提示 |
| `--how-t val` | 正常解析至 `how_type='val'`（縮寫無回歸） |
| `--how-s val` | 正常解析至 `how_strategy='val'`（縮寫無回歸） |
| `--w val` | 原生 ambiguous（8 候選），不受 --how 攔截影響 |
| `--ho val` | 原生英文 ambiguous，候選由 2 個增為 3 個（--how, --how-type, --how-strategy） |

其他確認：exit code 2（`parser.error`）與原生 ambiguous 行為一致；`help=argparse.SUPPRESS` 不污染 `--help`；`args.how` 屬性無人引用，default None 無副作用。

**[minor] 友善提示僅覆蓋 exact `--how`，更短縮寫（`--ho`、`--h`）仍是英文原生 ambiguous 訊息**
且 `--how` 顯式註冊後，`--ho` 的候選清單多了一個無效旗標 `--how`（用戶照原生提示輸入 `--how` 會再被攔一次，需兩輪）。影響面小（`--ho` 罕用），屬 UX 完整度議題。建議：可評估在 friendly message 不變的前提下接受現狀，或改用 `allow_abbrev=False`（影響面大，需另行評估，A3 裁決時應已考量）。

---

## 檢查點 4：SKILL.md / references 同步

**結論：通過，無需同步。**

- `WHY_REQUIRED` 不存在於 `.claude/skills/ticket/SKILL.md`、`references/*.md`、`.claude/pm-rules/*.md`、`.claude/hooks/*.py`。
- `references/create-command.md` 僅在範例展示 `--why "需求依據"`（line 25），「必填」字樣只用於 decision-tree 三參數（line 67-71），未描述舊報錯行為。
- 無任何文件或腳本使用裸 `--how` 旗標（grep 排除 --how-type/--how-strategy 後 0 hit），A3 攔截不會打破既有用法。

**[info] create-command.md 從未文件化 checklist 阻擋與 --force 逃生閥（pre-existing 缺口）**
W11-003.5 將 checklist 升級為阻擋後文件未跟進；本次 why 併入 checklist 使缺口略增（用戶從文件無法得知 why/when/who/how_strategy 會合併阻擋、--force 可跳過）。建議建 DOC ticket 補「必填欄位驗證與 --force」章節。

---

## 檢查點 5：新測試是否有產生真實 ticket 檔案的副作用

**結論：通過（runtime 驗證）。** 實跑 `test_create_ux_merged_validation.py` + `test_create_error_envelope.py` 共 13 passed，跑完後 `git status --porcelain --untracked=all` 完全乾淨，無 ticket 檔或其他 repo 內副作用（pytest 以 `-p no:cacheprovider` + `PYTHONDONTWRITEBYTECODE=1` 驗證）。

機制分析：A2 測試 1/2 在 checklist 阻擋（exit 1，持久化前）；A3 測試用 standalone parser 不進 `execute()`；DOC 測試靠 blocked_by 失敗在持久化前退出。

**[minor] test_doc_type_still_exempts_why 是永真斷言，未提供其宣稱的回歸防護**
`test_create_ux_merged_validation.py:132-156`：用不存在的 `blocked_by="0.99.0-W99-001"` 讓流程在 `_validate_before_persist`（`create.py:1111`，步驟 1）失敗——但 checklist 是步驟 1.5（`create.py:1115`），**永遠執行不到**。因此：
- 斷言 `"why" not in combined or "CHECKLIST_VALIDATION_FAILED" not in combined`（line 156）因後半恆真而 trivially pass；
- 即使 checklist 的 DOC why 豁免（`create.py:917`）被改壞，此測試仍綠燈，docstring 宣稱的「行為不變的回歸防護」名不符實。

緩解因素：DOC why 豁免已由 `.claude/skills/ticket/tests/test_create_checklist_validation.py:164-169`（`test_doc_type_skips_why`）單元級直接覆蓋 `_validate_create_checklist`，整體覆蓋無缺口，故降為 minor（測試效力誤導而非防護真空）。
建議：改寫為直接呼叫 `_validate_create_checklist(config, "DOC")` 斷言 `"why" not in missing`，或 monkeypatch `_build_and_save_ticket` 走完 checklist 而不落檔。

---

## Severity 彙總

| # | Severity | 發現 | 位置 |
|---|----------|------|------|
| 1 | minor | why 檢查註解過時（宣稱 CLI 端仍有必填驗證） | `create.py:916-917` |
| 2 | minor | `test_doc_type_still_exempts_why` 永真斷言，未達 checklist 層回歸防護（另有單元測試覆蓋） | `test_create_ux_merged_validation.py:132-156` |
| 3 | minor | `--ho` 等短縮寫仍英文 ambiguous，且候選清單新增無效旗標 `--how`（兩輪試錯） | `create.py:1631-1633` 攔截範圍 |
| 4 | info | bulk_create / plan-to-tickets 路徑不經 checklist（pre-existing），建議建 ticket 追蹤 | `bulk_create.py:127`, `ticket_generator.py:246` |
| 5 | info | why 錯誤通道 stderr → stdout（與既有 envelope 慣例一致，但屬可觀察行為變更） | `create.py:953` vs 舊 `sys.stderr.write` |
| 6 | info | 整合測試死容忍項 WHEN_REQUIRED / HOW_STRATEGY_REQUIRED（errno 從未存在） | `test_error_channel_integration.py:223-224` |
| 7 | info | create-command.md 未文件化 checklist 阻擋 + --force 逃生閥（pre-existing 缺口，本次略增） | `references/create-command.md` |

critical：無。major：無。核心設計（A2 合併單一錯誤、A3 exact-match 攔截）實作正確，13 測試實跑全綠、無檔案副作用，無繞過路徑。
