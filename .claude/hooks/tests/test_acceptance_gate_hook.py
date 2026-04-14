"""
Acceptance Gate Hook - 父 Ticket complete 前置 block 檢查測試

對應 Ticket 0.18.0-W10-036.2 AC 5：
測試覆蓋四情境：
  (1) 父有子未完成 block
  (2) 父有子全完成 pass
  (3) 父無子 pass
  (4) 孫層未完成 block（遞迴檢查）

測試目標：驗證 `check_children_completed_from_frontmatter` 正確處理
父子遞迴檢查，並將「任一後代未 completed/closed」視為 block 條件。
"""

import sys
import logging
from pathlib import Path

import pytest

# 將 .claude/hooks 加入 sys.path，讓測試能 import acceptance_checkers
_hooks_dir = Path(__file__).parent.parent
if str(_hooks_dir) not in sys.path:
    sys.path.insert(0, str(_hooks_dir))

from hook_utils import parse_ticket_frontmatter
from acceptance_checkers.children_checker import (
    check_children_completed_from_frontmatter,
)


# ----------------------------------------------------------------------------
# 測試工具
# ----------------------------------------------------------------------------

def _write_ticket(
    project_dir: Path,
    ticket_id: str,
    status: str,
    children: list = None,
    title: str = None,
) -> Path:
    """建立一個最小可解析的 Ticket 檔案。

    Ticket 目錄結構遵循 find_ticket_file 的預期：
        docs/work-logs/v{version}/tickets/{ticket_id}.md

    ticket_id 格式：{major}.{minor}.{patch}-W{wave}-{seq}
    """
    version_part = ticket_id.split("-W")[0]  # e.g. "0.18.0"
    ticket_dir = project_dir / "docs" / "work-logs" / f"v{version_part}" / "tickets"
    ticket_dir.mkdir(parents=True, exist_ok=True)

    if children:
        # 使用 inline list 格式，因 parse_ticket_frontmatter 對列 0 `- item` 不會展開，
        # 但能保留 inline `[a, b]` 為原始字串，由 extract_children_from_frontmatter 解析。
        children_block = "children: [" + ", ".join(children) + "]"
    else:
        children_block = "children: []"

    content = f"""---
id: {ticket_id}
title: {title or ticket_id}
type: IMP
status: {status}
version: {version_part}
{children_block}
---

# Body

"""
    ticket_file = ticket_dir / f"{ticket_id}.md"
    ticket_file.write_text(content, encoding="utf-8")
    return ticket_file


@pytest.fixture
def logger():
    """靜音 logger，避免汙染測試輸出。"""
    log = logging.getLogger("test-acceptance-gate")
    log.addHandler(logging.NullHandler())
    log.setLevel(logging.CRITICAL)
    return log


@pytest.fixture
def project_dir(tmp_path):
    """以 tmp_path 作為專案根目錄。"""
    return tmp_path


# ----------------------------------------------------------------------------
# 情境 1：父有子未完成 → block (exit 2)
# ----------------------------------------------------------------------------

def test_parent_with_pending_child_should_block(project_dir, logger):
    """
    情境 1：父有子未完成（pending），必須 block。

    對應 AC 2：任一子 Ticket 非 completed/closed → exit 2 (block)
    """
    parent_file = _write_ticket(
        project_dir,
        "0.18.0-W10-900",
        status="in_progress",
        children=["0.18.0-W10-900.1"],
    )
    _write_ticket(project_dir, "0.18.0-W10-900.1", status="pending")

    frontmatter = parse_ticket_frontmatter(parent_file.read_text(encoding="utf-8"))
    should_block, error_msg = check_children_completed_from_frontmatter(
        parent_file, frontmatter, project_dir, "0.18.0-W10-900", logger
    )

    assert should_block is True, "父有 pending 子任務時必須 block"
    assert error_msg is not None
    assert "0.18.0-W10-900.1" in error_msg, "錯誤訊息必須列出未完成子 ID（AC 3）"


def test_parent_with_in_progress_child_should_block(project_dir, logger):
    """子狀態為 in_progress 也應 block。"""
    parent_file = _write_ticket(
        project_dir,
        "0.18.0-W10-901",
        status="in_progress",
        children=["0.18.0-W10-901.1"],
    )
    _write_ticket(project_dir, "0.18.0-W10-901.1", status="in_progress")

    frontmatter = parse_ticket_frontmatter(parent_file.read_text(encoding="utf-8"))
    should_block, error_msg = check_children_completed_from_frontmatter(
        parent_file, frontmatter, project_dir, "0.18.0-W10-901", logger
    )
    assert should_block is True
    assert "0.18.0-W10-901.1" in error_msg


# ----------------------------------------------------------------------------
# 情境 2：父有子全完成 → pass (exit 0)
# ----------------------------------------------------------------------------

