#!/bin/bash

# 清理未使用的 StandardError 導入和賦值
# 這些是 StandardError 遷移過程中的殘留

echo "🧹 清理未使用的 StandardError 變數..."

# 找到所有包含未使用 StandardError 的檔案
npm run lint 2>&1 | grep "StandardError.*is.*but never used" | while read -r line; do
    # 提取檔案路徑和行號
    if [[ $line =~ ^([^:]+):([0-9]+):.* ]]; then
        file="${BASH_REMATCH[1]}"
        line_num="${BASH_REMATCH[2]}"

        echo "處理檔案: $file 第 $line_num 行"

        # 檢查這一行的內容
        actual_line=$(sed -n "${line_num}p" "$file")
        echo "  原始內容: $actual_line"

        # 如果是 require 的解構賦值中包含 StandardError，將其移除
        if [[ $actual_line =~ const.*\{.*StandardError.*\}.*=.*require ]]; then
            # 從解構中移除 StandardError
            sed -i "${line_num}s/, *StandardError//g; ${line_num}s/StandardError *, *//g; ${line_num}s/{ *StandardError *}/{ }/g" "$file"
            echo "  ✅ 已從 require 解構中移除 StandardError"

        # 如果是單獨的 StandardError 導入行，註釋掉
        elif [[ $actual_line =~ StandardError.*=.*require ]]; then
            sed -i "${line_num}s/^/\/\/ REMOVED: /" "$file"
            echo "  ✅ 已註釋掉未使用的 StandardError 導入"

        # 如果是變數賦值，註釋掉
        elif [[ $actual_line =~ .*StandardError.* ]]; then
            sed -i "${line_num}s/^/\/\/ REMOVED: /" "$file"
            echo "  ✅ 已註釋掉未使用的 StandardError 變數"
        fi
    fi
done

echo "🎯 清理完成！重新檢查未使用的 StandardError..."
npm run lint 2>&1 | grep "StandardError.*is.*but never used" | wc -l