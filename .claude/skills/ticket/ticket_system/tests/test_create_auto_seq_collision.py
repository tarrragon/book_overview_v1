"""Phase 2 RED — ticket create auto-seq 衝突修復（1.0.0-W1-042）。

來源 Ticket: 1.0.0-W1-042（IMP）
觸發事件: W1-039 執行期間 create 未帶 --seq 將新票誤配為已存在的 1.0.0-W1-001
（與既有 SKILL 上架票 ID 衝突），產生記錄平面幻影但世界平面無檔案落盤。

三層缺陷鏈
----------
- 掃描層 get_next_seq：兩來源（本地 glob + main ref）同時掃空時回傳 1，
  降級靜默無警告（環境依賴：worktree stale base / git 逾時 / root 解析偏差）。
- 配號層 _resolve_ticket_id_and_wave：算出 ticket_id 後僅驗格式，無存在性檢查。
- 落盤層 save_ticket：無條件寫入，ID 撞號時靜默覆寫。

修復設計（指導本測試斷言）
--------------------------
1. collision guard（核心，放 create 層 _resolve_ticket_id_and_wave）：
   - auto-seq 模式：算出 ID 已存在則遞增 seq 直到找到可用值。
   - 顯式 --seq 模式：算出 ID 已存在則以 ErrorEnvelope 報錯退出（不覆寫、不跳號）。
2. 降級可觀測：get_next_seq 兩來源皆空且 main ref 掃描降級（回 None）時，
   輸出 stderr warning（quality-baseline 規則 4 雙通道）。
3. 不改 save_ticket 本身語意，guard 放 create 層。

測試策略
--------
Sociable Unit Test：真實 tmp 目錄重現既有 ticket 檔，不 mock 被測函式本身、
Path glob、seq 解析邏輯。get_next_seq 降級警告以 mock list_ticket_files_from_main
回 None + 空目錄重現「兩來源同時掃空且 main 降級」的環境態。

RED 階段預期
-----------
本檔測試將因 collision guard 尚未實作、get_next_seq 降級警告尚未加入而失敗。
"""

from __future__ import annotations

import argparse
from pathlib import Path
from unittest.mock import patch

import pytest

from ticket_system.lib import ticket_builder
from ticket_system.lib.ticket_builder import get_next_seq
from ticket_system.commands import create as create_cmd


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _tickets_dir(root: Path, version: str = "1.0.0") -> Path:
    """回傳三層階層 tickets 目錄路徑（對齊 get_tickets_dir 規則）。"""
    parts = version.split(".")
    major = f"v{parts[0]}"
    minor = f"v{parts[0]}.{parts[1]}"
    return root / "docs" / "work-logs" / major / minor / f"v{version}" / "tickets"


def _write_ticket(tickets_dir: Path, ticket_id: str) -> Path:
    """寫入最小化 ticket .md 檔（掃描只看檔名，內容僅需可解析）。"""
    tickets_dir.mkdir(parents=True, exist_ok=True)
    path = tickets_dir / f"{ticket_id}.md"
    path.write_text(
        f"---\nid: {ticket_id}\ntitle: Existing {ticket_id}\n"
        f"type: IMP\nstatus: pending\n---\n\n# Body\n",
        encoding="utf-8",
    )
    return path


def _patch_project_root(monkeypatch, root: Path) -> None:
    """將 ticket_builder / paths 的 get_project_root 指向 root。"""
    monkeypatch.setattr(
        ticket_builder, "get_project_root", lambda: root, raising=False
    )
    import ticket_system.lib.paths as paths_mod

    monkeypatch.setattr(
        paths_mod, "get_project_root", lambda: root, raising=False
    )


def _make_args(seq=None, wave=1, version="1.0.0", parent=None) -> argparse.Namespace:
    """建構 _resolve_ticket_id_and_wave 所需的最小 args。"""
    return argparse.Namespace(seq=seq, wave=wave, version=version, parent=parent)


# ---------------------------------------------------------------------------
# AC1：collision guard — auto-seq 模式遞增至可用 seq（防兩來源掃空撞號）
# ---------------------------------------------------------------------------


