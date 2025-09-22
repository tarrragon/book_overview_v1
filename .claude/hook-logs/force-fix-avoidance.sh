#!/bin/bash

# force-fix-avoidance.sh
# 強制修正任務逃避行為的腳本

echo "🚨 強制修正任務逃避行為"
echo ""
echo "請按照以下步驟完成修正:"
echo ""
echo "1. 📋 檢查報告"
echo "   cat $1"
echo ""
echo "2. 🔧 修正工作日誌"
echo "   # 移除所有禁用詞彙，重新描述解決方案"
echo ""
echo "3. 🧪 修復測試"
echo "   # 取消所有 skip 的測試並修復"
echo "   npm test"
echo ""
echo "4. 🔍 修復 ESLint 錯誤"
echo "   npm run lint:fix"
echo ""
echo "5. 📝 處理技術債務"
echo "   # 將所有 TODO/FIXME 轉換為實際解決方案"
echo ""
echo "6. ✅ 確認修正完成"
echo "   # 確保所有檢查通過後執行:"
echo "   rm .claude/TASK_AVOIDANCE_FIX_MODE"
echo ""

