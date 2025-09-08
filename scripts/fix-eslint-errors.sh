#!/bin/bash
# fix-eslint-errors.sh
# 批次修正ESLint錯誤的完整自動化腳本
# 作者: mint-format-specialist
# 日期: 2025-09-08

set -e  # 遇到錯誤立即停止

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日誌函式
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

# 檢查Prerequisites
check_prerequisites() {
    log_info "檢查必要工具..."
    
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安裝，請先安裝 Node.js"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        log_error "git 未安裝，請先安裝 Git"
        exit 1
    fi
    
    if ! command -v sed &> /dev/null; then
        log_error "sed 未安裝"
        exit 1
    fi
    
    log_success "所有必要工具檢查完成"
}

# 備份當前狀態
backup_current_state() {
    log_info "建立當前狀態備份..."
    
    # Git stash 備份
    git stash push -m "ESLint修正前備份 - $(date '+%Y-%m-%d %H:%M:%S')" || {
        log_warning "沒有變更需要stash，繼續執行"
    }
    
    # 建立ESLint檢查基準
    npm run lint > eslint-before-fix.log 2>&1 || {
        log_info "產生修正前ESLint報告: eslint-before-fix.log"
    }
    
    log_success "備份完成"
}

# Phase 1: 路徑語意化修正
fix_path_semantics() {
    log_info "🔧 Phase 1: 開始路徑語意化修正..."
    
    local fixed_files=0
    local total_replacements=0
    
    # 查詢所有包含深層相對路徑的檔案
    log_info "查詢需要修正的檔案..."
    find tests/ -name "*.js" -exec grep -l "require('\.\..*/" {} \; > path-fix-targets.txt || {
        log_info "未找到需要修正的檔案"
        return 0
    }
    
    local target_count=$(wc -l < path-fix-targets.txt)
    log_info "發現 $target_count 個檔案需要修正"
    
    # 批量處理檔案
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            log_info "處理檔案: $file"
            
            # 建立檔案備份
            cp "$file" "$file.backup"
            
            # 執行路徑替換
            local file_changes=0
            
            # 執行所有路徑替換
            # 5層深度
            sed -i.bak1 "s|require('\.\./\.\./\.\./\.\./\.\./src/|require('src/|g" "$file"
            # 4層深度  
            sed -i.bak2 "s|require('\.\./\.\./\.\./\.\./src/|require('src/|g" "$file"
            # 3層深度
            sed -i.bak3 "s|require('\.\./\.\./\.\./src/|require('src/|g" "$file"
            # 2層深度
            sed -i.bak4 "s|require('\.\./\.\./src/|require('src/|g" "$file"
            # 1層深度
            sed -i.bak5 "s|require('\.\./src/|require('src/|g" "$file"
            
            # 計算總變更數
            file_changes=0
            if cmp -s "$file.backup" "$file"; then
                file_changes=0
            else 
                file_changes=$(diff -U0 "$file.backup" "$file" 2>/dev/null | grep -E '^[\+\-]require' | wc -l | tr -d ' ')
                file_changes=$((file_changes / 2)) # 每個變更會產生 + 和 - 兩行
            fi
            
            # 清理暫存檔
            rm -f "$file".bak* 2>/dev/null || true
            
            # 語法檢查
            if node -c "$file" 2>/dev/null; then
                if [ "$file_changes" -gt 0 ]; then
                    log_success "修正 $file ($file_changes 個路徑)"
                    fixed_files=$((fixed_files + 1))
                    total_replacements=$((total_replacements + file_changes))
                fi
                rm "$file.backup"
            else
                log_error "語法錯誤，還原檔案: $file"
                mv "$file.backup" "$file"
            fi
        fi
    done < path-fix-targets.txt
    
    # 清理暫存檔案
    rm -f path-fix-targets.txt
    
    log_success "Phase 1 完成 - 修正了 $fixed_files 個檔案，共 $total_replacements 個路徑引用"
    
    # 驗證修正結果
    verify_path_fixes
}

