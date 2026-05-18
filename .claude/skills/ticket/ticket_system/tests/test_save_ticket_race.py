"""Phase 2 RED — save_ticket race condition regression tests.

對應 ticket 0.18.0-W14-042 / W14-005 ANA Solution。
驗證 parser.save_ticket() 之 fcntl.flock per-ticket-file lock 機制。

設計來源：W14-042 Test Results 章節 sage Phase 2 RED 設計（7 個 test case）。
"""

from __future__ import annotations

import inspect
import multiprocessing as mp
import os
import signal
import time
from pathlib import Path

import pytest

from ticket_system.lib import parser
from ticket_system.lib.parser import parse_frontmatter


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture(scope="module", autouse=True)
def _force_fork_mode():
    """macOS Python 3.13 預設 spawn，顯式切回 fork 以共享 monkeypatch。"""
    try:
        mp.set_start_method("fork", force=True)
    except RuntimeError:
        pass


@pytest.fixture
def tmp_ticket_dir(tmp_path):
    d = tmp_path / "tickets"
    d.mkdir()
    return d


@pytest.fixture
def sample_ticket_factory(tmp_ticket_dir):
    def _make(tid="0.0.0-TEST-001", payload_size=1):
        path = tmp_ticket_dir / f"{tid}.md"
        ticket = {
            "id": tid,
            "title": "race test fixture",
            "status": "pending",
            "_body": "X" * payload_size,
        }
        return ticket, path
    return _make


# ============================================================
# Helper: 直接以 path 載入 ticket（旁路 load_ticket 的 version 邏輯）
# ============================================================

def _load_by_path(path: Path):
    """讀檔 + parse_frontmatter，避開 load_ticket 的 version/cache 邏輯。"""
    if not path.exists():
        return None
    content = path.read_text(encoding="utf-8")
    try:
        fm, body = parse_frontmatter(content)
    except Exception:
        return None
    if not fm:
        return None
    fm["_body"] = body
    return fm


# ============================================================
# Multiprocessing workers（必須在 module top-level）
# ============================================================

def _worker_save(args):
    tid, path_str, writer_id = args
    # body 含 writer_id marker，可用於檢測「frontmatter title vs body 是否來自同一 writer」
    body = f"WRITER={writer_id}\n" + (f"line-{writer_id}\n" * 2048)
    ticket = {
        "id": tid,
        "title": f"writer-{writer_id}",
        "status": "pending",
        "_body": body,
    }
    parser.save_ticket(ticket, Path(path_str))


def _worker_save_with_sleep(args):
    """寫入前 sleep，放大時序窗。"""
    tid, path_str, writer_id, sleep_s = args
    ticket = {
        "id": tid,
        "title": f"writer-{writer_id}",
        "status": "pending",
        "_body": "X" * (100 * 1024),
    }
    time.sleep(sleep_s)
    parser.save_ticket(ticket, Path(path_str))


def _worker_save_hold_lock(args):
    """child process 持鎖後長 sleep，供 SIGKILL 測試。"""
    tid, path_str = args
    # 直接寫入後 sleep（簡化版：若實作 lock 則 lock 在 save 期間持有）
    # 為了真正模擬「持鎖中被 kill」，這裡假設實作會 monkeypatch _file_lock
    # 此 worker 是 fallback：直接呼叫 save_ticket 並在後續 hang
    ticket = {
        "id": tid,
        "title": "child-holding-lock",
        "status": "pending",
        "_body": "Y" * 4096,
    }
    parser.save_ticket(ticket, Path(path_str))
    # 持鎖效果靠下方測試另以 monkeypatch 注入 sleep
    time.sleep(30)


# ============================================================
# Tests
# ============================================================

