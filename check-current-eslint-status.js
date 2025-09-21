#!/usr/bin/env node

const { execSync } = require('child_process')

console.log('🔍 檢查當前 ESLint 狀況...\n')

try {
  process.chdir('/Users/tarragon/Projects/book_overview_v1')

  // 執行 ESLint 並分析輸出
  const output = execSync('npx eslint src/ tests/ --format=compact', {
    encoding: 'utf8',
    stdio: 'pipe'
  })

  console.log('✅ 沒有任何 ESLint 問題！')
} catch (error) {
  const output = error.stdout || ''

  if (!output.trim()) {
    console.log('❌ ESLint 執行失敗，沒有輸出')
    process.exit(1)
  }

  console.log('📊 ESLint 警告分析：')
  console.log('=' * 50)

  const lines = output.split('\n').filter(line => line.trim())

  // 統計不同類型的警告
  const warningStats = {
    'no-unused-vars': [],
    'no-console': [],
    'no-new': [],
    'multiline-ternary': [],
    'no-control-regex': [],
    'no-useless-constructor': [],
    'n/no-callback-literal': [],
    'accessor-pairs': [],
    'no-useless-catch': [],
    'n/handle-callback-err': [],
    'other': []
  }

  lines.forEach(line => {
    if (line.includes('warning')) {
      let categorized = false

      Object.keys(warningStats).forEach(type => {
        if (type !== 'other' && line.includes(type)) {
          warningStats[type].push(line)
          categorized = true
        }
      })

      if (!categorized) {
        warningStats.other.push(line)
      }
    }
  })

  console.log('🎯 警告類型統計：')
  Object.entries(warningStats).forEach(([type, items]) => {
    if (items.length > 0) {
      console.log(`\n📋 ${type}: ${items.length} 個`)

      // 顯示前3個範例
      items.slice(0, 3).forEach(item => {
        const shortItem = item.length > 100 ? item.substring(0, 100) + '...' : item
        console.log(`   ${shortItem}`)
      })

      if (items.length > 3) {
        console.log(`   ... 還有 ${items.length - 3} 個`)
      }
    }
  })

  // 計算需要處理的其他警告
  const otherWarnings = Object.entries(warningStats)
    .filter(([type, items]) => type !== 'no-unused-vars' && type !== 'no-console' && items.length > 0)
    .reduce((sum, [, items]) => sum + items.length, 0)

  console.log(`\n📈 總體狀況：`)
  console.log(`   no-unused-vars: ${warningStats['no-unused-vars'].length} 個`)
  console.log(`   no-console: ${warningStats['no-console'].length} 個`)
  console.log(`   其他需修復: ${otherWarnings} 個`)

  if (otherWarnings > 0) {
    console.log(`\n🎯 需要修復的其他警告類型：`)
    Object.entries(warningStats).forEach(([type, items]) => {
      if (type !== 'no-unused-vars' && type !== 'no-console' && items.length > 0) {
        console.log(`   ✓ ${type}: ${items.length} 個`)
      }
    })

    console.log(`\n📝 修復建議：`)
    if (warningStats['no-new'].length > 0) {
      console.log(`   🔧 no-new (${warningStats['no-new'].length}個): 添加 // eslint-disable-next-line no-new`)
    }
    if (warningStats['multiline-ternary'].length > 0) {
      console.log(`   🔧 multiline-ternary (${warningStats['multiline-ternary'].length}個): 修正三元運算子格式`)
    }
    if (warningStats['no-control-regex'].length > 0) {
      console.log(`   🔧 no-control-regex (${warningStats['no-control-regex'].length}個): 使用 Unicode 轉義`)
    }
    if (warningStats['no-useless-constructor'].length > 0) {
      console.log(`   🔧 no-useless-constructor (${warningStats['no-useless-constructor'].length}個): 移除空構造函數`)
    }
    if (warningStats['other'].length > 0) {
      console.log(`   🔧 其他 (${warningStats['other'].length}個): 需要具體分析`)
    }
  } else {
    console.log(`\n✅ 沒有其他類型的警告需要修復！`)
  }
}