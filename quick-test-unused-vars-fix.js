#!/usr/bin/env node

/**
 * 快速修復測試文件中常見的 unused vars
 */

const fs = require('fs')
const path = require('path')

console.log('🧪 快速修復測試文件 unused vars...\n')

// 測試文件的常見 unused vars 模式
const testVarPatterns = [
  // 測試實例變數
  { pattern: /const\s+(service|manager|controller|engine|adapter|extractor)\s*=(?!\s*require)/, prefix: true },

  // 錯誤變數
  { pattern: /const\s+(error|exception|failure|fullExportError|fullImportError|mergeError)\s*=/, prefix: true },

  // 時間相關變數
  { pattern: /const\s+(startTime|endTime|levelStartTime|initialMemory|beforeCreation)\s*=/, prefix: true },

  // 測試輔助
  { pattern: /const\s+(mockEventBus|validateDetectionResult|performanceHelpers|testData|expectedResult)\s*=/, prefix: true },

  // 配置和選項
  { pattern: /const\s+(config|options|settings|CONFIG)\s*=(?![^;]*(?:return|throw|console|expect))/, prefix: true }
]

// 需要移除的未使用 imports
const unusedImports = [
  /^const\s+ErrorCodes\s*=\s*require\([^)]+\);?\s*$/gm,
  /^const\s+StandardError\s*=\s*require\([^)]+\);?\s*$/gm,
  /^const\s+Logger\s*=\s*require\([^)]+\);?\s*$/gm
]

function findTestFiles() {
  const testFiles = []
  const testDirs = ['tests/unit', 'tests/integration', 'tests/helpers']

  testDirs.forEach(dir => {
    const fullDir = path.join(process.cwd(), dir)
    if (fs.existsSync(fullDir)) {
      collectJSFiles(fullDir, testFiles)
    }
  })

  return testFiles
}

function collectJSFiles(dir, files) {
  const items = fs.readdirSync(dir)

  items.forEach(item => {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      collectJSFiles(fullPath, files)
    } else if (item.endsWith('.js')) {
      files.push(fullPath)
    }
  })
}

function fixTestFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    let modified = content
    let changesMade = false

    // 1. 移除未使用的 imports
    unusedImports.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const varName = match.match(/const\s+(\w+)/)?.[1]
          if (varName && !isVariableUsed(content, varName, match)) {
            modified = modified.replace(match, '')
            changesMade = true
            console.log(`  🗑️  移除未使用 import: ${varName}`)
          }
        })
      }
    })

    // 2. 為測試變數添加下劃線前綴
    testVarPatterns.forEach(({ pattern, prefix }) => {
      if (prefix) {
        modified = modified.replace(pattern, (match, varName) => {
          if (!isVariableUsed(content, varName, match)) {
            changesMade = true
            console.log(`  🔄 添加前綴: ${varName} -> _${varName}`)
            return match.replace(varName, `_${varName}`)
          }
          return match
        })
      }
    })

    // 3. 清理多餘空行
    if (changesMade) {
      modified = modified.replace(/\n\n\n+/g, '\n\n')
      fs.writeFileSync(filePath, modified)
      return true
    }

    return false
  } catch (error) {
    console.log(`  ❌ 錯誤: ${error.message}`)
    return false
  }
}

function isVariableUsed(content, varName, declarationLine) {
  // 移除變數聲明行以避免誤判
  const contentWithoutDeclaration = content.replace(declarationLine, '')

  // 檢查變數使用模式
  const usagePatterns = [
    new RegExp(`\\b${varName}\\s*[\\.\\[\\(]`, 'g'), // 方法調用或屬性訪問
    new RegExp(`\\b${varName}\\s*[,\\)]`, 'g'),      // 作為參數
    new RegExp(`return\\s+.*\\b${varName}\\b`, 'g'),   // 在 return 中
    new RegExp(`throw\\s+.*\\b${varName}\\b`, 'g'),    // 在 throw 中
    new RegExp(`expect\\s*\\(.*\\b${varName}\\b`, 'g'), // 在 expect 中
    new RegExp(`console\\.[^(]*\\(.*\\b${varName}\\b`, 'g') // 在 console 中
  ]

  return usagePatterns.some(pattern => pattern.test(contentWithoutDeclaration))
}

function main() {
  const testFiles = findTestFiles()
  console.log(`📁 找到 ${testFiles.length} 個測試文件\n`)

  let fixedCount = 0
  let processedCount = 0

  testFiles.forEach(filePath => {
    const relativePath = path.relative(process.cwd(), filePath)
    console.log(`🔍 處理: ${relativePath}`)

    const wasFixed = fixTestFile(filePath)
    processedCount++

    if (wasFixed) {
      fixedCount++
      console.log(`  ✅ 已修復`)
    } else {
      console.log(`  ⏭️  無需修改`)
    }

    console.log('')
  })

  console.log(`\n📊 處理統計:`)
  console.log(`   - 處理文件: ${processedCount} 個`)
  console.log(`   - 修復文件: ${fixedCount} 個`)
  console.log(`   - 跳過文件: ${processedCount - fixedCount} 個`)

  if (fixedCount > 0) {
    console.log('\n🎉 快速修復完成！')
    console.log('💡 建議執行 npm run lint 檢查效果')
  } else {
    console.log('\n📋 所有測試文件都沒有需要修復的 unused vars')
  }
}

main()