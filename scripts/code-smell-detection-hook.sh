#!/bin/bash

# code-smell-detection-hook.sh
# PostToolUse Hook: 自動偵測程式異味並啟動 agents 更新 todolist

# 設定路徑和日誌
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/.claude/hook-logs/code-smell-$(date +%Y%m%d_%H%M%S).log"
SMELL_REPORT_DIR="$PROJECT_ROOT/.claude/hook-logs/smell-reports"

# 確保目錄存在
mkdir -p "$PROJECT_ROOT/.claude/hook-logs"
mkdir -p "$SMELL_REPORT_DIR"

# 日誌函數
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "👃 Code Smell Detection Hook: 開始程式異味偵測"

cd "$PROJECT_ROOT"

# 檢查是否有程式碼變更
CHANGED_FILES=$(git status --porcelain)
if [ -z "$CHANGED_FILES" ]; then
    log "📝 未偵測到檔案變更，跳過程式異味檢查"
    exit 0
fi

# 初始化偵測結果
DETECTED_SMELLS=()
SMELL_DETAILS=()
SEVERITY_LEVELS=()

# 1. 偵測程式異味模式
log "🔍 開始程式異味模式偵測"

# 分析變更的 JavaScript 檔案
JS_FILES=$(echo "$CHANGED_FILES" | grep -E "\.js$" | awk '{print $2}')

