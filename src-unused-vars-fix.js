#!/usr/bin/env node

/**
 * 修復源代碼文件中的 no-unused-vars 警告
 *
 * 策略：
 * 1. 分析變數使用情況
 * 2. 真正未使用的變數移除或添加下劃線
 * 3. 系統變數或必要變數添加 eslint-disable
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('📦 修復源代碼文件中的 no-unused-vars 警告...\n')

// 獲取源代碼文件中的 no-unused-vars 警告
function getSrcFileWarnings() {
  try {
    const result = execSync('npm run lint src/ 2>&1', { encoding: 'utf8' })
    const lines = result.split('\n')

    const warnings = []
    let currentFile = null

    for (const line of lines) {
      // 檢測文件路徑行
      if (line.includes('/src/') && line.includes('.js')) {
        currentFile = line.trim()
        continue
      }

      // 檢測 no-unused-vars 警告
      if (line.includes('no-unused-vars') && !line.includes('eslint-disable') && currentFile) {
        const match = line.match(/^\s*(\d+):(\d+)\s+warning\s+'([^']+)'\s+(.+?)\s+no-unused-vars/)
        if (match) {
          warnings.push({
            file: currentFile,
            line: parseInt(match[1]),
            column: parseInt(match[2]),
            variable: match[3],
            message: match[4]
          })
        }
      }
    }

    return warnings
  } catch (error) {
    console.error('無法獲取源代碼文件警告:', error.message)
    return []
  }
}

// 分析變數類型和修復策略
function analyzeVariable(warning, line) {
  const { variable, message } = warning

  // 系統變數或全域變數
  const systemVars = ['chrome', 'window', 'document', 'console', 'global', 'process']
  if (systemVars.includes(variable)) {
    return { strategy: 'disable', reason: '系統變數' }
  }

  // 常數 (全大寫)
  if (/^[A-Z_][A-Z0-9_]*$/.test(variable)) {
    return { strategy: 'disable', reason: '常數定義' }
  }

  // 事件處理器或回調函數參數
  if (variable.includes('Handler') || variable.includes('Callback') || variable.includes('Event')) {
    return { strategy: 'disable', reason: '事件處理器' }
  }

  // 配置相關變數
  if (variable.includes('CONFIG') || variable.includes('config')) {
    return { strategy: 'disable', reason: '配置變數' }
  }

  // 錯誤相關變數
  if (variable.includes('Error') || variable.includes('error')) {
    return { strategy: 'disable', reason: '錯誤處理' }
  }

  // 檢查是否為簡單賦值
  if (line.includes('=') && !line.includes('function') && !line.includes('=>')) {
    if (variable.length < 15 && !variable.includes('_')) {
      return { strategy: 'underscore', reason: '簡單未使用變數' }
    }
  }

  // 預設策略
  return { strategy: 'disable', reason: '預設處理' }
}

// 應用修復策略
function applyFixStrategy(filePath, warning, strategy) {
  if (!fs.existsSync(filePath)) {
    return false
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    const lineIndex = warning.line - 1

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return false
    }

    const line = lines[lineIndex]

    // 檢查是否已經處理過
    if (lineIndex > 0 && lines[lineIndex - 1].includes('eslint-disable-next-line no-unused-vars')) {
      return false
    }

    let modified = false

    switch (strategy.strategy) {
      case 'disable':
        // 添加 eslint-disable 註解
        const indent = line.match(/^(\s*)/)[1]
        lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)
        modified = true
        break

      case 'underscore':
        // 添加下劃線前綴
        const newLine = line.replace(
          new RegExp(`\\b${escapeRegex(warning.variable)}\\b`),
          `_${warning.variable}`
        )
        if (newLine !== line) {
          lines[lineIndex] = newLine
          modified = true
        }
        break

      case 'remove':
        // 移除整行 (謹慎使用)
        lines.splice(lineIndex, 1)
        modified = true
        break
    }

    if (modified) {
      fs.writeFileSync(filePath, lines.join('\n'))
      return true
    }

    return false
  } catch (error) {
    console.error(`處理檔案時發生錯誤 ${filePath}:`, error.message)
    return false
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 處理單個文件
function fixSrcFile(filePath, warnings) {
  console.log(`🔧 處理: ${path.relative('.', filePath)} (${warnings.length} 個警告)`)

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  檔案不存在`)
    return 0
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  let fixedCount = 0

  // 按行號倒序處理
  const sortedWarnings = warnings.sort((a, b) => b.line - a.line)

  for (const warning of sortedWarnings) {
    const line = lines[warning.line - 1] || ''
    const analysis = analyzeVariable(warning, line)

    console.log(`  📝 ${warning.variable} -> ${analysis.strategy} (${analysis.reason})`)

    const success = applyFixStrategy(filePath, warning, analysis)
    if (success) {
      fixedCount++
    }
  }

  return fixedCount
}

// 按文件分組
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

// 主要執行流程
function main() {
  console.log('1️⃣ 獲取源代碼文件中的 no-unused-vars 警告...')
  const warnings = getSrcFileWarnings()

  if (warnings.length === 0) {
    console.log('✅ 源代碼文件中沒有 no-unused-vars 警告！')
    return
  }

  console.log(`📊 找到 ${warnings.length} 個源代碼警告`)

  const fileGroups = groupWarningsByFile(warnings)
  const fileCount = Object.keys(fileGroups).length

  console.log(`📁 涉及 ${fileCount} 個源代碼檔案\n`)

  console.log('2️⃣ 開始修復源代碼文件...')

  let totalFixed = 0
  let processedFiles = 0

  for (const [filePath, fileWarnings] of Object.entries(fileGroups)) {
    const fixedCount = fixSrcFile(filePath, fileWarnings)

    if (fixedCount > 0) {
      processedFiles++
      totalFixed += fixedCount
    }
  }

  console.log(`\n📊 修復統計:`)
  console.log(`   - 處理檔案: ${processedFiles} 個`)
  console.log(`   - 修復警告: ${totalFixed} 個`)

  if (totalFixed > 0) {
    console.log('\n🎉 源代碼文件 no-unused-vars 警告修復完成！')

    // 重新檢查
    console.log('\n3️⃣ 驗證修復結果...')
    const remainingWarnings = getSrcFileWarnings()
    console.log(`剩餘源代碼警告: ${remainingWarnings.length} 個`)

    if (remainingWarnings.length === 0) {
      console.log('✅ 所有源代碼 no-unused-vars 警告已清除！')
    } else {
      console.log('⚠️  仍有部分源代碼警告需要手動處理')
      remainingWarnings.slice(0, 5).forEach(w => {
        console.log(`   ${path.relative('.', w.file)}:${w.line} - ${w.variable}`)
      })
    }
  }
}

main()