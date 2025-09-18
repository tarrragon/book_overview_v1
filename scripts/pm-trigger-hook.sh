#!/bin/bash
# PM 自動觸發 Hook - 敏捷開發進度監控與介入機制
# 檔案: scripts/pm-trigger-hook.sh

set -e

# === 配置參數 ===
CLAUDE_DIR=".claude"
HOOK_LOGS_DIR="$CLAUDE_DIR/hook-logs"
PM_TRIGGER_LOG="$HOOK_LOGS_DIR/pm-trigger-$(date +%Y%m%d_%H%M%S).log"
PM_STATUS_FILE="$CLAUDE_DIR/pm-status.json"
WORK_LOGS_DIR="docs/work-logs"
TODO_FILE="docs/todolist.md"

# 建立必要目錄
mkdir -p "$HOOK_LOGS_DIR"

# === 日誌函數 ===
log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️  $1" | tee -a "$PM_TRIGGER_LOG"
}

log_warning() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1" | tee -a "$PM_TRIGGER_LOG"
}

log_trigger() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 PM TRIGGER: $1" | tee -a "$PM_TRIGGER_LOG"
}

# === PM 觸發決策引擎 ===
check_phase_transition() {
    log_info "檢查 TDD 階段轉換觸發條件"

    # 檢查最新工作日誌的完成狀態標記
    if [[ -d "$WORK_LOGS_DIR" ]]; then
        latest_log=$(ls -t "$WORK_LOGS_DIR"/v*.md 2>/dev/null | head -1)
        if [[ -f "$latest_log" ]]; then
            # 檢查階段完成標記
            if grep -q "✅.*Phase [1-4].*完成" "$latest_log" 2>/dev/null; then
                log_trigger "TDD 階段完成 - 需要 PM 檢視階段轉換"
                return 0
            fi

            # 檢查工作完成標記
            if grep -q "🏁.*工作完成" "$latest_log" 2>/dev/null; then
                log_trigger "工作項目完成 - 需要 PM 規劃下一步"
                return 0
            fi
        fi
    fi
    return 1
}

check_progress_stagnation() {
    log_info "檢查進度停滯情況"

    # 檢查最後工作日誌更新時間 (超過 2 天)
    if [[ -d "$WORK_LOGS_DIR" ]]; then
        latest_log=$(ls -t "$WORK_LOGS_DIR"/v*.md 2>/dev/null | head -1)
        if [[ -f "$latest_log" ]]; then
            last_modified=$(stat -f "%m" "$latest_log" 2>/dev/null || stat -c "%Y" "$latest_log" 2>/dev/null)
            current_time=$(date +%s)
            time_diff=$((current_time - last_modified))

            # 2 天 = 172800 秒
            if [[ $time_diff -gt 172800 ]]; then
                log_trigger "進度停滯超過 2 天 - 需要 PM 介入檢查阻礙"
                return 0
            fi
        fi
    fi

    # 檢查 todolist 中高優先級任務停滯
    if [[ -f "$TODO_FILE" ]]; then
        if grep -q "🔴.*Critical" "$TODO_FILE" && ! grep -q "🔄.*進行中" "$TODO_FILE"; then
            log_trigger "Critical 任務無進展 - 需要 PM 重新評估優先級"
            return 0
        fi
    fi

    return 1
}

check_complexity_overflow() {
    log_info "檢查任務複雜度超標"

    # 檢查技術債務累積 (超過 15 個 TODO/FIXME)
    todo_count=$(find src/ -name "*.js" -exec grep -l "//todo:\|//fixme:\|TODO:\|FIXME:" {} \; 2>/dev/null | wc -l)
    if [[ $todo_count -gt 15 ]]; then
        log_trigger "技術債務累積過多 ($todo_count 個) - 需要 PM 重新規劃債務清理策略"
        return 0
    fi

    # 檢查 ESLint 錯誤數量 (超過 50 個)
    if command -v npm >/dev/null 2>&1; then
        eslint_errors=$(npm run lint 2>/dev/null | grep -c "error" || echo "0")
        if [[ $eslint_errors -gt 50 ]]; then
            log_trigger "ESLint 錯誤過多 ($eslint_errors 個) - 需要 PM 規劃品質修復策略"
            return 0
        fi
    fi

    return 1
}

