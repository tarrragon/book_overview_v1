#!/bin/bash

# 修正 permission-management-service.js 的破損語法
SERVICE_FILE="src/background/domains/page/services/permission-management-service.js"

echo "修正 permission-management-service.js 破損語法..."

# 修正破損的 eventBus.emit 語法
sed -i '' 's/await this.eventBus.emit([^)]*)/&/g; /error\.code = ErrorCodes\./,/})$/d' "$SERVICE_FILE"

# 移除殘留的破損語法
sed -i '' '/^[[:space:]]*error\.code = ErrorCodes\./,/^[[:space:]]*})$/d' "$SERVICE_FILE"

# 修正 initializePermissionConfigs 中的破損語法
sed -i '' '/this\.requiredPermissions\.set.*activeTab.*/{
N
/error\.code = ErrorCodes\./,/})$/d
}' "$SERVICE_FILE"

echo "語法修正完成，檢查檔案語法..."
node -c "$SERVICE_FILE" && echo "✅ 語法檢查通過" || echo "❌ 語法檢查失敗"