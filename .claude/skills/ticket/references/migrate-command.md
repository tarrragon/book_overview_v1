# migrate 子命令

Ticket ID 遷移（支援單一和批量遷移）。

## 基本用法

```bash
# 單一 Ticket 遷移
/ticket migrate <source_id> <target_id>

# 批量遷移（配置檔案驅動）
/ticket migrate --config migration.yaml

# 預覽模式（不實際執行）
/ticket migrate <source_id> <target_id> --dry-run

# 停用備份
/ticket migrate <source_id> <target_id> --no-backup

# 明示授權覆寫目標 ID 既有 Ticket（W14-048）
/ticket migrate <source_id> <target_id> --force-overwrite
```

## 單一遷移範例

```bash
# 遷移根任務
/ticket migrate 1.0.0-W4-001 1.0.0-W5-001

# 遷移子任務
/ticket migrate 1.0.0-W4-001.1 1.0.0-W5-001.1

# 預覽遷移結果
/ticket migrate 1.0.0-W4-001 1.0.0-W5-001 --dry-run
```

## 批量遷移配置檔案格式

```yaml
# migration.yaml
migrations:
  - from: "1.0.0-W4-001"
    to: "1.0.0-W5-001"
  - from: "1.0.0-W4-001.1"
    to: "1.0.0-W5-001.1"
  - from: "1.0.0-W4-002"
    to: "1.0.0-W5-002"
```

或 JSON 格式：

```json
{
  "migrations": [
    { "from": "1.0.0-W4-001", "to": "1.0.0-W5-001" },
    { "from": "1.0.0-W4-001.1", "to": "1.0.0-W5-001.1" }
  ]
}
```

## 遷移邏輯

遷移會自動更新以下欄位：

| 欄位             | 更新邏輯                |
| ---------------- | ----------------------- |
| `id`             | 直接替換為目標 ID       |
| `wave`           | 從目標 ID 提取波次號    |
| `chain.root`     | 重新計算根 ID           |
| `chain.parent`   | 重新計算父 ID           |
| `chain.depth`    | 重新計算深度            |
| `chain.sequence` | 重新計算序號            |
| `parent_id`      | 根據新的 chain 資訊更新 |
| `blockedBy`      | 更新所有 Ticket ID 引用 |
| `children`       | 更新子任務 ID 引用      |
| `source_ticket`  | 更新來源引用            |

## Collision Detection（W14-048）

遷移會檢查目標 ID 是否與既有 Ticket 撞檔：

| 階段       | 行為                                                                                |
| ---------- | ----------------------------------------------------------------------------------- |
| `--dry-run`  | 目標已存在時輸出 `[WARNING] 目標 Ticket 已存在，實際執行時將被覆寫`，exit 0       |
| 實際執行   | 預設拒絕並 exit 1（顯示既有 Ticket 的標題/狀態，提示 `--force-overwrite` 旗標）     |
| 批量遷移   | 預掃描所有 target_id；任一撞 ID 即 fail-fast，**不執行任何 migration**             |
| `--force-overwrite` | 明示授權覆寫，並在 stdout 記錄 `[AUDIT]` log（含時間戳與既有標題）        |

例外：`source_id == target_id`（in-place rename）不視為 collision。

## 備份機制

預設情況下，遷移前會自動建立備份：

- 備份位置：`.claude/migration-backups/{timestamp}/`
- 支援 `--no-backup` 停用備份

## 選項說明

| 選項            | 說明                               |
| --------------- | ---------------------------------- |
| `--config FILE` | 批量遷移配置檔案（.yaml 或 .json） |
| `--version VER` | 指定版本（預設自動偵測）           |
| `--dry-run`     | 預覽遷移結果，不實際執行           |
| `--backup`      | 遷移前備份（預設啟用）             |
| `--no-backup`   | 停用備份                           |
| `--force-overwrite` | 明示授權覆寫目標 ID 既有 Ticket（W14-048；會記錄 audit log） |
