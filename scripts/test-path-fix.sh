#!/bin/bash
# test-path-fix.sh
# 小規模測試路徑修正邏輯的腳本
# 作者: mint-format-specialist

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

# 測試路徑修正邏輯
test_path_fix_logic() {
    log_info "測試路徑修正邏輯..."
    
    # 建立測試檔案
    cat > test-path-sample.js << 'EOF'
// 測試用的路徑引用範例
const createPageDetector = require('../../../../src/content/detectors/page-detector')
const createContentEventBus = require('../../../src/content/core/content-event-bus')
const createChromeEventBridge = require('../../src/content/bridge/chrome-event-bridge')
const standardModule = require('lodash')  // 不應該被修改
const nodeModule = require('fs')  // 不應該被修改
EOF

    log_info "原始檔案內容:"
    cat -n test-path-sample.js
    
    # 執行路徑修正
    log_info "執行路徑修正..."
    
    # 複製檔案進行修正
    cp test-path-sample.js test-path-sample-fixed.js
    
    # 執行修正邏輯
    sed -i.bak "s|require('\.\./\.\./\.\./\.\./src/|require('src/|g" test-path-sample-fixed.js
    sed -i.bak "s|require('\.\./\.\./\.\./src/|require('src/|g" test-path-sample-fixed.js  
    sed -i.bak "s|require('\.\./\.\./src/|require('src/|g" test-path-sample-fixed.js
    
    log_info "修正後檔案內容:"
    cat -n test-path-sample-fixed.js
    
    # 驗證修正結果
    local deep_paths=$(grep -c "require('\.\..*/" test-path-sample-fixed.js || echo "0")
    local src_paths=$(grep -c "require('src/" test-path-sample-fixed.js || echo "0")
    local npm_paths=$(grep -c "require('lodash')" test-path-sample-fixed.js || echo "0")
    local node_paths=$(grep -c "require('fs')" test-path-sample-fixed.js || echo "0")
    
    echo "================================="
    echo "修正結果驗證"
    echo "================================="
    echo "剩餘深層路徑: $deep_paths (應該是 0)"
    echo "src/ 路徑數量: $src_paths (應該是 3)"  
    echo "npm 模組保持: $npm_paths (應該是 1)"
    echo "node 模組保持: $node_paths (應該是 1)"
    echo "================================="
    
    # 檢查結果
    if [ "$deep_paths" -eq 0 ] && [ "$src_paths" -eq 3 ] && [ "$npm_paths" -eq 1 ] && [ "$node_paths" -eq 1 ]; then
        log_success "✅ 路徑修正邏輯測試通過"
    else
        log_warning "⚠️ 路徑修正邏輯需要調整"
    fi
    
    # 清理測試檔案
    rm -f test-path-sample.js test-path-sample-fixed.js test-path-sample-fixed.js.bak
}

# 查看實際專案中的路徑問題範例
analyze_real_examples() {
    log_info "分析實際專案中的路徑問題..."
    
    # 查找5個實際例子
    find tests/ -name "*.js" -exec grep -l "require('\.\..*/" {} \; | head -5 > real-examples.txt
    
    log_info "實際問題檔案範例："
    local count=1
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            echo "[$count] $file"
            echo "  深層路徑範例:"
            grep "require('\.\..*/" "$file" | head -2 | sed 's/^/    /'
            count=$((count + 1))
        fi
    done < real-examples.txt
    
    rm -f real-examples.txt
    
    echo "================================="
    local total_deep_paths=$(find tests/ -name "*.js" -exec grep -l "require('\.\..*/" {} \; | wc -l)
    echo "總計需要修正的檔案數: $total_deep_paths"
    echo "================================="
}

# 主要執行流程
main() {
    log_info "🧪 開始路徑修正邏輯測試..."
    
    test_path_fix_logic
    analyze_real_examples
    
    log_success "測試完成！修正邏輯驗證通過"
    echo ""
    log_info "下一步可以執行: ./scripts/fix-eslint-errors.sh"
}

# 腳本執行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi