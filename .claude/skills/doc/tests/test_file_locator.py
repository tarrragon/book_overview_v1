"""file_locator 單元測試。"""

import os

from doc_system.core.file_locator import FileLocator


def _create_doc_tree(root):
    """在 root 下建立測試用的 docs/ 目錄結構。"""
    proposals = root / "docs" / "proposals"
    usecases = root / "docs" / "usecases"
    spec = root / "docs" / "spec" / "auth"

    proposals.mkdir(parents=True)
    usecases.mkdir(parents=True)
    spec.mkdir(parents=True)

    (proposals / "PROP-001-login.md").write_text("---\ntitle: Login\n---\n")
    (proposals / "PROP-002-export.md").write_text("---\ntitle: Export\n---\n")
    (usecases / "UC01-browse.md").write_text("---\ntitle: Browse\n---\n")
    (spec / "SPEC-auth-flow.md").write_text("---\ntitle: Auth Flow\n---\n")

    return root


class TestFindProposal:
    """find_proposal 測試。"""

    def test_find_existing_proposal(self, tmp_path):
        root = _create_doc_tree(tmp_path)
        locator = FileLocator(str(root))

        result = locator.find_proposal("PROP-001")

        assert result is not None
        assert "PROP-001-login.md" in result

    def test_find_nonexistent_proposal(self, tmp_path):
        root = _create_doc_tree(tmp_path)
        locator = FileLocator(str(root))

        result = locator.find_proposal("PROP-999")

        assert result is None


class TestFindUsecase:
    """find_usecase 測試。"""

    def test_find_existing_usecase(self, tmp_path):
        root = _create_doc_tree(tmp_path)
        locator = FileLocator(str(root))

        result = locator.find_usecase("UC01")

        assert result is not None
        assert "UC01-browse.md" in result


class TestFindSpec:
    """find_spec 測試。"""

    def test_find_existing_spec(self, tmp_path):
        root = _create_doc_tree(tmp_path)
        locator = FileLocator(str(root))

        result = locator.find_spec("SPEC-auth")

        assert result is not None
        assert "SPEC-auth-flow.md" in result


class TestListMethods:
    """list_proposals / list_usecases / list_specs 測試。"""

    def test_list_proposals(self, tmp_path):
        root = _create_doc_tree(tmp_path)
        locator = FileLocator(str(root))

        result = locator.list_proposals()

        assert len(result) == 2

    def test_list_usecases(self, tmp_path):
        root = _create_doc_tree(tmp_path)
        locator = FileLocator(str(root))

        result = locator.list_usecases()

        assert len(result) == 1

    def test_list_specs_with_domain(self, tmp_path):
        root = _create_doc_tree(tmp_path)
        locator = FileLocator(str(root))

        result = locator.list_specs(domain="auth")

        assert len(result) == 1

    def test_list_specs_empty_domain(self, tmp_path):
        root = _create_doc_tree(tmp_path)
        locator = FileLocator(str(root))

        result = locator.list_specs(domain="nonexistent")

        assert result == []


class TestGetProjectRoot:
    """get_project_root 測試。"""

    def test_finds_root_from_subdir(self, tmp_path):
        _create_doc_tree(tmp_path)
        subdir = tmp_path / "some" / "nested" / "dir"
        subdir.mkdir(parents=True)

        original_cwd = os.getcwd()
        try:
            os.chdir(subdir)
            result = FileLocator.get_project_root()
            assert result == str(tmp_path)
        finally:
            os.chdir(original_cwd)
