#!/usr/bin/env node

/**
 * Logger 修復驗證腳本
 * 驗證所有 Logger 導入是否正確修復
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🔧 Logger 修復驗證報告')
console.log('=' .repeat(50))

// 檢查修復的檔案列表
const fixedFiles = [
  'src/error-handling/event-tracker.js',
  'src/export/handlers/handler-registry.js',
  'src/ui/book-grid-renderer.js',
  'src/ui/handlers/ui-dom-manager.js',
  'src/error-handling/message-error-handler.js',
  'src/error-handling/error-system-init.js',
  'src/core/messages/MessageDictionary.js',
  'src/overview/overview.js',
  'src/performance/loading-optimizer.js',
  'src/performance/performance-integration.js',
  'src/popup/popup-event-controller.js',
  'src/ui/handlers/ui-progress-handler.js',
  'src/ui/handlers/base-ui-handler.js',
  'src/ui/search/ui-controller/search-ui-controller.js'
]

console.log(`📋 檢查 ${fixedFiles.length} 個已修復的檔案:\n`)

let allCorrect = true

fixedFiles.forEach((file, index) => {
  const filePath = path.join(__dirname, file)

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8')

    // 檢查是否有正確的 Logger 導入
    const hasCorrectImport = content.includes("const { Logger } = require('src/core/logging/Logger')")

    // 檢查是否還有錯誤的導入
    const hasIncorrectImport = content.includes("require('src/core/logging')") &&
                              !content.includes("require('src/core/logging/Logger')")

    const status = hasCorrectImport && !hasIncorrectImport ? '✅' : '❌'
    console.log(`${index + 1:2d}. ${status} ${file}`)

    if (!hasCorrectImport || hasIncorrectImport) {
      allCorrect = false
      if (!hasCorrectImport) {
        console.log(`     ⚠️  缺少正確的 Logger 導入`)
      }
      if (hasIncorrectImport) {
        console.log(`     ⚠️  仍有錯誤的 Logger 導入`)
      }
    }
  } else {
    console.log(`${index + 1:2d}. ❌ ${file} (檔案不存在)`)
    allCorrect = false
  }
})

console.log('\n' + '='.repeat(50))

if (allCorrect) {
  console.log('🎉 所有檔案的 Logger 導入都已正確修復!')
} else {
  console.log('⚠️  仍有檔案需要修復')
}

// 額外檢查：搜尋是否還有其他錯誤的 Logger 導入
console.log('\n🔍 搜尋剩餘的錯誤 Logger 導入...')

try {
  const grepResult = execSync("find src -name '*.js' -exec grep -l \"require('src/core/logging')\" {} \\; 2>/dev/null || true", { encoding: 'utf8' })

  if (grepResult.trim()) {
    console.log('❌ 發現剩餘的錯誤導入:')
    grepResult.trim().split('\n').forEach(file => {
      console.log(`   - ${file}`)
    })
  } else {
    console.log('✅ 沒有發現剩餘的錯誤導入')
  }
} catch (error) {
  console.log('⚠️  無法執行搜尋檢查:', error.message)
}

console.log('\n📊 修復摘要:')
console.log(`   - 檢查檔案數: ${fixedFiles.length}`)
console.log(`   - 修復成功: ${allCorrect ? fixedFiles.length : '部分'}`)
console.log(`   - 修復策略: 統一使用 const { Logger } = require('src/core/logging/Logger')`)

console.log('\n✅ Logger 修復驗證完成!')