#!/bin/bash

# TEST_ERROR 批量修復腳本
# 將 TEST_ERROR 替換為語意化錯誤代碼

echo "開始批量修復 TEST_ERROR..."

# 定義修復模式
declare -A error_patterns=(
    # 測試環境設定錯誤
    ["TEST_ERROR.*初始化失敗"]="TEST_INITIALIZATION_ERROR"
    ["TEST_ERROR.*未初始化"]="TEST_ENVIRONMENT_ERROR"
    ["TEST_ERROR.*不可用|not available"]="TEST_ENVIRONMENT_ERROR"
    ["TEST_ERROR.*Failed to initialize"]="TEST_INITIALIZATION_ERROR"

    # 模擬器錯誤
    ["TEST_ERROR.*模擬失敗|simulation failed"]="TEST_SIMULATOR_ERROR"
    ["TEST_ERROR.*不支援的.*類型|Unknown.*type"]="TEST_SIMULATOR_ERROR"
    ["TEST_ERROR.*破壞|corruption"]="TEST_SIMULATOR_ERROR"
    ["TEST_ERROR.*崩潰|crash"]="TEST_SIMULATOR_ERROR"

    # 測試資料處理錯誤
    ["TEST_ERROR.*must be|Items must be"]="TEST_VALIDATION_ERROR"
    ["TEST_ERROR.*找不到|無法找到|not found"]="TEST_VALIDATION_ERROR"
    ["TEST_ERROR.*quota exceeded"]="TEST_STORAGE_ERROR"

    # 測試執行錯誤
    ["TEST_ERROR.*Handler error|handler.*失敗"]="TEST_EXECUTION_ERROR"
    ["TEST_ERROR.*步驟.*失敗|step.*failed"]="TEST_WORKFLOW_ERROR"
    ["TEST_ERROR.*未支援的步驟|unsupported step"]="TEST_EXECUTION_ERROR"

    # Chrome Extension 錯誤
    ["TEST_ERROR.*Port disconnected"]="TEST_RUNTIME_ERROR"
    ["TEST_ERROR.*mock failure|Mock.*error"]="TEST_MOCK_ERROR"
    ["TEST_ERROR.*DOM.*失敗|DOM.*error"]="TEST_DOM_SIMULATION_ERROR"
)

# 針對 tests 目錄中的所有 JavaScript 檔案
find tests -name "*.js" -type f | while read -r file; do
    echo "處理檔案: $file"

    # 建立備份
    cp "$file" "$file.backup"

    # 執行替換
    for pattern in "${!error_patterns[@]}"; do
        replacement="${error_patterns[$pattern]}"

        # 使用 sed 進行模式替換
        sed -i.tmp -E "s/'TEST_ERROR'(.*${pattern})/'${replacement}'\1/g" "$file"
        rm -f "$file.tmp"
    done

    # 處理剩餘的一般性 TEST_ERROR
    sed -i.tmp "s/'TEST_ERROR'/'TEST_EXECUTION_ERROR'/g" "$file"
    rm -f "$file.tmp"

    # 檢查是否有變更
    if ! diff -q "$file" "$file.backup" > /dev/null 2>&1; then
        echo "  ✅ 已更新: $file"
    else
        echo "  ⏭️  無變更: $file"
        rm "$file.backup"
    fi
done

echo "批量修復完成！"
echo "注意: 備份檔案已建立 (.backup)，請檢查修復結果後手動清理"