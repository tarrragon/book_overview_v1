#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

"""
Stop hook: 偵測 worklog 寫了 handoff 段落但 CLI 未執行的雙軌不同步（W17-083 S3）

對應 W17-083 Phase 1 方案 D（A + C 組合）的 A 部分：
session 結束時掃描 worklog 是否含 handoff 關鍵字，比對 .claude/handoff/pending/
現況，列出缺失（worklog 有 / pending 無）與孤立（pending 有 / worklog 無）。

四主情境：
1. 雙軌一致 → 不輸出
2. worklog 有 / pending 無（核心） → 輸出警告 + 建議命令
3. pending 有 / worklog 無（孤立） → 輸出低優先級提示
4. 雙軌皆無 → 不輸出

輸出協議：
- additionalContext via JSON stdout（與 handoff-auto-resume-stop-hook 共存，
  Claude Code 會合併多個 hook 的 additionalContext）

ARCH-020 同構雙寫風險：
- HANDOFF_KEYWORDS / TICKET_ID regex 與 ticket_system/lib/worklog_parser.py 重複
- 因 PEP 723 隔離環境（dependencies=[]）無法 import lib，需照搬 SOT
- SOT: .claude/skills/ticket/ticket_system/lib/worklog_parser.py
- 任一處更新時需手動同步另一處（兩處 docstring 互相引用）

來源：W17-083 ANA Phase 3a S3 設計
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Optional, Set

# 加入 hook_utils 路徑
sys.path.insert(0, str(Path(__file__).parent))
from hook_utils import setup_hook_logging, get_project_root  # noqa: E402

EXIT_SUCCESS = 0

# todolist active version 偵測（與 session-start-scheduler-hint-hook 同步）
_TODOLIST_ACTIVE_VERSION_RE = re.compile(
    r"-\s*version:\s*[\"']?(\S+?)[\"']?\s*\n\s*status:\s*active",
    re.MULTILINE,
)

# Pending dir 相對路徑（與 ticket_system.constants.HANDOFF_DIR 一致；硬編副本）
HANDOFF_PENDING_RELPATH = ".claude/handoff/pending"

# Terminal 狀態（已 completed 不視為缺失）
TERMINAL_STATUSES = {"completed", "closed"}

# ---------------------------------------------------------------------------
# SOT-mirror: HANDOFF_KEYWORDS / TICKET_ID regex
# 對應 .claude/skills/ticket/ticket_system/lib/worklog_parser.py
# 任一處更新需同步另一處（ARCH-020）
# ---------------------------------------------------------------------------

HANDOFF_KEYWORDS = (
    # 標題式
    "下個 Session 接手 Context",
    "下一 Session 接手",
    "下 Session 接手",
    "接手指引",
    "Handoff Context",
    "Session Handoff",
    # 建議式
    "下 session 優先建議",
    "下個 session 優先建議",
    "下一 session 優先建議",
    "下 session 優先順序建議",
    "下次 session 建議",
    "建議下 session",
    # 續行式
    "未完成清單",
    "Spawned 推進清單",
)

TICKET_ID_FULL_PATTERN = re.compile(
    r"\b(\d+\.\d+\.\d+)-(W\d+-[\d\w]+(?:\.\d+)?)\b"
)
TICKET_ID_SHORT_PATTERN = re.compile(
    r"\b(W\d+-[\d\w]+(?:\.\d+)?)\b"
)


# ---------------------------------------------------------------------------
# 解析輔助函式（SOT-mirror，與 worklog_parser.py 邏輯一致）
# ---------------------------------------------------------------------------


def _detect_handoff_keywords(content: str) -> bool:
    if not content:
        return False
    return any(kw in content for kw in HANDOFF_KEYWORDS)


def _preceded_by_version_prefix(content: str, start: int) -> bool:
    if start == 0:
        return False
    prefix_start = max(0, start - 12)
    prefix = content[prefix_start:start]
    return bool(re.search(r"\d+\.\d+\.\d+-$", prefix))


def _extract_ticket_ids(content: str, active_version: Optional[str] = None) -> list[str]:
    if not content:
        return []
    seen: list[str] = []
    seen_set: set[str] = set()
    for match in TICKET_ID_FULL_PATTERN.finditer(content):
        full_id = f"{match.group(1)}-{match.group(2)}"
        if full_id not in seen_set:
            seen.append(full_id)
            seen_set.add(full_id)
    if active_version:
        for match in TICKET_ID_SHORT_PATTERN.finditer(content):
            short_id = match.group(1)
            if _preceded_by_version_prefix(content, match.start()):
                continue
            full_id = f"{active_version}-{short_id}"
            if full_id not in seen_set:
                seen.append(full_id)
                seen_set.add(full_id)
    return seen


def _detect_active_version(project_root: Path) -> Optional[str]:
    """偵測 todolist.yaml 中 status=active 的版本字串（不含 v 前綴）。"""
    todolist = project_root / "docs" / "todolist.yaml"
    if not todolist.exists():
        return None
    try:
        content = todolist.read_text(encoding="utf-8")
        m = _TODOLIST_ACTIVE_VERSION_RE.search(content)
        if m:
            return m.group(1).strip().lstrip("v")
    except Exception:
        return None
    return None


def _find_worklog_path(project_root: Path, version: str) -> Path:
    """構建 main worklog 路徑（與 worklog_appender._build_worklog_path 一致）。"""
    bare = version.lstrip("v")
    parts = bare.split(".")
    major = parts[0]
    minor = f"{parts[0]}.{parts[1]}" if len(parts) >= 2 else bare
    return (
        project_root
        / "docs"
        / "work-logs"
        / f"v{major}"
        / f"v{minor}"
        / f"v{bare}"
        / f"v{bare}-main.md"
    )


def _scan_pending_dir(project_root: Path) -> Set[str]:
    """掃描 .claude/handoff/pending/ 下的 ticket ID（檔名 stem）。"""
    pending_dir = project_root / HANDOFF_PENDING_RELPATH
    if not pending_dir.exists():
        return set()
    return {p.stem for p in pending_dir.glob("*.json")}


def _load_ticket_status(project_root: Path, ticket_id: str) -> Optional[str]:
    """從 ticket md frontmatter 輕量解析 status；找不到回 None。

    避免 import ticket_system（PEP 723 dependencies=[]）；用 regex 解析 status: 行。
    """
    # ticket id 格式：<version>-W<wave>-<seq>[.<sub>]
    parts = ticket_id.split("-", 1)
    if len(parts) < 2:
        return None
    version = parts[0]
    bare = version.lstrip("v")
    sub = bare.split(".")
    major = sub[0]
    minor = f"{sub[0]}.{sub[1]}" if len(sub) >= 2 else bare

    # 可能放在 tickets/ 子目錄
    candidates = [
        project_root / "docs" / "work-logs" / f"v{major}" / f"v{minor}" / f"v{bare}" / "tickets" / f"{ticket_id}.md",
        project_root / "docs" / "work-logs" / f"v{major}" / f"v{minor}" / f"v{bare}" / f"{ticket_id}.md",
    ]
    for ticket_path in candidates:
        if not ticket_path.exists():
            continue
        try:
            content = ticket_path.read_text(encoding="utf-8")
        except Exception:
            continue
        # frontmatter 在開頭 --- ... ---
        m = re.search(r"^status:\s*(\S+)\s*$", content, re.MULTILINE)
        if m:
            return m.group(1).strip()
    return None


# ---------------------------------------------------------------------------
# 主邏輯
# ---------------------------------------------------------------------------


def _format_warning(missing: list[str], orphan: list[str]) -> str:
    """格式化警告輸出（對應 W17-083 Phase 1 §4 設計）。"""
    lines = []
    lines.append("=" * 40)
    lines.append("[Worklog-CLI Handoff Sync Check]")
    lines.append("=" * 40)
    lines.append("")

    if missing:
        lines.append("worklog 已寫接手段落，但以下 ticket 未產生 CLI handoff：")
        lines.append("")
        lines.append("缺失（worklog 有 / pending 無）：")
        for tid in missing:
            lines.append(f"  - {tid}")
        lines.append("")
        lines.append("建議執行：")
        for tid in missing:
            lines.append(f"  ticket handoff {tid}")
        lines.append("")
        lines.append("或批次執行：")
        lines.append("  ticket handoff --from-worklog")
        lines.append("")

    if orphan:
        lines.append("孤立（pending 有 / worklog 無）：")
        for tid in orphan:
            lines.append(f"  - {tid}  # 考慮 archive 或補寫 worklog")
        lines.append("")

    lines.append("（session-switching-sop.md「Worklog 交接與 CLI handoff 同步」強制規則）")
    return "\n".join(lines)


def detect_sync_drift(project_root: Path, session_start: float, logger) -> Optional[str]:
    """主檢查邏輯：偵測雙軌不同步並回傳警告字串（無問題回 None）。"""
    version = _detect_active_version(project_root)
    if not version:
        logger.debug("無 active version，靜默退出")
        return None

    worklog_path = _find_worklog_path(project_root, version)
    if not worklog_path.exists():
        logger.debug("worklog 不存在: %s", worklog_path)
        return None

    # mtime 過濾：本 session 未動 worklog → 不檢查
    if session_start > 0 and worklog_path.stat().st_mtime < session_start:
        logger.debug("worklog mtime 早於 session_start，跳過")
        return None

    try:
        content = worklog_path.read_text(encoding="utf-8")
    except Exception as e:
        logger.warning("讀取 worklog 失敗: %s", e)
        return None

    pending_ids = _scan_pending_dir(project_root)
    has_keywords = _detect_handoff_keywords(content)

    # 雙軌皆無 → 不輸出
    if not has_keywords and not pending_ids:
        return None

    worklog_ids = _extract_ticket_ids(content, active_version=version) if has_keywords else []

    # 過濾 worklog 中已 completed 的 ticket
    worklog_active = []
    for tid in worklog_ids:
        status = _load_ticket_status(project_root, tid)
        if status not in TERMINAL_STATUSES:
            worklog_active.append(tid)

    worklog_active_set = set(worklog_active)
    missing = [tid for tid in worklog_active if tid not in pending_ids]
    orphan = sorted(pending_ids - worklog_active_set)

    if not missing and not orphan:
        return None

    return _format_warning(missing, orphan)


def main():
    logger = setup_hook_logging("stop-worklog-handoff-sync-check")
    try:
        try:
            event = json.loads(sys.stdin.read() or "{}")
        except Exception:
            event = {}

        session_start = float(event.get("session_start_timestamp", 0) or 0)

        project_root = get_project_root()
        warning = detect_sync_drift(project_root, session_start, logger)

        if warning:
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "Stop",
                    "additionalContext": warning,
                }
            }
            print(json.dumps(output, ensure_ascii=False))
        sys.exit(EXIT_SUCCESS)
    except Exception as e:
        # 規則 4：失敗可見（stderr + 日誌）
        logger.error("stop-worklog-handoff-sync-check 異常: %s", e, exc_info=True)
        print(f"[stop-worklog-handoff-sync-check] 異常: {e}", file=sys.stderr)
        sys.exit(EXIT_SUCCESS)  # 不阻塞 session stop


if __name__ == "__main__":
    main()
