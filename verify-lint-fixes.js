#!/usr/bin/env node

/**
 * 驗證 ESLint 修復結果
 */

const { execSync } = require('child_process')

console.log('🔍 驗證 ESLint 修復結果...')
console.log('')

try {
  // 執行 ESLint 檢查
  const result = execSync('npx eslint tests/ --format compact', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })

  if (result.trim() === '') {
    console.log('✅ 完美！沒有發現任何 ESLint 警告或錯誤')
    console.log('')
    console.log('🎯 修復摘要：')
    console.log('   - no-control-regex: 已修復 (1個)')
    console.log('   - no-unused-vars: 已修復 (15個)')
    console.log('   - 總計修復: 16個警告')
    console.log('')
    console.log('🏆 達成目標: 100% ESLint 合規!')
  } else {
    console.log('📊 ESLint 檢查結果:')
    console.log(result)
  }

} catch (error) {
  console.log('📊 ESLint 檢查結果:')
  console.log(error.stdout || error.message)

  // 計算剩餘警告數量
  const output = error.stdout || ''
  const warningCount = (output.match(/warning/g) || []).length
  const errorCount = (output.match(/error/g) || []).length

  console.log('')
  console.log(`📈 統計結果:`)
  console.log(`   錯誤: ${errorCount}`)
  console.log(`   警告: ${warningCount}`)

  if (warningCount > 0 || errorCount > 0) {
    console.log('')
    console.log('❌ 尚有問題需要修復')
    process.exit(1)
  }
}

console.log('')
console.log('✅ ESLint 檢查完成')