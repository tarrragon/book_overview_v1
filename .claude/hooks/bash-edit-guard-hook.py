#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""
Bash Edit Guard Hook - PreToolUse Hook

功能: 偵測 Bash 中的檔案編輯操作，建議使用 Edit 工具替代

觸發時機: 執行 Bash 工具時
檢測模式:
  - sed -i 或 sed --in-place (原地編輯)
  - sed 配合管道輸出到檔案
  - awk 輸出到檔案（>）
  - perl -pi (原地編輯)
  - 輸出重定向到程式碼檔案 (>.dart, >.arb, >.json)

行為: 輸出警告訊息到 stderr，允許命令繼續執行 (exit code 0)
"""

import json
import os
import sys
import re
from pathlib import Path

# 加入 hook_utils 路徑（相同目錄）
_hooks_dir = Path(__file__).parent
if _hooks_dir not in [p for p in sys.path if Path(p) == _hooks_dir]:
    sys.path.insert(0, str(_hooks_dir))

from hook_utils import setup_hook_logging, run_hook_safely, read_json_from_stdin, emit_hook_output
from lib.hook_messages import ValidationMessages, format_message


def _detect_bash_edit_patterns(command: str) -> bool:
    """
    檢測是否為高風險原地編輯操作（白名單降級版本）

    降級策略（W10-047.1）：
    原始 6 個 pattern 中保留 2 個高風險原地編輯模式（sed -i / perl -pi），
    移除 4 個噪音模式（輸出重定向 / awk 重定向 / 通用 > 檔案）。
    依據 W10-035.3 ANA：3d 觸發 1662 次 Action ~0%；
    保留的兩個 pattern 才是真正的原地編輯不可逆風險。

    保留模式:
    1. sed -i 或 sed --in-place（原地編輯，不可逆）
    2. perl -pi 或 perl -i.bak（原地編輯，不可逆）

    移除模式（觀察期 W10-047.3 起）:
    - sed/awk + > file 重定向（多為合法產出）
    - 通用命令 > 程式碼檔（多為合法產出，誤報率高）

    Args:
        command: Bash 命令

    Returns:
        bool - 是否偵測到高風險原地編輯模式
    """
    # 模式 1: sed -i 或 sed --in-place（原地編輯）
    if re.search(r'sed\s+(-i|--in-place)', command):
        return True

    # 模式 2: perl -pi 或 perl -i.bak（原地編輯）
    if re.search(r'perl\s+(-pi|-i\.bak)', command):
        return True

    return False


def _detect_bare_cd(command: str) -> bool:
    """
    偵測裸 cd（改變持久工作目錄的反模式）。

    本環境 zsh 有 chpwd hook，裸 cd 會觸發 ls 淹沒工具結果（IMP-056），
    是 confabulation 觸發鏈第 1 環。規則建議改用 git -C 或子 shell。

    命中模式:
    - 行首 cd（^cd）
    - 串接後 cd（&& cd、; cd）

    排除（不視為裸 cd）:
    - 子 shell 形式 (cd ...)：cd 緊接於未閉合的左括號後
    - git -C <path>：git 操作不換 cwd
    - uv -d <path>：uv 指定目錄
    - 還原至專案根 cd /<repo-root>：污染後補救的合法用途

    收窄修正（W1-026）:
    舊版排除所有絕對路徑 cd（target.startswith('/')），導致最常見違規
    cd /<repo-root>/subdir（絕對子目錄）被靜默放行，chpwd 淹沒照樣發生。
    現收窄為「target 正規化後恰等於專案根（CLAUDE_PROJECT_DIR）」才排除，
    絕對子目錄與其他絕對路徑 cd 恢復 warn。CLAUDE_PROJECT_DIR 未設時保守
    不排除（絕對子目錄仍 warn；repo-root 還原多一行提示可接受，warn 不 deny）。

    False-positive 務實邊界（限制）:
    PreToolUse 只見 raw command 字串，無完整 shell parse。
    heredoc／quoted 字串內的字面 cd 可能誤判。warn 不 deny，誤判成本低。

    Args:
        command: Bash 命令

    Returns:
        bool - 是否偵測到裸 cd（排除合法形式後）
    """
    # 專案根（用於排除「污染後還原至專案根」的合法 cd）
    # CLAUDE_PROJECT_DIR 未設時為 None，保守不排除任何絕對路徑
    project_root = os.environ.get('CLAUDE_PROJECT_DIR')
    if project_root:
        project_root = project_root.rstrip('/')

    # 找出所有 cd 出現點（行首、&& cd、; cd、( cd）
    # \bcd\b 後須接空白 + 引數，避免命中 cdrom 等字面
    for match in re.finditer(r'(^|&&|;|\|\||\()\s*\bcd\s+(\S+)', command):
        connector = match.group(1)
        target = match.group(2)

        # 排除 1: 子 shell 形式 (cd ...) — connector 為左括號
        if connector == '(':
            continue

        # 排除 2: 還原至專案根 cd /<repo-root> — 污染後補救的合法用途
        # 收窄：僅 target 正規化後恰等於專案根才排除；絕對子目錄恢復 warn
        if project_root and target.rstrip('/') == project_root:
            continue

        # 命中：裸 cd（行首或串接後，且非專案根還原、非子 shell）
        return True

    # 排除 3 & 4: git -C / uv -d 不含 cd 指令，天然不命中上方 finditer
    # （此處不需特別處理，因 git -C/uv -d 的 -C/-d 不是 cd 指令）
    return False


def _print_warning_message(command: str) -> None:
    """
    輸出警告訊息到 stderr

    Args:
        command: 檢測到的 Bash 命令
    """
    # 截短命令顯示（最多 100 字元）
    display_command = command[:100] + ('...' if len(command) > 100 else '')

    warning = format_message(
        ValidationMessages.BASH_EDIT_DETAILED_WARNING,
        command=display_command
    )
    return warning


def _bare_cd_warning_message(command: str) -> str:
    """
    產生裸 cd 警告訊息（走 ValidationMessages 常數）。

    Args:
        command: 偵測到裸 cd 的 Bash 命令

    Returns:
        str - 格式化後的提示訊息
    """
    display_command = command[:100] + ('...' if len(command) > 100 else '')
    return format_message(
        ValidationMessages.BARE_CD_WARNING,
        command=display_command
    )


def main() -> int:
    """主入口點"""
    logger = setup_hook_logging("bash-edit-guard")

    try:
        # 讀取 JSON 輸入
        input_data = read_json_from_stdin(logger)
        if input_data is None:
            return 0
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input") or {}

        # 檢查是否為 Bash 工具
        if tool_name != "Bash":
            # 非 Bash 工具：直接允許
            logger.info("跳過: 工具類型 %s 不是 Bash", tool_name)
            return 0

        # 取得命令內容
        command = tool_input.get("command", "")

        # 兩偵測獨立：原地編輯偵測 + 裸 cd 偵測，各自蒐集警告
        warnings = []

        if _detect_bash_edit_patterns(command):
            logger.info("警告: 偵測到編輯操作 - %s", command[:100])
            warnings.append(_print_warning_message(command))

        if _detect_bare_cd(command):
            logger.info("提示: 偵測到裸 cd - %s", command[:100])
            warnings.append(_bare_cd_warning_message(command))

        if not warnings:
            # 不符合任何偵測模式：直接允許
            logger.info("允許: 正常 Bash 命令")
            return 0

        # 合併警告為單一 JSON 輸出，permission_decision=allow（warn 不 deny）
        emit_hook_output(
            "PreToolUse",
            additional_context="\n\n".join(warnings),
            permission_decision="allow",
            permission_decision_reason="Bash 提示已發送，允許執行",
        )

        return 0

    except json.JSONDecodeError as e:
        logger.error("JSON 解析錯誤: %s", e)
        # JSON 解析失敗：直接允許執行，不阻塊
        return 0
    except Exception as e:
        logger.error("執行錯誤: %s", e)
        # 任何錯誤都不阻塊（非阻塞原則）
        return 0


if __name__ == "__main__":
    exit_code = run_hook_safely(main, "bash-edit-guard")
    sys.exit(exit_code)
