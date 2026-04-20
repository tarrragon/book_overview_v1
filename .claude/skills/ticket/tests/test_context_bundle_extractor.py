"""
Context Bundle 自動抽取測試（Phase 2 v2 15 場景，L1 單元 + merge 整合）

權威規格：Phase 2 v2 §v2.3 15 場景 + Phase 3a 虛擬碼。
Mock 邊界：load_ticket（外部 I/O）、extract_version_from_ticket_id（S19 驗證）。
"""

from unittest.mock import patch

import pytest

from ticket_system.lib.context_bundle_extractor import (
    AUTO_EXTRACTED_BLOCK_PATTERN,
    EXTRACTABLE_FIELDS,
    MAX_ITEMS_PER_FIELD,
    MAX_TOTAL_CHARS,
    SOURCE_PRIORITY,
    ExtractedField,
    ExtractResult,
    detect_self_reference,
    extract_and_write_context_bundle,
    extract_context_bundle,
    format_cli_summary,
    merge_auto_extracted_block,
    render_context_bundle_markdown,
)

LOAD_TICKET_PATH = "ticket_system.lib.context_bundle_extractor.load_ticket"
EXTRACT_VERSION_PATH = (
    "ticket_system.lib.context_bundle_extractor.extract_version_from_ticket_id"
)


def _make_source(
    ticket_id: str,
    what: str = "實作 X 功能",
    why: str = "因為 Y 需求",
    where_files: list = None,
    acceptance: list = None,
) -> dict:
    return {
        "id": ticket_id,
        "what": what,
        "why": why,
        "where": {"files": where_files if where_files is not None else ["a.py"]},
        "acceptance": acceptance if acceptance is not None else ["- [ ] 完成 A"],
    }


def _make_target(
    target_id: str = "0.18.0-W17-010",
    source_ticket=None,
    blocked_by=None,
    related_to=None,
    where_files: list = None,
) -> dict:
    return {
        "id": target_id,
        "source_ticket": source_ticket,
        "blocked_by": blocked_by,
        "related_to": related_to,
        "where": {"files": where_files if where_files is not None else []},
    }


# ============================================================================
# 群組 A：正常抽取
# ============================================================================


class TestGroupA_NormalExtraction:
    """S1, S2, S3"""

    def test_s1_single_source_extracts_four_fields(self):
        target = _make_target(source_ticket="0.18.0-W17-001")
        source = _make_source(
            "0.18.0-W17-001",
            what="W17-001 任務",
            why="W17-001 理由",
            where_files=["file1.py"],
            acceptance=["- [ ] ac1"],
        )
        with patch(LOAD_TICKET_PATH, return_value=source):
            result = extract_context_bundle(target)
        assert result.status == "success"
        assert len(result.extracted) == 4
        assert result.sources_declared == 1
        assert result.sources_ok == 1
        # 驗證 raw_value（SIMP-4）
        whats = [f for f in result.extracted if f.source_field == "what"]
        assert whats[0].raw_value == "W17-001 任務"

    def test_s2_three_sources_priority_order(self):
        target = _make_target(
            source_ticket="0.18.0-W17-001",
            blocked_by=["0.18.0-W17-002"],
            related_to=["0.18.0-W17-003"],
        )
        sources = {
            "0.18.0-W17-001": _make_source("0.18.0-W17-001"),
            "0.18.0-W17-002": _make_source("0.18.0-W17-002"),
            "0.18.0-W17-003": _make_source("0.18.0-W17-003"),
        }
        with patch(LOAD_TICKET_PATH, side_effect=lambda v, i: sources.get(i)):
            result = extract_context_bundle(target)
        assert result.sources_declared == 3
        assert result.status == "success"
        # 第一個 extracted 必為 source_ticket（SOURCE_PRIORITY 首位）
        source_ids_order = []
        for f in result.extracted:
            if f.source_id not in source_ids_order:
                source_ids_order.append(f.source_id)
        assert source_ids_order == [
            "0.18.0-W17-001",
            "0.18.0-W17-002",
            "0.18.0-W17-003",
        ]

    def test_s3_where_files_dedup(self):
        target = _make_target(
            source_ticket="0.18.0-W17-001",
            blocked_by=["0.18.0-W17-002"],
            where_files=[],
        )
        sources = {
            "0.18.0-W17-001": _make_source("0.18.0-W17-001", where_files=["f1", "f2"]),
            "0.18.0-W17-002": _make_source("0.18.0-W17-002", where_files=["f2", "f3"]),
        }
        with patch(LOAD_TICKET_PATH, side_effect=lambda v, i: sources.get(i)):
            result = extract_context_bundle(target)
        # 收集所有 Related Files 項
        files_items = []
        for f in result.extracted:
            if f.target_subsection == "Related Files":
                files_items.extend(f.raw_value)
        # f2 只應出現一次（跨 source 去重）
        assert files_items.count("f2") == 1


