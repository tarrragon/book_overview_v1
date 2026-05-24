r"""
test_post_test_hook.py

驗證 post-test-hook.py 的 ANALYZER_WARNING_PATTERNS 經 W1-059 縮窄後：
- 不誤報 jest console.warn 輸出（含 "warning - ..." 樣態）
- 仍正確偵測 eslint stylish formatter 真實 lint warning

實證背景：W1-048.8 thyme 回報 npm test (4962 passed / 0 failed) + eslint exit 0
完全無警告情境下，舊 regex r"warning\s*-" 誤報 lint 警告 3 次。
"""

import importlib.util
import logging
import sys
from pathlib import Path

import pytest


HOOK_PATH = Path(__file__).resolve().parent.parent / "post-test-hook.py"


def _load_hook_module():
    """以動態 import 載入 post-test-hook.py（含 hyphen 無法直接 import）。"""
    spec = importlib.util.spec_from_file_location("post_test_hook", HOOK_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules["post_test_hook"] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def hook_module():
    return _load_hook_module()


@pytest.fixture
def logger():
    return logging.getLogger("test-post-test-hook")


# ---------------------------------------------------------------------------
# 反向案例：jest console.warn / 一般輸出不應被誤報為 lint warning
# ---------------------------------------------------------------------------

JEST_FALSE_POSITIVE_SAMPLES = [
    pytest.param(
        "console.warn\n    warning - some deprecation message\n      at Object.<anonymous>",
        id="jest-console-warn-with-dash",
    ),
    pytest.param(
        "  console.warn: warning - migration suggested",
        id="indented-warning-dash",
    ),
    pytest.param(
        "Test: should display warning - when input invalid\n    PASS",
        id="test-name-contains-warning-dash",
    ),
    pytest.param(
        "Tests:       4962 passed, 4962 total\nSnapshots:   0 total\nTime:        12.345 s",
        id="jest-summary-all-pass",
    ),
]


@pytest.mark.parametrize("output", JEST_FALSE_POSITIVE_SAMPLES)
def test_jest_console_warn_not_misclassified_as_lint_warning(hook_module, logger, output):
    """jest console.warn 輸出含 'warning - ...' 不應被誤報為 lint 警告。"""
    error_type, errors = hook_module._classify_errors(output, logger)
    lint_warnings = [e for e in errors if e["description"] == "lint 警告"]
    assert lint_warnings == [], (
        f"jest 輸出被誤報為 lint 警告：{lint_warnings}\n原始輸出：{output!r}"
    )


# ---------------------------------------------------------------------------
# 正向案例：真實 eslint stylish formatter 輸出仍正確偵測
# ---------------------------------------------------------------------------

ESLINT_TRUE_POSITIVE_SAMPLES = [
    pytest.param(
        "/path/to/file.js\n  12:34  warning  Unused variable 'x'  no-unused-vars\n\n1 problem",
        id="eslint-stylish-basic",
    ),
    pytest.param(
        "  5:1  warning  Missing semicolon  semi",
        id="eslint-stylish-simple-rule",
    ),
    pytest.param(
        "  100:20  warning  Prefer const over let  prefer-const\n  101:5  warning  Unexpected console statement  no-console",
        id="eslint-stylish-multiple-warnings",
    ),
    pytest.param(
        "  3:10  warning  Some message  @typescript-eslint/no-unused-vars",
        id="eslint-stylish-scoped-rule",
    ),
]


@pytest.mark.parametrize("output", ESLINT_TRUE_POSITIVE_SAMPLES)
def test_real_eslint_warning_still_detected(hook_module, logger, output):
    """真實 eslint stylish formatter 輸出應正確偵測為 lint 警告。"""
    error_type, errors = hook_module._classify_errors(output, logger)
    lint_warnings = [e for e in errors if e["description"] == "lint 警告"]
    assert lint_warnings, (
        f"真實 eslint warning 未被偵測：{output!r}\n所有錯誤：{errors}"
    )


# ---------------------------------------------------------------------------
# 邊界：完全乾淨輸出
# ---------------------------------------------------------------------------

def test_clean_output_no_errors(hook_module, logger):
    """無錯誤無警告的乾淨輸出應回傳空錯誤列表。"""
    output = "Tests: 100 passed\nAll tests passed"
    error_type, errors = hook_module._classify_errors(output, logger)
    lint_warnings = [e for e in errors if e["description"] == "lint 警告"]
    assert lint_warnings == []
