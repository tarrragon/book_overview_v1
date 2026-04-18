"""CheckpointState dataclass + Checkpoint 推導邏輯（Group A + Group C）。

派發 1 範圍（0.18.0-W10-017.8 Phase 3b）：
- §1.1 CheckpointState / PendingCheck dataclass
- §1.4 _derive_checkpoint 的 priority table + FALLBACK + 迴圈查表

不在派發 1 範圍：
- _read_git_status / _read_dispatch_active / _read_handoff_pending / _query_in_progress_tickets / _read_git_worktrees（派發 2 Group B）
- SAFE_CALL（派發 2 Group B）
- _write_metrics_log（派發 3 Group D）
- checkpoint_state() 主函式完整串接（派發 2/3 補完）

設計依據：Phase 3a §1.1 / §1.4；Phase 2 §3 Group A / Group C。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional, Tuple


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


__all__ = [
    "CheckpointState",
    "PendingCheck",
    "PRIORITIES",
    "FALLBACK",
    "_derive_checkpoint",
    "_utc_now_iso",
]