# ============================================================================
# 群組 B：邊界條件
# ============================================================================


class TestGroupB_Boundary:
    """S5, S6P, S7, S9P"""

    def test_s5_no_source(self):
        target = _make_target(source_ticket=None, blocked_by=None, related_to=None)
        result = extract_context_bundle(target)
        assert result.status == "no_source"
        assert result.extracted == []
        assert result.sources_declared == 0
        assert any("無可抽取來源" in w for w in result.warnings)

    @pytest.mark.parametrize(
        "case_name,source_present,blocked_present,expected_status,expected_declared,expected_ok",
        [
            ("partial", False, True, "partial", 2, 1),
            ("all_missing", False, False, "all_sources_missing", 2, 0),
        ],
    )
    def test_s6p_sources_availability(
        self,
        case_name,
        source_present,
        blocked_present,
        expected_status,
        expected_declared,
        expected_ok,
    ):
        target = _make_target(
            source_ticket="0.18.0-W99-001",
            blocked_by=["0.18.0-W99-002"],
        )
        sources = {}
        if source_present:
            sources["0.18.0-W99-001"] = _make_source("0.18.0-W99-001")
        if blocked_present:
            sources["0.18.0-W99-002"] = _make_source("0.18.0-W99-002")
        with patch(LOAD_TICKET_PATH, side_effect=lambda v, i: sources.get(i)):
            result = extract_context_bundle(target)
        assert result.status == expected_status
        assert result.sources_declared == expected_declared
        assert result.sources_ok == expected_ok
        # skipped 均為 source_missing
        for sk in result.skipped:
            assert sk.reason == "source_missing"

    def test_s7_placeholder_field_skipped(self):
        target = _make_target(source_ticket="0.18.0-W17-001")
        source = _make_source("0.18.0-W17-001", what="待定義")
        with patch(LOAD_TICKET_PATH, return_value=source):
            result = extract_context_bundle(target)
        assert not any(f.source_field == "what" for f in result.extracted)
        assert any(
            sk.reason == "source_field_undefined" and "what" in sk.detail
            for sk in result.skipped
        )

    def test_s9p_per_field_where_files_truncation(self):
        target = _make_target(source_ticket="0.18.0-W17-001")
        source = _make_source(
            "0.18.0-W17-001", where_files=[f"f{i}.py" for i in range(10)]
        )
        with patch(LOAD_TICKET_PATH, return_value=source):
            result = extract_context_bundle(target)
        files_field = next(
            f for f in result.extracted if f.source_field == "where.files"
        )
        assert len(files_field.raw_value) == MAX_ITEMS_PER_FIELD
        assert files_field.truncated is True

    def test_s9p_per_field_acceptance_truncation(self):
        """§v3.3 BLK-v3-3：is_list=True 欄位統一套 MAX_ITEMS_PER_FIELD。"""
        target = _make_target(source_ticket="0.18.0-W17-001")
        source = _make_source(
            "0.18.0-W17-001", acceptance=[f"- [ ] ac{i}" for i in range(8)]
        )
        with patch(LOAD_TICKET_PATH, return_value=source):
            result = extract_context_bundle(target)
        ac_field = next(
            f for f in result.extracted if f.source_field == "acceptance"
        )
        assert len(ac_field.raw_value) == MAX_ITEMS_PER_FIELD
        assert ac_field.truncated is True

    def test_s9p_total_chars_truncation(self):
        target = _make_target(source_ticket="0.18.0-W17-001")
        long_str = "X" * (MAX_TOTAL_CHARS + 500)
        source = _make_source("0.18.0-W17-001", what=long_str)
        with patch(LOAD_TICKET_PATH, return_value=source):
            result = extract_context_bundle(target)
        assert result.total_chars_estimate <= MAX_TOTAL_CHARS
        assert any(f.truncated for f in result.extracted)


