#!/bin/bash

# 工作日誌智能管理腳本
# 處理工作日誌的三種狀況：更新進行中、新建工作、完成總結

set -e

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

# 獲取當前專案真實版本 (以 CHANGELOG.md 為準)
get_current_project_version() {
    local version=""
    
    # 優先從 CHANGELOG.md 獲取最新版本
    if [[ -f "CHANGELOG.md" ]]; then
        version=$(grep -E "^## \[v[0-9]+\.[0-9]+\.[0-9]+\]" CHANGELOG.md | head -1 | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+' | sed 's/v//')
    fi
    
    # 如果 CHANGELOG 中沒有找到，檢查 package.json
    if [[ -z "$version" ]]; then
        if [[ -f "package.json" ]]; then
            version=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' package.json | cut -d'"' -f4)
        fi
    fi
    
    # 如果都沒找到，根據現有工作日誌推斷下一個版本
    if [[ -z "$version" ]]; then
        # 分析最近的工作日誌來推斷版本 (包含 0.9.x 和 0.10.x)
        local latest_log=$(ls docs/work-logs/v0.*.*.md 2>/dev/null | sort -V | tail -1 | basename)
        if [[ -n "$latest_log" ]]; then
            local latest_version=$(echo "$latest_log" | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+')
            if [[ -n "$latest_version" ]]; then
                # 提取版本號並加1到patch版本
                local major=$(echo "$latest_version" | cut -d'.' -f1 | sed 's/v//')
                local minor=$(echo "$latest_version" | cut -d'.' -f2)  
                local patch=$(echo "$latest_version" | cut -d'.' -f3)
                version="$major.$minor.$((patch + 1))"
            else
                version="0.9.53"  # 默認下一個版本
            fi
        else
            version="0.9.53"  # 默認版本
        fi
    fi
    
    echo "$version"
}

# 遞增版本號 (用於議題切換時建立新版本)
increment_version() {
    local current_version="$1"
    
    # 提取版本號組件
    local major=$(echo "$current_version" | cut -d'.' -f1)
    local minor=$(echo "$current_version" | cut -d'.' -f2)  
    local patch=$(echo "$current_version" | cut -d'.' -f3)
    
    # 遞增 patch 版本
    local new_patch=$((patch + 1))
    
    echo "$major.$minor.$new_patch"
}

# 獲取最新的工作日誌檔案
get_latest_work_log() {
    local work_log_dir="docs/work-logs"
    
    # 獲取所有版本的工作日誌，按版本號排序找到最新的
    local latest_log=$(ls "$work_log_dir"/v*.*.*.md 2>/dev/null | sort -V | tail -1)
    
    if [[ -n "$latest_log" ]]; then
        echo "$latest_log"
    else
        log_warning "找不到版本工作日誌檔案"
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
    local current_topic="$1"
    local previous_log="$2"
    
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

# 分析最新工作日誌的狀態
analyze_latest_work_log() {
    local log_file="$1"
    local today=$(date +%Y-%m-%d)
    
    log_info "分析工作日誌: $log_file"
    
    # 檢查是否有今日記錄
    local has_today_entry=false
    if grep -q "$today" "$log_file"; then
        has_today_entry=true
    fi
    
    # 檢查是否有完成標記 (更嚴格的檢查)
    local is_completed=false
    if grep -qiE "### 工作完成總結|## ✅ 工作完成總結|## 完成總結" "$log_file"; then
        is_completed=true
    elif grep -qiE "\*\*工作狀態\*\*.*✅.*已完成" "$log_file"; then
        is_completed=true
    elif grep -qiE "此工作項目已完成" "$log_file"; then
        is_completed=true
    fi
    
    # 檢查版本號是否正確
    local log_version=$(basename "$log_file" | grep -o '^v[0-9]\+\.[0-9]\+\.[0-9]\+')
    local current_version="v$(get_current_project_version)"
    local version_correct=false
    
    # 檢查版本是否合理 (應該是當前版本或之前的版本)
    if [[ "$log_version" =~ ^v0\.(9|10)\. ]]; then
        version_correct=true
    elif [[ "$log_version" == "$current_version" ]]; then
        version_correct=true
    fi
    
    echo "has_today_entry:$has_today_entry"
    echo "is_completed:$is_completed"  
    echo "version_correct:$version_correct"
    echo "log_version:$log_version"
    echo "current_version:$current_version"
}

# 決定工作日誌操作類型 (含議題切換檢測)
determine_work_log_action() {
    local latest_log="$1"
    local proposed_topic="$2"  # 新增參數：提議的新工作議題
    
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
    
    while true; do
        read -p "請選擇 [1-4]: " choice
        case $choice in
            1) echo "update_existing"; break ;;
            2) echo "create_new"; break ;;
            3) echo "complete_current"; break ;;
            4) echo "cancel"; break ;;
            *) echo "無效選擇，請重新輸入 [1-4]" ;;
        esac
    done
}

