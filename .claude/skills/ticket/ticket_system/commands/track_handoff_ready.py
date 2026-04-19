"""ticket track handoff-ready 命令（W10-017.1 v2 新增）。

提供 GO/NO-GO 結論用於 shell pipeline：
- exit 0: GO（ready for /clear）
- exit 1: 內部錯誤（非 IO_ERRORS 例外）
- exit 2: NO-GO（業務拒絕：有阻擋項，含 IO_ERRORS fail-open 保守判定）

設計依據：
- v2.1 §1.3 / §1.5 / §1.6 真值表 / §3.5 / §6.1
- v2.3 Q5 IO_ERRORS exit 2 (保守 NO-GO)
- Phase 3a §4 execute_handoff_ready 偽碼骨架
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from typing import List

from ticket_system.lib.checkpoint_state import (
    IO_ERRORS,
    CheckpointState,
    checkpoint_state,
)
from ticket_system.lib.checkpoint_view import (
    format_local_time,
    handoff_status_for,
)


@dataclass(frozen=True)
class _Blocker:
    """阻擋項資料載體（純結構，view 由 execute 渲染）。"""

    label: str
    fix: str


def _compute_blockers(state: CheckpointState, ticket_id: str | None) -> List[_Blocker]:
    """計算 handoff-ready 阻擋項清單（v2.1 §1.6 真值表）。

    全域阻擋項（不過濾 ticket-id）：
      - active_agents > 0
      - uncommitted_files > 0（None 視為未知，採保守視為阻擋）
      - len(unmerged_worktrees) > 0
    Ticket-id 過濾項：
      - in_progress_tickets 含「非當前 ticket」者 → 阻擋
        指定 ticket_id 自己 in_progress 視為「正常推進」非阻擋
    """

    blockers: List[_Blocker] = []

    if state.active_agents > 0:
        blockers.append(
            _Blocker(
                label=f"活躍代理人未完成 (active_agents={state.active_agents})",
                fix="ticket track agent-status 查看; 等待完成",
            )
        )

    uncommitted = state.uncommitted_files
    if uncommitted is not None and uncommitted > 0:
        blockers.append(
            _Blocker(
                label=f"未提交變更 (uncommitted_files={uncommitted})",
                fix=f"git add + git commit ({uncommitted} 檔)",
            )
        )

    if len(state.unmerged_worktrees) > 0:
        blockers.append(
            _Blocker(
                label=f"未合併 worktree (count={len(state.unmerged_worktrees)})",
                fix="git worktree list; cd <wt> && git push; cd <main> && git merge",
            )
        )

    # in_progress_tickets：排除「自身 ticket」
    other_in_progress = [
        tid for tid in state.in_progress_tickets if tid != ticket_id
    ]
    if other_in_progress:
        blockers.append(
            _Blocker(
                label=f"其他 ticket 進行中 ({len(other_in_progress)} 個)",
                fix=f"完成或 release 其他 ticket: {', '.join(other_in_progress)}",
            )
        )

    return blockers


def _print_no_go(blockers: List[_Blocker]) -> None:
    print(f"結論: NO-GO  尚未 ready ({len(blockers)} 項阻擋)")
    print()
    print("阻擋項目:")
    for b in blockers:
        print(f"  [ ] {b.label}")
        print(f"      → {b.fix}")


def _print_go(state: CheckpointState, ticket_id: str | None) -> None:
    print("結論: GO  ready for /clear")
    print()
    print("通過項目:")
    print(f"  [x] 無活躍代理人 (active_agents={state.active_agents})")
    if state.uncommitted_files is not None:
        print(
            f"  [x] 無未提交變更 (uncommitted_files={state.uncommitted_files})"
        )
    print(f"  [x] 無未合併 worktree (count={len(state.unmerged_worktrees)})")
    is_ok, msg = handoff_status_for(state, caller="handoff-ready")
    print(f"  [x] {msg}")
    print()
    print("下一步: /clear")


def execute_handoff_ready(args: argparse.Namespace) -> int:
    """執行 handoff-ready 命令。

    Returns:
        0: GO；1: 內部錯誤；2: NO-GO（含 IO_ERRORS 保守判定）
    """

    ticket_id = getattr(args, "ticket_id", None)

    try:
        state = checkpoint_state(
            ticket_id=ticket_id, caller="handoff-ready", log_metrics=True
        )
    except IO_ERRORS as e:
        # v2.3 Q5: IO_ERRORS 視為「無法判定」，保守回 exit 2 (NO-GO)
        # 規則 4 雙通道：stderr WARN + stdout 提示
        sys.stderr.write(f"WARN: data source(s) unavailable: {e}\n")
        print("結論: NO-GO  資料源異常無法確認 ready 狀態")
        return 2
    except Exception as e:
        # 非 IO_ERRORS：規則 4 stderr + exit 1
        sys.stderr.write(f"handoff-ready internal error: {e}\n")
        return 1

    print("=== Handoff Ready Check ===")
    print(f"時間: {format_local_time(state)}")
    print(f"Ticket: {ticket_id or '全域'}")
    print()

    blockers = _compute_blockers(state, ticket_id=ticket_id)
    if blockers:
        _print_no_go(blockers)
        return 2

    _print_go(state, ticket_id=ticket_id)
    return 0


def register_handoff_ready(
    subparsers: argparse._SubParsersAction,
) -> argparse.ArgumentParser:
    """註冊 handoff-ready 子命令。

    --ticket-id 為可選 flag（v2.1 修正 6 / Phase 3a §1.1）。
    """
    p = subparsers.add_parser(
        "handoff-ready",
        help="檢查 /clear ready 狀態（GO/NO-GO/internal-error）",
    )
    p.add_argument(
        "--ticket-id",
        "-t",
        dest="ticket_id",
        default=None,
        help="可選 ticket ID；指定時影響 in_progress_tickets 自身判定",
    )
    return p
