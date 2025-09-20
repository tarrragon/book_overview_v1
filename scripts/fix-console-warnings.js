#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// 需要處理的檔案列表
const files = [
  'tests/integration/chrome-extension/content-script-extractor.test.js',
  'tests/integration/chrome-extension/event-bus-stats.test.js',
  'tests/integration/chrome-extension/popup-interface.test.js',
  'tests/integration/cross-module/background-content-integration.test.js',
  'tests/integration/cross-module/popup-background-integration.test.js',
  'tests/integration/cross-module/event-system-integration.test.js',
  'tests/integration/workflows/cross-device-sync-workflow.test.js',
  'tests/e2e/validation/simple-validation.test.js',
  'tests/e2e/validation/setup-validation.test.js',
  'tests/e2e/performance/benchmark-tests.test.js',
  'tests/helpers/e2e-test-suite.js',
  'tests/helpers/testing-integrity-checker.js',
  'tests/helpers/event-flow-validator.js',
  'tests/helpers/memory-leak-detector.js',
  'tests/helpers/chrome-extension-environment-simulator.js',
  'tests/helpers/chrome-extension-controller.js',
  'tests/processors/test-results-processor.js',
  'tests/utils/chrome-extension-mocks-enhanced-refactored.js',
  'tests/integration/run-event-system-v2-integration.js',
  'tests/integration/event-system-v2-performance-stability.test.js',
  'tests/integration/performance/performance-monitoring-integration.test.js',
  'tests/unit/adapters/stable-id-generation.test.js',
  'tests/unit/overview/overview-import-function.test.js',
  'tests/unit/error-handling/message-tracker.test.js',
  'tests/test-setup.js'
]

function fixConsoleInFile(filePath) {
  const fullPath = path.resolve(filePath)

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  檔案不存在: ${filePath}`)
    return false
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8')
    const lines = content.split('\n')
    const fixedLines = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const nextLine = i < lines.length - 1 ? lines[i + 1] : ''

      // 檢查當前行是否包含 console 語句
      if (/console\.(log|warn|error|info|debug)/.test(line)) {
        // 檢查前一行是否已經有 eslint-disable 註解
        const prevLine = i > 0 ? lines[i - 1] : ''
        if (!/eslint-disable-next-line no-console/.test(prevLine)) {
          // 獲取當前行的縮排
          const indent = line.match(/^(\s*)/)[1]
          // 添加 eslint-disable 註解
          fixedLines.push(`${indent}// eslint-disable-next-line no-console`)
        }
      }

      fixedLines.push(line)
    }

    const fixedContent = fixedLines.join('\n')

    // 只有當內容有變化時才寫入檔案
    if (fixedContent !== content) {
      fs.writeFileSync(fullPath, fixedContent, 'utf8')
      console.log(`✅ 已修復: ${filePath}`)
      return true
    } else {
      console.log(`⏭️  無需修復: ${filePath}`)
      return false
    }
  } catch (error) {
    console.error(`❌ 處理檔案失敗 ${filePath}:`, error.message)
    return false
  }
}

function main() {
  console.log('🔧 開始批量修復測試檔案中的 console warnings...\n')

  let fixedCount = 0
  let totalCount = 0

  for (const file of files) {
    totalCount++
    if (fixConsoleInFile(file)) {
      fixedCount++
    }
  }

  console.log('\n🎉 批量修復完成！')
  console.log(`📋 修復摘要：`)
  console.log(`- 檢查了 ${totalCount} 個檔案`)
  console.log(`- 修復了 ${fixedCount} 個檔案`)
  console.log(`\n🔍 建議執行以下指令檢查結果：`)
  console.log('npm run lint | grep no-console')
}

if (require.main === module) {
  main()
}

module.exports = { fixConsoleInFile }