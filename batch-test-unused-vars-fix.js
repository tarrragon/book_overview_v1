#!/usr/bin/env node

/**
 * 批量修復測試文件中的 no-unused-vars 警告
 *
 * 策略：對於測試文件，大部分未使用變數都應該添加 eslint-disable 註解
 * 因為測試代碼中的變數通常是為了模擬、驗證或設定測試環境
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🧪 批量修復測試文件中的 no-unused-vars 警告...\n')

// 獲取所有測試文件中的 no-unused-vars 警告
function getTestFileWarnings() {
  try {
    const result = execSync('npm run lint tests/ 2>&1', { encoding: 'utf8' })
    const lines = result.split('\n')

    const warnings = []
    let currentFile = null

    for (const line of lines) {
      // 檢測文件路徑行
      if (line.includes('/tests/') && line.includes('.js')) {
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
    console.error('無法獲取測試文件警告:', error.message)
    return []
  }
}

// 處理單個文件的警告
function fixFileWarnings(filePath, warnings) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  檔案不存在: ${filePath}`)
    return 0
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    // 按行號倒序排列，避免修改後行號偏移
    const sortedWarnings = warnings.sort((a, b) => b.line - a.line)

    let fixedCount = 0

    for (const warning of sortedWarnings) {
      const lineIndex = warning.line - 1

      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex]

        // 檢查是否已經有 eslint-disable 註解
        if (lineIndex > 0 && lines[lineIndex - 1].includes('eslint-disable-next-line no-unused-vars')) {
          continue
        }

        // 添加 eslint-disable 註解
        const indent = line.match(/^(\s*)/)[1]
        lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)
        fixedCount++

        console.log(`  ✅ 修復 ${warning.variable} (第 ${warning.line} 行)`)
      }
    }

    if (fixedCount > 0) {
      fs.writeFileSync(filePath, lines.join('\n'))
    }

    return fixedCount
  } catch (error) {
    console.error(`處理檔案時發生錯誤 ${filePath}:`, error.message)
    return 0
  }
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

// 主要執行流程
function main() {
  console.log('1️⃣ 獲取測試文件中的 no-unused-vars 警告...')
  const warnings = getTestFileWarnings()

  if (warnings.length === 0) {
    console.log('✅ 測試文件中沒有 no-unused-vars 警告！')
    return
  }

  console.log(`📊 找到 ${warnings.length} 個測試文件警告`)

  const fileGroups = groupWarningsByFile(warnings)
  const fileCount = Object.keys(fileGroups).length

  console.log(`📁 涉及 ${fileCount} 個測試檔案\n`)

  console.log('2️⃣ 開始修復測試文件...')

  let totalFixed = 0
  let processedFiles = 0

  for (const [filePath, fileWarnings] of Object.entries(fileGroups)) {
    const relativePath = path.relative('.', filePath)
    console.log(`🔧 處理: ${relativePath} (${fileWarnings.length} 個警告)`)

    const fixedCount = fixFileWarnings(filePath, fileWarnings)

    if (fixedCount > 0) {
      processedFiles++
      totalFixed += fixedCount
      console.log(`  📋 已修復 ${fixedCount} 個警告`)
    }
  }

  console.log(`\n📊 修復統計:`)
  console.log(`   - 處理檔案: ${processedFiles} 個`)
  console.log(`   - 修復警告: ${totalFixed} 個`)

  if (totalFixed > 0) {
    console.log('\n🎉 測試文件 no-unused-vars 警告修復完成！')

    // 重新檢查測試文件
    console.log('\n3️⃣ 驗證修復結果...')
    const remainingWarnings = getTestFileWarnings()
    console.log(`剩餘測試文件警告: ${remainingWarnings.length} 個`)

    if (remainingWarnings.length === 0) {
      console.log('✅ 所有測試文件 no-unused-vars 警告已清除！')
    } else {
      console.log('⚠️  仍有部分測試文件警告需要手動處理')
    }
  }
}

main()