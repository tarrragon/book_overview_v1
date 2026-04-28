"""
反向引用更新邏輯回歸測試（migrate.py `_update_cross_references` + `_migrate_single_ticket` + `_batch_migrate`）

來源 Ticket: 0.18.0-W11-003.6（TDD Phase 2 — sage 測試設計 RED 骨架）

測試目標：
鎖定 migrate.py 既有六欄位反向引用更新邏輯，預防未來退化；覆蓋 W11 重組情境。
本檔為 sage Phase 2 設計骨架，所有測試體以 `pytest.fail("RED: ...")` 標示，
由 Phase 3a/3b 實作者依 Given-When-Then 設計補完測試體（含實際 assertion）。

涵蓋的反向引用六欄位（migrate.py:82-182 `_update_cross_references`）：
| 欄位            | 形式                          | 已實作位置        |
| --------------- | ----------------------------- | ----------------- |
| blockedBy       | string list                   | migrate.py:126-131 |
| relatedTo       | string list                   | migrate.py:134-139 |
| children        | string list + dict {id:...}   | migrate.py:142-150 |
| source_ticket   | string                        | migrate.py:153-155 |
| parent_id       | string                        | migrate.py:158-160 |
| spawned_tickets | string list                   | migrate.py:163-168 |

AC 對應（4 條）：
- AC1：單筆 migrate 後父 ticket children（string list + dict 兩形式）自動更新 → TestAC1_*
- AC2：單筆 migrate 後外部 ticket 的 blockedBy/relatedTo/parent_id/source_ticket/
       spawned_tickets 多欄位同步更新 → TestAC2_*
- AC3：批量遷移正確處理跨遷移引用（A→B、C 引用 A 自動改為 B）→ TestAC3_*
- AC4：W11 重組情境（多 child 跨 wave 遷入新父子結構）父子反向引用完整一致 → TestAC4_*

測試環境：
- pytest + tmp_path fixture 隔離 docs/work-logs/v*/tickets/ 結構
- 透過 monkeypatch 將 migrate / paths 模組的 get_project_root 指向 tmp_path
- fixture 模式延續 tests/test_migrate_cross_references.py（W10-037 既有測試）

備註：
- 不修改 migrate.py（sage 僅設計測試，不寫實作）
- 資料殘留清理（W11-002/003 父 ticket children 舊 ID）為 follow-up 0.18.0-W11-003.8，
  不在本測試範圍
"""

from pathlib import Path

import pytest


# ---------------------------------------------------------------------------
# Fixtures（延續 tests/test_migrate_cross_references.py 模式）
# ---------------------------------------------------------------------------


def _write_ticket(tickets_dir: Path, ticket_id: str, extra_fields: dict) -> Path:
    """寫入最小化 Ticket 檔案（含 frontmatter + body）。

    支援欄位形式：
    - 純值：`status: pending`
    - list of string：`children: [a, b]` → `- a` / `- b`
    - list of dict：`children: [{id: a, type: IMP}]` → `- id: a` / `  type: IMP`
    """
    filename = f"{ticket_id}.md"
    path = tickets_dir / filename

    lines = [
        "---",
        f"id: {ticket_id}",
        f"title: Test {ticket_id}",
        "type: IMP",
        "status: pending",
    ]
    for key, value in extra_fields.items():
        if isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                if isinstance(item, dict):
                    items = list(item.items())
                    first_k, first_v = items[0]
                    lines.append(f"  - {first_k}: {first_v}")
                    for k, v in items[1:]:
                        lines.append(f"    {k}: {v}")
                else:
                    lines.append(f"  - {item}")
        else:
            lines.append(f"{key}: {value}")
    lines.append("---")
    lines.append("")
    lines.append("# Body")

    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def _read_frontmatter(path: Path) -> dict:
    """讀取 frontmatter dict。"""
    from ticket_system.lib.parser import parse_frontmatter

    content = path.read_text(encoding="utf-8")
    fm, _ = parse_frontmatter(content)
    return fm


