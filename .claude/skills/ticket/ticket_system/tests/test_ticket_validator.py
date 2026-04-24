"""
ticket_validator._is_placeholder 與 validate_execution_log* 測試

W17-032：修復 _is_placeholder 誤判含 HTML 註解但有實質內容的 section 為 placeholder。

核心規則：
- HTML 註解本身不算內容；剝除後若仍有實質文字，section 視為已填寫。
- 既有佔位符偵測（空白、(pending)/TBD/TODO/N/A、（待填寫：...）、純 HTML 註解）須保留。
"""
import pytest

from ticket_system.lib.ticket_validator import (
    _is_placeholder,
    validate_execution_log,
    validate_execution_log_by_type,
)


class TestIsPlaceholderHtmlComment:
    """HTML 註解相關佔位符行為測試（W17-032 修復重點）"""

    def test_html_comment_with_substantial_content_is_not_placeholder(self):
        """
        TC-032-01：Schema 註解 + 實質內容 → 非 placeholder

        這是 W17-032 修復的核心 case：body schema 範本內置 Schema 標註註解，
        append-log 實際內容後，`_is_placeholder` 不應誤判為佔位符。
        """
        text = (
            "<!-- Schema[IMP/Test Results]: 必填（至少記錄執行指令與通過數）-->\n"
            "\n"
            "執行指令：pytest tests/\n"
            "結果：15 passed, 0 failed"
        )
        assert _is_placeholder(text) is False

    def test_html_comment_only_is_placeholder(self):
        """TC-032-02：僅含 HTML 註解無其他內容 → 仍為 placeholder"""
        text = "<!-- To be filled by executing agent -->"
        assert _is_placeholder(text) is True

    def test_schema_comment_only_is_placeholder(self):
        """TC-032-03：僅 Schema 註解無實質內容 → 仍為 placeholder（保留行為）"""
        text = "<!-- Schema[IMP/Test Results]: 必填 -->"
        assert _is_placeholder(text) is True

    def test_multiple_html_comments_only_is_placeholder(self):
        """TC-032-04：多段 HTML 註解但無實質內容 → placeholder"""
        text = (
            "<!-- Schema[IMP/Test Results]: 必填 -->\n"
            "<!-- To be filled by executing agent -->"
        )
        assert _is_placeholder(text) is True

    def test_html_comment_plus_chinese_placeholder_is_placeholder(self):
        """TC-032-05：HTML 註解 + 中文佔位符（待填寫） → placeholder（組合 case）"""
        text = (
            "<!-- Schema[IMP/Problem Analysis]: 選填 -->\n"
            "\n"
            "（待填寫：問題發生的直接原因是什麼？）"
        )
        assert _is_placeholder(text) is True

    def test_html_comment_plus_pending_marker_is_placeholder(self):
        """TC-032-06：HTML 註解 + (pending) → placeholder"""
        text = (
            "<!-- Schema[IMP/Solution]: 選填 -->\n"
            "(pending)"
        )
        assert _is_placeholder(text) is True

    def test_multiline_html_comment_with_content_is_not_placeholder(self):
        """TC-032-07：跨行 HTML 註解 + 實質內容 → 非 placeholder"""
        text = (
            "<!-- 調查過程記錄（可選）：\n"
            "搜尋指令：grep -rn 'pattern' path/\n"
            "確認的位置：\n"
            "- file1.py:123\n"
            "-->\n"
            "\n"
            "實際根因：regex 匹配過於寬鬆"
        )
        assert _is_placeholder(text) is False


class TestIsPlaceholderLegacyBehavior:
    """既有佔位符偵測行為（保留不變）"""

    def test_empty_string_is_placeholder(self):
        assert _is_placeholder("") is True

    def test_whitespace_only_is_placeholder(self):
        assert _is_placeholder("   \n\t  ") is True

    def test_none_is_placeholder(self):
        assert _is_placeholder(None) is True  # type: ignore[arg-type]

    def test_non_string_is_placeholder(self):
        assert _is_placeholder(123) is True  # type: ignore[arg-type]

    def test_pending_marker_is_placeholder(self):
        assert _is_placeholder("(pending)") is True

    def test_tbd_marker_is_placeholder(self):
        assert _is_placeholder("TBD") is True

    def test_todo_marker_is_placeholder(self):
        assert _is_placeholder("TODO: 待處理") is True

    def test_chinese_placeholder_is_placeholder(self):
        assert _is_placeholder("（待填寫：問題發生的直接原因）") is True

    def test_chinese_required_placeholder_is_placeholder(self):
        assert _is_placeholder("（必填：至少記錄執行指令與通過數）") is True

    def test_plain_text_is_not_placeholder(self):
        assert _is_placeholder("這是實質內容，描述問題根因。") is False


