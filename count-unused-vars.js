#!/usr/bin/env node

const { exec } = require('child_process')

console.log('🔍 統計當前 no-unused-vars warnings...\n')

exec('npx eslint src/ tests/ --format=stylish', (error, stdout, stderr) => {
  const output = stdout + stderr
  const lines = output.split('\n')

  const warnings = lines.filter(line =>
    line.includes('no-unused-vars') && line.includes('warning')
  )

  console.log(`📊 總計 no-unused-vars warnings: ${warnings.length}`)

  if (warnings.length > 0) {
    console.log('\n🎯 前 10 個 warnings:')
    warnings.slice(0, 10).forEach((warning, index) => {
      console.log(`${index + 1}. ${warning.trim()}`)
    })

    // 分析變數類型
    const variables = warnings.map(w => {
      const match = w.match(/'([^']+)'/)
      return match ? match[1] : ''
    }).filter(v => v)

    const varTypes = {}
    variables.forEach(variable => {
      const category = this.categorizeVariable(variable)
      varTypes[category] = (varTypes[category] || 0) + 1
    })

    console.log('\n📋 變數類型分析:')
    Object.entries(varTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} 個`)
    })

    if (warnings.length > 100) {
      console.log('\n🚨 警告數量很高，建議執行批量修復工具!')
      console.log('💡 執行: node smart-unused-vars-batch-fix.js')
    }
  } else {
    console.log('🎉 沒有 no-unused-vars warnings！')
  }
})

function categorizeVariable(variable) {
  if (['ErrorCodes', 'StandardError', 'Logger'].includes(variable)) {
    return '未使用的 imports'
  }
  if (['service', 'manager', 'controller', 'engine', 'adapter'].includes(variable)) {
    return '測試實例變數'
  }
  if (variable.includes('error') || variable.includes('Error')) {
    return '錯誤處理變數'
  }
  if (variable.includes('time') || variable.includes('Time')) {
    return '時間相關變數'
  }
  if (variable.includes('mock') || variable.includes('test')) {
    return '測試輔助變數'
  }
  return '其他變數'
}