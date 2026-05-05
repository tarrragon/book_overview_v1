#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
zhtw-mcp Availability Check Hook

Hook Event: SessionStart

Purpose:
    zhtw-mcp（sysprog21/zhtw-mcp）是繁體中文用語、教育部標準字、全形標點、
    跨境用語正規化檢查的 MCP server，作為 basil-writing-critic 文字審查的
    機械化補強。本 hook 為**軟性檢查**（永不阻擋 session），僅依當前狀態
    輸出對應提示：

    1. Binary 不存在        → stderr 輸出安裝命令
    2. Binary 存在但未註冊  → stderr 輸出 MCP 註冊命令
    3. 全 OK                → stdout 單行確認

Skip mechanism:
    建立 .claude/.zhtw-mcp-skip 檔案即可永久跳過此檢查（per-project opt-out）。
    用於用戶確認該專案不需要繁體中文檢查（例如英文專案）。

Why soft check:
    跨專案 framework sync 場景下，不是所有專案都需要 zhtw-mcp。硬性阻擋
    會在英文專案造成假警報。輸出到 stderr 確保訊息可見（quality-baseline 規則 4），
    不影響 session 啟動。

Exit codes:
    0 - Always (soft check, never blocks session)
"""

import platform
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from hook_utils import setup_hook_logging, run_hook_safely


HOOK_NAME = "zhtw-mcp-check"
SKIP_FLAG = Path(__file__).parent.parent / ".zhtw-mcp-skip"
INSTALL_URL = "https://github.com/sysprog21/zhtw-mcp"


def _check_binary():
    """Locate zhtw-mcp on PATH and grab version string.

    Returns:
        (path, version) tuple. path=None if not found.
    """
    path = shutil.which("zhtw-mcp")
    if not path:
        return None, None

    try:
        result = subprocess.run(
            ["zhtw-mcp", "--version"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            return path, result.stdout.strip().split("\n")[0]
        return path, "version unknown"
    except (subprocess.TimeoutExpired, OSError):
        return path, "version check failed"


def _check_mcp_registered():
    """Probe `claude mcp list` for zhtw-mcp registration.

    Returns:
        True  - registered
        False - not registered
        None  - probe failed (claude CLI missing or list errored)
    """
    if shutil.which("claude") is None:
        return None

    try:
        result = subprocess.run(
            ["claude", "mcp", "list"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=10,
        )
        if result.returncode != 0:
            return None
        return "zhtw-mcp" in result.stdout
    except (subprocess.TimeoutExpired, OSError):
        return None


def _install_hint():
    system = platform.system().lower()
    if system in ("darwin", "linux"):
        return (
            "  curl --proto '=https' --tlsv1.2 -LsSf \\\n"
            "    https://github.com/sysprog21/zhtw-mcp/releases/latest/download/zhtw-mcp-installer.sh \\\n"
            "    | sh"
        )
    if system == "windows":
        return (
            "  powershell -ExecutionPolicy Bypass -c \"irm \\\n"
            "    https://github.com/sysprog21/zhtw-mcp/releases/latest/download/zhtw-mcp-installer.ps1 \\\n"
            "    | iex\""
        )
    return f"  see {INSTALL_URL}"


def _register_hint():
    return (
        "  # 方式 A: claude CLI（推薦，會寫入 settings.local.json）\n"
        "  claude mcp add zhtw-mcp -- zhtw-mcp\n"
        "\n"
        "  # 方式 B: 手動編輯 .claude/settings.local.json\n"
        "  #   {\n"
        "  #     \"mcpServers\": {\n"
        "  #       \"zhtw-mcp\": { \"command\": \"zhtw-mcp\" }\n"
        "  #     }\n"
        "  #   }"
    )


def _skip_hint():
    return "  跳過此檢查（本專案不需繁中校對）: touch .claude/.zhtw-mcp-skip"


def _print_section(title, body):
    bar = "=" * 60
    print(f"{bar}\n{title}\n{bar}\n{body}\n{bar}", file=sys.stderr)


def main():
    logger = setup_hook_logging(HOOK_NAME)

    if SKIP_FLAG.exists():
        logger.info(f"Skip flag found at {SKIP_FLAG}")
        return 0

    binary_path, version = _check_binary()

    if not binary_path:
        body = (
            "用途: 1100+ 詞彙規則、教育部標準字、全形標點、跨境用語正規化\n"
            f"專案: {INSTALL_URL}\n"
            "\n"
            "建議安裝（軟性提示，不影響 session 啟動）:\n"
            f"{_install_hint()}\n"
            "\n"
            "安裝後註冊到 Claude Code MCP:\n"
            f"{_register_hint()}\n"
            "\n"
            f"{_skip_hint()}"
        )
        _print_section("[zhtw-mcp Check] 繁體中文檢查工具未安裝", body)
        logger.info("zhtw-mcp not installed")
        return 0

    registered = _check_mcp_registered()

    if registered is False:
        body = (
            f"Binary: {binary_path}\n"
            f"版本: {version}\n"
            "\n"
            "註冊命令:\n"
            f"{_register_hint()}\n"
            "\n"
            f"{_skip_hint()}"
        )
        _print_section("[zhtw-mcp Check] Binary 已安裝但未註冊到 MCP", body)
        logger.info(f"zhtw-mcp at {binary_path} not registered")
        return 0

    if registered is True:
        print(f"[zhtw-mcp Check] OK: {version} (registered)")
        logger.info(f"zhtw-mcp OK: {version}, registered")
    else:
        print(f"[zhtw-mcp Check] Binary OK: {version} (registration probe unavailable)")
        logger.info(f"zhtw-mcp binary OK: {version}, registration probe failed")

    return 0


if __name__ == "__main__":
    sys.exit(run_hook_safely(main, HOOK_NAME))