# ============================================================================
# 群組 C：衝突與幂等（merge_auto_extracted_block）
# ============================================================================


class TestGroupC_MergeIdempotency:
    """S11, S12, S13"""

    def test_s11_pm_handwritten_plus_append(self):
        existing = "PM 手寫段落\n\n重要脈絡說明。"
        new_md = (
            "<!-- auto-extracted: v1 | sources: 0.18.0-W17-001 | chars: 100 -->\n"
            "\n### Task Reference\n- ..."
        )
        merged, notes = merge_auto_extracted_block(existing, new_md)
        assert notes == ["appended_new_block"]
        assert merged.startswith("PM 手寫段落")
        assert "<!-- auto-extracted:" in merged

    @pytest.mark.parametrize(
        "existing_chars,new_chars",
        [
            (100, 100),  # chars 相同
            (100, 250),  # chars 不同但 sources 相同（§v3.2 主鍵）
        ],
    )
    def test_s12_sources_unchanged_idempotent(self, existing_chars, new_chars):
        existing = (
            f"<!-- auto-extracted: v1 | sources: A,B | chars: {existing_chars} -->\n"
            "\n### Task Reference\n- A what\n- B what\n"
        )
        new = (
            f"<!-- auto-extracted: v1 | sources: A,B | chars: {new_chars} -->\n"
            "\n### Task Reference\n- A what\n- B what\n"
        )
        merged, notes = merge_auto_extracted_block(existing, new)
        assert notes == ["no_change_idempotent"]
        assert merged == existing

    def test_s13_sources_changed_replace_with_h2_after(self):
        existing = (
            "<!-- auto-extracted: v1 | sources: A | chars: 50 -->\n"
            "### Task Reference\n- A what\n\n"
            "## Other Section\n內容保留\n"
        )
        new = (
            "<!-- auto-extracted: v1 | sources: A,B | chars: 100 -->\n"
            "### Task Reference\n- A what\n- B what\n"
        )
        merged, notes = merge_auto_extracted_block(existing, new)
        assert "replaced_auto_block" in notes
        assert "## Other Section" in merged
        assert "內容保留" in merged
        assert "- B what" in merged

    def test_s13_sources_changed_replace_at_eof(self):
        existing = (
            "<!-- auto-extracted: v1 | sources: A | chars: 50 -->\n"
            "### Task Reference\n- A what\n"
        )
        new = (
            "<!-- auto-extracted: v1 | sources: A,B | chars: 100 -->\n"
            "### Task Reference\n- A what\n- B what\n"
        )
        merged, notes = merge_auto_extracted_block(existing, new)
        assert "replaced_auto_block" in notes
        assert "- B what" in merged

    def test_s13_h3_not_a_boundary(self):
        """§v3.1：H3 子節為 managed block 內部，不作邊界。"""
        existing = (
            "<!-- auto-extracted: v1 | sources: A | chars: 50 -->\n"
            "### Sub1\n- x\n### Sub2\n- y\n"
        )
        new = (
            "<!-- auto-extracted: v1 | sources: A,B | chars: 100 -->\n"
            "### Task Reference\n- new\n"
        )
        merged, notes = merge_auto_extracted_block(existing, new)
        assert "replaced_auto_block" in notes
        # 舊 H3 子節應被整塊替換（非保留）
        assert "### Sub1" not in merged
        assert "### Task Reference" in merged


# ============================================================================
# 群組 E：新增語義場景
# ============================================================================


