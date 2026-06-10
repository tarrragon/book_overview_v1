"""pytest fixtures for ticket_system tests.

W11-015 (TD-F): 為 track_snapshot 測試提供 autouse fixture，避免真實掃描
`docs/work-logs/` 全目錄。背景：

- `track_snapshot._render_full_snapshot` / `_render_degraded_snapshot` 兩條路徑
  均無條件呼叫 `_scan_all_versions()`，掃描 169+ 版本目錄
- `_print_version_progress` / `_print_in_progress_tasks` / `_print_pending_summary`
  對每個版本呼叫 `list_tickets(version)`，每次重新 parse ticket md frontmatter
- baseline 量測：17 tests × ~46s/test = 779s 真實 I/O

Fixture 設計（最小 mock 原則）：

- mock `track_snapshot._scan_all_versions` → 回傳極小假版本清單（單一 version）
- mock `track_snapshot.list_tickets` → 回傳空清單（測試多數不關心版本進度內容）
- autouse=True：所有 ticket_system/tests 自動套用
- 個別測試若需要特定 ticket 內容，可在測試內 monkeypatch 覆寫

不 mock 範圍：
- checkpoint_state（既有 `_patch_checkpoint_state` helper 已處理）
- subprocess git branch（S8 測試需要原始 subprocess 行為）
"""

from __future__ import annotations

from pathlib import Path

import pytest


# ============================================================
# W3-044 — precondition fixtures
# ============================================================
#
# 為 body-op precondition 測試（append-log / set-acceptance / complete）提供
# 共享 fixture。fixture 直接 mutate ticket md（繞 claim CLI），避免 W1-054
# claim 持久化 bug 干擾 precondition 測試（隔離測試關注點）。


def _write_minimal_ticket_md(path: Path, ticket_id: str, status: str, **extra) -> None:
    """寫入最小可解析 ticket md（含 frontmatter + 基本章節）。"""
    fm_lines = [
        "---",
        f"id: {ticket_id}",
        "title: test ticket",
        "type: IMP",
        f"status: {status}",
        "assigned: true",
        "tdd_phase: phase3b",
        "children: []",
        "blockedBy: []",
        "spawned_tickets: []",
    ]
    acceptance = extra.get("acceptance", ["[ ] dummy acceptance item"])
    fm_lines.append("acceptance:")
    for item in acceptance:
        fm_lines.append(f"  - '{item}'")
    fm_lines.append("---")
    fm = "\n".join(fm_lines) + "\n\n"

    body = (
        "# Execution Log\n\n"
        "## Task Summary\n\n"
        "Test task.\n\n"
        "## Problem Analysis\n\n"
        "Test analysis.\n\n"
        "## Solution\n\n"
        "Test solution.\n\n"
        "## Test Results\n\n"
        "Test results.\n\n"
        "## Completion Info\n\n"
        "**Review Status**: pending\n"
    )
    path.write_text(fm + body, encoding="utf-8")


@pytest.fixture
def precondition_tmp_dir(tmp_path: Path) -> Path:
    """提供 precondition 測試的 ticket 暫存目錄。"""
    d = tmp_path / "tickets"
    d.mkdir()
    return d


@pytest.fixture
def precondition_hook_logs_dir(tmp_path: Path, monkeypatch) -> Path:
    """為 precondition 測試隔離 hook-logs 目錄。"""
    logs_dir = tmp_path / "hook-logs"
    monkeypatch.setenv("HOOK_LOGS_DIR", str(logs_dir))
    return logs_dir


@pytest.fixture
def tmp_ticket_factory(precondition_tmp_dir, precondition_hook_logs_dir, monkeypatch):
    """產生指定 status 的 tmp ticket md，回傳 ticket_id；自動 patch loader/saver。"""
    from ticket_system.commands import track_acceptance as ta_mod
    from ticket_system.commands import track_set_acceptance as tsa_mod
    from ticket_system.lib import ticket_loader as loader_mod
    from ticket_system.lib import ticket_ops as ops_mod

    def _fake_get_ticket_path(version: str, ticket_id: str) -> Path:
        return precondition_tmp_dir / f"{ticket_id}.md"

    def _fake_load_ticket(version: str, ticket_id: str):
        from ticket_system.lib.parser import parse_frontmatter

        path = precondition_tmp_dir / f"{ticket_id}.md"
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

    def _fake_load_and_validate_ticket(version: str, ticket_id: str):
        ticket = _fake_load_ticket(version, ticket_id)
        if ticket is None:
            return None, f"ticket not found: {ticket_id}"
        return ticket, None

    # Patch 各模組命名空間
    for mod in (loader_mod, ta_mod, tsa_mod):
        monkeypatch.setattr(mod, "get_ticket_path", _fake_get_ticket_path, raising=False)
        monkeypatch.setattr(mod, "load_ticket", _fake_load_ticket, raising=False)

    monkeypatch.setattr(
        ops_mod, "load_and_validate_ticket", _fake_load_and_validate_ticket, raising=False
    )
    monkeypatch.setattr(
        tsa_mod, "load_and_validate_ticket", _fake_load_and_validate_ticket, raising=False
    )

    def factory(status: str = "pending", ticket_id: str | None = None, **extra) -> str:
        tid = ticket_id or f"0.0.0-W0-{status.upper()}"
        path = precondition_tmp_dir / f"{tid}.md"
        _write_minimal_ticket_md(path, tid, status, **extra)
        return tid

    return factory


@pytest.fixture
def pending_ticket(tmp_ticket_factory) -> str:
    return tmp_ticket_factory(status="pending", ticket_id="0.0.0-W0-PENDING")


