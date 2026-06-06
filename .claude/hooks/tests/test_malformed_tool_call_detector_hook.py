#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""malformed-tool-call-detector-hook.py 測試

聚焦 W2-011.1 false-positive 修復：strip_code_regions 須剝除
  根因 A：4-space 縮排 code block（縮排引述標記不應命中 signature）
  根因 B：跨行 backtick 引述（多行反引號內標記不應命中 signature）

同時回歸驗證真陽偵測形態（裸 invoke / 游離 token 接 invoke）仍 100% 攔截，
且 signature 4（游離 token 接 invoke）不被削弱。
"""

import importlib.util
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
HOOK_PATH = REPO_ROOT / ".claude" / "hooks" / "malformed-tool-call-detector-hook.py"


def _load_hook_module():
    """動態載入 Hook 模組（檔名含 `-` 不能用一般 import）。"""
    spec = importlib.util.spec_from_file_location("malformed_detector_hook", HOOK_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def hook_mod():
    return _load_hook_module()


# ---------------------------------------------------------------------------
# 真陰 fixture（不應命中）——本 ticket 核心修復
# ---------------------------------------------------------------------------

# 根因 A：4-space 縮排 code block，內含 invoke/parameter 字面
TRUE_NEGATIVE_FOUR_SPACE_INDENT = """以下是壞掉的標記範例（4-space 縮排引述）：

    <invoke name="Foo">
    <parameter name="x">1</parameter>
    </invoke>

說明完畢，這些只是被引述的程式碼字面，不是真實工具呼叫。"""

# 根因 B：跨行 backtick 引述，內含 invoke 字面
TRUE_NEGATIVE_CROSS_LINE_BACKTICK = """這段 `多行
<invoke name="Bar">
內容` 只是用反引號引述的多行字面。"""

# 既有真陰：fenced code block 內的標記（修復前已正確剝除，回歸保護）
TRUE_NEGATIVE_FENCED_BLOCK = """範例如下：

```xml
<invoke name="Baz">
</invoke>
```

以上為說明。"""

# 既有真陰：單行 inline backtick 內的標記
TRUE_NEGATIVE_INLINE_BACKTICK = "請用帶前綴的 `<invoke>` 標記，不要寫成裸的。"


# ---------------------------------------------------------------------------
# 真陽 fixture（必須命中）——回歸保護，禁削弱
# ---------------------------------------------------------------------------

# 行首裸 <invoke>（signature 1）
TRUE_POSITIVE_BARE_INVOKE = """這是真的寫壞了：
<invoke name="Real">
</invoke>"""

# 行首裸 </invoke>（signature 3）
TRUE_POSITIVE_BARE_CLOSE_INVOKE = """前面有內容
</invoke>
後面有內容"""

# 游離 token 接 <invoke>（signature 4，thyme F3 證偽其為真陽，禁削弱）
TRUE_POSITIVE_STRAY_TOKEN_INVOKE = """count
<invoke name="Real">"""


@pytest.mark.parametrize(
    "text",
    [
        TRUE_NEGATIVE_FOUR_SPACE_INDENT,
        TRUE_NEGATIVE_CROSS_LINE_BACKTICK,
        TRUE_NEGATIVE_FENCED_BLOCK,
        TRUE_NEGATIVE_INLINE_BACKTICK,
    ],
    ids=["four_space_indent", "cross_line_backtick", "fenced_block", "inline_backtick"],
)
def test_true_negative_not_detected(hook_mod, text):
    """真陰：被引述的標記字面不應命中任何簽章。"""
    assert hook_mod.detect(text) == ""


@pytest.mark.parametrize(
    "text",
    [
        TRUE_POSITIVE_BARE_INVOKE,
        TRUE_POSITIVE_BARE_CLOSE_INVOKE,
        TRUE_POSITIVE_STRAY_TOKEN_INVOKE,
    ],
    ids=["bare_invoke", "bare_close_invoke", "stray_token_invoke"],
)
def test_true_positive_detected(hook_mod, text):
    """真陽：真實寫壞的工具標記必須命中。"""
    assert hook_mod.detect(text) != ""


def test_signature_four_preserved(hook_mod):
    """signature 4（游離 token 接 invoke）必須存在且仍可攔截（禁削弱）。"""
    patterns = [p.pattern for p in hook_mod.SIGNATURE_PATTERNS]
    assert any("invoke" in p and r"\n" in p for p in patterns), (
        "signature 4（游離 token \\n <invoke）已遺失，違反 thyme F3 證偽結論"
    )
    assert hook_mod.detect(TRUE_POSITIVE_STRAY_TOKEN_INVOKE) != ""
