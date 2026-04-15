# ARCH-015: subagent .claude/ 寫入 hardcoded 保護

## 基本資訊

- **Pattern ID**: ARCH-015
- **分類**: 架構設計（Claude Code runtime 行為）
- **來源版本**: v0.18.0
- **發現日期**: 2026-04-13
- **更新日期**: 2026-04-15（W10-049.4 修正描述：主 repo 內 subagent 也被擋，非僅限 worktree）
- **風險等級**: 中→高（影響範圍比原認知廣，所有需要 Edit .claude/ 的 subagent 任務均無法執行）

## 問題描述

### 症狀

PM 主線程派發 subagent 嘗試 Edit worktree 路徑內的 `.claude/` 檔案時，無論 subagent 的 `permissionMode` 設為 `bypassPermissions`、`acceptEdits`，或 settings.json 加入 `additionalDirectories`（含 worktree 絕對路徑或 glob pattern），Edit 操作均被 CC runtime 拒絕，回傳：

```
Permission to use Edit has been denied. IMPORTANT: You *may* attempt to accomplish
this action using other tools that might naturally be used to accomplish this goal...
```

關鍵特徵：
- Read 操作不受影響（讀寫權限不對稱）
- 同 subagent 對 worktree 內**非 .claude/** 路徑（docs/、src/）Edit **可成功**
- 同 subagent 對主 session cwd 內 `.claude/` Edit **也被擋**（W10-049.4 案例修正：thyme-documentation-integrator 在主 repo 嘗試 Edit `.claude/README.md` 仍被 CC runtime 拒絕，hook log 顯示 hook 已正確跳過 subagent，但 CC runtime 在 hook 之前就擋了）
- 拒絕來源不是任何 hook（hook-logs 顯示 ALLOW），是 CC runtime 層

### 根本原因（5 Why 分析）

1. Why 1: subagent Edit worktree 內 `.claude/` 被拒
2. Why 2: subagent 看到的 `.claude/` 寫入 scope 不包含 worktree 路徑
3. Why 3: settings.json 的 `additionalDirectories` 設定（無論絕對路徑或 glob）對 `.claude/` 路徑無效
4. Why 4: CC runtime 對 `.claude/` 目錄施加比一般路徑更嚴格的保護策略
5. Why 5（根本原因）: **CC runtime 將 `.claude/` 視為框架配置目錄，僅允許主 session cwd 內的那一份 `.claude/` 被 subagent 寫入**。此保護**繞過** `additionalDirectories` 機制（推測為硬編碼安全策略，防止 subagent 修改非預期的 framework 配置）。

### 受影響配置矩陣（實證）

| 主 session cwd | 目標路徑 | 路徑類型 | additionalDirectories | 結果 |
|---------------|--------|--------|--------|------|
| 主 repo | 主 repo 內 `.claude/` | .claude/ | 無 | 成功 |
| 主 repo | 主 repo 內非 `.claude/`（docs/） | 非 .claude/ | 無 | 成功 |
| 主 repo | worktree 內 `.claude/` | .claude/ | 無 | 拒絕 |
| 主 repo | worktree 內 `.claude/` | .claude/ | 絕對路徑 | 拒絕 |
| 主 repo | worktree 內 `.claude/` | .claude/ | glob pattern | 拒絕 |
| 主 repo | worktree 內非 `.claude/`（docs/） | 非 .claude/ | glob pattern | 成功 |

### 觸發條件

以下三條件同時成立時必然觸發：

1. PM 主線程 cwd 為主 repo（或任何不含目標 `.claude/` 的目錄）
2. 派發 subagent 嘗試 Edit/Write 目標 `.claude/` 路徑
3. 目標 `.claude/` 不在主 session cwd 樹狀結構內（典型情境：worktree 內的 `.claude/`）

`permissionMode` 設定、`additionalDirectories` 設定均無法繞過。

## 正確做法

### 規則：`.claude/` 變更不在 worktree 進行（白名單模式）

| 路徑類型 | 修改場域 | 執行者 |
|---------|---------|--------|
| `.claude/` 框架檔案 | 主 repo | PM 主線程 或 主 repo subagent |
| `src/` `tests/` `docs/` 等產品檔案 | worktree | worktree subagent |

### 派發決策

派發 subagent 前判斷 prompt 是否提及 `.claude/` 路徑：

| 條件 | 派發位置 |
|------|---------|
| Prompt 含 `.claude/` 路徑修改 | 必須在主 repo cwd 派發 |
| Prompt 僅含非 `.claude/` 路徑 | 可在 worktree 或主 repo 派發 |
| 跨 `.claude/` 與其他路徑 | 拆分為兩次派發（.claude/ 主 repo + 其他 worktree） |

### Read 操作不受限制

subagent 在任何 cwd 都可 Read worktree 內的 `.claude/` 檔案。僅 Edit/Write 被限制。可用於：
- subagent 比對 worktree 與主 repo 的 `.claude/` 差異
- subagent 讀取 worktree 內框架規則作為決策依據

## 防護措施

### 開發時

- PM 派發前檢查 prompt 提及的路徑：含 `.claude/` 路徑且 cwd 為 worktree 時，改為主 repo 派發
- worktree skill 文件明確標示「`.claude/` 變更不在 worktree 進行」
- 跨 `.claude/` 與其他路徑的 ticket，拆分子任務分別派發

### 偵測時（Hook 候選）

`agent-dispatch-validation-hook` 可擴充：偵測 prompt 含 `.claude/` 路徑且當前 cwd 為 worktree 時，警告 PM 重新評估派發位置。

### 為何 `additionalDirectories` 無法解決

實證：絕對路徑與 glob pattern 均無效。CC runtime 對 `.claude/` 的保護優先於 `additionalDirectories`。**不要繼續嘗試此路徑**，浪費時間。

### 為何 `--add-dir` / `/add-dir` 對 PM workflow 不可行

- `/add-dir` 是用戶端 interactive slash command，AI 主線程無對應 deferred tool 可呼叫
- `--add-dir` 啟動參數需重啟 CC，每個 worktree 都要重啟一次
- 即使有效（推測仍受 hardcoded 保護），自動化程度低於 Option E

## 相關 Pattern

- ARCH-005: 代理人定義衝突（subagent 行為控制的另一面）
- 待補：subagent 權限與 cwd 互動細節（若未來有更深入研究）

---

**Last Updated**: 2026-04-13
