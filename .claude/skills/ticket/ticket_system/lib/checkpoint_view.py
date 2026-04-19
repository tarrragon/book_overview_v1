"""Checkpoint view function 模組（W10-017.1 v2 新增，W10-017.1 Phase 3b 落地）。

本模組純 view function（無 I/O），輸入 CheckpointState + caller 路由參數，
輸出人類可讀字串/結構。CLI 三命令（snapshot / handoff-ready / checkpoint-status）
共用，禁止 CLI 自行詮釋 active_handoff（v2 §3.6 / §6.1）。

設計依據：
- v2.1 §3.3 / §6.1 / §6.2 命名鎖定 + 三 caller 路由
- v2.2 Q1 unknown caller raise ValueError
- v2.2 Q4 format_local_time 系統時區
- v2.3 Q6 [?] 三態標記
- Phase 3a Implementation Strategy §2 函式介面契約
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import List, Tuple, get_args

from .checkpoint_state import (
    FALLBACK,
    PRIORITIES,
    CheckpointCaller,
    CheckpointState,
    format_next_action,
    format_phase_label,
)


# CLI 三命令的合法 caller 集合（v2.2 Q1 規格鎖定）。
# W10-017.11 AC 2：從 CheckpointCaller Literal 透過 get_args 派生，過濾掉 log
# fallback 值 "unknown"，避免雙源定義漂移。新增 CLI caller 時只需擴充 Literal。
_VALID_CALLERS = tuple(c for c in get_args(CheckpointCaller) if c != "unknown")


# ---------------------------------------------------------------------------
# format_local_time（v2.2 Q4 命名鎖定）
# ---------------------------------------------------------------------------


def format_local_time(state: CheckpointState) -> str:
    """轉 state.computed_at（UTC ISO8601）為本地時區可讀字串。

    決策（v2.2 Q4）：
    - 主路徑：datetime.fromisoformat(raw) + astimezone() 轉本地時區，
      strftime("%Y-%m-%d %H:%M (local)") 格式化。
    - Fallback（raw 解析失敗）：用 time.localtime + strftime 產生當前本地時間
      字串；raw 非空時保留原字串 + " (當前本地時間)" 標記，raw 空時回純當前本地時間。
    目的：避免拋例外阻塞 view 渲染（fail-open）。
    """

    raw = state.computed_at or ""
    try:
        dt = datetime.fromisoformat(raw)
        local = dt.astimezone()
        return local.strftime("%Y-%m-%d %H:%M (local)")
    except (ValueError, TypeError):
        # fallback：保留原字串 + (local) 標記
        # （fail-open；不應影響 snapshot 主流程）
        now_local = time.strftime("%Y-%m-%d %H:%M (local)", time.localtime())
        return raw + f" ({now_local})" if raw else now_local


# ---------------------------------------------------------------------------
# handoff_status_for（v2.1 §6.1 命名鎖定，v2.2 Q1 邊界）
# ---------------------------------------------------------------------------


def handoff_status_for(
    state: CheckpointState, caller: str
) -> Tuple[bool, str]:
    """三 caller 路由詮釋 active_handoff，回 (is_ok_for_caller, message)。

    路由表（v2.1 §6.1 / §6.2）：
      caller          | active_handoff is None       | active_handoff not None
      snapshot        | (True, "無 pending handoff") | (False, "先處理 pending handoff: {id}")
      handoff-ready   | (True, "無 pending handoff (看其他阻擋)") | (True, "handoff 已建立: {id}")
      checkpoint-status | (True, "無 pending handoff") | (True, "handoff pending: {id}")

    Args:
        state: CheckpointState 實例。
        caller: 必為 _VALID_CALLERS 之一，否則 raise ValueError（v2.2 Q1）。

    Raises:
        ValueError: caller 不在 _VALID_CALLERS 中。
    """

    if caller not in _VALID_CALLERS:
        raise ValueError(f"unknown caller: {caller}")

    handoff_id = state.active_handoff

    if caller == "snapshot":
        if handoff_id is None:
            return True, "無 pending handoff"
        return False, f"先處理 pending handoff: {handoff_id}"

    if caller == "handoff-ready":
        if handoff_id is None:
            return True, "無 pending handoff (看其他阻擋)"
        return True, f"handoff 已建立: {handoff_id}"

    # caller == "checkpoint-status"
    if handoff_id is None:
        return True, "無 pending handoff"
    return True, f"handoff pending: {handoff_id}"


# ---------------------------------------------------------------------------
# get_suggested_commands（PRIORITIES 第 5 欄反查 helper）
# ---------------------------------------------------------------------------


def get_suggested_commands(state: CheckpointState) -> List[str]:
    """依 state.current_phase 反查 PRIORITIES / FALLBACK 第 5 欄。

    語意：找 PRIORITIES 中 phase 字段相同的列；fallback 為 FALLBACK 第 5 欄。
    對 view function 為 O(n) 線性查詢；目前 5 列無效能問題（TD-B 已記錄）。
    """

    phase = state.current_phase
    for _pred, p, _label, _action_fn, commands_fn in PRIORITIES:
        if p == phase:
            return commands_fn(state)
    # FALLBACK 用 phase=="3" 識別
    _p, _label, _action_fn, commands_fn = FALLBACK
    return commands_fn(state)


# ---------------------------------------------------------------------------
# render_current_suggestion（v2.1 §3.2 區塊；命名屬語意契約）
# ---------------------------------------------------------------------------


def render_current_suggestion(state: CheckpointState) -> str:
    """渲染「--- 當前建議 ---」區塊。

    格式（v2.1 §3.2）：
        --- 當前建議 ---
          Checkpoint: {format_phase_label(state)}
          下一步: {format_next_action(state)}
          建議命令:
            {cmd_1}
            {cmd_2}
    """

    label = format_phase_label(state)
    action = format_next_action(state)
    commands = get_suggested_commands(state)

    lines = ["--- 當前建議 ---", f"  Checkpoint: {label}", f"  下一步: {action}"]
    if commands:
        lines.append("  建議命令:")
        for cmd in commands:
            lines.append(f"    {cmd}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# render_ready_check（v2.1 §1.4 + v2.3 Q6 三態標記）
# ---------------------------------------------------------------------------


def _mark(passed: bool) -> str:
    """純 ASCII 三態標記 helper（v2.3 Q6 規格）。"""
    return "[x]" if passed else "[ ]"


def render_ready_check(state: CheckpointState, caller: str) -> str:
    """渲染「--- /clear Ready Check ---」checklist。

    四項判定（v2.1 §1.4）：
      - 無活躍代理人: state.active_agents == 0
      - 無未提交變更: state.uncommitted_files in (0,)；None → [?]（v2.3 Q6）
      - 無未合併 worktree: len(state.unmerged_worktrees) == 0
      - handoff 行: handoff_status_for(state, caller)

    snapshot 視角追加 footer：
      Pipeline 阻擋判定請改用: ticket track handoff-ready
    """

    lines = ["--- /clear Ready Check ---"]

    # 1. 活躍代理人
    agents_pass = state.active_agents == 0
    agents_line = (
        f"  {_mark(agents_pass)} 無活躍代理人 (active_agents={state.active_agents})"
    )
    if not agents_pass:
        agents_line += " → ticket track agent-status"
    lines.append(agents_line)

    # 2. 未提交變更（None=未知，標 [?]）
    uncommitted = state.uncommitted_files
    if uncommitted is None:
        lines.append(
            "  [?] 無未提交變更 (uncommitted_files=未知, 資料源不可用)"
        )
    else:
        unc_pass = uncommitted == 0
        unc_line = f"  {_mark(unc_pass)} 無未提交變更 (uncommitted_files={uncommitted})"
        if not unc_pass:
            unc_line += " → git add + git commit"
        lines.append(unc_line)

    # 3. 未合併 worktree
    wt_count = len(state.unmerged_worktrees)
    wt_pass = wt_count == 0
    wt_line = f"  {_mark(wt_pass)} 無未合併 worktree (count={wt_count})"
    if not wt_pass:
        wt_line += " → git worktree list"
    lines.append(wt_line)

    # 4. handoff（透過 view function 路由）
    is_ok, msg = handoff_status_for(state, caller)
    lines.append(f"  {_mark(is_ok)} {msg}")

    # snapshot 視角 footer
    if caller == "snapshot":
        unchecked = sum(1 for ln in lines[1:] if "[ ]" in ln)
        lines.append(
            f"  顯示結果: {unchecked} 項未通過 (純展示, snapshot exit 永遠 0)"
        )
        lines.append(
            "  Pipeline 阻擋判定請改用: ticket track handoff-ready"
        )

    return "\n".join(lines)


__all__ = [
    "format_local_time",
    "handoff_status_for",
    "get_suggested_commands",
    "render_current_suggestion",
    "render_ready_check",
]
