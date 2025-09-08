#!/bin/bash
# validate-eslint-fix.sh
# ESLint修正後的快速驗證腳本
# 作者: mint-format-specialist
# 日期: 2025-09-08

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 快速ESLint檢查
quick_eslint_check() {
    log_info "執行快速ESLint檢查..."
    
    local output
    output=$(npm run lint 2>&1) || true
    
    local error_count=$(echo "$output" | grep -c "error" || echo "0")
    local warning_count=$(echo "$output" | grep -c "warning" || echo "0")
    
    echo "$output" > quick-eslint-check.log
    
    echo "================================="
    echo "ESLint檢查結果"
    echo "================================="
    echo "錯誤數量: $error_count"
    echo "警告數量: $warning_count"
    echo "詳細報告: quick-eslint-check.log"
    echo "================================="
    
    if [ "$error_count" -eq 0 ]; then
        log_success "🎉 沒有ESLint錯誤！"
    elif [ "$error_count" -le 20 ]; then
        log_warning "剩餘 $error_count 個錯誤 (目標達成，< 20個)"
    else
        log_error "剩餘 $error_count 個錯誤 (需要進一步修正)"
    fi
}

# 路徑修正驗證
verify_path_fixes() {
    log_info "驗證路徑修正狀態..."
    
    local deep_paths=$(find tests/ -name "*.js" -exec grep -l "require('\.\..*/" {} \; 2>/dev/null | wc -l)
    local src_paths=$(find tests/ -name "*.js" -exec grep -l "require('src/" {} \; 2>/dev/null | wc -l)
    
    echo "================================="
    echo "路徑修正驗證"
    echo "================================="
    echo "剩餘深層相對路徑: $deep_paths"
    echo "使用src/語意路徑: $src_paths"
    echo "================================="
    
    if [ "$deep_paths" -eq 0 ]; then
        log_success "✅ 路徑語意化修正完成"
    else
        log_warning "剩餘 $deep_paths 個檔案使用深層路徑"
    fi
}

# 測試快速驗證
quick_test_check() {
    log_info "執行快速測試驗證..."
    
    # 只測試幾個關鍵測試檔案
    local test_files=(
        "tests/unit/content/modular/content-modular.test.js"
        "tests/unit/adapters/stable-id-generation.test.js"
    )
    
    local passed=0
    local total=${#test_files[@]}
    
    for test_file in "${test_files[@]}"; do
        if [ -f "$test_file" ]; then
            if npx jest "$test_file" --silent > /dev/null 2>&1; then
                log_success "✅ $test_file"
                passed=$((passed + 1))
            else
                log_error "❌ $test_file"
            fi
        else
            log_warning "⚠️ $test_file (檔案不存在)"
        fi
    done
    
    echo "================================="
    echo "快速測試結果"
    echo "================================="
    echo "通過測試: $passed/$total"
    echo "================================="
    
    if [ "$passed" -eq "$total" ]; then
        log_success "所有關鍵測試通過"
    else
        log_warning "部分測試失敗，建議執行完整測試"
    fi
}

# 產生修正狀態報告
generate_status_report() {
    log_info "產生修正狀態報告..."
    
    cat > eslint-fix-status.md << EOF
# ESLint修正狀態報告

**檢查時間**: $(date)

## 快速檢查結果

### ESLint狀態
$(tail -5 quick-eslint-check.log)

### 路徑修正狀態
- 深層相對路徑檔案: $(find tests/ -name "*.js" -exec grep -l "require('\.\..*/" {} \; 2>/dev/null | wc -l) 個
- 語意化路徑檔案: $(find tests/ -name "*.js" -exec grep -l "require('src/" {} \; 2>/dev/null | wc -l) 個

### 建議後續動作
1. 如果ESLint錯誤數 > 20，繼續執行修正腳本
2. 如果路徑修正未完成，手動檢查剩餘檔案
3. 執行完整測試套件驗證功能正常

---
*由 validate-eslint-fix.sh 生成*
EOF
    
    log_success "狀態報告已產生: eslint-fix-status.md"
}

# 主要執行流程
main() {
    log_info "🔍 開始ESLint修正狀態驗證..."
    
    quick_eslint_check
    verify_path_fixes
    quick_test_check
    generate_status_report
    
    log_success "✅ 驗證完成，請查看 eslint-fix-status.md"
}

# 腳本執行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi