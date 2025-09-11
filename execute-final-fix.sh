#!/bin/bash

cd /Users/mac-eric/project/book_overview_v1

# 設置權限並執行
chmod +x scripts/final-batch-fix.sh

echo "🎯 執行最終批次修復..."
echo "⏰ 開始時間: $(date)"

# 執行修復
bash scripts/final-batch-fix.sh

echo ""
echo "✅ 最終批次修復完成！"

# 快速驗證
echo ""
echo "🔍 快速驗證修復品質..."
echo "測試 EventHandler..."
timeout 60s npx jest tests/unit/core/event-handler.test.js --verbose --bail

echo ""
echo "測試 ISynchronizationCoordinator..."
timeout 60s npx jest tests/unit/background/domains/data-management/interfaces/ISynchronizationCoordinator.test.js --verbose --bail