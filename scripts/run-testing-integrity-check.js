#!/usr/bin/env node

/**
 * 測試完整性檢查執行腳本
 *
 * 使用方式:
 * node scripts/run-testing-integrity-check.js [options]
 *
 * 選項:
 * --output <path>    指定報告輸出路徑
 * --threshold <num>  設定通過閾值 (0-1)
 * --verbose          顯示詳細輸出
 * --help            顯示幫助訊息
 */

const path = require('path')
const TestingIntegrityChecker = require('../tests/helpers/testing-integrity-checker')

// 解析命令列參數
const args = process.argv.slice(2)
const options = {
  outputPath: null,
  threshold: 0.8,
  verbose: false,
  showHelp: false
}

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--output':
      options.outputPath = args[++i]
      break
    case '--threshold':
      options.threshold = parseFloat(args[++i])
      break
    case '--verbose':
      options.verbose = true
      break
    case '--help':
      options.showHelp = true
      break
  }
}

// 顯示幫助訊息
if (options.showHelp) {
  console.log(`
測試完整性檢查工具

使用方式:
  node scripts/run-testing-integrity-check.js [options]

選項:
  --output <path>     指定報告輸出路徑
  --threshold <num>   設定通過閾值 (預設: 0.8)
  --verbose          顯示詳細輸出
  --help             顯示此幫助訊息

範例:
  node scripts/run-testing-integrity-check.js --verbose
  node scripts/run-testing-integrity-check.js --output reports/integrity-report.json
  node scripts/run-testing-integrity-check.js --threshold 0.9 --verbose
`)
  process.exit(0)
}

async function main () {
  try {
    console.log('🔍 啟動測試完整性檢查...')
    console.log(`📊 品質閾值: ${options.threshold}`)

    // 建立檢查器
    const checker = new TestingIntegrityChecker({
      testDirectory: path.join(__dirname, '..', 'tests')
    })

    // 執行檢查
    const results = await checker.runIntegrityCheck()

    // 顯示摘要
    console.log('\n📋 檢查結果摘要:')
    console.log(`📁 檢查文件數: ${results.checkedFiles}`)
    console.log(`⚠️  總違規數: ${results.violations.length}`)
    console.log(`📊 完整性評分: ${results.summary.integrityScore}`)
    console.log(`✅ 合規率: ${(results.summary.complianceRate * 100).toFixed(1)}%`)

    // 顯示違規統計
    if (results.violations.length > 0) {
      console.log('\n🚨 違規統計:')
      const severityCount = results.summary.violationsBySeverity
      console.log(`  🔴 Critical: ${severityCount.critical}`)
      console.log(`  🟠 High: ${severityCount.high}`)
      console.log(`  🟡 Medium: ${severityCount.medium}`)
      console.log(`  ⚪ Low: ${severityCount.low}`)

      if (options.verbose) {
        console.log('\n📝 詳細違規列表:')
        results.violations.forEach((violation, index) => {
          console.log(`${index + 1}. [${violation.severity.toUpperCase()}] ${violation.file}:${violation.line}`)
          console.log(`   類型: ${violation.type}`)
          console.log(`   訊息: ${violation.message}`)
          if (violation.suggestion) {
            console.log(`   建議: ${violation.suggestion}`)
          }
          if (violation.content) {
            console.log(`   程式碼: ${violation.content}`)
          }
          console.log('')
        })
      }
    }

    // 顯示建議
    if (results.recommendations.length > 0) {
      console.log('\n💡 改善建議:')
      results.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`)
        console.log(`   ${rec.description}`)
        console.log(`   行動: ${rec.action}`)
        console.log('')
      })
    }

    // 儲存報告
    if (options.outputPath) {
      await checker.saveReportToFile(options.outputPath)
      console.log(`📄 詳細報告已儲存至: ${options.outputPath}`)
    }

    // 判斷是否通過檢查
    const passed = checker.passesIntegrityCheck() && results.summary.integrityScore >= options.threshold

    if (passed) {
      console.log('\n✅ 測試完整性檢查通過!')
      process.exit(0)
    } else {
      console.log('\n❌ 測試完整性檢查未通過!')
      console.log(`   完整性評分 ${results.summary.integrityScore} < 閾值 ${options.threshold}`)
      if (results.summary.violationsBySeverity.critical > 0) {
        console.log(`   存在 ${results.summary.violationsBySeverity.critical} 個 critical 違規`)
      }
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ 測試完整性檢查失敗:', error.message)
    if (options.verbose) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

main()
