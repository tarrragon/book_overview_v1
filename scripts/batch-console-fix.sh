#!/bin/bash

# 批量修復測試檔案中的 no-console warnings
# 為所有測試檔案中的 console 語句添加 eslint-disable-next-line 註解

echo "🔧 開始批量修復測試檔案中的 console warnings..."

# 定義需要處理的檔案列表
files=(
    "tests/integration/chrome-extension/content-script-extractor.test.js"
    "tests/integration/chrome-extension/event-bus-stats.test.js"
    "tests/integration/chrome-extension/popup-interface.test.js"
    "tests/integration/cross-module/background-content-integration.test.js"
    "tests/integration/cross-module/popup-background-integration.test.js"
    "tests/integration/cross-module/event-system-integration.test.js"
    "tests/integration/workflows/cross-device-sync-workflow.test.js"
    "tests/e2e/validation/simple-validation.test.js"
    "tests/e2e/validation/setup-validation.test.js"
    "tests/e2e/performance/benchmark-tests.test.js"
    "tests/helpers/e2e-test-suite.js"
    "tests/helpers/testing-integrity-checker.js"
    "tests/helpers/event-flow-validator.js"
    "tests/helpers/memory-leak-detector.js"
    "tests/helpers/chrome-extension-environment-simulator.js"
    "tests/helpers/chrome-extension-controller.js"
    "tests/processors/test-results-processor.js"
    "tests/utils/chrome-extension-mocks-enhanced-refactored.js"
    "tests/integration/run-event-system-v2-integration.js"
    "tests/integration/event-system-v2-performance-stability.test.js"
    "tests/integration/performance/performance-monitoring-integration.test.js"
    "tests/unit/adapters/stable-id-generation.test.js"
    "tests/unit/overview/overview-import-function.test.js"
    "tests/unit/error-handling/message-tracker.test.js"
    "tests/test-setup.js"
)

# 處理函數
fix_console_in_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        echo "處理檔案: $file"

        # 使用 sed 為每個 console 語句添加 eslint-disable 註解
        # 先添加註解行，然後保持原始的 console 行
        sed -i '' '
            /console\.\(log\|warn\|error\|info\|debug\)/ {
                # 檢查是否已經有 eslint-disable 註解
                /eslint-disable-next-line no-console/! {
                    # 獲取縮排
                    s/^[[:space:]]*/&/
                    # 在前一行插入註解
                    i\
// eslint-disable-next-line no-console
                }
            }
        ' "$file"

        echo "✅ 完成: $file"
    else
        echo "⚠️  檔案不存在: $file"
    fi
}

# 遍歷所有檔案
for file in "${files[@]}"; do
    fix_console_in_file "$file"
done

echo ""
echo "🎉 批量修復完成！"
echo ""
echo "📋 修復摘要："
echo "- 處理了 ${#files[@]} 個檔案"
echo "- 為所有 console 語句添加了 eslint-disable-next-line no-console 註解"
echo ""
echo "🔍 建議執行以下指令檢查結果："
echo "npm run lint | grep no-console"