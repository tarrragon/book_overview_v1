"""
身份申報守衛（identity guard）— --as 旗標與 ticket who.current 對照。

背景（PC-V1-002 防護鏈 CLI 層）：W1-045 WRAP 二輪翻案認定威脅模型為「誠實但
誤解的 agent」——generic agent 收到 Ticket ID 即走自律收尾流程，越權勾選 PM
保留的 acceptance 並 complete（W1-044 探針實證）。規則層（W1-046/047）已用文字
固化防線，本模組在世界平面（CLI exit code）強制：寫入命令可選用 --as <agent-name>
申報身份，與 frontmatter who.current 精確比對，不符即 deny（exit 1），不寫入任何
ticket 狀態（純前置檢查）。

過渡策略（warn-only）：未提供 --as 維持現行為，僅 stderr 警告一行（向後相容）。
轉強制（無 --as 即阻擋）的 trigger 由獨立監測 ticket 評估，不在本模組範圍。
"""

import sys
from typing import Optional

from ticket_system.lib.parser import load_ticket

# PM bookkeeping 豁免身份：代收尾、stale cleanup 等合法跨 ticket 操作一律放行。
PM_AGENT_NAME = "rosemary-project-manager"

# Deny 結果（exit 1）— 為業務拒絕（identity mismatch），非執行錯誤。
IDENTITY_DENY_EXIT = 1


def _resolve_who_current(version: str, ticket_id: str) -> Optional[str]:
    """讀取 ticket frontmatter 的 who.current；無法解析時回傳 None（視為空值）。"""
    ticket = load_ticket(version, ticket_id)
    if not ticket:
        return None
    who = ticket.get("who")
    if not isinstance(who, dict):
        return None
    current = who.get("current")
    if not isinstance(current, str) or not current.strip():
        return None
    return current.strip()


def check_identity(version: str, ticket_id: str, as_value: Optional[str]) -> Optional[int]:
    """
    對照申報身份與 ticket who.current，回傳 deny exit code 或 None（放行）。

    判定邏輯（依序，對應 W1-048 規格表）：
    1. 未提供 --as            → 僅 stderr 警告，放行（向後相容，回傳 None）
    2. --as = PM_AGENT_NAME   → 一律放行（PM bookkeeping 豁免，回傳 None）
    3. --as = who.current     → 放行（回傳 None）
    4. --as != who.current    → deny（含 who.current 空值，回傳 IDENTITY_DENY_EXIT）

    本函式不寫入任何 ticket 狀態（純前置檢查）。所有提示走 stderr，
    避免污染 stdout 消費者。

    Args:
        version: 版本號
        ticket_id: Ticket ID
        as_value: --as 旗標值（未提供時為 None）

    Returns:
        None 表示放行；整數表示 deny 的 exit code（呼叫端應直接 return 此值）。
    """
    # 情境 1：未提供 --as → warn-only（向後相容）
    # 僅 str 且非空才視為「已提供」；None 或非 str（如 Mock args 的 auto-attr、
    # getattr default）皆視為未提供，避免守衛誤觸發於既有 Mock-based 測試與
    # 未升級的呼叫端（argparse --as 恆為 str 或 None，此檢查為防禦性）。
    if not isinstance(as_value, str) or not as_value.strip():
        sys.stderr.write(
            "[identity-guard] 建議帶 --as <agent-name> 申報執行身份"
            "（過渡期不阻擋，向後相容；PC-V1-002 前提一）\n"
        )
        return None

    # 情境 2：PM 身份豁免
    if as_value == PM_AGENT_NAME:
        return None

    who_current = _resolve_who_current(version, ticket_id)

    # 情境 3：相符放行
    if who_current is not None and as_value == who_current:
        return None

    # 情境 4：不符 deny（含 who.current 空值）
    who_display = who_current if who_current is not None else "(未指派)"
    sys.stderr.write(
        f"[identity-guard] deny：身份 {as_value} 與指派執行者 {who_display} 不符，"
        f"請回報 PM（PC-V1-002 前提一）\n"
    )
    return IDENTITY_DENY_EXIT
