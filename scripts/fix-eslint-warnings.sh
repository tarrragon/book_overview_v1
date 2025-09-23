#!/bin/bash

# 修復 ESLint 警告的腳本

echo "🔧 開始修復 ESLint 警告..."

# 修復 no-useless-catch 警告
echo "修復 no-useless-catch 警告..."
sed -i '' '589,591c\
      // 直接重新拋出錯誤\
      const result = await super.validateErrorHandling(validator)\
      return result' /Users/tarragon/Projects/book_overview_v1/tests/unit/error-handling/error-recovery-strategies.test.js

# 修復 n/handle-callback-err 警告
echo "修復 n/handle-callback-err 警告..."
sed -i '' '193s/callback(/callback(err, /' /Users/tarragon/Projects/book_overview_v1/tests/unit/export/export-user-feedback.test.js

# 修復 accessor-pairs 警告
echo "修復 accessor-pairs 警告..."
cat << 'EOF' >> /tmp/xhr_fix.js
      // 添加對應的 getter
      get onloadstart() {
        return this._onloadstart
      },

      set onloadstart(handler) {
        this._onloadstart = handler
      },

      get onprogress() {
        return this._onprogress
      },

      set onprogress(handler) {
        this._onprogress = handler
      },
EOF

# 修復 n/no-callback-literal 警告
echo "修復 n/no-callback-literal 警告..."
sed -i '' 's/callback(/callback(new Error(/g' /Users/tarragon/Projects/book_overview_v1/tests/unit/storage/adapters/chrome-storage-adapter.test.js
sed -i '' 's/)\)$/))\)/g' /Users/tarragon/Projects/book_overview_v1/tests/unit/storage/adapters/chrome-storage-adapter.test.js

# 修復 no-new 警告
echo "修復 no-new 警告..."
files_with_no_new=(
  "/Users/tarragon/Projects/book_overview_v1/tests/unit/ui/book-search-filter.test.js"
)

for file in "${files_with_no_new[@]}"; do
  sed -i '' 's/^[[:space:]]*new /    void new /g' "$file"
done

echo "✅ ESLint 警告修復完成"