# 驗證路徑修正
verify_path_fixes() {
    log_info "驗證路徑修正結果..."
    
    local remaining_paths=$(find tests/ -name "*.js" -exec grep -l "require('\.\..*/" {} \; | wc -l)
    
    if [ "$remaining_paths" -eq 0 ]; then
        log_success "所有深層相對路徑已成功修正"
    else
        log_warning "剩餘 $remaining_paths 個檔案包含深層路徑，需要手動檢查"
        find tests/ -name "*.js" -exec grep -l "require('\.\..*/" {} \; > remaining-paths.log
        log_info "剩餘檔案列表保存到: remaining-paths.log"
    fi
}

# Phase 2: 未使用變數清理
fix_unused_vars() {
    log_info "🔧 Phase 2: 開始未使用變數清理..."
    
    # 使用ESLint自動修正
    log_info "執行ESLint自動修正..."
    npx eslint tests/ src/ --fix --ext .js || {
        log_warning "ESLint自動修正完成，可能還有需要手動處理的問題"
    }
    
    # 產生剩餘未使用變數報告
    log_info "產生未使用變數報告..."
    npx eslint tests/ src/ --ext .js | grep "no-unused-vars" > unused-vars-remaining.log 2>/dev/null || {
        log_success "沒有剩餘的未使用變數問題"
        touch unused-vars-remaining.log
    }
    
    local remaining_unused=$(wc -l < unused-vars-remaining.log)
    if [ "$remaining_unused" -gt 0 ]; then
        log_warning "剩餘 $remaining_unused 個未使用變數需要手動檢查"
        log_info "詳情請查看: unused-vars-remaining.log"
    else
        log_success "所有未使用變數問題已解決"
    fi
}

# Phase 3: Console語句清理
fix_console_statements() {
    log_info "🔧 Phase 3: 開始Console語句清理..."
    
    # 查詢所有console語句
    log_info "查詢所有console語句..."
    find src/ tests/ -name "*.js" -exec grep -Hn "console\." {} \; > console-statements.log || {
        log_success "未發現console語句"
        return 0
    }
    
    local console_count=$(wc -l < console-statements.log)
    log_info "發現 $console_count 個console語句"
    
    # 保守清理：只移除明顯的除錯語句
    local cleaned=0
    
    # 清理包含除錯關鍵字的console.log
    for pattern in "debug" "測試" "Debug" "DEBUG" "temp" "臨時" "TODO" "FIXME"; do
        for dir in src tests; do
            if [ -d "$dir" ]; then
                local count=$(find "$dir" -name "*.js" -exec grep -l "console\.log.*$pattern" {} \; | wc -l)
                if [ "$count" -gt 0 ]; then
                    find "$dir" -name "*.js" -exec sed -i.bak "/console\.log.*$pattern/d" {} \;
                    cleaned=$((cleaned + count))
                fi
            fi
        done
    done
    
    # 清理備份檔案
    find . -name "*.bak" -delete 2>/dev/null || true
    
    if [ "$cleaned" -gt 0 ]; then
        log_success "清理了 $cleaned 個除錯console語句"
    else
        log_info "沒有找到明顯的除錯console語句"
    fi
    
    # 產生剩餘console語句報告
    find src/ tests/ -name "*.js" -exec grep -Hn "console\." {} \; > console-remaining.log || {
        touch console-remaining.log
    }
    
    local remaining_console=$(wc -l < console-remaining.log)
    if [ "$remaining_console" -gt 0 ]; then
        log_info "剩餘 $remaining_console 個console語句，請手動檢查是否需要保留"
        log_info "詳情請查看: console-remaining.log"
    fi
}

# Phase 4: 錯誤處理標準化報告
analyze_error_handling() {
    log_info "🔧 Phase 4: 分析錯誤處理問題..."
    
    # 產生錯誤處理問題報告
    npx eslint src/ tests/ --ext .js | grep -E "(no-callback-literal|promise|error)" > error-handling-issues.log 2>/dev/null || {
        log_success "沒有發現錯誤處理相關問題"
        touch error-handling-issues.log
    }
    
    local error_handling_issues=$(wc -l < error-handling-issues.log)
    if [ "$error_handling_issues" -gt 0 ]; then
        log_warning "發現 $error_handling_issues 個錯誤處理相關問題"
        log_info "這些問題需要手動修正，詳情請查看: error-handling-issues.log"
    else
        log_success "沒有發現錯誤處理問題"
    fi
}

