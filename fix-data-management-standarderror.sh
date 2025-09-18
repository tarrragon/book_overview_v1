#!/bin/bash

# 批次修正 data-management domain 的 StandardError 遷移
echo "🚀 開始修正 data-management domain 的 StandardError 遷移..."

# 定義 data-management 服務檔案路徑
DATA_MGMT_DIR="src/background/domains/data-management/services"
FILES=(
    "data-normalization-service.js"
    "cross-device-sync-service.js"
    "sync-strategy-processor.js"
    "batch-validation-processor.js"
    "RetryCoordinator.js"
    "sync-conflict-resolver.js"
    "conflict-resolution-service.js"
    "PlatformRuleManager.js"
    "data-validation-service.js"
    "validation-rule-manager.js"
    "ValidationServiceCoordinator.js"
    "quality-assessment-service.js"
    "ValidationCacheManager.js"
    "ValidationEngine.js"
    "DataNormalizationService.js"
    "DataQualityAnalyzer.js"
    "DataComparisonEngine.js"
    "ValidationBatchProcessor.js"
    "cache-management-service.js"
    "readmoo-data-consistency-service.js"
)

# 記錄成功和失敗的檔案
SUCCESS_FILES=()
FAILED_FILES=()

for file in "${FILES[@]}"; do
    filepath="$DATA_MGMT_DIR/$file"

    if [[ -f "$filepath" ]]; then
        echo "📝 處理: $file"

        # 1. 更新 import
        sed -i '' 's/const { StandardError } = require.*StandardError.*)/const { ErrorCodes } = require('\''src\/core\/errors\/ErrorCodes'\'')/' "$filepath"

        # 2. 轉換 StandardError 實例
        # 保留字串模板的語法
        sed -i '' "s/throw new StandardError('\([^']*\)', '\([^']*\)', {/const error = new Error('\2')\
      error.code = ErrorCodes.OPERATION_ERROR\
      error.details = {/g" "$filepath"

        # 3. 修正剩餘的結構
        sed -i '' 's/throw new StandardError(/const error = new Error(/g' "$filepath"

        # 檢查語法
        if node -c "$filepath" 2>/dev/null; then
            echo "✅ $file - 語法檢查通過"
            SUCCESS_FILES+=("$file")
        else
            echo "❌ $file - 語法檢查失敗"
            FAILED_FILES+=("$file")
        fi
    else
        echo "⚠️  檔案不存在: $filepath"
        FAILED_FILES+=("$file")
    fi
done

echo ""
echo "📊 處理結果："
echo "✅ 成功: ${#SUCCESS_FILES[@]} 個檔案"
echo "❌ 失敗: ${#FAILED_FILES[@]} 個檔案"

if [[ ${#FAILED_FILES[@]} -gt 0 ]]; then
    echo ""
    echo "❌ 需要手動修正的檔案："
    for file in "${FAILED_FILES[@]}"; do
        echo "   - $file"
    done
fi

echo ""
echo "🏁 data-management domain StandardError 遷移完成"