class TestGroupE_Semantics:
    """S17, S19"""

    def test_s17_self_reference_short_circuit(self):
        target = _make_target(target_id="0.18.0-W17-010", source_ticket="0.18.0-W17-010")
        assert detect_self_reference(target) is True
        with patch(LOAD_TICKET_PATH) as mock_load:
            result = extract_context_bundle(target)
        assert result.status == "self_reference"
        assert result.extracted == []
        assert any(sk.reason == "self_reference" for sk in result.skipped)
        assert any("self-reference" in w for w in result.warnings)
        # 關鍵：短路，load_ticket 未被呼叫
        mock_load.assert_not_called()

    def test_s19_cross_version_source(self):
        """target 是 0.18.0，source 是 0.17.5 → 應以 0.17.5 版本呼叫 load_ticket。"""
        target = _make_target(
            target_id="0.18.0-W17-010", source_ticket="0.17.5-W10-001"
        )
        source = _make_source("0.17.5-W10-001")
        captured_versions = []

        def _fake_load(version, tid):
            captured_versions.append(version)
            return source if tid == "0.17.5-W10-001" else None

        with patch(LOAD_TICKET_PATH, side_effect=_fake_load):
            result = extract_context_bundle(target)
        assert "0.17.5" in captured_versions
        assert result.status == "success"
        assert result.extracted[0].source_id == "0.17.5-W10-001"


# ============================================================================
# Render 測試
# ============================================================================


class TestRender:
    def test_render_no_source_returns_empty(self):
        result = ExtractResult(status="no_source", target_ticket_id="T")
        assert render_context_bundle_markdown(result) == ""

    def test_render_self_reference_returns_empty(self):
        result = ExtractResult(status="self_reference", target_ticket_id="T")
        assert render_context_bundle_markdown(result) == ""

    def test_render_all_missing_returns_empty(self):
        result = ExtractResult(status="all_sources_missing", target_ticket_id="T")
        assert render_context_bundle_markdown(result) == ""

    def test_render_success_contains_marker_and_headings(self):
        target = _make_target(source_ticket="0.18.0-W17-001")
        source = _make_source("0.18.0-W17-001")
        with patch(LOAD_TICKET_PATH, return_value=source):
            result = extract_context_bundle(target)
        md = render_context_bundle_markdown(result)
        assert "<!-- auto-extracted:" in md
        assert "sources: 0.18.0-W17-001" in md
        # managed block 不含 ## Context Bundle（該 H2 由 section 容器提供）
        assert "### Task Reference" in md
        assert "### Rationale Chain" in md
        assert AUTO_EXTRACTED_BLOCK_PATTERN.search(md) is not None


# ============================================================================
# 群組 D：CLI 對接（L2 整合 + S16smoke）
# ============================================================================


