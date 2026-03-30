"""list 子命令 — 列出文件清單。

模組名稱使用 list_cmd 避免與 Python 內建 list 衝突。
"""

import argparse


def execute(args: argparse.Namespace) -> None:
    """列出指定類型或全部文件清單。"""
    raise NotImplementedError("W5-001.2/W5-001.3 實作")
