"""
identity_guard.check_identity 單元測試（W1-048）。

對應規格表五情境（docs/work-logs/v1/.../1.0.0-W1-048.md 判定邏輯表）：
1. 未提供 --as          → 放行（None），且 stderr 含警告（向後相容零破壞）
2. --as = PM 身份        → 放行（None），無 deny
3. --as = who.current   → 放行（None）
4. --as != who.current  → deny（exit 1）
5. who.current 空值      → deny（exit 1）

設計約束驗證：deny 不寫入任何狀態（本測試以 check_identity 不觸碰
save_ticket 為前提；check_identity 僅讀取 load_ticket）。
"""

import json

import pytest

from ticket_system.lib import identity_guard
from ticket_system.lib.identity_guard import (
    check_identity,
    PM_AGENT_NAME,
    IDENTITY_DENY_EXIT,
    RESULT_WARN,
    RESULT_DENY,
)


@pytest.fixture(autouse=True)
def _isolate_identity_log(tmp_path, monkeypatch):
    """Autouse：將 telemetry 落盤導向 tmp，避免污染真實 .claude/hook-logs。

    W1-057：check_identity 的 warn/deny 路徑現會 append usage.log；本檔測試
    位於 tests/ 樹（無 ticket_system/tests/conftest.py 的 hook-logs autouse），
    故此處自設 HOOK_LOGS_DIR 隔離。回傳 log 檔路徑供 telemetry 測試斷言。
    """
    logs_dir = tmp_path / "hook-logs"
    monkeypatch.setenv("HOOK_LOGS_DIR", str(logs_dir))
    return logs_dir / "identity-guard" / "usage.log"


def _patch_who(monkeypatch, who_current):
    """patch load_ticket 回傳含指定 who.current 的 ticket dict。"""
    def fake_load(version, ticket_id):
        if who_current is _SENTINEL_NO_TICKET:
            return None
        return {"id": ticket_id, "who": {"current": who_current}}
    monkeypatch.setattr(identity_guard, "load_ticket", fake_load)


_SENTINEL_NO_TICKET = object()


def test_no_as_flag_passes_with_warning(monkeypatch, capsys):
    """情境 1：未提供 --as → 放行 + stderr 警告（向後相容零破壞）。"""
    _patch_who(monkeypatch, "thyme-python-developer")
    result = check_identity("1.0.0", "1.0.0-W1-048", None)
    assert result is None
    captured = capsys.readouterr()
    assert "建議帶 --as" in captured.err
    assert captured.err  # 警告走 stderr


def test_no_as_flag_empty_string_treated_as_unprovided(monkeypatch, capsys):
    """空字串等同未提供（argparse default None；防禦性測試）。"""
    _patch_who(monkeypatch, "thyme-python-developer")
    assert check_identity("1.0.0", "1.0.0-W1-048", "") is None


def test_pm_identity_exempt(monkeypatch, capsys):
    """情境 2：--as = PM 身份 → 一律放行（bookkeeping 豁免），不查 who.current。"""
    _patch_who(monkeypatch, "thyme-python-developer")  # 即使不符也放行
    result = check_identity("1.0.0", "1.0.0-W1-048", PM_AGENT_NAME)
    assert result is None
    captured = capsys.readouterr()
    assert "deny" not in captured.err


def test_non_string_as_value_treated_as_unprovided(monkeypatch, capsys):
    """非 str 值（如 Mock args auto-attr / getattr default）視為未提供 → 放行 + 警告。

    回歸防護：既有 Mock-based 測試傳 args.as_agent 為 Mock 物件（truthy 但非
    str），不得誤觸發 deny。argparse --as 恆為 str/None，此為防禦性。
    """
    from unittest.mock import Mock
    _patch_who(monkeypatch, "thyme-python-developer")
    result = check_identity("1.0.0", "1.0.0-W1-048", Mock())
    assert result is None
    captured = capsys.readouterr()
    assert "deny" not in captured.err


def test_matching_identity_passes(monkeypatch):
    """情境 3：--as = who.current → 放行。"""
    _patch_who(monkeypatch, "thyme-python-developer")
    result = check_identity("1.0.0", "1.0.0-W1-048", "thyme-python-developer")
    assert result is None


def test_mismatch_identity_denied(monkeypatch, capsys):
    """情境 4：--as != who.current → deny（exit 1）+ stderr 訊息引導回報 PM。"""
    _patch_who(monkeypatch, "thyme-python-developer")
    result = check_identity("1.0.0", "1.0.0-W1-048", "claude")
    assert result == IDENTITY_DENY_EXIT
    captured = capsys.readouterr()
    assert "deny" in captured.err
    assert "回報 PM" in captured.err
    assert "claude" in captured.err
    assert "thyme-python-developer" in captured.err


def test_empty_who_current_denied(monkeypatch, capsys):
    """情境 5：who.current 空值 + 提供 --as → deny（exit 1）。"""
    _patch_who(monkeypatch, "")
    result = check_identity("1.0.0", "1.0.0-W1-048", "claude")
    assert result == IDENTITY_DENY_EXIT
    captured = capsys.readouterr()
    assert "deny" in captured.err
    assert "(未指派)" in captured.err


