#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""
Agent Dispatch Validation Hook - PreToolUse Hook

功能：強制實作代理人使用 isolation: "worktree" 派發，並對 .claude/ 專屬 prompt
豁免 worktree 要求（ARCH-015：worktree subagent 無法 Edit .claude/）。

Hook 類型：PreToolUse
匹配工具：Agent
退出碼：0 = 放行，2 = 阻擋（stderr 回饋給 Claude）

派發位置決策（對應 ARCH-015 + .claude/pm-rules/worktree-operations.md）：

| Prompt 路徑分類 | Hook 行為 | 派發位置 |
|---------------|----------|---------|
| 僅 .claude/ | 放行（豁免 worktree） | 主 repo cwd |
| 僅非 .claude/（src/、tests/、docs/） | 強制 worktree | worktree |
| 跨 .claude/ 與非 .claude/ | 阻擋並要求拆分 | - |
"""

import json
import re
import sys
from typing import Tuple

from hook_utils import setup_hook_logging, run_hook_safely, read_json_from_stdin

# 需要 worktree 隔離的實作代理人
IMPLEMENTATION_AGENTS = frozenset({
    "parsley-flutter-developer",
    "fennel-go-developer",
    "thyme-python-developer",
    "cinnamon-refactor-owl",
    "pepper-test-implementer",
    "mint-format-specialist",
})

# 偵測 prompt 中 .claude/ 路徑提及
_CLAUDE_PATH_PATTERN = re.compile(r"\.claude/")

# 偵測 prompt 中非 .claude/ 的實作目標路徑（Edit/Write 上下文或檔案列表）
# 策略：匹配常見專案路徑開頭（避免誤判 `.claude/docs` 這類巢狀路徑為 docs/）
_NON_CLAUDE_PATH_PATTERN = re.compile(
    r"(?<![./\w])(?:src|tests?|lib|docs|app|assets|scripts|public|bin|cmd)/"
)


def _classify_prompt_paths(prompt: str) -> Tuple[bool, bool]:
    """分類 prompt 中的路徑提及。

    回傳：(has_claude_path, has_non_claude_path)

    策略：
    - has_claude_path：prompt 含 ".claude/" 子字串
    - has_non_claude_path：prompt 含常見專案路徑（src/、tests/、lib/、docs/...）
      且該路徑不是 .claude/ 的巢狀路徑（用 lookbehind 排除 `.claude/docs/`）
    """
    if not prompt:
        return False, False
    has_claude = bool(_CLAUDE_PATH_PATTERN.search(prompt))
    has_other = bool(_NON_CLAUDE_PATH_PATTERN.search(prompt))
    return has_claude, has_other


BLOCK_MESSAGE_TEMPLATE = """錯誤：實作代理人 {agent} 必須使用 isolation: "worktree" 派發

為什麼阻止：
  實作代理人會修改檔案和執行 git 操作，在主倉庫工作會污染 .git/HEAD。
  使用 worktree 隔離可從物理上防止分支切換影響主線程。

修復方式：
  在 Agent 呼叫中加入 isolation: "worktree" 參數

詳見: .claude/pm-rules/parallel-dispatch.md（Worktree 隔離章節）"""

CROSS_PATH_BLOCK_MESSAGE = """錯誤：實作代理人 {agent} 的 prompt 同時涉及 .claude/ 與非 .claude/ 路徑

為什麼阻止：
  ARCH-015：worktree subagent 被 CC runtime hardcoded 拒絕 Edit .claude/ 路徑。
  若在主 repo cwd 派發則失去 worktree 隔離（.git/HEAD 污染風險）。
  跨路徑 prompt 無法同時滿足兩個約束。

修復方式：
  拆分為兩次派發：
    1. .claude/ 修改 → 主 repo cwd 派發（不加 isolation 參數）
    2. 非 .claude/ 修改 → worktree 派發（isolation: "worktree"）

詳見: .claude/pm-rules/worktree-operations.md（.claude/ 路徑限制章節）
      .claude/error-patterns/architecture/ARCH-015-*.md"""


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

    # Claude Code PreToolUse hook 的 tool_input 可能以 JSON 字串或 dict 傳入，
    # 取決於 Claude Code 版本。雙型別處理確保兩種情況都能正確解析。
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

    # 實作代理人：檢查 isolation 參數
    isolation = tool_input.get("isolation", "")
    if isolation == "worktree":
        logger.info("通過：%s 使用 worktree 隔離", subagent_type)
        return 0

    # 缺少 worktree：先判斷 prompt 路徑分類（ARCH-015 豁免）
    prompt = tool_input.get("prompt", "") or ""
    has_claude, has_other = _classify_prompt_paths(prompt)

    if has_claude and not has_other:
        # 僅 .claude/ 路徑：ARCH-015 豁免 worktree 要求（subagent 無法 Edit worktree 內 .claude/）
        logger.info(
            "放行：%s 僅修改 .claude/（ARCH-015 豁免 worktree）", subagent_type
        )
        return 0

    if has_claude and has_other:
        # 跨路徑：無法同時滿足 Hook 與 ARCH-015，要求拆分
        message = CROSS_PATH_BLOCK_MESSAGE.format(agent=subagent_type)
        print(message, file=sys.stderr)
        logger.warning(
            "阻擋：%s prompt 跨 .claude/ 與非 .claude/ 路徑（需拆分派發）",
            subagent_type,
        )
        return 2

    # 僅非 .claude/ 路徑或無路徑提及：維持原強制 worktree 邏輯
    message = BLOCK_MESSAGE_TEMPLATE.format(agent=subagent_type)
    print(message, file=sys.stderr)
    logger.warning("阻擋：%s 未使用 worktree（isolation=%s）", subagent_type, isolation or "(none)")
    return 2


if __name__ == "__main__":
    sys.exit(run_hook_safely(main, "agent-dispatch-validation"))
