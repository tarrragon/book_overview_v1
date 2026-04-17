#!/usr/bin/env python3
"""
AskUserQuestion Charset Guard Hook - 測試（W13-003）

驗證 SIMPLIFIED_CHARS / EMOJI_RANGES 偵測邏輯，重點確認本次 session 再現的
「隶」(U+96B6) 與「遗」(U+9057) 已納入攔截清單，且既有字元/Emoji 偵測仍有效。
"""

import importlib.util
import sys
from pathlib import Path

import pytest

HOOK_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(HOOK_DIR))

_spec = importlib.util.spec_from_file_location(
    "askuserquestion_charset_guard_hook",
    HOOK_DIR / "askuserquestion-charset-guard-hook.py",
)
hook_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hook_module)

find_violations = hook_module.find_violations
scan_payload = hook_module.scan_payload
SIMPLIFIED_CHARS = hook_module.SIMPLIFIED_CHARS


# ============================================================================
# SIMPLIFIED_CHARS 清單（W13-003 新增字元 + 既有回歸）
# ============================================================================


class TestSimplifiedCharsMembership:
    """驗證 SIMPLIFIED_CHARS frozenset 含關鍵字元。"""

    def test_w13_003_new_chars_included(self):
        """W13-003 補強：『隶』『遗』必須在清單。"""
        assert "\u96b6" in SIMPLIFIED_CHARS, "隶 (U+96B6) 應在 SIMPLIFIED_CHARS"
        assert "\u9057" in SIMPLIFIED_CHARS, "遗 (U+9057) 應在 SIMPLIFIED_CHARS"

    def test_existing_chars_preserved(self):
        """回歸：既有常見簡體字『独/违/决』仍在清單。"""
        for ch in ("独", "违", "决", "关", "为", "与"):
            assert ch in SIMPLIFIED_CHARS, f"{ch} 應保留在 SIMPLIFIED_CHARS"

    def test_traditional_counterparts_not_in_list(self):
        """邊界：對應繁體『隸』『遺』『獨』『違』不可在清單。"""
        for ch in ("\u96b8", "\u907a", "獨", "違", "決"):
            assert ch not in SIMPLIFIED_CHARS, f"繁體 {ch} 不應在 SIMPLIFIED_CHARS"


# ============================================================================
# find_violations 行為驗證
# ============================================================================


class TestFindViolations:
    """驗證 find_violations 正確標記污染位置與類別。"""

    def test_pure_traditional_passes(self):
        """純繁體文字無違規。"""
        text = "建立獨立的隸屬關係，遺留項目已處理"
        violations = find_violations(text, "test.field")
        assert violations == []

    def test_detects_li_simplified(self):
        """含『隶』觸發違規，類別為簡體字。"""
        text = "F 案外移\u96b6\u5c6c Skill Market"  # 隶屬
        violations = find_violations(text, "test.field")
        codes = [v[2] for v in violations]
        assert 0x96B6 in codes, "應標記 U+96B6"
        categories = {v[3] for v in violations}
        assert "簡體字" in categories

    def test_detects_yi_simplified(self):
        """含『遗』觸發違規。"""
        text = "test mode 權限變更\u9057\u7559"  # 遗留
        violations = find_violations(text, "test.field")
        codes = [v[2] for v in violations]
        assert 0x9057 in codes, "應標記 U+9057"

    def test_detects_existing_simplified(self):
        """回歸：既有『独/违/决』仍觸發違規。"""
        text = "独立执行决策违反规则"
        violations = find_violations(text, "test.field")
        simplified_codes = [v[2] for v in violations if v[3] == "簡體字"]
        assert 0x72EC in simplified_codes  # 独
        assert 0x51B3 in simplified_codes  # 决
        assert 0x8FDD in simplified_codes  # 违

    def test_detects_emoji_ranges(self):
        """回歸：Emoji 範圍仍攔截。"""
        text = "進度 ⚡ 完成 ✅"
        violations = find_violations(text, "test.field")
        emoji_codes = [v[2] for v in violations if v[3] == "emoji"]
        assert 0x26A1 in emoji_codes  # ⚡
        assert 0x2705 in emoji_codes  # ✅

    def test_field_path_recorded(self):
        """field_path 正確標記在結果中。"""
        violations = find_violations("隶", "questions[0].options[1].description")
        assert violations
        assert violations[0][0] == "questions[0].options[1].description"


# ============================================================================
# scan_payload 整合驗證（AUQ 結構）
# ============================================================================


class TestScanPayload:
    """驗證 scan_payload 對 questions 陣列各層欄位的掃描覆蓋。"""

    def test_clean_payload_passes(self):
        """純繁體 + 無 emoji payload 無違規。"""
        questions = [
            {
                "question": "選擇下一步方案？",
                "header": "方案選擇",
                "options": [
                    {"label": "繼續執行", "description": "維持現狀"},
                    {"label": "切換目標", "description": "改做別的"},
                ],
            }
        ]
        assert scan_payload(questions) == []

    def test_detects_simplified_in_description(self):
        """W13-003 實證：description 含『隶屬』被攔截。"""
        questions = [
            {
                "question": "歸屬確認？",
                "header": "歸屬",
                "options": [
                    {"label": "A 方案", "description": "F 案隶屬 Skill Market"},
                    {"label": "B 方案", "description": "遗留物處理"},
                ],
            }
        ]
        violations = scan_payload(questions)
        codes = [v[2] for v in violations]
        assert 0x96B6 in codes  # 隶
        assert 0x9057 in codes  # 遗

    def test_detects_across_all_fields(self):
        """question / header / label / description 各欄位都被掃描。"""
        questions = [
            {
                "question": "独立問題",
                "header": "违反",
                "options": [
                    {"label": "决策", "description": "简单"},
                ],
            }
        ]
        violations = scan_payload(questions)
        field_paths = {v[0] for v in violations}
        assert "questions[0].question" in field_paths
        assert "questions[0].header" in field_paths
        assert "questions[0].options[0].label" in field_paths
        assert "questions[0].options[0].description" in field_paths

    def test_empty_questions_no_violation(self):
        """空陣列不報錯。"""
        assert scan_payload([]) == []

    def test_malformed_items_skipped(self):
        """非 dict 項目被跳過，不中斷掃描。"""
        questions = [
            "not a dict",
            {"question": "獨立", "options": "not a list"},
            None,
        ]
        assert scan_payload(questions) == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
