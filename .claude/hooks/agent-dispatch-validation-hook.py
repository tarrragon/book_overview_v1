#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""
Agent Dispatch Validation Hook - PreToolUse Hook

功能：強制實作代理人使用 isolation: "worktree" 派發，並對主 repo .claude/ 路徑
提供 target-based 判斷（ARCH-015 2026-04-18 修正版）。

Hook 類型：PreToolUse
匹配工具：Agent
退出碼：0 = 放行，2 = 阻擋（stderr 回饋給 Claude）

派發位置決策（對應 ARCH-015 2026-04-18 W5-050 重驗版）：

| Prompt 路徑分類 | isolation=worktree | Hook 行為 |
|---------------|--------------------|----------|
| 僅主 repo .claude/ | 不要求 | 放行（豁免 worktree） |
| 主 repo .claude/ + 非 .claude/ | 要求 | 放行（W5-050 新發現） |
| 主 repo .claude/ + 非 .claude/ | 無 | 阻擋（強制 worktree） |
| 僅非 .claude/ | 要求 | 放行 |
| 僅非 .claude/ | 無 | 阻擋（強制 worktree） |
| 含外部 .claude/（/tmp/ 等） | 任何 | 阻擋（runtime 必拒） |
"""

import json
import re
import sys
from pathlib import Path
from typing import Tuple

from hook_utils import (
    setup_hook_logging,
    run_hook_safely,
    read_json_from_stdin,
    get_project_root,
)

# 需要 worktree 隔離的實作代理人
IMPLEMENTATION_AGENTS = frozenset({
    "parsley-flutter-developer",
    "fennel-go-developer",
    "thyme-python-developer",
    "cinnamon-refactor-owl",
    "pepper-test-implementer",
    "mint-format-specialist",
})

# 偵測 prompt 中相對路徑 .claude/ 提及（預設視為主 repo 內）
_RELATIVE_CLAUDE_PATTERN = re.compile(r"(?<![/\w])\.claude/")

# 偵測 prompt 中絕對路徑 .claude/（/xxx/.../.claude/）
# 用於區分主 repo 內外：比對匹配字串是否以主 repo root 為前綴
_ABSOLUTE_CLAUDE_PATTERN = re.compile(r"(/[^\s]+?)/\.claude/")

# 偵測 prompt 中非 .claude/ 的實作目標路徑
# 策略：匹配常見專案路徑開頭（避免誤判 `.claude/docs` 這類巢狀路徑為 docs/）
_NON_CLAUDE_PATH_PATTERN = re.compile(
    r"(?<![./\w])(?:src|tests?|lib|app|assets|scripts|public|bin|cmd)/"
)


def _classify_prompt_paths(prompt: str) -> Tuple[bool, bool, bool]:
    """分類 prompt 中的路徑提及。

    回傳：(has_main_repo_claude, has_external_claude, has_other)

    策略：
    - has_main_repo_claude：相對路徑 .claude/ 或絕對路徑 .claude/ 落在主 repo 樹內
    - has_external_claude：絕對路徑 .claude/ 不落在主 repo 樹內（例 /tmp/xxx/.claude/）
    - has_other：常見專案路徑（src/, tests/, lib/, app/...）

    設計決策：相對路徑 .claude/ 預設視為主 repo 內（符合 PM 派發主流慣例）。
    若實際在 worktree 下執行而失敗，由 CC runtime 直接回饋，非 Hook 層誤判。
    """
    if not prompt:
        return False, False, False

    # 偵測絕對路徑 .claude/ 並比對主 repo 前綴
    has_main_repo_claude = False
    has_external_claude = False

    try:
        project_root = get_project_root()
        project_root_str = str(project_root.resolve())
    except Exception:
        project_root_str = None

    for match in _ABSOLUTE_CLAUDE_PATTERN.finditer(prompt):
        # match.group(0) 形如 "/xxx/.../.claude/"
        abs_path = match.group(0)
        if project_root_str and abs_path.startswith(project_root_str + "/"):
            has_main_repo_claude = True
        else:
            has_external_claude = True

    # 偵測相對路徑 .claude/（需排除已被絕對路徑涵蓋者）
    # 簡化策略：找到任一相對路徑匹配（非絕對路徑前綴）即視為主 repo
    for match in _RELATIVE_CLAUDE_PATTERN.finditer(prompt):
        start = match.start()
        # 確認不是絕對路徑的一部分（前面不是 / 或 word char，已由 lookbehind 保證）
        # 相對路徑視為主 repo 內
        has_main_repo_claude = True
        break

    has_other = bool(_NON_CLAUDE_PATH_PATTERN.search(prompt))
    return has_main_repo_claude, has_external_claude, has_other


BLOCK_MESSAGE_TEMPLATE = """錯誤：實作代理人 {agent} 必須使用 isolation: "worktree" 派發

