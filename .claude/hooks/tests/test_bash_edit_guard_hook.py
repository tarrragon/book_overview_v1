#!/usr/bin/env python3
"""
Bash Edit Guard Hook - 測試程式碼

涵蓋:
- 裸 cd 偵測各命中形式（行首 / && cd / ; cd / || cd）
- 各排除分支（子 shell (cd ...) / git -C / uv -d / 絕對路徑還原）
- 既有原地編輯偵測 regression（sed -i / perl -pi）
- 非 Bash 工具跳過
"""

import sys
from pathlib import Path

# 將 Hook 腳本路徑加入 sys.path
hook_dir = Path(__file__).parent.parent
sys.path.insert(0, str(hook_dir))

# 動態導入 Hook 模組（移除 .py 副檔名）
import importlib.util

spec = importlib.util.spec_from_file_location(
    "bash_edit_guard_hook_module",
    hook_dir / "bash-edit-guard-hook.py",
)
hook_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook_module)

_detect_bare_cd = hook_module._detect_bare_cd
_detect_bash_edit_patterns = hook_module._detect_bash_edit_patterns

import pytest


# ============================================================================
# 裸 cd 偵測：命中形式
# ============================================================================


class TestBareCdDetectionHits:
    """裸 cd 各命中形式應回傳 True。"""

    def test_leading_cd(self):
        """行首裸 cd 命中。"""
        assert _detect_bare_cd("cd .claude/skills/ticket") is True

    def test_leading_cd_with_chained_command(self):
        """行首裸 cd 後串接命令命中。"""
        assert _detect_bare_cd("cd .claude/skills && uv run pytest") is True

    def test_and_chained_cd(self):
        """&& cd 串接命中。"""
        assert _detect_bare_cd("git status && cd subdir") is True

    def test_semicolon_chained_cd(self):
        """; cd 串接命中。"""
        assert _detect_bare_cd("echo start; cd subdir") is True

    def test_or_chained_cd(self):
        """|| cd 串接命中。"""
        assert _detect_bare_cd("test -d x || cd fallback") is True

    def test_relative_path_cd(self):
        """相對路徑裸 cd 命中（非絕對路徑、非子 shell）。"""
        assert _detect_bare_cd("cd ../sibling && npm test") is True


# ============================================================================
# 裸 cd 偵測：排除分支
# ============================================================================


class TestBareCdDetectionExclusions:
    """各合法形式不應命中（回傳 False）。"""

    def test_subshell_cd(self):
        """子 shell (cd ...) 排除。"""
        assert _detect_bare_cd("(cd .claude/skills/ticket && uv run pytest)") is False

    def test_subshell_cd_with_space(self):
        """子 shell 含空白 ( cd ...) 排除。"""
        assert _detect_bare_cd("( cd subdir && ls )") is False

    def test_git_c_flag(self):
        """git -C <path> 不含 cd 指令，排除。"""
        assert _detect_bare_cd("git -C /Users/tarragon/repo status") is False

    def test_uv_d_flag(self):
        """uv -d <path> 不含 cd 指令，排除。"""
        assert _detect_bare_cd("uv -d .claude/skills/ticket run pytest") is False

    def test_absolute_path_restore(self):
        """絕對路徑還原 cd /<root> 排除（污染補救合法用途）。"""
        assert (
            _detect_bare_cd("cd /Users/tarragon/Projects/book_overview_v1 && git status")
            is False
        )

    def test_absolute_path_restore_chained(self):
        """&& cd /<abs> 絕對路徑還原排除。"""
        assert _detect_bare_cd("echo x && cd /abs/path && ls") is False

    def test_no_cd_command(self):
        """完全不含 cd 的命令排除。"""
        assert _detect_bare_cd("git status && npm test") is False

    def test_cdrom_word_not_matched(self):
        """含 cd 字面但非指令（cdrom）不命中。"""
        assert _detect_bare_cd("ls /mnt/cdrom") is False


# ============================================================================
# 既有原地編輯偵測 regression
# ============================================================================


class TestBashEditPatternsRegression:
    """確保既有 sed -i / perl -pi 偵測未被破壞。"""

    def test_sed_inplace_short(self):
        assert _detect_bash_edit_patterns("sed -i 's/a/b/' file.txt") is True

    def test_sed_inplace_long(self):
        assert _detect_bash_edit_patterns("sed --in-place 's/a/b/' file.txt") is True

    def test_perl_pi(self):
        assert _detect_bash_edit_patterns("perl -pi -e 's/a/b/' file.txt") is True

    def test_perl_i_bak(self):
        assert _detect_bash_edit_patterns("perl -i.bak -e 's/a/b/' file.txt") is True

    def test_normal_command_not_edit(self):
        assert _detect_bash_edit_patterns("cat file.txt") is False

    def test_bare_cd_not_edit_pattern(self):
        """裸 cd 不應被原地編輯偵測命中（兩偵測獨立）。"""
        assert _detect_bash_edit_patterns("cd subdir") is False


# ============================================================================
# main() 端到端行為（非 Bash 跳過、warn 不 deny）
# ============================================================================


class TestMainBehavior:
    """透過 stdin 驅動 main() 驗證輸出行為。"""

    def _run_main(self, monkeypatch, capsys, input_dict):
        import io
        import json

        monkeypatch.setattr(
            "sys.stdin", io.StringIO(json.dumps(input_dict))
        )
        exit_code = hook_module.main()
        captured = capsys.readouterr()
        return exit_code, captured.out

    def test_non_bash_tool_skipped(self, monkeypatch, capsys):
        """非 Bash 工具直接允許，無警告輸出。"""
        exit_code, out = self._run_main(
            monkeypatch, capsys, {"tool_name": "Edit", "tool_input": {}}
        )
        assert exit_code == 0
        assert out.strip() == "" or "BARE_CD" not in out

    def test_bare_cd_emits_allow_not_deny(self, monkeypatch, capsys):
        """裸 cd 命中 emit warn，permission_decision=allow（不 deny）。"""
        import json

        exit_code, out = self._run_main(
            monkeypatch,
            capsys,
            {
                "tool_name": "Bash",
                "tool_input": {"command": "cd subdir && npm test"},
            },
        )
        assert exit_code == 0
        assert out.strip() != ""
        payload = json.loads(out)
        decision = (
            payload.get("hookSpecificOutput", {}).get("permissionDecision")
        )
        assert decision == "allow"
        assert "git -C" in out

    def test_clean_command_no_warning(self, monkeypatch, capsys):
        """合法命令（git -C）無警告輸出。"""
        exit_code, out = self._run_main(
            monkeypatch,
            capsys,
            {
                "tool_name": "Bash",
                "tool_input": {"command": "git -C /abs status"},
            },
        )
        assert exit_code == 0
        assert out.strip() == ""


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