class TestAutoSeqCollisionGuard:
    """auto-seq 算出的 ID 已存在時，遞增 seq 直到找到可用值。"""

    def test_auto_seq_skips_existing_id(self, tmp_path, monkeypatch):
        """
        Given: 環境態使 auto-seq 誤算 seq=1（mock get_next_seq 回 1），
               但 1.0.0-W1-001.md 已存在於 tickets 目錄
        前置驗證: 1.0.0-W1-001.md 落盤存在
        When: _resolve_ticket_id_and_wave(args(seq=None), "1.0.0")
        Then: 回傳 ticket_id 不為 1.0.0-W1-001（遞增至可用 seq）
        """
        root = tmp_path / "repo"
        tickets_dir = _tickets_dir(root)
        existing = _write_ticket(tickets_dir, "1.0.0-W1-001")
        assert existing.exists(), "前置條件失敗：W1-001 應已存在"

        _patch_project_root(monkeypatch, root)

        # 模擬掃描層誤判：get_next_seq 回傳已被占用的 1
        with patch.object(create_cmd, "get_next_seq", return_value=1):
            result = create_cmd._resolve_ticket_id_and_wave(
                _make_args(seq=None, wave=1), "1.0.0"
            )

        assert result is not None
        _version, ticket_id, _wave = result
        assert ticket_id != "1.0.0-W1-001", (
            f"collision guard 失效：誤配已存在 ID {ticket_id}"
        )
        assert ticket_id == "1.0.0-W1-002", (
            f"應遞增至下一個可用 seq，實際 {ticket_id}"
        )

    def test_auto_seq_skips_multiple_existing(self, tmp_path, monkeypatch):
        """
        Given: 1.0.0-W1-001 / W1-002 / W1-003 皆存在，auto-seq 誤回 1
        When: _resolve_ticket_id_and_wave(args(seq=None), "1.0.0")
        Then: 遞增跳過三個已存在 ID，回傳 1.0.0-W1-004
        """
        root = tmp_path / "repo"
        tickets_dir = _tickets_dir(root)
        for sid in ("1.0.0-W1-001", "1.0.0-W1-002", "1.0.0-W1-003"):
            _write_ticket(tickets_dir, sid)

        _patch_project_root(monkeypatch, root)

        with patch.object(create_cmd, "get_next_seq", return_value=1):
            result = create_cmd._resolve_ticket_id_and_wave(
                _make_args(seq=None, wave=1), "1.0.0"
            )

        assert result is not None
        _version, ticket_id, _wave = result
        assert ticket_id == "1.0.0-W1-004", (
            f"應跳過三個已存在 ID，實際 {ticket_id}"
        )

    def test_auto_seq_unchanged_when_no_collision(self, tmp_path, monkeypatch):
        """
        Given: tickets 目錄無 W1-005，auto-seq 正常算出 seq=5
        When: _resolve_ticket_id_and_wave(args(seq=None), "1.0.0")
        Then: 回傳 1.0.0-W1-005（無碰撞時不改變行為）
        """
        root = tmp_path / "repo"
        _tickets_dir(root).mkdir(parents=True, exist_ok=True)

        _patch_project_root(monkeypatch, root)

        with patch.object(create_cmd, "get_next_seq", return_value=5):
            result = create_cmd._resolve_ticket_id_and_wave(
                _make_args(seq=None, wave=1), "1.0.0"
            )

        assert result is not None
        _version, ticket_id, _wave = result
        assert ticket_id == "1.0.0-W1-005"


# ---------------------------------------------------------------------------
# AC2：顯式 --seq 撞號報錯（尊重用戶意圖，不覆寫、不自動跳號）
# ---------------------------------------------------------------------------