@pytest.fixture
def project_with_tickets(tmp_path, monkeypatch):
    """建立 tmp 專案結構並 patch get_project_root 到 migrate / paths 模組。

    Returns:
        (tmp_path, tickets_dir) — 用於後續寫入測試 ticket
    """
    work_logs = tmp_path / "docs" / "work-logs" / "v0.18.0" / "tickets"
    work_logs.mkdir(parents=True)

    import ticket_system.commands.migrate as migrate_mod
    import ticket_system.lib.paths as paths_mod

    monkeypatch.setattr(migrate_mod, "get_project_root", lambda: tmp_path)
    monkeypatch.setattr(paths_mod, "get_project_root", lambda: tmp_path)

    return tmp_path, work_logs


# ---------------------------------------------------------------------------
# AC1：單筆 migrate 後父 ticket children 自動更新（string + dict 兩形式）
# ---------------------------------------------------------------------------


class TestAC1_ParentChildrenUpdated:
    """AC1：單筆 migrate 後，父 ticket children 自動更新為新 ID。

    覆蓋兩種 children 形式（migrate.py:142-150）：
    - string list：`children: [old_id, ...]`
    - dict list：`children: [{id: old_id, type: IMP}, ...]`
    """

    def test_children_as_string_list_updated(self, project_with_tickets):
        """
        Given: 父 ticket P.children = [old_id, sibling_id]（純 string list）
        When: 對 old_id → new_id 呼叫 _update_cross_references
        Then: P.children = [new_id, sibling_id]，old_id 完全消失
        """
        pytest.fail(
            "RED: phase3 實作者補測試體 — "
            "建立父 ticket（children string list 含 old_id）→ "
            "呼叫 _update_cross_references(old_id, new_id) → "
            "驗證父 ticket children 中 old_id 已替換為 new_id"
        )

    def test_children_as_dict_list_updated(self, project_with_tickets):
        """
        Given: 父 ticket P.children = [{id: old_id, type: IMP}, {id: sibling_id, ...}]
        When: 對 old_id → new_id 呼叫 _update_cross_references
        Then: 對應 dict 中 id 欄位變為 new_id，其他鍵值（type 等）不被破壞
        """
        pytest.fail(
            "RED: phase3 實作者補測試體 — "
            "建立父 ticket（children dict list 含 {id: old_id}）→ "
            "呼叫 _update_cross_references → 驗證對應 dict.id = new_id 且其他欄位保留"
        )

    def test_children_mixed_string_and_dict_forms(self, project_with_tickets):
        """
        Given: 父 ticket P.children 同時混用 string 與 dict 兩種形式且都引用 old_id
        When: 對 old_id → new_id 呼叫 _update_cross_references
        Then: 兩種形式的引用都被更新；剩餘元素不受影響
        """
        pytest.fail(
            "RED: phase3 實作者補測試體 — "
            "建立 children 含 [old_id, {id: old_id}, other_id] 混合形式 → "
            "呼叫更新 → 驗證 string 與 dict 兩處都被替換"
        )

    def test_full_single_migrate_flow_updates_parent_children(
        self, project_with_tickets
    ):
        """
        端到端驗證（透過 _migrate_single_ticket 而非直接呼叫 _update_cross_references）。

        Given: 父 P.children = [old_id]，子 ticket old_id 存在於 disk
        When: _migrate_single_ticket(version, old_id, new_id, dry_run=False, backup=False)
        Then: 子 ticket 已更名為 new_id；父 P.children 同步為 [new_id]
        """
        pytest.fail(
            "RED: phase3 實作者補測試體 — "
            "建父子 ticket → 呼叫 _migrate_single_ticket(dry_run=False, backup=False) → "
            "驗證子 ticket file rename + 父 children 同步更新"
        )


# ---------------------------------------------------------------------------
# AC2：單筆 migrate 後外部 ticket 多欄位同步更新
# ---------------------------------------------------------------------------


