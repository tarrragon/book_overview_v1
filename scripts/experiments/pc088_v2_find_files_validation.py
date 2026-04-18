#!/usr/bin/env python3
"""PC-088 v2 find_files Sub-class Validation (W15-015).

Path A (enhanced retrospective) analysis. Rationale:

- E3 (W15-014) showed find_files long_path_rate = 0.412 (n=136), materially > 0.3.
- 1157 observations already exist; a second pass with stratification costs 0 sessions
  and avoids the rule-loading contamination risk inherent in any prospective A/B that
  reuses the same .claude/ ruleset.
- Goal: distinguish between (a) true heuristic bias toward bash find/ls even when Glob
  would suffice vs (b) correlated artifacts (e.g. piped search, recursive listing as
  exploratory probe where Glob is not equivalent).

Stratification axes:

1. Sub-pattern of long-path command:
     - `find ... -name PATTERN`   (Glob is a direct substitute)
     - `find . -name PATTERN ...` (Glob substitute, maybe piped)
     - `ls -R` / `ls -lR`         (exploratory listing; Glob NOT fully equivalent)
     - `ls DIR`                   (simple directory listing; not really a "find file" task)
2. Piped post-processing (`| grep`, `| head`, `| wc`, etc.)
3. Glob availability check:
     - Whether the long-path pattern COULD be replaced by a single Glob call.
     - Heuristic: `find ... -name 'X'` or `find ... -iname 'X'` with no `-exec`, no
       `-mtime`, no `-size` predicates → substitutable.
     - `ls -R` / `ls -lR` → substitutable (Glob with `**/*`).
     - `ls DIR` (non-recursive) → NOT classified as find_files task (filter out).
4. Session-level: whether the assistant EVER used Glob in the same session.
     - Mixed users (Glob + find both present) suggest situational choice, not pure bias.
     - Pure-find users suggest stronger habit/bias.

Output: docs/experiments/PC-088-v2-find-files-validation.md
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

TRANSCRIPT_DIR = Path.home() / ".claude/projects/-Users-tarragon-Projects-book-overview-v1"
REPORT_PATH = Path("docs/experiments/PC-088-v2-find-files-validation.md")
DEFAULT_SESSION_LIMIT = 50

# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

# Long-path sub-patterns for find_files
RE_FIND_NAME = re.compile(r"\bfind\s+\S+\s+-i?name\s+")
RE_FIND_HAS_EXEC = re.compile(r"\bfind\s+.*-(?:exec|mtime|size|newer|type\s+[^fd])")
RE_LS_RECURSIVE = re.compile(r"\bls\s+-[a-zA-Z]*R")
RE_LS_SIMPLE = re.compile(r"^\s*ls\s+(?!-[a-zA-Z]*R)(?:-[a-zA-Z]+\s+)?\S")

PIPE_POST = re.compile(r"\|\s*(grep|head|tail|wc|awk|sort|xargs)\b")


@dataclass
class LongObs:
    session: str
    command: str
    subclass: str        # find_name / ls_recursive / ls_simple / other
    substitutable: bool  # True if Glob can replace it with a single call
    has_pipe: bool
    has_exec_or_filter: bool


@dataclass
class SessionProfile:
    session: str
    glob_count: int = 0
    long_find_count: int = 0
    long_ls_r_count: int = 0
    long_ls_simple_count: int = 0


def classify_find_files_long(cmd: str) -> tuple[str, bool, bool, bool] | None:
    """Return (subclass, substitutable, has_pipe, has_exec_or_filter) or None if not a find_files long-path."""
    c = cmd.strip()
    if not c:
        return None
    pipe = bool(PIPE_POST.search(c))
    if RE_FIND_NAME.search(c):
        has_filter = bool(RE_FIND_HAS_EXEC.search(c))
        # Substitutable if it's a pure -name/-iname pattern without exec/filter predicates
        substitutable = not has_filter
        return ("find_name", substitutable, pipe, has_filter)
    if RE_LS_RECURSIVE.search(c):
        # ls -R is Glob-substitutable (Glob "**/*")
        return ("ls_recursive", True, pipe, False)
    if RE_LS_SIMPLE.match(c):
        # Simple `ls DIR` is not a "find file by pattern" task — exclude from sample
        return ("ls_simple", False, pipe, False)
    return None


def iter_tool_uses(session_file: Path) -> Iterable[tuple[str, dict]]:
    with session_file.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("type") != "assistant":
                continue
            msg = entry.get("message")
            if not isinstance(msg, dict):
                continue
            content = msg.get("content")
            if not isinstance(content, list):
                continue
            for item in content:
                if isinstance(item, dict) and item.get("type") == "tool_use":
                    yield item.get("name", ""), item.get("input", {}) or {}


def scan(session_files: list[Path]) -> tuple[list[LongObs], dict[str, SessionProfile], int]:
    """Return (long observations in find_files scope, session profiles, total_glob_calls)."""
    long_obs: list[LongObs] = []
    profiles: dict[str, SessionProfile] = {}
    total_glob = 0

    for sf in session_files:
        sid = sf.stem
        profiles[sid] = SessionProfile(session=sid)
        for tool_name, tinput in iter_tool_uses(sf):
            if tool_name == "Glob":
                profiles[sid].glob_count += 1
                total_glob += 1
                continue
            if tool_name != "Bash":
                continue
            cmd = tinput.get("command", "") if isinstance(tinput, dict) else ""
            cls = classify_find_files_long(cmd)
            if cls is None:
                continue
            subclass, sub, pipe, filt = cls
            if subclass == "find_name":
                profiles[sid].long_find_count += 1
            elif subclass == "ls_recursive":
                profiles[sid].long_ls_r_count += 1
            elif subclass == "ls_simple":
                profiles[sid].long_ls_simple_count += 1
            long_obs.append(LongObs(
                session=sid, command=cmd[:200], subclass=subclass,
                substitutable=sub, has_pipe=pipe, has_exec_or_filter=filt,
            ))
    return long_obs, profiles, total_glob


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def fmt_rate(n: int, d: int) -> str:
    return f"{n/d:.3f}" if d else "n/a"


def generate_report(
    session_files: list[Path],
    long_obs: list[LongObs],
    profiles: dict[str, SessionProfile],
    total_glob: int,
) -> str:
    L: list[str] = []
    L.append("# PC-088 v2 find_files Sub-class Validation (W15-015)")
    L.append("")
    L.append("**Ticket**: 0.18.0-W15-015")
    L.append("**上游**: 0.18.0-W15-014 (E3 retrospective)")
    L.append("**上游結果**: find_files long_path_rate = 0.412 (n=136) > 0.3")
    L.append("**執行日期**: 2026-04-18")
    L.append("")
    L.append("---")
    L.append("")
    L.append("## 1. 路徑選擇")
    L.append("")
    L.append("選擇 **Path A（enhanced retrospective）**。理由：")
    L.append("")
    L.append("| 判準 | Path A | Path B (prospective A/B) | Path C |")
    L.append("|------|--------|--------------------------|--------|")
    L.append("| Session 成本 | 0（重用 E3 資料） | ≥10 新 session | A + B |")
    L.append("| Rule loading 污染 | 無（觀察既有行為） | 高（兩組皆載入同 .claude/） | 高 |")
    L.append("| 因果推論強度 | 觀察性（弱 causal） | 實驗性（強 causal） | 強 |")
    L.append("| 可重現性 | 完全（腳本掃描） | 低（單次 subagent） | 混合 |")
    L.append("| 能否區分 H1 支持 vs correlation | 可（透過 sub-pattern 分層 + 可替代性檢定） | 可 | 可 |")
    L.append("")
    L.append("**關鍵洞察**：E3 的 `find_files` rate 0.412 已 > 0.3 閾值，問題不在「是否存在偏誤」而在「偏誤的機制」。")
    L.append("Path A 的分層分析可直接區分三種競爭假設：")
    L.append("")
    L.append("- H1（步驟估算偏誤）：大多數 long path 是 Glob 可直接替代的 `find -name`，且 session 同時有用 Glob → 非「不知道」而是「未被觸發」。")
    L.append("- H2（工具等價性差異）：long path 多為 `ls -R`、帶 `-exec` 的 find，Glob 無法單步替代 → rate 高是任務性質非偏誤。")
    L.append("- H3（情境依賴）：混合使用（同 session 有 Glob 有 find）普遍 → 選擇與語境相關，非純習慣。")
    L.append("")
    L.append("Path B 的致命缺陷：control 組與 treatment 組都會完整載入 `.claude/rules/`（含 search-tools-guide）。差異僅在 user prompt 是否明確提示 Glob，")
    L.append("這測的是「prompt 工程有效性」而非「預設啟發式是否有偏誤」。且 single-session × 單一 model 的樣本不足以支持 causal claim。")
    L.append("")
    L.append("**放棄 Path C**：若 Path A 的分層分析足夠區分 H1/H2/H3，追加 Path B 的邊際資訊量低於其污染風險。")
    L.append("")
    L.append("---")
    L.append("")
    L.append("## 2. 方法")
    L.append("")
    L.append(f"掃描最新 {len(session_files)} 個 session transcript，將 E3 中歸類為 find_files long-path 的指令進一步分層：")
    L.append("")
    L.append("### 2.1 Sub-pattern 分類")
    L.append("")
    L.append("| 子類 | 範例 | Glob 可替代性 |")
    L.append("|------|------|--------------|")
    L.append("| `find_name`（單純 -name/-iname） | `find docs -name '*.md'` | 是（單步 Glob） |")
    L.append("| `find_name` + filter | `find . -name X -exec grep Y \\;` | 否（涉及 exec/mtime/size） |")
    L.append("| `ls_recursive` | `ls -R dir/` | 是（Glob `**/*`） |")
    L.append("| `ls_simple`（排除） | `ls dir/` | 非 find_files 任務，自樣本排除 |")
    L.append("")
    L.append("### 2.2 Session-level profile")
    L.append("")
    L.append("對每個 session 統計：Glob 呼叫次數、find/ls -R long-path 次數。將 session 分為：")
    L.append("")
    L.append("- **Mixed**: Glob ≥1 且 long-path ≥1")
    L.append("- **Glob-only**: Glob ≥1 且 long-path = 0")
    L.append("- **Long-only**: Glob = 0 且 long-path ≥1")
    L.append("- **Neither**: 兩者皆 0（不計入）")
    L.append("")
    L.append("### 2.3 可替代性判準")
    L.append("")
    L.append("Long-path 指令標記為「Glob 可替代」若：")
    L.append("")
    L.append("- `find` 路徑：只有 `-name`/`-iname`，**無** `-exec`, `-mtime`, `-size`, `-newer`, `-type` (非 f/d) 等 predicate")
    L.append("- `ls -R` 路徑：無限制條件")
    L.append("")
    L.append("「不可替代」代表 Glob 無法單步取代，rate 高屬於任務性質而非偏誤。")
    L.append("")
    L.append("---")
    L.append("")

    # --- Section 3: Results ---
    L.append("## 3. 結果")
    L.append("")
    total = len(long_obs)
    sub_counts: dict[str, int] = defaultdict(int)
    sub_substitutable: dict[str, int] = defaultdict(int)
    sub_pipe: dict[str, int] = defaultdict(int)
    for o in long_obs:
        sub_counts[o.subclass] += 1
        if o.substitutable:
            sub_substitutable[o.subclass] += 1
        if o.has_pipe:
            sub_pipe[o.subclass] += 1

    L.append(f"- Session 檔案數：{len(session_files)}")
    L.append(f"- find_files long-path 觀察總數（排除 `ls_simple`）：{total - sub_counts['ls_simple']}")
    L.append(f"- 納入樣本（find_name + ls_recursive）：{sub_counts['find_name'] + sub_counts['ls_recursive']}")
    L.append(f"- Session 中 Glob 呼叫總數：{total_glob}")
    L.append("")
    L.append("### 3.1 Sub-pattern 分布")
    L.append("")
    L.append("| Sub-pattern | Count | Glob 可替代 | 替代率 | 含 pipe 後處理 |")
    L.append("|-------------|-------|-------------|--------|---------------|")
    for sub in ("find_name", "ls_recursive", "ls_simple"):
        c = sub_counts[sub]
        sub_rate = fmt_rate(sub_substitutable[sub], c)
        pipe_rate = fmt_rate(sub_pipe[sub], c)
        note = "（排除）" if sub == "ls_simple" else ""
        L.append(f"| `{sub}`{note} | {c} | {sub_substitutable[sub]} | {sub_rate} | {pipe_rate} |")
    included = sub_counts["find_name"] + sub_counts["ls_recursive"]
    sub_total = sub_substitutable["find_name"] + sub_substitutable["ls_recursive"]
    L.append(f"| **納入合計** | **{included}** | **{sub_total}** | **{fmt_rate(sub_total, included)}** | — |")
    L.append("")

    # --- Section 3.2: Session profiles ---
    mixed = glob_only = long_only = neither = 0
    session_long_obs_counts = defaultdict(int)
    for p in profiles.values():
        long_count = p.long_find_count + p.long_ls_r_count
        has_glob = p.glob_count > 0
        has_long = long_count > 0
        if has_glob and has_long:
            mixed += 1
        elif has_glob and not has_long:
            glob_only += 1
        elif has_long and not has_glob:
            long_only += 1
        else:
            neither += 1
        session_long_obs_counts[p.session] = long_count

    L.append("### 3.2 Session-level profile")
    L.append("")
    L.append("| Profile | Session 數 | 說明 |")
    L.append("|---------|-----------|------|")
    L.append(f"| Mixed（Glob + long-path 並用） | {mixed} | 選擇情境化 |")
    L.append(f"| Glob-only | {glob_only} | 啟發式已傾向 Glob |")
    L.append(f"| Long-only（未用 Glob 卻用 find/ls -R） | {long_only} | 啟發式偏誤最強訊號 |")
    L.append(f"| Neither | {neither} | 該 session 無 find_files 需求 |")
    active = mixed + glob_only + long_only
    L.append(f"| **Active total** | **{active}** | — |")
    L.append("")

    # --- Section 3.3: Key metric - substitutable long-path in mixed sessions ---
    # Among "mixed" sessions, how many long-paths are Glob-substitutable?
    # This is the key H1 signal.
    mixed_sessions = {p.session for p in profiles.values() if p.glob_count > 0 and (p.long_find_count + p.long_ls_r_count) > 0}
    long_only_sessions = {p.session for p in profiles.values() if p.glob_count == 0 and (p.long_find_count + p.long_ls_r_count) > 0}

    mixed_obs = [o for o in long_obs if o.session in mixed_sessions and o.subclass in ("find_name", "ls_recursive")]
    long_only_obs = [o for o in long_obs if o.session in long_only_sessions and o.subclass in ("find_name", "ls_recursive")]
    mixed_sub = sum(1 for o in mixed_obs if o.substitutable)
    long_only_sub = sum(1 for o in long_only_obs if o.substitutable)

    L.append("### 3.3 H1 關鍵指標：Mixed session 中的可替代 long-path")
    L.append("")
    L.append("「既已知道用 Glob、但同 session 內仍選 find/ls -R」且「該 find/ls -R 是 Glob 單步可替代」的觀察 —— 這是 H1（步驟估算偏誤）最強訊號。")
    L.append("")
    L.append("| 來源 | Long obs | 其中可替代 | 可替代率 |")
    L.append("|------|----------|------------|----------|")
    L.append(f"| Mixed sessions | {len(mixed_obs)} | {mixed_sub} | {fmt_rate(mixed_sub, len(mixed_obs))} |")
    L.append(f"| Long-only sessions | {len(long_only_obs)} | {long_only_sub} | {fmt_rate(long_only_sub, len(long_only_obs))} |")
    all_included = [o for o in long_obs if o.subclass in ("find_name", "ls_recursive")]
    all_sub = sum(1 for o in all_included if o.substitutable)
    L.append(f"| 全部納入樣本 | {len(all_included)} | {all_sub} | {fmt_rate(all_sub, len(all_included))} |")
    L.append("")

    # --- Section 4: Interpretation ---
    L.append("---")
    L.append("")
    L.append("## 4. 判讀")
    L.append("")
    L.append("### 4.1 三假設檢定")
    L.append("")

    substitutable_rate = all_sub / len(all_included) if all_included else 0.0
    mixed_sub_rate = mixed_sub / len(mixed_obs) if mixed_obs else 0.0

    # H1 support: high substitutable rate AND significant mixed-session substitutable obs
    h1_support_strong = substitutable_rate >= 0.6 and mixed_sub_rate >= 0.5 and len(mixed_obs) >= 10
    h1_support_weak = substitutable_rate >= 0.4 and len(all_included) >= 20
    h2_support = substitutable_rate < 0.3  # most long-paths not Glob-replaceable
    h3_support = mixed > max(glob_only, long_only) and len(mixed_obs) >= 10

    L.append(f"- **整體可替代率** = {substitutable_rate:.3f}（{all_sub}/{len(all_included)}）")
    L.append(f"- **Mixed session 可替代率** = {mixed_sub_rate:.3f}（{mixed_sub}/{len(mixed_obs)}）")
    L.append(f"- **Session profile 比例**：mixed={mixed}, glob-only={glob_only}, long-only={long_only}")
    L.append("")
    L.append("判讀：")
    L.append("")
    if h1_support_strong:
        L.append("- **H1（步驟估算偏誤）支持度：強**。多數 find/ls -R 是 Glob 單步可替代，且在已知用 Glob 的 session 中仍發生 —— 支持「未被觸發」而非「不知道」。")
    elif h1_support_weak:
        L.append("- **H1（步驟估算偏誤）支持度：中**。可替代率中等，但 mixed-session 觀察數或替代比例不足以下強 causal claim。")
    else:
        L.append("- **H1（步驟估算偏誤）支持度：弱**。可替代率偏低或樣本不足。")
    if h2_support:
        L.append("- **H2（工具等價性）支持度：強**。多數 long-path 帶 exec/filter，Glob 不可單步替代 —— rate 高屬任務性質。")
    else:
        L.append("- **H2（工具等價性）支持度：弱**。多數 long-path 是 Glob 可替代的單純 find -name / ls -R。")
    if h3_support:
        L.append("- **H3（情境依賴）支持度：中-強**。Mixed sessions 為主，顯示選擇與語境相關而非純習慣。")
    else:
        L.append("- **H3（情境依賴）支持度：弱**。非 mixed 型 session 居多。")
    L.append("")

    # --- Section 5: PC-088 v2 update decision ---
    L.append("### 4.2 PC-088 v2 `find_files` 章節更新建議")
    L.append("")
    if h1_support_strong:
        verdict = "**因果支持（觀察性強證據）**"
        verdict_note = "PC-088 v2 `find_files` 章節保留「步驟估算偏誤」主張，並附本實驗結果作為觀察性強證據。承認 single-model、觀察性方法的限制。"
    elif h1_support_weak:
        verdict = "**相關性，機制傾向 H1 但未定**"
        verdict_note = "PC-088 v2 `find_files` 章節降級為「相關性觀察，H1 機制待進一步實驗證實」。"
    else:
        verdict = "**相關性，機制未定**"
        verdict_note = "PC-088 v2 `find_files` 章節標註為「相關性觀察，機制未定」，不作 causal claim。"
    L.append(f"**結論**：{verdict}")
    L.append("")
    L.append(verdict_note)
    L.append("")

    # --- Section 5: Limits ---
    L.append("---")
    L.append("")
    L.append("## 5. 方法限制（誠實聲明）")
    L.append("")
    L.append("- **Single-model**：樣本來自 Claude Code 單一模型 session，不可推論到其他 LLM。")
    L.append("- **觀察性非實驗性**：本設計不操縱變因；不能完全排除遺漏變因（confounders），例如：")
    L.append("  - 用戶下游 prompt 可能誘導特定工具選擇")
    L.append("  - Subagent 行為與主 session 混入，未做 role 分離")
    L.append("- **Glob 可替代性是保守判準**：忽略 `-type`/`-maxdepth` 等可能仍可由 Glob 表示的變體；實際可替代比例可能被低估。")
    L.append("- **Rule loading 相同**：所有 session 都載入同套 `.claude/rules/`，無法分離「規則有無」對選擇的影響。要答這問題需要 cross-repo 比較，超出本 ticket scope。")
    L.append("- **樣本偏斜**：50 session 中有大量 PM / ticket 操作情境，find_files 出現的任務分佈可能不代表一般開發工作。")
    L.append("")

    # --- Section 6: Evidence samples ---
    L.append("---")
    L.append("")
    L.append("## 6. 證據樣本")
    L.append("")
    L.append("### 6.1 Mixed session 中的可替代 long-path（H1 訊號）")
    L.append("")
    shown = 0
    for o in mixed_obs:
        if not o.substitutable:
            continue
        L.append(f"- [{o.subclass}] `{o.command[:140]}`")
        shown += 1
        if shown >= 8:
            break
    if shown == 0:
        L.append("- （無）")
    L.append("")
    L.append("### 6.2 不可替代 long-path（H2 訊號）")
    L.append("")
    shown = 0
    for o in long_obs:
        if o.substitutable or o.subclass == "ls_simple":
            continue
        L.append(f"- [{o.subclass}] `{o.command[:140]}`")
        shown += 1
        if shown >= 5:
            break
    if shown == 0:
        L.append("- （無）")
    L.append("")

    L.append("---")
    L.append("")
    L.append("## 7. Reproducibility")
    L.append("")
    L.append("```bash")
    L.append("uv run scripts/experiments/pc088_v2_find_files_validation.py --sessions 50")
    L.append("```")
    L.append("")
    L.append("Script：`scripts/experiments/pc088_v2_find_files_validation.py`")
    L.append("上游資料來源：同 E3 的 `~/.claude/projects/-Users-tarragon-Projects-book-overview-v1/*.jsonl`")
    L.append("")

    return "\n".join(L) + "\n"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def select_recent_sessions(limit: int) -> list[Path]:
    files = list(TRANSCRIPT_DIR.glob("*.jsonl"))
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files[:limit]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sessions", type=int, default=DEFAULT_SESSION_LIMIT)
    ap.add_argument("--output", type=Path, default=REPORT_PATH)
    args = ap.parse_args()

    if not TRANSCRIPT_DIR.is_dir():
        print(f"ERROR: transcript dir not found: {TRANSCRIPT_DIR}")
        return 2
    session_files = select_recent_sessions(args.sessions)
    if not session_files:
        print("ERROR: no session files")
        return 2

    print(f"Scanning {len(session_files)} sessions...")
    long_obs, profiles, total_glob = scan(session_files)
    report = generate_report(session_files, long_obs, profiles, total_glob)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report, encoding="utf-8")
    print(f"Report: {args.output}")

    # Summary
    total = len(long_obs)
    sub_counts: dict[str, int] = defaultdict(int)
    for o in long_obs:
        sub_counts[o.subclass] += 1
    print(f"\n  Long-path observations: {total}")
    for sub in ("find_name", "ls_recursive", "ls_simple"):
        print(f"    {sub}: {sub_counts[sub]}")
    included = [o for o in long_obs if o.subclass in ("find_name", "ls_recursive")]
    sub_rate = sum(1 for o in included if o.substitutable) / len(included) if included else 0.0
    print(f"  Substitutable rate (included sample): {sub_rate:.3f}")
    print(f"  Total Glob calls: {total_glob}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