為什麼阻止：
  實作代理人會修改檔案和執行 git 操作，在主倉庫工作會污染 .git/HEAD。
  使用 worktree 隔離可從物理上防止分支切換影響主線程。

修復方式：
  在 Agent 呼叫中加入 isolation: "worktree" 參數

詳見: .claude/pm-rules/parallel-dispatch.md（Worktree 隔離章節）"""

EXTERNAL_CLAUDE_BLOCK_MESSAGE = """錯誤：實作代理人 {agent} 的 prompt 指向外部 .claude/ 路徑

為什麼阻止：
  ARCH-015（2026-04-18 重驗）：CC runtime 對外部 worktree 內 .claude/ Write/Edit
  硬編碼拒絕（如 /tmp/ 下的 worktree）。subagent 即使在對的 cwd 下也會被擋。
  主 repo 樹內的 .claude/ 可派發成功，但外部 .claude/ 無法。

修復方式：
  1. 若目標 .claude/ 檔案應在主 repo，改用相對路徑或主 repo 絕對路徑
  2. 若目標是外部 .claude/，改由 PM 前台處理，或搬檔到主 repo 再派發

詳見: .claude/error-patterns/architecture/ARCH-015-subagent-claude-dir-hardcoded-protection.md"""


def main() -> int:
    """Hook 主邏輯。"""
    logger = setup_hook_logging("agent-dispatch-validation")

    try:
        input_data = read_json_from_stdin(logger)
    except (json.JSONDecodeError, EOFError):
        logger.warning("無法解析 stdin JSON，放行")
        return 0

    if not input_data:
        return 0

    tool_name = input_data.get("tool_name", "")
    if tool_name != "Agent":
        return 0

    # Claude Code PreToolUse hook 的 tool_input 可能以 JSON 字串或 dict 傳入
    raw_input = input_data.get("tool_input") or "{}"
    if isinstance(raw_input, str):
        try:
            tool_input = json.loads(raw_input)
        except json.JSONDecodeError:
            logger.warning("tool_input JSON 解析失敗，放行")
            return 0
    else:
        tool_input = raw_input
    subagent_type = tool_input.get("subagent_type", "")

    # 無 subagent_type 或非實作代理人 → 放行
    if not subagent_type or subagent_type not in IMPLEMENTATION_AGENTS:
        logger.info("放行：subagent_type=%s", subagent_type or "(empty)")
        return 0

    # Target-based 分類
    prompt = tool_input.get("prompt", "") or ""
    has_main_repo_claude, has_external_claude, has_other = _classify_prompt_paths(prompt)

    # 優先順序判斷：

    # (1) 外部 .claude/ → 一律阻擋（runtime 必拒）
    if has_external_claude:
        message = EXTERNAL_CLAUDE_BLOCK_MESSAGE.format(agent=subagent_type)
        print(message, file=sys.stderr)
        logger.warning(
            "阻擋：%s prompt 含外部 .claude/ 路徑（runtime 必拒）",
            subagent_type,
        )
        return 2

    isolation = tool_input.get("isolation", "")

    # (2) 僅主 repo .claude/ 且無其他路徑 → 放行（ARCH-015 豁免 worktree）
    #     條件：has_main_repo_claude=True 且 has_other=False
    if has_main_repo_claude and not has_other:
        logger.info(
            "放行：%s 目標僅在主 repo .claude/（ARCH-015 豁免 worktree）",
            subagent_type,
        )
        return 0

    # (3) 已使用 worktree → 放行
    #     涵蓋：主 repo .claude/ + 非 .claude/ + worktree（W5-050 新發現）
    #           僅非 .claude/ + worktree
    if isolation == "worktree":
        logger.info("通過：%s 使用 worktree 隔離", subagent_type)
        return 0

    # (4) 其餘情況（has_other 無 worktree、空 prompt 無 worktree）→ 阻擋
    message = BLOCK_MESSAGE_TEMPLATE.format(agent=subagent_type)
    print(message, file=sys.stderr)
    logger.warning(
        "阻擋：%s 未使用 worktree（isolation=%s）",
        subagent_type, isolation or "(none)",
    )
    return 2


if __name__ == "__main__":
    sys.exit(run_hook_safely(main, "agent-dispatch-validation"))
