#!/bin/bash

# StandardErrorWrapper 批量修復腳本
# 自動將所有 StandardErrorWrapper 引用替換為 StandardError

echo "🔧 開始 StandardErrorWrapper 批量修復..."

# 統計修復前的檔案數
before_count=$(grep -r "StandardErrorWrapper" src/ --include="*.js" | wc -l)
echo "📊 修復前發現 $before_count 個 StandardErrorWrapper 引用"

# 1. 替換 new StandardErrorWrapper 為 new StandardError
echo "🔄 步驟 1: 替換 new StandardErrorWrapper(...)"
find src/ -name "*.js" -exec sed -i '' 's/new StandardErrorWrapper(/new StandardError(/g' {} \;

# 2. 替換 throw new StandardErrorWrapper 為 throw new StandardError
echo "🔄 步驟 2: 替換 throw new StandardErrorWrapper(...)"
find src/ -name "*.js" -exec sed -i '' 's/throw new StandardErrorWrapper(/throw new StandardError(/g' {} \;

# 3. 替換 StandardErrorWrapper.from 為 StandardError.from
echo "🔄 步驟 3: 替換 StandardErrorWrapper.from(...)"
find src/ -name "*.js" -exec sed -i '' 's/StandardErrorWrapper\.from(/StandardError.from(/g' {} \;

# 4. 替換 import/require 語句中的 StandardErrorWrapper
echo "🔄 步驟 4: 替換 import/require 語句"
find src/ -name "*.js" -exec sed -i '' 's/StandardErrorWrapper/StandardError/g' {} \;

# 5. 修復模板字串錯誤 (${variable} 沒有正確插值的問題)
echo "🔄 步驟 5: 修復模板字串問題"

# 尋找並修復常見的模板字串錯誤
find src/ -name "*.js" -exec sed -i '' "s/'\\${/\`\\${/g" {} \;
find src/ -name "*.js" -exec sed -i '' "s/}'/}\`/g" {} \;

# 6. 修復特定的錯誤訊息格式問題
echo "🔄 步驟 6: 修復錯誤訊息格式"

# 修復常見的字串模板錯誤
find src/ -name "*.js" -exec sed -i '' "s/'Invalid priority category: \${category}'/'Invalid priority category: \${category}'/g" {} \;
find src/ -name "*.js" -exec sed -i '' "s/'Operation failed after \${maxRetries + 1} attempts: \${error.message}'/'Operation failed after \${maxRetries + 1} attempts: \${error.message}'/g" {} \;

# 統計修復後的檔案數
after_count=$(grep -r "StandardErrorWrapper" src/ --include="*.js" | wc -l)
echo "📊 修復後剩餘 $after_count 個 StandardErrorWrapper 引用"

fixed_count=$((before_count - after_count))
echo "✅ 成功修復 $fixed_count 個 StandardErrorWrapper 引用"

# 顯示剩餘需要手動修復的檔案
if [ $after_count -gt 0 ]; then
    echo "⚠️  仍需手動檢查的檔案:"
    grep -r "StandardErrorWrapper" src/ --include="*.js" -l | head -10
fi

echo "🎉 StandardErrorWrapper 批量修復完成!"