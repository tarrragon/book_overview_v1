#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🔧 正在自動修復所有測試檔案中的 console warnings...')

// 取得所有含 console 的檔案
const grep = execSync(`grep -r "console\\.(log\\|warn\\|error\\|info\\|debug)" tests/ --include="*.js" -l`, { encoding: 'utf-8' })
  .trim()
  .split('\n')
  .filter(file => file.length > 0)

console.log(`發現 ${grep.length} 個檔案需要處理`)

let processed = 0
let modified = 0

for (const file of grep) {
  if (!fs.existsSync(file)) continue

  processed++
  console.log(`[${processed}/${grep.length}] ${file}`)

  let content = fs.readFileSync(file, 'utf8')
  let changed = false

  // 按行處理
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 如果這行包含 console 且前一行沒有 eslint-disable
    if (/console\.(log|warn|error|info|debug)/.test(line)) {
      const prevLine = i > 0 ? lines[i - 1] : ''
      if (!/eslint-disable-next-line no-console/.test(prevLine)) {
        // 獲取縮排
        const match = line.match(/^(\s*)/)
        const indent = match ? match[1] : ''

        // 在前一行插入 eslint-disable 註解
        lines.splice(i, 0, `${indent}// eslint-disable-next-line no-console`)
        i++ // 跳過剛插入的行
        changed = true
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8')
    modified++
    console.log(`  ✅ 已修復`)
  } else {
    console.log(`  ⏭️  已有註解`)
  }
}

console.log(`\n🎉 處理完成！`)
console.log(`📊 統計:`)
console.log(`  - 檢查檔案: ${processed}`)
console.log(`  - 修復檔案: ${modified}`)
console.log(`  - 跳過檔案: ${processed - modified}`)

console.log(`\n🔍 驗證結果:`)
try {
  const remaining = execSync(`grep -r "console\\.(log\\|warn\\|error\\|info\\|debug)" tests/ --include="*.js" | grep -v "eslint-disable-next-line no-console" | wc -l`, { encoding: 'utf-8' }).trim()
  console.log(`剩餘未處理的 console 語句: ${remaining}`)
} catch (error) {
  console.log('無法統計剩餘語句，請手動檢查')
}