#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

console.log('🔧 批量修復 no-new 警告...\n')

process.chdir('/Users/tarragon/Projects/book_overview_v1')

const filesToProcess = [
  'tests/unit/background/domains/data-management/services/data-normalization-service.test.js',
  'tests/unit/popup/popup-controller-extraction-integration.test.js',
  'tests/unit/background/domains/data-management/services/batch-validation-processor.test.js',
  'tests/unit/background/domains/data-management/services/data-validation-service-integration.test.js',
  'tests/unit/background/domains/data-management/services/data-validation-service-refactor.test.js',
  'tests/unit/background/domains/data-management/services/cache-management-service.test.js'
]

let fixCount = 0

filesToProcess.forEach(filePath => {
  console.log(`🔍 處理 ${filePath}...`)

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    let modified = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // 檢查是否為 expect(() => { 後面跟著 new 的模式
      if (line.includes('expect(() => {')) {
        const nextLineIndex = i + 1
        if (nextLineIndex < lines.length) {
          const nextLine = lines[nextLineIndex]

          // 檢查下一行是否為 new ... 且沒有 eslint-disable
          if (nextLine.includes('new ') &&
              nextLine.match(/^\s+new [A-Z]/) &&
              !nextLine.includes('eslint-disable')) {

            // 獲取縮排
            const indent = nextLine.match(/^(\s*)/)[1]

            // 在 new 行前添加 disable 註解
            lines.splice(nextLineIndex, 0, `${indent}// eslint-disable-next-line no-new`)
            modified = true
            fixCount++

            console.log(`   ✅ 第 ${nextLineIndex + 1} 行: 添加 no-new disable 註解`)

            // 跳過新插入的行
            i++
          }
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, lines.join('\n'))
      console.log(`   📝 檔案已更新`)
    } else {
      console.log(`   ⏭️  檔案無需修改`)
    }

  } catch (error) {
    console.log(`   ❌ 處理失敗: ${error.message}`)
  }

  console.log('')
})

console.log(`🎉 批量修復完成！總共修復 ${fixCount} 個 no-new 問題`)

// 驗證修復效果
console.log('\n🔍 驗證修復效果...')
try {
  const { execSync } = require('child_process')
  const lintOutput = execSync('npx eslint tests/ --format=compact 2>&1 | grep "no-new" | wc -l || echo "0"', {
    encoding: 'utf8'
  })

  const remainingNoNew = parseInt(lintOutput.trim())
  console.log(`📈 剩餘 no-new 警告: ${remainingNoNew} 個`)

  if (remainingNoNew === 0) {
    console.log('🎉 所有 no-new 警告已修復！')
  } else {
    console.log('⚠️  還有部分 no-new 警告需要手動處理')
  }
} catch (error) {
  console.log('❌ 驗證時發生錯誤')
}