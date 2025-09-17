#!/usr/bin/env node

/**
 * StandardErrorWrapper 批量修復腳本
 *
 * 功能：
 * 1. 掃描所有包含 StandardErrorWrapper 的 JS 檔案
 * 2. 自動修復 ErrorCodes 引用
 * 3. 轉換 StandardErrorWrapper 為標準錯誤格式
 * 4. 保持語意和詳細資訊完整性
 */

const fs = require('fs')
const path = require('path')

// 需要修復的檔案清單（從 grep 結果獲得）
const filesToFix = [
  'src/ui/search/filter/filter-engine.js',
  'src/ui/search/core/search-index-manager.js',
  'src/ui/search/core/search-engine.js',
  'src/ui/search/coordinator/search-coordinator.js',
  'src/ui/search/cache/search-cache-manager.js',
  'src/ui/handlers/ui-progress-handler.js',
  'src/ui/handlers/ui-notification-handler.js',
  'src/ui/handlers/ui-event-validator.js',
  'src/ui/book-search-filter.js',
  'src/ui/book-search-filter-integrated.js',
  'src/ui/book-grid-renderer.js',
  'src/storage/handlers/storage-save-handler.js',
  'src/storage/handlers/storage-load-handler.js',
  'src/storage/handlers/storage-completion-handler.js',
  'src/storage/adapters/chrome-storage-adapter.js',
  'src/popup/utils/event-manager.js',
  'src/popup/services/popup-communication-service.js',
  'src/popup/popup.js',
  'src/popup/popup-event-controller.js',
  'src/popup/components/popup-status-manager.js',
  'src/popup/components/popup-progress-manager.js',
  'src/platform/readmoo-platform-migration-validator.js',
  'src/export/handlers/progress-handler.js',
  'src/export/handlers/json-export-handler.js',
  'src/export/handlers/handler-registry.js',
  'src/export/handlers/excel-export-handler.js',
  'src/export/handlers/error-handler.js',
  'src/export/export-manager.js',
  'src/export/book-data-exporter.js',
  'src/error-handling/event-tracker.js',
  'src/error-handling/event-performance-monitor.js',
  'src/deployment/chrome-store-readiness.js',
  'src/data-management/SchemaMigrationService.js',
  'src/core/messages/MessageDictionary.js',
  'src/core/events/event-naming-upgrade-coordinator.js',
  'src/core/enums/LogLevel.js',
  'src/content/utils/memory-utils.js',
  'src/content/utils/event-utils.js',
  'src/content/utils/error-handling-utils.js',
  'src/content/utils/dom-utils.js',
  'src/content/utils/config-utils.js',
  'src/content/platform/platform-adapter-interface.js',
  'src/content/extractors/book-data-extractor.js',
  'src/content/core/content-event-bus.js',
  'src/content/bridge/chrome-event-bridge.js',
  'src/background/messaging/popup-message-handler.js',
  'src/background/monitoring/content-coordinator.js',
  'src/background/messaging/content-message-handler.js',
  'src/background/messaging/chrome-api-wrapper.js',
  'src/background/lifecycle/startup-handler.js',
  'src/background/lifecycle/shutdown-handler.js',
  'src/background/lifecycle/install-handler.js',
  'src/background/i18n/i18n-manager.js',
  'src/background/events/event-coordinator.js'
]

// 錯誤代碼映射
const errorCodeMapping = {
  'EVENTBUS_ERROR': 'VALIDATION_ERROR',
  'UI_OPERATION_FAILED': 'OPERATION_ERROR',
  'VALIDATION_FAILED': 'VALIDATION_ERROR',
  'NETWORK_TIMEOUT': 'TIMEOUT_ERROR',
  'STORAGE_FAILED': 'STORAGE_ERROR',
  'CHROME_API_ERROR': 'CHROME_ERROR',
  'DOM_MANIPULATION_ERROR': 'DOM_ERROR',
  'FILE_OPERATION_ERROR': 'FILE_ERROR',
  'PERMISSION_DENIED': 'PERMISSION_ERROR',
  'PARSE_FAILED': 'PARSE_ERROR',
  'CONNECTION_FAILED': 'CONNECTION_ERROR',
  'CONFIG_INVALID': 'CONFIG_ERROR',
  'RENDER_FAILED': 'RENDER_ERROR',
  'PERFORMANCE_ISSUE': 'PERFORMANCE_ERROR',
  'UNKNOWN_ERROR': 'UNKNOWN_ERROR',
  'READMOO_API_ERROR': 'READMOO_ERROR',
  'BOOK_PROCESSING_ERROR': 'BOOK_ERROR'
}

/**
 * 修復單一檔案
 */
function fixFile(filePath) {
  try {
    console.log(`正在修復: ${filePath}`)

    const fullPath = path.join(__dirname, filePath)
    if (!fs.existsSync(fullPath)) {
      console.log(`檔案不存在，跳過: ${filePath}`)
      return { success: false, error: 'File not found' }
    }

    let content = fs.readFileSync(fullPath, 'utf8')
    let modified = false

    // 1. 添加 ErrorCodes 引用（如果還沒有）
    if (content.includes("require('src/core/errors/StandardError')") &&
        !content.includes("require('src/core/errors/ErrorCodes')")) {
      content = content.replace(
        "const { StandardError } = require('src/core/errors/StandardError')",
        "const { StandardError } = require('src/core/errors/StandardError')\nconst { ErrorCodes } = require('src/core/errors/ErrorCodes')"
      )
      modified = true
    }

    // 2. 替換 StandardErrorWrapper 引用
    const standardErrorWrapperRegex = /throw new StandardErrorWrapper\(\s*['"](.*?)['"],\s*['"](.*?)['"],\s*\{([^}]*)\}\s*\)/g

    content = content.replace(standardErrorWrapperRegex, (match, errorCode, message, details) => {
      // 映射錯誤代碼到 ErrorCodes
      const mappedErrorCode = errorCodeMapping[errorCode] || 'UNKNOWN_ERROR'

      // 格式化替換
      const newErrorCode = `
      const error = new Error('${message}')
      error.code = ErrorCodes.${mappedErrorCode}
      error.details = {${details}}
      throw error`

      modified = true
      return newErrorCode.trim()
    })

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8')
      console.log(`✅ 成功修復: ${filePath}`)
      return { success: true }
    } else {
      console.log(`⚠️  無需修復: ${filePath}`)
      return { success: true, skipped: true }
    }

  } catch (error) {
    console.error(`❌ 修復失敗: ${filePath}`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * 主要執行函數
 */
function main() {
  console.log('開始批量修復 StandardErrorWrapper 引用...\n')

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  }

  for (const filePath of filesToFix) {
    const result = fixFile(filePath)

    if (result.success) {
      if (result.skipped) {
        results.skipped++
      } else {
        results.success++
      }
    } else {
      results.failed++
      results.errors.push({ file: filePath, error: result.error })
    }
  }

  // 輸出總結
  console.log('\n=== 批量修復總結 ===')
  console.log(`成功修復: ${results.success} 個檔案`)
  console.log(`跳過檔案: ${results.skipped} 個檔案`)
  console.log(`修復失敗: ${results.failed} 個檔案`)

  if (results.errors.length > 0) {
    console.log('\n失敗檔案詳情:')
    results.errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`)
    })
  }

  console.log('\n批量修復完成！')
}

// 執行腳本
if (require.main === module) {
  main()
}

module.exports = { fixFile, errorCodeMapping }