"""
Agent Dispatch Validation Hook - target-based 路徑分類測試（ARCH-015 2026-04-18 修正版）

對應 Ticket 0.18.0-W5-047.5 AC：
- _classify_prompt_paths 回傳三元 (has_main_repo_claude, has_external_claude, has_other)
- 決策邏輯優先順序：
  (1) has_external_claude=True → 阻擋（外部 .claude/ runtime 必拒）
  (2) has_other=True 且 isolation != worktree → 阻擋（強制 worktree 防 .git/HEAD 污染）
  (3) 其他 → 放行

取代 W10-042 舊設計（.claude/ 跨路徑一律阻擋）。
新的 W5-050 實證：主 repo .claude/ + 非 .claude/ + worktree 可合法派發。
"""

import json
import sys
import importlib.util
import io
from pathlib import Path

import pytest


# 動態載入 hook module（檔名含連字號，無法直接 import）
_HOOKS_DIR = Path(__file__).parent.parent
if str(_HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(_HOOKS_DIR))

_spec = importlib.util.spec_from_file_location(
    "agent_dispatch_validation_hook",
    _HOOKS_DIR / "agent-dispatch-validation-hook.py",
)
_hook = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_hook)

_classify_prompt_paths = _hook._classify_prompt_paths
main = _hook.main


# 專案根目錄（測試 fixtures 用來構造「主 repo 內絕對路徑」）
_PROJECT_ROOT = _HOOKS_DIR.parent.parent  # .claude/hooks -> .claude -> root


# ----------------------------------------------------------------------------
# 單元測試：_classify_prompt_paths 三元分類邏輯
# ----------------------------------------------------------------------------

def test_classify_empty_prompt_returns_no_paths():
    """空 prompt 應回傳 (False, False, False)。"""
    assert _classify_prompt_paths("") == (False, False, False)


def test_classify_only_relative_claude_path_counts_as_main_repo():
    """相對路徑 .claude/ 預設視為主 repo 內（符合 PM 派發主流慣例）。"""
    prompt = "修改 .claude/hooks/agent-dispatch-validation-hook.py 加入路徑檢測"
    main_repo, external, other = _classify_prompt_paths(prompt)
    assert main_repo is True
    assert external is False
    assert other is False


def test_classify_absolute_path_in_main_repo_is_main_claude():
    """絕對路徑 .claude/ 落在主 repo 樹內 → has_main_repo_claude。"""
    prompt = f"修改 {_PROJECT_ROOT}/.claude/hooks/foo.py"
    main_repo, external, other = _classify_prompt_paths(prompt)
    assert main_repo is True
    assert external is False


def test_classify_absolute_path_external_is_external_claude():
    """絕對路徑 .claude/ 不在主 repo 樹內 → has_external_claude。"""
    prompt = "修改 /tmp/other-repo/.claude/hooks/foo.py"
    main_repo, external, other = _classify_prompt_paths(prompt)
    assert external is True
    assert main_repo is False


def test_classify_tmp_worktree_claude_is_external():
    """/tmp/ 下的 worktree 內 .claude/ → has_external_claude。"""
    prompt = "在 /tmp/worktree-xyz/.claude/hooks/bar.py 加入邏輯"
    main_repo, external, other = _classify_prompt_paths(prompt)
    assert external is True
    assert main_repo is False


def test_classify_only_non_claude_path_src():
    """僅提及 src/ 的 prompt 應分類為 other=True。"""
    prompt = "在 src/components/BookCard.js 實作新 Widget"
    main_repo, external, other = _classify_prompt_paths(prompt)
    assert main_repo is False
    assert external is False
    assert other is True


@pytest.mark.parametrize(
    "path_sample",
    # docs/ 不在偵測清單內（read-only context，見 hook 註解）
    ["src/main.dart", "tests/unit/foo_test.dart", "test/foo_test.go",
     "lib/services/x.dart", "app/main.py",
     "assets/icons/", "scripts/build.sh", "public/index.html",
     "bin/cli.go", "cmd/server/main.go"],
)
def test_classify_common_project_paths_detected_as_other(path_sample):
    """常見專案路徑開頭應被偵測為 other=True。"""
    prompt = f"Edit {path_sample} 實作功能"
    main_repo, external, other = _classify_prompt_paths(prompt)
    assert main_repo is False
    assert external is False
    assert other is True


def test_classify_cross_paths_main_repo_claude_and_other():
    """同時提及相對 .claude/ 與 src/ → (True, False, True)。"""
    prompt = (
        "修改 .claude/hooks/foo.py 並更新 src/widgets/bar.dart 對應邏輯"
    )
    main_repo, external, other = _classify_prompt_paths(prompt)
    assert main_repo is True
    assert external is False
    assert other is True


def test_classify_nested_claude_docs_not_counted_as_other():
    """.claude/references/docs-guide.md 不應被誤判為 docs/ 路徑。"""
    prompt = "更新 .claude/references/docs-guide.md 和 .claude/docs/README.md"
    main_repo, external, other = _classify_prompt_paths(prompt)
    assert main_repo is True
    assert other is False, "巢狀於 .claude/ 下的 docs/ 不應觸發 other 分類"


def test_classify_no_paths_at_all():
    """完全無路徑的 prompt 應回傳 (False, False, False)。"""
    prompt = "請分析系統架構並提供改進建議"
    assert _classify_prompt_paths(prompt) == (False, False, False)


# ----------------------------------------------------------------------------
# 整合測試：main() Hook 入口點
# ----------------------------------------------------------------------------