if [ -n "$JS_FILES" ]; then
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            log "🔍 檢查檔案: $file"

            # 1.1 長函數偵測 (超過30行)
            LONG_FUNCTIONS=$(awk '
            /^[[:space:]]*function[[:space:]]+[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*\(/ ||
            /^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*:[[:space:]]*function[[:space:]]*\(/ ||
            /^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*=[[:space:]]*function[[:space:]]*\(/ ||
            /^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*\([^)]*\)[[:space:]]*{/ {
                func_start = NR
                func_name = $0
                brace_count = 0
                for (i = 1; i <= length($0); i++) {
                    char = substr($0, i, 1)
                    if (char == "{") brace_count++
                    if (char == "}") brace_count--
                }
            }
            /{/ {
                for (i = 1; i <= length($0); i++) {
                    char = substr($0, i, 1)
                    if (char == "{") brace_count++
                }
            }
            /}/ {
                for (i = 1; i <= length($0); i++) {
                    char = substr($0, i, 1)
                    if (char == "}") brace_count--
                }
                if (brace_count == 0 && func_start > 0) {
                    func_length = NR - func_start + 1
                    if (func_length > 30) {
                        print func_name " at line " func_start " (" func_length " lines)"
                    }
                    func_start = 0
                }
            }' "$file")

            if [ -n "$LONG_FUNCTIONS" ]; then
                DETECTED_SMELLS+=("Long Function")
                SMELL_DETAILS+=("$file: $LONG_FUNCTIONS")
                SEVERITY_LEVELS+=("Medium")
                log "⚠️  發現長函數: $file"
            fi

            # 1.2 重複程式碼偵測 (相似的程式碼區塊)
            DUPLICATE_LINES=$(sort "$file" | uniq -c | awk '$1 > 1 && length($0) > 50 {count++} END {print count+0}')
            if [ "$DUPLICATE_LINES" -gt 5 ]; then
                DETECTED_SMELLS+=("Code Duplication")
                SMELL_DETAILS+=("$file: 可能有 $DUPLICATE_LINES 處重複程式碼")
                SEVERITY_LEVELS+=("High")
                log "⚠️  發現重複程式碼: $file"
            fi

            # 1.3 深層巢狀偵測 (超過4層)
            DEEP_NESTING=$(awk '
            {
                indent = 0
                for (i = 1; i <= length($0); i++) {
                    char = substr($0, i, 1)
                    if (char == "{") indent++
                }
                if (indent > max_indent) max_indent = indent
            }
            END {print max_indent+0}' "$file")

            if [ "$DEEP_NESTING" -gt 4 ]; then
                DETECTED_SMELLS+=("Deep Nesting")
                SMELL_DETAILS+=("$file: 最大巢狀層級 $DEEP_NESTING")
                SEVERITY_LEVELS+=("Medium")
                log "⚠️  發現深層巢狀: $file"
            fi

            # 1.4 大型類別偵測 (超過200行)
            if grep -q "class\|function.*prototype" "$file"; then
                FILE_LINES=$(wc -l < "$file")
                if [ "$FILE_LINES" -gt 200 ]; then
                    DETECTED_SMELLS+=("Large Class")
                    SMELL_DETAILS+=("$file: $FILE_LINES 行")
                    SEVERITY_LEVELS+=("Medium")
                    log "⚠️  發現大型類別: $file"
                fi
            fi

            # 1.5 魔術數字偵測
            MAGIC_NUMBERS=$(grep -n -E "[^a-zA-Z_][0-9]{2,}[^a-zA-Z_]" "$file" | grep -v -E "//|/\*|\*/" | wc -l)
            if [ "$MAGIC_NUMBERS" -gt 3 ]; then
                DETECTED_SMELLS+=("Magic Numbers")
                SMELL_DETAILS+=("$file: 發現 $MAGIC_NUMBERS 處可能的魔術數字")
                SEVERITY_LEVELS+=("Low")
                log "⚠️  發現魔術數字: $file"
            fi

            # 1.6 過長參數列表偵測 (超過5個參數)
            LONG_PARAMETERS=$(grep -n -E "function.*\([^)]*," "$file" | awk -F'(' '{
                params = $2
                gsub(/\s/, "", params)
                split(params, arr, ",")
                if (length(arr) > 5) print NR ": " length(arr) " parameters"
            }')

            if [ -n "$LONG_PARAMETERS" ]; then
                DETECTED_SMELLS+=("Long Parameter List")
                SMELL_DETAILS+=("$file: $LONG_PARAMETERS")
                SEVERITY_LEVELS+=("Medium")
                log "⚠️  發現過長參數列表: $file"
            fi

            # 1.7 不一致的命名風格偵測
            NAMING_ISSUES=$(grep -n -E "var |let |const " "$file" | grep -E "_[A-Z]|[a-z][A-Z].*_|[A-Z].*[a-z].*[A-Z]" | wc -l)
            if [ "$NAMING_ISSUES" -gt 2 ]; then
                DETECTED_SMELLS+=("Inconsistent Naming")
                SMELL_DETAILS+=("$file: 發現 $NAMING_ISSUES 處命名風格不一致")
                SEVERITY_LEVELS+=("Low")
                log "⚠️  發現命名風格問題: $file"
            fi

        fi
    done <<< "$JS_FILES"
fi

# 2. 分析架構層級的異味
log "🏗️  檢查架構層級異味"

# 2.1 循環依賴偵測
CIRCULAR_DEPS=$(find src/ -name "*.js" -type f 2>/dev/null | xargs grep -l "require\|import" | while read file; do
    # 簡化的循環依賴檢查
    DEPS=$(grep -E "require\(|import.*from" "$file" | grep -E "src/" | wc -l)
    if [ "$DEPS" -gt 10 ]; then
        echo "$file: $DEPS dependencies"
    fi
done)

if [ -n "$CIRCULAR_DEPS" ]; then
    DETECTED_SMELLS+=("High Coupling")
    SMELL_DETAILS+=("可能的高耦合檔案: $CIRCULAR_DEPS")
    SEVERITY_LEVELS+=("High")
    log "⚠️  發現高耦合模式"
fi

# 2.2 神秘類別偵測 (多於10個方法)
GOD_CLASSES=$(find src/ -name "*.js" -type f 2>/dev/null | while read file; do
    METHOD_COUNT=$(grep -c -E "^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*{|^\s*[a-zA-Z_][a-zA-Z0-9_]*:\s*function" "$file")
    if [ "$METHOD_COUNT" -gt 10 ]; then
        echo "$file: $METHOD_COUNT methods"
    fi
done)

if [ -n "$GOD_CLASSES" ]; then
    DETECTED_SMELLS+=("God Class")
    SMELL_DETAILS+=("$GOD_CLASSES")
    SEVERITY_LEVELS+=("High")
    log "⚠️  發現神秘類別"
fi

# 3. 生成程式異味報告
if [ ${#DETECTED_SMELLS[@]} -gt 0 ]; then
    log "📋 偵測到 ${#DETECTED_SMELLS[@]} 個程式異味，準備啟動 agents"

    # 生成詳細報告
    REPORT_FILE="$SMELL_REPORT_DIR/smell-report-$(date +%Y%m%d_%H%M%S).md"
    cat > "$REPORT_FILE" << EOF
# 👃 程式異味偵測報告

**偵測時間**: $(date)
**檔案範圍**: $(echo "$JS_FILES" | wc -l) 個 JavaScript 檔案

## 🚨 發現的程式異味

EOF

    # 按嚴重程度分組
    for severity in "High" "Medium" "Low"; do
        echo "### $severity 優先級" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"

        for i in "${!DETECTED_SMELLS[@]}"; do
            if [ "${SEVERITY_LEVELS[$i]}" = "$severity" ]; then
                echo "#### ${DETECTED_SMELLS[$i]}" >> "$REPORT_FILE"
                echo "- **詳細資訊**: ${SMELL_DETAILS[$i]}" >> "$REPORT_FILE"
                echo "- **建議修復時間**: $(case "$severity" in
                    "High") echo "立即" ;;
                    "Medium") echo "下一循環" ;;
                    "Low") echo "規劃中" ;;
                esac)" >> "$REPORT_FILE"
                echo "" >> "$REPORT_FILE"
            fi
        done
    done

    cat >> "$REPORT_FILE" << EOF

## 🔧 修復建議

### High 優先級修復
- **God Class**: 使用 Extract Class 重構手法
- **High Coupling**: 引入介面和依賴注入
- **Code Duplication**: 提煉公用函數

### Medium 優先級修復
- **Long Function**: 使用 Extract Method 分解
- **Deep Nesting**: 使用 Guard Clauses 減少巢狀
- **Large Class**: 按職責分解類別

### Low 優先級修復
- **Magic Numbers**: 定義具名常數
- **Inconsistent Naming**: 統一命名規範

## 📋 TodoList 更新建議

以下項目建議加入 docs/todolist.md:

EOF

    # 為每個 High 和 Medium 異味生成 todolist 項目
    for i in "${!DETECTED_SMELLS[@]}"; do
        severity="${SEVERITY_LEVELS[$i]}"
        if [ "$severity" = "High" ] || [ "$severity" = "Medium" ]; then
            echo "- 🔄 **[程式異味] 修復 ${DETECTED_SMELLS[$i]}** - ${SMELL_DETAILS[$i]}" >> "$REPORT_FILE"
            echo "  - 發現位置: 程式碼檢查" >> "$REPORT_FILE"
            echo "  - 影響評估: $severity" >> "$REPORT_FILE"
            echo "  - 預期修復時間: $(case "$severity" in
                "High") echo "立即" ;;
                "Medium") echo "下一循環" ;;
            esac)" >> "$REPORT_FILE"
            echo "" >> "$REPORT_FILE"
        fi
    done

    log "📋 程式異味報告已生成: $REPORT_FILE"

    # 4. 啟動 agents 自動更新 todolist
    log "🤖 啟動 agents 更新 todolist"

    # 建立 agent 任務檔案
    AGENT_TASK_FILE="$PROJECT_ROOT/.claude/hook-logs/agent-task-$(date +%Y%m%d_%H%M%S).json"
    cat > "$AGENT_TASK_FILE" << EOF
{
  "task_type": "update_todolist",
  "priority": "medium",
  "trigger": "code_smell_detection",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "code-smell-detection-hook",
  "report_file": "$REPORT_FILE",
  "detected_smells": [
EOF

    # 加入偵測到的異味資料
    for i in "${!DETECTED_SMELLS[@]}"; do
        cat >> "$AGENT_TASK_FILE" << EOF
    {
      "type": "${DETECTED_SMELLS[$i]}",
      "severity": "${SEVERITY_LEVELS[$i]}",
      "details": "${SMELL_DETAILS[$i]}",
      "fix_time": "$(case "${SEVERITY_LEVELS[$i]}" in
        "High") echo "立即" ;;
        "Medium") echo "下一循環" ;;
        "Low") echo "規劃中" ;;
      esac)"
    }$([ $((i + 1)) -lt ${#DETECTED_SMELLS[@]} ] && echo ",")
EOF
    done

    cat >> "$AGENT_TASK_FILE" << EOF
  ],
  "todolist_updates": {
    "high_priority_items": $(echo "${DETECTED_SMELLS[@]}" | tr ' ' '\n' | grep -c "High" || echo "0"),
    "medium_priority_items": $(echo "${DETECTED_SMELLS[@]}" | tr ' ' '\n' | grep -c "Medium" || echo "0"),
    "estimated_effort": "$(if [ ${#DETECTED_SMELLS[@]} -gt 5 ]; then echo "高"; elif [ ${#DETECTED_SMELLS[@]} -gt 2 ]; then echo "中"; else echo "低"; fi)"
  }
}
EOF

    log "📋 Agent 任務檔案已建立: $AGENT_TASK_FILE"

    # 建立 agent 啟動腳本（非阻塞式）
    AGENT_SCRIPT="$PROJECT_ROOT/.claude/hook-logs/start-todolist-agent-$(date +%Y%m%d_%H%M%S).sh"
    cat > "$AGENT_SCRIPT" << 'EOF'
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

EOF

    chmod +x "$AGENT_SCRIPT"

    # 在背景啟動 agent（不阻塞當前流程）
    nohup bash "$AGENT_SCRIPT" "$AGENT_TASK_FILE" "$PROJECT_ROOT" > /dev/null 2>&1 &

    log "🚀 已啟動背景 agent 處理 todolist 更新 (PID: $!)"
    log "💡 開發流程可以繼續，agent 會自動在背景處理問題追蹤"

else
    log "✅ 未偵測到程式異味，程式碼品質良好"
fi

# 5. 清理舊的報告檔案 (保留最近10個)
find "$SMELL_REPORT_DIR" -name "smell-report-*.md" | sort -r | tail -n +11 | xargs rm -f 2>/dev/null

log "✅ Code Smell Detection Hook 執行完成"

# 返回成功 (不阻止後續操作)
exit 0