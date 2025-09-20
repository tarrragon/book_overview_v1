#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🔧 正在搜尋所有含有 console 警告的測試檔案...')

// 取得所有含有 console 使用的測試檔案
const testFiles = execSync(`grep -r "console\\.(log\\|warn\\|error\\|info\\|debug)" tests/ --include="*.js" -l`, { encoding: 'utf-8' })
  .trim()
  .split('\n')
  .filter(file => file.length > 0)

console.log(`找到 ${testFiles.length} 個檔案需要處理`)

testFiles.forEach(file => {
  if (!fs.existsSync(file)) return

  console.log(`處理: ${file}`)

  let content = fs.readFileSync(file, 'utf8')
  let modified = false

  const lines = content.split('\n')
  const result = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = i < lines.length - 1 ? lines[i + 1] : ''

    // 檢查下一行是否包含 console 且前一行沒有 eslint-disable
    if (/console\.(log|warn|error|info|debug)/.test(nextLine)) {
      if (!/eslint-disable-next-line no-console/.test(line)) {
        // 獲取縮排
        const indent = nextLine.match(/^(\s*)/)[1]
        result.push(line)
        result.push(`${indent}// eslint-disable-next-line no-console`)
        modified = true
        continue
      }
    }

    result.push(line)
  }

  if (modified) {
    fs.writeFileSync(file, result.join('\n'), 'utf8')
    console.log(`  ✅ 已修復`)
  } else {
    console.log(`  ⏭️  無需修復`)
  }
})

console.log('🎉 批量修復完成！')