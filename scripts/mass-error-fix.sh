#!/bin/bash

# 🚀 Mass Error Fix Script - 批量修復原生 Error 和測試字串比較
# 目標：將 837 個主要違規修復完成

set -euo pipefail

PROJECT_ROOT="/Users/mac-eric/project/book_overview_v1"
cd "$PROJECT_ROOT"

echo "🚀 開始批量修復作業..."

# 統計修復前狀態
BEFORE_THROW_ERROR=$(find src tests -name "*.js" | xargs grep -c "throw new Error(" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
BEFORE_TEST_TOTHROW=$(find tests -name "*.test.js" | xargs grep -c "\.toThrow([\"']" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
BEFORE_TEST_REJECTS=$(find tests -name "*.test.js" | xargs grep -c "\.rejects\.toThrow([\"']" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')

echo "📊 修復前統計："
echo "  - throw new Error: $BEFORE_THROW_ERROR"
echo "  - .toThrow('message'): $BEFORE_TEST_TOTHROW"
echo "  - .rejects.toThrow('message'): $BEFORE_TEST_REJECTS"
echo "  - 總計: $((BEFORE_THROW_ERROR + BEFORE_TEST_TOTHROW + BEFORE_TEST_REJECTS))"

# Phase 1: 修復 src/ 中的原生 Error
echo ""
echo "🔧 Phase 1: 修復 src/ 中的原生 Error..."

# 找到所有需要修復的檔案
FIXED_FILES=0
find src -name "*.js" -type f | while read -r file; do
    if grep -q "throw new Error(" "$file"; then
        echo "  修復檔案: $file"
        
        # 檢查是否已經有 StandardError 匯入
        if ! grep -q "StandardError.*require.*src/core/errors/StandardError" "$file"; then
            # 找到第一個 require 語句後插入 StandardError 匯入
            if grep -q "^const.*require" "$file"; then
                # 使用 awk 在第一個 require 之後插入
                awk '
                    /^const.*require/ && !inserted {
                        print $0
                        print "const { StandardError } = require('\''src/core/errors/StandardError'\'')"
                        inserted = 1
                        next
                    }
                    { print $0 }
                ' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
            else
                # 在檔案開頭插入
                echo -e "const { StandardError } = require('src/core/errors/StandardError')\n" | cat - "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
            fi
        fi
        
        # 修復 throw new Error 模式 - 更精確的匹配
        # 處理單引號
        perl -pi -e "s/throw new Error\('([^']*)'\)/throw new StandardError('IMPLEMENTATION_ERROR', '\$1', { category: 'implementation' })/g" "$file"
        # 處理雙引號
        perl -pi -e 's/throw new Error\("([^"]*)"\)/throw new StandardError("IMPLEMENTATION_ERROR", "$1", { category: "implementation" })/g' "$file"
        
        FIXED_FILES=$((FIXED_FILES + 1))
    fi
done

echo "  修復了 $FIXED_FILES 個檔案"

# Phase 2: 修復測試檔案中的字串比較
echo ""
echo "🧪 Phase 2: 修復測試檔案中的字串比較..."

FIXED_TEST_FILES=0
find tests -name "*.test.js" -type f | while read -r file; do
    if grep -q "\.toThrow([\"']" "$file" || grep -q "\.rejects\.toThrow([\"']" "$file"; then
        echo "  修復測試檔案: $file"
        
        # 修復同步測試: .toThrow('message') -> .toThrow(expect.objectContaining({ message: 'message' }))
        perl -pi -e "s/\.toThrow\('([^']*)'\)/\.toThrow(expect.objectContaining({ message: '\$1' }))/g" "$file"
        perl -pi -e 's/\.toThrow\("([^"]*)"\)/\.toThrow(expect.objectContaining({ message: "$1" }))/g' "$file"
        
        # 修復異步測試: .rejects.toThrow('message') -> .rejects.toMatchObject(expect.objectContaining({ message: 'message' }))
        perl -pi -e "s/\.rejects\.toThrow\('([^']*)'\)/\.rejects.toMatchObject(expect.objectContaining({ message: '\$1' }))/g" "$file"
        perl -pi -e 's/\.rejects\.toThrow\("([^"]*)"\)/\.rejects.toMatchObject(expect.objectContaining({ message: "$1" }))/g' "$file"
        
        FIXED_TEST_FILES=$((FIXED_TEST_FILES + 1))
    fi
done

echo "  修復了 $FIXED_TEST_FILES 個測試檔案"

# 統計修復後狀態
AFTER_THROW_ERROR=$(find src tests -name "*.js" | xargs grep -c "throw new Error(" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
AFTER_TEST_TOTHROW=$(find tests -name "*.test.js" | xargs grep -c "\.toThrow([\"']" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
AFTER_TEST_REJECTS=$(find tests -name "*.test.js" | xargs grep -c "\.rejects\.toThrow([\"']" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')

echo ""
echo "📊 修復後統計："
echo "  - throw new Error: $AFTER_THROW_ERROR (修復: $((BEFORE_THROW_ERROR - AFTER_THROW_ERROR)))"
echo "  - .toThrow('message'): $AFTER_TEST_TOTHROW (修復: $((BEFORE_TEST_TOTHROW - AFTER_TEST_TOTHROW)))"
echo "  - .rejects.toThrow('message'): $AFTER_TEST_REJECTS (修復: $((BEFORE_TEST_REJECTS - AFTER_TEST_REJECTS)))"
echo "  - 總修復數量: $(((BEFORE_THROW_ERROR - AFTER_THROW_ERROR) + (BEFORE_TEST_TOTHROW - AFTER_TEST_TOTHROW) + (BEFORE_TEST_REJECTS - AFTER_TEST_REJECTS)))"

# 執行快速測試驗證
echo ""
echo "🧪 執行快速驗證測試..."
if npm test -- --passWithNoTests --bail; then
    echo "✅ 批量修復成功，所有測試通過！"
else
    echo "❌ 測試失敗，需要手動檢查修復結果"
    exit 1
fi

echo "🎯 批量修復作業完成！"