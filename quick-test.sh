#!/bin/bash
cd /Users/mac-eric/project/book_overview_v1
echo "🧪 快速測試 EventHandler 修復..."
timeout 30s npx jest tests/unit/core/event-handler.test.js --verbose 2>&1 | head -50