class TestExplicitSeqCollisionErrors:
    """顯式 --seq 指定已存在 ID 時報錯退出。"""

    def test_explicit_seq_collision_returns_none(self, tmp_path, monkeypatch, capsys):
        """
        Given: 1.0.0-W1-001.md 已存在，用戶顯式 --seq 1
        前置驗證: W1-001.md 落盤存在
        When: _resolve_ticket_id_and_wave(args(seq=1), "1.0.0")
        Then: 回傳 None（報錯退出，不覆寫、不跳號），stdout 含 ErrorEnvelope 撞號訊息
        """
        root = tmp_path / "repo"
        tickets_dir = _tickets_dir(root)
        existing = _write_ticket(tickets_dir, "1.0.0-W1-001")
        assert existing.exists()

        _patch_project_root(monkeypatch, root)

        result = create_cmd._resolve_ticket_id_and_wave(
            _make_args(seq=1, wave=1), "1.0.0"
        )

        assert result is None, "顯式 --seq 撞號應報錯退出（回 None）"
        captured = capsys.readouterr()
        # ErrorEnvelope 透過 stdout 輸出，內容應含撞號語意與 ticket id
        assert "1.0.0-W1-001" in captured.out
        assert (
            "存在" in captured.out
            or "EXISTS" in captured.out
            or "COLLISION" in captured.out.upper()
        ), f"應含撞號錯誤語意，實際輸出: {captured.out}"

    def test_explicit_seq_no_collision_passes(self, tmp_path, monkeypatch):
        """
        Given: tickets 目錄無 W1-042，用戶顯式 --seq 42
        When: _resolve_ticket_id_and_wave(args(seq=42), "1.0.0")
        Then: 回傳 1.0.0-W1-042（無碰撞時尊重顯式 seq，不自動跳號）
        """
        root = tmp_path / "repo"
        _tickets_dir(root).mkdir(parents=True, exist_ok=True)

        _patch_project_root(monkeypatch, root)

        result = create_cmd._resolve_ticket_id_and_wave(
            _make_args(seq=42, wave=1), "1.0.0"
        )

        assert result is not None
        _version, ticket_id, _wave = result
        assert ticket_id == "1.0.0-W1-042"


# ---------------------------------------------------------------------------
# AC3：get_next_seq 降級可觀測（兩來源掃空且 main ref 降級 → stderr warning）
# ---------------------------------------------------------------------------


class TestGetNextSeqDowngradeWarning:
    """兩來源皆空且 main ref 掃描降級（None）時輸出 stderr warning。"""

    def test_warns_when_both_sources_empty_and_main_downgraded(
        self, tmp_path, monkeypatch, capsys
    ):
        """
        Given: 空 tickets 目錄（本地 glob 空）+ main ref 掃描降級（mock 回 None）
        When: get_next_seq("1.0.0", 1)
        Then: 回傳 1（行為不變）且 stderr 含降級 warning（規則 4 雙通道）
        """
        root = tmp_path / "repo"
        _tickets_dir(root).mkdir(parents=True, exist_ok=True)
        _patch_project_root(monkeypatch, root)

        with patch.object(
            ticket_builder, "list_ticket_files_from_main", return_value=None
        ):
            result = get_next_seq("1.0.0", 1)

        assert result == 1
        captured = capsys.readouterr()
        assert "WARNING" in captured.err, (
            f"降級時應輸出 stderr warning，實際 stderr: {captured.err!r}"
        )
        assert "get_next_seq" in captured.err

    def test_no_warning_when_local_has_tickets(self, tmp_path, monkeypatch, capsys):
        """
        Given: 本地有 W1-003（非空），main ref 降級（None）
        When: get_next_seq("1.0.0", 1)
        Then: 回傳 4，不輸出降級 warning（本地來源有效，非兩來源皆空）
        """
        root = tmp_path / "repo"
        tickets_dir = _tickets_dir(root)
        _write_ticket(tickets_dir, "1.0.0-W1-003")
        _patch_project_root(monkeypatch, root)

        with patch.object(
            ticket_builder, "list_ticket_files_from_main", return_value=None
        ):
            result = get_next_seq("1.0.0", 1)

        assert result == 4
        captured = capsys.readouterr()
        assert "get_next_seq" not in captured.err, (
            f"本地來源有效時不應輸出降級 warning，實際 stderr: {captured.err!r}"
        )

    def test_no_warning_when_main_ref_available(self, tmp_path, monkeypatch, capsys):
        """
        Given: 空本地目錄，main ref 掃描成功回空清單（非降級，是 main 確實無此 wave）
        When: get_next_seq("1.0.0", 1)
        Then: 回傳 1，不輸出降級 warning（main ref 有效解析，只是無檔）
        """
        root = tmp_path / "repo"
        _tickets_dir(root).mkdir(parents=True, exist_ok=True)
        _patch_project_root(monkeypatch, root)

        with patch.object(
            ticket_builder, "list_ticket_files_from_main", return_value=[]
        ):
            result = get_next_seq("1.0.0", 1)

        assert result == 1
        captured = capsys.readouterr()
        assert "get_next_seq" not in captured.err, (
            f"main ref 有效解析時不應誤報降級 warning，實際 stderr: {captured.err!r}"
        )