def test_parent_with_all_completed_children_should_pass(project_dir, logger):
    """
    情境 2：父的所有子任務皆為 completed，必須 pass。
    """
    parent_file = _write_ticket(
        project_dir,
        "0.18.0-W10-902",
        status="in_progress",
        children=["0.18.0-W10-902.1", "0.18.0-W10-902.2"],
    )
    _write_ticket(project_dir, "0.18.0-W10-902.1", status="completed")
    _write_ticket(project_dir, "0.18.0-W10-902.2", status="completed")

    frontmatter = parse_ticket_frontmatter(parent_file.read_text(encoding="utf-8"))
    should_block, error_msg = check_children_completed_from_frontmatter(
        parent_file, frontmatter, project_dir, "0.18.0-W10-902", logger
    )

    assert should_block is False, "所有子任務 completed 時必須 pass"
    assert error_msg is None


def test_parent_with_closed_children_should_pass(project_dir, logger):
    """
    closed 狀態等同 completed，應視為終止狀態（AC 2 規格：completed/closed）。
    """
    parent_file = _write_ticket(
        project_dir,
        "0.18.0-W10-903",
        status="in_progress",
        children=["0.18.0-W10-903.1"],
    )
    _write_ticket(project_dir, "0.18.0-W10-903.1", status="closed")

    frontmatter = parse_ticket_frontmatter(parent_file.read_text(encoding="utf-8"))
    should_block, error_msg = check_children_completed_from_frontmatter(
        parent_file, frontmatter, project_dir, "0.18.0-W10-903", logger
    )

    assert should_block is False, "closed 應被視為終止狀態，不阻擋 complete"


# ----------------------------------------------------------------------------
# 情境 3：父無子任務 → pass (exit 0)
# ----------------------------------------------------------------------------

def test_parent_without_children_should_pass(project_dir, logger):
    """
    情境 3：父沒有任何子任務，必須 pass。
    """
    parent_file = _write_ticket(
        project_dir,
        "0.18.0-W10-904",
        status="in_progress",
        children=None,
    )

    frontmatter = parse_ticket_frontmatter(parent_file.read_text(encoding="utf-8"))
    should_block, error_msg = check_children_completed_from_frontmatter(
        parent_file, frontmatter, project_dir, "0.18.0-W10-904", logger
    )

    assert should_block is False
    assert error_msg is None


# ----------------------------------------------------------------------------
# 情境 4：孫層未完成 → block（遞迴檢查）
# ----------------------------------------------------------------------------

def test_grandchild_pending_should_block(project_dir, logger):
    """
    情境 4：子已 completed，但孫 pending，仍需 block（遞迴檢查，AC 1）。

    結構：
        parent (complete 嘗試中)
          └─ child.1 (completed)
                └─ grandchild.1.1 (pending)  ← 未完成的孫

    父責任是「分析問題被解決」，若孫層尚未落實，父的責任鏈未完成。
    """
    parent_file = _write_ticket(
        project_dir,
        "0.18.0-W10-905",
        status="in_progress",
        children=["0.18.0-W10-905.1"],
    )
    _write_ticket(
        project_dir,
        "0.18.0-W10-905.1",
        status="completed",
        children=["0.18.0-W10-905.1.1"],
    )
    _write_ticket(project_dir, "0.18.0-W10-905.1.1", status="pending")

    frontmatter = parse_ticket_frontmatter(parent_file.read_text(encoding="utf-8"))
    should_block, error_msg = check_children_completed_from_frontmatter(
        parent_file, frontmatter, project_dir, "0.18.0-W10-905", logger
    )

    assert should_block is True, "孫層未完成時父必須 block（遞迴檢查）"
    assert error_msg is not None
    assert "0.18.0-W10-905.1.1" in error_msg, "錯誤訊息必須指出實際未完成的後代 ID"


def test_grandchild_all_completed_should_pass(project_dir, logger):
    """
    子和孫全部 completed → pass（遞迴檢查正面案例）。
    """
    parent_file = _write_ticket(
        project_dir,
        "0.18.0-W10-906",
        status="in_progress",
        children=["0.18.0-W10-906.1"],
    )
    _write_ticket(
        project_dir,
        "0.18.0-W10-906.1",
        status="completed",
        children=["0.18.0-W10-906.1.1"],
    )
    _write_ticket(project_dir, "0.18.0-W10-906.1.1", status="completed")

    frontmatter = parse_ticket_frontmatter(parent_file.read_text(encoding="utf-8"))
    should_block, error_msg = check_children_completed_from_frontmatter(
        parent_file, frontmatter, project_dir, "0.18.0-W10-906", logger
    )

    assert should_block is False
    assert error_msg is None
