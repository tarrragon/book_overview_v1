"""Ticket 0.18.0-W11-001.1.1 — Group B + C 單元測試。

- Group B：``summarize_results``（5 案例）
- Group C：``render_results``（4 案例）

後續 sub-ticket（1.2 / 1.3）會追加 Group D-K 的測試案例到本檔。
"""
from __future__ import annotations

import pytest

from ticket_system.lib.ac_parser import AC
from ticket_system.lib.verification_result import (
    VerificationResult,
    VerificationSummary,
)
from ticket_system.commands.claim_verification import (
    render_results,
    summarize_results,
)


# ----------------------------------------------------------------------
# Fixtures / helpers
# ----------------------------------------------------------------------


def _make_ac(index: int, text: str = "sample AC") -> AC:
    """建立測試用 AC 物件。"""
    return AC(index=index, text=text, checked=False, raw=f"[ ] {text}")


def _make_result(
    index: int,
    status: str,
    template_name: str | None = "tpl",
    message: str = "msg",
    exit_code: int | None = 0,
) -> VerificationResult:
    """建立測試用 VerificationResult。"""
    return VerificationResult(
        ac=_make_ac(index),
        status=status,  # type: ignore[arg-type]
        template_name=template_name,
        message=message,
        exit_code=exit_code,
    )


# ----------------------------------------------------------------------
# Group B：summarize_results
# ----------------------------------------------------------------------


class TestSummarizeResults:
    """Group B：summarize_results 聚合邏輯。"""

    def test_b1_empty_list_returns_no_ac(self):
        """B1：空 list → status='no_ac', total=0。"""
        summary = summarize_results([])
        assert summary.status == "no_ac"
        assert summary.total == 0
        assert summary.passed == 0
        assert summary.failed == 0
        assert summary.unverifiable == 0

    def test_b2_all_passed(self):
        """B2：3 個 passed → status='all_passed'。"""
        results = [_make_result(i, "passed") for i in range(3)]
        summary = summarize_results(results)
        assert summary.status == "all_passed"
        assert summary.total == 3
        assert summary.passed == 3
        assert summary.failed == 0
        assert summary.unverifiable == 0

    def test_b3_has_failures(self):
        """B3：1 passed + 1 failed + 1 no_template → has_failures。"""
        results = [
            _make_result(0, "passed"),
            _make_result(1, "failed", exit_code=1),
            _make_result(2, "no_template", template_name=None),
        ]
        summary = summarize_results(results)
        assert summary.status == "has_failures"
        assert summary.total == 3
        assert summary.passed == 1
        assert summary.failed == 1
        assert summary.unverifiable == 1

    def test_b4_none_verifiable(self):
        """B4：2 no_template + 1 unverifiable → none_verifiable。"""
        results = [
            _make_result(0, "no_template", template_name=None),
            _make_result(1, "no_template", template_name=None),
            _make_result(2, "unverifiable"),
        ]
        summary = summarize_results(results)
        assert summary.status == "none_verifiable"
        assert summary.total == 3
        assert summary.passed == 0
        assert summary.failed == 0
        assert summary.unverifiable == 3

    def test_b5_timeout_and_env_error_count_as_unverifiable(self):
        """B5：passed + timeout + env_error → timeout/env_error 計入 unverifiable。"""
        results = [
            _make_result(0, "passed"),
            _make_result(1, "timeout", exit_code=None),
            _make_result(2, "env_error", exit_code=None),
        ]
        summary = summarize_results(results)
        # 有 passed 且無 failed → all_passed（B5 著重計數邏輯）
        assert summary.passed == 1
        assert summary.failed == 0
        assert summary.unverifiable == 2
        assert summary.total == 3


# ----------------------------------------------------------------------
# Group C：render_results
# ----------------------------------------------------------------------


class TestRenderResults:
    """Group C：render_results 格式化輸出。"""

    def test_c1_standard_6_ac_within_15_lines(self):
        """C1：6 AC → 標題 + 每 AC 一行 + 總行數 <= 15。"""
        ticket_id = "0.18.0-W5-002"
        results = [
            _make_result(0, "passed", message="npm test 通過"),
            _make_result(1, "failed", message="coverage 72%"),
            _make_result(2, "timeout", message="exceeded 60s"),
            _make_result(3, "env_error", message="command not found"),
            _make_result(4, "unverifiable", message="manual check"),
            _make_result(5, "no_template", template_name=None, message="no match"),
        ]
        summary = summarize_results(results)

        output = render_results(summary, results, ticket_id)
        lines = output.split("\n")

        # (a) 標題行含 ticket_id 與 AC 總數
        assert ticket_id in lines[0]
        assert "6" in lines[0]
        # (b) 每 AC 至少一行（6 行中段）
        ac_lines = [l for l in lines if l.startswith("  [")]
        assert len(ac_lines) == 6
        # (c) 總行數 <= 15
        assert len(lines) <= 15

    def test_c2_no_ac_returns_empty_or_title_only(self):
        """C2：N=0（no_ac）時不 crash，回傳空字串。"""
        summary = summarize_results([])
        output = render_results(summary, [], "0.18.0-W5-001")
        # 允許空字串或僅標題行（不 crash 即可）
        assert output == "" or len(output.split("\n")) <= 1

    def test_c3_more_than_10_folds(self):
        """C3：N=12 → 前 10 行 + '... (2 more)' + 總行數 <= 15。"""
        results = [_make_result(i, "passed") for i in range(12)]
        summary = summarize_results(results)

        output = render_results(summary, results, "0.18.0-W5-003")
        lines = output.split("\n")

        # 存在折疊標記
        assert any("(2 more)" in l for l in lines)
        # 只顯示前 10 個 AC 行
        ac_lines = [l for l in lines if l.startswith("  [PASS]")]
        assert len(ac_lines) == 10
        # 總行數 <= 15
        assert len(lines) <= 15

    def test_c4_status_tag_mapping(self):
        """C4：各 status 對應正確的狀態標籤。"""
        results = [
            _make_result(0, "passed"),
            _make_result(1, "failed"),
            _make_result(2, "timeout"),
            _make_result(3, "env_error"),
            _make_result(4, "unverifiable"),
            _make_result(5, "no_template", template_name=None),
        ]
        summary = summarize_results(results)
        output = render_results(summary, results, "0.18.0-W5-004")

        assert "[PASS]" in output  # passed
        assert "[FAIL]" in output  # failed
        # timeout / env_error 都映射為 SKIP
        assert output.count("[SKIP]") == 2
        assert "[N/A]" in output  # unverifiable
        assert "[----]" in output  # no_template


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