class TestAC2_ExternalReferencesUpdated:
    """AC2：外部 ticket 的 blockedBy / relatedTo / parent_id / source_ticket /
    spawned_tickets 引用同步更新。"""

    def test_blockedby_updated(self, project_with_tickets):
        """
        Given: 外部 ticket E.blockedBy = [old_id, other_id]
        When: 對 old_id → new_id 呼叫 _update_cross_references
        Then: E.blockedBy = [new_id, other_id]
        """
        pytest.fail("RED: phase3 補實作 — blockedBy 單欄位更新驗證")

    def test_relatedto_updated(self, project_with_tickets):
        """
        Given: 外部 ticket E.relatedTo = [old_id, other_id]
        When: 對 old_id → new_id 呼叫 _update_cross_references
        Then: E.relatedTo = [new_id, other_id]
        """
        pytest.fail("RED: phase3 補實作 — relatedTo 單欄位更新驗證")

    def test_parent_id_updated(self, project_with_tickets):
        """
        Given: 外部 ticket E.parent_id = old_id
        When: 對 old_id → new_id 呼叫 _update_cross_references
        Then: E.parent_id = new_id
        """
        pytest.fail("RED: phase3 補實作 — parent_id 單欄位更新驗證")

    def test_source_ticket_updated(self, project_with_tickets):
        """
        Given: 外部 ticket E.source_ticket = old_id
        When: 對 old_id → new_id 呼叫 _update_cross_references
        Then: E.source_ticket = new_id
        """
        pytest.fail("RED: phase3 補實作 — source_ticket 單欄位更新驗證")

    def test_spawned_tickets_updated(self, project_with_tickets):
        """
        Given: 外部 ticket E.spawned_tickets = [old_id, other_id]
        When: 對 old_id → new_id 呼叫 _update_cross_references
        Then: E.spawned_tickets = [new_id, other_id]
        """
        pytest.fail("RED: phase3 補實作 — spawned_tickets 單欄位更新驗證")

    def test_multiple_fields_in_single_ticket_all_updated(
        self, project_with_tickets
    ):
        """
        Given: 同一外部 ticket E 同時含 blockedBy / relatedTo / parent_id /
               source_ticket / spawned_tickets 五欄位都引用 old_id
        When: 對 old_id → new_id 呼叫一次 _update_cross_references
        Then: 五欄位同時更新，回傳 updated_count = 1（同檔案只計一次）
        """
        pytest.fail(
            "RED: phase3 補實作 — 單一 ticket 多欄位同時引用 old_id 一次更新驗證 "
            "（同時驗證 updated_count 行為，避免同檔案被重複計數）"
        )


# ---------------------------------------------------------------------------
# AC3：批量遷移正確處理跨遷移引用
# ---------------------------------------------------------------------------


class TestAC3_BatchCrossMigrationReferences:
    """AC3：批量遷移時，遷移序列中前一筆 (A→B) 的舊 ID 引用，
    在後續處理 ticket C（含 blockedBy: [A]）時必須能解析為 B。

    觸發路徑：commands/migrate.py:_batch_migrate（lines 387-450）
    依序呼叫 _migrate_single_ticket，每筆都會掃描全 work-logs 並更新 cross refs。
    """

    def test_batch_migrate_updates_subsequent_references(
        self, project_with_tickets
    ):
        """
        Given:
          - ticket A 存在
          - ticket C.blockedBy = [A.id]
          - migrations.yaml 含單一條目 {from: A, to: B}
        When: _batch_migrate(version, config_file, dry_run=False, backup=False)
        Then:
          - A 已遷移為 B（檔案 rename）
          - C.blockedBy = [B.id]
        """
        pytest.fail(
            "RED: phase3 補實作 — 寫入 migrations.yaml + 兩筆 ticket → "
            "呼叫 _batch_migrate → 驗證 C.blockedBy 從 A 更新為 B"
        )

    def test_batch_migrate_two_step_chain(self, project_with_tickets):
        """
        跨遷移引用情境（更接近實際 W11 重組）：

        Given:
          - tickets A, C 存在；A.blockedBy = []；C.blockedBy = [A]
          - migrations.yaml = [{from: A, to: A_new}, {from: C, to: C_new}]
        When: _batch_migrate 依序處理兩筆
        Then:
          - 處理第 1 筆後：C.blockedBy = [A_new]（C 仍是 C，被 _update_cross_references 修正）
          - 處理第 2 筆後：C 已 rename 為 C_new，且其 blockedBy = [A_new]（保持 A_new 不變）
        """
        pytest.fail(
            "RED: phase3 補實作 — 兩筆遷移序列驗證跨遷移引用 "
            "（A→A_new、C→C_new；C 引用 A 的記錄必須先被更新成 A_new，再被 rename 為 C_new）"
        )

    def test_batch_migrate_with_dict_children_in_parent(
        self, project_with_tickets
    ):
        """
        Given:
          - 父 P 存在，P.children = [{id: A, type: IMP}, {id: D, type: IMP}]
          - migrations.yaml = [{from: A, to: A_new}, {from: D, to: D_new}]
        When: _batch_migrate
        Then: P.children = [{id: A_new, type: IMP}, {id: D_new, type: IMP}]，
              type 等其他欄位完整保留
        """
        pytest.fail(
            "RED: phase3 補實作 — 批量模式下 dict children 兩筆連續更新驗證"
        )


