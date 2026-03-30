"""query 子命令 — 依 ID 查詢文件內容。"""

import argparse

from doc_system.core.file_locator import FileLocator
from doc_system.core.frontmatter_parser import parse_frontmatter


# ID 前綴到 FileLocator 查詢方法的對應
_ID_PREFIX_FINDERS = {
    "PROP": "find_proposal",
    "UC": "find_usecase",
    "SPEC": "find_spec",
}


def _resolve_file(locator: FileLocator, doc_id: str) -> str | None:
    """依 ID 前綴找到對應檔案路徑。"""
    for prefix, method_name in _ID_PREFIX_FINDERS.items():
        if doc_id.upper().startswith(prefix):
            finder = getattr(locator, method_name)
            return finder(doc_id)
    return None


def execute(args: argparse.Namespace) -> None:
    """依 doc_id 查詢並顯示文件內容。"""
    doc_id = args.doc_id
    locator = FileLocator(FileLocator.get_project_root())

    file_path = _resolve_file(locator, doc_id)
    if file_path is None:
        print(f"找不到文件: {doc_id}")
        return

    frontmatter = parse_frontmatter(file_path)
    if frontmatter is None:
        print(f"無法解析 frontmatter: {file_path}")
        return

    fm_id = frontmatter.get("id", doc_id)
    title = frontmatter.get("title", "(無標題)")
    fm_status = frontmatter.get("status", "(未知)")

    print(f"ID:     {fm_id}")
    print(f"標題:   {title}")
    print(f"狀態:   {fm_status}")

    # 輸出引用鏈
    ref_fields = [
        "spec_refs", "usecase_refs", "ticket_refs",
        "source_proposal", "related_specs", "related_usecases",
    ]
    for field in ref_fields:
        value = frontmatter.get(field)
        if value:
            if isinstance(value, list):
                print(f"{field}: {', '.join(str(v) for v in value)}")
            else:
                print(f"{field}: {value}")
