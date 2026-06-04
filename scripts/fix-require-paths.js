#!/usr/bin/env node
/**
 * 修正 src/ 絕對路徑為相對路徑的自動化腳本
 *
 * 目標：解決 Node.js 模組解析問題
 * 策略：將所有 require('src/...') 轉換為正確的相對路徑
 */

const fs = require('fs')
const path = require('path')

/**
 * 計算從 from 檔案到 to 檔案的相對路徑
 */
function calculateRelativePath (fromFile, toFile) {
  const fromDir = path.dirname(fromFile)
  const relativePath = path.relative(fromDir, toFile)

  // 確保相對路徑以 ./ 或 ../ 開始
  if (!relativePath.startsWith('.')) {
    return './' + relativePath
  }

  return relativePath
}

/**
 * 處理單一檔案的路徑修正
 */
function fixFileRequirePaths (filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  let modified = false

  const newLines = lines.map(line => {
    // 匹配 require('src/...')
    const match = line.match(/require\(['"`]src\/([^'"`]+)['"`]\)/)
    if (match) {
      const srcPath = match[1]
      const absoluteTargetPath = path.join(__dirname, '..', 'src', srcPath)

      // 檢查目標檔案是否存在（先檢查 .js 副檔名）
      let targetPath = absoluteTargetPath
      if (!fs.existsSync(targetPath) && !targetPath.endsWith('.js')) {
        targetPath += '.js'
      }

      if (fs.existsSync(targetPath)) {
        const relativePath = calculateRelativePath(filePath, targetPath)
        const newLine = line.replace(/require\(['"`]src\/[^'"`]+['"`]\)/, `require('${relativePath}')`)

        if (newLine !== line) {
          console.log(`✅ ${filePath}`)
          console.log(`   ${line.trim()}`)
          console.log(`   → ${newLine.trim()}`)
          modified = true
          return newLine
        }
      } else {
        console.log(`❌ 找不到檔案: ${targetPath}`)
      }
    }

    return line
  })

  if (modified) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8')
    return true
  }

  return false
}

/**
 * 遞迴處理目錄中的所有 .js 檔案
 */
function processDirectory (dirPath) {
  const items = fs.readdirSync(dirPath)
  let totalFixed = 0

  for (const item of items) {
    const itemPath = path.join(dirPath, item)
    const stat = fs.statSync(itemPath)

    if (stat.isDirectory() && !['node_modules', '.git', 'build', 'coverage'].includes(item)) {
      totalFixed += processDirectory(itemPath)
    } else if (stat.isFile() && item.endsWith('.js')) {
      if (fixFileRequirePaths(itemPath)) {
        totalFixed++
      }
    }
  }

  return totalFixed
}

/**
 * 主要執行函式
 */
function main () {
  console.log('🔧 開始修正 require 路徑...\n')

  const projectRoot = path.join(__dirname, '..')
  const srcDir = path.join(projectRoot, 'src')

  let totalFixed = 0

  // 處理 src/ 目錄
  console.log('📁 處理 src/ 目錄...')
  totalFixed += processDirectory(srcDir)

  // 處理根目錄的 .js 檔案
  console.log('\n📁 處理根目錄...')
  const rootFiles = fs.readdirSync(projectRoot)
  for (const file of rootFiles) {
    if (file.endsWith('.js')) {
      const filePath = path.join(projectRoot, file)
      if (fixFileRequirePaths(filePath)) {
        totalFixed++
      }
    }
  }

  console.log(`\n✨ 修正完成！總共修正了 ${totalFixed} 個檔案`)

  if (totalFixed > 0) {
    console.log('\n🚨 重要提醒：')
    console.log('- 請執行測試確認修正結果：npm test')
    console.log('- 檢查是否有遺漏或錯誤的路徑修正')
    console.log('- 確認 Chrome Extension 功能正常運作')
  }
}

// 執行腳本
if (require.main === module) {
  main()
}

module.exports = { fixFileRequirePaths, calculateRelativePath }
