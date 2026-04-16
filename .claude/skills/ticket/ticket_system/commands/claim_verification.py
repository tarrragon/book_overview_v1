"""claim 命令的 AC 驗證子系統（Ticket 0.18.0-W11-001.1.x）。

本模組承載 claim 命令在派發前自動執行 AC 驗證所需的全部函式。本
sub-ticket（0.18.0-W11-001.1.1）僅落地「純函式」子集：

- ``summarize_results``：將多個 ``VerificationResult`` 聚合為 ``VerificationSummary``。
- ``render_results``：將 summary + results 渲染為使用者可讀的文字摘要（<=15 行）。

後續 sub-ticket（1.2 / 1.3）會補齊 ``execute_verification`` /
``run_all_verifications`` / ``prompt_user_decision`` / ``claim_with_verification``
等 I/O 層與 orchestrator 函式。
"""
from __future__ import annotations

from typing import Literal

from ticket_system.lib.verification_result import (
    VerificationResult,
    VerificationSummary,
)


# 渲染使用的狀態標籤對照表
_STATUS_TAG_MAP: dict[str, str] = {
    "passed": "PASS",
    "failed": "FAIL",
    "timeout": "SKIP",
    "env_error": "SKIP",
    "unverifiable": "N/A",
    "no_template": "----",
}

# 渲染輸出硬上限（行數與展開列數）
_MAX_DISPLAY_ROWS = 10

# unverifiable 合併集合（含 no_template / unverifiable / timeout / env_error）
_UNVERIFIABLE_STATUSES = frozenset(
    {"unverifiable", "no_template", "timeout", "env_error"}
)


def summarize_results(
    results: list[VerificationResult],
) -> VerificationSummary:
    """將驗證結果 list 聚合為 ``VerificationSummary``。

    狀態判斷規則：

    - 空 list → ``no_ac``。
    - 有任一 failed → ``has_failures``。
    - 無 failed 且有 passed → ``all_passed``。
    - 無 failed 無 passed → ``none_verifiable``。

    ``unverifiable`` 計數合併 ``unverifiable`` / ``no_template`` /
    ``timeout`` / ``env_error`` 四類（見 §4 資料結構定義）。

    Args:
        results: 單次 claim 驗證產生的結果清單。

    Returns:
        聚合後的 ``VerificationSummary``（frozen）。
    """
    if not results:
        return VerificationSummary(
            total=0, passed=0, failed=0, unverifiable=0, status="no_ac"
        )

    passed = sum(1 for r in results if r.status == "passed")
    failed = sum(1 for r in results if r.status == "failed")
    unverifiable = sum(
        1 for r in results if r.status in _UNVERIFIABLE_STATUSES
    )

    status: Literal["all_passed", "has_failures", "none_verifiable"]
    if failed > 0:
        status = "has_failures"
    elif passed > 0:
        status = "all_passed"
    else:
        status = "none_verifiable"

    return VerificationSummary(
        total=len(results),
        passed=passed,
        failed=failed,
        unverifiable=unverifiable,
        status=status,
    )


def render_results(
    summary: VerificationSummary,
    results: list[VerificationResult],
    ticket_id: str,
) -> str:
    """將 summary + results 渲染為使用者可讀的文字摘要。

    輸出格式規格（<= 15 行硬上限）：

    - 第 1 行：標題（含 ticket_id 與 AC 總數）。
    - 接續：每 AC 一行（最多 10 行），超過顯示 ``... (N more)``。
    - 空行 + 末行：``Result: X passed / Y failed / Z unverifiable``。

    Args:
        summary: 聚合結果。
        results: 原始結果 list。
        ticket_id: Ticket ID（顯示於標題）。

    Returns:
        多行文字（以 ``\\n`` 串接）；``no_ac`` 時回傳空字串。
    """
    if summary.status == "no_ac":
        return ""

    lines: list[str] = [
        f"[AC verification] Ticket {ticket_id} ({summary.total} items)"
    ]

    display_count = min(len(results), _MAX_DISPLAY_ROWS)
    for i in range(display_count):
        r = results[i]
        tag = _STATUS_TAG_MAP.get(r.status, "????")
        # AC.index 是 0-based，顯示時轉 1-based
        lines.append(f"  [{tag}] #{r.ac.index + 1} {r.message}")

    if len(results) > _MAX_DISPLAY_ROWS:
        remaining = len(results) - _MAX_DISPLAY_ROWS
        lines.append(f"  ... ({remaining} more)")

    lines.append("")
    lines.append(
        f"Result: {summary.passed} passed / "
        f"{summary.failed} failed / "
        f"{summary.unverifiable} unverifiable"
    )

    return "\n".join(lines)
