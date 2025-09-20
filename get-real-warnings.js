#!/usr/bin/env node

/**
 * 獲取真實的 no-unused-vars 警告
 */

const { execSync } = require('child_process')

console.log('🔍 獲取真實的 no-unused-vars 警告...\n')

try {
  // 使用標準格式獲取 ESLint 結果
  const result = execSync('npm run lint 2>&1', { encoding: 'utf8' })

  const lines = result.split('\n')
  const unusedVarsLines = lines.filter(line =>
    line.includes('no-unused-vars') && !line.includes('eslint-disable')
  )

  console.log(`📊 找到 ${unusedVarsLines.length} 個 no-unused-vars 警告\n`)

  if (unusedVarsLines.length > 0) {
    console.log('📋 前 20 個警告:')
    unusedVarsLines.slice(0, 20).forEach((line, i) => {
      console.log(`${i + 1}. ${line.trim()}`)
    })

    if (unusedVarsLines.length > 20) {
      console.log(`\n... 以及其他 ${unusedVarsLines.length - 20} 個警告`)
    }
  } else {
    console.log('✅ 沒有發現 no-unused-vars 警告！')
  }

} catch (error) {
  // ESLint 有警告時會返回非零退出代碼，這是正常的
  const output = error.stdout || error.message || ''

  const lines = output.split('\n')
  const unusedVarsLines = lines.filter(line =>
    line.includes('no-unused-vars') && !line.includes('eslint-disable')
  )

  console.log(`📊 找到 ${unusedVarsLines.length} 個 no-unused-vars 警告\n`)

  if (unusedVarsLines.length > 0) {
    console.log('📋 前 20 個警告:')
    unusedVarsLines.slice(0, 20).forEach((line, i) => {
      console.log(`${i + 1}. ${line.trim()}`)
    })

    if (unusedVarsLines.length > 20) {
      console.log(`\n... 以及其他 ${unusedVarsLines.length - 20} 個警告`)
    }
  } else {
    console.log('✅ 沒有發現 no-unused-vars 警告！')
  }
}