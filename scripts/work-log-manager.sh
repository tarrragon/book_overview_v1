#!/bin/bash

# 工作日誌管理腳本
# 處理工作日誌的三種狀況：更新進行中、新建工作、完成總結

set -euo pipefail

# ==========================================
# 設定區塊 - 可外部化的配置項目
# ==========================================
readonly WORK_LOGS_DIR="${WORK_LOGS_DIR:-docs/work-logs}"
readonly TODOLIST_FILE="${TODOLIST_FILE:-docs/todolist.md}"
readonly EXAMPLES_FILE="${EXAMPLES_FILE:-docs/claude/code-quality-examples.md}"

# 支援的版本前綴 (可透過環境變數覆蓋)
readonly SUPPORTED_VERSION_PREFIXES="${SUPPORTED_VERSION_PREFIXES:-v0.9 v0.10 v0.11 v0.12 v1.0}"

# 完成標記模式 (可透過環境變數新增更多)
readonly COMPLETION_PATTERNS="${COMPLETION_PATTERNS:-工作完成總結|✅ 工作完成總結|完成總結|工作狀態.*✅.*已完成|此工作項目已完成}"

# 依賴清單
readonly REQUIRED_DEPS="${REQUIRED_DEPS:-git date grep sed}"

# 版本檔案設定
readonly VERSION_SOURCES="${VERSION_SOURCES:-CHANGELOG.md package.json}"
readonly DEFAULT_VERSION="${DEFAULT_VERSION:-0.10.1}"

# 日期格式設定
readonly DATE_FORMAT="${DATE_FORMAT:-%Y-%m-%d}"

# 工作狀態設定
readonly WORK_STATUS_IN_PROGRESS="${WORK_STATUS_IN_PROGRESS:-🔄 進行中}"
readonly WORK_STATUS_COMPLETED="${WORK_STATUS_COMPLETED:-✅ 已完成}"
readonly WORK_STATUS_INCOMPLETE="${WORK_STATUS_INCOMPLETE:-⚠️ 未完成 (議題切換自動結案)}"

# ==========================================
# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# 日誌函數
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_prompt() {
    echo -e "${CYAN}[PROMPT]${NC} $1"
}

# 安全的檔案寫入函數
write_file_safely() {
    local target_file="$1"
    local temp_file
    
    temp_file=$(mktemp) || {
        log_error "無法建立臨時檔案"
        return 1
    }
    
    # 從標準輸入讀取內容寫入臨時檔案
    cat > "$temp_file" || {
        log_error "寫入臨時檔案失敗"
        rm -f "$temp_file"
        return 1
    }
    
    # 原子性地移動檔案
    if ! mv "$temp_file" "$target_file"; then
        log_error "無法更新檔案: $target_file"
        rm -f "$temp_file"
        return 1
    fi
    
    log_success "已安全更新檔案: $target_file"
}

# 安全建立臨時檔案的通用函數
create_temp_file() {
    local temp_file
    
    temp_file=$(mktemp) || {
        log_error "無法建立臨時檔案"
        return 1
    }
    
    # 將臨時檔案加入清理清單
    temp_files+=("$temp_file")
    echo "$temp_file"
}

# 生成工作日誌基本標頭的共用函數
generate_work_log_header() {
    local version="${1:-}"
    local work_description="${2:-}"
    local today="${3:-}"
    local status="${4:-$WORK_STATUS_IN_PROGRESS}"
    
    cat << EOF
# ${version} ${work_description} 工作日誌

**開發版本**: ${version}  
**開發日期**: ${today}  
**主要任務**: ${work_description}  
**工作狀態**: ${status}  
**開發者**: Claude Code

## 🎯 工作目標與背景

### 本期工作重點

(請描述本期工作的主要目標和背景)
EOF
}

# 生成每日工作記錄區塊的共用函數
generate_daily_work_section() {
    local date="$1"
    
    cat << EOF

## 📅 ${date} 開發記錄

### 完成的工作

- 

### 技術實現要點

- 

### 遇到的問題與解決方案

- 

### 下一步計劃

- 

---
EOF
}

# 生成工作進度追蹤區塊的共用函數
generate_progress_tracking_section() {
    cat << EOF

## 工作進度追蹤

- [ ] 需求分析完成
- [ ] 設計方案確定  
- [ ] 核心功能實現
- [ ] 測試驗證
- [ ] 文件更新
- [ ] 程式碼審查

---
EOF
}

