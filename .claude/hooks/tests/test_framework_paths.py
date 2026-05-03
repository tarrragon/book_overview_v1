"""Unit tests for lib.framework_paths (W17-127.1)

涵蓋：
- SSOT YAML 載入（含預設類別、framework_paths、layer1_paths、exempt_paths）
- 路徑分類三情境（framework 含 / 不含 / 豁免）
- is_layer1_path 行為等價於原 LAYER1_PATTERNS 判定（substring + .md 結尾）
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# 將 .claude/hooks/ 加入 sys.path 以便 import lib.framework_paths
HOOKS_DIR = Path(__file__).resolve().parent.parent
if str(HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(HOOKS_DIR))

from lib import framework_paths  # noqa: E402


@pytest.fixture(autouse=True)
def reset_cache():
    """每個測試前後重置 cache，避免互相污染。"""
    framework_paths.reset_cache()
    yield
    framework_paths.reset_cache()


# ============================================================================
# SSOT 載入測試
# ============================================================================


class TestSSOTLoading:
    def test_categories_loaded(self):
        cats = framework_paths.get_categories()
        assert isinstance(cats, list)
        # 必含核心類別
        for required in ("rules", "pm-rules", "references", "skills", "methodologies", "agents"):
            assert required in cats, f"類別 {required} 必須在 SSOT 中"

    def test_framework_paths_loaded(self):
        paths = framework_paths.get_framework_paths()
        assert isinstance(paths, list)
        # 必含核心 framework 前綴
        for required in (
            ".claude/rules/",
            ".claude/pm-rules/",
            ".claude/references/",
            ".claude/methodologies/",
            ".claude/agents/",
            ".claude/skills/",
        ):
            assert required in paths, f"路徑 {required} 必須在 framework_paths 中"

    def test_layer1_paths_loaded(self):
        paths = framework_paths.get_layer1_paths()
        assert isinstance(paths, list)
        # 必含 Layer 1 narrower scope
        assert ".claude/rules/core/" in paths
        assert ".claude/rules/flows/" in paths


# ============================================================================
# is_framework_path 三情境
# ============================================================================


class TestIsFrameworkPath:
    def test_framework_path_included(self):
        """情境 1：路徑屬 framework 規則層 → True"""
        assert framework_paths.is_framework_path(".claude/rules/core/quality-baseline.md")
        assert framework_paths.is_framework_path(".claude/pm-rules/decision-tree.md")
        assert framework_paths.is_framework_path(".claude/references/agent-dispatch-template.md")
        assert framework_paths.is_framework_path(".claude/methodologies/wrap-decision.md")
        assert framework_paths.is_framework_path(".claude/agents/AGENT_PRELOAD.md")
        assert framework_paths.is_framework_path(".claude/skills/compositional-writing/SKILL.md")
        assert framework_paths.is_framework_path(
            ".claude/skills/compositional-writing/references/writing-prompts.md"
        )

    def test_framework_path_excluded(self):
        """情境 2：路徑非 framework 規則層 → False"""
        assert not framework_paths.is_framework_path("src/foo.py")
        assert not framework_paths.is_framework_path("docs/work-logs/v0/foo.md")
        assert not framework_paths.is_framework_path(".claude/hook-logs/x/y.log")
        assert not framework_paths.is_framework_path("")
        assert not framework_paths.is_framework_path("README.md")

    def test_framework_path_exempt(self):
        """情境 3：路徑屬 framework 但匹配豁免清單 → False"""
        # 測試檔豁免（exempt_paths 含 .claude/skills/**/tests/）
        assert not framework_paths.is_framework_path(
            ".claude/skills/ticket/tests/test_lifecycle.py"
        )
        # hooks/tests/ 豁免
        assert not framework_paths.is_framework_path(
            ".claude/hooks/tests/test_framework_paths.py"
        )


# ============================================================================
# is_layer1_path 行為等價
# ============================================================================


class TestIsLayer1Path:
    def test_layer1_md_included(self):
        """既有 LAYER1_PATTERNS substring + .md 結尾判定保留"""
        assert framework_paths.is_layer1_path(".claude/rules/core/quality-baseline.md")
        assert framework_paths.is_layer1_path(".claude/rules/flows/some-flow.md")
        assert framework_paths.is_layer1_path(
            ".claude/skills/tdd/references/portable-tdd-standard.md"
        )

    def test_layer1_non_md_excluded(self):
        """非 .md 結尾 → 即使路徑匹配仍 False（既有行為）"""
        assert not framework_paths.is_layer1_path(".claude/rules/core/some.py")
        assert not framework_paths.is_layer1_path(".claude/rules/core/")

    def test_layer1_outside_scope(self):
        """非 Layer 1 範圍 → False"""
        assert not framework_paths.is_layer1_path(".claude/pm-rules/decision-tree.md")
        assert not framework_paths.is_layer1_path(".claude/methodologies/wrap.md")
        assert not framework_paths.is_layer1_path("src/foo.py")
        assert not framework_paths.is_layer1_path("")


# ============================================================================
# Cache 行為
# ============================================================================


class TestCache:
    def test_cache_returns_consistent_results(self):
        """連續呼叫應回傳相同結果（cache 生效）"""
        first = framework_paths.get_categories()
        second = framework_paths.get_categories()
        assert first == second

    def test_reset_cache_works(self):
        """reset_cache 後仍能正常載入"""
        framework_paths.get_categories()
        framework_paths.reset_cache()
        cats = framework_paths.get_categories()
        assert "rules" in cats
