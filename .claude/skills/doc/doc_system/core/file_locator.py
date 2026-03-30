"""定位 docs/ 下的文件路徑。"""

import os
from pathlib import Path


class FileLocator:
    """定位 proposals/spec/usecases 文件的工具類別。"""

    def __init__(self, project_root: str) -> None:
        self.project_root = project_root
        self.proposals_dir = os.path.join(project_root, "docs", "proposals")
        self.spec_dir = os.path.join(project_root, "docs", "spec")
        self.usecases_dir = os.path.join(project_root, "docs", "usecases")
        self.tracking_file = os.path.join(
            project_root, "docs", "proposals-tracking.yaml"
        )

    def find_proposal(self, prop_id: str) -> str | None:
        """依 proposal ID 找到對應檔案路徑，找不到回傳 None。"""
        return self._find_file_by_id(self.proposals_dir, prop_id)

    def find_usecase(self, uc_id: str) -> str | None:
        """依 usecase ID 找到對應檔案路徑，找不到回傳 None。"""
        return self._find_file_by_id(self.usecases_dir, uc_id)

    def find_spec(self, spec_id: str) -> str | None:
        """依 spec ID 找到對應檔案路徑，找不到回傳 None。"""
        return self._find_file_by_id(self.spec_dir, spec_id)

    def list_proposals(self) -> list[str]:
        """列出所有 proposal 檔案路徑。"""
        return self._list_markdown_files(self.proposals_dir)

    def list_usecases(self) -> list[str]:
        """列出所有 usecase 檔案路徑。"""
        return self._list_markdown_files(self.usecases_dir)

    def list_specs(self, domain: str | None = None) -> list[str]:
        """列出 spec 檔案路徑，可選依 domain 子目錄篩選。"""
        if domain is not None:
            target_dir = os.path.join(self.spec_dir, domain)
        else:
            target_dir = self.spec_dir
        return self._list_markdown_files(target_dir)

    @staticmethod
    def get_project_root() -> str:
        """從當前目錄往上尋找包含 docs/ 的目錄。

        Raises:
            FileNotFoundError: 找不到包含 docs/ 的目錄。
        """
        current = Path.cwd()
        for directory in [current, *current.parents]:
            if (directory / "docs").is_dir():
                return str(directory)
        raise FileNotFoundError("找不到包含 docs/ 的專案根目錄")

    @staticmethod
    def _find_file_by_id(directory: str, file_id: str) -> str | None:
        """在目錄中（含子目錄）尋找檔名包含 file_id 的 .md 檔案。"""
        dir_path = Path(directory)
        if not dir_path.is_dir():
            return None

        for md_file in dir_path.rglob("*.md"):
            if file_id in md_file.stem:
                return str(md_file)
        return None

    @staticmethod
    def _list_markdown_files(directory: str) -> list[str]:
        """列出目錄下（含子目錄）所有 .md 檔案路徑，排序後回傳。"""
        dir_path = Path(directory)
        if not dir_path.is_dir():
            return []

        return sorted(str(f) for f in dir_path.rglob("*.md"))
