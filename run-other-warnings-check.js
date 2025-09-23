#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')

console.log('🔍 檢查其他類型的 ESLint 警告...\n')

// 先切換到正確的目錄並執行
process.chdir('/Users/tarragon/Projects/book_overview_v1')

try {
  // 執行 ESLint 並獲取輸出
  const lintOutput = execSync('npm run lint', {
    encoding: 'utf8',
    stdio: 'pipe'
  })

  console.log('✅ 沒有發現任何 ESLint 警告')
} catch (error) {
  const output = error.stdout || error.stderr || ''

  console.log('📊 分析 ESLint 輸出中...')

  // 過濾掉 no-unused-vars 和 no-console，專注於其他警告
  const lines = output.split('\n').filter(line =>
    line.includes('warning') &&
    !line.includes('no-unused-vars') &&
    !line.includes('no-console')
  )

  if (lines.length === 0) {
    console.log('✅ 沒有發現其他類型的警告')

    // 檢查 no-unused-vars 和 no-console 的數量
    const noUnusedVarsLines = output.split('\n').filter(line => line.includes('no-unused-vars'))
    const noConsoleLines = output.split('\n').filter(line => line.includes('no-console'))

    console.log(`📊 目前狀況：`)
    console.log(`   - no-unused-vars: ${noUnusedVarsLines.length} 個`)
    console.log(`   - no-console: ${noConsoleLines.length} 個`)
    console.log(`   - 其他警告: 0 個`)

    process.exit(0)
  }

  // 統計各種警告類型
  const warningCounts = {}
  const warningExamples = {}
  const fileWarnings = {}

  lines.forEach(line => {
    // 從行中提取文件路徑
    const fileMatch = line.match(/^([^:]+):/)
    const file = fileMatch ? fileMatch[1] : 'unknown'

    // 從行中提取規則名稱
    const ruleMatch = line.match(/\s+([\w-/]+)\s*$/)
    if (ruleMatch) {
      const rule = ruleMatch[1]
      warningCounts[rule] = (warningCounts[rule] || 0) + 1

      if (!warningExamples[rule]) {
        warningExamples[rule] = line.trim()
      }

      if (!fileWarnings[file]) fileWarnings[file] = []
      fileWarnings[file].push(rule)
    }
  })

  console.log('🎯 其他警告類型統計：')
  Object.entries(warningCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([rule, count]) => {
      console.log(`\n📋 ${rule}: ${count} 個`)
      console.log(`   範例: ${warningExamples[rule]}`)
    })

  // 顯示影響的文件
  console.log('\n📁 影響的文件：')
  Object.entries(fileWarnings)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10) // 只顯示前10個文件
    .forEach(([file, rules]) => {
      console.log(`   ${file}: [${[...new Set(rules)].join(', ')}]`)
    })

  // 儲存完整輸出以供分析
  fs.writeFileSync('other-warnings-analysis.txt', output)
  console.log('\n📄 完整輸出已儲存到 other-warnings-analysis.txt')

  // 顯示總計
  const totalWarnings = Object.values(warningCounts).reduce((sum, count) => sum + count, 0)
  console.log(`\n🔢 總計其他警告: ${totalWarnings} 個`)

  if (totalWarnings > 0) {
    console.log('\n📝 修復策略建議：')

    Object.keys(warningCounts).forEach(rule => {
      switch (rule) {
        case 'no-new':
          console.log(`   ✨ no-new (${warningCounts[rule]}個): 在測試文件中添加 // eslint-disable-next-line no-new`)
          break
        case 'multiline-ternary':
          console.log(`   ✨ multiline-ternary (${warningCounts[rule]}個): 修正三元運算子的多行格式`)
          break
        case 'no-control-regex':
          console.log(`   ✨ no-control-regex (${warningCounts[rule]}個): 將 \\x00 改為 \\u0000`)
          break
        case 'no-useless-constructor':
          console.log(`   ✨ no-useless-constructor (${warningCounts[rule]}個): 移除或修正無用的建構函數`)
          break
        case 'n/no-callback-literal':
          console.log(`   ✨ n/no-callback-literal (${warningCounts[rule]}個): 修正 callback 參數傳遞`)
          break
        case 'accessor-pairs':
          console.log(`   ✨ accessor-pairs (${warningCounts[rule]}個): 確保 getter/setter 成對出現`)
          break
        case 'no-useless-catch':
          console.log(`   ✨ no-useless-catch (${warningCounts[rule]}個): 移除或改善無用的 catch 區塊`)
          break
        case 'n/handle-callback-err':
          console.log(`   ✨ n/handle-callback-err (${warningCounts[rule]}個): 正確處理 callback 錯誤參數`)
          break
        default:
          console.log(`   ✨ ${rule} (${warningCounts[rule]}個): 請查看具體警告內容`)
      }
    })
  }

  console.log('\n🚀 準備開始修復...')
}