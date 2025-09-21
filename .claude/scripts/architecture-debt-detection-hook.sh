#!/bin/bash

# architecture-debt-detection-hook.sh
# 架構債務偵測 Hook - 檢測重複實作和架構設計問題 (Chrome Extension 版本)
# 強制執行正確的修正順序：文件 → 測試 → 實作

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK_LOGS_DIR="$PROJECT_ROOT/.claude/hook-logs"
ARCHITECTURE_ISSUES_FILE="$HOOK_LOGS_DIR/architecture-issues.md"

# 確保日誌目錄存在
mkdir -p "$HOOK_LOGS_DIR"

# 顏色定義
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日誌函數
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$HOOK_LOGS_DIR/architecture-debt-$(date +%Y%m%d).log"
}

error_log() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$HOOK_LOGS_DIR/architecture-debt-$(date +%Y%m%d).log"
}

warning_log() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$HOOK_LOGS_DIR/architecture-debt-$(date +%Y%m%d).log"
}

# =============================================================================
# Chrome Extension 架構債務偵測邏輯
# =============================================================================

detect_duplicate_implementations() {
    # 使用重導向分離日誌和檢測結果
    {
        log "🔍 檢查 Chrome Extension 重複實作模式..."
    } >&2

    local duplicate_found=false
    local issues=""

    # 檢查是否有多個相同名稱的服務或模組
    local service_files=$(find "$PROJECT_ROOT/src" -name "*service.js" -o -name "*api.js" -o -name "*manager.js" 2>/dev/null)

    # 建立服務名稱對應檔案的映射
    local service_map_file="$HOOK_LOGS_DIR/.service_map.tmp"
    > "$service_map_file"

    for file in $service_files; do
        # 提取服務名稱（移除路徑和副檔名）
        local service_name=$(basename "$file" .js)

        # 檢查是否已經存在相同名稱的服務
        local existing_file=$(grep "^$service_name=" "$service_map_file" | cut -d'=' -f2)
        if [[ -n "$existing_file" ]]; then
            duplicate_found=true
            issues+="- **重複服務**: $service_name 存在於:\n"
            issues+="  - $existing_file\n"
            issues+="  - $file\n\n"
            { warning_log "⚠️  發現重複服務: $service_name"; } >&2
        else
            echo "$service_name=$file" >> "$service_map_file"
        fi
    done

    # 檢查 Chrome Extension 特定的重複模式
    local storage_count=$(grep -r "chrome\.storage\." "$PROJECT_ROOT/src" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$storage_count" -gt 5 ]; then
        duplicate_found=true
        { warning_log "⚠️  發現過多的 Chrome Storage 操作: $storage_count 個，可能存在重複邏輯"; } >&2
        issues+="- **Chrome Storage 邏輯分散**: 發現 $storage_count 個存儲操作\n\n"
    fi

    # 檢查 API 請求重複
    local api_request_count=$(grep -r "fetch\|XMLHttpRequest" "$PROJECT_ROOT/src" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$api_request_count" -gt 3 ]; then
        duplicate_found=true
        { warning_log "⚠️  發現過多的 API 請求方法: $api_request_count 個，可能存在重複邏輯"; } >&2
        issues+="- **API 請求邏輯分散**: 發現 $api_request_count 個 API 請求\n\n"
    fi

    # 清理臨時檔案
    rm -f "$service_map_file"

    if [ "$duplicate_found" = true ]; then
        echo "$issues"
        return 0
    fi

    return 1
}

check_architecture_principles() {
    {
        log "🏗️  檢查 Chrome Extension 架構原則遵循狀況..."
    } >&2

    local violations=""
    local has_violations=false

    # 檢查是否有跨模組的直接依賴
    local cross_module_deps=$(find "$PROJECT_ROOT/src" -name "*.js" -exec grep -l "import.*\.\..*\.\./" {} \; 2>/dev/null | wc -l | tr -d ' ')
    if [ "$cross_module_deps" -gt 0 ]; then
        has_violations=true
        violations+="- **跨模組深層依賴**: 發現 $cross_module_deps 個深層相對路徑\n"
        { warning_log "⚠️  應避免深層相對路徑引用"; } >&2
    fi

    # 檢查 manifest.json 與實際檔案一致性
    if [ -f "$PROJECT_ROOT/src/manifest.json" ]; then
        local manifest_scripts=$(grep -o '"[^"]*\.js"' "$PROJECT_ROOT/src/manifest.json" | wc -l | tr -d ' ')
        local actual_scripts=$(find "$PROJECT_ROOT/src" -name "*.js" | wc -l | tr -d ' ')
        if [ "$manifest_scripts" -ne "$actual_scripts" ]; then
            has_violations=true
            violations+="- **Manifest 不一致**: manifest.json 中的腳本數與實際檔案數不符\n"
            { warning_log "⚠️  Manifest 與實際檔案不一致"; } >&2
        fi
    fi

    if [ "$has_violations" = true ]; then
        echo "$violations"
        return 0
    fi

    return 1
}

check_test_architecture_consistency() {
    {
        log "🧪 檢查 Chrome Extension 測試架構一致性..."
    } >&2

    local issues=""
    local has_issues=false

    # 檢查是否有測試檔案
    local test_files=$(find "$PROJECT_ROOT" -name "*test*.js" -o -name "*spec*.js" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$test_files" -eq 0 ]; then
        has_issues=true
        issues+="- **缺少測試檔案**: 未發現任何測試檔案\n"
        { warning_log "⚠️  Chrome Extension 應包含測試檔案"; } >&2
    fi

    # 檢查是否在生產檔案中使用 console.log
    local console_logs=$(grep -r "console\.log" "$PROJECT_ROOT/src" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$console_logs" -gt 0 ]; then
        has_issues=true
        issues+="- **生產環境除錯代碼**: 發現 $console_logs 處 console.log\n"
        { warning_log "⚠️  生產環境不應包含 console.log"; } >&2
    fi

    if [ "$has_issues" = true ]; then
        echo "$issues"
        return 0
    fi

    return 1
}

generate_refactoring_order() {
    cat <<EOF

## 🔄 Chrome Extension 架構債務修正順序

### Phase 1: 規劃文件修正 📝
1. 檢查並更新 Chrome Extension 架構設計文件
2. 統一 API 整合需求描述
3. 移除重複的設計規格
4. 更新 manifest.json 配置

### Phase 2: 測試架構統一 🧪
1. 建立統一的測試框架
2. 統一 Mock 和測試環境管理
3. 確保測試隔離原則
4. 移除生產環境除錯代碼

### Phase 3: 模組重構 🏗️
1. 移除重複實作
2. 實施模組化設計模式
3. 統一 Chrome API 使用方式
4. 優化跨模組通訊

### Phase 4: 架構最佳化 🔧
1. 建立統一的服務層
2. 實作配置管理
3. 優化效能和記憶體使用

**重要**: 絕不可跳過前面的步驟直接進行程式碼重構！

EOF
}

write_architecture_issues_report() {
    local issues="$1"

    # 先寫入報告內容，使用 printf 處理轉義字符
    {
        echo "# Chrome Extension 架構債務偵測報告"
        echo ""
        echo "**檢測時間**: $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
        echo "## 🚨 發現的架構問題"
        echo ""
        printf "%b" "$issues"
        echo ""
        echo "## ✅ 建議修正流程"
        echo ""
        generate_refactoring_order
        echo ""
        echo "## ⚠️ 注意事項"
        echo ""
        echo "1. **不要直接重構程式碼** - 先修正文件和測試"
        echo "2. **遵循正確順序** - 文件 → 測試 → 實作 → 介面"
        echo "3. **確保測試通過** - 每個階段都要維持功能正常"
        echo "4. **記錄變更** - 在工作日誌中詳細記錄每個修正步驟"
        echo "5. **Chrome Extension 特殊考量** - 注意 manifest.json 和權限管理"
        echo ""
        echo "---"
        echo ""
        echo "*此報告由 Chrome Extension 架構債務偵測 Hook 自動生成*"
    } > "$ARCHITECTURE_ISSUES_FILE"

    log "📄 Chrome Extension 架構問題報告已寫入: $ARCHITECTURE_ISSUES_FILE"
}

trigger_architecture_review() {
    error_log "🚨 偵測到 Chrome Extension 架構債務，觸發架構審查流程"

    # 建立架構審查標記檔案
    touch "$PROJECT_ROOT/.claude/ARCHITECTURE_REVIEW_REQUIRED"

    # 輸出警告訊息到 stderr（避免干擾 Hook 系統）
    {
        cat <<EOF

${RED}════════════════════════════════════════════════════════════════${NC}
${RED}🚨 Chrome Extension 架構債務警告 🚨${NC}
${RED}════════════════════════════════════════════════════════════════${NC}

${YELLOW}偵測到 Chrome Extension 架構設計問題！${NC}

${CYAN}請遵循以下步驟：${NC}

1. ${GREEN}查看架構問題報告${NC}
   cat $ARCHITECTURE_ISSUES_FILE

2. ${GREEN}執行架構審查${NC}
   - 檢查 manifest.json 配置
   - 確認測試架構是否一致
   - 評估重構的影響範圍

3. ${GREEN}按照正確順序修正${NC}
   文件 → 測試 → 實作 → 介面

${YELLOW}⚠️  請勿直接進行程式碼重構！${NC}

${RED}════════════════════════════════════════════════════════════════${NC}

EOF
    } >&2

    return 0
}

# =============================================================================
# 主執行邏輯
# =============================================================================

main() {
    log "🏗️  Chrome Extension 架構債務偵測 Hook 開始執行"

    local has_issues=false
    local all_issues=""

    # 使用臨時檔案避免日誌混入變數
    local temp_dir="$HOOK_LOGS_DIR/.temp"
    mkdir -p "$temp_dir"

    local duplicate_file="$temp_dir/duplicate.tmp"
    local arch_file="$temp_dir/arch.tmp"
    local test_file="$temp_dir/test.tmp"

    # 執行各項檢查，將純淨結果寫入臨時檔案
    if detect_duplicate_implementations > "$duplicate_file" && [ -s "$duplicate_file" ]; then
        has_issues=true
        all_issues+="### 重複實作問題\n$(cat "$duplicate_file")\n"
    fi

    if check_architecture_principles > "$arch_file" && [ -s "$arch_file" ]; then
        has_issues=true
        all_issues+="### 架構原則違規\n$(cat "$arch_file")\n"
    fi

    if check_test_architecture_consistency > "$test_file" && [ -s "$test_file" ]; then
        has_issues=true
        all_issues+="### 測試架構問題\n$(cat "$test_file")\n"
    fi

    # 清理臨時檔案
    rm -rf "$temp_dir"

    # 如果發現問題，生成報告並觸發審查
    if [ "$has_issues" = true ]; then
        log "📋 生成 Chrome Extension 重構順序..."
        write_architecture_issues_report "$all_issues"
        trigger_architecture_review
        log "🚨 架構債務已記錄，請查看報告進行修正"
        # Hook 系統中不使用 exit 1，通過報告文件傳遞問題
    else
        log "✅ 未發現 Chrome Extension 架構債務問題"
        # 清理架構審查標記（如果存在）
        rm -f "$PROJECT_ROOT/.claude/ARCHITECTURE_REVIEW_REQUIRED"
    fi

    log "✅ Chrome Extension 架構債務偵測 Hook 執行完成"
}

# 執行主函數
main "$@"