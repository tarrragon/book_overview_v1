"""
Context Bundle 自動抽取模組

從 target ticket 的 source_ticket / blocked_by / related_to 欄位
自動抽取相關來源 ticket 的 what / why / where.files / acceptance，
渲染為 Context Bundle markdown，並支援幂等合併。

Linux kernel ELF loader 類比：自動載入依賴 context，降低 PM 手填成本。

權威規格：
- Phase 1 v2 §v2.0-§v2.7 + v3 §v3.1-§v3.5
- Phase 2 v2 15 場景（sage-test-architect）
- Phase 3a 策略（pepper-test-implementer）
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Literal, Optional, Tuple

from ..constants import DEFAULT_UNDEFINED_VALUE
from .parser import load_ticket, save_ticket
from .paths import get_ticket_path
from .ticket_validator import extract_version_from_ticket_id


# ============================================================================
# 常數區（§v2.1 BLK-2：內嵌常數，非 YAML 外部化）
# ============================================================================

SourceKind = Literal["source_ticket", "blocked_by", "related_to"]

SOURCE_PRIORITY: Tuple[SourceKind, ...] = ("source_ticket", "blocked_by", "related_to")

# 規模限制（MAX_TOTAL_CHARS rationale 於 W17-002.1 追蹤）
MAX_TOTAL_CHARS: int = 2000
MAX_ITEMS_PER_FIELD: int = 5
TRUNCATE_INDICATOR: str = "... (truncated, see source ticket)"

# 幂等標記
AUTO_MARKER_PREFIX: str = "<!-- auto-extracted:"
AUTO_EXTRACTED_BLOCK_PATTERN = re.compile(
    r"<!--\s*auto-extracted:[^>]*-->.*?(?=^## |\Z)",
    flags=re.MULTILINE | re.DOTALL,
)

ExtractStatus = Literal[
    "no_source",
    "all_sources_missing",
    "partial",
    "success",
    "self_reference",
]

SkipReason = Literal[
    "source_missing",
    "source_field_undefined",
    "self_reference",
]


# ============================================================================
# Dataclass 區（§v2.2 SIMP-4：ExtractedField 儲存 raw_value）
# ============================================================================


@dataclass(frozen=True)
class ExtractableFieldRule:
    """單一欄位抽取規則。

    is_list=True → 套用 MAX_ITEMS_PER_FIELD（§v3.3 BLK-v3-3 統一套用）。
    """

    source_field: str
    target_subsection: str
    format_template: str
    is_list: bool = False
    dedup: bool = False


EXTRACTABLE_FIELDS: Tuple[ExtractableFieldRule, ...] = (
    ExtractableFieldRule(
        source_field="what",
        target_subsection="Task Reference",
        format_template="- {source_id} what: {value}",
    ),
    ExtractableFieldRule(
        source_field="why",
        target_subsection="Rationale Chain",
        format_template="- {source_id} why: {value}",
    ),
    ExtractableFieldRule(
        source_field="where.files",
        target_subsection="Related Files",
        format_template="- {value}  # from {source_id}",
        is_list=True,
        dedup=True,
    ),
    ExtractableFieldRule(
        source_field="acceptance",
        target_subsection="Source Acceptance (reference)",
        format_template="- [ref] {value}  # from {source_id}",
        is_list=True,
    ),
)


@dataclass
class ExtractedField:
    source_id: str
    source_kind: SourceKind
    source_field: str
    target_subsection: str
    raw_value: Any  # str | list[str]
    truncated: bool = False


@dataclass
class SkipRecord:
    source_id: str
    source_kind: SourceKind
    reason: SkipReason
    detail: str = ""


@dataclass
class ExtractResult:
    status: ExtractStatus
    target_ticket_id: str
    extracted: list = field(default_factory=list)
    skipped: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    sources_declared: int = 0
    sources_ok: int = 0
    total_chars_estimate: int = 0


# ============================================================================
# 內部 helper
# ============================================================================


def _read_nested(ticket: dict, dotted_field: str) -> Any:
    """支援 where.files 等巢狀欄位讀取。"""
    parts = dotted_field.split(".")
    cur: Any = ticket
    for p in parts:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur


def _is_placeholder(value: Any) -> bool:
    """偵測 DEFAULT_UNDEFINED_VALUE / None / 空 list。"""
    if value is None:
        return True
    if isinstance(value, str):
        return value == DEFAULT_UNDEFINED_VALUE or value.strip() == ""
    if isinstance(value, list):
        return len(value) == 0
    return False


def _collect_source_ids(target: dict) -> list:
    """依 SOURCE_PRIORITY + YAML 出現順序收集 (source_id, source_kind)。"""
    collected: list = []
    for kind in SOURCE_PRIORITY:
        v = target.get(kind)
        if v is None:
            continue
        if isinstance(v, str):
            if v.strip():
                collected.append((v, kind))
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, str) and item.strip():
                    collected.append((item, kind))
    return collected


def _dedup_items(items: list, seen: set) -> list:
    """與 seen set 合併去重，保留順序；副作用：更新 seen。"""
    result = []
    for x in items:
        if x not in seen:
            seen.add(x)
            result.append(x)
    return result


def _build_target_seen(target: dict, subsection: str) -> set:
    """初始化去重 seen set：僅 Related Files 納入 target.where.files。"""
    seen: set = set()
    if subsection == "Related Files":
        target_files = _read_nested(target, "where.files") or []
        if isinstance(target_files, list):
            for x in target_files:
                if isinstance(x, str):
                    seen.add(x)
    return seen


def _estimate_chars(extracted: list) -> int:
    total = 0
    for f in extracted:
        if isinstance(f.raw_value, list):
            total += sum(len(str(x)) for x in f.raw_value)
        else:
            total += len(str(f.raw_value))
    return total


def _apply_total_chars_limit(result: ExtractResult) -> None:
    """§S9 決策：raw 階段累計並截斷末端 ExtractedField。"""
    running = 0
    truncated_at: Optional[int] = None
    for idx, f in enumerate(result.extracted):
        item_chars = (
            sum(len(str(x)) for x in f.raw_value)
            if isinstance(f.raw_value, list)
            else len(str(f.raw_value))
        )
        running += item_chars
        if running > MAX_TOTAL_CHARS:
            truncated_at = idx
            break
    if truncated_at is not None:
        # 保留到 truncated_at-1，並將當前項標 truncated 或刪除多餘項
        kept = result.extracted[:truncated_at]
        overflow = result.extracted[truncated_at]
        # 嘗試縮短末端項
        if isinstance(overflow.raw_value, list) and len(overflow.raw_value) > 1:
            overflow.raw_value = overflow.raw_value[: max(1, len(overflow.raw_value) // 2)]
        elif isinstance(overflow.raw_value, str):
            remain = MAX_TOTAL_CHARS - sum(
                len(str(x)) if not isinstance(x.raw_value, list)
                else sum(len(str(y)) for y in x.raw_value)
                for x in kept
            )
            if remain > 0:
                overflow.raw_value = overflow.raw_value[: remain]
            else:
                overflow.raw_value = ""
        overflow.truncated = True
        kept.append(overflow)
        # 丟棄後續
        result.extracted = kept
        result.warnings.append(
            f"抽取結果超過 MAX_TOTAL_CHARS={MAX_TOTAL_CHARS}，已截斷；{TRUNCATE_INDICATOR}"
        )
    result.total_chars_estimate = _estimate_chars(result.extracted)


# ============================================================================
# 公開函式 1：detect_self_reference（BLK-5）
# ============================================================================


def detect_self_reference(target_ticket: dict) -> bool:
    """檢查任一 source_ticket/blocked_by/related_to id 是否等於 target id。"""
    target_id = target_ticket.get("id")
    if not target_id:
        return False
    for kind in SOURCE_PRIORITY:
        v = target_ticket.get(kind)
        if v is None:
            continue
        ids = [v] if isinstance(v, str) else list(v) if isinstance(v, list) else []
        if target_id in ids:
            return True
    return False


# ============================================================================
# 公開函式 2：extract_context_bundle（主入口，non-raising）
# ============================================================================


def extract_context_bundle(target_ticket: dict) -> ExtractResult:
    """核心抽取函式。Non-raising：異常收集至 warnings/skipped。"""
    target_id = target_ticket.get("id", "")
    result = ExtractResult(status="no_source", target_ticket_id=target_id)

    # Self-reference 短路（S17）
    if detect_self_reference(target_ticket):
        result.status = "self_reference"
        result.skipped.append(
            SkipRecord(
                source_id=target_id,
                source_kind="source_ticket",
                reason="self_reference",
                detail="",
            )
        )
        result.warnings.append(f"偵測 self-reference：{target_id}，停止抽取")
        return result

    source_list = _collect_source_ids(target_ticket)
    result.sources_declared = len(source_list)
    if not source_list:
        result.warnings.append("本 ticket 無可抽取來源")
        return result

    # 跨 source 共享的 seen sets（按 target_subsection key）
    dedup_seen: dict = {}

    for src_id, src_kind in source_list:
        try:
            version = extract_version_from_ticket_id(src_id)
        except Exception as exc:
            result.skipped.append(
                SkipRecord(
                    source_id=src_id,
                    source_kind=src_kind,
                    reason="source_missing",
                    detail=f"version parse failed: {exc}",
                )
            )
            result.warnings.append(f"source {src_id} 版本號解析失敗，略過")
            continue

        if not version:
            result.skipped.append(
                SkipRecord(
                    source_id=src_id,
                    source_kind=src_kind,
                    reason="source_missing",
                    detail="version=None",
                )
            )
            result.warnings.append(f"source {src_id} 版本號缺失，略過")
            continue

        try:
            source = load_ticket(version, src_id)
        except Exception as exc:
            source = None
            result.warnings.append(f"load_ticket({src_id}) 失敗：{exc}")

        if source is None:
            result.skipped.append(
                SkipRecord(
                    source_id=src_id,
                    source_kind=src_kind,
                    reason="source_missing",
                    detail=f"version={version}",
                )
            )
            result.warnings.append(f"source {src_id} 不存在於 {version}，略過")
            continue

        result.sources_ok += 1
        for rule in EXTRACTABLE_FIELDS:
            raw = _read_nested(source, rule.source_field)
            if _is_placeholder(raw):
                result.skipped.append(
                    SkipRecord(
                        source_id=src_id,
                        source_kind=src_kind,
                        reason="source_field_undefined",
                        detail=rule.source_field,
                    )
                )
                continue
            if rule.is_list:
                items = [str(x) for x in raw] if isinstance(raw, list) else [str(raw)]
                if rule.dedup:
                    if rule.target_subsection not in dedup_seen:
                        dedup_seen[rule.target_subsection] = _build_target_seen(
                            target_ticket, rule.target_subsection
                        )
                    items = _dedup_items(items, dedup_seen[rule.target_subsection])
                truncated = False
                if len(items) > MAX_ITEMS_PER_FIELD:
                    total_items = len(items)
                    items = items[:MAX_ITEMS_PER_FIELD]
                    truncated = True
                    result.warnings.append(
                        f"source {src_id} 的 {rule.source_field} 共 {total_items} 項，"
                        f"已截斷保留前 {MAX_ITEMS_PER_FIELD} 項"
                    )
                if not items:
                    # 去重後為空（dedup 情況）
                    continue
                result.extracted.append(
                    ExtractedField(
                        source_id=src_id,
                        source_kind=src_kind,
                        source_field=rule.source_field,
                        target_subsection=rule.target_subsection,
                        raw_value=items,
                        truncated=truncated,
                    )
                )
            else:
                result.extracted.append(
                    ExtractedField(
                        source_id=src_id,
                        source_kind=src_kind,
                        source_field=rule.source_field,
                        target_subsection=rule.target_subsection,
                        raw_value=raw,
                        truncated=False,
                    )
                )

    _apply_total_chars_limit(result)

    if result.sources_ok == 0:
        result.status = "all_sources_missing"
        result.warnings.append("所有宣告來源皆不存在")
    elif result.sources_ok < result.sources_declared:
        result.status = "partial"
    else:
        result.status = "success"
    return result


# ============================================================================
# 公開函式 3：render_context_bundle_markdown
# ============================================================================


def render_context_bundle_markdown(result: ExtractResult) -> str:
    """渲染 ExtractResult 為 markdown。

    status in (no_source, self_reference, all_sources_missing) → 回傳空字串（§v2.3 不寫入）。
    """
    if result.status in ("no_source", "self_reference", "all_sources_missing"):
        return ""

    sources_sorted = sorted({f.source_id for f in result.extracted})
    header = (
        f"<!-- auto-extracted: v1 | sources: {','.join(sources_sorted)} | "
        f"chars: {result.total_chars_estimate} -->"
    )
    # 注意：不輸出 `## Context Bundle` header，因為該 header 由 section 容器提供；
    # managed block 從 marker 到下個 H2（或 EOF），H3 子節為內部結構。
    lines = [header, ""]
    for rule in EXTRACTABLE_FIELDS:
        fields = [f for f in result.extracted if f.target_subsection == rule.target_subsection]
        if not fields:
            continue
        lines.append(f"### {rule.target_subsection}")
        for f in fields:
            if rule.is_list:
                for item in f.raw_value:
                    lines.append(
                        rule.format_template.format(source_id=f.source_id, value=item)
                    )
            else:
                lines.append(
                    rule.format_template.format(source_id=f.source_id, value=f.raw_value)
                )
            if f.truncated:
                lines.append(f"  {TRUNCATE_INDICATOR}")
        lines.append("")
    return "\n".join(lines)


# ============================================================================
# 公開函式 4：merge_auto_extracted_block（§v3.1/§v3.2）
# ============================================================================


def _parse_sources_from_marker(marker_block: str) -> list:
    """從 `<!-- auto-extracted: v1 | sources: A,B | chars: N -->` 解析 sources。"""
    match = re.search(r"sources:\s*([^|>]*)", marker_block)
    if not match:
        return []
    raw = match.group(1).strip()
    # 移除尾端 | 或 -->
    raw = raw.rstrip("-").rstrip(">").rstrip("|").strip()
    return [s.strip() for s in raw.split(",") if s.strip()]


def merge_auto_extracted_block(
    existing_section_body: str, new_extracted_markdown: str
) -> Tuple[str, list]:
    """合併抽取結果到既有 Context Bundle section body。

    §v3.1 regex EOF 邊界 + §v3.2 sources 主鍵幂等。
    """
    if not new_extracted_markdown:
        return existing_section_body, ["no_change_empty_new"]

    match = AUTO_EXTRACTED_BLOCK_PATTERN.search(existing_section_body or "")
    if match is None:
        sep = ""
        if existing_section_body and not existing_section_body.endswith("\n\n"):
            sep = "\n\n" if existing_section_body.endswith("\n") else "\n\n"
        merged = (existing_section_body or "") + sep + new_extracted_markdown
        return merged, ["appended_new_block"]

    existing_sources = _parse_sources_from_marker(match.group(0))
    new_match = AUTO_EXTRACTED_BLOCK_PATTERN.search(new_extracted_markdown)
    new_sources = (
        _parse_sources_from_marker(new_match.group(0)) if new_match else []
    )

    if sorted(existing_sources) == sorted(new_sources):
        return existing_section_body, ["no_change_idempotent"]

    merged = (
        existing_section_body[: match.start()]
        + new_extracted_markdown
        + existing_section_body[match.end() :]
    )
    notes = ["replaced_auto_block"]
    if AUTO_EXTRACTED_BLOCK_PATTERN.search(existing_section_body, match.end()):
        notes.append("warning: multiple auto-extracted markers detected")
    return merged, notes


# ============================================================================
# 程式化入口：extract_and_write（CLI create/track claim 呼叫點）
# ============================================================================


CONTEXT_BUNDLE_SECTION_HEADING = "## Context Bundle"


def _replace_section_body(body: str, section_heading: str, new_body_content: str) -> str:
    """在 ticket body 中替換指定 section 的內容。

    若找不到 section → 於 body 尾端附加新 section。
    若找到 → 替換 heading 後到下個 `^## ` 或 EOF 前的內容。
    """
    pattern = re.compile(
        rf"({re.escape(section_heading)}\s*\n)(.*?)(?=^## |\Z)",
        flags=re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(body)
    if match is None:
        sep = "\n\n" if body and not body.endswith("\n\n") else ""
        return body + sep + section_heading + "\n\n" + new_body_content + "\n"
    return (
        body[: match.start()]
        + match.group(1)
        + new_body_content
        + "\n"
        + body[match.end():]
    )


def _read_section_body(body: str, section_heading: str) -> str:
    pattern = re.compile(
        rf"{re.escape(section_heading)}\s*\n(.*?)(?=^## |\Z)",
        flags=re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(body)
    return match.group(1) if match else ""


def format_cli_summary(
    result: ExtractResult, quiet: bool = False, verbose: bool = False
) -> str:
    """S16smoke：依 quiet/verbose 三檔輸出抽取摘要。

    - quiet：單行 `[Context Bundle] 已抽取（N 項，M 字元）`
    - 預設：多行，含來源清單與欄位數
    - verbose：預設 + 每欄位前 80 字元預覽
    """
    n_fields = len(result.extracted)
    n_chars = result.total_chars_estimate
    if quiet:
        return f"[Context Bundle] 已抽取（{n_fields} 項，{n_chars} 字元）"

    if result.status == "no_source":
        return (
            "[Context Bundle] 未執行自動抽取：\n"
            "  原因：本 ticket 無 source_ticket/blocked_by/related_to 欄位"
        )
    if result.status == "self_reference":
        return (
            f"[Context Bundle] 偵測 self-reference，已略過抽取：\n"
            f"  原因：本 ticket id {result.target_ticket_id} 出現在自己的來源欄位"
        )
    if result.status == "all_sources_missing":
        detail = "\n".join(
            f"  - {sk.source_kind}={sk.source_id}：{sk.detail or '檔案不存在'}"
            for sk in result.skipped
        )
        return (
            "[Context Bundle] 所有宣告來源皆不存在：\n"
            f"{detail}\n"
            "  建議：確認 source id 拼寫或版本號正確"
        )

    # success / partial
    source_ids = sorted({f.source_id for f in result.extracted})
    lines = [
        f"[Context Bundle] 已從 {len(source_ids)} 個來源抽取 {n_fields} 項欄位：",
    ]
    for sid in source_ids:
        fields_for_sid = [f.source_field for f in result.extracted if f.source_id == sid]
        kind = next(
            (f.source_kind for f in result.extracted if f.source_id == sid),
            "source",
        )
        lines.append(f"  - {kind}={sid}（抽取 {'/'.join(fields_for_sid)}）")
    lines.append(f"  寫入位置：Context Bundle section（共 {n_chars} 字元）")
    if verbose:
        lines.append("  預覽：")
        for f in result.extracted:
            raw_str = (
                ", ".join(str(x) for x in f.raw_value)
                if isinstance(f.raw_value, list)
                else str(f.raw_value)
            )
            preview = raw_str[:80]
            lines.append(f"    {f.source_id} {f.source_field}: {preview}")
    return "\n".join(lines)


def extract_and_write_context_bundle(
    version: str, ticket_id: str
) -> Tuple[ExtractResult, list]:
    """程式化入口：讀 target ticket → extract → render → merge → 寫回。

    Returns:
        (result, notes) 其中 notes 為 merge_auto_extracted_block 回傳 notes。

    Non-raising：所有錯誤收集至 result.warnings；caller 應在 try/except 中呼叫
    以涵蓋未預期例外（§S20）。
    """
    target = load_ticket(version, ticket_id)
    if target is None:
        result = ExtractResult(status="no_source", target_ticket_id=ticket_id)
        result.warnings.append(f"target ticket {ticket_id} 不存在")
        return result, []

    result = extract_context_bundle(target)
    rendered = render_context_bundle_markdown(result)
    notes: list = []
    if not rendered:
        return result, notes

    body = target.get("_body", "") or ""
    existing_section = _read_section_body(body, CONTEXT_BUNDLE_SECTION_HEADING)
    merged_section, notes = merge_auto_extracted_block(existing_section, rendered)
    if "no_change_idempotent" in notes:
        return result, notes

    new_body = _replace_section_body(
        body, CONTEXT_BUNDLE_SECTION_HEADING, merged_section
    )
    target["_body"] = new_body
    ticket_path = get_ticket_path(version, ticket_id)
    save_ticket(target, ticket_path)
    return result, notes
