#!/usr/bin/env node
/**
 * 批次修正 JavaScript 檔案中錯誤的 require 路徑問題
 * 
 * 問題: `require('./src/...')` 錯誤路徑
 * 解決: 根據檔案位置計算正確的相對路徑
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// 獲取所有有問題的 JS 檔案
function getProblematicFiles() {
  try {
    const output = execSync('find src -name "*.js" -exec grep -l "require([\'"]\\.\/src\/" {} \\;', { encoding: 'utf8' })
    return output.trim().split('\n').filter(Boolean)
  } catch (error) {
    console.log('沒有找到有問題的檔案')
    return []
  }
}

// 計算正確的相對路徑
function calculateCorrectPath(fileLocation, targetPath) {
  // 移除 './src/' 前綴
  const cleanTarget = targetPath.replace(/^\.\/src\//, '')
  
  // 計算檔案所在目錄的深度
  const fileParts = fileLocation.split('/')
  const depth = fileParts.length - 1 // 減1因為最後一個是檔案名
  
  // 計算需要的 '../' 數量
  const backSteps = depth - 1 // 減1因為要從 src 開始
  const relativePath = '../'.repeat(backSteps) + cleanTarget
  
  return relativePath
}

// 修正單個檔案
function fixFile(filePath) {
  console.log(`正在修正: ${filePath}`)
  
  let content = fs.readFileSync(filePath, 'utf8')
  let modified = false
  
  // 找出所有 require('./src/...') 模式
  const requireRegex = /require\(['"]\.\/src\/([^'"]*)['"]\)/g
  let match
  const replacements = []
  
  while ((match = requireRegex.exec(content)) !== null) {
    const originalPath = match[0]
    const targetModule = match[1]
    const correctPath = calculateCorrectPath(filePath, `./src/${targetModule}`)
    const newRequire = `require('${correctPath}')`
    
    replacements.push({
      original: originalPath,
      replacement: newRequire
    })
  }
  
  // 執行替換
  for (const { original, replacement } of replacements) {
    if (content.includes(original)) {
      content = content.replace(original, replacement)
      modified = true
      console.log(`  ${original} → ${replacement}`)
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8')
    return true
  }
  
  return false
}

// 主處理函數
function main() {
  console.log('🔧 開始批次修正 JavaScript 檔案中的 require 路徑問題...\n')
  
  const problematicFiles = getProblematicFiles()
  
  if (problematicFiles.length === 0) {
    console.log('✅ 沒有發現需要修正的檔案')
    return
  }
  
  console.log(`發現 ${problematicFiles.length} 個需要修正的檔案:\n`)
  
  let fixedCount = 0
  let totalReplacements = 0
  
  for (const filePath of problematicFiles) {
    const wasFixed = fixFile(filePath)
    if (wasFixed) {
      fixedCount++
    }
    console.log()
  }
  
  console.log(`📊 修正完成統計:`)
  console.log(`- 處理檔案數: ${problematicFiles.length}`)
  console.log(`- 成功修正: ${fixedCount}`)
  console.log(`- 修正模式: ./src/... → 正確相對路徑`)
  
  // 驗證修正結果
  console.log('\n🧪 驗證修正結果...')
  const remainingIssues = getProblematicFiles()
  
  if (remainingIssues.length === 0) {
    console.log('✅ 所有路徑問題已成功修正!')
  } else {
    console.log(`⚠️  仍有 ${remainingIssues.length} 個檔案需要處理:`)
    remainingIssues.forEach(file => console.log(`   - ${file}`))
  }
}

// 執行主程序
main()