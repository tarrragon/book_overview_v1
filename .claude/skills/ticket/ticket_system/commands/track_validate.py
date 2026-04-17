"""
ticket track validate 子命令

驗證 Ticket frontmatter 的 4 個關鍵欄位合規性，
回傳合規/違規清單與建議修復命令。

驗證欄位（與 W14-028 hook 保持行為一致）：
1. status: 必須為 {pending, in_progress, completed, blocked, superseded, closed} 之一
2. completed_at: null 或 ISO 8601 格式（YYYY-MM-DDTHH:MM:SS）
3. acceptance: 必須為 list，每項為 "[ ] ..." 或 "[x] ..." 格式
4. who: 必須為 dict，包含 current 和 history 欄位

TODO(W14-028): 本模組包含 stub 驗證邏輯，待 W14-028 完成
`ticket_system/validators/frontmatter_validator.py` 後抽出共用，
Hook 與本 CLI 同時 import。
"""

if __name__ == "__main__":
    import sys
    print("[ERROR] 此檔案不支援直接執行，請使用 ticket track validate")
    sys.exit(1)


import argparse
import re
from typing import Any

from ticket_system.lib.ticket_loader import load_ticket
from ticket_system.lib.messages import (
    ErrorMessages,
    format_error,
)
from ticket_system.constants import (
    STATUS_PENDING,
    STATUS_IN_PROGRESS,
    STATUS_COMPLETED,
    STATUS_BLOCKED,
    STATUS_SUPERSEDED,
    STATUS_CLOSED,
)


# ============================================================
# Stub 驗證邏輯（W14-028 完成後抽出至 validators/frontmatter_validator.py）
# ============================================================

VALID_STATUS = {
    STATUS_PENDING,
    STATUS_IN_PROGRESS,
    STATUS_COMPLETED,
    STATUS_BLOCKED,
    STATUS_SUPERSEDED,
    STATUS_CLOSED,
}

ISO_8601_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$"
)

ACCEPTANCE_ITEM_PATTERN = re.compile(r"^\[[ x]\](\s.+)?$")


def _validate_status(ticket: dict) -> tuple[bool, str]:
    """驗證 status 欄位。回傳 (合規, 違規訊息)。"""
    status = ticket.get("status")
    if status is None:
        return False, "status 欄位缺失"
    if not isinstance(status, str):
        return False, f"status 必須為字串，實際為 {type(status).__name__}"
    if status not in VALID_STATUS:
        return False, f"status='{status}' 不在合法 enum：{sorted(VALID_STATUS)}"
    return True, ""


def _validate_completed_at(ticket: dict) -> tuple[bool, str]:
    """驗證 completed_at 欄位。回傳 (合規, 違規訊息)。"""
    value = ticket.get("completed_at")
    if value is None:
        return True, ""
    if not isinstance(value, str):
        return False, f"completed_at 必須為 null 或字串，實際為 {type(value).__name__}"
    if not ISO_8601_PATTERN.match(value):
        return False, f"completed_at='{value}' 不符 ISO 8601 格式 (YYYY-MM-DDTHH:MM:SS)"
    return True, ""


def _validate_acceptance(ticket: dict) -> tuple[bool, str]:
    """驗證 acceptance 欄位。回傳 (合規, 違規訊息)。"""
    value = ticket.get("acceptance")
    if value is None:
        return False, "acceptance 欄位缺失"
    if not isinstance(value, list):
        return False, f"acceptance 必須為 list，實際為 {type(value).__name__}（YAML 行首是否遺漏 '-'？）"
    for idx, item in enumerate(value, start=1):
        if not isinstance(item, str):
            return False, f"acceptance[{idx}] 必須為字串，實際為 {type(item).__name__}"
        if not ACCEPTANCE_ITEM_PATTERN.match(item):
            return False, f"acceptance[{idx}]='{item}' 不符格式 '[ ] ...' 或 '[x] ...'"
    return True, ""


def _validate_who(ticket: dict) -> tuple[bool, str]:
    """驗證 who 欄位。回傳 (合規, 違規訊息)。"""
    value = ticket.get("who")
    if value is None:
        return False, "who 欄位缺失"
    if not isinstance(value, dict):
        return False, f"who 必須為 dict，實際為 {type(value).__name__}"
    if "current" not in value:
        return False, "who 缺少 current 欄位"
    if "history" not in value:
        return False, "who 缺少 history 欄位"
    return True, ""


_VALIDATORS: list[tuple[str, Any]] = [
    ("status", _validate_status),
    ("completed_at", _validate_completed_at),
    ("acceptance", _validate_acceptance),
    ("who", _validate_who),
]


def validate_frontmatter(ticket: dict) -> tuple[list[str], list[tuple[str, str]]]:
    """驗證 Ticket frontmatter 4 欄位。

    Returns:
        (合規欄位清單, [(違規欄位, 訊息), ...])
    """
    ok_fields: list[str] = []
    violations: list[tuple[str, str]] = []
    for field_name, validator in _VALIDATORS:
        is_ok, msg = validator(ticket)
        if is_ok:
            ok_fields.append(field_name)
        else:
            violations.append((field_name, msg))
    return ok_fields, violations


# ============================================================
# 建議修復命令
# ============================================================

_FIX_SUGGESTIONS: dict[str, str] = {
    "status": "ticket track claim <id> / ticket track complete <id> / ticket track release <id>",
    "completed_at": "由 ticket track complete <id> 自動設定（勿手工編輯）",
    "acceptance": (
        "ticket track add-acceptance <id> '<text>'\n"
        "    ticket track remove-acceptance <id> <index>\n"
        "    ticket track set-acceptance <id> --check <index>"
    ),
    "who": "ticket track claim <id>（自動設定 current/history）",
}


def _suggest_fix(field_name: str) -> str:
    return _FIX_SUGGESTIONS.get(field_name, "（無建議，請對照 frontmatter 格式手工修復）")


# ============================================================
# CLI entry
# ============================================================

def execute_validate(args: argparse.Namespace, version: str) -> int:
    """執行 validate 命令。"""
    ticket = load_ticket(version, args.ticket_id)
    if not ticket:
        print(format_error(ErrorMessages.TICKET_NOT_FOUND, ticket_id=args.ticket_id))
        return 1

    ok_fields, violations = validate_frontmatter(ticket)

    print(f"[VALIDATE] {args.ticket_id}")
    print(f"  合規欄位 ({len(ok_fields)}/4)：{', '.join(ok_fields) if ok_fields else '（無）'}")

    if not violations:
        print("  狀態：全部合規")
        return 0

    print(f"  違規欄位 ({len(violations)}/4)：")
    for field_name, msg in violations:
        print(f"    - {field_name}: {msg}")
        print(f"      建議修復：{_suggest_fix(field_name)}")
    return 1
