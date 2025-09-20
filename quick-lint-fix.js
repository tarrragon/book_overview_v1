#!/usr/bin/env node

const { execSync } = require('child_process')

console.log('🔍 快速檢查 no-unused-vars 警告...\n')

try {
  const result = execSync('npm run lint 2>&1', { encoding: 'utf8' })
  if (!result.includes('no-unused-vars')) {
    console.log('✅ 沒有發現 no-unused-vars 警告')
    process.exit(0)
  }
} catch (error) {
  const output = error.stdout || error.stderr || ''

  // 提取 no-unused-vars 警告
  const lines = output.split('\n')
  const unusedVarsWarnings = lines.filter(line =>
    line.includes('no-unused-vars') && !line.includes('eslint-disable')
  )

  console.log(`📊 找到 ${unusedVarsWarnings.length} 個 no-unused-vars 警告`)

  if (unusedVarsWarnings.length > 0) {
    console.log('\n前 10 個警告:')
    unusedVarsWarnings.slice(0, 10).forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`)
    })

    if (unusedVarsWarnings.length > 10) {
      console.log(`\n... 還有 ${unusedVarsWarnings.length - 10} 個警告`)
    }
  }
}