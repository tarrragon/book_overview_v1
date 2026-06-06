"""
0.20.0-W2-016: check_technical_debt_status TD 票目錄路徑支援巢狀 worklog 結構

Problem: scripts/version_release.py 行 495 用扁平路徑
    `worklog_dir / f"v{version}" / "tickets"`（docs/work-logs/v0.20.0/tickets），
未對齊行 449 已用的 config pattern（resolve_worklog_dir 巢狀路徑）。
後果：巢狀票目錄（docs/work-logs/v0/v0.20/v0.20.0/tickets）的 *-TD-*.md 被漏檢，
TD 檢查永遠 false negative（找不到扁平票目錄 = 誤判無 TD）。

修復後：TD 檢查能定位巢狀票目錄並偵測 pending TD，同時保留扁平 fallback 相容舊 v0.18.0。
"""

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import version_release as vr  # noqa: E402


def _write_pending_td(tickets_dir: Path, version_series: str) -> None:
    """在 tickets_dir 建立一張 pending 的 TD 票，target 為當前版本系列。"""
    tickets_dir.mkdir(parents=True, exist_ok=True)
    td = tickets_dir / f"{version_series}.0-TD-001.md"
    td.write_text(
        "---\n"
        "ticket_id: TD-001\n"
        "status: pending\n"
        f"version: {version_series}\n"
        f"target: {version_series}\n"
        "---\n\n# TD ticket\n",
        encoding="utf-8",
    )


class TestTechDebtNestedPath:
    def test_detects_pending_td_in_nested_dir(self, tmp_path):
        """巢狀票目錄（docs/work-logs/v0/v0.20/v0.20.0/tickets）的 pending TD 被偵測到。

        RED：行 495 扁平路徑會找不到巢狀票目錄，導致 passed=True false negative。
        """
        nested_tickets = tmp_path / "docs/work-logs/v0/v0.20/v0.20.0/tickets"
        _write_pending_td(nested_tickets, "0.20")

        config = dict(vr.DEFAULT_VERSION_RELEASE_CONFIG)
        config["worklog_path_pattern"] = (
            "docs/work-logs/v{major}/v{major_minor}/v{version}"
        )

        with patch.object(vr, "get_project_root", return_value=tmp_path), \
                patch.object(vr, "load_version_release_config", return_value=config):
            result = vr.check_technical_debt_status("0.20.0")

        assert result["pending_count"] == 1, (
            f"應偵測到 1 張 pending TD，實際 {result['pending_count']}；"
            f"message={result['message']}"
        )
        assert result["passed"] is False

    def test_flat_fallback_still_works(self, tmp_path):
        """扁平票目錄（docs/work-logs/v0.18.0/tickets）的 pending TD 仍被偵測（向後相容）。"""
        flat_tickets = tmp_path / "docs/work-logs/v0.18.0/tickets"
        _write_pending_td(flat_tickets, "0.18")

        config = dict(vr.DEFAULT_VERSION_RELEASE_CONFIG)
        config["worklog_path_pattern"] = (
            "docs/work-logs/v{major}/v{major_minor}/v{version}"
        )

        with patch.object(vr, "get_project_root", return_value=tmp_path), \
                patch.object(vr, "load_version_release_config", return_value=config):
            result = vr.check_technical_debt_status("0.18.0")

        assert result["pending_count"] == 1, (
            f"扁平 fallback 應偵測到 1 張 pending TD，實際 {result['pending_count']}；"
            f"message={result['message']}"
        )
        assert result["passed"] is False

    def test_no_td_dir_passes(self, tmp_path):
        """無任何票目錄時 passed=True（無 TD 不阻擋發布）。"""
        config = dict(vr.DEFAULT_VERSION_RELEASE_CONFIG)
        config["worklog_path_pattern"] = (
            "docs/work-logs/v{major}/v{major_minor}/v{version}"
        )

        with patch.object(vr, "get_project_root", return_value=tmp_path), \
                patch.object(vr, "load_version_release_config", return_value=config):
            result = vr.check_technical_debt_status("0.20.0")

        assert result["passed"] is True
        assert result["pending_count"] == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
