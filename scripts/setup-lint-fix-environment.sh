#!/bin/bash

# Lint 修正環境設定腳本
# 設定所有腳本權限並驗證環境準備狀況

set -e

# 動態獲取專案根目錄路徑
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

echo "🔧 Lint 修正環境設定開始"
echo "📁 專案根目錄: $PROJECT_ROOT"
echo "📁 腳本目錄: $SCRIPTS_DIR"
echo "================================"

# 需要設定權限的腳本清單
SCRIPTS=(
    "master-lint-fix.sh"
    "comprehensive-lint-fix.sh"  
    "fix-standard-error-imports.sh"
    "fix-template-string-errors.sh"
    "validate-lint-fixes.sh"
    "setup-lint-fix-environment.sh"
)

echo "🔧 設定腳本執行權限..."

# 設定權限並驗證
for script in "${SCRIPTS[@]}"; do
    script_path="$SCRIPTS_DIR/$script"
    
    if [ -f "$script_path" ]; then
        chmod +x "$script_path"
        echo "  ✅ $script - 權限已設定"
    else
        echo "  ⚠️  $script - 檔案不存在"
    fi
done

echo ""
echo "🔍 環境檢查..."

# 檢查 Node.js 環境
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo "  ✅ Node.js: $NODE_VERSION"
else
    echo "  ❌ Node.js 未安裝"
fi

if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo "  ✅ npm: $NPM_VERSION"
else
    echo "  ❌ npm 未安裝"
fi

# 檢查專案依賴
if [ -f "$PROJECT_ROOT/package.json" ]; then
    echo "  ✅ package.json 存在"
    
    if [ -d "$PROJECT_ROOT/node_modules" ]; then
        echo "  ✅ node_modules 存在"
    else
        echo "  ⚠️  node_modules 不存在，可能需要執行 npm install"
    fi
else
    echo "  ❌ package.json 不存在"
fi

# 檢查關鍵目錄
if [ -d "$PROJECT_ROOT/src" ]; then
    echo "  ✅ src 目錄存在"
else
    echo "  ❌ src 目錄不存在"
fi

if [ -d "$PROJECT_ROOT/tests" ]; then
    echo "  ✅ tests 目錄存在"
else
    echo "  ⚠️  tests 目錄不存在"
fi

# 檢查 ESLint 配置
if grep -q '"lint"' "$PROJECT_ROOT/package.json" 2>/dev/null; then
    echo "  ✅ ESLint 腳本已配置"
else
    echo "  ❌ ESLint 腳本未配置"
fi

echo ""
echo "📊 專案狀況快速檢查..."

cd "$PROJECT_ROOT"

# 檢查當前 git 狀況
if git rev-parse --git-dir >/dev/null 2>&1; then
    echo "  ✅ Git 倉庫"
    
    UNCOMMITTED=$(git status --porcelain | wc -l)
    if [ "$UNCOMMITTED" -eq 0 ]; then
        echo "  ✅ 工作目錄乾淨"
    else
        echo "  ⚠️  有 $UNCOMMITTED 個未提交的變更"
    fi
else
    echo "  ❌ 不是 Git 倉庫"
fi

# 檢查可用磁碟空間
AVAILABLE_SPACE=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $4}')
echo "  📁 可用空間: $AVAILABLE_SPACE"

echo ""
echo "🚀 執行建議..."

# 生成使用建議
if [ -f "$SCRIPTS_DIR/master-lint-fix.sh" ] && [ -x "$SCRIPTS_DIR/master-lint-fix.sh" ]; then
    echo "✅ 環境設定完成！可以開始執行修正："
    echo ""
    echo "🎯 推薦執行順序："
    echo "1. 快速狀況檢查:"
    echo "   npm run lint | head -20"
    echo ""
    echo "2. 執行完整修正:"  
    echo "   ./scripts/master-lint-fix.sh"
    echo ""
    echo "3. 驗證修正效果:"
    echo "   ./scripts/validate-lint-fixes.sh"
    echo ""
    echo "4. 檢查修正結果:"
    echo "   cat .validation-reports/validation_summary.txt"
    echo ""
    echo "📚 詳細使用說明請參考:"
    echo "   cat scripts/README-lint-fix-scripts.md"
    
else
    echo "❌ 環境設定不完整，請檢查腳本檔案"
fi

# 建立快速測試功能
echo ""
echo "🧪 環境測試功能..."

cat > "$SCRIPTS_DIR/quick-lint-test.sh" << 'EOF'
#!/bin/bash
# 快速 Lint 測試腳本

echo "🔍 快速 Lint 狀況檢查"
echo "執行時間: $(date)"
echo "================================"

cd "$PROJECT_ROOT"

# 執行 lint 並取得基本統計
npm run lint 2>&1 | head -30

echo ""
echo "📊 問題統計："
npm run lint 2>&1 | grep -E "✖ [0-9]+ problems" | head -1 || echo "無法取得統計"

echo ""
echo "🎯 主要問題類型："
npm run lint 2>&1 | grep -E "(🚨|no-template-curly-in-string|no-unused-vars)" | head -5 || echo "無明顯問題模式"

echo ""
echo "💡 如果問題很多，建議執行:"
echo "   ./scripts/master-lint-fix.sh"
EOF

chmod +x "$SCRIPTS_DIR/quick-lint-test.sh"
echo "  ✅ 已建立快速測試腳本: scripts/quick-lint-test.sh"

echo ""
echo "✅ Lint 修正環境設定完成！"
echo "⏰ 設定時間: $(date)"

# 建立環境狀態記錄
cat > "$PROJECT_ROOT/.lint-fix-env-status" << EOF
Lint 修正環境狀態記錄
設定時間: $(date)

腳本狀態:
$(for script in "${SCRIPTS[@]}"; do
    if [ -x "$SCRIPTS_DIR/$script" ]; then
        echo "  ✅ $script"
    else
        echo "  ❌ $script"
    fi
done)

環境檢查:
  Node.js: $(command -v node >/dev/null 2>&1 && node --version || echo "未安裝")
  npm: $(command -v npm >/dev/null 2>&1 && npm --version || echo "未安裝")
  Git 狀態: $(git status --porcelain | wc -l) 個未提交變更

可用功能:
  快速測試: ./scripts/quick-lint-test.sh
  完整修正: ./scripts/master-lint-fix.sh  
  效果驗證: ./scripts/validate-lint-fixes.sh
  使用說明: scripts/README-lint-fix-scripts.md
EOF

echo "📋 環境狀態已記錄至: .lint-fix-env-status"