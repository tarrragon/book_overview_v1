#!/bin/bash

echo "=== 手動修復 testing-integrity-checker.js 的所有 StandardError 錯誤 ==="

FILE="tests/helpers/testing-integrity-checker.js"

# 備份檔案
cp "$FILE" "$FILE.manual-backup.$(date +%Y%m%d_%H%M%S)"

echo "📝 使用 Python 腳本進行精確替換..."

# 使用 Python 進行更精確的替換
python3 << 'EOF'
import re

file_path = "tests/helpers/testing-integrity-checker.js"

# 讀取檔案
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 替換各種 StandardError 模式

# 模式 1: new StandardError('CODE', `template ${var}`, {details})
pattern1 = r"new StandardError\(\s*'([^']+)'\s*,\s*`([^`]*)`\s*,\s*\{([^}]*)\}\s*\)"
replacement1 = r"(() => { const error = new Error(`\2`); error.code = ErrorCodes.\1; error.details = {\3}; return error })()"
content = re.sub(pattern1, replacement1, content)

# 模式 2: new StandardError('CODE', 'message', {details})
pattern2 = r"new StandardError\(\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*\{([^}]*)\}\s*\)"
replacement2 = r"(() => { const error = new Error('\2'); error.code = ErrorCodes.\1; error.details = {\3}; return error })()"
content = re.sub(pattern2, replacement2, content)

# 模式 3: new StandardError('CODE', variable, {details})
pattern3 = r"new StandardError\(\s*'([^']+)'\s*,\s*([^,]+)\s*,\s*\{([^}]*)\}\s*\)"
replacement3 = r"(() => { const error = new Error(\2); error.code = ErrorCodes.\1; error.details = {\3}; return error })()"
content = re.sub(pattern3, replacement3, content)

# 模式 4: new StandardError('CODE', 'message')
pattern4 = r"new StandardError\(\s*'([^']+)'\s*,\s*'([^']*)'\s*\)"
replacement4 = r"(() => { const error = new Error('\2'); error.code = ErrorCodes.\1; return error })()"
content = re.sub(pattern4, replacement4, content)

# 模式 5: new StandardError('CODE', variable)
pattern5 = r"new StandardError\(\s*'([^']+)'\s*,\s*([^,)]+)\s*\)"
replacement5 = r"(() => { const error = new Error(\2); error.code = ErrorCodes.\1; return error })()"
content = re.sub(pattern5, replacement5, content)

# 模式 6: new StandardError('CODE')
pattern6 = r"new StandardError\(\s*'([^']+)'\s*\)"
replacement6 = r"(() => { const error = new Error('Unknown error'); error.code = ErrorCodes.\1; return error })()"
content = re.sub(pattern6, replacement6, content)

# 寫回檔案
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Python 替換完成")
EOF

echo "✅ 手動修復完成"

# 檢查修復結果
ERRORS=$(npm run lint "$FILE" 2>&1 | grep "no-restricted-syntax" | wc -l | tr -d ' ')
echo "📊 剩餘 StandardError 錯誤: $ERRORS"

if [[ $ERRORS -eq 0 ]]; then
  echo "🎉 所有 StandardError 錯誤已修復！"
else
  echo "⚠️  仍有錯誤需要處理:"
  npm run lint "$FILE" 2>&1 | grep "no-restricted-syntax" | head -3
fi