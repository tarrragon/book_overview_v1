"""
Agent Dispatch Validation Hook - 路徑分類與 .claude/ 豁免邏輯測試

對應 Ticket 0.18.0-W10-042 AC：
- _classify_prompt_paths 偵測 .claude/ 與非 .claude/ 路徑
- 三分類決策：
  (1) 僅 .claude/ → 放行（ARCH-015 豁免）
  (2) 僅非 .claude/ → 原強制 worktree（exit 2）
  (3) 跨路徑 → 阻擋並要求拆分（exit 2）

測試目標：驗證 Hook 能解除 W10-041 識別的衝突（Hook 強制 worktree vs
ARCH-015 禁用 worktree），同時保留對非 .claude/ 任務的 .git/HEAD 保護。
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


# ----------------------------------------------------------------------------
# 單元測試：_classify_prompt_paths 分類邏輯
# ----------------------------------------------------------------------------

def test_classify_empty_prompt_returns_no_paths():
    """空 prompt 應回傳 (False, False)。"""
    assert _classify_prompt_paths("") == (False, False)
    assert _classify_prompt_paths(None or "") == (False, False)


def test_classify_only_claude_path():
    """僅提及 .claude/ 路徑的 prompt 應分類為 has_claude=True, has_other=False。"""
    prompt = "修改 .claude/hooks/agent-dispatch-validation-hook.py 加入路徑檢測"
    has_claude, has_other = _classify_prompt_paths(prompt)
    assert has_claude is True
    assert has_other is False


def test_classify_only_non_claude_path_src():
    """僅提及 src/ 的 prompt 應分類為 has_claude=False, has_other=True。"""
    prompt = "在 src/components/BookCard.js 實作新 Widget"
    has_claude, has_other = _classify_prompt_paths(prompt)
    assert has_claude is False
    assert has_other is True


@pytest.mark.parametrize(
    "path_sample",
    ["src/main.dart", "tests/unit/foo_test.dart", "test/foo_test.go",
     "lib/services/x.dart", "docs/spec/foo.md", "app/main.py",
     "assets/icons/", "scripts/build.sh", "public/index.html",
     "bin/cli.go", "cmd/server/main.go"],
)
def test_classify_common_project_paths_detected_as_non_claude(path_sample):
    """常見專案路徑開頭應被偵測為 has_other=True。"""
    prompt = f"Edit {path_sample} 實作功能"
    has_claude, has_other = _classify_prompt_paths(prompt)
    assert has_claude is False
    assert has_other is True


def test_classify_cross_paths_both_detected():
    """同時提及 .claude/ 與 src/ 應兩者都 True（需要拆分）。"""
    prompt = (
        "修改 .claude/hooks/foo.py 並更新 src/widgets/bar.dart 對應邏輯"
    )
    has_claude, has_other = _classify_prompt_paths(prompt)
    assert has_claude is True
    assert has_other is True


def test_classify_nested_claude_docs_not_counted_as_other():
    """.claude/references/docs-guide.md 不應被誤判為 docs/ 路徑。

    lookbehind 排除 .claude/docs/ 這類巢狀路徑（只偵測頂層 docs/）。
    """
    prompt = "更新 .claude/references/docs-guide.md 和 .claude/docs/README.md"
    has_claude, has_other = _classify_prompt_paths(prompt)
    assert has_claude is True
    assert has_other is False, "巢狀於 .claude/ 下的 docs/ 不應觸發 non_claude 分類"


def test_classify_no_paths_at_all():
    """完全無路徑的 prompt 應回傳 (False, False)。"""
    prompt = "請分析系統架構並提供改進建議"
    has_claude, has_other = _classify_prompt_paths(prompt)
    assert has_claude is False
    assert has_other is False


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
    """ARCH-015 豁免：thyme 修改僅 .claude/ 路徑時，即使無 worktree 也放行。"""
    exit_code = _run_hook(
        monkeypatch,
        capsys,
        tool_input={
            "subagent_type": "thyme-python-developer",
            "prompt": "修改 .claude/hooks/foo.py 加入新檢查邏輯",
        },
    )
    assert exit_code == 0, "僅 .claude/ 的 prompt 應被 ARCH-015 豁免放行"


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


def test_hook_blocks_cross_path_prompt_with_guidance(monkeypatch, capsys):
    """跨路徑 prompt：阻擋並提供拆分指引。"""
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
    assert "拆分為兩次派發" in err, "應指引 PM 拆分派發"
    assert "ARCH-015" in err, "錯誤訊息應引用 ARCH-015 緣由"


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
    """缺少 subagent_type 時放行（非 Agent 工具或未指定代理人）。"""
    exit_code = _run_hook(
        monkeypatch,
        capsys,
        tool_input={"prompt": "some prompt without agent"},
    )
    assert exit_code == 0


def test_hook_ignores_non_agent_tool(monkeypatch, capsys):
    """Hook 只對 Agent 工具生效，其他工具（Bash/Edit 等）一律放行。"""
    payload = {"tool_name": "Bash", "tool_input": {"command": "ls"}}
    stdin_buffer = io.StringIO(json.dumps(payload))
    monkeypatch.setattr(sys, "stdin", stdin_buffer)
    assert main() == 0
