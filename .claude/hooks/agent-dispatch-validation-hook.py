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
from typing import Dict, List, Tuple

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

# W5-047.2: 廣域 staging 偵測（PC-092 防護）
# 匹配 `git add .` / `git add -A` / `git add --all`（允許額外空白）
# 排除 `git add --`（具體路徑引導符）、`git add src/x` 等精準路徑
_WIDE_STAGING_PATTERN = re.compile(
    r"\bgit\s+add\s+(?:\.(?=\s|$)|-A\b|--all\b)"
)


def _has_wide_staging(prompt: str) -> bool:
    """偵測 prompt 是否含廣域 git staging 指令（git add . / -A / --all）。"""
    if not prompt:
        return False
    return bool(_WIDE_STAGING_PATTERN.search(prompt))


def _count_active_dispatches() -> int:
    """讀取 .claude/dispatch-active.json 的 dispatches 條目數量。

    回傳：條目數；檔案不存在、解析失敗、格式異常皆回傳 0。
    """
    try:
        project_root = get_project_root()
    except Exception:
        return 0

    state_file = project_root / ".claude" / "dispatch-active.json"
    if not state_file.exists():
        return 0

    try:
        data = json.loads(state_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return 0

    dispatches = data.get("dispatches") if isinstance(data, dict) else None
    if not isinstance(dispatches, list):
        return 0
    return len(dispatches)


_WIDE_STAGING_WARNING = """[警告] 並行派發場景偵測到廣域 git staging（git add . / -A / --all）

為什麼警告：
  PC-092（並行代理人 git index 競爭）：並行派發時 `git add .` 會暫存所有未追蹤/已修改檔案，
  包含其他並行代理人尚未 commit 的產物，造成 commit 邊界混亂與 index.lock 競爭。

建議修正：
  改用精準路徑 staging，例如 `git add src/foo.py tests/test_foo.py`
  派發 prompt 應明示各代理人負責的具體檔案路徑。

詳見：.claude/error-patterns/process-compliance/PC-092-parallel-agents-git-index-race.md
      .claude/pm-rules/parallel-dispatch.md（派發 prompt 必含精準 git staging 章節）

本訊息為警告（非阻擋），派發將繼續進行。"""


def _emit_wide_staging_warning_if_parallel(prompt: str, logger) -> None:
    """並行場景 + 廣域 staging → stderr 印警告（非阻擋）。"""
    if not _has_wide_staging(prompt):
        return
    active = _count_active_dispatches()
    if active < 2:
        logger.debug(
            "廣域 staging 但單一派發場景（active=%d），不警告",
            active,
        )
        return
    print(_WIDE_STAGING_WARNING, file=sys.stderr)
    logger.info(
        "警告：並行場景（active=%d）偵測到廣域 staging（PC-092）",
        active,
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


# ============================================================================
# W5-045：Agent 禁止行為關鍵字衝突掃描
# ============================================================================
#
# 解析 agent .md 的「## 禁止行為」區塊，提取 `**禁止XX**` 標籤作為 prohibited
# actions；再以 FORBIDDEN_KEYWORD_MAP 把每條 prohibited action 映射為 prompt
# 偵測用 regex，對派發 prompt 進行子字串/regex 匹配。
#
# 策略（Warn vs Block）：初版一律 warn（exitcode 0 + stderr），累積 pattern
# 資料後再評估升級為 block。依賴 W5-043 標準化結構確保每個 agent 皆有此區塊。

# 定位 agent .md 中的 `## 禁止行為` 區塊（下一個 `## ` 為結尾，或 EOF）
_PROHIBITED_SECTION_PATTERN = re.compile(
    r"^## 禁止行為\s*$(.*?)(?=^## |\Z)",
    re.MULTILINE | re.DOTALL,
)

# 抽取 `**禁止XX**` 中的 XX 內容（避免跨行；capture group 取冒號前的標籤）
# 範例匹配："**禁止實作程式碼**"、"**禁止 git commit**"
_PROHIBITED_LABEL_PATTERN = re.compile(r"\*\*禁止([^\*\n]+?)\*\*")

# 關鍵字 → prompt 偵測 regex 清單映射。
# 初版聚焦 W5-001 派發 sage 越界案例的常見衝突樣態。
# 擴充原則：發現誤報率可控（<5%）的新 pattern 時加入；高誤報者先保留測試。
FORBIDDEN_KEYWORD_MAP: Dict[str, List[re.Pattern]] = {
    "實作": [
        re.compile(r"實作"),
        re.compile(r"編寫[^\n]{0,10}程式碼"),
        re.compile(r"撰寫[^\n]{0,10}程式碼"),
        re.compile(r"\bimplement\b", re.IGNORECASE),
        re.compile(r"Write[^\n]{0,20}\.(?:py|js|ts|dart|go)", re.IGNORECASE),
        re.compile(r"寫入[^\n]{0,20}\.(?:py|js|ts|dart|go)"),
    ],
    "修改檔案": [
        re.compile(r"Edit[^\n]{0,20}\.(?:py|js|ts|dart|go)", re.IGNORECASE),
        re.compile(r"修改[^\n]{0,20}\.(?:py|js|ts|dart|go)"),
        re.compile(r"修正[^\n]{0,20}\.(?:py|js|ts|dart|go)"),
    ],
    "git commit": [
        re.compile(r"git\s+commit", re.IGNORECASE),
        re.compile(r"提交[^\n]{0,10}commit", re.IGNORECASE),
    ],
    "設計功能規格": [
        re.compile(r"設計[^\n]{0,10}規格"),
        re.compile(r"撰寫[^\n]{0,10}規格"),
    ],
    "直接執行測試修復": [
        re.compile(r"修復[^\n]{0,10}測試"),
        re.compile(r"fix[^\n]{0,10}test", re.IGNORECASE),
    ],
    "執行測試": [
        re.compile(r"執行[^\n]{0,10}測試"),
        re.compile(r"\brun\s+tests?\b", re.IGNORECASE),
        re.compile(r"\bpytest\b", re.IGNORECASE),
    ],
    # W11-004.1.2：新增 A-F 六類 pattern（擴充 keyword map 覆蓋 W5-001 以降新型越界）
    # 類別 A：Ticket CLI 操作（rosemary/incident-responder 禁止直接執行）
    "ticket CLI": [
        re.compile(r"\bticket\s+(?:track|create|migrate|handoff|claim|complete)\b", re.IGNORECASE),
        re.compile(r"/ticket\s+\w+"),
    ],
    # 類別 B：規格/文件修改（lavender/oregano/star-anise 禁止越權）
    "修改規格": [
        re.compile(r"(?:修改|編輯|Edit)[^\n]{0,20}(?:spec|規格|需求|use-?case)", re.IGNORECASE),
        re.compile(r"(?:更新|改寫)[^\n]{0,10}規格"),
    ],
    # 類別 C：Git 寫入（非 commit）
    "git 寫入": [
        re.compile(r"git\s+(?:push|merge|rebase|cherry-pick)", re.IGNORECASE),
        re.compile(r"git\s+reset\s+--hard", re.IGNORECASE),
        re.compile(r"(?:推送|合併|變基)[^\n]{0,10}(?:分支|branch|PR)"),
    ],
    # 類別 D：重構/移除（linux「只分析不修改」、pepper「只規劃不實作」）
    "執行重構": [
        re.compile(r"(?:執行|進行)[^\n]{0,10}重構"),
        re.compile(r"(?:移除|刪除)[^\n]{0,20}\.(?:py|js|ts|dart|go)"),
        re.compile(r"\brefactor\b", re.IGNORECASE),
    ],
    # 類別 E：系統級審查（lavender 禁止系統級審查）
    "系統審查": [
        re.compile(r"系統級?審查"),
        re.compile(r"(?:盤點|審計)[^\n]{0,10}(?:系統|架構|全專案)"),
    ],
    # 類別 F：分支/worktree 操作
    "分支操作": [
        re.compile(r"git\s+(?:checkout|branch|switch)\b", re.IGNORECASE),
        re.compile(r"\bworktree\s+(?:add|remove|prune)\b", re.IGNORECASE),
    ],
}


def _extract_prohibited_actions(agent_md_path: Path) -> List[str]:
    """解析 agent .md 檔的「## 禁止行為」區塊，回傳 `**禁止XX**` 標籤清單。

    回傳：prohibited action 標籤（XX 部分，已去除前後空白）。
    若檔案不存在、無法讀取、或無「## 禁止行為」區塊則回傳空 list。
    """
    try:
        content = agent_md_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []

    section_match = _PROHIBITED_SECTION_PATTERN.search(content)
    if not section_match:
        return []

    section_body = section_match.group(1)
    labels = [
        m.group(1).strip()
        for m in _PROHIBITED_LABEL_PATTERN.finditer(section_body)
    ]
    return labels


# W11-004.1.1：events.jsonl 路徑（與 dispatch_stats.py 必須一致）
try:
    _EVENTS_JSONL_PATH = (
        get_project_root()
        / ".claude/hook-logs/agent-dispatch-validation/events/events.jsonl"
    )
except Exception:
    _EVENTS_JSONL_PATH = (
        Path.cwd()
        / ".claude/hook-logs/agent-dispatch-validation/events/events.jsonl"
    )


def _make_excerpt(prompt: str, start: int, end: int, padding: int = 20) -> str:
    """取命中片段前後 padding 字元作上下文，換行替換為空白。"""
    lo = max(0, start - padding)
    hi = min(len(prompt), end + padding)
    return prompt[lo:hi].replace("\n", " ").replace("\r", " ")


def _detect_keyword_conflicts(
    prompt: str, prohibited_actions: List[str]
) -> List[Dict[str, str]]:
    """掃描 prompt 是否命中 prohibited_actions 對應的關鍵字 pattern。

    回傳：衝突 dict 清單，每筆含 action / keyword / matched_pattern / prompt_excerpt。
    無衝突時回傳空 list。

    匹配策略：prohibited action 標籤若「包含」FORBIDDEN_KEYWORD_MAP 某個 key
    （子字串比對），則以該 key 的 patterns 掃描 prompt。
    """
    if not prompt or not prohibited_actions:
        return []

    conflicts: List[Dict[str, str]] = []
    for action in prohibited_actions:
        for keyword, patterns in FORBIDDEN_KEYWORD_MAP.items():
            if keyword not in action:
                continue
            for pattern in patterns:
                m = pattern.search(prompt)
                if m:
                    conflicts.append({
                        "action": action,
                        "keyword": keyword,
                        "matched_pattern": pattern.pattern,
                        "prompt_excerpt": _make_excerpt(
                            prompt, m.start(), m.end(), padding=20
                        ),
                    })
                    break  # 同一 keyword 命中一次即可
    return conflicts


def _write_event_jsonl(
    subagent_type: str,
    prompt: str,
    conflicts_detail: List[Dict[str, str]],
    logger,
) -> None:
    """寫一行 event 到 events.jsonl，flock 並發安全，失敗不 raise。"""
    if not subagent_type or not prompt:
        return
    if not conflicts_detail:
        return

    import hashlib
    import fcntl
    from datetime import datetime, timezone

    prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]
    now = datetime.now(timezone.utc)
    ts_compact = now.strftime("%Y%m%dT%H%M%SZ")
    event_id = f"{ts_compact}-{prompt_hash[:8]}"
    timestamp_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    event = {
        "event_id": event_id,
        "timestamp": timestamp_iso,
        "subagent_type": subagent_type,
        "conflicts": conflicts_detail,
        "prompt_hash": prompt_hash,
        "prompt_length": len(prompt),
    }
    line = json.dumps(event, ensure_ascii=False) + "\n"

    try:
        _EVENTS_JSONL_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(_EVENTS_JSONL_PATH, "a", encoding="utf-8") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            f.write(line)
    except OSError as e:
        msg = f"dispatch_stats: write event failed: {e}"
        if logger is not None:
            try:
                logger.warning(msg)
            except Exception:
                pass
        print(msg, file=sys.stderr)
        return


def _agent_md_path(subagent_type: str) -> Path:
    """回傳 agent .md 檔的主 repo 路徑（可能不存在）。"""
    try:
        project_root = get_project_root()
    except Exception:
        project_root = Path.cwd()
    return project_root / ".claude" / "agents" / f"{subagent_type}.md"


_KEYWORD_CONFLICT_WARNING_TEMPLATE = """[警告] 派發 {agent} 偵測到 prompt 與 agent 禁止行為衝突

為什麼警告：
  W5-001 派發 sage 越界事件：PM prompt 要求 agent 執行其「## 禁止行為」區塊宣告
  不可做的動作（如實作、git commit、修改規格）。本 Hook 掃描 agent 宣告的禁止
  項，與 prompt 內關鍵字比對，發現潛在越界時提示。

偵測到的衝突：
{conflicts}

建議檢查：
  1. 確認派發對象正確（是否應改派實作代理人？）
  2. 若 prompt 合法（例如引用 agent 定義中的禁止詞彙作為說明），請忽略本警告
  3. 若 prompt 要求越界，請改派適合的代理人或拆分任務

詳見：.claude/rules/core/agent-definition-standard.md
      .claude/error-patterns/process-compliance/（W5-001 派發越界學習）

本訊息為警告（非阻擋），派發將繼續進行。"""


def _emit_keyword_conflict_warning_if_any(
    subagent_type: str, prompt: str, logger
) -> None:
    """掃描 agent 禁止行為與 prompt 衝突；有衝突時 stderr 印警告（非阻擋）。"""
    if not subagent_type or not prompt:
        return

    agent_md = _agent_md_path(subagent_type)
    if not agent_md.exists():
        logger.debug("agent .md 不存在：%s（略過關鍵字掃描）", agent_md)
        return

    prohibited = _extract_prohibited_actions(agent_md)
    if not prohibited:
        logger.debug(
            "%s agent 無『## 禁止行為』區塊或解析為空（略過掃描）",
            subagent_type,
        )
        return

    conflicts = _detect_keyword_conflicts(prompt, prohibited)
    if not conflicts:
        return

    conflict_lines = "\n".join(
        f"  - 禁止行為『{c['action']}』命中關鍵字『{c['keyword']}』"
        f"（片段：{c['prompt_excerpt']!r}）"
        for c in conflicts
    )
    message = _KEYWORD_CONFLICT_WARNING_TEMPLATE.format(
        agent=subagent_type, conflicts=conflict_lines
    )
    print(message, file=sys.stderr)
    logger.info(
        "警告：%s prompt 偵測到 %d 項關鍵字衝突（W5-045）",
        subagent_type, len(conflicts),
    )
    # W11-004.1.1：寫 event 到 events.jsonl（失敗不 raise）
    _write_event_jsonl(subagent_type, prompt, conflicts, logger)


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

    prompt = tool_input.get("prompt", "") or ""

    # W5-045：agent 禁止行為關鍵字衝突掃描（非阻擋，初版 warn-only）
    # 不受 IMPLEMENTATION_AGENTS 限制：W5-001 派發 sage 越界事件中 sage 非
    # 實作代理人，但 prompt 要求實作而觸發越界，正需此掃描防護。
    _emit_keyword_conflict_warning_if_any(subagent_type, prompt, logger)

    # 無 subagent_type 或非實作代理人 → 放行（worktree 強制邏輯僅對實作代理人）
    if not subagent_type or subagent_type not in IMPLEMENTATION_AGENTS:
        logger.info("放行：subagent_type=%s", subagent_type or "(empty)")
        return 0

    # Target-based 分類

    # W5-047.2：並行場景廣域 staging 警告（PC-092 防護，非阻擋）
    _emit_wide_staging_warning_if_parallel(prompt, logger)

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
