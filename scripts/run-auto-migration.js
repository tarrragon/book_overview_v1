#!/usr/bin/env node

/**
 * StandardError 自動遷移執行腳本
 *
 * 用途：
 * - 執行 StandardError 到 ErrorCodes 的自動轉換
 * - 支援多種轉換模式
 * - 產生詳細的轉換報告
 *
 * 使用方式：
 * npm run auto-migration -- --mode=suggest_only
 * node scripts/run-auto-migration.js --mode=auto_convert --risk-threshold=medium
 */

const path = require('path')

// 設定模組路徑解析
const rootDir = path.join(__dirname, '..')
require('module').globalPaths.push(path.join(rootDir, 'src'))

// 模擬 src/ 路徑解析
const Module = require('module')
const originalRequire = Module.prototype.require

Module.prototype.require = function (id) {
  if (id.startsWith('src/')) {
    const resolvedPath = path.join(rootDir, id)
    return originalRequire.call(this, resolvedPath)
  }
  return originalRequire.call(this, id)
}

// 載入必要模組
const { AutoMigrationConverter, CONVERSION_MODES, CONVERSION_RISKS } = require('src/core/migration/AutoMigrationConverter')

/**
 * 解析命令列參數
 */
function parseArguments () {
  const args = process.argv.slice(2)
  const options = {
    mode: CONVERSION_MODES.SUGGEST_ONLY,
    riskThreshold: CONVERSION_RISKS.MEDIUM,
    sourceDir: 'src',
    backupBeforeConvert: true,
    enableLogging: true,
    reportPath: 'docs/migration-reports'
  }

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const mode = arg.split('=')[1]
      if (Object.values(CONVERSION_MODES).includes(mode)) {
        options.mode = mode
      } else {
        console.error(`❌ 無效的轉換模式: ${mode}`)
        console.log(`📋 可用模式: ${Object.values(CONVERSION_MODES).join(', ')}`)
        process.exit(1)
      }
    }

    if (arg.startsWith('--risk-threshold=')) {
      const risk = arg.split('=')[1]
      if (Object.values(CONVERSION_RISKS).includes(risk)) {
        options.riskThreshold = risk
      } else {
        console.error(`❌ 無效的風險閾值: ${risk}`)
        console.log(`📋 可用風險等級: ${Object.values(CONVERSION_RISKS).join(', ')}`)
        process.exit(1)
      }
    }

    if (arg.startsWith('--source-dir=')) {
      options.sourceDir = arg.split('=')[1]
    }

    if (arg === '--no-backup') {
      options.backupBeforeConvert = false
    }

    if (arg === '--no-logging') {
      options.enableLogging = false
    }

    if (arg.startsWith('--report-path=')) {
      options.reportPath = arg.split('=')[1]
    }

    if (arg === '--help' || arg === '-h') {
      showHelp()
      process.exit(0)
    }
  }

  return options
}

/**
 * 顯示使用說明
 */
function showHelp () {
  console.log(`
🚀 StandardError 自動遷移工具

用途:
  自動轉換 StandardError 使用為 ErrorCodes 相容格式

使用方式:
  node scripts/run-auto-migration.js [選項]

選項:
  --mode=<模式>              轉換模式
    • scan_only              僅掃描，不轉換
    • suggest_only           產生轉換建議 (預設)
    • auto_convert           自動轉換
    • manual_assist          輔助手動轉換

  --risk-threshold=<等級>    風險閾值
    • low                    僅轉換低風險項目
    • medium                 轉換低到中等風險項目 (預設)
    • high                   轉換大部分項目
    • critical               轉換所有項目 (不建議)

  --source-dir=<目錄>        來源目錄 (預設: src)
  --report-path=<路徑>       報告輸出路徑 (預設: docs/migration-reports)
  --no-backup                不建立備份檔案
  --no-logging               不輸出詳細日誌
  --help, -h                 顯示此說明

範例:
  # 掃描並產生建議
  node scripts/run-auto-migration.js --mode=suggest_only

  # 自動轉換低風險項目
  node scripts/run-auto-migration.js --mode=auto_convert --risk-threshold=low

  # 輔助手動轉換
  node scripts/run-auto-migration.js --mode=manual_assist
`)
}

/**
 * 主要執行函式
 */
async function main () {
  console.log('🚀 啟動 StandardError 自動遷移工具...\n')

  // 在 try 外宣告，使 catch 區塊能存取 options.enableLogging（修正 no-undef）
  let options = null

  try {
    // 解析參數
    options = parseArguments()

    // 顯示配置
    console.log('⚙️ 遷移配置:')
    console.log(`   模式: ${options.mode}`)
    console.log(`   風險閾值: ${options.riskThreshold}`)
    console.log(`   來源目錄: ${options.sourceDir}`)
    console.log(`   報告路徑: ${options.reportPath}`)
    console.log(`   建立備份: ${options.backupBeforeConvert ? '是' : '否'}`)
    console.log('')

    // 建立轉換器
    const converter = new AutoMigrationConverter(options)

    // 執行轉換
    const report = await converter.executeAutoConversion()

    // 顯示結果摘要
    console.log('\n📊 轉換結果摘要:')
    console.log(`   掃描檔案: ${report.summary.totalFiles}`)
    console.log(`   受影響檔案: ${report.summary.affectedFiles}`)
    console.log(`   轉換機會: ${report.summary.conversionOpportunities}`)
    console.log(`   整體風險: ${report.summary.overallRisk}`)

    // 顯示風險分布
    console.log('\n⚠️ 風險分布:')
    for (const [risk, count] of Object.entries(report.summary.riskDistribution)) {
      const percentage = ((count / report.summary.conversionOpportunities) * 100).toFixed(1)
      console.log(`   ${risk}: ${count} (${percentage}%)`)
    }

    // 顯示建議
    if (report.recommendations.immediate.length > 0) {
      console.log('\n🎯 立即建議:')
      report.recommendations.immediate.forEach(rec => {
        console.log(`   • ${rec}`)
      })
    }

    // 顯示下一步
    if (report.next_steps.length > 0) {
      console.log('\n📋 下一步行動:')
      report.next_steps.forEach(step => {
        console.log(`   • ${step}`)
      })
    }

    // 成功完成
    console.log('\n✅ 自動遷移工具執行完成!')
    console.log(`📄 詳細報告: ${options.reportPath}`)
  } catch (error) {
    console.error('\n❌ 自動遷移執行失敗:', error.message)
    if (options && options.enableLogging) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// 錯誤處理
process.on('uncaughtException', (error) => {
  console.error('💥 未捕獲的異常:', error.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未處理的 Promise 拒絕:', reason)
  process.exit(1)
})

// 執行主函式
if (require.main === module) {
  main()
}

module.exports = { main, parseArguments }