def test_missing_who_key_denied(monkeypatch, capsys):
    """who 欄位缺失（None）+ 提供非 PM --as → deny（空值視同未指派）。"""
    def fake_load(version, ticket_id):
        return {"id": ticket_id}  # 無 who 欄位
    monkeypatch.setattr(identity_guard, "load_ticket", fake_load)
    result = check_identity("1.0.0", "1.0.0-W1-048", "claude")
    assert result == IDENTITY_DENY_EXIT


def test_ticket_not_found_denied_with_as(monkeypatch, capsys):
    """ticket 不存在 + 提供非 PM --as → who.current 視為空值 → deny。"""
    _patch_who(monkeypatch, _SENTINEL_NO_TICKET)
    result = check_identity("1.0.0", "1.0.0-W1-999", "claude")
    assert result == IDENTITY_DENY_EXIT


def test_ticket_not_found_pm_still_exempt(monkeypatch):
    """ticket 不存在但 --as = PM → 仍放行（豁免先於 who.current 解析）。"""
    _patch_who(monkeypatch, _SENTINEL_NO_TICKET)
    assert check_identity("1.0.0", "1.0.0-W1-999", PM_AGENT_NAME) is None


# ============================================================
# W1-057 — warn/deny telemetry 落盤
# ============================================================


def _read_records(log_path):
    """讀取 usage.log，回傳逐行 parse 的 JSON record 列表。"""
    text = log_path.read_text(encoding="utf-8")
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def test_warn_path_writes_telemetry(monkeypatch, _isolate_identity_log):
    """warn 路徑（未提供 --as）落盤一行結構化記錄，含 timestamp 與 result=warn。"""
    log_path = _isolate_identity_log
    _patch_who(monkeypatch, "thyme-python-developer")

    check_identity("1.0.0", "1.0.0-W1-057", None, command="complete")

    assert log_path.exists()
    records = _read_records(log_path)
    assert len(records) == 1
    rec = records[0]
    assert rec["result"] == RESULT_WARN
    assert rec["command"] == "complete"
    assert rec["ticket_id"] == "1.0.0-W1-057"
    assert rec["has_as"] is False
    assert rec["timestamp"]  # 非空


def test_deny_path_writes_telemetry(monkeypatch, _isolate_identity_log):
    """deny 路徑（身份不符）落盤同格式記錄，result=deny 且 has_as=True。"""
    log_path = _isolate_identity_log
    _patch_who(monkeypatch, "thyme-python-developer")

    result = check_identity("1.0.0", "1.0.0-W1-057", "claude", command="complete")

    assert result == IDENTITY_DENY_EXIT
    records = _read_records(log_path)
    assert len(records) == 1
    rec = records[0]
    assert rec["result"] == RESULT_DENY
    assert rec["has_as"] is True
    assert rec["ticket_id"] == "1.0.0-W1-057"
    assert rec["timestamp"]


def test_pass_path_does_not_write_telemetry(monkeypatch, _isolate_identity_log):
    """放行路徑（身份相符）不落盤（telemetry 只記 warn/deny 兩過渡期觀測點）。"""
    log_path = _isolate_identity_log
    _patch_who(monkeypatch, "thyme-python-developer")

    check_identity("1.0.0", "1.0.0-W1-057", "thyme-python-developer", command="complete")

    assert not log_path.exists()


def test_telemetry_appends_multiple_records(monkeypatch, _isolate_identity_log):
    """多次 warn/deny append 累積（append-only 語義）。"""
    log_path = _isolate_identity_log
    _patch_who(monkeypatch, "thyme-python-developer")

    check_identity("1.0.0", "1.0.0-W1-057", None, command="complete")
    check_identity("1.0.0", "1.0.0-W1-057", "claude", command="set-acceptance")

    records = _read_records(log_path)
    assert len(records) == 2
    assert records[0]["result"] == RESULT_WARN
    assert records[1]["result"] == RESULT_DENY


def test_telemetry_failure_does_not_block_main_flow(monkeypatch, capsys):
    """落盤失敗（OSError）不阻斷 CLI 主流程，但 stderr 可見（雙通道）。"""
    _patch_who(monkeypatch, "thyme-python-developer")

    def _raise_oserror(*args, **kwargs):
        raise OSError("simulated disk full")

    # patch open，模擬寫入失敗；deny 判定仍應正常返回
    monkeypatch.setattr("builtins.open", _raise_oserror)

    result = check_identity("1.0.0", "1.0.0-W1-057", "claude", command="complete")

    # 主流程仍正常返回 deny exit code（telemetry 失敗不影響判定）
    assert result == IDENTITY_DENY_EXIT
    captured = capsys.readouterr()
    assert "telemetry 落盤失敗" in captured.err


def test_default_command_is_unknown(monkeypatch, _isolate_identity_log):
    """呼叫端未傳 command 時，記錄 command=(unknown)（向後相容預設）。"""
    log_path = _isolate_identity_log
    _patch_who(monkeypatch, "thyme-python-developer")

    check_identity("1.0.0", "1.0.0-W1-057", None)

    records = _read_records(log_path)
    assert records[0]["command"] == "(unknown)"
