"""Tests for sync-claude-push.py secret-leak protection (0.19.1-W1-019).

背景（W1-014 延伸評估缺陷 E）：
  sync-claude-push.py 步驟 2 以 `git status --porcelain .claude` 判定乾淨，
  但 gitignored 檔不顯示於 porcelain；copy_filtered 從磁碟（非 git）讀取，
  排除僅靠檔名黑名單。因此一個 gitignored 或 untracked 的機密檔（檔名不在
  黑名單內，例如 my-api-token.txt）會被 copy_filtered 納入並推上公開 repo。

interim 防護：push 前以 git 偵測 .claude 內 gitignored / untracked 且未被
黑名單排除的檔案，存在即 abort 並列出清單；正常乾淨 push 不受影響。

這些測試先紅（detect_secret_leak_risk 尚未實作），實作後轉綠。
"""
from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parent.parent / "sync-claude-push.py"
_spec = importlib.util.spec_from_file_location("sync_claude_push", _SCRIPT)
assert _spec and _spec.loader
sync_mod = importlib.util.module_from_spec(_spec)
sys.modules["sync_claude_push"] = sync_mod
_spec.loader.exec_module(sync_mod)  # type: ignore[union-attr]


def _git(args: list[str], cwd: Path) -> None:
    subprocess.run(["git", *args], cwd=str(cwd), check=True, capture_output=True)


def _init_repo_with_claude(root: Path) -> Path:
    """建立一個含 .claude/ 的 git repo，回傳 .claude 路徑。"""
    _git(["init"], root)
    _git(["config", "user.email", "t@example.com"], root)
    _git(["config", "user.name", "t"], root)
    claude = root / ".claude"
    claude.mkdir()
    (claude / "rules.md").write_text("# tracked rule\n", encoding="utf-8")
    _git(["add", ".claude/rules.md"], root)
    _git(["commit", "-m", "init"], root)
    return claude


# ---------- 乾淨情境：無風險 ----------

def test_no_risk_when_claude_clean(tmp_path: Path):
    root = tmp_path / "proj"
    root.mkdir()
    _init_repo_with_claude(root)

    risky = sync_mod.detect_secret_leak_risk(root)
    assert risky == []


# ---------- 機密外洩情境：gitignored 機密檔（核心重現） ----------

def test_gitignored_secret_detected(tmp_path: Path):
    root = tmp_path / "proj"
    root.mkdir()
    claude = _init_repo_with_claude(root)

    # gitignore 一個機密檔，檔名「不在」push 黑名單內（避免被 copy_filtered 過濾）
    (root / ".gitignore").write_text(".claude/my-api-token.txt\n", encoding="utf-8")
    (claude / "my-api-token.txt").write_text("SECRET=abc123\n", encoding="utf-8")
    _git(["add", ".gitignore"], root)
    _git(["commit", "-m", "add gitignore"], root)

    # git status --porcelain .claude 看不到此檔（這正是原瑕疵）
    porcelain = subprocess.run(
        ["git", "status", "--porcelain", ".claude"],
        cwd=str(root), capture_output=True, text=True,
    ).stdout
    assert "my-api-token.txt" not in porcelain

    # 但 copy_filtered 會從磁碟複製它（不在黑名單內）
    assert sync_mod.should_exclude(Path("my-api-token.txt")) is False

    # 防護函式必須偵測到此檔
    risky = sync_mod.detect_secret_leak_risk(root)
    assert any("my-api-token.txt" in r for r in risky)


# ---------- untracked 機密檔（尚未 git add）也須偵測 ----------

def test_untracked_secret_detected(tmp_path: Path):
    root = tmp_path / "proj"
    root.mkdir()
    claude = _init_repo_with_claude(root)

    (claude / "leaked-creds.conf").write_text("token=xyz\n", encoding="utf-8")
    # 未 git add，屬 untracked

    risky = sync_mod.detect_secret_leak_risk(root)
    assert any("leaked-creds.conf" in r for r in risky)


# ---------- 已被黑名單排除的 gitignored 檔不應誤報 ----------

def test_blacklisted_gitignored_not_reported(tmp_path: Path):
    root = tmp_path / "proj"
    root.mkdir()
    claude = _init_repo_with_claude(root)

    # .env 在黑名單內，copy_filtered 本就會過濾，故不應列為 leak risk
    (root / ".gitignore").write_text(".claude/.env\n", encoding="utf-8")
    (claude / ".env").write_text("KEY=v\n", encoding="utf-8")
    _git(["add", ".gitignore"], root)
    _git(["commit", "-m", "gi"], root)

    assert sync_mod.should_exclude(Path(".env")) is True
    risky = sync_mod.detect_secret_leak_risk(root)
    assert risky == []


# ---------- tracked 檔（正常 push 內容）不應列為風險 ----------

def test_tracked_files_not_reported(tmp_path: Path):
    root = tmp_path / "proj"
    root.mkdir()
    claude = _init_repo_with_claude(root)

    (claude / "extra.md").write_text("# more\n", encoding="utf-8")
    _git(["add", ".claude/extra.md"], root)
    _git(["commit", "-m", "add extra"], root)

    risky = sync_mod.detect_secret_leak_risk(root)
    assert risky == []
