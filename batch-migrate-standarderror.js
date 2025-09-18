#!/usr/bin/env node

/**
 * 批次遷移 StandardError 到 ErrorCodes
 * 自動化遷移指定目錄下所有檔案中的 StandardError 使用
 */

const fs = require('fs')
const path = require('path')

// 目標檔案列表
const targetFiles = [
  'src/background/domains/data-management/services/DataQualityAnalyzer.js',
  'src/background/domains/data-management/services/ValidationBatchProcessor.js',
  'src/background/domains/data-management/services/data-validation-service.js',
  'src/background/domains/data-management/services/ValidationCacheManager.js'
]

// ErrorCode 映射規則
const errorCodeMapping = {
  'REQUIRED_FIELD_MISSING': 'ErrorCodes.VALIDATION_ERROR',
  'INVALID_DATA_FORMAT': 'ErrorCodes.VALIDATION_ERROR',
  'OPERATION_FAILED': 'ErrorCodes.OPERATION_ERROR',
  'FEATURE_NOT_SUPPORTED': 'ErrorCodes.OPERATION_ERROR',
  'RESOURCE_NOT_AVAILABLE': 'ErrorCodes.CHROME_ERROR',
  'VALIDATION_FAILED': 'ErrorCodes.VALIDATION_ERROR',
  'PLATFORM_VALIDATION_ERROR': 'ErrorCodes.VALIDATION_ERROR',
  'UNKNOWN_ERROR': 'ErrorCodes.OPERATION_ERROR'
}

/**
 * 遷移單個檔案
 */
function migrateFile(filePath) {
  console.log(`處理檔案: ${filePath}`)

  if (!fs.existsSync(filePath)) {
    console.log(`檔案不存在: ${filePath}`)
    return
  }

  let content = fs.readFileSync(filePath, 'utf8')
  let changed = false

  // 1. 替換 import/require
  if (content.includes("require('src/core/errors/StandardError')")) {
    content = content.replace(
      /const { StandardError } = require\('src\/core\/errors\/StandardError'\)/g,
      "const { ErrorCodes } = require('src/core/errors/ErrorCodes')"
    )
    changed = true
  }

  // 2. 替換 StandardError 使用
  const standardErrorRegex = /throw new StandardError\('([^']+)',\s*'([^']*)',\s*\{([^}]*)\}\)/g
  let match

  while ((match = standardErrorRegex.exec(content)) !== null) {
    const [fullMatch, errorCode, message, detailsContent] = match
    const newErrorCode = errorCodeMapping[errorCode] || 'ErrorCodes.OPERATION_ERROR'

    // 解析 details 內容
    let category = 'general'
    const categoryMatch = detailsContent.match(/category:\s*['"]([^'"]+)['"]/)
    if (categoryMatch) {
      category = categoryMatch[1]
    }

    // 新的錯誤建立方式
    const replacement = `const error = new Error('${message}')
      error.code = ${newErrorCode}
      error.details = { category: '${category}', timestamp: Date.now() }
      throw error`

    content = content.replace(fullMatch, replacement)
    changed = true
  }

  // 處理模板字符串中的變數
  content = content.replace(/\$\{([^}]+)\}/g, '${$1}')

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8')
    console.log(`✅ 已遷移: ${filePath}`)
  } else {
    console.log(`⏭️  無需變更: ${filePath}`)
  }
}

/**
 * 主程序
 */
function main() {
  console.log('🚀 開始批次遷移 StandardError 到 ErrorCodes...')

  for (const file of targetFiles) {
    try {
      migrateFile(file)
    } catch (error) {
      console.error(`❌ 處理檔案失敗 ${file}:`, error.message)
    }
  }

  console.log('✅ 批次遷移完成!')
}

// 執行主程序
if (require.main === module) {
  main()
}

module.exports = { migrateFile }