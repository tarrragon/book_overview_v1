#!/usr/bin/env node

/**
 * 檢查當前的所有 ESLint 警告
 */

const { execSync } = require('child_process')

console.log('🔍 檢查當前所有 ESLint 警告...\n')

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

  // 統計所有警告類型
  const warnings = {
    'no-unused-vars': [],
    'no-console': [],
    'no-new': [],
    'no-callback-literal': [],
    'other': []
  }

  let totalWarnings = 0
  let totalErrors = 0

  for (const line of lines) {
    if (line.includes('warning')) {
      totalWarnings++
      if (line.includes('no-unused-vars')) warnings['no-unused-vars'].push(line.trim())
      else if (line.includes('no-console')) warnings['no-console'].push(line.trim())
      else if (line.includes('no-new')) warnings['no-new'].push(line.trim())
      else if (line.includes('no-callback-literal')) warnings['no-callback-literal'].push(line.trim())
      else warnings['other'].push(line.trim())
    }
    if (line.includes('error')) {
      totalErrors++
    }
  }

  console.log('📈 ESLint 狀況統計：')
  console.log(`總計 Errors: ${totalErrors}`)
  console.log(`總計 Warnings: ${totalWarnings}\n`)

  console.log('警告類型分布：')
  Object.entries(warnings).forEach(([type, warningList]) => {
    if (warningList.length > 0) {
      console.log(`\n🔸 ${type}: ${warningList.length} 個`)
      // 顯示前 5 個警告
      warningList.slice(0, 5).forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`)
      })
      if (warningList.length > 5) {
        console.log(`   ... 以及其他 ${warningList.length - 5} 個`)
      }
    }
  })

  // 統計檔案數量
  const fileSet = new Set()
  let currentFile = null

  for (const line of lines) {
    if (line.trim().startsWith('/') && line.includes('.js')) {
      currentFile = line.trim()
    }
    if (line.includes('warning') && currentFile) {
      fileSet.add(currentFile)
    }
  }

  if (fileSet.size > 0) {
    console.log(`\n📁 涉及 ${fileSet.size} 個檔案`)
  }

} catch (error) {
  console.error('檢查過程中發生錯誤:', error.message)
}