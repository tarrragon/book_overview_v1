#!/usr/bin/env node

const { execSync } = require('child_process')

console.log('🔍 快速檢查 ESLint 狀況...\n')

try {
  process.chdir('/Users/tarragon/Projects/book_overview_v1')

  // 直接執行 eslint 指令，避免 npm 的複雜性
  const output = execSync('npx eslint src/ tests/ --format=compact', {
    encoding: 'utf8',
    stdio: 'pipe'
  })

  console.log('✅ 沒有任何 ESLint 問題')
} catch (error) {
  const output = error.stdout || ''

  console.log('📊 ESLint 輸出分析：')
  console.log('=' * 50)

  // 分析不同類型的警告
  const lines = output.split('\n').filter(line => line.trim())

  const warningTypes = {
    'no-unused-vars': 0,
    'no-console': 0,
    'no-new': 0,
    'multiline-ternary': 0,
    'no-control-regex': 0,
    'no-useless-constructor': 0,
    'n/no-callback-literal': 0,
    'accessor-pairs': 0,
    'no-useless-catch': 0,
    'n/handle-callback-err': 0,
    'other': 0
  }

  const examples = {}

  lines.forEach(line => {
    if (line.includes('warning')) {
      let found = false
      Object.keys(warningTypes).forEach(type => {
        if (type !== 'other' && line.includes(type)) {
          warningTypes[type]++
          if (!examples[type]) examples[type] = line
          found = true
        }
      })
      if (!found) {
        warningTypes.other++
        if (!examples.other) examples.other = line
      }
    }
  })

  console.log('🎯 警告類型統計：')
  Object.entries(warningTypes).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`   ${type}: ${count} 個`)
      if (examples[type]) {
        console.log(`   範例: ${examples[type].substring(0, 100)}...`)
      }
      console.log('')
    }
  })

  // 計算需要修復的其他警告
  const otherWarnings = Object.entries(warningTypes)
    .filter(([type, count]) => type !== 'no-unused-vars' && type !== 'no-console' && count > 0)
    .reduce((sum, [, count]) => sum + count, 0)

  console.log(`📈 總計統計：`)
  console.log(`   - no-unused-vars: ${warningTypes['no-unused-vars']} 個`)
  console.log(`   - no-console: ${warningTypes['no-console']} 個`)
  console.log(`   - 其他需修復: ${otherWarnings} 個`)

  if (otherWarnings > 0) {
    console.log(`\n🎯 需要修復的其他警告類型：`)
    Object.entries(warningTypes).forEach(([type, count]) => {
      if (type !== 'no-unused-vars' && type !== 'no-console' && count > 0) {
        console.log(`   ✓ ${type}: ${count} 個`)
      }
    })
  }

  // 寫入詳細輸出
  require('fs').writeFileSync('eslint-detailed-output.txt', output)
  console.log(`\n📄 完整輸出已存到 eslint-detailed-output.txt`)
}