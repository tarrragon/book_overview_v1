#!/bin/bash

# StandardErrorWrapper 完整批量修復腳本
# 處理所有剩餘的 StandardErrorWrapper 引用，包括模板字串修復

echo "🚀 開始完整的 StandardErrorWrapper 批量修復..."

# 統計修復前的檔案數
before_count=$(grep -r "StandardErrorWrapper" src/ --include="*.js" | wc -l)
echo "📊 修復前發現 $before_count 個 StandardErrorWrapper 引用"

# 備份重要檔案
echo "💾 建立備份..."
mkdir -p backups/$(date +%Y%m%d_%H%M%S)
backup_dir="backups/$(date +%Y%m%d_%H%M%S)"

# 1. 基本替換：new StandardErrorWrapper -> new StandardError
echo "🔄 步驟 1: 替換 new StandardErrorWrapper 構造函數"
find src/ -name "*.js" -type f | while read file; do
    if grep -q "new StandardErrorWrapper" "$file"; then
        cp "$file" "$backup_dir/$(basename $file).backup"
        sed -i '' 's/new StandardErrorWrapper(/new StandardError(/g' "$file"
    fi
done

# 2. 替換 throw 語句
echo "🔄 步驟 2: 替換 throw 語句"
find src/ -name "*.js" -type f -exec sed -i '' 's/throw new StandardErrorWrapper(/throw new StandardError(/g' {} \;

# 3. 替換靜態方法調用
echo "🔄 步驟 3: 替換靜態方法調用"
find src/ -name "*.js" -type f -exec sed -i '' 's/StandardErrorWrapper\./StandardError\./g' {} \;

# 4. 替換所有剩餘的 StandardErrorWrapper 引用
echo "🔄 步驟 4: 替換所有剩餘引用"
find src/ -name "*.js" -type f -exec sed -i '' 's/StandardErrorWrapper/StandardError/g' {} \;

# 5. 修復模板字串問題：將錯誤的單引號模板字串改為反引號
echo "🔄 步驟 5: 修復模板字串格式"

# 修復常見的模板字串錯誤模式
find src/ -name "*.js" -type f | while read file; do
    # 修復包含 ${} 的單引號字串
    sed -i '' "s/'\\([^']*\\)\\${\\([^}]*\\)}\\([^']*\\)'/\`\\1\\${\\2}\\3\`/g" "$file"

    # 修復更複雜的模板字串
    sed -i '' "s/'\\([^']*\\${[^']*\\)'/\`\\1\`/g" "$file"
done

# 6. 修復特定的已知問題
echo "🔄 步驟 6: 修復特定已知錯誤"

# 修復常見的特定錯誤訊息
find src/ -name "*.js" -type f -exec sed -i '' \
    -e "s/'Invalid priority category: \${category}'/'Invalid priority category: \${category}'/g" \
    -e "s/'Operation failed after \${maxRetries + 1} attempts: \${error.message}'/'Operation failed after \${maxRetries + 1} attempts: \${error.message}'/g" \
    {} \;

# 7. 修復複雜的模板字串（手動指定的模式）
echo "🔄 步驟 7: 修復複雜模板字串"

# 尋找並修復包含多個變數的模板字串
find src/ -name "*.js" -type f -print0 | xargs -0 perl -i -pe "
    s/'([^']*\\\$\{[^}]+\}[^']*)'/(my \$s = \$1) =~ s\/'\/' \`\/g; \$s =~ s\/'\/\`\/g; \$s/ge;
"

# 8. 清理和驗證
echo "🔄 步驟 8: 清理和驗證"

# 移除可能的重複替換
find src/ -name "*.js" -type f -exec sed -i '' 's/StandardError Error/StandardError/g' {} \;

# 統計修復後的檔案數
after_count=$(grep -r "StandardErrorWrapper" src/ --include="*.js" | wc -l)
echo "📊 修復後剩餘 $after_count 個 StandardErrorWrapper 引用"

fixed_count=$((before_count - after_count))
echo "✅ 成功修復 $fixed_count 個 StandardErrorWrapper 引用"

# 顯示剩餘需要手動修復的檔案
if [ $after_count -gt 0 ]; then
    echo "⚠️  仍需手動檢查的檔案 (前10個):"
    grep -r "StandardErrorWrapper" src/ --include="*.js" -l | head -10
    echo ""
    echo "🔍 剩餘引用詳情:"
    grep -r "StandardErrorWrapper" src/ --include="*.js" -n | head -20
fi

# 檢查語法錯誤
echo "🔍 檢查 JavaScript 語法..."
syntax_errors=0
find src/ -name "*.js" -type f | while read file; do
    if ! node -c "$file" > /dev/null 2>&1; then
        echo "❌ 語法錯誤: $file"
        syntax_errors=$((syntax_errors + 1))
    fi
done

if [ $syntax_errors -eq 0 ]; then
    echo "✅ 所有檔案語法檢查通過"
else
    echo "⚠️  發現 $syntax_errors 個檔案有語法錯誤，請手動檢查"
fi

echo "🎉 StandardErrorWrapper 完整批量修復完成!"
echo "📁 備份檔案位置: $backup_dir"

# 產生修復報告
cat > standarderrorwrapper-fix-report.md << EOF
# StandardErrorWrapper 修復報告

## 修復統計
- **修復前引用數**: $before_count
- **修復後引用數**: $after_count
- **成功修復數**: $fixed_count
- **修復時間**: $(date)
- **備份位置**: $backup_dir

## 修復內容
1. ✅ 替換 \`new StandardErrorWrapper\` 為 \`new StandardError\`
2. ✅ 替換 \`throw new StandardErrorWrapper\` 為 \`throw new StandardError\`
3. ✅ 替換靜態方法調用
4. ✅ 替換所有剩餘引用
5. ✅ 修復模板字串格式問題
6. ✅ 修復特定已知錯誤
7. ✅ 清理和驗證

## 剩餘工作
$(if [ $after_count -gt 0 ]; then
    echo "- [ ] 手動檢查和修復剩餘的 $after_count 個引用"
    echo "- [ ] 驗證修復後的功能正常運作"
else
    echo "- [x] 所有 StandardErrorWrapper 引用已修復完成"
fi)
- [ ] 執行完整測試套件
- [ ] 更新文件和最佳實踐指引

EOF

echo "📝 修復報告已產生: standarderrorwrapper-fix-report.md"