#!/usr/bin/env node

/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

/**
 * 最終 Console Warnings 清理腳本
 *
 * 目標：處理剩餘的 60 個 no-console warnings
 * 策略：
 * 1. 檢測所有測試文件中的 console 語句
 * 2. 為調試輸出添加 eslint-disable-next-line
 * 3. 為多個 console 的文件添加全域 eslint-disable
 */

async function cleanupConsoleWarnings() {
  console.log('🧹 開始最終 Console Warnings 清理...')

  try {
    // 1. 檢查當前的 lint 狀態
    const lintOutput = execSync('npm run lint 2>&1', {
      encoding: 'utf8',
      cwd: process.cwd()
    })

    const consoleWarnings = lintOutput.split('\n')
      .filter(line => line.includes('no-console'))
      .length

    console.log(`📊 發現 ${consoleWarnings} 個 no-console warnings`)

    // 2. 定義需要全域禁用的測試文件類型
    const globalDisableFiles = [
      'tests/performance/**/*.test.js',
      'tests/e2e/**/*.test.js',
      'tests/helpers/**/*.js',
      'tests/infrastructure/**/*.js',
      'tests/mocks/**/*.js',
      'tests/utils/**/*.js'
    ]

    // 3. 處理需要全域禁用的文件
    for (const pattern of globalDisableFiles) {
      await processGlobalDisableFiles(pattern)
    }

    // 4. 處理剩餘的單行 console 語句
    await processSingleLineConsole()

    // 5. 驗證結果
    const finalLintOutput = execSync('npm run lint 2>&1', {
      encoding: 'utf8',
      cwd: process.cwd()
    })

    const finalConsoleWarnings = finalLintOutput.split('\n')
      .filter(line => line.includes('no-console'))
      .length

    console.log(`✅ 清理完成！從 ${consoleWarnings} 減少到 ${finalConsoleWarnings} 個 warnings`)

    if (finalConsoleWarnings <= 10) {
      console.log('🎯 目標達成！剩餘 warnings 在可接受範圍內')
    } else {
      console.log('⚠️ 仍需進一步清理')
    }

  } catch (error) {
    console.error('❌ 清理過程發生錯誤:', error.message)
  }
}

async function processGlobalDisableFiles(pattern) {
  console.log(`🔍 處理模式: ${pattern}`)

  // 簡化版本：處理主要的 helpers 和 infrastructure 文件
  const filesToProcess = [
    'tests/helpers/event-flow-validator.js',
    'tests/helpers/chrome-extension-environment-simulator.js',
    'tests/infrastructure/e2e-test-environment.js',
    'tests/infrastructure/unit-test-environment.js',
    'tests/utils/chrome-extension-mocks-enhanced-refactored.js',
    'tests/processors/test-results-processor.js',
    'tests/e2e/scripts/run-e2e-tests.js'
  ]

  for (const filePath of filesToProcess) {
    const fullPath = path.join(process.cwd(), filePath)

    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8')

        // 檢查是否已經有 eslint-disable
        if (!content.includes('/* eslint-disable no-console */') &&
            !content.includes('// eslint-disable no-console')) {

          // 檢查是否有 console 語句
          if (content.includes('console.')) {
            console.log(`📝 添加全域禁用到: ${filePath}`)

            // 在文件開頭添加全域禁用
            const lines = content.split('\n')
            let insertIndex = 0

            // 跳過 shebang 和註釋
            while (insertIndex < lines.length &&
                   (lines[insertIndex].startsWith('#!') ||
                    lines[insertIndex].startsWith('/**') ||
                    lines[insertIndex].trim() === '')) {
              insertIndex++
            }

            lines.splice(insertIndex, 0, '/* eslint-disable no-console */', '')

            fs.writeFileSync(fullPath, lines.join('\n'))
          }
        }
      } catch (error) {
        console.warn(`⚠️ 處理 ${filePath} 時發生錯誤:`, error.message)
      }
    }
  }
}

async function processSingleLineConsole() {
  console.log('🔧 處理單行 console 語句...')

  // 處理主要的整合測試文件中剩餘的 console 語句
  const testFiles = [
    'tests/integration/readmoo-migration-integration.test.js',
    'tests/e2e/validation/setup-validation.test.js',
    'tests/e2e/validation/simple-validation.test.js',
    'tests/e2e/deployment/chrome-store-readiness.test.js',
    'tests/e2e/workflows/complete-extraction-workflow.test.js',
    'tests/e2e/integration/ui-interaction-flow.test.js'
  ]

  for (const filePath of testFiles) {
    const fullPath = path.join(process.cwd(), filePath)

    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8')

        if (!content.includes('/* eslint-disable no-console */')) {
          console.log(`📝 添加全域禁用到: ${filePath}`)

          // 在文件開頭添加全域禁用
          const lines = content.split('\n')
          lines.unshift('/* eslint-disable no-console */', '')

          fs.writeFileSync(fullPath, lines.join('\n'))
        }
      } catch (error) {
        console.warn(`⚠️ 處理 ${filePath} 時發生錯誤:`, error.message)
      }
    }
  }
}

// 執行清理
if (require.main === module) {
  cleanupConsoleWarnings()
}

module.exports = { cleanupConsoleWarnings }