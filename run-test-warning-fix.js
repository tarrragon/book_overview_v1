#!/usr/bin/env node

/**
 * 執行測試警告修復
 * 包含前置檢查和後續驗證
 */

const { execSync } = require('child_process')
const fs = require('fs')

console.log('🚀 開始測試警告修復流程...\n')

// 步驟1: 檢查當前 lint 狀況
console.log('1️⃣ 檢查當前 lint 狀況...')
try {
  const lintOutput = execSync('npm run lint 2>&1', {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10 // 10MB buffer
  })

  console.log('當前 lint 輸出：')
  console.log('='.repeat(50))
  console.log(lintOutput)
  console.log('='.repeat(50))

  // 分析警告類型
  const lines = lintOutput.split('\n')
  const warningTypes = {
    'no-unused-vars': 0,
    'no-new': 0,
    'n/no-callback-literal': 0,
    'multiline-ternary': 0,
    'no-control-regex': 0,
    'no-console': 0
  }

  for (const line of lines) {
    for (const type of Object.keys(warningTypes)) {
      if (line.includes(type)) {
        warningTypes[type]++
      }
    }
  }

  console.log('\n📊 警告類型統計：')
  let hasWarnings = false
  for (const [type, count] of Object.entries(warningTypes)) {
    if (count > 0) {
      console.log(`   ${type}: ${count} 個警告`)
      hasWarnings = true
    }
  }

  if (!hasWarnings) {
    console.log('✅ 沒有發現目標警告類型，可能已經修復完成')
    process.exit(0)
  }

} catch (error) {
  console.log('⚠️  Lint 檢查有警告或錯誤，繼續進行修復...')
  console.log(error.stdout || error.message)
}

// 步驟2: 執行修復腳本
console.log('\n2️⃣ 執行測試警告修復...')
try {
  execSync('node fix-test-warnings.js', { stdio: 'inherit' })
  console.log('✅ 修復腳本執行完成')
} catch (error) {
  console.error('❌ 修復腳本執行失敗：', error.message)
  process.exit(1)
}

// 步驟3: 驗證修復效果
console.log('\n3️⃣ 驗證修復效果...')
try {
  const afterLintOutput = execSync('npm run lint 2>&1', {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10
  })

  console.log('修復後 lint 輸出：')
  console.log('='.repeat(50))
  console.log(afterLintOutput)
  console.log('='.repeat(50))

  // 計算改善狀況
  const afterLines = afterLintOutput.split('\n')
  const afterWarningTypes = {
    'no-unused-vars': 0,
    'no-new': 0,
    'n/no-callback-literal': 0,
    'multiline-ternary': 0,
    'no-control-regex': 0,
    'no-console': 0
  }

  for (const line of afterLines) {
    for (const type of Object.keys(afterWarningTypes)) {
      if (line.includes(type)) {
        afterWarningTypes[type]++
      }
    }
  }

  console.log('\n📈 修復效果統計：')
  for (const [type, afterCount] of Object.entries(afterWarningTypes)) {
    console.log(`   ${type}: ${afterCount} 個警告`)
  }

} catch (error) {
  console.log('✅ 修復後 lint 通過或有其他問題')
  console.log(error.stdout || error.message)
}

// 步驟4: 運行測試確保功能正常
console.log('\n4️⃣ 運行測試確保功能正常...')
try {
  console.log('執行核心測試...')
  execSync('npm run test:core', { stdio: 'inherit' })
  console.log('✅ 測試通過，修復成功！')
} catch (error) {
  console.error('❌ 測試失敗，可能需要手動檢查：')
  console.error(error.message)
  console.log('\n💡 建議檢查：')
  console.log('   1. 測試邏輯是否因為修復而改變')
  console.log('   2. 是否有語法錯誤')
  console.log('   3. 運行 npm run lint 查看剩餘問題')
}

console.log('\n🎉 測試警告修復流程完成！')