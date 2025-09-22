#!/bin/bash

# 非阻塞式 agent 啟動腳本
# 此腳本會在背景執行，不中斷主要開發流程

TASK_FILE="$1"
PROJECT_ROOT="$2"

if [ ! -f "$TASK_FILE" ]; then
    echo "Error: Task file not found: $TASK_FILE"
    exit 1
fi

# 模擬 agent 工作（在實際環境中，這裡會啟動真正的 Claude Code agents）
echo "[$(date)] 🤖 TodoList Agent 開始工作..."

# 讀取任務資料
SMELL_COUNT=$(jq '.detected_smells | length' "$TASK_FILE" 2>/dev/null || echo "0")
HIGH_PRIORITY=$(jq '.todolist_updates.high_priority_items' "$TASK_FILE" 2>/dev/null || echo "0")

echo "[$(date)] 📊 偵測到 $SMELL_COUNT 個程式異味，其中 $HIGH_PRIORITY 個高優先級"

# 生成 todolist 更新建議
TODOLIST_UPDATE="$PROJECT_ROOT/.claude/hook-logs/todolist-updates-$(date +%Y%m%d_%H%M%S).md"

cat > "$TODOLIST_UPDATE" << 'TODOEOF'
# 🤖 自動生成的 TodoList 更新建議

## 新增項目

TODOEOF

# 從任務檔案提取程式異味並生成 todolist 項目
jq -r '.detected_smells[] | select(.severity == "High" or .severity == "Medium") |
"- 🔄 **[程式異味] 修復 \(.type)** - \(.details)
  - 發現位置: 程式碼檢查
  - 影響評估: \(.severity)
  - 預期修復時間: \(.fix_time)
"' "$TASK_FILE" >> "$TODOLIST_UPDATE" 2>/dev/null

echo "" >> "$TODOLIST_UPDATE"
echo "## 📋 整合建議" >> "$TODOLIST_UPDATE"
echo "" >> "$TODOLIST_UPDATE"
echo "請將以上項目加入 docs/todolist.md 的適當位置，根據影響評估安排優先級。" >> "$TODOLIST_UPDATE"

echo "[$(date)] ✅ TodoList 更新建議已生成: $TODOLIST_UPDATE"
echo "[$(date)] 🤖 TodoList Agent 工作完成"

# 清理任務檔案
rm -f "$TASK_FILE"

