#!/usr/bin/env python3
"""PC-088 v2 Retrospective Audit (E3).

Scans recent Claude Code session transcripts to quantify how often the
assistant chose a multi-step ("long") path for canonical tasks that have
a single-step ("short") alternative.

Canonical tasks (from W15-011 ANA):

| Task                         | Short path                    | Long path                          |
|------------------------------|-------------------------------|------------------------------------|
| Pass long text (>1KB) to CLI | heredoc `cat <<'EOF'`          | Write /tmp + cat / Read             |
| Local file edit              | Edit / MultiEdit              | Read + Write whole file             |
| Search strings               | Grep tool                     | Bash grep / rg / find -exec         |
| Find files                   | Glob tool                     | Bash find / ls -R                   |

Output: Markdown report to docs/experiments/PC-088-v2-validation.md
Usage:  uv run scripts/experiments/pc088_v2_audit.py [--sessions N]
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TRANSCRIPT_DIR = Path.home() / ".claude/projects/-Users-tarragon-Projects-book-overview-v1"
REPORT_PATH = Path("docs/experiments/PC-088-v2-validation.md")
DEFAULT_SESSION_LIMIT = 50

LONG_TEXT_THRESHOLD_BYTES = 1024  # "> 1KB" per W15-011 spec

# Task category labels (stable keys for report)
T_LONG_TEXT = "pass_long_text_to_cli"
T_LOCAL_EDIT = "modify_file_locally"
T_SEARCH_STR = "search_strings"
T_FIND_FILE = "find_files"

TASKS = [T_LONG_TEXT, T_LOCAL_EDIT, T_SEARCH_STR, T_FIND_FILE]

# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass
class Observation:
    """A single tool-use classified as short or long path for a canonical task."""

    session: str
    task: str
    path: str  # "short" or "long"
    tool: str
    evidence: str  # short excerpt for audit


@dataclass
class TaskStats:
    short: int = 0
    long: int = 0
    examples_short: list[str] = field(default_factory=list)
    examples_long: list[str] = field(default_factory=list)

    @property
    def total(self) -> int:
        return self.short + self.long

    @property
    def long_rate(self) -> float:
        return self.long / self.total if self.total else 0.0


# ---------------------------------------------------------------------------
# Classification rules
# ---------------------------------------------------------------------------

# Bash patterns for long-path detection
BASH_GREP_LONG = re.compile(r"(?<![A-Za-z_])(grep|rg|ag)\b[^|]*(?<!\|)\s*(?:$|\|)|find\s+\S+\s+-exec\s+grep")
BASH_FIND_FILE_LONG = re.compile(r"(?<![A-Za-z_])(find|ls(?:\s+-[a-zA-Z]*R)?)\b")
HEREDOC_PATTERN = re.compile(r"<<-?\s*['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?")
TMP_WRITE_DETOUR = re.compile(r"(cat\s*>\s*/tmp/|tee\s+/tmp/|echo\s+.*>\s*/tmp/)")

# Known safe Bash idioms (not "search strings" usage)
BASH_GREP_SAFE = re.compile(r"\|\s*grep\b")  # piping into grep to filter prior output is acceptable


def classify_bash(command: str) -> list[tuple[str, str, str]]:
    """Return list of (task, path, evidence) classifications for a bash command."""
    results: list[tuple[str, str, str]] = []
    cmd = command.strip()
    if not cmd:
        return results

    # Task: pass_long_text_to_cli
    # Heuristic: command contains heredoc OR /tmp write detour
    if HEREDOC_PATTERN.search(cmd):
        # Heredoc with inline content >1KB is a clear "short path" choice
        # We approximate by command length; full content is inline so length >1KB is a
        # strong signal of deliberate long-text transfer.
        if len(cmd) > LONG_TEXT_THRESHOLD_BYTES:
            results.append((T_LONG_TEXT, "short", _excerpt(cmd)))
    if TMP_WRITE_DETOUR.search(cmd):
        results.append((T_LONG_TEXT, "long", _excerpt(cmd)))

    # Task: search_strings
    # Long path: bash invokes grep/rg/find-exec as the primary command (not piped filter)
    # Exclude safe idioms (piping to grep filtering previous output)
    stripped_for_search = cmd.split("|")[0].strip()  # first segment only
    if re.search(r"^\s*(grep|rg|ag)\b", stripped_for_search) or re.search(r"find\s+.*-exec\s+grep", cmd):
        # Not "| grep" filter
        results.append((T_SEARCH_STR, "long", _excerpt(cmd)))

    # Task: find_files
    # Long path: bash find/ls when looking for files by name/pattern
    # Heuristic: `find ... -name`, `find ... -iname`, `ls -R`, `ls **/*`
    if re.search(r"find\s+\S+\s+-i?name\s+", cmd) or re.search(r"\bls\s+-[a-zA-Z]*R", cmd):
        results.append((T_FIND_FILE, "long", _excerpt(cmd)))

    return results


def classify_tool_use(tool_name: str, tool_input: dict) -> list[tuple[str, str, str]]:
    """Classify a single assistant tool_use into (task, path, evidence) tuples."""
    results: list[tuple[str, str, str]] = []

    if tool_name == "Bash":
        cmd = tool_input.get("command", "") if isinstance(tool_input, dict) else ""
        results.extend(classify_bash(cmd))
        return results

    if tool_name == "Edit" or tool_name == "MultiEdit":
        file_path = tool_input.get("file_path", "") if isinstance(tool_input, dict) else ""
        results.append((T_LOCAL_EDIT, "short", f"Edit {file_path}"))
        return results

    if tool_name == "Write":
        # Only "long" if overwriting an existing local source file (whole-file rewrite).
        # We can't tell from the JSONL alone whether the file pre-existed; we approximate:
        #   - Writes to /tmp: long path for T_LONG_TEXT if content > 1KB
        #   - Writes to source tree with moderate size and file likely edit candidate:
        #     classify as LONG for T_LOCAL_EDIT only when content ~ full rewrite scale.
        # To stay conservative we treat Write to /tmp explicitly as long-text detour.
        file_path = tool_input.get("file_path", "") if isinstance(tool_input, dict) else ""
        content = tool_input.get("content", "") if isinstance(tool_input, dict) else ""
        if file_path.startswith("/tmp/") and len(content) > LONG_TEXT_THRESHOLD_BYTES:
            results.append((T_LONG_TEXT, "long", f"Write {file_path} ({len(content)}B)"))
        # Conservative: do NOT auto-classify Write-to-source as T_LOCAL_EDIT long
        # without explicit Read+Write pairing detection (out of scope for this v1 audit).
        return results

    if tool_name == "Grep":
        results.append((T_SEARCH_STR, "short", f"Grep {tool_input.get('pattern', '')[:60]}"))
        return results

    if tool_name == "Glob":
        results.append((T_FIND_FILE, "short", f"Glob {tool_input.get('pattern', '')[:60]}"))
        return results

    return results


def _excerpt(text: str, limit: int = 120) -> str:
    """Return a single-line excerpt suitable for tables."""
    oneline = " ".join(text.split())
    return oneline[:limit] + ("..." if len(oneline) > limit else "")


# ---------------------------------------------------------------------------
# Session scanning
# ---------------------------------------------------------------------------


def iter_tool_uses(session_file: Path) -> Iterable[tuple[str, dict]]:
    """Yield (tool_name, tool_input) for every assistant tool_use event in a session."""
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
                    name = item.get("name", "")
                    tinput = item.get("input", {}) or {}
                    yield name, tinput


def scan_sessions(session_files: list[Path]) -> tuple[dict[str, TaskStats], list[Observation]]:
    """Scan session files and return aggregated stats and per-observation log."""
    stats: dict[str, TaskStats] = {t: TaskStats() for t in TASKS}
    observations: list[Observation] = []

    for sf in session_files:
        session_id = sf.stem
        for tool_name, tool_input in iter_tool_uses(sf):
            for task, path, evidence in classify_tool_use(tool_name, tool_input):
                ts = stats[task]
                if path == "short":
                    ts.short += 1
                    if len(ts.examples_short) < 5:
                        ts.examples_short.append(evidence)
                else:
                    ts.long += 1
                    if len(ts.examples_long) < 5:
                        ts.examples_long.append(evidence)
                observations.append(Observation(session=session_id, task=task, path=path, tool=tool_name, evidence=evidence))

    return stats, observations


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

VERDICT_HIGH = "> 0.3 支持偏誤 → 建議觸發 E2"
VERDICT_LOW = "< 0.1 缺實證 → PC-088 v2 降級為 hypothesis"
VERDICT_MID = "0.1–0.3 灰色地帶 → 說明限制、不作 causal claim"


def overall_verdict(rate: float) -> str:
    if rate > 0.3:
        return VERDICT_HIGH
    if rate < 0.1:
        return VERDICT_LOW
    return VERDICT_MID


def generate_report(
    session_files: list[Path],
    stats: dict[str, TaskStats],
    observations: list[Observation],
) -> str:
    """Generate the Markdown report content."""
    lines: list[str] = []
    lines.append("# PC-088 v2 Retrospective Audit (E3)")
    lines.append("")
    lines.append("**Ticket**: 0.18.0-W15-014")
    lines.append("**來源 ANA**: 0.18.0-W15-011（E3 設計章節）")
    lines.append("**執行日期**: 2026-04-18")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 1. 方法")
    lines.append("")
    lines.append(
        "掃描 `~/.claude/projects/-Users-tarragon-Projects-book-overview-v1/*.jsonl` "
        f"最新 {len(session_files)} 個 session transcript，"
        "逐一解析 assistant 的 `tool_use` 事件，依 4 類 canonical task 編碼為 short/long path。"
    )
    lines.append("")
    lines.append("### 1.1 編碼規則")
    lines.append("")
    lines.append("| Canonical task | Short path（單步） | Long path（多步） |")
    lines.append("|----------------|-------------------|-------------------|")
    lines.append("| 傳長文字 >1KB 到 CLI | Bash heredoc（指令長度 >1KB 即視為長文字內嵌） | Write `/tmp/*` 或 `cat > /tmp/`/`tee /tmp/` 後再讀回 |")
    lines.append("| 修改檔案局部 | `Edit` / `MultiEdit` 工具 | （本版本不啟用 Read+Write 配對偵測，保留將來擴充） |")
    lines.append("| 查字串 | `Grep` 工具 | Bash `grep`/`rg`/`ag`（首段命令）或 `find ... -exec grep` |")
    lines.append("| 查檔案 | `Glob` 工具 | Bash `find ... -name`、`ls -R` |")
    lines.append("")
    lines.append("### 1.2 已知限制（保守性聲明）")
    lines.append("")
    lines.append("- `T_LOCAL_EDIT` 的 long path（Read+Write 整檔重寫）需要跨 tool_use 配對分析，v1 未啟用；該分類 long count 將保守為 0。")
    lines.append("- Bash heredoc 被視為 short path 的判準為指令字串長度 >1KB（因 heredoc body 是 inline），可能低估（小於 1KB 的 heredoc 不算進樣本）。")
    lines.append("- 不計入 Bash `| grep` 濾管（屬後處理，非 search task）。")
    lines.append("- Subagent 內部 tool_use 已被計入（主 session JSONL 包含 subagent 副本）；若要排除需再增欄位過濾。")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(f"## 2. 樣本")
    lines.append("")
    lines.append(f"- Session 檔案數：{len(session_files)}")
    lines.append(f"- 觀察事件總數：{len(observations)}")
    lines.append("")
    lines.append("按 canonical task 分組的樣本分佈見第 3 節。")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 3. long_path_rate 結果")
    lines.append("")
    lines.append("| Task | short | long | total | long_path_rate |")
    lines.append("|------|-------|------|-------|----------------|")
    total_short = total_long = 0
    for t in TASKS:
        s = stats[t]
        total_short += s.short
        total_long += s.long
        rate_str = f"{s.long_rate:.3f}" if s.total else "n/a (sample=0)"
        lines.append(f"| {t} | {s.short} | {s.long} | {s.total} | {rate_str} |")
    grand_total = total_short + total_long
    overall_rate = total_long / grand_total if grand_total else 0.0
    lines.append(f"| **ALL** | **{total_short}** | **{total_long}** | **{grand_total}** | **{overall_rate:.3f}** |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 4. 判讀")
    lines.append("")
    lines.append("### 4.1 每類 task")
    lines.append("")
    for t in TASKS:
        s = stats[t]
        if s.total == 0:
            lines.append(f"- `{t}`：樣本數 0，無法判讀。")
            continue
        v = overall_verdict(s.long_rate)
        lines.append(f"- `{t}`：rate = {s.long_rate:.3f} (n={s.total}) → {v}")
    lines.append("")
    lines.append("### 4.2 整體")
    lines.append("")
    lines.append(f"- overall long_path_rate = {overall_rate:.3f} (n={grand_total})")
    lines.append(f"- 整體判讀：**{overall_verdict(overall_rate)}**")
    lines.append("")
    lines.append("### 4.3 sample size tripwire 檢查")
    lines.append("")
    lines.append("ANA 原設計要求「4 類各 >5 實例」；實測：")
    lines.append("")
    for t in TASKS:
        s = stats[t]
        verdict = "符合" if s.total >= 5 else "不足（<5）"
        lines.append(f"- `{t}`: total={s.total} → {verdict}")
    lines.append("")
    lines.append("樣本不足的分類應以「誠實報告限制、保守判讀」原則對待，不作 causal claim。")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 5. 證據樣本")
    lines.append("")
    for t in TASKS:
        s = stats[t]
        if not s.examples_short and not s.examples_long:
            continue
        lines.append(f"### 5.{TASKS.index(t)+1} {t}")
        lines.append("")
        if s.examples_short:
            lines.append("**Short path 樣本**：")
            lines.append("")
            for e in s.examples_short:
                lines.append(f"- `{e}`")
            lines.append("")
        if s.examples_long:
            lines.append("**Long path 樣本**：")
            lines.append("")
            for e in s.examples_long:
                lines.append(f"- `{e}`")
            lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 6. 結論與下一步")
    lines.append("")
    lines.append("判讀決策樹（對照 W15-011 E3）：")
    lines.append("")
    lines.append("| 整體 long_path_rate | 行動 |")
    lines.append("|--------------------|------|")
    lines.append("| > 0.3 | 觸發 E2 A/B 因果實驗（W15-015） |")
    lines.append("| 0.1–0.3 | 說明限制、PC-088 v2 維持但標註「機制未定」 |")
    lines.append("| < 0.1 | PC-088 v2 降級為 hypothesis，建立回退 Ticket（W15-016） |")
    lines.append("")
    lines.append(f"**本次 audit 結論**：overall rate = {overall_rate:.3f} → **{overall_verdict(overall_rate)}**")
    lines.append("")
    lines.append("各 task 類別的異質性見 §4.1；若個別 task 出現極端值，應在 W15-016 的 PC-088 v2 更新中分類討論，不以整體 rate 一刀切。")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 7. Reproducibility")
    lines.append("")
    lines.append("重新執行：")
    lines.append("")
    lines.append("```bash")
    lines.append("uv run scripts/experiments/pc088_v2_audit.py --sessions 50")
    lines.append("```")
    lines.append("")
    lines.append(f"Script 路徑：`scripts/experiments/pc088_v2_audit.py`")
    lines.append(f"Transcript 來源：`~/.claude/projects/-Users-tarragon-Projects-book-overview-v1/*.jsonl`")
    lines.append("")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def select_recent_sessions(limit: int) -> list[Path]:
    """Return the N most recently modified .jsonl session files."""
    files = list(TRANSCRIPT_DIR.glob("*.jsonl"))
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files[:limit]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sessions", type=int, default=DEFAULT_SESSION_LIMIT,
                        help=f"Number of most-recent sessions to scan (default: {DEFAULT_SESSION_LIMIT})")
    parser.add_argument("--output", type=Path, default=REPORT_PATH,
                        help="Report output path")
    args = parser.parse_args()

    if not TRANSCRIPT_DIR.is_dir():
        print(f"ERROR: transcript dir not found: {TRANSCRIPT_DIR}")
        return 2

    session_files = select_recent_sessions(args.sessions)
    if not session_files:
        print("ERROR: no session files found")
        return 2

    print(f"Scanning {len(session_files)} sessions from {TRANSCRIPT_DIR}")
    stats, observations = scan_sessions(session_files)

    report = generate_report(session_files, stats, observations)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report, encoding="utf-8")
    print(f"Report written to {args.output}")

    # Summary to stdout
    print("\n=== Summary ===")
    total_short = sum(s.short for s in stats.values())
    total_long = sum(s.long for s in stats.values())
    total = total_short + total_long
    rate = total_long / total if total else 0.0
    for t in TASKS:
        s = stats[t]
        r = f"{s.long_rate:.3f}" if s.total else "n/a"
        print(f"  {t}: short={s.short} long={s.long} total={s.total} rate={r}")
    print(f"  OVERALL: short={total_short} long={total_long} total={total} rate={rate:.3f}")
    print(f"  Verdict: {overall_verdict(rate)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
