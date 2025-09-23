#!/bin/bash

# 執行 v0.14.1 效能評估功能的簡化測試
# 驗證測試框架和Mock設定是否正確

echo "🚀 開始執行 v0.14.1 系統效能評估功能簡化測試..."

# 設定測試環境
export NODE_ENV=test

# 執行簡化的效能測試檔案
echo "📋 執行 PerformanceAssessment 簡化測試..."
npx jest tests/unit/core/performance/PerformanceAssessment.test.simplified.js --verbose

echo "📋 執行 MetricsCollector 簡化測試..."
npx jest tests/unit/core/performance/MetricsCollector.test.simplified.js --verbose

echo "📋 執行系統整合簡化測試..."
npx jest tests/integration/performance/performance-system-integration.test.simplified.js --verbose

echo "✅ v0.14.1 效能評估功能簡化測試執行完成"
echo "📊 如果所有測試通過，表示測試框架和介面定義正確"
echo "💻 接下來可以進行主線程實作，讓完整的測試案例通過"