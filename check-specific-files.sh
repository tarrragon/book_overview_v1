#!/bin/bash

echo "🔍 檢查重點文件的 no-unused-vars 警告..."

FILES=(
  "src/core/migration/DualErrorSystemBridge.js"
  "src/core/performance/performance-anomaly-detector.js"
  "src/overview/overview.js"
  "src/ui/handlers/ui-progress-handler.js"
  "src/ui/search/ui-controller/search-ui-controller.js"
)

for file in "${FILES[@]}"; do
  echo ""
  echo "📝 檢查: $file"
  npx eslint "$file" --format=compact 2>/dev/null | grep "no-unused-vars" | head -3 || echo "   ✅ 無 no-unused-vars 警告"
done

echo ""
echo "🎯 全域 no-unused-vars 統計:"
npm run lint 2>&1 | grep "no-unused-vars" | wc -l | xargs -I {} echo "   找到 {} 個警告"