@pytest.fixture
def in_progress_ticket(tmp_ticket_factory) -> str:
    return tmp_ticket_factory(status="in_progress", ticket_id="0.0.0-W0-INPROG")


@pytest.fixture
def completed_ticket(tmp_ticket_factory) -> str:
    return tmp_ticket_factory(status="completed", ticket_id="0.0.0-W0-COMPLETED")


@pytest.fixture
def blocked_ticket(tmp_ticket_factory) -> str:
    return tmp_ticket_factory(status="blocked", ticket_id="0.0.0-W0-BLOCKED")


# ============================================================
# W1-050 — project root 預設隔離（autouse）
# ============================================================


@pytest.fixture(autouse=True)
def _isolate_project_root(tmp_path_factory, monkeypatch):
    """Autouse fixture: 將 CLAUDE_PROJECT_DIR 預設導向 tmp，避免 lock 污染真實 repo。

    Why（W1-050）：`paths.get_project_root()` 第一優先讀 CLAUDE_PROJECT_DIR，
    未設時 fallback 至 `git rev-parse --show-toplevel`，解析到真實 repo root。
    測試若呼叫 `file_lock(get_ticket_path(...))` 但未 patch 路徑解析，lock 檔
    會落在真實 `docs/work-logs/v0/.../tickets/`（W14-042 設計不刪 lock 檔，
    產生殘留如 dummy.md.lock / 0.18.0-W17-998.md.lock）。

    設計（提供 default，個別測試可 override，opt-out 機制）：
    - autouse 在每個 test 前注入 CLAUDE_PROJECT_DIR 指向獨立 tmp 目錄
    - 需要真實 repo 或測試 fallback 行為的測試（如 test_paths_get_project_root）
      已用 `patch.dict("os.environ", {}, clear=True)` 或顯式 setenv 覆蓋；
      後注入者勝出，不影響其既有斷言（自然 opt-out）
    - 預先建立 docs/work-logs 階層 + .claude/tickets，使路徑解析有合法落點
    """
    root = tmp_path_factory.mktemp("project-root-default")
    (root / "docs" / "work-logs").mkdir(parents=True, exist_ok=True)
    (root / ".claude" / "tickets").mkdir(parents=True, exist_ok=True)
    (root / "CLAUDE.md").write_text("# CLAUDE.md\n", encoding="utf-8")
    monkeypatch.setenv("CLAUDE_PROJECT_DIR", str(root))


@pytest.fixture
def real_repo_root(monkeypatch):
    """Opt-out fixture：將 CLAUDE_PROJECT_DIR 還原為真實 repo root。

    Why（W1-050）：少數測試刻意驗證真實 repo 下的版本自動偵測（version=None
    → 讀 docs/todolist.yaml / 掃 work-logs），autouse `_isolate_project_root`
    將 root 導向空 tmp 會使版本偵測先觸發 VERSION_NOT_DETECTED，遮蔽待測的
    後續錯誤路徑。這類測試走 early-exit 錯誤路徑（exit 1），不會抵達 file_lock，
    故在真實 repo root 執行無 lock 污染風險。

    使用：在依賴真實版本偵測的測試函式簽名加入 `real_repo_root` 參數。
    """
    import subprocess

    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True,
        )
        monkeypatch.setenv("CLAUDE_PROJECT_DIR", result.stdout.strip())
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        monkeypatch.delenv("CLAUDE_PROJECT_DIR", raising=False)


# ============================================================
# W9-008 — hook-logs 預設隔離（autouse）
# ============================================================


@pytest.fixture(autouse=True)
def _isolate_hook_logs_dir(tmp_path_factory, monkeypatch):
    """Autouse fixture: 將 HOOK_LOGS_DIR 預設導向 tmp，避免巢狀污染。

    Why（W9-008）：`precondition._resolve_hook_logs_dir()` 預設用 cwd-relative
    `.claude/hook-logs`。從 skill cwd（`.claude/skills/ticket/`）執行 pytest 且
    測試未自設 HOOK_LOGS_DIR 時，force-usage log 寫入
    `.claude/skills/ticket/.claude/hook-logs/`，造成 git untracked 巢狀污染，
    干擾 session-start 清點。

    設計（提供 default，個別測試可 override）：
    - autouse 在每個 test 前注入 HOOK_LOGS_DIR 指向獨立 tmp 目錄
    - 個別測試／fixture（如 precondition_hook_logs_dir、test_force_usage_logging）
      仍可 monkeypatch.setenv 覆蓋；後注入者勝出，不影響其既有斷言
    """
    logs_dir = tmp_path_factory.mktemp("hook-logs-default")
    monkeypatch.setenv("HOOK_LOGS_DIR", str(logs_dir))


# ============================================================
# 既有 autouse fixture（W11-015）
# ============================================================


@pytest.fixture(autouse=True)
def _mock_track_snapshot_filesystem_scan(monkeypatch):
    """Autouse fixture: 屏蔽 track_snapshot 對 docs/work-logs/ 真實掃描。

    W11-015：避免 _scan_all_versions + list_tickets 真實 I/O 拖慢測試。
    回傳穩定假版本清單 + 空 ticket 集合，覆蓋 _render_full_snapshot 與
    _render_degraded_snapshot 兩條路徑。
    """
    try:
        from ticket_system.commands import track_snapshot as mod
    except ImportError:
        # track_snapshot 模組不存在時跳過（不影響其他測試）
        return

    fake_versions = ["0.0.0-fixture"]

    def _fake_scan_all_versions():
        return list(fake_versions)

    def _fake_list_tickets(version):
        return []

    monkeypatch.setattr(mod, "_scan_all_versions", _fake_scan_all_versions, raising=False)
    monkeypatch.setattr(mod, "list_tickets", _fake_list_tickets, raising=False)