def _run_hook(monkeypatch, capsys, tool_input: dict) -> int:
    """以 monkeypatch 模擬 stdin 輸入並執行 main()。

    回傳：exit code（0=放行, 2=阻擋）
    """
    payload = {"tool_name": "Agent", "tool_input": tool_input}
    stdin_buffer = io.StringIO(json.dumps(payload))
    monkeypatch.setattr(sys, "stdin", stdin_buffer)
    return main()


def test_hook_allows_non_implementation_agent(monkeypatch, capsys):
    """非實作代理人（如 Explore）一律放行，不受 worktree 強制約束。"""
    exit_code = _run_hook(
        monkeypatch,
        capsys,
        tool_input={"subagent_type": "Explore", "prompt": "search for pattern"},
    )
    assert exit_code == 0


def test_hook_allows_worktree_isolation(monkeypatch, capsys):
    """實作代理人使用 worktree isolation 時放行。"""
    exit_code = _run_hook(
        monkeypatch,
        capsys,
        tool_input={
            "subagent_type": "thyme-python-developer",
            "isolation": "worktree",
            "prompt": "edit src/foo.py",
        },
    )
    assert exit_code == 0


def test_hook_allows_claude_only_prompt_without_worktree(monkeypatch, capsys):
    """主 repo .claude/ 僅有 prompt，無 worktree 時放行（ARCH-015 豁免）。"""
    exit_code = _run_hook(
        monkeypatch,
        capsys,
        tool_input={
            "subagent_type": "thyme-python-developer",
            "prompt": "修改 .claude/hooks/foo.py 加入新檢查邏輯",
        },
    )
    assert exit_code == 0, "僅主 repo .claude/ 的 prompt 應放行"


def test_hook_blocks_non_claude_prompt_without_worktree(monkeypatch, capsys):
    """僅非 .claude/ 路徑且無 worktree 時，原強制邏輯阻擋。"""
    exit_code = _run_hook(
        monkeypatch,
        capsys,
        tool_input={
            "subagent_type": "parsley-flutter-developer",
            "prompt": "實作 src/widgets/book_card.dart 並寫 tests/unit/book_card_test.dart",
        },
    )
    assert exit_code == 2
    err = capsys.readouterr().err
    assert "必須使用 isolation" in err, "應使用原 BLOCK_MESSAGE_TEMPLATE"


def test_hook_allows_cross_path_with_worktree_when_claude_in_main_repo(monkeypatch, capsys):
    """W5-050 新發現：主 repo .claude/ + 非 .claude/ + worktree 合法派發。

    取代舊 W10-042 的 CROSS_PATH_BLOCK。worktree subagent 可 Edit 主 repo 內 .claude/。
    """
    exit_code = _run_hook(
        monkeypatch,
        capsys,
        tool_input={
            "subagent_type": "thyme-python-developer",
            "isolation": "worktree",
            "prompt": "同時修改 .claude/hooks/foo.py 和 src/api/bar.py",
        },
    )
    assert exit_code == 0, "W5-050：主 repo .claude/ + src/ + worktree 應放行"


def test_hook_blocks_cross_path_without_worktree(monkeypatch, capsys):
    """主 repo .claude/ + 非 .claude/ 但無 worktree → 阻擋（強制 worktree）。"""
    exit_code = _run_hook(
        monkeypatch,
        capsys,
        tool_input={
            "subagent_type": "thyme-python-developer",
            "prompt": "同時修改 .claude/hooks/foo.py 和 src/api/bar.py",
        },
    )
    assert exit_code == 2
    err = capsys.readouterr().err
    assert "必須使用 isolation" in err


def test_hook_blocks_external_claude_path_absolute(monkeypatch, capsys):
    """絕對路徑指向外部 .claude/（/tmp/ 等）→ 阻擋（runtime 必拒）。"""
    exit_code = _run_hook(
        monkeypatch,
        capsys,
        tool_input={
            "subagent_type": "thyme-python-developer",
            "prompt": "修改 /tmp/other-repo/.claude/hooks/foo.py",
        },
    )
    assert exit_code == 2
    err = capsys.readouterr().err
    assert "外部 .claude/" in err or "external" in err.lower() or "ARCH-015" in err


def test_hook_blocks_external_claude_even_with_worktree(monkeypatch, capsys):
    """外部 .claude/ 即使宣告 worktree 也阻擋（runtime 仍會拒絕）。"""
    exit_code = _run_hook(
        monkeypatch,
        capsys,
        tool_input={
            "subagent_type": "thyme-python-developer",
            "isolation": "worktree",
            "prompt": "修改 /tmp/other-repo/.claude/hooks/foo.py",
        },
    )
    assert exit_code == 2
    err = capsys.readouterr().err
    assert "外部 .claude/" in err or "ARCH-015" in err


def test_hook_blocks_empty_prompt_without_worktree(monkeypatch, capsys):
    """空 prompt 且無 worktree：回退到原強制邏輯（無路徑資訊不應誤豁免）。"""
    exit_code = _run_hook(
        monkeypatch,
        capsys,
        tool_input={
            "subagent_type": "thyme-python-developer",
            "prompt": "",
        },
    )
    assert exit_code == 2
    err = capsys.readouterr().err
    assert "必須使用 isolation" in err


def test_hook_allows_no_subagent_type(monkeypatch, capsys):
    """缺少 subagent_type 時放行。"""
    exit_code = _run_hook(
        monkeypatch,
        capsys,
        tool_input={"prompt": "some prompt without agent"},
    )
    assert exit_code == 0


def test_hook_ignores_non_agent_tool(monkeypatch, capsys):
    """Hook 只對 Agent 工具生效。"""
    payload = {"tool_name": "Bash", "tool_input": {"command": "ls"}}
    stdin_buffer = io.StringIO(json.dumps(payload))
    monkeypatch.setattr(sys, "stdin", stdin_buffer)
    assert main() == 0
