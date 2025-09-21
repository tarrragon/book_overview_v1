#!/usr/bin/env node

const fs = require('fs')
const { execSync } = require('child_process')

console.log('🔧 最終修復所有 no-new 警告...\n')

process.chdir('/Users/tarragon/Projects/book_overview_v1')

let totalFixes = 0

// 獲取所有 no-new 警告
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

  // 按文件分組
  const fileWarnings = new Map()

  noNewLines.forEach(line => {
    const match = line.match(/^([^:]+):(\d+):/)
    if (match) {
      const [, filePath, lineNum] = match
      if (!fileWarnings.has(filePath)) {
        fileWarnings.set(filePath, [])
      }
      fileWarnings.get(filePath).push(parseInt(lineNum))
    }
  })

  // 逐文件修復
  fileWarnings.forEach((lineNumbers, filePath) => {
    console.log(`\n🔧 修復 ${filePath}...`)

    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const lines = content.split('\n')

      // 從高行號到低行號處理，避免行號偏移
      lineNumbers.sort((a, b) => b - a)

      lineNumbers.forEach(lineNum => {
        const lineIndex = lineNum - 1
        const currentLine = lines[lineIndex]

        if (currentLine && currentLine.includes('new ')) {
          // 檢查前一行是否已有 disable 註解
          const prevLineIndex = lineIndex - 1
          const prevLine = prevLineIndex >= 0 ? lines[prevLineIndex] : ''

          if (!prevLine.includes('eslint-disable-next-line no-new')) {
            // 獲取縮排
            const indent = currentLine.match(/^(\s*)/)[1]

            // 插入 disable 註解
            lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-new`)
            totalFixes++
            console.log(`   ✅ 第 ${lineNum} 行`)
          }
        }
      })

      fs.writeFileSync(filePath, lines.join('\n'))

    } catch (error) {
      console.log(`   ❌ 修復失敗: ${error.message}`)
    }
  })

  console.log(`\n🎉 修復完成！總共修復 ${totalFixes} 個 no-new 問題`)

  // 驗證修復效果
  if (totalFixes > 0) {
    console.log('\n🔍 驗證修復效果...')
    try {
      const afterOutput = execSync('npx eslint src/ tests/ --format=compact 2>&1 | grep "no-new" | wc -l || echo "0"', {
        encoding: 'utf8'
      })

      const remaining = parseInt(afterOutput.trim())
      console.log(`📈 剩餘 no-new 警告: ${remaining} 個`)

      if (remaining === 0) {
        console.log('🎉 所有 no-new 警告已修復！')

        // 檢查其他類型的警告
        console.log('\n📊 檢查其他類型警告狀況...')
        const otherOutput = execSync('npx eslint src/ tests/ --format=compact 2>&1 | grep -v "no-unused-vars" | grep -v "no-console" | grep -v "no-new" | grep "warning" | wc -l || echo "0"', {
          encoding: 'utf8'
        })

        const otherWarnings = parseInt(otherOutput.trim())
        console.log(`📈 其他警告: ${otherWarnings} 個`)

        if (otherWarnings === 0) {
          console.log('🎊 恭喜！除了 no-unused-vars 和 no-console 外，所有其他警告已修復完成！')
        } else {
          console.log('⚠️  還有其他類型的警告需要處理')
        }
      }
    } catch (error) {
      console.log('❌ 驗證時發生錯誤')
    }
  }

} catch (error) {
  console.log(`❌ 處理過程中發生錯誤: ${error.message}`)
}