class TestValidateExecutionLogIntegration:
    """validate_execution_log 整合測試：HTML 註解 + 內容不應被擋"""

    def test_body_with_schema_comments_and_content_passes(self):
        """完整 body：所有 section 含 Schema 註解 + 實質內容 → 通過

        注意：validate_execution_log 的 section extraction 遇到 `### ` 即視為下一段，
        因此本測試刻意在 `## XXX` 下放扁平文字（不加 `### 子標題`），
        專注驗證 `_is_placeholder` 對「HTML 註解 + 扁平實質內容」的判斷。
        """
        body = """# Execution Log

## Problem Analysis
<!-- Schema[IMP/Problem Analysis]: 選填 -->

regex 誤判導致 complete 被擋。

## Solution
<!-- Schema[IMP/Solution]: 選填 -->

剝除 HTML 註解後再判斷實質內容。

## Test Results
<!-- Schema[IMP/Test Results]: 必填 -->

pytest tests/ -v：15 passed
"""
        passed, unfilled = validate_execution_log("TEST-001", body)
        assert passed is True, f"Expected pass but unfilled={unfilled}"
        assert unfilled == []

    def test_body_with_schema_comments_only_fails(self):
        """body 所有 section 僅有 Schema 註解 → 全部 unfilled"""
        body = """# Execution Log

## Problem Analysis
<!-- Schema[IMP/Problem Analysis]: 選填 -->

## Solution
<!-- Schema[IMP/Solution]: 選填 -->

## Test Results
<!-- Schema[IMP/Test Results]: 必填 -->
"""
        passed, unfilled = validate_execution_log("TEST-002", body)
        assert passed is False
        assert set(unfilled) == {"Problem Analysis", "Solution", "Test Results"}


class TestValidateExecutionLogByTypeIntegration:
    """validate_execution_log_by_type 整合測試（type-aware schema）"""

    def test_imp_with_test_results_filled_passes(self):
        """IMP：Test Results 含 Schema 註解 + 實質內容 → 通過"""
        body = """## Test Results
<!-- Schema[IMP/Test Results]: 必填 -->

pytest tests/：全數通過（15 passed）
commit: abc1234
"""
        passed, unfilled = validate_execution_log_by_type("IMP", body)
        assert passed is True, f"Expected pass but unfilled={unfilled}"
        assert unfilled == []

    def test_imp_with_test_results_schema_comment_only_fails(self):
        """IMP：Test Results 僅 Schema 註解無實質內容 → 不通過"""
        body = """## Test Results
<!-- Schema[IMP/Test Results]: 必填 -->
"""
        passed, unfilled = validate_execution_log_by_type("IMP", body)
        assert passed is False
        assert unfilled == ["Test Results"]

    def test_ana_with_both_filled_passes(self):
        """ANA：Problem Analysis + Solution 都有實質內容（含 Schema 註解）→ 通過"""
        body = """## Problem Analysis
<!-- Schema[ANA/Problem Analysis]: 必填 -->

分析：W17-016 body schema 機制與 placeholder 偵測衝突。

## Solution
<!-- Schema[ANA/Solution]: 必填 -->

選項 C：剝除所有 HTML 註解後再判斷實質內容。
"""
        passed, unfilled = validate_execution_log_by_type("ANA", body)
        assert passed is True, f"Expected pass but unfilled={unfilled}"
        assert unfilled == []

    def test_doc_always_passes(self):
        """DOC：無必填 section → 直接通過"""
        passed, unfilled = validate_execution_log_by_type("DOC", "")
        assert passed is True
        assert unfilled == []


