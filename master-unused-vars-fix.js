#!/usr/bin/env node

/**
 * 主要 no-unused-vars 修復協調器
 *
 * 執行順序：
 * 1. 修復測試文件中的警告
 * 2. 修復源代碼文件中的警告
 * 3. 驗證整體修復結果
 * 4. 生成修復報告
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🚀 開始大規模 no-unused-vars 警告修復...\n')

// 獲取當前總體 no-unused-vars 警告
function getAllUnusedVarsWarnings() {
  try {
    const result = execSync('npm run lint 2>&1', { encoding: 'utf8' })
    const lines = result.split('\n')

    return lines.filter(line =>
      line.includes('no-unused-vars') && !line.includes('eslint-disable')
    ).length
  } catch (error) {
    console.error('無法獲取 lint 結果:', error.message)
    return 0
  }
}

// 執行子腳本
function runScript(scriptPath, description) {
  console.log(`🔧 ${description}...`)

  try {
    const result = execSync(`node ${scriptPath}`, {
      encoding: 'utf8',
      stdio: 'inherit'
    })
    console.log(`✅ ${description} 完成\n`)
    return true
  } catch (error) {
    console.error(`❌ ${description} 失敗:`, error.message)
    return false
  }
}

// 生成詳細的修復報告
function generateReport(beforeCount, afterCount) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      beforeCount,
      afterCount,
      fixedCount: beforeCount - afterCount,
      successRate: beforeCount > 0 ? ((beforeCount - afterCount) / beforeCount * 100).toFixed(2) + '%' : '100%'
    },
    status: afterCount === 0 ? 'COMPLETE' : 'PARTIAL',
    recommendations: []
  }

  if (afterCount === 0) {
    report.recommendations.push('🎉 所有 no-unused-vars 警告已成功修復！')
    report.recommendations.push('💡 建議執行完整測試確保功能正常')
  } else {
    report.recommendations.push(`⚠️  還有 ${afterCount} 個警告需要手動處理`)
    report.recommendations.push('🔍 建議檢查剩餘警告是否為特殊情況')
    report.recommendations.push('📝 考慮為剩餘警告添加具體的 eslint-disable 註解')
  }

  // 保存報告
  fs.writeFileSync('unused-vars-fix-report.json', JSON.stringify(report, null, 2))

  return report
}

// 顯示修復進度
function showProgress(step, total, description) {
  const percentage = Math.round((step / total) * 100)
  const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5))
  console.log(`📊 進度 [${progressBar}] ${percentage}% - ${description}`)
}

// 主要執行流程
async function main() {
  const startTime = Date.now()

  console.log('📋 修復計劃:')
  console.log('   1️⃣ 檢查當前警告狀況')
  console.log('   2️⃣ 修復測試文件警告')
  console.log('   3️⃣ 修復源代碼文件警告')
  console.log('   4️⃣ 驗證修復結果')
  console.log('   5️⃣ 生成修復報告\n')

  // 步驟 1: 檢查初始狀況
  showProgress(1, 5, '檢查當前警告狀況')
  const beforeCount = getAllUnusedVarsWarnings()
  console.log(`📊 發現 ${beforeCount} 個 no-unused-vars 警告\n`)

  if (beforeCount === 0) {
    console.log('✅ 沒有 no-unused-vars 警告需要修復！')
    return
  }

  // 步驟 2: 修復測試文件
  showProgress(2, 5, '修復測試文件警告')
  const testFixSuccess = runScript('batch-test-unused-vars-fix.js', '修復測試文件')

  // 步驟 3: 修復源代碼文件
  showProgress(3, 5, '修復源代碼文件警告')
  const srcFixSuccess = runScript('src-unused-vars-fix.js', '修復源代碼文件')

  // 步驟 4: 驗證修復結果
  showProgress(4, 5, '驗證修復結果')
  const afterCount = getAllUnusedVarsWarnings()

  // 步驟 5: 生成報告
  showProgress(5, 5, '生成修復報告')
  const report = generateReport(beforeCount, afterCount)

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log('\n' + '='.repeat(60))
  console.log('📊 修復結果總結')
  console.log('='.repeat(60))
  console.log(`⏱️  執行時間: ${duration} 秒`)
  console.log(`📈 修復前警告: ${beforeCount} 個`)
  console.log(`📉 修復後警告: ${afterCount} 個`)
  console.log(`✅ 成功修復: ${report.summary.fixedCount} 個`)
  console.log(`📊 成功率: ${report.summary.successRate}`)
  console.log(`🎯 狀態: ${report.status}`)

  console.log('\n💡 建議:')
  report.recommendations.forEach(rec => {
    console.log(`   ${rec}`)
  })

  console.log(`\n💾 詳細報告已保存到: unused-vars-fix-report.json`)

  if (afterCount === 0) {
    console.log('\n🎉 恭喜！所有 no-unused-vars 警告已成功修復！')
  } else {
    console.log('\n🔍 剩餘警告需要手動檢查和處理')

    // 顯示前幾個剩餘警告
    try {
      const result = execSync('npm run lint 2>&1 | grep "no-unused-vars" | head -5', { encoding: 'utf8' })
      if (result.trim()) {
        console.log('\n📋 前 5 個剩餘警告:')
        result.trim().split('\n').forEach((line, index) => {
          console.log(`   ${index + 1}. ${line.trim()}`)
        })
      }
    } catch (error) {
      // 忽略錯誤
    }
  }

  console.log('\n✅ 大規模 no-unused-vars 修復完成！')
}

// 執行主流程
main().catch(error => {
  console.error('\n❌ 修復過程中發生錯誤:', error.message)
  process.exit(1)
})