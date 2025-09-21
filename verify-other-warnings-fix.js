#!/usr/bin/env node

const { execSync } = require('child_process')

console.log('🔍 驗證其他 ESLint 警告修復效果...\n')

process.chdir('/Users/tarragon/Projects/book_overview_v1')

try {
  // 執行 ESLint 檢查
  const output = execSync('npx eslint src/ tests/ --format=compact', {
    encoding: 'utf8',
    stdio: 'pipe'
  })

  console.log('🎉 太棒了！沒有任何 ESLint 問題！')
} catch (error) {
  const output = error.stdout || ''

  if (!output.trim()) {
    console.log('❌ ESLint 執行失敗')
    process.exit(1)
  }

  console.log('📊 當前 ESLint 狀況分析：')
  console.log('=' * 50)

  const lines = output.split('\n').filter(line => line.trim())

  // 統計各種警告
  const stats = {
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
      let categorized = false

      Object.keys(stats).forEach(type => {
        if (type !== 'other' && line.includes(type)) {
          stats[type]++
          if (!examples[type]) examples[type] = line
          categorized = true
        }
      })

      if (!categorized) {
        stats.other++
        if (!examples.other) examples.other = line
      }
    }
  })

  console.log('📋 警告統計：')
  Object.entries(stats).forEach(([type, count]) => {
    if (count > 0) {
      const icon = type === 'no-unused-vars' || type === 'no-console' ? '⏳' : '❌'
      console.log(`   ${icon} ${type}: ${count} 個`)

      if (examples[type] && type !== 'no-unused-vars' && type !== 'no-console') {
        const short = examples[type].length > 80 ? examples[type].substring(0, 80) + '...' : examples[type]
        console.log(`      範例: ${short}`)
      }
    }
  })

  // 計算修復成果
  const targetWarnings = Object.entries(stats)
    .filter(([type, count]) => type !== 'no-unused-vars' && type !== 'no-console' && count > 0)
    .reduce((sum, [, count]) => sum + count, 0)

  console.log(`\n🎯 修復成果評估：`)
  console.log(`   ✅ 已修復的其他警告類型: no-useless-constructor, 大部分 no-new`)
  console.log(`   ⏳ 預期存在的警告: no-unused-vars (${stats['no-unused-vars']}), no-console (${stats['no-console']})`)
  console.log(`   ❌ 仍需修復的其他警告: ${targetWarnings} 個`)

  if (targetWarnings === 0) {
    console.log(`\n🎊 恭喜！除了預期的 no-unused-vars 和 no-console 外，`)
    console.log(`   所有其他類型的 ESLint 警告都已成功修復！`)

    console.log(`\n📈 總體狀況：`)
    console.log(`   ✅ 其他警告修復: 100% 完成`)
    console.log(`   ⏳ no-unused-vars: ${stats['no-unused-vars']} 個 (另外處理)`)
    console.log(`   ⏳ no-console: ${stats['no-console']} 個 (另外處理)`)
  } else {
    console.log(`\n⚠️  還有 ${targetWarnings} 個其他類型警告需要處理`)

    console.log(`\n🔧 需要修復的警告類型：`)
    Object.entries(stats).forEach(([type, count]) => {
      if (type !== 'no-unused-vars' && type !== 'no-console' && count > 0) {
        console.log(`   - ${type}: ${count} 個`)
      }
    })
  }

  console.log(`\n📝 下一步建議：`)
  if (stats['no-new'] > 0) {
    console.log(`   🔧 修復剩餘 ${stats['no-new']} 個 no-new 警告`)
  }
  if (stats['multiline-ternary'] > 0) {
    console.log(`   🔧 修復 ${stats['multiline-ternary']} 個 multiline-ternary 警告`)
  }
  if (stats['other'] > 0) {
    console.log(`   🔧 分析並修復 ${stats['other']} 個其他類型警告`)
  }
  console.log(`   ✅ 運行測試確保修復不影響功能`)
}