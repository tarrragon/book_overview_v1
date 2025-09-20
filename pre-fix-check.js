#!/usr/bin/env node

/**
 * 修復前檢查腳本
 * 分析當前測試檔案的 lint 狀況
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🔍 修復前狀況檢查...\n')

try {
  // 只檢查測試目錄
  console.log('正在檢查測試目錄的 lint 狀況...')

  const lintCommand = 'npx eslint tests/ --format=compact'
  const lintOutput = execSync(lintCommand, {
    encoding: 'utf8',
    timeout: 30000
  })

  console.log('✅ 測試目錄 lint 檢查通過')
  console.log(lintOutput)

} catch (error) {
  const output = error.stdout || error.message || ''
  console.log('發現以下問題：')
  console.log('='.repeat(60))
  console.log(output)
  console.log('='.repeat(60))

  // 分析問題類型
  const lines = output.split('\n')
  const problemTypes = {
    'no-unused-vars': 0,
    'no-console': 0,
    'no-new': 0,
    'n/no-callback-literal': 0,
    'multiline-ternary': 0,
    'no-control-regex': 0,
    'other': 0
  }

  let testFileCount = 0
  let currentFile = null

  for (const line of lines) {
    if (line.includes('/tests/') && line.includes('.js:')) {
      currentFile = line.split(':')[0]
      if (!currentFile.includes('.backup') && !currentFile.includes('.deprecated')) {
        testFileCount++
      }
    }

    // 統計問題類型
    let found = false
    for (const problemType of Object.keys(problemTypes)) {
      if (problemType !== 'other' && line.includes(problemType)) {
        problemTypes[problemType]++
        found = true
        break
      }
    }
    if (!found && (line.includes('error') || line.includes('warning'))) {
      problemTypes.other++
    }
  }

  console.log('\n📊 問題統計：')
  console.log(`📁 影響的測試檔案：約 ${testFileCount} 個`)

  let totalProblems = 0
  for (const [type, count] of Object.entries(problemTypes)) {
    if (count > 0) {
      console.log(`🚨 ${type}: ${count} 個問題`)
      totalProblems += count
    }
  }

  console.log(`\n📈 總計：${totalProblems} 個問題需要修復`)

  // 顯示一些具體例子
  const unusedVarsLines = lines.filter(line => line.includes('no-unused-vars')).slice(0, 3)
  const consoleLines = lines.filter(line => line.includes('no-console')).slice(0, 3)

  if (unusedVarsLines.length > 0) {
    console.log('\n🔍 未使用變數例子：')
    unusedVarsLines.forEach(line => console.log(`   ${line}`))
  }

  if (consoleLines.length > 0) {
    console.log('\n🔍 console 語句例子：')
    consoleLines.forEach(line => console.log(`   ${line}`))
  }

  if (totalProblems > 0) {
    console.log('\n💡 準備執行修復...')
  }
}

// 檢查一些具體的測試檔案內容
console.log('\n📂 檢查一些具體檔案的問題模式...')

const sampleFiles = [
  'tests/unit/popup/version-display.test.js',
  'tests/helpers/error-simulator.js',
  'tests/mocks/storage-local-mock.js'
]

for (const file of sampleFiles) {
  const fullPath = path.join(process.cwd(), file)
  if (fs.existsSync(fullPath)) {
    try {
      const content = fs.readFileSync(fullPath, 'utf8')

      // 檢查常見問題
      const hasErrorCodes = content.includes('ErrorCodes') && content.includes('require')
      const hasStandardError = content.includes('StandardError') && content.includes('require')
      const hasConsole = content.includes('console.')
      const errorCodesUsage = (content.match(/ErrorCodes\./g) || []).length
      const standardErrorUsage = (content.match(/StandardError(?!\s*=)/g) || []).length

      console.log(`\n📄 ${file}:`)
      if (hasErrorCodes) {
        console.log(`   📦 ErrorCodes 引入：是，使用 ${errorCodesUsage} 次`)
      }
      if (hasStandardError) {
        console.log(`   📦 StandardError 引入：是，使用 ${standardErrorUsage} 次`)
      }
      if (hasConsole) {
        const consoleCount = (content.match(/console\./g) || []).length
        console.log(`   💬 console 語句：${consoleCount} 個`)
      }

    } catch (error) {
      console.log(`   ❌ 無法讀取：${error.message}`)
    }
  } else {
    console.log(`   ⚠️  檔案不存在：${file}`)
  }
}

console.log('\n🎯 檢查完成，準備進行修復...')