class TestValidateExecutionLogByTypeH3SubheaderBoundary:
    """W17-047 regression：h3 子標題不應被誤判為章節結束邊界

    原 bug：validate_execution_log_by_type 同時把 `## ` 與 `### ` 當章節邊界，
    導致章節內使用 h3 子標題組織內容時，內容被誤切至第一個 `### ` 之前，
    只剩章節標題 + Schema 註解，被判為 placeholder。

    修復後：僅 h2 (`## `) 行首匹配才是章節邊界；h3 子標題保留在章節內。
    """

    def test_ana_with_h3_subheaders_in_problem_analysis_passes(self):
        """W17-046 觸發案例：Problem Analysis 使用 h3 子標題組織內容，應通過。"""
        body = """## Problem Analysis
<!-- Schema[ANA/Problem Analysis]: 必填 -->

### 問題現象

body-check 誤判合法章節為 placeholder。

### 問題本質

章節邊界判定同時採用 `## ` 與 `### ` 兩層標記。

### 根因分析

第一個 `### ` 會被誤認為下一章節起點。

## Solution
<!-- Schema[ANA/Solution]: 必填 -->

### 修復方向

改用 re.MULTILINE 只匹配 `^## ` 行首。

### 測試要求

新增 regression case 覆蓋 h3 子標題情境。
"""
        passed, unfilled = validate_execution_log_by_type("ANA", body)
        assert passed is True, f"Expected pass but unfilled={unfilled}"
        assert unfilled == []

    def test_imp_with_h3_subheaders_in_test_results_passes(self):
        """IMP：Test Results 含 h3 子標題，應通過。"""
        body = """## Test Results
<!-- Schema[IMP/Test Results]: 必填 -->

### 執行指令

pytest tests/ticket_system/

### 結果摘要

15 passed, 0 failed
"""
        passed, unfilled = validate_execution_log_by_type("IMP", body)
        assert passed is True, f"Expected pass but unfilled={unfilled}"
        assert unfilled == []

    def test_ana_section_with_only_h3_subheader_no_body_still_passes_if_subheader_has_content(self):
        """章節內只有 h3 子標題 + 實質內容（無章節直屬內文），應通過。"""
        body = """## Problem Analysis
<!-- Schema[ANA/Problem Analysis]: 必填 -->
### 根因

核心原因是章節邊界邏輯把 h3 當作章節結束。

## Solution
<!-- Schema[ANA/Solution]: 必填 -->
### 方向

改用 h2 行首匹配。
"""
        passed, unfilled = validate_execution_log_by_type("ANA", body)
        assert passed is True, f"Expected pass but unfilled={unfilled}"
        assert unfilled == []

    def test_ana_empty_section_still_fails(self):
        """既有行為保留：章節內真的沒內容（只有 Schema 註解）→ placeholder。"""
        body = """## Problem Analysis
<!-- Schema[ANA/Problem Analysis]: 必填 -->

## Solution
<!-- Schema[ANA/Solution]: 必填 -->

實質解法內容。
"""
        passed, unfilled = validate_execution_log_by_type("ANA", body)
        assert passed is False
        assert unfilled == ["Problem Analysis"]

    def test_ana_code_block_with_h2_like_string_not_treated_as_section_boundary(self):
        """Edge case：章節內 code block 含 `## ` 非行首字串，不應誤當章節邊界。

        注意：此測試確認 re.MULTILINE 的 `^` 行首錨點正確運作。
        code block 內若有 markdown 縮排後的 `## ` 才算行首（因為 fenced code block
        仍會讓字元在行首），故改用 `^## ` 的同時須確認程式碼範例在 Problem Analysis
        章節內的「行中」`## ` 不誤判。本測試以段落內的行中 `## ` 驗證。
        """
        body = """## Problem Analysis
<!-- Schema[ANA/Problem Analysis]: 必填 -->

這段文字提到 `## header` 作為 markdown 範例說明，此處 `## ` 不在行首。

另外還有段落混用行中文字：前綴 ## 不是章節起點。

## Solution
<!-- Schema[ANA/Solution]: 必填 -->

行首 `## ` 才是下一章節。
"""
        passed, unfilled = validate_execution_log_by_type("ANA", body)
        assert passed is True, f"Expected pass but unfilled={unfilled}"
        assert unfilled == []

    def test_ana_section_boundary_recognizes_h2_after_h3(self):
        """章節內 h3 後仍能正確辨識 h2 為下一章節邊界。"""
        body = """## Problem Analysis
<!-- Schema[ANA/Problem Analysis]: 必填 -->

### 子標題 A
內容 A

### 子標題 B
內容 B

## Solution
<!-- Schema[ANA/Solution]: 必填 -->

Solution 內容。
"""
        passed, unfilled = validate_execution_log_by_type("ANA", body)
        assert passed is True, f"Expected pass but unfilled={unfilled}"
        assert unfilled == []
        # 再手動驗證：如果 Solution 僅 placeholder 應被標註
        body_solution_empty = """## Problem Analysis
<!-- Schema[ANA/Problem Analysis]: 必填 -->

### 子標題 A
內容 A

## Solution
<!-- Schema[ANA/Solution]: 必填 -->
"""
        passed2, unfilled2 = validate_execution_log_by_type("ANA", body_solution_empty)
        assert passed2 is False
        assert unfilled2 == ["Solution"]
