#!/bin/bash

cd /Users/mac-eric/project/book_overview_v1

echo "🧪 測試 EventHandler 修復結果..."
echo "⏰ 開始時間: $(date)"

npx jest tests/unit/core/event-handler.test.js --verbose

echo "⏰ 完成時間: $(date)"