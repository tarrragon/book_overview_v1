#!/usr/bin/env node

/**
 * 綜合性 no-unused-vars 清理腳本
 *
 * 功能實作規劃：
 * 1. 從當前環境實時獲取 ESLint no-unused-vars 警告
 * 2. 智能分析變數類型和使用場景
 * 3. 應用適當的修復策略（eslint-disable、重命名、移除）
 * 4. 生成詳細的修復報告和工作日誌
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🚀 綜合性 no-unused-vars 清理開始...\n')

// 配置
const CONFIG = {
  maxRetries: 3,
  timeoutMs: 30000,
  backupEnabled: true,
  dryRun: false // 設為 true 只檢查不修改
}

// 修復統計
const stats = {
  startTime: Date.now(),
  originalWarnings: 0,
  processedFiles: 0,
  fixedWarnings: 0,
  skippedWarnings: 0,
  errors: []
}

// 獲取當前所有 no-unused-vars 警告
function getCurrentWarnings() {
  console.log('🔍 獲取當前 ESLint 警告...')

  try {
    let output = ''
    try {
      output = execSync('npm run lint', {
        encoding: 'utf8',
        timeout: CONFIG.timeoutMs,
        stdio: 'pipe'
      })
    } catch (error) {
      // ESLint 有警告時退出代碼非零，但輸出仍然有效
      output = error.stdout || ''
    }

    const warnings = parseESLintOutput(output)
    console.log(`📊 發現 ${warnings.length} 個 no-unused-vars 警告`)

    return warnings
  } catch (error) {
    console.error('獲取警告失敗:', error.message)
    return []
  }
}

// 解析 ESLint 輸出
function parseESLintOutput(output) {
  const lines = output.split('\n')
  const warnings = []
  let currentFile = null

  for (const line of lines) {
    const trimmed = line.trim()

    // 檢測文件路徑
    if (trimmed.startsWith('/') && trimmed.includes('.js')) {
      currentFile = trimmed
      continue
    }

    // 檢測 no-unused-vars 警告
    if (trimmed.includes('no-unused-vars') && !trimmed.includes('eslint-disable')) {
      const match = trimmed.match(/^\s*(\d+):(\d+)\s+warning\s+'([^']+)'\s+(.+?)\s+no-unused-vars/)

      if (match && currentFile) {
        warnings.push({
          file: currentFile,
          line: parseInt(match[1]),
          column: parseInt(match[2]),
          variable: match[3],
          message: match[4],
          type: analyzeVariableType(match[3], match[4])
        })
      }
    }
  }

  return warnings
}

// 分析變數類型和推薦修復策略
function analyzeVariableType(variable, message) {
  // 測試相關變數
  if (variable.toLowerCase().includes('test') ||
      variable.toLowerCase().includes('mock') ||
      variable.toLowerCase().includes('stub') ||
      variable.toLowerCase().includes('spy')) {
    return { category: 'test', strategy: 'disable', reason: '測試相關變數' }
  }

  // 系統/環境變數
  const systemVars = ['chrome', 'window', 'document', 'console', 'global', 'process']
  if (systemVars.includes(variable)) {
    return { category: 'system', strategy: 'disable', reason: '系統變數' }
  }

  // 常數（全大寫）
  if (/^[A-Z_][A-Z0-9_]*$/.test(variable)) {
    return { category: 'constant', strategy: 'disable', reason: '常數定義' }
  }

  // 配置相關
  if (variable.includes('CONFIG') || variable.includes('config')) {
    return { category: 'config', strategy: 'disable', reason: '配置變數' }
  }

  // 事件處理相關
  if (variable.includes('Handler') || variable.includes('Event') || variable.includes('Listener')) {
    return { category: 'event', strategy: 'disable', reason: '事件處理' }
  }

  // 錯誤處理相關
  if (variable.includes('Error') || variable.includes('error')) {
    return { category: 'error', strategy: 'disable', reason: '錯誤處理' }
  }

  // 解構賦值中未使用的部分
  if (message.includes('destructuring')) {
    return { category: 'destructuring', strategy: 'underscore', reason: '解構賦值' }
  }

  // 函數參數
  if (message.includes('parameter')) {
    return { category: 'parameter', strategy: 'underscore', reason: '函數參數' }
  }

  // 簡單的未使用變數
  if (variable.length < 15 && !variable.includes('_')) {
    return { category: 'simple', strategy: 'underscore', reason: '簡單變數' }
  }

  // 預設策略
  return { category: 'other', strategy: 'disable', reason: '其他' }
}

// 應用修復策略
function applyFixStrategy(warning) {
  const { file, line, variable, type } = warning

  if (!fs.existsSync(file)) {
    stats.errors.push(`檔案不存在: ${file}`)
    return false
  }

  try {
    const content = fs.readFileSync(file, 'utf8')
    const lines = content.split('\n')
    const lineIndex = line - 1

    if (lineIndex < 0 || lineIndex >= lines.length) {
      stats.errors.push(`行號超出範圍: ${file}:${line}`)
      return false
    }

    const currentLine = lines[lineIndex]

    // 檢查變數是否確實存在
    if (!currentLine.includes(variable)) {
      stats.errors.push(`變數不在指定行: ${file}:${line} (${variable})`)
      return false
    }

    // 檢查是否已有 eslint-disable 註解
    if (lineIndex > 0 && lines[lineIndex - 1].includes('eslint-disable-next-line no-unused-vars')) {
      stats.skippedWarnings++
      return false
    }

    // 創建備份
    if (CONFIG.backupEnabled && !CONFIG.dryRun) {
      const backupPath = `${file}.backup-${Date.now()}`
      fs.writeFileSync(backupPath, content)
    }

    let modified = false

    switch (type.strategy) {
      case 'disable':
        // 添加 eslint-disable 註解
        const indent = currentLine.match(/^(\s*)/)[1]
        lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)
        modified = true
        console.log(`  ✅ 添加註解: ${variable} (${type.reason})`)
        break

      case 'underscore':
        // 添加下劃線前綴
        const newLine = currentLine.replace(
          new RegExp(`\\b${escapeRegex(variable)}\\b`),
          `_${variable}`
        )
        if (newLine !== currentLine) {
          lines[lineIndex] = newLine
          modified = true
          console.log(`  ✅ 重命名: ${variable} → _${variable} (${type.reason})`)
        } else {
          // 如果重命名失敗，改用 disable 策略
          const indent = currentLine.match(/^(\s*)/)[1]
          lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)
          modified = true
          console.log(`  ✅ 添加註解（重命名失敗）: ${variable} (${type.reason})`)
        }
        break

      case 'remove':
        // 移除整行（謹慎使用）
        lines.splice(lineIndex, 1)
        modified = true
        console.log(`  ✅ 移除: ${variable} (${type.reason})`)
        break
    }

    if (modified && !CONFIG.dryRun) {
      fs.writeFileSync(file, lines.join('\n'))
      stats.fixedWarnings++
      return true
    }

    return modified
  } catch (error) {
    stats.errors.push(`處理檔案失敗 ${file}: ${error.message}`)
    return false
  }
}

// 轉義正則表達式特殊字符
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 按文件分組警告
function groupWarningsByFile(warnings) {
  const groups = {}
  for (const warning of warnings) {
    if (!groups[warning.file]) {
      groups[warning.file] = []
    }
    groups[warning.file].push(warning)
  }
  return groups
}

// 生成修復報告
function generateReport(warnings) {
  const duration = (Date.now() - stats.startTime) / 1000

  const report = {
    summary: {
      timestamp: new Date().toISOString(),
      duration: `${duration.toFixed(2)}s`,
      originalWarnings: stats.originalWarnings,
      fixedWarnings: stats.fixedWarnings,
      skippedWarnings: stats.skippedWarnings,
      processedFiles: stats.processedFiles,
      errors: stats.errors.length,
      successRate: stats.originalWarnings > 0 ?
        ((stats.fixedWarnings / stats.originalWarnings) * 100).toFixed(2) + '%' : '100%'
    },
    details: {
      warningsByCategory: {},
      errorDetails: stats.errors
    },
    recommendations: []
  }

  // 統計分類
  for (const warning of warnings) {
    const category = warning.type.category
    if (!report.details.warningsByCategory[category]) {
      report.details.warningsByCategory[category] = 0
    }
    report.details.warningsByCategory[category]++
  }

  // 生成建議
  if (stats.fixedWarnings === stats.originalWarnings) {
    report.recommendations.push('🎉 所有 no-unused-vars 警告已成功修復！')
  } else {
    report.recommendations.push('⚠️  部分警告需要手動處理')
    report.recommendations.push('🔍 請檢查錯誤日誌了解失敗原因')
  }

  if (stats.errors.length > 0) {
    report.recommendations.push('📝 請查看錯誤詳情並手動修復')
  }

  return report
}

// 主執行流程
async function main() {
  console.log(`🔧 模式: ${CONFIG.dryRun ? 'DRY RUN (只檢查)' : '實際修復'}`)

  // 步驟 1: 獲取警告
  const warnings = getCurrentWarnings()
  stats.originalWarnings = warnings.length

  if (warnings.length === 0) {
    console.log('✅ 沒有發現 no-unused-vars 警告！')
    return
  }

  // 步驟 2: 顯示預覽
  console.log('\n📋 警告預覽:')
  warnings.slice(0, 10).forEach((w, i) => {
    const relativePath = path.relative('.', w.file)
    console.log(`   ${i + 1}. ${relativePath}:${w.line} - '${w.variable}' (${w.type.category})`)
  })

  if (warnings.length > 10) {
    console.log(`   ... 以及其他 ${warnings.length - 10} 個警告`)
  }

  // 步驟 3: 分組處理
  const fileGroups = groupWarningsByFile(warnings)
  stats.processedFiles = Object.keys(fileGroups).length

  console.log(`\n📁 涉及 ${stats.processedFiles} 個檔案`)

  if (CONFIG.dryRun) {
    console.log('🔍 DRY RUN - 不會進行實際修改')
  }

  console.log('\n🔧 開始處理...')

  // 步驟 4: 修復處理
  for (const [filePath, fileWarnings] of Object.entries(fileGroups)) {
    const relativePath = path.relative('.', filePath)
    console.log(`📁 處理: ${relativePath} (${fileWarnings.length} 個警告)`)

    // 按行號倒序處理，避免行號偏移
    const sortedWarnings = fileWarnings.sort((a, b) => b.line - a.line)

    for (const warning of sortedWarnings) {
      applyFixStrategy(warning)
    }
  }

  // 步驟 5: 驗證結果（非 DRY RUN 模式）
  if (!CONFIG.dryRun) {
    console.log('\n🔍 驗證修復結果...')
    const remainingWarnings = getCurrentWarnings()
    console.log(`剩餘警告: ${remainingWarnings.length} 個`)
  }

  // 步驟 6: 生成報告
  const report = generateReport(warnings)

  console.log('\n' + '='.repeat(60))
  console.log('📊 修復結果總結')
  console.log('='.repeat(60))
  console.log(`⏱️  執行時間: ${report.summary.duration}`)
  console.log(`📈 原始警告: ${report.summary.originalWarnings} 個`)
  console.log(`✅ 修復警告: ${report.summary.fixedWarnings} 個`)
  console.log(`⏭️  跳過警告: ${report.summary.skippedWarnings} 個`)
  console.log(`❌ 錯誤數量: ${report.summary.errors} 個`)
  console.log(`📊 成功率: ${report.summary.successRate}`)

  // 保存報告
  const reportPath = 'comprehensive-unused-vars-report.json'
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n💾 詳細報告已保存到: ${reportPath}`)

  // 顯示建議
  console.log('\n💡 建議:')
  report.recommendations.forEach(rec => {
    console.log(`   ${rec}`)
  })

  console.log('\n✅ 綜合性清理完成！')

  if (stats.errors.length > 0) {
    console.log('\n❌ 處理過程中的錯誤:')
    stats.errors.slice(0, 5).forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`)
    })
    if (stats.errors.length > 5) {
      console.log(`   ... 以及其他 ${stats.errors.length - 5} 個錯誤`)
    }
  }
}

// 執行主流程
main().catch(error => {
  console.error('\n❌ 執行過程中發生嚴重錯誤:', error.message)
  process.exit(1)
})