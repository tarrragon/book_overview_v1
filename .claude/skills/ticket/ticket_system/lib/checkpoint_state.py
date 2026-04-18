"""CheckpointState dataclass + Checkpoint 推導邏輯 + 5 層 fail-open 資料來源。

派發 1 範圍（0.18.0-W10-017.8 Phase 3b）：
- §1.1 CheckpointState / PendingCheck dataclass
- §1.4 _derive_checkpoint 的 priority table + FALLBACK + 迴圈查表

派發 2 範圍（Group B + F）：
- §1.3 SAFE_CALL helper + IO_ERRORS 白名單
- 5 個 _read_* 資料來源函式（fail-open，只捕獲 I/O 類例外）
- 模組邊界：不 import track_snapshot / track_query

不在派發 2 範圍：
- _write_metrics_log（派發 3 Group D）
- checkpoint_state() 主函式完整串接（派發 3）

設計依據：Phase 3a §1.1 / §1.3 / §1.4；Phase 2 §3 Group A / B / C / F。
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, TypeVar

from .paths import get_project_root


# ---------------------------------------------------------------------------
# dataclass 定義（Phase 3a §1.1 / Phase 2 §3 Group A）
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PendingCheck:
    """未通過檢查項。

    Attributes:
        check_id: 識別字串（如 "data_source_git-status"）。
        reason: 可讀原因描述。
        blocker: 是否阻擋主流程（此 dataclass 為純資料載體，不負責判斷）。
        auto_detectable: 能否被自動偵測（False 表示需人工介入，如 worklog 一致性）。
    """

    check_id: str
    reason: str
    blocker: bool
    auto_detectable: bool


@dataclass
class CheckpointState:
    """Checkpoint 決策狀態（12 欄位 + 1 內部 _ticket_id）。

    AC1 判定：dataclasses.fields() 計數 >= 12（不含以底線開頭的內部欄位）。

    欄位分為「推導」與「資料來源」兩類：
    - 推導欄位（由 _derive_checkpoint 等決定）：current_phase / phase_label /
      next_action / ready_for_clear / pending_checks
    - 資料來源欄位（由 _read_* 填入）：active_agents / uncommitted_files /
      unmerged_worktrees / active_handoff / in_progress_tickets
    - 元資訊：data_sources / computed_at
    """

    current_phase: str
    phase_label: str
    next_action: str
    ready_for_clear: bool
    pending_checks: List[PendingCheck]
    active_agents: int
    unmerged_worktrees: List[str]
    active_handoff: Optional[str]
    in_progress_tickets: List[str]
    data_sources: Dict[str, str]
    computed_at: str
    uncommitted_files: Optional[int] = None  # None 表示資料源失敗；0 表示 clean

    # 內部欄位：_derive_checkpoint 需判斷 ticket_id 是否指定
    # 以底線開頭，不計入「公開契約欄位」
    _ticket_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Checkpoint 推導 priority table（Phase 3a §1.4 / Phase 2 §3 Group C）
# ---------------------------------------------------------------------------

# linux Good Taste：用資料結構取代 if/elif 鏈；新增優先級只動資料。
# 每筆 (predicate, phase, label, action_fn)：
#   predicate(state) -> bool：是否命中此優先級
#   action_fn(state) -> str：動態產生 next_action 訊息
PRIORITIES: List[
    Tuple[Callable[[CheckpointState], bool], str, str, Callable[[CheckpointState], str]]
] = [
    (
        lambda s: s.active_agents > 0,
        "1.85",
        "C1.85 代理人運行中",
        lambda s: f"等待 {s.active_agents} 個代理人或 ticket track agent-status",
    ),
    (
        lambda s: len(s.unmerged_worktrees) > 0,
        "1.9",
        "C1.9 worktree 待合併",
        lambda s: f"合併 {len(s.unmerged_worktrees)} 個 worktree 並清理",
    ),
    (
        lambda s: s.uncommitted_files is not None and s.uncommitted_files > 0,
        "1",
        "C1 未提交變更",
        lambda s: f"git add + git commit ({s.uncommitted_files} 檔)",
    ),
    (
        lambda s: s.active_handoff is not None,
        "2",
        "C2 handoff 就緒",
        lambda s: f"ready for /clear (handoff pending: {s.active_handoff})",
    ),
    (
        lambda s: len(s.in_progress_tickets) > 0 and s._ticket_id is not None,
        "0.5",
        "C0.5 階段進行中",
        lambda s: "ticket track append-log 記錄階段進展",
    ),
]

FALLBACK: Tuple[str, str, Callable[[CheckpointState], str]] = (
    "3",
    "C3 流程完成",
    lambda s: "ready for /clear 或選下個 Ticket",
)


def _derive_checkpoint(state: CheckpointState) -> Tuple[str, str, str]:
    """依 PRIORITIES 從高到低找第一個命中的優先級。

    Args:
        state: 已填入資料來源欄位的 CheckpointState。

    Returns:
        (current_phase, phase_label, next_action) 三元組。
    """

    for predicate, phase, label, action_fn in PRIORITIES:
        if predicate(state):
            return phase, label, action_fn(state)
    phase, label, action_fn = FALLBACK
    return phase, label, action_fn(state)


# ---------------------------------------------------------------------------
# 工具：ISO 時間戳（供 dataclass 建構與測試 freeze_time 使用）
# ---------------------------------------------------------------------------


def _utc_now_iso() -> str:
    """回傳目前 UTC 時間的 ISO 8601 字串（含時區資訊）。

    用 datetime.now(timezone.utc) 而非 deprecated utcnow。
    """

    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# SAFE_CALL + IO_ERRORS whitelist（Phase 3a §1.3 / Phase 2 §3 Group B）
# ---------------------------------------------------------------------------

# 僅這些 I/O 類例外走 fallback；其他例外（MemoryError/AttributeError/KeyError 等）
# 視為程式 bug 上拋到 checkpoint_state() 主流程，依規則 4 stderr + log 雙通道。
IO_ERRORS: Tuple[type, ...] = (
    subprocess.CalledProcessError,
    subprocess.TimeoutExpired,
    FileNotFoundError,
    PermissionError,
    NotADirectoryError,
    IsADirectoryError,
    json.JSONDecodeError,
    OSError,
)

T = TypeVar("T")


def SAFE_CALL(
    fn: Callable[[], T],
    errors: Dict[str, str],
    pending: List[PendingCheck],
    source: str,
    fallback: T,
) -> T:
    """Fail-open 包裝：I/O 類例外走 fallback 並記錄到 errors/pending。

    捕獲判準（文件化）：
    - 捕獲（走 fallback）：資料來源不可用、權限拒絕、JSON 毀損、subprocess 失敗/超時
    - 不捕獲（上拋）：AttributeError / TypeError / KeyError / MemoryError / ImportError

    Args:
        fn: 不帶參數的可呼叫，執行資料來源讀取。
        errors: 錯誤累積字典（source -> "<ExcName>: <msg>"）；成功時設為 "ok"。
        pending: PendingCheck 累積清單；失敗時追加 auto_detectable=False 標記。
        source: 資料來源識別字串（如 "git-status"）。
        fallback: 失敗時回傳值。

    Returns:
        成功時為 fn() 結果，失敗時為 fallback。
    """

    try:
        result = fn()
    except IO_ERRORS as e:
        errors[source] = f"{type(e).__name__}: {str(e)[:100]}"
        pending.append(
            PendingCheck(
                check_id=f"data_source_{source}",
                reason=f"{source} unavailable: {e}",
                blocker=False,
                auto_detectable=False,
            )
        )
        return fallback
    else:
        errors.setdefault(source, "ok")
        return result


# ---------------------------------------------------------------------------
# 5 層 fail-open 資料來源（Phase 1 §3 / Phase 2 §3 Group B）
# ---------------------------------------------------------------------------

# Phase 1 §3 資料來源路徑規範（相對於 project_root）
_DISPATCH_ACTIVE_RELPATH = Path(".claude/state/dispatch-active.json")
_HANDOFF_PENDING_RELDIR = Path(".claude/handoffs/pending")

# subprocess 執行超時（秒）
_GIT_CMD_TIMEOUT = 5
_TICKET_CMD_TIMEOUT = 10


def _read_git_status(project_root: Optional[Path] = None) -> int:
    """讀取 git status --porcelain，回傳未提交檔案數。

    Raises:
        subprocess.CalledProcessError: git 非零退出（非 git repo 等）。
        subprocess.TimeoutExpired: 超時。
        FileNotFoundError: git 命令不存在。
    """

    root = project_root or get_project_root()
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=str(root),
        capture_output=True,
        text=True,
        timeout=_GIT_CMD_TIMEOUT,
        check=True,
    )
    # 每一行代表一個變更檔案；空輸出 = 0
    lines = [ln for ln in result.stdout.splitlines() if ln.strip()]
    return len(lines)


def _read_dispatch_active(
    project_root: Optional[Path] = None,
) -> Tuple[int, Dict[str, Any]]:
    """讀取 .claude/state/dispatch-active.json，回傳 (active_agents, raw_dict)。

    語意：dispatches 欄位中未完成（status != "completed"）的項目數。
    Phase 1 §3：缺檔時 active_agents=0（由 SAFE_CALL 捕 FileNotFoundError 走 fallback）。

    Raises:
        FileNotFoundError: 檔案或目錄不存在（含 .claude/state/ 整個目錄不存在）。
        PermissionError: 權限拒絕。
        json.JSONDecodeError: JSON 毀損。
    """

    root = project_root or get_project_root()
    path = root / _DISPATCH_ACTIVE_RELPATH
    # 注意：Path.read_text 對目錄不存在與檔案不存在皆拋 FileNotFoundError
    raw_text = path.read_text(encoding="utf-8")
    data = json.loads(raw_text)
    if not isinstance(data, dict):
        # 非 dict 視為資料毀損；用 JSONDecodeError 以讓 SAFE_CALL 捕獲
        raise json.JSONDecodeError(
            "dispatch-active.json root is not a dict", raw_text, 0
        )
    dispatches = data.get("dispatches", [])
    if not isinstance(dispatches, list):
        return 0, data
    active_count = sum(
        1
        for d in dispatches
        if isinstance(d, dict) and d.get("status") != "completed"
    )
    return active_count, data


def _read_handoff_pending(
    project_root: Optional[Path] = None,
) -> Optional[str]:
    """讀取 .claude/handoffs/pending/*.json，回傳最新 handoff 的 ticket_id。

    語意：目錄中有任何 *.json 即視為 active_handoff；多個時取 mtime 最新的。
    Phase 1 §3：缺目錄時回 None（由 SAFE_CALL 捕 FileNotFoundError 走 fallback）。

    Raises:
        FileNotFoundError: 目錄不存在（Phase 2 §B.5 明列情境）。
        PermissionError: 權限拒絕。
        json.JSONDecodeError: JSON 毀損。
    """

    root = project_root or get_project_root()
    pending_dir = root / _HANDOFF_PENDING_RELDIR
    # iterdir 對不存在目錄拋 FileNotFoundError → SAFE_CALL 走 fallback
    json_files = [p for p in pending_dir.iterdir() if p.suffix == ".json"]
    if not json_files:
        return None
    # 取 mtime 最新者
    latest = max(json_files, key=lambda p: p.stat().st_mtime)
    data = json.loads(latest.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return None
    ticket_id = data.get("ticket_id")
    return ticket_id if isinstance(ticket_id, str) else None


def _query_in_progress_tickets(
    project_root: Optional[Path] = None,
) -> List[str]:
    """透過 `ticket track query --status in_progress` 取當前 in_progress ticket IDs。

    Raises:
        subprocess.CalledProcessError: ticket CLI 非零退出。
        subprocess.TimeoutExpired: 超時。
        FileNotFoundError: ticket 命令不存在。
        json.JSONDecodeError: 輸出非合法 JSON。
    """

    root = project_root or get_project_root()
    result = subprocess.run(
        ["ticket", "track", "query", "--status", "in_progress", "--format", "json"],
        cwd=str(root),
        capture_output=True,
        text=True,
        timeout=_TICKET_CMD_TIMEOUT,
        check=True,
    )
    out = result.stdout.strip()
    if not out:
        return []
    data = json.loads(out)
    # 預期 list-of-dict，每個含 id 或 ticket_id 欄位
    if not isinstance(data, list):
        return []
    ids: List[str] = []
    for item in data:
        if isinstance(item, dict):
            tid = item.get("id") or item.get("ticket_id")
            if isinstance(tid, str):
                ids.append(tid)
        elif isinstance(item, str):
            ids.append(item)
    return ids


def _read_git_worktrees(project_root: Optional[Path] = None) -> List[str]:
    """透過 `git worktree list --porcelain` 取未合併的 worktree 路徑清單。

    語意：排除主 worktree（cwd 所在）；僅回傳 linked worktree 的 path。

    Raises:
        subprocess.CalledProcessError: git 非零退出。
        subprocess.TimeoutExpired: 超時。
        FileNotFoundError: git 命令不存在。
    """

    root = project_root or get_project_root()
    result = subprocess.run(
        ["git", "worktree", "list", "--porcelain"],
        cwd=str(root),
        capture_output=True,
        text=True,
        timeout=_GIT_CMD_TIMEOUT,
        check=True,
    )
    # porcelain 格式：每段以空行分隔，段內首行 "worktree <path>"
    paths: List[str] = []
    main_path = str(root.resolve())
    for block in result.stdout.split("\n\n"):
        for line in block.splitlines():
            if line.startswith("worktree "):
                wt_path = line[len("worktree "):].strip()
                # 排除主 worktree
                try:
                    resolved = str(Path(wt_path).resolve())
                except OSError:
                    resolved = wt_path
                if resolved != main_path:
                    paths.append(wt_path)
                break
    return paths


__all__ = [
    "CheckpointState",
    "PendingCheck",
    "PRIORITIES",
    "FALLBACK",
    "IO_ERRORS",
    "SAFE_CALL",
    "_derive_checkpoint",
    "_utc_now_iso",
    "_read_git_status",
    "_read_dispatch_active",
    "_read_handoff_pending",
    "_query_in_progress_tickets",
    "_read_git_worktrees",
]
