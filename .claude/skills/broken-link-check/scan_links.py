#!/usr/bin/env python3
"""確定性 broken-link CLI scanner（取代 LLM 手動 SKILL 作為跨框架完成 gate）。

掃描 `<root>/.claude/**/*.md` 中的路徑引用，resolve 後判定 broken/placeholder/
excluded_*，輸出確定性計數 + 分類清單。純標準庫實作（pathlib/re/argparse/json/sys）。

確定性三保證點（GWT #3）：
1. md_files 掃描前先 sort
2. broken_entries 依 (source_file, line) sort
3. categories 為固定 key dict（插入序固定）

設計依據：ticket 1.0.0-W8-030.1 Solution Phase 1 規格 + Phase 3a 策略。
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

# 預設旋鈕：三排除全開啟（皆排除），可由 CLI flag 顯式覆寫納入
DEFAULT_KNOBS = {
    "include_code_block": False,
    "include_migration_backups": False,
    "include_placeholder": False,
}

# 4 種引用前綴；http(s):// 與 #anchor 不在清單中故天然排除
REF_REGEX = re.compile(r"(?:@\.claude/|\.claude/|\.\./|\./)[^\s)\]\"'`]*?\.md")

# 固定 placeholder 樣式集（SKILL 表格自身範例路徑，非真實引用）
PLACEHOLDER_SAMPLES = {
    "path/file.md",
    ".claude/path/file.md",
    "./path/file.md",
    "../path/file.md",
}


def extract_refs(text):
    """從單檔內容抽 4 種前綴的 .md 引用，標記 code-block 狀態 + 行號。

    fence 開合以逐行翻轉狀態機追蹤；奇數 fence（未閉合）自然延伸到 EOF。
    """
    refs = []
    in_fence = False
    for line_no, line in enumerate(text.splitlines(), start=1):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        for match in REF_REGEX.finditer(line):
            raw = match.group()
            refs.append(
                {"raw_ref": raw, "line": line_no, "in_code_block": in_fence}
            )
    return refs


def resolve_path(raw, source_file, root):
    """引用字串轉實際路徑字串。

    - @.claude/X 與 .claude/X：相對 repo root
    - ./X 與 ../X：相對 source_file 所在目錄（os.path.normpath 純字串消解 ..）
    """
    root = Path(root)
    source_file = Path(source_file)
    if raw.startswith("@"):
        return os.path.normpath(str(root / raw[1:]))
    if raw.startswith(".claude/"):
        return os.path.normpath(str(root / raw))
    return os.path.normpath(str(source_file.parent / raw))


def classify_ref(raw, resolved, knobs, exists):
    """判定引用分類：placeholder / excluded_backup / broken / ok。

    判定順序即優先級（短路）：placeholder → backup → exists → broken。
    """
    if raw in PLACEHOLDER_SAMPLES and not knobs["include_placeholder"]:
        return "placeholder"
    if "migration-backups/" in resolved or "hook-logs/" in resolved:
        if not knobs["include_migration_backups"]:
            return "excluded_backup"
        # 旋鈕開啟 → 落到下方 exists/broken 判定
    if exists:
        return "ok"
    return "broken"


def _rel_to_root(path, root):
    """轉相對 root 的字串路徑（確定性，不依賴 cwd）。"""
    try:
        return str(Path(path).relative_to(root))
    except ValueError:
        return str(path)


def scan(root, knobs=None):
    """編排 I/O：掃描 .claude/ md → 抽引用 → resolve → 分類 → 彙總。"""
    knobs = knobs or DEFAULT_KNOBS
    root = Path(root)
    md_files = sorted(root.glob(".claude/**/*.md"))
    md_files = [f for f in md_files if "hook-logs/" not in str(f)]
    categories = {
        "broken": 0,
        "placeholder": 0,
        "excluded_code_block": 0,
        "excluded_backup": 0,
    }
    broken_entries = []
    total_refs = 0
    scanned = 0
    for f in md_files:
        try:
            text = f.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            # Q5 雙通道：stderr 可見 + continue，禁靜默吞回傳假計數
            sys.stderr.write(f"[WARN] cannot read {f}: {e}\n")
            continue
        scanned += 1
        for ref in extract_refs(text):
            total_refs += 1
            if ref["in_code_block"] and not knobs["include_code_block"]:
                categories["excluded_code_block"] += 1
                continue
            resolved = resolve_path(ref["raw_ref"], f, root)
            exists = Path(resolved).exists()
            cat = classify_ref(ref["raw_ref"], resolved, knobs, exists=exists)
            if cat in categories:
                categories[cat] += 1
            if cat == "broken":
                broken_entries.append(
                    {
                        "source_file": _rel_to_root(f, root),
                        "line": ref["line"],
                        "raw_ref": ref["raw_ref"],
                        "resolved_path": _rel_to_root(resolved, root),
                        "category": "broken",
                        "subcategory": None,
                    }
                )
    broken_entries.sort(key=lambda e: (e["source_file"], e["line"]))
    return {
        "baseline": categories["broken"],
        "scanned_files": scanned,
        "total_refs": total_refs,
        "broken_count": len(broken_entries),
        "categories": categories,
        "broken": broken_entries,
    }


def _print_text_view(result):
    """人類可讀視圖（確定性：固定欄位序，禁無序 set/dict 迭代）。"""
    cats = result["categories"]
    print(
        f"broken: {result['broken_count']}  "
        f"refs: {result['total_refs']}  files: {result['scanned_files']}"
    )
    print(
        "categories: "
        f"broken={cats['broken']} placeholder={cats['placeholder']} "
        f"excluded_code_block={cats['excluded_code_block']} "
        f"excluded_backup={cats['excluded_backup']}"
    )
    print("--- broken list (sorted source:line) ---")
    for e in result["broken"]:
        print(
            f"{e['source_file']}:{e['line']}  "
            f"{e['raw_ref']} -> {e['resolved_path']}"
        )


def main(argv=None):
    """CLI 入口：解析參數 → scan → 格式化輸出 → exit code。

    exit code：0=零 broken（gate pass）/ 1=broken>0（gate fail）/ 2=執行錯誤。
    """
    parser = argparse.ArgumentParser(
        description="確定性 broken-link scanner for .claude/ markdown"
    )
    parser.add_argument("repo_root", nargs="?", default=".")
    parser.add_argument("--include-code-block", action="store_true")
    parser.add_argument("--include-migration-backups", action="store_true")
    parser.add_argument("--include-placeholder", action="store_true")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args(argv)

    root = Path(args.repo_root)
    if not root.is_dir() or not (root / ".claude").is_dir():
        # GWT #7：致命錯誤 stderr 可見 + exit 2，不輸出假計數
        sys.stderr.write(f"[ERROR] repo root or .claude/ not found: {root}\n")
        return 2

    knobs = {
        "include_code_block": args.include_code_block,
        "include_migration_backups": args.include_migration_backups,
        "include_placeholder": args.include_placeholder,
    }
    try:
        result = scan(root, knobs)
    except OSError as e:
        sys.stderr.write(f"[ERROR] scan failed: {e}\n")
        return 2

    if args.format == "json":
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=False))
    else:
        _print_text_view(result)
    return 1 if result["broken_count"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
