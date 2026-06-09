"""error-pattern flat 號 negative gate hook 測試（1.0.0-W1-021）。

hook 自包含於 .claude/skills/error-pattern/hooks/error-pattern-flat-gate-hook.py；
測試暫借 hooks pytest env 執行（與 test_error_pattern_allocator.py 同慣例，
skill 完整 package 化屬 W1-001 上架範圍）。

驗證 decide() 純函式四分支 + 輔助判定：
- deny: 新建 flat 號（<CAT>-NNN）error-pattern 檔
- allow: 前綴號（<CAT>-<PROJ>-NNN）新建 / 既有 flat 檔編輯 / 非 error-patterns / 非 Write|Edit
"""

import importlib.util
from pathlib import Path

import pytest

_HOOK_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "skills"
    / "error-pattern"
    / "hooks"
    / "error-pattern-flat-gate-hook.py"
)


def _load_hook():
    """以 importlib 載入含 '-' 的 hook 檔（無法直接 import）。

    載入時 hook 頂層自設 sys.path 指向 .claude/hooks/ 取得 hook_utils 與 lib.pattern_id。
    """
    spec = importlib.util.spec_from_file_location(
        "error_pattern_flat_gate_hook", _HOOK_PATH
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


hook = _load_hook()


# --- is_flat_id：flat（2 段）vs 前綴（3+ 段） ---
@pytest.mark.parametrize(
    "pattern_id,expected",
    [
        ("PC-099", True),
        ("IMP-049", True),
        ("ARCH-020", True),
        ("PC-V1-001", False),
        ("PC-C2C-001", False),
        ("IMP-APP-012", False),
        (None, False),
    ],
)
def test_is_flat_id(pattern_id, expected):
    assert hook.is_flat_id(pattern_id) is expected


# --- is_error_pattern_file：路徑 + 副檔名 filter ---
def test_is_error_pattern_file_md_in_dir():
    assert hook.is_error_pattern_file(
        ".claude/error-patterns/process-compliance/PC-099-x.md"
    )


def test_is_error_pattern_file_rejects_non_md():
    assert not hook.is_error_pattern_file(
        ".claude/error-patterns/_project-registry.yaml"
    )


def test_is_error_pattern_file_rejects_outside_dir():
    assert not hook.is_error_pattern_file("src/foo.md")


def test_is_error_pattern_file_rejects_empty():
    assert not hook.is_error_pattern_file("")


# --- decide：deny 分支（acceptance 0）---
def test_decide_deny_new_flat_pc(tmp_path):
    target = tmp_path / "error-patterns" / "process-compliance" / "PC-179-new.md"
    decision, reason, code = hook.decide("Write", {"file_path": str(target)})
    assert decision == "deny"
    assert code == hook.EXIT_BLOCK
    assert "PC-179" in reason
    assert "/error-pattern add" in reason  # 規則 4：引導正確路徑


def test_decide_deny_new_flat_imp(tmp_path):
    target = tmp_path / "error-patterns" / "implementation" / "IMP-099-x.md"
    decision, _, code = hook.decide("Write", {"file_path": str(target)})
    assert decision == "deny"
    assert code == hook.EXIT_BLOCK


# --- decide：allow 分支（acceptance 1）---
def test_decide_allow_new_prefix(tmp_path):
    target = tmp_path / "error-patterns" / "process-compliance" / "PC-V1-001-x.md"
    decision, _, code = hook.decide("Write", {"file_path": str(target)})
    assert decision == "allow"
    assert code == hook.EXIT_ALLOW


def test_decide_allow_edit_existing_flat(tmp_path):
    target_dir = tmp_path / "error-patterns" / "process-compliance"
    target_dir.mkdir(parents=True)
    target = target_dir / "PC-099-existing.md"
    target.write_text("x", encoding="utf-8")
    decision, _, code = hook.decide("Edit", {"file_path": str(target)})
    assert decision == "allow"
    assert code == hook.EXIT_ALLOW


def test_decide_allow_overwrite_existing_flat(tmp_path):
    # Write 覆蓋既有 flat 檔（非新建）→ allow
    target_dir = tmp_path / "error-patterns" / "process-compliance"
    target_dir.mkdir(parents=True)
    target = target_dir / "PC-001-existing.md"
    target.write_text("x", encoding="utf-8")
    decision, _, _ = hook.decide("Write", {"file_path": str(target)})
    assert decision == "allow"


def test_decide_allow_non_error_pattern_dir(tmp_path):
    target = tmp_path / "src" / "foo.md"
    decision, _, _ = hook.decide("Write", {"file_path": str(target)})
    assert decision == "allow"


def test_decide_allow_readme_no_id(tmp_path):
    target = tmp_path / "error-patterns" / "README.md"
    decision, _, _ = hook.decide("Write", {"file_path": str(target)})
    assert decision == "allow"


def test_decide_allow_non_write_tool():
    decision, _, code = hook.decide(
        "Read",
        {"file_path": ".claude/error-patterns/process-compliance/PC-179-x.md"},
    )
    assert decision == "allow"
    assert code == hook.EXIT_ALLOW


def test_decide_allow_empty_tool_input():
    decision, _, _ = hook.decide("Write", {})
    assert decision == "allow"
