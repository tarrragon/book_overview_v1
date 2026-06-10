"""
Pytest 配置和共用 fixtures

提供測試中使用的固定資料和環境配置。
"""

import tempfile
from pathlib import Path
from typing import Dict, Any

import pytest
import yaml


@pytest.fixture(autouse=True)
def _isolate_project_root(tmp_path_factory, monkeypatch):
    """Autouse fixture: 將 CLAUDE_PROJECT_DIR 預設導向 tmp，避免 lock 污染真實 repo。

    Why（W1-050）：`paths.get_project_root()` 第一優先讀 CLAUDE_PROJECT_DIR，
    未設時 fallback 至 `git rev-parse --show-toplevel`，解析到真實 repo root。
    測試若呼叫 `file_lock(get_ticket_path(...))` 但未 patch 路徑解析，lock 檔
    會落在真實 `docs/work-logs/v0/.../tickets/`（W14-042 設計不刪 lock 檔，
    產生殘留如 dummy.md.lock / 0.31.0-W4-001.md.lock）。

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


@pytest.fixture(scope="session", autouse=True)
def _assert_no_repo_pollution():
    """防止測試污染真實 repo 的 docs/work-logs/ 目錄。

    來源：0.18.0-W5-031 WRAP 決策方案 D。
    原因：測試若漏 mock save_ticket 或 mock 錯 import 路徑（見 TEST-005），
    會寫入 repo 真實路徑 docs/work-logs/v0/v0.XX/，產生 untracked 檔案污染 repo。

    機制：pytest session 開始前快照 docs/work-logs/v0/ 內容，
    session 結束時比對，若有新增目錄則 raise AssertionError 強制失敗。

    注意：parents[4] 層級對應 tests/conftest.py → tests → ticket → skills
         → .claude → project root（即 book_overview_v1）。
    """
    project_root = Path(__file__).resolve().parents[4]
    target_dir = project_root / "docs" / "work-logs" / "v0"
    before = set(target_dir.iterdir()) if target_dir.exists() else set()
    yield
    after = set(target_dir.iterdir()) if target_dir.exists() else set()
    new_dirs = after - before
    if new_dirs:
        raise AssertionError(
            f"Test pollution detected: new directories in {target_dir}: "
            f"{sorted(str(d.relative_to(project_root)) for d in new_dirs)}. "
            f"Root cause: test likely missed patching save_ticket or used wrong "
            f"import path for patch. See TEST-005 error pattern."
        )


@pytest.fixture
def temp_project_dir() -> Path:
    """
    建立臨時專案目錄結構

    Returns:
        Path: 臨時專案根目錄
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        project_root = Path(tmpdir)

        # 建立目錄結構
        work_logs_dir = project_root / "docs" / "work-logs" / "v0" / "v0.31" / "v0.31.0" / "tickets"
        work_logs_dir.mkdir(parents=True, exist_ok=True)

        claude_tickets_dir = project_root / ".claude" / "tickets"
        claude_tickets_dir.mkdir(parents=True, exist_ok=True)

        # 建立 pubspec.yaml 標記為專案根目錄
        (project_root / "pubspec.yaml").touch()

        yield project_root


@pytest.fixture
def valid_ticket_data() -> Dict[str, Any]:
    """
    有效的 Ticket 資料範例

    Returns:
        Dict: Ticket 資料字典
    """
    return {
        "id": "0.31.0-W4-001",
        "title": "實作 Ticket 載入功能",
        "status": "pending",
        "what": "實作 Ticket 載入模組",
        "priority": "P0",
        "type": "IMP",
        "created": "2026-01-30",
    }


@pytest.fixture
def invalid_ticket_data() -> Dict[str, Any]:
    """
    無效的 Ticket 資料範例（缺少必填欄位）

    Returns:
        Dict: 不完整的 Ticket 資料字典
    """
    return {
        "id": "invalid-id",
        # 缺少 status 和 title
        "priority": "P0",
    }


@pytest.fixture
def valid_ticket_markdown(valid_ticket_data) -> str:
    """
    有效的 Markdown 格式 Ticket

    Returns:
        str: Markdown 內容
    """
    frontmatter_yaml = yaml.dump(
        valid_ticket_data,
        allow_unicode=True,
        default_flow_style=False,
        sort_keys=False,
    )
    body = """# 實作 Ticket 載入功能

## 目標
建立 Ticket 載入和解析模組，支援 Markdown 和 YAML 格式。

## 驗收條件
- [x] 支援 Markdown frontmatter 解析
- [x] 支援 YAML 格式載入
- [ ] 支援 Ticket 儲存
"""
    return f"---\n{frontmatter_yaml}---\n{body}"


@pytest.fixture
def valid_ticket_yaml(valid_ticket_data) -> str:
    """
    有效的 YAML 格式 Ticket

    Returns:
        str: YAML 內容
    """
    data = {"ticket": valid_ticket_data}
    return yaml.dump(data, allow_unicode=True, default_flow_style=False, sort_keys=False)


@pytest.fixture
def fixture_dir(temp_project_dir) -> Path:
    """
    建立 fixtures 測試資料目錄

    Returns:
        Path: fixtures 目錄路徑
    """
    fixtures_path = Path(__file__).parent / "fixtures"
    fixtures_path.mkdir(exist_ok=True)
    return fixtures_path


@pytest.fixture
def valid_ticket_fixture_file(fixture_dir, valid_ticket_markdown) -> Path:
    """
    建立有效 Ticket 的測試檔案

    Returns:
        Path: Ticket 檔案路徑
    """
    ticket_path = fixture_dir / "valid_ticket.md"
    ticket_path.write_text(valid_ticket_markdown, encoding="utf-8")
    return ticket_path


@pytest.fixture
def invalid_ticket_fixture_file(fixture_dir) -> Path:
    """
    建立無效 Ticket 的測試檔案

    Returns:
        Path: 無效 Ticket 檔案路徑
    """
    # 無效的 frontmatter（缺少必填欄位）
    invalid_content = """---
id: invalid-format
priority: P0
---

無效的 Ticket 內容
缺少必填欄位 status 和 title
"""
    ticket_path = fixture_dir / "invalid_ticket.md"
    ticket_path.write_text(invalid_content, encoding="utf-8")
    return ticket_path
