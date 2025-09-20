#!/usr/bin/env node

/**
 * 檢查當前的 no-unused-vars 警告
 */

const { execSync } = require('child_process')

console.log('🔍 檢查當前 no-unused-vars 警告...\n')

try {
  let output = ''
  try {
    // 嘗試執行 npm run lint
    output = execSync('npm run lint 2>&1', {
      encoding: 'utf8',
      timeout: 30000 // 30秒超時
    })
  } catch (error) {
    // ESLint 有警告時會返回非零退出代碼
    output = error.stdout || error.message || ''
  }

  if (!output) {
    console.log('❌ 無法獲取 ESLint 輸出')
    return
  }

  const lines = output.split('\n')

  // 過濾 no-unused-vars 警告
  const unusedVarsLines = lines.filter(line =>
    line.includes('no-unused-vars') && !line.includes('eslint-disable')
  )

  console.log(`📊 找到 ${unusedVarsLines.length} 個 no-unused-vars 警告\n`)

  if (unusedVarsLines.length > 0) {
    console.log('📋 前 15 個警告:')
    unusedVarsLines.slice(0, 15).forEach((line, i) => {
      console.log(`${(i + 1).toString().padStart(2)}: ${line.trim()}`)
    })

    if (unusedVarsLines.length > 15) {
      console.log(`\n... 以及其他 ${unusedVarsLines.length - 15} 個警告`)
    }
  } else {
    console.log('✅ 沒有發現 no-unused-vars 警告！')
  }

  // 統計檔案數量
  const fileSet = new Set()
  let currentFile = null

  for (const line of lines) {
    if (line.trim().startsWith('/') && line.includes('.js')) {
      currentFile = line.trim()
    }
    if (line.includes('no-unused-vars') && currentFile) {
      fileSet.add(currentFile)
    }
  }

  if (fileSet.size > 0) {
    console.log(`\n📁 涉及 ${fileSet.size} 個檔案`)
  }

} catch (error) {
  console.error('檢查過程中發生錯誤:', error.message)
}