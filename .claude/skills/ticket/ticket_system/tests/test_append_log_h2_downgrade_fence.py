"""1.5.0-W6-016 — append-log H2 自動降級（W1-068 方案 B）加入 code fence 豁免。

問題（W6-013 附帶發現）：
`commands/track_acceptance.py` 的 H2 自動降級使用
`re.sub(r'(?m)^## ', '### ', content)` 對整段 content 無差別替換，
未辨識三反引號 code fence 圍欄區間，導致 fence 內引用的 '## ' 字面
（如 grep 輸出範例、markdown 教學片段）被誤降為 '### '，引用字面失真。

修復策略（fence 狀態機）：
逐行掃描，行首三反引號（含帶語言標注如 ```bash）toggle fence 狀態；
fence 內的行首 '## ' 不降級，fence 外維持現行降級行為。
未閉合 fence：進入 fence 後直到結尾都視為 fence 內（保守不改寫）。

覆蓋 cases：
1. fence 內 '## ' 保持原樣
2. 帶語言標注 fence（```bash）內 '## ' 保持原樣
3. 未閉合 fence 內 '## ' 保持原樣（保守不改寫）
4. fence 外 '## ' 仍降級為 '### '
5. 混合：fence 內外皆有 H2，僅 fence 外降級
6. stderr WARNING 僅在實際發生降級時輸出（純 fence 內含 H2 時不輸出警告）
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pytest

from ticket_system.lib import ticket_loader
from ticket_system.lib.parser import parse_frontmatter


@pytest.fixture
def tmp_ticket_dir(tmp_path: Path) -> Path:
    d = tmp_path / "tickets"
    d.mkdir()
    return d


@pytest.fixture
def patch_paths(tmp_ticket_dir: Path, monkeypatch):
    def _fake_get_ticket_path(version: str, ticket_id: str) -> Path:
        return tmp_ticket_dir / f"{ticket_id}.md"

    def _fake_load_ticket(version: str, ticket_id: str):
        path = tmp_ticket_dir / f"{ticket_id}.md"
        if not path.exists():
            return None
        try:
            fm, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        except Exception:
            return None
        if not fm:
            return None
        fm["_body"] = body
        fm["_path"] = str(path)
        return fm

    monkeypatch.setattr(ticket_loader, "get_ticket_path", _fake_get_ticket_path)
    monkeypatch.setattr(ticket_loader, "load_ticket", _fake_load_ticket)

    from ticket_system.commands import track_acceptance as ta_mod

    monkeypatch.setattr(ta_mod, "get_ticket_path", _fake_get_ticket_path)
    monkeypatch.setattr(ta_mod, "load_ticket", _fake_load_ticket)


def _write_ticket_with_body(
    path: Path, tid: str, body_sections: str, status: str = "in_progress"
) -> None:
    fm = (
        "---\n"
        f"id: {tid}\n"
        "title: test\n"
        "type: IMP\n"
        f"status: {status}\n"
        "assigned: true\n"
        "tdd_phase: phase3b\n"
        "children: []\n"
        "blockedBy: []\n"
        "acceptance: []\n"
        "spawned_tickets: []\n"
        "---\n\n"
    )
    path.write_text(fm + body_sections, encoding="utf-8")


def _call_append_log(ticket_id: str, section: str, content: str) -> int:
    from ticket_system.commands.track_acceptance import execute_append_log

    ns = argparse.Namespace(ticket_id=ticket_id, section=section, content=content)
    return execute_append_log(ns, "0.0.0")


BODY_WITH_SOLUTION = (
    "# Execution Log\n\n"
    "## Task Summary\n\n"
    "測試任務\n\n"
    "---\n\n"
    "## Solution\n\n"
    "<!-- To be filled by executing agent -->\n\n"
    "---\n\n"
    "## Test Results\n\n"
    "<!-- To be filled by executing agent -->\n"
)


class TestAppendLogH2DowngradeFenceExemption:
    """1.5.0-W6-016: code fence 內的行首 '## ' 不受 H2→H3 自動降級影響。"""

    def test_h2_inside_fence_kept_as_is(self, tmp_ticket_dir, patch_paths):
        """Case 1: fence 內 '## ' 保持原樣。"""
        tid = "0.0.0-W0-FE1"
        path = tmp_ticket_dir / f"{tid}.md"
        _write_ticket_with_body(path, tid, BODY_WITH_SOLUTION)

        content = "```\n## grep 輸出範例\n```"
        rc = _call_append_log(tid, "Solution", content)
        assert rc == 0

        new_body = path.read_text(encoding="utf-8")
        assert "## grep 輸出範例" in new_body

    def test_h2_inside_fence_with_language_tag_kept_as_is(
        self, tmp_ticket_dir, patch_paths
    ):
        """Case 2: 帶語言標注 fence（```bash）內 '## ' 保持原樣。"""
        tid = "0.0.0-W0-FE2"
        path = tmp_ticket_dir / f"{tid}.md"
        _write_ticket_with_body(path, tid, BODY_WITH_SOLUTION)

        content = "```bash\necho '## not a heading'\n```"
        rc = _call_append_log(tid, "Solution", content)
        assert rc == 0

        new_body = path.read_text(encoding="utf-8")
        assert "echo '## not a heading'" in new_body

    def test_h2_inside_unclosed_fence_kept_as_is(self, tmp_ticket_dir, patch_paths):
        """Case 3: 未閉合 fence 內 '## ' 保持原樣（保守不改寫）。"""
        tid = "0.0.0-W0-FE3"
        path = tmp_ticket_dir / f"{tid}.md"
        _write_ticket_with_body(path, tid, BODY_WITH_SOLUTION)

        content = "```\n## unclosed fence heading"
        rc = _call_append_log(tid, "Solution", content)
        assert rc == 0

        new_body = path.read_text(encoding="utf-8")
        assert "## unclosed fence heading" in new_body

    def test_h2_outside_fence_still_downgraded(self, tmp_ticket_dir, patch_paths):
        """Case 4: fence 外 '## ' 仍降級為 '### '。"""
        tid = "0.0.0-W0-FE4"
        path = tmp_ticket_dir / f"{tid}.md"
        _write_ticket_with_body(path, tid, BODY_WITH_SOLUTION)

        content = "## 不應存在的 H2 標題"
        rc = _call_append_log(tid, "Solution", content)
        assert rc == 0

        new_body = path.read_text(encoding="utf-8")
        assert "### 不應存在的 H2 標題" in new_body
        assert "\n## 不應存在的 H2 標題" not in new_body

    def test_mixed_fence_inside_kept_outside_downgraded(
        self, tmp_ticket_dir, patch_paths
    ):
        """Case 5: 混合 — fence 內外皆有 H2，僅 fence 外降級。"""
        tid = "0.0.0-W0-FE5"
        path = tmp_ticket_dir / f"{tid}.md"
        _write_ticket_with_body(path, tid, BODY_WITH_SOLUTION)

        content = (
            "## 真實子標題\n\n"
            "```\n"
            "## fence 內引用\n"
            "```\n\n"
            "## 另一個真實子標題"
        )
        rc = _call_append_log(tid, "Solution", content)
        assert rc == 0

        new_body = path.read_text(encoding="utf-8")
        assert "### 真實子標題" in new_body
        assert "### 另一個真實子標題" in new_body
        assert "## fence 內引用" in new_body

    def test_no_warning_when_only_fence_h2_present(
        self, tmp_ticket_dir, patch_paths, capsys
    ):
        """Case 6: 純 fence 內含 '## ' 時不輸出降級警告（無實際降級動作）。"""
        tid = "0.0.0-W0-FE6"
        path = tmp_ticket_dir / f"{tid}.md"
        _write_ticket_with_body(path, tid, BODY_WITH_SOLUTION)

        content = "```\n## fence 內引用\n```"
        rc = _call_append_log(tid, "Solution", content)
        assert rc == 0

        captured = capsys.readouterr()
        assert "WARNING" not in captured.err

    def test_warning_emitted_when_actual_downgrade_happens(
        self, tmp_ticket_dir, patch_paths, capsys
    ):
        """既有行為維持：fence 外實際降級時仍輸出 WARNING。"""
        tid = "0.0.0-W0-FE7"
        path = tmp_ticket_dir / f"{tid}.md"
        _write_ticket_with_body(path, tid, BODY_WITH_SOLUTION)

        content = "## 真實子標題"
        rc = _call_append_log(tid, "Solution", content)
        assert rc == 0

        captured = capsys.readouterr()
        assert "WARNING" in captured.err
