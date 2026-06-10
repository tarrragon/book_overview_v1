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

import pytest

from ticket_system.lib import identity_guard
from ticket_system.lib.identity_guard import (
    check_identity,
    PM_AGENT_NAME,
    IDENTITY_DENY_EXIT,
)


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
