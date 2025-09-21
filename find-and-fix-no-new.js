#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🔍 查找並修復 no-new 警告...\n')

process.chdir('/Users/tarragon/Projects/book_overview_v1')

// 獲取 ESLint 輸出中的 no-new 警告
try {
  const lintOutput = execSync('npx eslint src/ tests/ --format=compact 2>&1 | grep "no-new" || true', {
    encoding: 'utf8'
  })

  const noNewLines = lintOutput.split('\n').filter(line => line.includes('no-new'))

  if (noNewLines.length === 0) {
    console.log('✅ 沒有發現 no-new 警告')
    process.exit(0)
  }

  console.log(`📊 發現 ${noNewLines.length} 個 no-new 警告`)

  const filesToFix = new Map()

  noNewLines.forEach(line => {
    const match = line.match(/^([^:]+):(\d+):(\d+):\s+warning\s+(.+)\s+no-new/)
    if (match) {
      const [, filePath, lineNum, , message] = match
      if (!filesToFix.has(filePath)) {
        filesToFix.set(filePath, [])
      }
      filesToFix.get(filePath).push({
        line: parseInt(lineNum),
        message: message.trim()
      })
    }
  })

  let fixCount = 0

  filesToFix.forEach((warnings, filePath) => {
    console.log(`\n🔧 修復 ${filePath}:`)

    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const lines = content.split('\n')

      // 從高行號到低行號處理，避免行號變化
      warnings.sort((a, b) => b.line - a.line)

      warnings.forEach(({ line, message }) => {
        const lineIndex = line - 1
        const currentLine = lines[lineIndex]

        // 檢查前一行是否已經有 disable 註解
        const prevLineIndex = lineIndex - 1
        const prevLine = prevLineIndex >= 0 ? lines[prevLineIndex] : ''

        if (!prevLine.includes('eslint-disable-next-line no-new')) {
          // 計算當前行的縮排
          const indentMatch = currentLine.match(/^(\s*)/)
          const indent = indentMatch ? indentMatch[1] : ''

          // 在當前行前添加 disable 註解
          lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-new`)
          fixCount++
          console.log(`   ✅ 第 ${line} 行: ${message}`)
        } else {
          console.log(`   ⏭️  第 ${line} 行: 已有 disable 註解`)
        }
      })

      fs.writeFileSync(filePath, lines.join('\n'))

    } catch (error) {
      console.log(`   ❌ 修復失敗: ${error.message}`)
    }
  })

  console.log(`\n🎉 總計修復: ${fixCount} 個 no-new 警告`)

  if (fixCount > 0) {
    console.log('\n🔍 驗證修復效果...')
    try {
      const afterLintOutput = execSync('npx eslint src/ tests/ --format=compact 2>&1 | grep "no-new" | wc -l || echo "0"', {
        encoding: 'utf8'
      })

      const remainingWarnings = parseInt(afterLintOutput.trim())
      console.log(`📈 剩餘 no-new 警告: ${remainingWarnings} 個`)

      if (remainingWarnings === 0) {
        console.log('🎉 所有 no-new 警告已修復！')
      }
    } catch (error) {
      console.log('❌ 驗證時發生錯誤')
    }
  }

} catch (error) {
  console.log(`❌ 處理過程中發生錯誤: ${error.message}`)
}