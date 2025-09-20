#!/usr/bin/env node

const { execSync } = require('child_process')

console.log('🔍 快速 lint 檢查...\n')

try {
  const lintOutput = execSync('npm run lint tests/', {
    encoding: 'utf8',
    timeout: 60000
  })

  console.log('✅ Lint 通過，沒有警告')
  console.log(lintOutput)

} catch (error) {
  console.log('發現警告/錯誤：')
  console.log('='.repeat(50))
  console.log(error.stdout || error.message)
  console.log('='.repeat(50))

  // 分析特定類型的警告
  const output = error.stdout || error.message || ''
  const lines = output.split('\n')

  const warnings = {
    'no-unused-vars': [],
    'no-console': [],
    'no-new': [],
    'n/no-callback-literal': [],
    'multiline-ternary': [],
    'no-control-regex': []
  }

  let currentFile = null

  for (const line of lines) {
    if (line.match(/^\/.*\.js$/)) {
      currentFile = line
    } else if (currentFile) {
      for (const [warningType, items] of Object.entries(warnings)) {
        if (line.includes(warningType)) {
          items.push({ file: currentFile, warning: line.trim() })
        }
      }
    }
  }

  console.log('\n📊 警告類型統計：')
  let hasWarnings = false
  for (const [type, items] of Object.entries(warnings)) {
    if (items.length > 0) {
      console.log(`\n🚨 ${type}: ${items.length} 個`)
      items.slice(0, 3).forEach(item => {
        console.log(`   ${item.file}`)
        console.log(`   → ${item.warning}`)
      })
      if (items.length > 3) {
        console.log(`   ... 還有 ${items.length - 3} 個`)
      }
      hasWarnings = true
    }
  }

  if (!hasWarnings) {
    console.log('沒有發現目標警告類型')
  }
}