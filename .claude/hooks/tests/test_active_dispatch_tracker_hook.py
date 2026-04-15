"""
Active Dispatch Tracker Hook - 三態訊息與背景代理人時機修正測試

對應 Ticket 0.18.0-W10-024 Acceptance:
- [WAIT] 訊息只在有活躍派發時輸出
- [OK] 訊息只在本次 PostToolUse 實際清理了一筆記錄（真實完成）時輸出
- 未派發過時不輸出 dispatch-state 訊息
- run_in_background=true 時不清除 dispatch、不廣播完成（PC-070 根因防護）

測試以 monkeypatch 替換 hook module 中的 dispatch_tracker 相依，
直接呼叫 main() 並捕捉 stdout 驗證輸出。
"""

import importlib.util
import io
import json
import sys
from pathlib import Path

import pytest


_HOOKS_DIR = Path(__file__).parent.parent
if str(_HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(_HOOKS_DIR))

_spec = importlib.util.spec_from_file_location(
    "active_dispatch_tracker_hook",
    _HOOKS_DIR / "active-dispatch-tracker-hook.py",
)
_hook = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_hook)


# ---------------------------------------------------------------------------
# 共用 fixture 與 helper
# ---------------------------------------------------------------------------


class _StateFileStub:
    """模擬 state_file.exists() 回傳 True。"""

    def exists(self) -> bool:
        return True


def _run_hook(
    monkeypatch,
    capsys,
    *,
    tool_input: dict,
    active_after_clear: list,
    cleared_return: bool,
    expired_return: int = 0,
    orphans_return: list = None,
):
    """執行 hook main()，回傳 (exit_code, stdout_text)。"""
    orphans_return = orphans_return or []

    # 替換 dispatch_tracker 相依
    monkeypatch.setattr(_hook, "get_state_file_path", lambda _root: _StateFileStub())
    monkeypatch.setattr(
        _hook, "clear_dispatch", lambda _root, _desc: cleared_return
    )
    monkeypatch.setattr(
        _hook, "get_active_dispatches", lambda _root: active_after_clear
    )
    monkeypatch.setattr(_hook, "cleanup_expired", lambda _root: expired_return)
    monkeypatch.setattr(
        _hook, "detect_orphan_branches", lambda _root: orphans_return
    )

    # 準備 stdin
    payload = {"tool_input": tool_input}
    monkeypatch.setattr("sys.stdin", io.StringIO(json.dumps(payload)))

    # 執行
    exit_code = _hook.main()
    captured = capsys.readouterr()
    return exit_code, captured.out


def _parse_additional_context(stdout_text: str):
    """解析 hook 輸出的 additionalContext；若無輸出回傳 None。"""
    stdout_text = stdout_text.strip()
    if not stdout_text:
        return None
    data = json.loads(stdout_text)
    return data["hookSpecificOutput"]["additionalContext"]


# ---------------------------------------------------------------------------
# 三態訊息測試（acceptance 第 3 項）
# ---------------------------------------------------------------------------


def test_no_active_and_nothing_cleared_emits_no_dispatch_message(
    monkeypatch, capsys
):
    """(a) 未派發過：cleared=False、無活躍 → 不輸出 dispatch-state 訊息。

    這是 PC-070 誘因場景：以前會在每次 Bash 後廣播 [OK]，誘發 PM 焦慮性檢查。
    """
    exit_code, out = _run_hook(
        monkeypatch,
        capsys,
        tool_input={"description": "random agent"},
        active_after_clear=[],
        cleared_return=False,
    )

    assert exit_code == 0
    ctx = _parse_additional_context(out)
    # 應完全無 additionalContext 輸出，或無 [OK]/[WAIT]
    assert ctx is None


def test_active_dispatch_remaining_emits_wait(monkeypatch, capsys):
    """(b) 有活躍派發：輸出 [WAIT] 並列出剩餘代理人。"""
    exit_code, out = _run_hook(
        monkeypatch,
        capsys,
        tool_input={"description": "agent-A"},
        active_after_clear=[
            {"agent_description": "agent-B"},
            {"agent_description": "agent-C"},
        ],
        cleared_return=True,
    )

    assert exit_code == 0
    ctx = _parse_additional_context(out)
    assert ctx is not None
    assert "[WAIT]" in ctx
    assert "agent-B" in ctx and "agent-C" in ctx
    assert "[OK]" not in ctx


