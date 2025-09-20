#!/usr/bin/env node

console.log('🔍 快速檢查當前 no-unused-vars 狀況...\n')

const { execSync } = require('child_process')

try {
  // 先只檢查幾個檔案
  const testCommand = 'npx eslint src/core/event-system-unifier.js src/content/detectors/page-detector.js --format compact 2>&1'

  let output = ''
  try {
    output = execSync(testCommand, { encoding: 'utf8' })
  } catch (error) {
    output = error.stdout || error.message || ''
  }

  console.log('ESLint 輸出:')
  console.log(output)

  const lines = output.split('\n')
  const unusedVarsLines = lines.filter(line =>
    line.includes('no-unused-vars') && !line.includes('eslint-disable')
  )

  console.log(`\n📊 在測試檔案中發現 ${unusedVarsLines.length} 個 no-unused-vars 警告`)

  if (unusedVarsLines.length > 0) {
    console.log('\n警告詳情:')
    unusedVarsLines.forEach((line, i) => {
      console.log(`${i + 1}. ${line.trim()}`)
    })
  } else {
    console.log('✅ 測試檔案中沒有 no-unused-vars 警告！')
  }

} catch (error) {
  console.error('檢查過程發生錯誤:', error.message)
}