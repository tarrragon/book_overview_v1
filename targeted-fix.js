#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')

console.log('🎯 精確修復 no-unused-vars 警告\n')

try {
  // 先運行 lint 並捕獲輸出
  execSync('npm run lint 2>&1 | grep "no-unused-vars" > current-warnings.txt', { stdio: 'inherit' })
} catch (error) {
  // lint 失敗是預期的，因為有警告
}

// 讀取警告文件
let warnings = []
try {
  const warningText = fs.readFileSync('current-warnings.txt', 'utf8')
  warnings = warningText.split('\n').filter(line => line.trim())
} catch (error) {
  console.log('沒有找到警告文件，可能沒有 no-unused-vars 問題')
  process.exit(0)
}

console.log(`📊 找到 ${warnings.length} 個 no-unused-vars 警告`)

if (warnings.length === 0) {
  console.log('✅ 沒有 no-unused-vars 警告需要修復')
  process.exit(0)
}

// 分析最常見的問題
const problemTypes = {
  standardError: 0,
  errorCodes: 0,
  logger: 0,
  other: 0
}

warnings.forEach(warning => {
  if (warning.includes("'StandardError'")) problemTypes.standardError++
  else if (warning.includes("'ErrorCodes'")) problemTypes.errorCodes++
  else if (warning.includes("'Logger'")) problemTypes.logger++
  else problemTypes.other++
})

console.log('\n📋 問題類型分布:')
console.log(`   StandardError: ${problemTypes.standardError}`)
console.log(`   ErrorCodes: ${problemTypes.errorCodes}`)
console.log(`   Logger: ${problemTypes.logger}`)
console.log(`   其他: ${problemTypes.other}`)

console.log('\n📝 前 20 個警告:')
warnings.slice(0, 20).forEach((warning, i) => {
  console.log(`${i + 1}. ${warning}`)
})

// 清理臨時文件
fs.unlinkSync('current-warnings.txt')

console.log('\n💡 建議修復策略:')
console.log('1. 檢查是否真的未使用這些引用')
console.log('2. 移除確實未使用的 import/require')
console.log('3. 為保留的引用添加 eslint-disable 註解')
console.log('4. 重構代碼消除真正的未使用變數')