def test_cleared_and_no_active_emits_ok(monkeypatch, capsys):
    """(c) 剛完成驗收：cleared=True、無剩餘活躍 → 輸出 [OK]。"""
    exit_code, out = _run_hook(
        monkeypatch,
        capsys,
        tool_input={"description": "agent-last"},
        active_after_clear=[],
        cleared_return=True,
    )

    assert exit_code == 0
    ctx = _parse_additional_context(out)
    assert ctx is not None
    assert "[OK]" in ctx
    assert "所有代理人已完成" in ctx


# ---------------------------------------------------------------------------
# 背景代理人時機修正測試（acceptance 第 1、4 項根因修復）
# ---------------------------------------------------------------------------


def test_background_agent_does_not_clear_or_broadcast(monkeypatch, capsys):
    """run_in_background=true 時：不清除 dispatch、不輸出 [OK]/[WAIT]。

    PostToolUse 在 background agent 啟動時即觸發（agentId 已返回但代理人仍在執行）。
    若此時清除 dispatch 並廣播「完成」，會誘發 PM 錯誤驗收（PC-070 直接根因）。
    """
    cleared_calls = []

    def _track_clear(_root, desc):
        cleared_calls.append(desc)
        return True

    monkeypatch.setattr(_hook, "get_state_file_path", lambda _root: _StateFileStub())
    monkeypatch.setattr(_hook, "clear_dispatch", _track_clear)
    # 即使底層仍有活躍派發，背景路徑也不應輸出 [WAIT]
    monkeypatch.setattr(
        _hook,
        "get_active_dispatches",
        lambda _root: [{"agent_description": "bg-agent"}],
    )
    monkeypatch.setattr(_hook, "cleanup_expired", lambda _root: 0)
    monkeypatch.setattr(_hook, "detect_orphan_branches", lambda _root: [])

    payload = {
        "tool_input": {
            "description": "bg-agent",
            "run_in_background": True,
        }
    }
    monkeypatch.setattr("sys.stdin", io.StringIO(json.dumps(payload)))

    exit_code = _hook.main()
    captured = capsys.readouterr()

    assert exit_code == 0
    # 未呼叫 clear_dispatch（保留記錄供 task-notification 處理）
    assert cleared_calls == []
    # 無 dispatch-state 訊息輸出（無 housekeeping 時完全靜默）
    ctx = _parse_additional_context(captured.out)
    assert ctx is None


def test_background_agent_still_runs_housekeeping(monkeypatch, capsys):
    """background agent 路徑仍需執行 cleanup_expired / orphan 偵測。"""
    monkeypatch.setattr(_hook, "get_state_file_path", lambda _root: _StateFileStub())
    monkeypatch.setattr(_hook, "clear_dispatch", lambda _root, _d: False)
    monkeypatch.setattr(_hook, "get_active_dispatches", lambda _root: [])
    monkeypatch.setattr(_hook, "cleanup_expired", lambda _root: 2)
    monkeypatch.setattr(
        _hook, "detect_orphan_branches", lambda _root: ["orphan-A"]
    )

    payload = {
        "tool_input": {
            "description": "bg-housekeeping",
            "run_in_background": True,
        }
    }
    monkeypatch.setattr("sys.stdin", io.StringIO(json.dumps(payload)))

    exit_code = _hook.main()
    captured = capsys.readouterr()

    assert exit_code == 0
    ctx = _parse_additional_context(captured.out)
    assert ctx is not None
    # 應含 housekeeping 訊息
    assert "超時" in ctx
    assert "orphan" in ctx.lower() or "orphan-A" in ctx
    # 不含完成/等待誤導訊息
    assert "[OK]" not in ctx
    assert "[WAIT]" not in ctx


# ---------------------------------------------------------------------------
# 邊界測試：無 description / 無 state file
# ---------------------------------------------------------------------------


def test_no_agent_description_skips(monkeypatch, capsys):
    """tool_input 缺 description 時直接跳過（維持既有行為）。"""
    monkeypatch.setattr("sys.stdin", io.StringIO(json.dumps({"tool_input": {}})))

    exit_code = _hook.main()
    captured = capsys.readouterr()

    assert exit_code == 0
    assert captured.out.strip() == ""