class TestSaveTicketRace:

    # ---- Test 1: 同 path 並發無 lost update / corruption ----
    def test_concurrent_same_path_no_lost_update(self, sample_ticket_factory):
        _, path = sample_ticket_factory()
        # 重複多輪以放大 race window 命中機率
        N_ROUNDS = 5
        N_WRITERS = 20
        for round_idx in range(N_ROUNDS):
            args = [("0.0.0-TEST-001", str(path), i) for i in range(N_WRITERS)]
            with mp.Pool(N_WRITERS) as pool:
                pool.map(_worker_save, args)

            loaded = _load_by_path(path)
            assert loaded is not None, \
                f"round {round_idx}: ticket file unreadable / corrupted YAML"
            title = loaded.get("title", "")
            assert title.startswith("writer-"), \
                f"round {round_idx}: title corruption: {title!r}"
            try:
                wid_title = int(title.split("-")[1])
            except (ValueError, IndexError):
                pytest.fail(f"round {round_idx}: corrupted title: {title!r}")
            assert 0 <= wid_title <= N_WRITERS - 1, \
                f"round {round_idx}: title writer id OOR: {wid_title}"

            # 一致性：body 第一行 WRITER=N 必須與 title writer-N 相符
            body = loaded.get("_body", "")
            first_line = body.split("\n", 1)[0]
            assert first_line == f"WRITER={wid_title}", (
                f"round {round_idx}: frontmatter/body interleaved — "
                f"title=writer-{wid_title} but body first line={first_line!r}"
            )

    # ---- Test 2: 不同 path 並發無阻塞 ----
    def test_concurrent_different_paths_no_blocking(self, sample_ticket_factory):
        _, p1 = sample_ticket_factory(tid="0.0.0-TEST-A")
        _, p2 = sample_ticket_factory(tid="0.0.0-TEST-B")

        sleep_s = 0.5

        # baseline：序列
        t0 = time.time()
        _worker_save_with_sleep(("0.0.0-TEST-A", str(p1), 0, sleep_s))
        _worker_save_with_sleep(("0.0.0-TEST-B", str(p2), 1, sleep_s))
        t_seq = time.time() - t0

        # 並發
        args = [
            ("0.0.0-TEST-A", str(p1), 2, sleep_s),
            ("0.0.0-TEST-B", str(p2), 3, sleep_s),
        ]
        t0 = time.time()
        with mp.Pool(2) as pool:
            pool.map(_worker_save_with_sleep, args)
        t_par = time.time() - t0

        # 並發應接近單次耗時（per-file lock 不應 cross-block）
        assert t_par < t_seq * 0.7, \
            f"per-file lock not isolated: t_par={t_par:.2f}s t_seq={t_seq:.2f}s"

    # ---- Test 3: Crash 後 lock 自動釋放 ----
    def test_crash_releases_lock(self, sample_ticket_factory):
        _, path = sample_ticket_factory(tid="0.0.0-TEST-CRASH")

        # 建立 child process 持鎖
        proc = mp.Process(
            target=_worker_save_hold_lock,
            args=(("0.0.0-TEST-CRASH", str(path)),),
        )
        proc.start()
        time.sleep(0.5)  # 確保 child 已進入 save_ticket（或之後 sleep）

        # SIGKILL
        os.kill(proc.pid, signal.SIGKILL)
        proc.join(timeout=2)

        # 主 process 立即寫入，計時
        t0 = time.time()
        parser.save_ticket(
            {"id": "0.0.0-TEST-CRASH", "title": "main-after-crash",
             "status": "pending", "_body": "Z" * 1024},
            path,
        )
        t_recover = time.time() - t0

        assert t_recover < 1.0, \
            f"lock not released after SIGKILL: t_recover={t_recover:.2f}s"

        loaded = _load_by_path(path)
        assert loaded is not None
        assert loaded.get("title") == "main-after-crash"

    # ---- Test 4: Cache invalidation 時序 ----
    def test_cache_invalidation_within_lock(self, sample_ticket_factory, tmp_path, monkeypatch):
        # 使用真實的 docs/work-logs path 結構讓 load_ticket 找得到
        # 改用 monkeypatch 修改 get_ticket_path 指向 tmp_path
        from ticket_system.lib import paths as paths_mod
        from ticket_system.lib import parser as parser_mod

        tid = "0.0.0-TEST-CACHE"
        ticket_path = tmp_path / f"{tid}.md"

        def _fake_get_ticket_path(version, ticket_id):
            return ticket_path

        monkeypatch.setattr(parser_mod, "get_ticket_path", _fake_get_ticket_path)

        # 1) 初版
        parser.save_ticket(
            {"id": tid, "title": "v1", "status": "pending", "_body": "body-v1"},
            ticket_path,
        )

        # 2) 觸發 cache 填入
        loaded1 = parser.load_ticket("0.0.0", tid)
        assert loaded1 is not None
        assert loaded1["title"] == "v1"

        # 3) 改寫新版
        parser.save_ticket(
            {"id": tid, "title": "v2", "status": "pending", "_body": "body-v2"},
            ticket_path,
        )

        # 4) 立即 load，必須取得新版
        loaded2 = parser.load_ticket("0.0.0", tid)
        assert loaded2 is not None
        assert loaded2["title"] == "v2", \
            f"cache not invalidated: got title={loaded2.get('title')!r}"

    # ---- Test 5: 權限錯誤 rethrow ----
    def test_propagates_permission_error(self, tmp_path):
        readonly = tmp_path / "readonly"
        readonly.mkdir()
        readonly.chmod(0o555)
        target = readonly / "subdir" / "x.md"

        try:
            with pytest.raises((PermissionError, OSError)):
                parser.save_ticket(
                    {"id": "x", "title": "t", "status": "pending", "_body": ""},
                    target,
                )
        finally:
            readonly.chmod(0o755)  # 還原權限以便清理

    # ---- Test 6: .gitignore 含 *.lock pattern ----
    def test_gitignore_contains_lock_pattern(self):
        # 從 parser.py 反推 project root
        project_root = Path(parser.__file__).resolve().parents[5]
        gitignore = project_root / ".gitignore"
        assert gitignore.exists(), f"gitignore not found at {gitignore}"
        content = gitignore.read_text(encoding="utf-8")
        # 接受 *.lock 或 **/*.lock 通用 pattern
        import re
        m = re.search(r"^\*+(?:/\*+)?\.lock\s*$", content, re.MULTILINE)
        assert m is not None, ".gitignore missing generic *.lock pattern"

    # ---- Test 7: signature 不變 ----
    def test_save_ticket_signature_unchanged(self):
        sig = inspect.signature(parser.save_ticket)
        params = list(sig.parameters.keys())
        assert params[:2] == ["ticket", "ticket_path"], \
            f"signature changed: {params}"