check_agent_escalation() {
    log_info "檢查 Agent 升級請求"

    # 檢查工作日誌中的升級關鍵字
    if [[ -d "$WORK_LOGS_DIR" ]]; then
        latest_log=$(ls -t "$WORK_LOGS_DIR"/v*.md 2>/dev/null | head -1)
        if [[ -f "$latest_log" ]]; then
            if grep -i -q "升級\|escalat\|無法解決\|超出能力\|重新分配" "$latest_log"; then
                log_trigger "Agent 請求升級 - 需要 PM 進行任務重新分解"
                return 0
            fi
        fi
    fi

    return 1
}

check_milestone_approach() {
    log_info "檢查里程碑接近情況"

    # 檢查版本號接近重要節點
    if [[ -f "package.json" ]]; then
        current_version=$(grep '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/')

        # 檢查是否接近 1.0.0 (如當前為 0.9.x)
        if [[ "$current_version" =~ ^0\.9\. ]]; then
            log_trigger "接近 1.0.0 里程碑 - 需要 PM 檢視發布準備度"
            return 0
        fi

        # 檢查是否接近中版本節點 (如 x.9.y)
        if [[ "$current_version" =~ \.[9]\. ]]; then
            log_trigger "接近中版本里程碑 - 需要 PM 規劃下一版本目標"
            return 0
        fi
    fi

    return 1
}

# === PM 狀態記錄 ===
record_pm_status() {
    local trigger_reason="$1"
    local current_context="$2"

    cat > "$PM_STATUS_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "trigger_reason": "$trigger_reason",
  "current_context": "$current_context",
  "triggered": true,
  "pm_intervention_required": true,
  "work_log_path": "$(ls -t "$WORK_LOGS_DIR"/v*.md 2>/dev/null | head -1)",
  "todo_file_path": "$TODO_FILE"
}
EOF

    log_info "PM 狀態已記錄到 $PM_STATUS_FILE"
}

# === 主要觸發邏輯 ===
main() {
    log_info "🚀 PM 觸發檢查開始"

    local triggered=false
    local trigger_reasons=()

    # 檢查各種觸發條件
    if check_phase_transition; then
        trigger_reasons+=("TDD階段轉換")
        triggered=true
    fi

    if check_progress_stagnation; then
        trigger_reasons+=("進度停滯")
        triggered=true
    fi

    if check_complexity_overflow; then
        trigger_reasons+=("複雜度超標")
        triggered=true
    fi

    if check_agent_escalation; then
        trigger_reasons+=("Agent升級請求")
        triggered=true
    fi

    if check_milestone_approach; then
        trigger_reasons+=("里程碑接近")
        triggered=true
    fi

    # 如果觸發條件滿足，記錄狀態並準備 PM 介入
    if [[ "$triggered" == true ]]; then
        local all_reasons=$(IFS=","; echo "${trigger_reasons[*]}")
        record_pm_status "$all_reasons" "自動觸發檢查"

        log_trigger "滿足觸發條件: $all_reasons"
        log_trigger "建議啟動 rosemary-project-manager 進行：
1. 檢視當前工作進度和阻礙
2. 評估 todolist 優先級調整需求
3. 規劃下一階段工作策略
4. 處理技術債務和品質問題"

        # 建立 PM 提醒檔案
        echo "🚨 PM 介入提醒: $all_reasons" > "$CLAUDE_DIR/PM_INTERVENTION_REQUIRED"

        echo "✅ PM 觸發條件滿足，已設置介入提醒"
    else
        log_info "✅ 無 PM 觸發條件，開發進度正常"
        # 清除可能存在的舊提醒
        rm -f "$CLAUDE_DIR/PM_INTERVENTION_REQUIRED"
    fi

    log_info "🏁 PM 觸發檢查完成"
}

# 執行主函數
main "$@"