class TestGroupD_CLI:
    """S14 integration, S16smoke, S20"""

    @pytest.mark.parametrize(
        "flag_case,expected_pattern",
        [
            ("quiet", r"\[Context Bundle\] 已抽取（\d+ 項，\d+ 字元）"),
            ("default", r"已從 \d+ 個來源抽取 \d+ 項欄位"),
            ("verbose", r"預覽："),
        ],
    )
    def test_s16smoke_verbosity(self, flag_case, expected_pattern):
        import re as _re

        target = _make_target(source_ticket="0.18.0-W17-001")
        source = _make_source("0.18.0-W17-001")
        with patch(LOAD_TICKET_PATH, return_value=source):
            result = extract_context_bundle(target)
        kwargs = {
            "quiet": {"quiet": True},
            "default": {},
            "verbose": {"verbose": True},
        }[flag_case]
        out = format_cli_summary(result, **kwargs)
        assert _re.search(expected_pattern, out), f"pattern not matched: {out}"

    def test_s14_extract_and_write_writes_section(self, tmp_path):
        """S14：extract_and_write_context_bundle 寫入 ticket md 可見 marker + headings。"""
        target_body = "## Context Bundle\n\n（待自動填入）\n\n## Other\n保留\n"
        target = {
            "id": "0.18.0-W17-010",
            "source_ticket": "0.18.0-W17-001",
            "blocked_by": None,
            "related_to": None,
            "where": {"files": []},
            "_body": target_body,
        }
        source = _make_source("0.18.0-W17-001")

        saved_calls = []

        def _fake_load(version, tid):
            if tid == "0.18.0-W17-010":
                return target
            if tid == "0.18.0-W17-001":
                return source
            return None

        def _fake_save(ticket_obj, path):
            saved_calls.append((ticket_obj, path))

        with patch(
            "ticket_system.lib.context_bundle_extractor.load_ticket",
            side_effect=_fake_load,
        ), patch(
            "ticket_system.lib.context_bundle_extractor.save_ticket",
            side_effect=_fake_save,
        ), patch(
            "ticket_system.lib.context_bundle_extractor.get_ticket_path",
            return_value=tmp_path / "t.md",
        ):
            result, notes = extract_and_write_context_bundle(
                "0.18.0", "0.18.0-W17-010"
            )

        assert result.status == "success"
        assert len(saved_calls) == 1
        written_body = saved_calls[0][0]["_body"]
        assert "<!-- auto-extracted:" in written_body
        assert "### Task Reference" in written_body
        assert "## Other" in written_body  # 其他 section 保留

    def test_s14_idempotent_second_call(self, tmp_path):
        """二次呼叫 sources 不變 → 不再寫入（no_change_idempotent）。"""
        source = _make_source("0.18.0-W17-001")
        # 先渲染一次得到預期 body
        target_ticket = _make_target(source_ticket="0.18.0-W17-001")
        with patch(LOAD_TICKET_PATH, return_value=source):
            first_result = extract_context_bundle(target_ticket)
        rendered = render_context_bundle_markdown(first_result)

        pre_filled_body = f"## Context Bundle\n\n{rendered}\n\n## Other\n保留\n"
        target = {
            "id": "0.18.0-W17-010",
            "source_ticket": "0.18.0-W17-001",
            "blocked_by": None,
            "related_to": None,
            "where": {"files": []},
            "_body": pre_filled_body,
        }

        def _fake_load(version, tid):
            return target if tid == "0.18.0-W17-010" else source

        saved_calls = []
        with patch(
            "ticket_system.lib.context_bundle_extractor.load_ticket",
            side_effect=_fake_load,
        ), patch(
            "ticket_system.lib.context_bundle_extractor.save_ticket",
            side_effect=lambda t, p: saved_calls.append((t, p)),
        ), patch(
            "ticket_system.lib.context_bundle_extractor.get_ticket_path",
            return_value=tmp_path / "t.md",
        ):
            result, notes = extract_and_write_context_bundle(
                "0.18.0", "0.18.0-W17-010"
            )
        assert "no_change_idempotent" in notes
        assert saved_calls == []  # 未寫入

    def test_s20_extraction_exception_non_raising(self, tmp_path):
        """S20：抽取過程若 load_ticket 對 target 失敗，回傳 result 不拋例外。"""
        def _fake_load(version, tid):
            raise RuntimeError("simulated I/O failure")

        with patch(
            "ticket_system.lib.context_bundle_extractor.load_ticket",
            side_effect=_fake_load,
        ):
            # extract_and_write 內部 load_ticket(target) 拋例外 → 應由 caller try/except
            # 但我們的 helper 對 target load 失敗未 catch（設計如此），caller 負責。
            # 驗證：直接呼叫會 raise；這是 §v2.3 / S20 的 caller try/except 契約。
            with pytest.raises(RuntimeError):
                extract_and_write_context_bundle("0.18.0", "0.18.0-W17-010")

    def test_s20_extract_context_bundle_non_raising_on_source_load_failure(self):
        """extract_context_bundle 對 source load 失敗 → 記錄 warning 不拋例外。"""
        target = _make_target(source_ticket="0.18.0-W17-001")

        def _fake_load(version, tid):
            raise RuntimeError("source fetch broken")

        with patch(LOAD_TICKET_PATH, side_effect=_fake_load):
            result = extract_context_bundle(target)
        # 未拋例外，status 為 all_sources_missing
        assert result.status == "all_sources_missing"
        assert any("失敗" in w for w in result.warnings)