# 生成工作日誌結尾的共用函數
generate_work_log_footer() {
    local work_description="$1"
    
    cat << EOF

*📝 工作狀態說明: 此工作日誌記錄 ${work_description} 的開發過程，當前狀態為進行中。*
EOF
}

# 臨時檔案清理
temp_files=()
cleanup_temp_files() {
    # 檢查陣列是否為空，避免 set -u 錯誤
    if [[ ${#temp_files[@]:-0} -gt 0 ]]; then
        for temp_file in "${temp_files[@]}"; do
            [[ -f "$temp_file" ]] && rm -f "$temp_file"
        done
    fi
}
trap cleanup_temp_files EXIT

# 檢查外部依賴
check_dependencies() {
    local deps_array missing_deps=()
    
    # 將設定字串轉換為陣列
    read -ra deps_array <<< "$REQUIRED_DEPS"
    
    for dep in "${deps_array[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            missing_deps+=("$dep")
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "缺少必要依賴: ${missing_deps[*]}"
        return 1
    fi
}

# 獲取當前專案真實版本 (以最新工作日誌為準)
get_current_project_version() {
    local version=""
    
    # 檢查工作日誌目錄是否存在
    if [[ ! -d "$WORK_LOGS_DIR" ]]; then
        log_warning "工作日誌目錄不存在: $WORK_LOGS_DIR"
    else
        # 優先從最新工作日誌獲取版本 (這是最準確的當前版本)
        local latest_log=$(ls "${WORK_LOGS_DIR}"/v[0-9]*.*.*.md 2>/dev/null | sort -V | tail -1)
        if [[ -n "$latest_log" && -f "$latest_log" ]]; then
            local latest_version=$(echo "$latest_log" | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+')
            if [[ -n "$latest_version" ]]; then
                version=$(echo "$latest_version" | sed 's/v//')
                # 驗證版本格式
                if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                    log_warning "工作日誌中的版本格式不正確: $version"
                    version=""
                fi
            fi
        fi
    fi
    
    # 備用：從 CHANGELOG.md 獲取版本 (僅作為 fallback)
    if [[ -z "$version" ]]; then
        if [[ -f "CHANGELOG.md" && -r "CHANGELOG.md" ]]; then
            local changelog_version=$(grep -E "^## \[v[0-9]+\.[0-9]+\.[0-9]+\]" CHANGELOG.md | head -1 | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+' | sed 's/v//' 2>/dev/null || true)
            if [[ -n "$changelog_version" && "$changelog_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                version="$changelog_version"
            fi
        else
            log_warning "CHANGELOG.md 不存在或不可讀"
        fi
    fi
    
    # 再備用：從 package.json 獲取版本
    if [[ -z "$version" ]]; then
        if [[ -f "package.json" && -r "package.json" ]]; then
            local package_version=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' package.json | cut -d'"' -f4 2>/dev/null || true)
            if [[ -n "$package_version" && "$package_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                version="$package_version"
            fi
        else
            log_warning "package.json 不存在或不可讀"
        fi
    fi
    
    # 最後備用：設定檔指定的默認版本
    if [[ -z "$version" ]]; then
        log_warning "無法從任何來源獲取版本資訊，使用默認版本: $DEFAULT_VERSION"
        version="$DEFAULT_VERSION"
    fi
    
    # 最終驗證
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_error "無效的版本格式: $version"
        version="$DEFAULT_VERSION"
    fi
    
    echo "$version"
}

# 遞增版本號 (用於議題切換時建立新版本)
increment_version() {
    local current_version="$1"
    
    # 輸入驗證
    if [[ -z "$current_version" ]]; then
        log_error "increment_version: 版本號不能為空"
        return 1
    fi
    
    # 驗證版本格式
    if [[ ! "$current_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_error "increment_version: 無效的版本格式: $current_version"
        return 1
    fi
    
    # 提取版本號組件
    local major minor patch
    IFS='.' read -r major minor patch <<< "$current_version"
    
    # 檢查是否為有效數字
    if [[ ! "$major" =~ ^[0-9]+$ ]] || [[ ! "$minor" =~ ^[0-9]+$ ]] || [[ ! "$patch" =~ ^[0-9]+$ ]]; then
        log_error "increment_version: 版本號組件包含非數字: $current_version"
        return 1
    fi
    
    # 遞增 patch 版本並檢查溢位
    local new_patch
    if (( patch >= 999 )); then
        log_warning "patch 版本號已達上限 (999)，將遞增 minor 版本"
        new_patch=0
        minor=$((minor + 1))
        if (( minor >= 999 )); then
            log_warning "minor 版本號已達上限 (999)，將遞增 major 版本"
            minor=0
            major=$((major + 1))
        fi
    else
        new_patch=$((patch + 1))
    fi
    
    echo "$major.$minor.$new_patch"
}

# 更新 todolist.md 的版本和日期資訊
update_todolist_version() {
    local todolist_file="$TODOLIST_FILE"
    local current_version="v$(get_current_project_version)"
    local today
    today=$(date +"$DATE_FORMAT")
    
    if [[ ! -f "$todolist_file" ]]; then
        log_error "todolist.md 不存在，無法更新版本資訊"
        return 1
    fi
    
    log_info "更新 todolist.md 版本資訊到 $current_version"
    
    # 使用安全的檔案寫入
    {
        while IFS= read -r line; do
            if [[ "$line" == "**當前版本"* ]]; then
                echo "**當前版本**: $current_version  "
            elif [[ "$line" == "**最後更新"* ]]; then
                echo "**最後更新**: $today  "
            else
                echo "$line"
            fi
        done < "$todolist_file"
    } | write_file_safely "$todolist_file"
    
    log_success "已更新 todolist.md 版本資訊: $current_version ($today)"
}

# 獲取最新的工作日誌檔案
get_latest_work_log() {
    local work_log_dir="$WORK_LOGS_DIR"
    
    # 檢查目錄是否存在且可讀
    if [[ ! -d "$work_log_dir" ]]; then
        log_error "get_latest_work_log: 工作日誌目錄不存在: $work_log_dir"
        return 1
    fi
    
    if [[ ! -r "$work_log_dir" ]]; then
        log_error "get_latest_work_log: 無法讀取工作日誌目錄: $work_log_dir"
        return 1
    fi
    
    # 獲取所有版本的工作日誌，按版本號排序找到最新的
    local latest_log
    latest_log=$(ls "$work_log_dir"/v[0-9]*.*.*.md 2>/dev/null | sort -V | tail -1)
    
    if [[ -n "$latest_log" && -f "$latest_log" && -r "$latest_log" ]]; then
        # 驗證檔名格式
        local filename=$(basename "$latest_log")
        if [[ "$filename" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-.+\.md$ ]]; then
            echo "$latest_log"
        else
            log_warning "get_latest_work_log: 最新檔案格式不正確: $filename"
            return 1
        fi
    else
        log_warning "get_latest_work_log: 找不到或無法讀取版本工作日誌檔案"
        return 1
    fi
}

# 提取工作日誌議題關鍵字
extract_work_topic() {
    local log_file="$1"
    local filename=$(basename "$log_file")
    
    # 從檔名提取議題 (v0.10.7-terminology-standardization.md -> terminology-standardization)
    # 使用 bash 正規表示式來提取議題部分
    if [[ "$filename" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-(.*).md$ ]]; then
        local topic="${BASH_REMATCH[1]}"
        echo "$topic"
    else
        # 如果不符合標準格式，返回整個檔名（去除副檔名）
        echo "$(echo "$filename" | sed 's/\.md$//')"
    fi
}

# 檢查是否為不同議題的工作切換
is_topic_switch() {
    local current_topic="${1:-}"
    local previous_log="${2:-}"
    
    if [[ -z "$previous_log" ]]; then
        echo "false"
        return
    fi
    
    local previous_topic=$(extract_work_topic "$previous_log")
    
    # 比較議題關鍵字
    if [[ "$current_topic" != "$previous_topic" ]]; then
        echo "true"
    else
        echo "false"
    fi
}

# 檢查工作日誌是否有今日記錄
has_today_entry() {
    local log_file="$1"
    local today
    today=$(date +"$DATE_FORMAT")
    
    if [[ ! -f "$log_file" ]]; then
        echo "false"
        return
    fi
    
    if grep -q "$today" "$log_file"; then
        echo "true"
    else
        echo "false"
    fi
}

# 檢查工作是否已完成
is_work_completed() {
    local log_file="$1"
    
    if [[ ! -f "$log_file" ]]; then
        echo "false"
        return
    fi
    
    # 檢查多種完成標記
    if grep -qiE "### 工作完成總結|## ✅ 工作完成總結|## 完成總結" "$log_file" || \
       grep -qiE "\*\*工作狀態\*\*.*✅.*已完成" "$log_file" || \
       grep -qiE "此工作項目已完成" "$log_file"; then
        echo "true"
    else
        echo "false"
    fi
}

# 檢查工作日誌版本是否正確
is_version_correct() {
    local log_file="$1"
    local log_version current_version
    
    if [[ ! -f "$log_file" ]]; then
        echo "false"
        return
    fi
    
    log_version=$(basename "$log_file" | grep -o '^v[0-9]\+\.[0-9]\+\.[0-9]\+')
    current_version="v$(get_current_project_version)"
    
    # 檢查版本是否合理 (移除硬編碼的版本號)
    if [[ "$log_version" == "$current_version" ]] || [[ -n "$log_version" ]]; then
        echo "true"
    else
        echo "false"
    fi
}

# 分析最新工作日誌狀態 (重構後的簡化版本)
analyze_latest_work_log() {
    local log_file="$1"
    
    if [[ ! -f "$log_file" ]]; then
        log_error "工作日誌檔案不存在: $log_file"
        return 1
    fi
    
    log_info "分析工作日誌: $log_file"
    
    local has_today=$(has_today_entry "$log_file")
    local is_completed=$(is_work_completed "$log_file")
    local version_correct=$(is_version_correct "$log_file")
    local log_version=$(basename "$log_file" | grep -o '^v[0-9]\+\.[0-9]\+\.[0-9]\+')
    local current_version="v$(get_current_project_version)"
    
    echo "has_today_entry:$has_today"
    echo "is_completed:$is_completed"
    echo "version_correct:$version_correct"
    echo "log_version:$log_version"
    echo "current_version:$current_version"
}

# 決定工作日誌操作類型 (含議題切換檢測)
determine_work_log_action() {
    local latest_log="$1"
    local proposed_topic="${2:-}"  # 新增參數：提議的新工作議題 (可選)
    
    if [[ -z "$latest_log" ]]; then
        echo "create_new"
        return
    fi
    
    local analysis=$(analyze_latest_work_log "$latest_log")
    local has_today_entry=$(echo "$analysis" | grep "has_today_entry:" | cut -d':' -f2)
    local is_completed=$(echo "$analysis" | grep "is_completed:" | cut -d':' -f2)
    local version_correct=$(echo "$analysis" | grep "version_correct:" | cut -d':' -f2)
    
    # 議題切換檢測
    local is_switching="false"
    if [[ -n "$proposed_topic" ]]; then
        is_switching=$(is_topic_switch "$proposed_topic" "$latest_log")
    fi
    
    # 決策邏輯 (含議題切換處理)
    if [[ "$is_completed" == "true" ]]; then
        echo "create_new"  # 上一個工作已完成，建立新的
    elif [[ "$version_correct" == "false" ]]; then
        echo "create_new"  # 版本號錯誤，建立正確版本的新日誌
    elif [[ "$is_switching" == "true" && "$is_completed" == "false" ]]; then
        echo "topic_switch_create_new"  # 議題切換且上一個工作未完成
    elif [[ "$has_today_entry" == "true" ]]; then
        echo "update_existing"  # 更新現有的進行中工作
    else
        echo "update_existing"  # 在現有日誌中新增今日記錄
    fi
}

# 互動式選擇工作狀態
prompt_work_status() {
    echo ""
    log_prompt "請選擇當前工作的狀態："
    echo ""
    echo "1) 📝 更新進行中的工作 (在現有工作日誌中新增今日記錄)"
    echo "2) 🆕 開始新的工作項目 (建立新的工作日誌檔案)"
    echo "3) ✅ 完成當前工作 (在現有工作日誌中新增完成總結)"
    echo "4) 🔄 取消操作"
    echo ""
    
    local attempts=0
    local max_attempts=5
    
    while (( attempts < max_attempts )); do
        read -p "請選擇 [1-4]: " choice
        
        # 移除前後空白
        choice=$(echo "$choice" | tr -d ' \t')
        
        case "$choice" in
            1|"update_existing") echo "update_existing"; return 0 ;;
            2|"create_new") echo "create_new"; return 0 ;;
            3|"complete_current") echo "complete_current"; return 0 ;;
            4|"cancel"|"q"|"quit") echo "cancel"; return 0 ;;
            "") 
                echo "請輸入選擇，不能為空" 
                ;;
            *) 
                echo "無效選擇: '$choice'，請輸入 [1-4]" 
                ;;
        esac
        
        attempts=$((attempts + 1))
        
        if (( attempts >= max_attempts )); then
            log_error "達到最大嘗試次數 ($max_attempts)，操作取消"
            echo "cancel"
            return 1
        fi
        
        if (( attempts > 2 )); then
            echo "(剩餘 $((max_attempts - attempts)) 次嘗試機會)"
        fi
    done
}

# 處理議題切換建立新工作日誌 (自動完結上一個)
create_new_with_topic_switch() {
    local latest_log="$1"
    local current_version=$(get_current_project_version)
    local new_version="v$(increment_version "$current_version")"
    local today=$(date +%Y-%m-%d)
    
    # 輸入驗證與重試機制
    local work_description=""
    local attempts=0
    local max_attempts=3
    
    while (( attempts < max_attempts )); do
        log_prompt "請輸入新工作項目的簡短描述 (例如: api-refactor, ui-enhancement):"
        read -p "工作描述: " work_description
        
        # 移除前後空白
        work_description=$(echo "$work_description" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        
        # 驗證輸入
        if [[ -z "$work_description" ]]; then
            echo "工作描述不能為空"
        elif [[ ${#work_description} -lt 3 ]]; then
            echo "工作描述太短，至少需要 3 個字元"
        elif [[ ${#work_description} -gt 50 ]]; then
            echo "工作描述太長，最多 50 個字元"
        elif [[ "$work_description" =~ [^a-zA-Z0-9\-_] ]]; then
            echo "工作描述只能包含字母、數字、連字符和底線"
        else
            break
        fi
        
        attempts=$((attempts + 1))
        
        if (( attempts >= max_attempts )); then
            log_error "達到最大嘗試次數 ($max_attempts)，操作取消"
            return 1
        fi
        
        echo "(剩餘 $((max_attempts - attempts)) 次嘗試機會)"
    done
    
    # 先自動完結上一個未完成工作
    auto_complete_previous_work "$latest_log" "$work_description"
    
    # 然後建立新的工作日誌
    local new_log_file="$WORK_LOGS_DIR/${new_version}-${work_description}.md"
    
    log_info "建立新工作日誌: $new_log_file (版本遞增: $current_version → $new_version)"
    
    # 使用共用函數產生日誌內容
    {
        generate_work_log_header "$new_version" "$work_description" "$today"
        generate_daily_work_section "$today"
        generate_progress_tracking_section
        generate_work_log_footer "$work_description"
    } > "$new_log_file"

    log_success "新工作日誌已建立: $new_log_file"
    echo ""
    log_info "請編輯該檔案並填入具體的工作內容"
    
    echo "$new_log_file"
}

# 建立新的工作日誌檔案
create_new_work_log() {
    local today=$(date +%Y-%m-%d)
    
    # 🎯 版本推進檢查與自動更新
    log_info "執行版本推進檢查..."
    ./scripts/version-progression-check.sh >/dev/null 2>&1
    local check_result=$?
    if [[ $check_result -ne 0 ]]; then
        case $check_result in
            1)  # patch version
                local current_version=$(get_current_project_version)
                local new_patch_version=$(increment_version "$current_version")
                log_info "建議小版本推進: $current_version → $new_patch_version"
                
                echo ""
                log_prompt "🔄 檢測到應該推進小版本 (patch)，是否自動更新？"
                read -p "自動推進版本到 $new_patch_version？ (y/N): " -r
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    # 更新 package.json 版本
                    if ./scripts/check-version-sync.sh >/dev/null 2>&1 || sed -i.bak "s/\"version\":[[:space:]]*\"[^\"]*\"/\"version\": \"$new_patch_version\"/" package.json; then
                        log_success "✅ 版本已更新到 $new_patch_version"
                        echo ""
                        log_info "💡 請記住將 package.json 的變更加入到此次提交中"
                    else
                        log_warning "版本更新失敗，將繼續使用當前版本"
                    fi
                fi
                ;;
            2)  # minor version
                local current_version=$(get_current_project_version)
                local version_parts=(${current_version//./ })
                local new_minor_version="${version_parts[0]}.$((${version_parts[1]} + 1)).0"
                log_info "建議中版本推進: $current_version → $new_minor_version"
                
                echo ""
                log_prompt "🎯 檢測到應該推進中版本 (minor)，是否自動更新？"
                read -p "自動推進版本到 $new_minor_version？ (y/N): " -r
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    # 更新 package.json 版本
                    if ./scripts/check-version-sync.sh >/dev/null 2>&1 || sed -i.bak "s/\"version\":[[:space:]]*\"[^\"]*\"/\"version\": \"$new_minor_version\"/" package.json; then
                        log_success "✅ 版本已更新到 $new_minor_version"
                        echo ""
                        log_info "💡 請記住將 package.json 的變更加入到此次提交中"
                        log_info "💡 建議更新 todolist.md 規劃新版本系列目標"
                    else
                        log_warning "版本更新失敗，將繼續使用當前版本"
                    fi
                fi
                ;;
            0|99|*)  # no change or manual decision
                log_info "無需版本推進或需要手動決策，繼續當前版本開發"
                ;;
        esac
    else
        log_warning "版本推進檢查執行失敗，繼續使用當前版本"
    fi
    echo ""
    
    # 重新獲取（可能已更新的）當前版本
    local version="v$(get_current_project_version)"
    
    # 輸入驗證與重試機制
    local work_description=""
    local attempts=0
    local max_attempts=3
    
    while (( attempts < max_attempts )); do
        log_prompt "請輸入新工作項目的簡短描述 (例如: api-refactor, ui-enhancement):"
        read -p "工作描述: " work_description
        
        # 移除前後空白
        work_description=$(echo "$work_description" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        
        # 驗證輸入
        if [[ -z "$work_description" ]]; then
            echo "工作描述不能為空"
        elif [[ ${#work_description} -lt 3 ]]; then
            echo "工作描述太短，至少需要 3 個字元"
        elif [[ ${#work_description} -gt 50 ]]; then
            echo "工作描述太長，最多 50 個字元"
        elif [[ "$work_description" =~ [^a-zA-Z0-9\-_] ]]; then
            echo "工作描述只能包含字母、數字、連字符和底線"
        else
            break
        fi
        
        attempts=$((attempts + 1))
        
        if (( attempts >= max_attempts )); then
            log_error "達到最大嘗試次數 ($max_attempts)，操作取消"
            return 1
        fi
        
        echo "(剩餘 $((max_attempts - attempts)) 次嘗試機會)"
    done
    
    local new_log_file="$WORK_LOGS_DIR/${version}-${work_description}.md"
    
    log_info "建立新工作日誌: $new_log_file"
    
    # 使用共用函數產生日誌內容
    {
        generate_work_log_header "$version" "$work_description" "$today"
        generate_daily_work_section "$today"
        generate_progress_tracking_section
        generate_work_log_footer "$work_description"
    } > "$new_log_file"

    log_success "新工作日誌已建立: $new_log_file"
    echo ""
    log_info "請編輯該檔案並填入具體的工作內容"
    
    echo "$new_log_file"
    
    # 更新 todolist.md 版本資訊
    update_todolist_version
    
    # 同步版本檢查
    log_info "執行版本同步檢查..."
    if ! ./scripts/check-version-sync.sh >/dev/null 2>&1; then
        log_warning "⚠️ 版本可能不同步，建議檢查 package.json 和 CHANGELOG.md"
    fi
}

# 更新現有工作日誌
update_existing_work_log() {
    local log_file="$1"
    local today=$(date +%Y-%m-%d)
    
    log_info "更新現有工作日誌: $log_file"
    
    # 檢查是否已有今日記錄
    if grep -q "$today" "$log_file"; then
        log_warning "已存在今日記錄，建議直接編輯檔案"
        return 0
    fi
    
    # 在檔案中新增今日記錄
    local temp_file
    temp_file=$(create_temp_file) || return 1
    local inserted=false
    
    while IFS= read -r line; do
        echo "$line" >> "$temp_file"
        
        # 尋找適當位置插入今日記錄
        if [[ "$line" =~ ^## && "$inserted" == "false" ]]; then
            # 在第一個 ## 標題前插入今日記錄
            generate_daily_work_section "$today" >> "$temp_file"
            inserted=true
        fi
    done < "$log_file"
    
    # 如果沒有找到合適位置，在檔案末尾新增
    if [[ "$inserted" == "false" ]]; then
        generate_daily_work_section "$today" >> "$temp_file"
    fi
    
    mv "$temp_file" "$log_file"
    
    log_success "已在工作日誌中新增今日記錄"
    echo ""
    log_info "請編輯檔案並填入具體的工作內容"
}

# 自動完結上一個未完成工作並新增 TODO 檢查項目
auto_complete_previous_work() {
    local previous_log="${1:-}"
    local current_topic="${2:-}"
    local today=$(date +%Y-%m-%d)
    
    log_warning "檢測到議題切換：正在自動完結上一個未完成工作"
    
    local previous_topic=$(extract_work_topic "$previous_log")
    log_info "上一個工作議題: $previous_topic"
    log_info "當前工作議題: $current_topic"
    
    # 更新上一個工作日誌的狀態
    sed -i.bak "s/\*\*工作狀態\*\*.*$/\*\*工作狀態\*\*: $WORK_STATUS_INCOMPLETE/" "$previous_log"
    
    # 新增自動結案說明
    cat >> "$previous_log" << EOF

---

## ⚠️ 議題切換自動結案 (${today})

**結案原因**: 檢測到工作議題切換 ($previous_topic → $current_topic)，系統自動結案此工作項目。

**未完成工作狀態**: 此工作項目因議題切換而自動結案，相關未完成工作已記錄到 TODO 清單中以便後續檢查。

### 🔍 後續檢查要點

- 確認此工作是否需要繼續完成
- 評估未完成工作對專案的影響
- 決定是否在適當時機重新開始

**📋 檢查項目已新增到**: docs/todolist.md

---

**⚠️ 此工作項目因議題切換自動結案，請檢查 TODO 清單確認後續處理方式。**

*自動結案日期: ${today}*
EOF

    log_success "已自動完結上一個工作: $previous_log"
    
    # 新增 TODO 檢查項目
    add_todo_incomplete_work_check "$previous_topic" "$previous_log"
}

# 新增未完成工作檢查項目到 todolist.md
add_todo_incomplete_work_check() {
    local work_topic="${1:-}"
    local work_log_file="${2:-}"
    local today=$(date +%Y-%m-%d)
    
    log_info "新增未完成工作檢查項目到 todolist.md"
    
    local todolist_file="$TODOLIST_FILE"
    local work_log_basename=$(basename "$work_log_file")
    
    # 檢查 todolist.md 是否存在
    if [[ ! -f "$todolist_file" ]]; then
        log_warning "todolist.md 不存在，將建立新檔案"
        cat > "$todolist_file" << EOF
# 📋 Readmoo 書庫提取器開發任務清單

**當前版本**: v$(get_current_project_version)  
**最後更新**: $today  
**開發狀態**: 🔧 開發中

## 🎯 當前高優先級任務

### ⚠️ 未完成工作檢查項目 (自動生成)

- [ ] 檢查「${work_topic}」工作是否需要繼續完成
  - 工作日誌: ${work_log_basename}
  - 結案原因: 議題切換自動結案
  - 新增日期: ${today}
  - 狀態: 待檢查

EOF
    else
        # 先更新版本資訊
        update_todolist_version
        
        # 在現有 todolist.md 中新增檢查項目
        # 尋找合適的位置插入（在第一個 ## 標題後）
        local temp_file
        temp_file=$(create_temp_file) || return 1
        local inserted=false
        
        while IFS= read -r line; do
            echo "$line" >> "$temp_file"
            
            # 在第一個 ## 標題後插入
            if [[ "$line" =~ ^## && "$inserted" == "false" ]]; then
                cat >> "$temp_file" << EOF

### ⚠️ 未完成工作檢查項目 (${today} 新增)

- [ ] 檢查「${work_topic}」工作是否需要繼續完成
  - 工作日誌: ${work_log_basename}
  - 結案原因: 議題切換自動結案
  - 新增日期: ${today}
  - 狀態: 待檢查
  - 🔍 檢查要點: 確認此工作是否需要繼續完成，評估對專案影響，決定後續處理方式

EOF
                inserted=true
            fi
        done < "$todolist_file"
        
        # 如果沒有找到合適位置，在檔案末尾新增
        if [[ "$inserted" == "false" ]]; then
            cat >> "$temp_file" << EOF

## ⚠️ 未完成工作檢查項目

- [ ] 檢查「${work_topic}」工作是否需要繼續完成
  - 工作日誌: ${work_log_basename}
  - 結案原因: 議題切換自動結案
  - 新增日期: ${today}
  - 狀態: 待檢查

EOF
        fi
        
        mv "$temp_file" "$todolist_file"
    fi
    
    log_success "已新增未完成工作檢查項目到 todolist.md"
}

# 完成當前工作日誌
complete_current_work_log() {
    local log_file="$1"
    local today=$(date +%Y-%m-%d)
    
    log_info "為當前工作日誌新增完成總結: $log_file"
    
    # 更新工作狀態
    sed -i.bak "s/\*\*工作狀態\*\*.*$/\*\*工作狀態\*\*: $WORK_STATUS_COMPLETED/" "$log_file"
    
    # 新增完成總結區塊
    cat >> "$log_file" << EOF

---

## ✅ 工作完成總結 (${today})

### 🎯 完成的主要成果

- (請總結本期工作的主要成果)

### 📊 技術成就

- (請記錄重要的技術突破或改進)

### 🔍 經驗與改進

- (請記錄本期工作的經驗總結和改進建議)

### 📋 交付物清單

- [ ] 程式碼變更
- [ ] 測試案例  
- [ ] 文件更新
- [ ] 其他交付物

---

**🏁 此工作項目已完成，相關內容已整合到專案中。後續相關工作請建立新的工作日誌。**

*完成日期: ${today}*
EOF

    log_success "已新增工作完成總結"
    
    # 更新 todolist.md 版本資訊
    update_todolist_version
    
    echo ""
    log_warning "⚠️  請務必填寫完成總結的具體內容"
    log_info "💡 下次提交時系統將自動建立新的工作日誌"
}

# 主執行函數
main() {
    # 首先檢查依賴
    if ! check_dependencies; then
        log_error "環境檢查失敗，請安裝缺少的依賴後重新執行"
        exit 1
    fi
    
    log_info "工作日誌管理系統"
    echo ""
    # 必讀文件提示：程式碼品質範例彙編
    local examples_file="$EXAMPLES_FILE"
    if [[ -f "$examples_file" ]]; then
        log_prompt "📚 建議：提交或切換工作前，快速瀏覽 $examples_file 對齊命名、路徑與五事件評估"
    else
        log_warning "未找到必讀範例文件：$examples_file，請確認是否被移除或路徑變更"
    fi
    echo ""
    
    # 獲取最新工作日誌
    local latest_log=$(get_latest_work_log)
    local current_version="v$(get_current_project_version)"
    
    log_info "當前專案版本: $current_version"
    if [[ -n "$latest_log" ]]; then
        log_info "最新工作日誌: $latest_log"
        
        # 分析狀態並給出建議
        local suggested_action=$(determine_work_log_action "$latest_log")
        echo ""
        log_info "系統建議操作: $suggested_action"
    else
        log_warning "未找到現有工作日誌"
    fi
    
    # 讓用戶確認或選擇操作
    local action=$(prompt_work_status)
    
    case $action in
        "update_existing")
            if [[ -n "$latest_log" ]]; then
                update_existing_work_log "$latest_log"
                echo "$latest_log"
            else
                log_error "沒有現有工作日誌可更新"
                exit 1
            fi
            ;;
        "create_new")
            new_log=$(create_new_work_log)
            echo "$new_log"
            ;;
        "topic_switch_create_new")
            if [[ -n "$latest_log" ]]; then
                new_log=$(create_new_with_topic_switch "$latest_log")
                echo "$new_log"
            else
                log_error "沒有現有工作日誌可處理議題切換"
                exit 1
            fi
            ;;
        "complete_current")
            if [[ -n "$latest_log" ]]; then
                complete_current_work_log "$latest_log"
                echo "$latest_log"
            else
                log_error "沒有現有工作日誌可完成"
                exit 1
            fi
            ;;
        "cancel")
            log_info "操作已取消"
            exit 0
            ;;
    esac
}

# 如果直接執行腳本則執行 main 函數
if [[ "${BASH_SOURCE[0]:-}" == "${0}" ]]; then
    main "$@"
fi