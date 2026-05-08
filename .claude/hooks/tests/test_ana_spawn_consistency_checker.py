"""
ANA Spawn Consistency Checker Tests (W17-168)

對應 ANA: 0.18.0-W17-167 L2 hook 強制層
驗證 acceptance-gate-hook ANA complete 前 spawn 一致性檢查邏輯。

覆蓋情境：
  (a) W17-162 元反例舊版（complete 前 spawned=[]，Solution 含 4 項規劃）→ block
  (b) W17-167 自身元反例舊版（complete 前 spawned=[]，Solution 含 3 項規劃）→ block
  (c) 含豁免標記「無需建 ticket」→ 跳過（通過）
  (d) S+C < N（部分漏建）→ warning 不阻擋
  (e) S+C >= N（全建）→ 通過
  (f) Solution 無 spawn 表格行 → 通過
  (g) 非 ANA ticket → 跳過
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import pytest

_hooks_dir = Path(__file__).parent.parent
if str(_hooks_dir) not in sys.path:
    sys.path.insert(0, str(_hooks_dir))

from acceptance_checkers.ana_spawn_consistency_checker import (  # noqa: E402
    check_ana_spawn_consistency,
)


@pytest.fixture
def logger():
    log = logging.getLogger("test-ana-spawn-consistency")
    log.addHandler(logging.NullHandler())
    log.setLevel(logging.CRITICAL)
    return log


def _make_content(solution_body: str) -> str:
    """組合最小 ticket 內容：frontmatter + Solution 區段。"""
    return (
        "---\nid: 0.18.0-W17-999\ntype: ANA\n---\n\n"
        "## Problem Analysis\n\nsome\n\n"
        "## Solution\n\n"
        f"{solution_body}\n\n"
        "## Test Results\n\n"
    )


# ---------------------------------------------------------------------------
# (a) W17-162 元反例：4 項規劃 + spawned=[] → block
# ---------------------------------------------------------------------------

def test_w17_162_legacy_should_block(logger):
    solution = (
        "### Spawn 規劃\n\n"
        "| # | Type | Priority | 標題 | 範圍 | 代理人 |\n"
        "|---|------|----------|------|------|-------|\n"
        "| 1 | IMP | P1 | 修復 A | a.py | thyme |\n"
        "| 2 | IMP | P1 | 修復 B | b.py | thyme |\n"
        "| 3 | DOC | P2 | 文件 C | c.md | thyme |\n"
        "| 4 | DOC | P2 | 文件 D | d.md | thyme |\n"
    )
    content = _make_content(solution)
    fm = {"id": "0.18.0-W17-162", "type": "ANA", "spawned_tickets": [], "children": []}

    should_block, msg = check_ana_spawn_consistency(content, fm, logger)

    assert should_block is True
    assert msg is not None
    assert "0.18.0-W17-162" in msg
    assert "4" in msg


# ---------------------------------------------------------------------------
# (b) W17-167 自身元反例：3 項規劃 + spawned=[] → block
# ---------------------------------------------------------------------------

def test_w17_167_self_reference_should_block(logger):
    solution = (
        "### Spawned IMP/DOC 清單\n\n"
        "| # | Type | Priority | 標題 | 範圍 | 建議代理人 |\n"
        "|---|------|----------|------|------|-----------|\n"
        "| 1 | IMP | P1 | 實作 ana_spawn_consistency_checker | hook | thyme |\n"
        "| 2 | DOC | P2 | 規則升級 | rules | thyme |\n"
        "| 3 | DOC | P2 | PM checklist | pm-rules | thyme |\n"
    )
    content = _make_content(solution)
    fm = {"id": "0.18.0-W17-167", "type": "ANA", "spawned_tickets": [], "children": []}

    should_block, msg = check_ana_spawn_consistency(content, fm, logger)

    assert should_block is True
    assert msg is not None
    assert "3" in msg


# ---------------------------------------------------------------------------
# (c) 豁免標記：含「無需建 ticket」→ 跳過
# ---------------------------------------------------------------------------

def test_exemption_marker_should_skip(logger):
    solution = (
        "本 ANA 結論：無需建 ticket：所有規劃項目已併入 W17-100。\n\n"
        "| # | Type | Priority | 標題 |\n"
        "|---|------|----------|------|\n"
        "| 1 | IMP | P1 | 範例 |\n"
    )
    content = _make_content(solution)
    fm = {"id": "0.18.0-W17-998", "type": "ANA", "spawned_tickets": [], "children": []}

    should_block, msg = check_ana_spawn_consistency(content, fm, logger)

    assert should_block is False
    assert msg is None


def test_exemption_no_spawn_marker_should_skip(logger):
    solution = (
        "結論：不 spawn，本 ANA 為純文件梳理。\n\n"
        "| # | Type | Priority | 標題 |\n"
        "|---|------|----------|------|\n"
        "| 1 | DOC | P2 | 範例 |\n"
    )
    content = _make_content(solution)
    fm = {"id": "0.18.0-W17-997", "type": "ANA", "spawned_tickets": [], "children": []}

    should_block, msg = check_ana_spawn_consistency(content, fm, logger)

    assert should_block is False
    assert msg is None


# ---------------------------------------------------------------------------
# (d) 部分漏建：N=3, S+C=2 → warning 不阻擋
# ---------------------------------------------------------------------------

def test_partial_spawn_should_warn_not_block(logger):
    solution = (
        "| # | Type | Priority | 標題 |\n"
        "|---|------|----------|------|\n"
        "| 1 | IMP | P1 | A |\n"
        "| 2 | IMP | P1 | B |\n"
        "| 3 | DOC | P2 | C |\n"
    )
    content = _make_content(solution)
    fm = {
        "id": "0.18.0-W17-996",
        "type": "ANA",
        "spawned_tickets": ["0.18.0-W17-901", "0.18.0-W17-902"],
        "children": [],
    }

    should_block, msg = check_ana_spawn_consistency(content, fm, logger)

    assert should_block is False
    assert msg is not None
    assert "WARNING" in msg or "warning" in msg.lower()
    assert "3" in msg
    assert "2" in msg


# ---------------------------------------------------------------------------
# (e) 全建：N=3, S+C=3 → 通過
# ---------------------------------------------------------------------------

def test_full_spawn_should_pass(logger):
    solution = (
        "| # | Type | Priority | 標題 |\n"
        "|---|------|----------|------|\n"
        "| 1 | IMP | P1 | A |\n"
        "| 2 | DOC | P2 | B |\n"
        "| 3 | DOC | P2 | C |\n"
    )
    content = _make_content(solution)
    fm = {
        "id": "0.18.0-W17-995",
        "type": "ANA",
        "spawned_tickets": ["0.18.0-W17-901", "0.18.0-W17-902", "0.18.0-W17-903"],
        "children": [],
    }

    should_block, msg = check_ana_spawn_consistency(content, fm, logger)

    assert should_block is False
    assert msg is None


def test_children_count_as_spawn(logger):
    """children 也計入 S+C（PC-091 路線：ANA 落地統一用 --parent）。"""
    solution = (
        "| # | Type | Priority | 標題 |\n"
        "|---|------|----------|------|\n"
        "| 1 | IMP | P1 | A |\n"
        "| 2 | IMP | P1 | B |\n"
    )
    content = _make_content(solution)
    fm = {
        "id": "0.18.0-W17-994",
        "type": "ANA",
        "spawned_tickets": [],
        "children": ["0.18.0-W17-994.1", "0.18.0-W17-994.2"],
    }

    should_block, msg = check_ana_spawn_consistency(content, fm, logger)

    assert should_block is False
    assert msg is None


# ---------------------------------------------------------------------------
# (f) 無 spawn 表格行 → 通過
# ---------------------------------------------------------------------------

def test_no_spawn_table_should_pass(logger):
    solution = "純文字結論，無 spawn 規劃表格。"
    content = _make_content(solution)
    fm = {"id": "0.18.0-W17-993", "type": "ANA", "spawned_tickets": [], "children": []}

    should_block, msg = check_ana_spawn_consistency(content, fm, logger)

    assert should_block is False
    assert msg is None


# ---------------------------------------------------------------------------
# (g) 非 ANA ticket → 跳過
# ---------------------------------------------------------------------------

def test_non_ana_should_skip(logger):
    solution = (
        "| # | Type | Priority | 標題 |\n"
        "|---|------|----------|------|\n"
        "| 1 | IMP | P1 | A |\n"
    )
    content = _make_content(solution).replace("type: ANA", "type: IMP")
    fm = {"id": "0.18.0-W17-992", "type": "IMP", "spawned_tickets": [], "children": []}

    should_block, msg = check_ana_spawn_consistency(content, fm, logger)

    assert should_block is False
    assert msg is None


# ---------------------------------------------------------------------------
# (h) Solution 為空 → 跳過
# ---------------------------------------------------------------------------

def test_empty_solution_should_skip(logger):
    content = (
        "---\nid: 0.18.0-W17-991\ntype: ANA\n---\n\n"
        "## Problem Analysis\n\nsome\n\n"
        "## Solution\n\n<!-- placeholder -->\n\n"
        "## Test Results\n\n"
    )
    fm = {"id": "0.18.0-W17-991", "type": "ANA", "spawned_tickets": [], "children": []}

    should_block, msg = check_ana_spawn_consistency(content, fm, logger)

    assert should_block is False
    assert msg is None
