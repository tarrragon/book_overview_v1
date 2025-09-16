#!/usr/bin/env node

/**
 * 批量修復 no-console ESLint 警告
 * 
 * 策略：
 * 1. 為重要的console使用添加ESLint忽略註釋
 * 2. 清理明顯的臨時調試代碼
 * 3. 統計修復結果
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const projectRoot = path.join(__dirname, '..')

/**
 * 需要保留的console模式（加上忽略註釋）
 */
const PRESERVE_PATTERNS = [
  // 錯誤處理
  /console\.error\(/,
  /console\.warn\(/,
  // Logger系統已經處理
  // 導出處理器日誌
  /console\.log\(`\[.*\] Processing .* export request`\)/,
  /console\.log\(`\[.*\] .* export completed successfully`\)/,
  // 診斷信息
  /console\.log\(`📅 提取時間:/,
  /console\.log\('📂 Chrome Storage 中沒有書籍資料'\)/,
  /console\.log\(`📍 頁面檢測:/,
  // 重要警告
  /console\.warn\('⚠️/,
  /console\.debug\(/
]

/**
 * 需要清理的臨時調試模式
 */
const REMOVE_PATTERNS = [
  // 簡單的調試輸出
  /^\s*console\.log\(['"`]debug[:'"`]/i,
  /^\s*console\.log\(['"`]test[:'"`]/i,
  /^\s*console\.log\(['"`]temp[:'"`]/i,
  /^\s*console\.log\(.*TODO.*\)/i,
  // 空的或簡單值調試
  /^\s*console\.log\(\s*\)$/,
  /^\s*console\.log\(['"`]\w{1,3}['"`]\)$/
]

/**
 * 處理單個檔案
 */
function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { modified: false, reason: 'file not found' }
  }

  let content = fs.readFileSync(filePath, 'utf8')
  const originalContent = content
  let modifications = 0

  // 分行處理
  const lines = content.split('\n')
  const newLines = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    // 檢查是否為需要清理的調試代碼
    const shouldRemove = REMOVE_PATTERNS.some(pattern => pattern.test(trimmedLine))
    if (shouldRemove) {
      // 註釋掉而不是直接刪除，保持行號一致
      newLines.push(line.replace(trimmedLine, `// [REMOVED DEBUG] ${trimmedLine}`))
      modifications++
      continue
    }
    
    // 檢查是否為需要保留但加忽略註釋的console
    if (trimmedLine.includes('console.') && !trimmedLine.includes('eslint-disable')) {
      const needsIgnore = PRESERVE_PATTERNS.some(pattern => pattern.test(trimmedLine))
      
      if (needsIgnore) {
        // 在前一行加上 eslint-disable-next-line 註釋
        const indent = line.match(/^(\s*)/)[1]
        newLines.push(`${indent}// eslint-disable-next-line no-console`)
        newLines.push(line)
        modifications++
        continue
      }
    }
    
    newLines.push(line)
  }

  const newContent = newLines.join('\n')

  if (newContent !== originalContent) {
    fs.writeFileSync(filePath, newContent, 'utf8')
    return { 
      modified: true, 
      modifications,
      reason: `Added ${modifications} ESLint ignores/removals`
    }
  }

  return { modified: false, reason: 'no changes needed' }
}

/**
 * 獲取需要處理的檔案清單
 */
function getFilesToProcess() {
  const srcFiles = []
  
  // 遞歸查找 src/ 下的 .js 檔案
  function findJSFiles(dir) {
    const items = fs.readdirSync(dir)
    
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        findJSFiles(fullPath)
      } else if (item.endsWith('.js')) {
        srcFiles.push(fullPath)
      }
    }
  }
  
  const srcDir = path.join(projectRoot, 'src')
  if (fs.existsSync(srcDir)) {
    findJSFiles(srcDir)
  }
  
  return srcFiles
}

/**
 * 主執行函數
 */
function main() {
  console.log('🔧 開始批量修復 no-console ESLint 警告...\n')
  
  const files = getFilesToProcess()
  const results = {
    processed: 0,
    modified: 0,
    totalModifications: 0,
    errors: []
  }
  
  for (const filePath of files) {
    try {
      results.processed++
      const result = processFile(filePath)
      
      if (result.modified) {
        results.modified++
        results.totalModifications += result.modifications || 0
        console.log(`✅ ${path.relative(projectRoot, filePath)}: ${result.reason}`)
      } else {
        console.log(`⏭️  ${path.relative(projectRoot, filePath)}: ${result.reason}`)
      }
    } catch (error) {
      results.errors.push({ file: filePath, error: error.message })
      console.log(`❌ ${path.relative(projectRoot, filePath)}: ${error.message}`)
    }
  }
  
  // 輸出總結
  console.log('\n📊 處理結果統計:')
  console.log(`- 總檔案數: ${results.processed}`)
  console.log(`- 修改檔案數: ${results.modified}`)
  console.log(`- 總修改次數: ${results.totalModifications}`)
  console.log(`- 錯誤數: ${results.errors.length}`)
  
  if (results.errors.length > 0) {
    console.log('\n❌ 錯誤詳情:')
    results.errors.forEach(({ file, error }) => {
      console.log(`  ${path.relative(projectRoot, file)}: ${error}`)
    })
  }
  
  // 執行 lint 檢查看結果
  console.log('\n🔍 檢查修復效果...')
  try {
    const lintOutput = execSync('npm run lint 2>&1', { 
      cwd: projectRoot, 
      encoding: 'utf8',
      timeout: 30000
    })
    
    // 統計 no-console 警告數量
    const noConsoleWarnings = (lintOutput.match(/no-console/g) || []).length
    console.log(`📈 剩餘 no-console 警告數: ${noConsoleWarnings}`)
    
    if (noConsoleWarnings === 0) {
      console.log('🎉 所有 no-console 警告已修復！')
    } else {
      console.log('ℹ️  仍有一些 no-console 警告需要手動處理')
    }
    
  } catch (error) {
    console.log('⚠️  無法執行 lint 檢查:', error.message)
  }
  
  console.log('\n✅ 批量修復完成！')
}

if (require.main === module) {
  main()
}

module.exports = { processFile, getFilesToProcess }