# ---------------------------------------------------------------------------
# AC4：W11 重組情境（多 child 跨 wave 遷入新父子結構）
# ---------------------------------------------------------------------------


class TestAC4_W11ReorganizationScenario:
    """AC4：W11 重組情境完整驗證。

    情境特徵（對應 PM 前台 Phase 1 分析）：
    - 多個 child 從不同 wave (W5 / W10) 遷入單一新父 (W11-XXX)
    - 父 ticket 預先存在且 children 持有舊 ID（string + dict 混合）
    - 外部 ticket 透過 blockedBy / relatedTo / parent_id 等欄位指向部分 child
    - 採用批量模式一次完成

    本測試類為 AC4 主驗收，覆蓋 string children + dict children + 多欄位外部引用
    + 批量跨遷移引用四種情境的整合。
    """

    def test_w11_reorganization_full_consistency(self, project_with_tickets):
        """
        Given (W11 重組初始狀態，模擬實際殘留情境)：
          - 父 P = 0.18.0-W11-003，children = [W5-018, W10-022, {id: W10-038, type: IMP}]
          - child_1 = 0.18.0-W5-018（待遷移到 W11-003.1）
          - child_2 = 0.18.0-W10-022（待遷移到 W11-003.2）
          - child_3 = 0.18.0-W10-038（待遷移到 W11-003.3）
          - 外部 E1.blockedBy = [W5-018]
          - 外部 E2.relatedTo = [W10-022]
          - 外部 E3.parent_id = W10-038
          - migrations.yaml 三筆順序：
              {from: W5-018,  to: W11-003.1}
              {from: W10-022, to: W11-003.2}
              {from: W10-038, to: W11-003.3}

        When: _batch_migrate 執行三筆遷移

        Then:
          - 三個 child 檔案已 rename 為新 ID
          - 父 P.children = [W11-003.1, W11-003.2, {id: W11-003.3, type: IMP}]
            （string 與 dict 形式都被正確更新；順序保持）
          - 父 P 不存在任何舊 ID 殘留
          - E1.blockedBy = [W11-003.1]
          - E2.relatedTo = [W11-003.2]
          - E3.parent_id = W11-003.3
          - 沒有任何 ticket 仍引用 W5-018 / W10-022 / W10-038

        驗證重點：
        - 跨 wave 遷移（W5/W10 → W11）路徑能正確處理
        - 批量序列中後續每筆都觸發完整 cross_references 掃描
        - children 字段 string + dict 混合形式被同等處理
        """
        pytest.fail(
            "RED: phase3 補實作 — AC4 主驗收：W11 重組三筆批量遷移 + "
            "父 children 混合形式更新 + 三類外部引用同步更新 + 零殘留檢查"
        )

    def test_w11_reorganization_idempotency(self, project_with_tickets):
        """
        Given: AC4 主情境執行完成後的 disk 狀態
        When: 再次以同樣 migrations.yaml 執行 _batch_migrate
        Then:
          - 來源 ticket（W5-018 等）已不存在 → 應被視為 skip（exit code path 走 skip_count）
          - 既有新 ID ticket 不被破壞
          - 父 children / 外部引用維持既定的新 ID 狀態，不會再次變動
        """
        pytest.fail(
            "RED: phase3 補實作 — 重複執行 batch migrate 的冪等性與 skip 行為驗證"
        )
