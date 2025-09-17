#!/usr/bin/env node

/**
 * 精確的 StandardErrorWrapper 修復腳本
 * 使用精確的正則表達式來處理多行和複雜格式
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// 錯誤代碼映射表
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
  'BOOK_PROCESSING_ERROR': 'BOOK_ERROR',
  'INVALID_DATA_FORMAT': 'VALIDATION_ERROR'
}

/**
 * 獲取所有包含 StandardErrorWrapper 的檔案
 */
function getFilesToFix() {
  try {
    const output = execSync('find src -name "*.js" -type f -exec grep -l "StandardErrorWrapper" {} \\;',
      { encoding: 'utf8' })
    return output.trim().split('\n').filter(f => f.length > 0)
  } catch (error) {
    console.error('無法獲取檔案清單:', error.message)
    return []
  }
}

/**
 * 修復單一檔案的 StandardErrorWrapper 引用
 */
function fixFile(filePath) {
  try {
    console.log(`正在修復: ${filePath}`)

    if (!fs.existsSync(filePath)) {
      console.log(`檔案不存在，跳過: ${filePath}`)
      return { success: false, error: 'File not found' }
    }

    let content = fs.readFileSync(filePath, 'utf8')
    let modified = false

    // 1. 添加 ErrorCodes 引用（如果還沒有）
    if (content.includes("require('src/core/errors/StandardError')") &&
        !content.includes("require('src/core/errors/ErrorCodes')")) {
      content = content.replace(
        /const { StandardError } = require\('src\/core\/errors\/StandardError'\)/,
        "const { StandardError } = require('src/core/errors/StandardError')\\nconst { ErrorCodes } = require('src/core/errors/ErrorCodes')"
      )
      modified = true
    }

    // 2. 替換 StandardErrorWrapper 引用
    // 支援多行和各種格式的正則表達式
    const patterns = [
      // 模式1: 標準三參數格式 (單行)
      /throw new StandardErrorWrapper\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*\{([^}]+)\}\s*\)/g,

      // 模式2: 多行格式
      /throw new StandardErrorWrapper\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*\{\s*([^}]+)\s*\}\s*\)/gs
    ]

    for (const pattern of patterns) {
      content = content.replace(pattern, (match, errorCode, message, details) => {
        // 清理詳細資訊字串
        const cleanDetails = details.trim().replace(/\s+/g, ' ')

        // 映射錯誤代碼
        const mappedErrorCode = errorCodeMapping[errorCode] || 'UNKNOWN_ERROR'

        // 生成新的錯誤格式
        const newError = `const error = new Error('${message}')
      error.code = ErrorCodes.${mappedErrorCode}
      error.details = { ${cleanDetails} }
      throw error`

        modified = true
        return newError
      })
    }

    // 3. 處理特殊情況：空白和縮排
    content = content.replace(/\n\s+const error = new Error/g, '\n      const error = new Error')

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8')
      console.log(`✅ 成功修復: ${filePath}`)
      return { success: true, modified: true }
    } else {
      console.log(`⚠️  無需修復: ${filePath}`)
      return { success: true, modified: false }
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
  console.log('開始精確修復 StandardErrorWrapper 引用...\n')

  // 獲取需要修復的檔案
  const filesToFix = getFilesToFix()
  console.log(`找到 ${filesToFix.length} 個需要修復的檔案\n`)

  if (filesToFix.length === 0) {
    console.log('沒有找到需要修復的檔案')
    return
  }

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  }

  // 修復每個檔案
  for (const filePath of filesToFix) {
    const result = fixFile(filePath)

    if (result.success) {
      if (result.modified) {
        results.success++
      } else {
        results.skipped++
      }
    } else {
      results.failed++
      results.errors.push({ file: filePath, error: result.error })
    }
  }

  // 輸出總結
  console.log('\n=== 精確修復總結 ===')
  console.log(`成功修復: ${results.success} 個檔案`)
  console.log(`跳過檔案: ${results.skipped} 個檔案`)
  console.log(`修復失敗: ${results.failed} 個檔案`)

  if (results.errors.length > 0) {
    console.log('\n失敗檔案詳情:')
    results.errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`)
    })
  }

  // 檢查剩餘的 StandardErrorWrapper 引用
  console.log('\n檢查剩餘的 StandardErrorWrapper 引用...')
  try {
    const remainingFiles = execSync('find src -name "*.js" -type f -exec grep -l "StandardErrorWrapper" {} \\;',
      { encoding: 'utf8' }).trim()

    if (remainingFiles) {
      console.log('仍需手動處理的檔案:')
      remainingFiles.split('\n').forEach(file => {
        console.log(`  - ${file}`)
      })
    } else {
      console.log('✅ 所有 StandardErrorWrapper 引用已修復！')
    }
  } catch (error) {
    console.log('✅ 沒有剩餘的 StandardErrorWrapper 引用')
  }

  console.log('\n精確修復完成！')
}

// 執行腳本
if (require.main === module) {
  main()
}

module.exports = { fixFile, errorCodeMapping }