# 處理議題切換建立新工作日誌 (自動完結上一個)
create_new_with_topic_switch() {
    local latest_log="$1"
    local current_version=$(get_current_project_version)
    local new_version="v$(increment_version "$current_version")"
    local today=$(date +%Y-%m-%d)
    
    log_prompt "請輸入新工作項目的簡短描述 (例如: api-refactor, ui-enhancement):"
    read -p "工作描述: " work_description
    
    if [[ -z "$work_description" ]]; then
        log_error "工作描述不能為空"
        return 1
    fi
    
    # 先自動完結上一個未完成工作
    auto_complete_previous_work "$latest_log" "$work_description"
    
    # 然後建立新的工作日誌
    local new_log_file="docs/work-logs/${new_version}-${work_description}.md"
    
    log_info "建立新工作日誌: $new_log_file (版本遞增: $current_version → $new_version)"
    
    cat > "$new_log_file" << EOF
# ${new_version} ${work_description} 工作日誌

**開發版本**: ${new_version}  
**開發日期**: ${today}  
**主要任務**: ${work_description}  
**工作狀態**: 🔄 進行中  
**開發者**: Claude Code

## 🎯 工作目標與背景

### 本期工作重點

(請描述本期工作的主要目標和背景)

## 📅 ${today} 開發記錄

### 完成的工作

- 

### 技術實現要點

- 

### 遇到的問題與解決方案

- 

### 下一步計劃

- 

---

## 工作進度追蹤

- [ ] 需求分析完成
- [ ] 設計方案確定  
- [ ] 核心功能實現
- [ ] 測試驗證
- [ ] 文件更新
- [ ] 程式碼審查

---

*📝 工作狀態說明: 此工作日誌記錄 ${work_description} 的開發過程，當前狀態為進行中。*
EOF

    log_success "新工作日誌已建立: $new_log_file"
    echo ""
    log_info "請編輯該檔案並填入具體的工作內容"
    
    echo "$new_log_file"
}

# 建立新的工作日誌檔案
create_new_work_log() {
    local version="v$(get_current_project_version)"
    local today=$(date +%Y-%m-%d)
    
    log_prompt "請輸入新工作項目的簡短描述 (例如: api-refactor, ui-enhancement):"
    read -p "工作描述: " work_description
    
    if [[ -z "$work_description" ]]; then
        log_error "工作描述不能為空"
        return 1
    fi
    
    local new_log_file="docs/work-logs/${version}-${work_description}.md"
    
    log_info "建立新工作日誌: $new_log_file"
    
    cat > "$new_log_file" << EOF
# ${version} ${work_description} 工作日誌

**開發版本**: ${version}  
**開發日期**: ${today}  
**主要任務**: ${work_description}  
**工作狀態**: 🔄 進行中  
**開發者**: Claude Code

## 🎯 工作目標與背景

### 本期工作重點

(請描述本期工作的主要目標和背景)

## 📅 ${today} 開發記錄

### 完成的工作

- 

### 技術實現要點

- 

### 遇到的問題與解決方案

- 

### 下一步計劃

- 

---

## 工作進度追蹤

- [ ] 需求分析完成
- [ ] 設計方案確定  
- [ ] 核心功能實現
- [ ] 測試驗證
- [ ] 文件更新
- [ ] 程式碼審查

---

*📝 工作狀態說明: 此工作日誌記錄 ${work_description} 的開發過程，當前狀態為進行中。*
EOF

    log_success "新工作日誌已建立: $new_log_file"
    echo ""
    log_info "請編輯該檔案並填入具體的工作內容"
    
    echo "$new_log_file"
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
    local temp_file=$(mktemp)
    local inserted=false
    
    while IFS= read -r line; do
        echo "$line" >> "$temp_file"
        
        # 尋找適當位置插入今日記錄
        if [[ "$line" =~ ^## && "$inserted" == "false" ]]; then
            # 在第一個 ## 標題前插入今日記錄
            cat >> "$temp_file" << EOF

## 📅 ${today} 開發記錄

### 完成的工作

- (請填入今日完成的具體工作內容)

### 技術實現要點

- (請填入重要的技術實現細節)

### 遇到的問題與解決方案

- (請記錄遇到的問題和解決方案)

---

EOF
            inserted=true
        fi
    done < "$log_file"
    
    # 如果沒有找到合適位置，在檔案末尾新增
    if [[ "$inserted" == "false" ]]; then
        cat >> "$temp_file" << EOF

## 📅 ${today} 開發記錄

### 完成的工作

- (請填入今日完成的具體工作內容)

### 技術實現要點

- (請填入重要的技術實現細節)

### 遇到的問題與解決方案

- (請記錄遇到的問題和解決方案)

---
EOF
    fi
    
    mv "$temp_file" "$log_file"
    
    log_success "已在工作日誌中新增今日記錄"
    echo ""
    log_info "請編輯檔案並填入具體的工作內容"
}

# 自動完結上一個未完成工作並新增 TODO 檢查項目
auto_complete_previous_work() {
    local previous_log="$1"
    local current_topic="$2"
    local today=$(date +%Y-%m-%d)
    
    log_warning "檢測到議題切換：正在自動完結上一個未完成工作"
    
    local previous_topic=$(extract_work_topic "$previous_log")
    log_info "上一個工作議題: $previous_topic"
    log_info "當前工作議題: $current_topic"
    
    # 更新上一個工作日誌的狀態
    sed -i.bak "s/\*\*工作狀態\*\*.*$/\*\*工作狀態\*\*: ⚠️ 未完成 (議題切換自動結案)/" "$previous_log"
    
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
    local work_topic="$1"
    local work_log_file="$2"
    local today=$(date +%Y-%m-%d)
    
    log_info "新增未完成工作檢查項目到 todolist.md"
    
    local todolist_file="docs/todolist.md"
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
        # 在現有 todolist.md 中新增檢查項目
        # 尋找合適的位置插入（在第一個 ## 標題後）
        local temp_file=$(mktemp)
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
    sed -i.bak "s/\*\*工作狀態\*\*.*$/\*\*工作狀態\*\*: ✅ 已完成/" "$log_file"
    
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
    echo ""
    log_warning "⚠️  請務必填寫完成總結的具體內容"
    log_info "💡 下次提交時系統將自動建立新的工作日誌"
}

# 主執行函數
main() {
    log_info "工作日誌自動化管理系統"
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
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi