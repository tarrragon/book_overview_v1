#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""malformed-tool-call-detector-hook.py 測試

涵蓋：
  W2-011.1 false-positive 修復：strip_code_regions 須剝除
    根因 A：4-space 縮排 code block（縮排引述標記不應命中 signature）
    根因 B：跨行 backtick 引述（多行反引號內標記不應命中 signature）
  W2-011.2 內嵌 self-test：--self-test 分支與 _self_test() 真陽真陰 fixtures

DRY：真陽/真陰 fixtures 不在本檔重複定義，改引用 hook 模組的
  SELF_TEST_TRUE_NEGATIVES / SELF_TEST_TRUE_POSITIVES（單一事實來源），
  避免 fixture 與 hook 內嵌版本漂移。

同時回歸驗證真陽偵測形態仍 100% 攔截，且 signature 4（游離 token 接
invoke）不被削弱。
"""

import importlib.util
import subprocess
import sys
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
# 真陰：被引述的標記字面不應命中（fixtures 來自 hook 模組，DRY）
# ---------------------------------------------------------------------------


def test_true_negative_not_detected(hook_mod):
    """真陰：引述標記字面不應命中任何簽章（4 種引述形態）。"""
    for name, text in hook_mod.SELF_TEST_TRUE_NEGATIVES.items():
        assert hook_mod.detect(text) == "", f"真陰 fixture '{name}' 誤命中"


# ---------------------------------------------------------------------------
# 真陽：真實寫壞的標記必須命中（fixtures 來自 hook 模組，DRY）
# ---------------------------------------------------------------------------


def test_true_positive_detected(hook_mod):
    """真陽：真實寫壞的工具標記必須命中（3 種形態）。"""
    for name, text in hook_mod.SELF_TEST_TRUE_POSITIVES.items():
        assert hook_mod.detect(text) != "", f"真陽 fixture '{name}' 漏抓"


def test_signature_four_preserved(hook_mod):
    """signature 4（游離 token 接 invoke）必須存在且仍可攔截（禁削弱）。"""
    patterns = [p.pattern for p in hook_mod.SIGNATURE_PATTERNS]
    assert any("invoke" in p and r"\n" in p for p in patterns), (
        "signature 4（游離 token \\n <invoke）已遺失，違反 thyme F3 證偽結論"
    )
    stray = hook_mod.SELF_TEST_TRUE_POSITIVES["stray_token_invoke"]
    assert hook_mod.detect(stray) != ""


# ---------------------------------------------------------------------------
# 內嵌 self-test（W2-011.2 acceptance）
# ---------------------------------------------------------------------------


def test_self_test_function_passes(hook_mod):
    """_self_test() 應回傳空清單（所有內嵌 fixtures 通過）。"""
    failures = hook_mod._self_test()
    assert failures == [], f"_self_test 回報失敗：{failures}"


def test_self_test_cli_exit_zero():
    """--self-test 分支應 exit 0 並印通過訊息（CI 接線路徑）。"""
    result = subprocess.run(
        [sys.executable, str(HOOK_PATH), "--self-test"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"--self-test 非 0 退出：rc={result.returncode} stderr={result.stderr}"
    )
    assert "self-test 通過" in result.stdout