# 執行完整驗證
run_validation() {
    log_info "🔍 開始完整驗證流程..."
    
    # ESLint檢查
    log_info "1️⃣ 執行ESLint檢查..."
    npm run lint > eslint-after-fix.log 2>&1 || {
        log_info "ESLint檢查完成，結果保存到: eslint-after-fix.log"
    }
    
    local error_count=$(grep -c "error" eslint-after-fix.log || echo "0")
    local warning_count=$(grep -c "warning" eslint-after-fix.log || echo "0")
    
    log_info "ESLint結果: $error_count 錯誤, $warning_count 警告"
    
    # 測試執行
    log_info "2️⃣ 執行測試套件..."
    if npm run test:unit > test-results.log 2>&1; then
        log_success "所有測試通過"
    else
        log_warning "測試失敗，詳情請查看: test-results.log"
    fi
    
    # 建置驗證
    log_info "3️⃣ 驗證建置流程..."
    if npm run build:dev > build-results.log 2>&1; then
        log_success "建置成功"
    else
        log_warning "建置失敗，詳情請查看: build-results.log"
    fi
    
    # 產生最終報告
    generate_final_report "$error_count" "$warning_count"
}

# 產生最終報告
generate_final_report() {
    local final_errors=$1
    local final_warnings=$2
    
    log_info "4️⃣ 產生修正報告..."
    
    cat > eslint-fix-final-report.md << EOF
# ESLint修正完成報告

**修正日期**: $(date)
**修正前**: 405個錯誤, 664個警告
**修正後**: $final_errors 個錯誤, $final_warnings 個警告

## 修正成果統計

### ✅ 完成項目
- **路徑語意化**: 深層相對路徑 → src/ 語意路徑
- **未使用變數清理**: ESLint --fix 自動處理
- **Console語句清理**: 除錯語句清理完成  
- **錯誤處理分析**: 產生手動修正指引

### 📊 修正效果
- **錯誤減少**: $(( 405 - final_errors )) 個 ($(( (405 - final_errors) * 100 / 405 ))%)
- **警告減少**: $(( 664 - final_warnings )) 個 ($(( (664 - final_warnings) * 100 / 664 ))%)

## 產生的報告檔案
- \`eslint-before-fix.log\`: 修正前ESLint報告
- \`eslint-after-fix.log\`: 修正後ESLint報告  
- \`unused-vars-remaining.log\`: 剩餘未使用變數
- \`console-remaining.log\`: 剩餘console語句
- \`error-handling-issues.log\`: 需手動處理的錯誤處理問題
- \`test-results.log\`: 測試執行結果
- \`build-results.log\`: 建置驗證結果

## 後續建議
1. 檢查剩餘的ESLint錯誤並手動修正
2. 審查console語句是否需要保留
3. 處理error-handling-issues.log中的錯誤處理問題
4. 設定pre-commit hook防止ESLint錯誤累積

---
**本報告由 mint-format-specialist 自動生成**
EOF
    
    log_success "修正報告已產生: eslint-fix-final-report.md"
}

# 主要執行流程
main() {
    log_info "🚀 開始ESLint錯誤批次修正流程..."
    log_info "預計修正405個ESLint錯誤"
    
    # 確認執行
    echo -n "確認執行修正流程? (y/N): "
    read -r confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "取消執行"
        exit 0
    fi
    
    # 執行修正流程
    check_prerequisites
    backup_current_state
    fix_path_semantics
    fix_unused_vars  
    fix_console_statements
    analyze_error_handling
    run_validation
    
    log_success "🎉 ESLint錯誤批次修正流程完成!"
    log_info "請查看 eslint-fix-final-report.md 了解修正結果"
}

# 腳本執行入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi