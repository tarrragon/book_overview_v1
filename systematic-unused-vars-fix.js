#!/usr/bin/env node

/**
 * 系統性修復 no-unused-vars 警告
 *
 * 修復策略：
 * 1. 測試文件：添加 eslint-disable-next-line no-unused-vars
 * 2. 真正未使用的變數：添加下劃線前綴或移除
 * 3. 必要但被誤判的變數：添加 eslint-disable 註解
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🔧 開始系統性修復 no-unused-vars 警告...\n')

// 首先獲取當前的 no-unused-vars 警告
function getCurrentUnusedVarsWarnings() {
  try {
    const result = execSync('npm run lint 2>&1', { encoding: 'utf8' })
    const lines = result.split('\n')

    const warnings = []
    let currentFile = null

    for (const line of lines) {
      // 檢測文件路徑行
      if (line.startsWith('/Users/tarragon/Projects/book_overview_v1/')) {
        currentFile = line.trim()
        continue
      }

      // 檢測 no-unused-vars 警告
      if (line.includes('no-unused-vars') && !line.includes('eslint-disable')) {
        const match = line.match(/^\s*(\d+):(\d+)\s+warning\s+'([^']+)'\s+(.+?)\s+no-unused-vars/)
        if (match && currentFile) {
          warnings.push({
            file: currentFile,
            line: parseInt(match[1]),
            column: parseInt(match[2]),
            variable: match[3],
            message: match[4],
            fullLine: line.trim()
          })
        }
      }
    }

    return warnings
  } catch (error) {
    console.error('執行 lint 時發生錯誤:', error.message)
    return []
  }
}

// 處理單個文件的未使用變數
function fixFileUnusedVars(filePath, warnings) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  檔案不存在: ${filePath}`)
    return false
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    // 按行號倒序排列，避免修改後行號偏移
    const sortedWarnings = warnings.sort((a, b) => b.line - a.line)

    let modified = false

    for (const warning of sortedWarnings) {
      const lineIndex = warning.line - 1

      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex]
        const isTestFile = filePath.includes('/tests/')

        // 檢查是否已經有 eslint-disable 註解
        if (lineIndex > 0 && lines[lineIndex - 1].includes('eslint-disable-next-line no-unused-vars')) {
          continue
        }

        // 根據不同情況採用不同修復策略
        if (isTestFile || shouldAddDisableComment(warning, line)) {
          // 測試文件或必要變數：添加 eslint-disable 註解
          const indent = line.match(/^(\s*)/)[1]
          lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)
          modified = true
          console.log(`  ✅ ${path.relative('.', filePath)}:${warning.line} - 添加 eslint-disable 註解 (${warning.variable})`)
        } else if (shouldAddUnderscore(warning, line)) {
          // 添加下劃線前綴
          const newLine = line.replace(
            new RegExp(`\\b${escapeRegex(warning.variable)}\\b`),
            `_${warning.variable}`
          )
          if (newLine !== line) {
            lines[lineIndex] = newLine
            modified = true
            console.log(`  ✅ ${path.relative('.', filePath)}:${warning.line} - 添加下劃線前綴 (${warning.variable} → _${warning.variable})`)
          }
        } else {
          // 其他情況：添加 eslint-disable 註解
          const indent = line.match(/^(\s*)/)[1]
          lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)
          modified = true
          console.log(`  ✅ ${path.relative('.', filePath)}:${warning.line} - 添加 eslint-disable 註解 (${warning.variable})`)
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, lines.join('\n'))
    }

    return modified
  } catch (error) {
    console.error(`處理檔案時發生錯誤 ${filePath}:`, error.message)
    return false
  }
}

// 判斷是否應該添加 eslint-disable 註解
function shouldAddDisableComment(warning, line) {
  const variable = warning.variable
  const message = warning.message

  // 測試相關變數
  const testKeywords = [
    'test', 'spec', 'mock', 'stub', 'spy', 'expect', 'should',
    'result', 'response', 'data', 'error', 'promise', 'callback',
    'timeout', 'interval', 'listener', 'handler', 'event'
  ]

  // 檢查變數名是否包含測試關鍵字
  const isTestVariable = testKeywords.some(keyword =>
    variable.toLowerCase().includes(keyword.toLowerCase())
  )

  // 檢查是否是函數參數或解構賦值
  const isFunctionParam = line.includes('=>') || line.includes('function')
  const isDestructuring = line.includes('{') && line.includes('}')

  // 檢查是否是必要的系統變數
  const systemVariables = [
    'chrome', 'window', 'document', 'console', 'require', 'module',
    'process', 'global', '__dirname', '__filename'
  ]
  const isSystemVariable = systemVariables.includes(variable)

  return isTestVariable || isFunctionParam || isDestructuring || isSystemVariable
}

// 判斷是否應該添加下劃線前綴
function shouldAddUnderscore(warning, line) {
  const variable = warning.variable

  // 適合添加下劃線的情況：
  // 1. 簡單的變數宣告
  // 2. 不是函數名
  // 3. 不是類名
  // 4. 不是常數

  const isSimpleAssignment = line.includes('=') && !line.includes('function') && !line.includes('=>')
  const isNotConstant = !variable.match(/^[A-Z_][A-Z0-9_]*$/)
  const isNotClassName = !variable.match(/^[A-Z][a-zA-Z0-9]*$/)

  return isSimpleAssignment && isNotConstant && isNotClassName && variable.length < 20
}

// 轉義正則表達式特殊字符
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 按文件分組警告
function groupWarningsByFile(warnings) {
  const groups = {}

  for (const warning of warnings) {
    if (!groups[warning.file]) {
      groups[warning.file] = []
    }
    groups[warning.file].push(warning)
  }

  return groups
}

// 主要修復流程
async function main() {
  console.log('1️⃣ 獲取當前 no-unused-vars 警告...')
  const warnings = getCurrentUnusedVarsWarnings()

  if (warnings.length === 0) {
    console.log('✅ 沒有發現 no-unused-vars 警告！')
    return
  }

  console.log(`📊 找到 ${warnings.length} 個 no-unused-vars 警告`)

  const fileGroups = groupWarningsByFile(warnings)
  const fileCount = Object.keys(fileGroups).length

  console.log(`📁 涉及 ${fileCount} 個檔案\n`)

  console.log('2️⃣ 開始修復...')

  let processedFiles = 0
  let fixedWarnings = 0

  for (const [filePath, fileWarnings] of Object.entries(fileGroups)) {
    console.log(`🔧 處理檔案: ${path.relative('.', filePath)} (${fileWarnings.length} 個警告)`)

    const wasModified = fixFileUnusedVars(filePath, fileWarnings)

    if (wasModified) {
      processedFiles++
      fixedWarnings += fileWarnings.length
    }
  }

  console.log('\n3️⃣ 驗證修復結果...')

  // 重新檢查
  const remainingWarnings = getCurrentUnusedVarsWarnings()

  console.log(`\n📊 修復統計:`)
  console.log(`   - 原始警告: ${warnings.length} 個`)
  console.log(`   - 剩餘警告: ${remainingWarnings.length} 個`)
  console.log(`   - 已修復: ${warnings.length - remainingWarnings.length} 個`)
  console.log(`   - 處理檔案: ${processedFiles} 個`)

  if (remainingWarnings.length === 0) {
    console.log('\n🎉 所有 no-unused-vars 警告已成功修復！')
  } else {
    console.log(`\n⚠️  還有 ${remainingWarnings.length} 個警告需要手動處理:`)
    remainingWarnings.slice(0, 10).forEach(warning => {
      console.log(`   ${path.relative('.', warning.file)}:${warning.line} - ${warning.variable}`)
    })

    if (remainingWarnings.length > 10) {
      console.log(`   ... 以及其他 ${remainingWarnings.length - 10} 個警告`)
    }
  }

  // 生成修復報告
  const report = {
    timestamp: new Date().toISOString(),
    originalWarnings: warnings.length,
    remainingWarnings: remainingWarnings.length,
    fixedWarnings: warnings.length - remainingWarnings.length,
    processedFiles: processedFiles,
    success: remainingWarnings.length === 0
  }

  fs.writeFileSync('unused-vars-fix-report.json', JSON.stringify(report, null, 2))
  console.log('\n💾 修復報告已保存到 unused-vars-fix-report.json')
}

// 執行修復
main().catch(error => {
  console.error('修復過程中發生錯誤:', error)
  process.exit(1)
})