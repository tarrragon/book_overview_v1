#!/usr/bin/env node

/**
 * 測試單個文件修復
 */

const fs = require('fs')
const path = require('path')

// 測試修復 src/core/event-system-unifier.js 的第657行
function testSingleFix() {
  const filePath = 'src/core/event-system-unifier.js'
  const lineNumber = 657
  const variable = 'chainName'

  console.log(`🧪 測試修復: ${filePath}:${lineNumber} (${variable})`)

  if (!fs.existsSync(filePath)) {
    console.log(`❌ 檔案不存在: ${filePath}`)
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  const lineIndex = lineNumber - 1

  if (lineIndex < 0 || lineIndex >= lines.length) {
    console.log(`❌ 行號超出範圍: ${lineNumber}`)
    return
  }

  const line = lines[lineIndex]
  console.log(`📝 原始行: ${line}`)

  // 檢查變數是否存在於該行（即使被忽略）
  if (!line.includes('entries()')) {
    console.log(`⚠️  該行似乎不是 for...of 迴圈`)
    return
  }

  // 檢查是否已經有 eslint-disable 註解
  if (lineIndex > 0 && lines[lineIndex - 1].includes('eslint-disable-next-line no-unused-vars')) {
    console.log(`⏭️  已有 eslint-disable 註解`)
    return
  }

  // 添加 eslint-disable 註解
  const indent = line.match(/^(\s*)/)[1]
  const newLine = `${indent}// eslint-disable-next-line no-unused-vars`

  console.log(`✨ 將添加註解: "${newLine}"`)
  console.log(`📍 位置: 第 ${lineNumber} 行之前`)

  // 實際修復
  lines.splice(lineIndex, 0, newLine)

  // 備份原文件
  fs.writeFileSync(`${filePath}.backup`, content)
  fs.writeFileSync(filePath, lines.join('\n'))

  console.log(`✅ 修復完成！`)
  console.log(`💾 原文件已備份到 ${filePath}.backup`)
}

testSingleFix()