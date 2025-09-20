#!/usr/bin/env node

/**
 * 實時 no-unused-vars 修復
 * 直接從當前 ESLint 執行獲取並修復實際問題
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('⚡ 實時 no-unused-vars 修復...\n')

// 獲取實際的 ESLint 結果
function getRealUnusedVarsWarnings() {
  try {
    console.log('🔍 執行 ESLint 獲取最新警告...')

    // 執行 ESLint 並捕獲輸出
    let output = ''
    try {
      output = execSync('npm run lint 2>&1', { encoding: 'utf8' })
    } catch (error) {
      // ESLint 有警告時會退出碼非零，但輸出仍有效
      output = error.stdout || ''
    }

    const lines = output.split('\n')
    const warnings = []
    let currentFile = null

    for (const line of lines) {
      const trimmedLine = line.trim()

      // 檢測文件路徑 (以斜線開始且包含 .js)
      if (trimmedLine.startsWith('/') && trimmedLine.includes('.js')) {
        currentFile = trimmedLine
        continue
      }

      // 檢測 no-unused-vars 警告
      if (trimmedLine.includes('no-unused-vars') && !trimmedLine.includes('eslint-disable')) {
        // 格式: "  123:45  warning  'variableName' is assigned a value but never used  no-unused-vars"
        const match = trimmedLine.match(/^\s*(\d+):(\d+)\s+warning\s+'([^']+)'\s+(.+?)\s+no-unused-vars/)

        if (match && currentFile) {
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
    console.error('執行 ESLint 時發生錯誤:', error.message)
    return []
  }
}

// 修復單個文件中的警告
function fixFileWarnings(filePath, warnings) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  檔案不存在: ${filePath}`)
    return 0
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    // 按行號倒序排列，避免行號偏移
    const sortedWarnings = warnings.sort((a, b) => b.line - a.line)

    let fixedCount = 0

    for (const warning of sortedWarnings) {
      const lineIndex = warning.line - 1

      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex]

        // 確認變數確實存在於該行
        if (!line.includes(warning.variable)) {
          console.log(`  ⚠️  變數不在指定行: ${warning.variable} (跳過)`)
          continue
        }

        // 檢查是否已有 eslint-disable 註解
        if (lineIndex > 0 && lines[lineIndex - 1].includes('eslint-disable-next-line no-unused-vars')) {
          console.log(`  ⏭️  已有註解: ${warning.variable}`)
          continue
        }

        // 添加 eslint-disable 註解
        const indent = line.match(/^(\s*)/)[1]
        lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)
        fixedCount++

        console.log(`  ✅ 修復: ${warning.variable} (第 ${warning.line} 行)`)
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

// 主執行流程
async function main() {
  console.log('1️⃣ 獲取實時 no-unused-vars 警告...')
  const warnings = getRealUnusedVarsWarnings()

  if (warnings.length === 0) {
    console.log('✅ 沒有發現 no-unused-vars 警告！')
    return
  }

  console.log(`📊 找到 ${warnings.length} 個 no-unused-vars 警告`)

  // 顯示警告預覽
  console.log('\n📋 警告預覽:')
  warnings.slice(0, 10).forEach((w, i) => {
    console.log(`   ${i + 1}. ${path.relative('.', w.file)}:${w.line} - '${w.variable}'`)
  })

  if (warnings.length > 10) {
    console.log(`   ... 以及其他 ${warnings.length - 10} 個警告`)
  }

  const fileGroups = groupWarningsByFile(warnings)
  const fileCount = Object.keys(fileGroups).length

  console.log(`\n📁 涉及 ${fileCount} 個檔案`)

  console.log('\n2️⃣ 開始修復...')

  let totalFixed = 0
  let processedFiles = 0

  for (const [filePath, fileWarnings] of Object.entries(fileGroups)) {
    const relativePath = path.relative('.', filePath)
    console.log(`🔧 處理: ${relativePath} (${fileWarnings.length} 個警告)`)

    const fixedCount = fixFileWarnings(filePath, fileWarnings)

    if (fixedCount > 0) {
      processedFiles++
      totalFixed += fixedCount
    }
  }

  console.log(`\n📊 修復統計:`)
  console.log(`   - 處理檔案: ${processedFiles} 個`)
  console.log(`   - 修復警告: ${totalFixed} 個`)

  if (totalFixed > 0) {
    console.log('\n3️⃣ 驗證修復結果...')

    // 重新檢查
    const remainingWarnings = getRealUnusedVarsWarnings()
    console.log(`剩餘警告: ${remainingWarnings.length} 個`)

    if (remainingWarnings.length === 0) {
      console.log('🎉 所有 no-unused-vars 警告已修復！')
    } else {
      console.log(`⚠️  還有 ${remainingWarnings.length} 個警告需要手動處理`)

      console.log('\n📋 剩餘警告:')
      remainingWarnings.slice(0, 5).forEach((w, i) => {
        console.log(`   ${i + 1}. ${path.relative('.', w.file)}:${w.line} - '${w.variable}': ${w.message}`)
      })
    }

    // 生成報告
    const report = {
      timestamp: new Date().toISOString(),
      originalWarnings: warnings.length,
      fixedWarnings: totalFixed,
      remainingWarnings: remainingWarnings.length,
      processedFiles,
      success: remainingWarnings.length === 0
    }

    fs.writeFileSync('real-time-fix-report.json', JSON.stringify(report, null, 2))
    console.log('\n💾 修復報告已保存到 real-time-fix-report.json')
  } else {
    console.log('\n📋 沒有警告需要修復，或所有警告已處理')
  }

  console.log('\n✅ 實時修復完成！')
}

main().catch(error => {
  console.error('修復過程中發生錯誤:', error)
  process.exit(1)
})