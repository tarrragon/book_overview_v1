"""test-map 子命令 — 顯示需求-測試對應表。"""

import argparse
import os

from doc_system.core.file_locator import FileLocator
from doc_system.core.frontmatter_parser import parse_frontmatter


def _scan_test_files(tests_dir: str, uc_id: str) -> list[str]:
    """掃描 tests/ 目錄，搜尋包含 UC ID 的測試檔案。"""
    matches: list[str] = []
    if not os.path.isdir(tests_dir):
        return matches

    uc_id_lower = uc_id.lower()
    # 同時搜尋帶連字號（UC-01）和不帶（UC01）的格式
    uc_id_no_dash = uc_id_lower.replace("-", "")

    for root, _dirs, files in os.walk(tests_dir):
        for filename in sorted(files):
            if not filename.endswith((".js", ".ts", ".py", ".test.js", ".spec.js")):
                continue
            file_path = os.path.join(root, filename)
            try:
                content = open(file_path, encoding="utf-8").read().lower()
            except OSError:
                continue
            if uc_id_lower in content or uc_id_no_dash in content:
                matches.append(file_path)

    return matches


def execute(args: argparse.Namespace) -> None:
    """顯示 UC 與測試檔案對應。可選 uc_id 篩選特定 UC。"""
    locator = FileLocator(FileLocator.get_project_root())
    tests_dir = os.path.join(locator.project_root, "tests")
    uc_id = getattr(args, "uc_id", None)

    uc_files = locator.list_usecases()
    if not uc_files:
        print("沒有找到任何 UC 文件。")
        return

    print("=== UC 測試對應表 ===")
    print(f"{'UC ID':<12} {'標題':<30} {'測試檔案數'}")
    print("-" * 55)

    for uc_file in uc_files:
        frontmatter = parse_frontmatter(uc_file)
        if frontmatter is None:
            continue

        fm_id = str(frontmatter.get("id", ""))
        title = str(frontmatter.get("title", "(無標題)"))
        if len(title) > 27:
            title = title[:24] + "..."

        # 若指定 uc_id，只顯示該 UC
        if uc_id is not None and fm_id.upper() != uc_id.upper():
            continue

        test_files = _scan_test_files(tests_dir, fm_id)
        count = len(test_files)
        print(f"{fm_id:<12} {title:<30} {count}")

        if test_files:
            for tf in test_files:
                rel_path = os.path.relpath(tf, locator.project_root)
                print(f"{'':>12}   {rel_path}")
