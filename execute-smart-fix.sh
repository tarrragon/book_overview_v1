#!/bin/bash

cd /Users/mac-eric/project/book_overview_v1

# 設置權限
chmod +x scripts/smart-batch-fix.sh

echo "🚀 開始執行智能批次修復..."
echo "⏰ 開始時間: $(date)"

# 執行智能修復
bash scripts/smart-batch-fix.sh

echo ""
echo "✅ 智能批次修復執行完成！"
echo "⏰ 完成時間: $(date)"

# 立即驗證修復品質
echo ""
echo "🔍 立即驗證修復品質..."
echo "正在測試 ISynchronizationCoordinator..."

npx jest tests/unit/background/domains/data-management/interfaces/ISynchronizationCoordinator.test.js --verbose