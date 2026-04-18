"""Group E：效能測試（AC6 <100ms + use_cache 接口一致性）。

Phase 2 §3 Group E / Phase 3a §5：
- E1: 真實 tmp git repo end-to-end 執行 30 次，中位 <100ms + p95 <150ms
- E2: use_cache=False vs use_cache=True（Phase 1 noop）行為一致

thyme 先前實測 5 個 subprocess 序列中位 52ms / p95 84ms，應寬鬆通過。
"""

from __future__ import annotations

import statistics
import subprocess
import time
from pathlib import Path

import pytest

from ticket_system.lib.checkpoint_state import CheckpointState, checkpoint_state


# ---------------------------------------------------------------------------
# E helper：建立真實 tmp git repo + 多個未提交檔
# ---------------------------------------------------------------------------


def _seed_uncommitted_files(repo: Path, count: int = 5) -> None:
    for i in range(count):
        (repo / f"dirty{i}.txt").write_text(f"content {i}\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# E1：中位 <100ms + p95 <150ms
# ---------------------------------------------------------------------------


def test_E1_checkpoint_state_performance_median_under_100ms(
    tmp_git_repo: Path, mock_ticket_query, mock_dispatch_active, mock_handoff_pending,
):
    """真實 subprocess（git）+ mock ticket CLI：中位 <100ms + p95 <150ms。"""
    _seed_uncommitted_files(tmp_git_repo, count=10)
    mock_dispatch_active(active_count=2, completed_count=1, project_root=tmp_git_repo)
    mock_handoff_pending(ticket_id="W10-017.8", project_root=tmp_git_repo)
    mock_ticket_query(ids=["A", "B", "C"])

    n_runs = 30  # sample size 足以取 median / p95，且 CI 不太慢
    durations_ms: list[float] = []
    for _ in range(n_runs):
        start = time.perf_counter()
        state = checkpoint_state(
            ticket_id="W10-017.8",
            use_cache=False,
            log_metrics=False,  # 避免 log I/O 污染量測
            caller="perf-test",
            project_root=tmp_git_repo,
        )
        durations_ms.append((time.perf_counter() - start) * 1000.0)
        assert isinstance(state, CheckpointState)

    median = statistics.median(durations_ms)
    p95 = sorted(durations_ms)[int(0.95 * n_runs) - 1]

    # 寬鬆 assertion：中位 <100ms 為硬 AC；p95 <150ms 為 sage §E1 目標
    assert median < 100.0, (
        f"中位 {median:.2f}ms 超過 AC6 100ms 閾值（樣本: {durations_ms}）"
    )
    assert p95 < 150.0, (
        f"p95 {p95:.2f}ms 超過 sage §E1 150ms 目標（樣本: {durations_ms}）"
    )


# ---------------------------------------------------------------------------
# E2：use_cache=False vs True 接口一致性（Phase 1 noop）
# ---------------------------------------------------------------------------


def test_E2_use_cache_interface_consistency(
    tmp_git_repo: Path, mock_ticket_query, frozen_time,
):
    """Phase 1 use_cache 僅留接口，兩種呼叫應產生等價 state（除 computed_at）。"""
    mock_ticket_query(ids=["X"])

    state_no_cache = checkpoint_state(
        ticket_id="W10-017.8", use_cache=False, log_metrics=False,
        caller="test", project_root=tmp_git_repo,
    )
    state_cache = checkpoint_state(
        ticket_id="W10-017.8", use_cache=True, log_metrics=False,
        caller="test", project_root=tmp_git_repo,
    )

    # 關鍵推導欄位必須一致（接口契約）
    assert state_no_cache.current_phase == state_cache.current_phase
    assert state_no_cache.phase_label == state_cache.phase_label
    assert state_no_cache.ready_for_clear == state_cache.ready_for_clear
    assert state_no_cache.active_agents == state_cache.active_agents
    assert state_no_cache.uncommitted_files == state_cache.uncommitted_files
    assert state_no_cache.unmerged_worktrees == state_cache.unmerged_worktrees
    assert state_no_cache.active_handoff == state_cache.active_handoff
    assert state_no_cache.in_progress_tickets == state_cache.in_progress_tickets
