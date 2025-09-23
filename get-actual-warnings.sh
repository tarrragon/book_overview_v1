#!/bin/bash

cd /Users/tarragon/Projects/book_overview_v1

echo "🔍 獲取當前 ESLint 警告狀況..."
echo ""

# 執行 ESLint 並過濾出非 no-unused-vars 和 no-console 的警告
npx eslint src/ tests/ 2>&1 | grep -E "warning.*" | grep -v "no-unused-vars" | grep -v "no-console" > other-warnings.txt

echo "📊 其他警告統計："
echo ""

if [ -s other-warnings.txt ]; then
    echo "🎯 發現的其他警告類型："

    # 統計各種警告類型
    echo "   no-new warnings:"
    grep "no-new" other-warnings.txt | wc -l | awk '{print "     " $1 " 個"}'

    echo "   multiline-ternary warnings:"
    grep "multiline-ternary" other-warnings.txt | wc -l | awk '{print "     " $1 " 個"}'

    echo "   no-control-regex warnings:"
    grep "no-control-regex" other-warnings.txt | wc -l | awk '{print "     " $1 " 個"}'

    echo "   no-useless-constructor warnings:"
    grep "no-useless-constructor" other-warnings.txt | wc -l | awk '{print "     " $1 " 個"}'

    echo "   n/no-callback-literal warnings:"
    grep "n/no-callback-literal" other-warnings.txt | wc -l | awk '{print "     " $1 " 個"}'

    echo "   accessor-pairs warnings:"
    grep "accessor-pairs" other-warnings.txt | wc -l | awk '{print "     " $1 " 個"}'

    echo "   no-useless-catch warnings:"
    grep "no-useless-catch" other-warnings.txt | wc -l | awk '{print "     " $1 " 個"}'

    echo "   n/handle-callback-err warnings:"
    grep "n/handle-callback-err" other-warnings.txt | wc -l | awk '{print "     " $1 " 個"}'

    echo ""
    echo "📋 前5個範例："
    head -5 other-warnings.txt

    echo ""
    echo "📄 完整清單已存到 other-warnings.txt"

else
    echo "✅ 沒有發現其他類型的警告！"
fi

echo ""
echo "📈 總體狀況："
echo "   no-unused-vars 警告:"
npx eslint src/ tests/ 2>&1 | grep "no-unused-vars" | wc -l | awk '{print "     " $1 " 個"}'

echo "   no-console 警告:"
npx eslint src/ tests/ 2>&1 | grep "no-console" | wc -l | awk '{print "     " $1 " 個"}'

echo "   其他警告:"
wc -l other-warnings.txt | awk '{print "     " $1 " 個"}'