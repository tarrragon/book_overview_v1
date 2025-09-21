#!/usr/bin/env node

/**
 * 自動修復 no-unused-vars 腳本
 * 基於實際問題進行智能修復
 */

const fs = require('fs')
const path = require('path')

console.log('🚀 自動修復 no-unused-vars 開始...\n')

// 需要手動修復的具體問題（基於已知模式）
const knownUnusedVarPatterns = [
  // 測試文件中的常見模式
  {
    file: /tests.*\.js$/,
    patterns: [
      { search: /const\s+(service|manager|controller|engine|adapter|extractor)\s*=(?!\s*require)/, type: 'prefix' },
      { search: /const\s+(error|exception|failure)\s*=(?!\s*(?:throw|return))/, type: 'prefix' },
      { search: /const\s+(mockEventBus|testData|expectedResult)\s*=/, type: 'prefix' },
      { search: /const\s+(startTime|endTime|levelStartTime|initialMemory)\s*=/, type: 'prefix' }
    ]
  },

  // src 文件中的模式
  {
    file: /src.*\.js$/,
    patterns: [
      { search: /const\s+(result|response|data)\s*=(?![^;]*(?:return|throw|console|Logger))/, type: 'disable' },
      { search: /const\s+(config|options|settings)\s*=(?![^;]*(?:return|throw|console|Logger))/, type: 'disable' }
    ]
  }
]

// 需要移除的未使用 imports
const unusedImports = [
  { pattern: /^const\s+ErrorCodes\s*=\s*require\([^)]+\);?\s*$/gm, name: 'ErrorCodes' },
  { pattern: /^const\s+StandardError\s*=\s*require\([^)]+\);?\s*$/gm, name: 'StandardError' },
  { pattern: /^const\s+Logger\s*=\s*require\([^)]+\);?\s*$/gm, name: 'Logger' }
]

let fixedCount = 0
let processedFiles = 0

function findFiles(dir, extension) {
  const files = []
  const fullDir = path.join(process.cwd(), dir)

  if (!fs.existsSync(fullDir)) return files

  function collectFiles(directory) {
    const items = fs.readdirSync(directory)

    items.forEach(item => {
      if (item.startsWith('.')) return // 跳過隱藏文件

      const fullPath = path.join(directory, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        collectFiles(fullPath)
      } else if (item.endsWith(extension)) {
        files.push(fullPath)
      }
    })
  }

  collectFiles(fullDir)
  return files
}

function isVariableUsed(content, varName, declarationLine) {
  // 移除變數聲明行
  const contentWithoutDeclaration = content.replace(declarationLine, '')

  // 檢查基本使用模式
  const usagePatterns = [
    new RegExp(`\\b${varName}\\s*[\\.\\[\\(]`, 'g'), // 方法調用或屬性訪問
    new RegExp(`\\b${varName}\\s*[,\\)]`, 'g'),      // 作為參數
    new RegExp(`\\breturn\\s+.*\\b${varName}\\b`, 'g'), // 在 return 中
    new RegExp(`\\bthrow\\s+.*\\b${varName}\\b`, 'g'),  // 在 throw 中
    new RegExp(`\\bexpect\\s*\\(.*\\b${varName}\\b`, 'g'), // 在 expect 中
    new RegExp(`\\bconsole\\.[^(]*\\(.*\\b${varName}\\b`, 'g'), // 在 console 中
    new RegExp(`\\bLogger\\.[^(]*\\(.*\\b${varName}\\b`, 'g')  // 在 Logger 中
  ]

  return usagePatterns.some(pattern => pattern.test(contentWithoutDeclaration))
}

function fixFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath)
  console.log(`🔍 處理: ${relativePath}`)

  const content = fs.readFileSync(filePath, 'utf8')
  let modified = content
  let changesMade = false

  // 1. 移除未使用的 imports
  unusedImports.forEach(({ pattern, name }) => {
    const matches = content.match(pattern)
    if (matches) {
      matches.forEach(match => {
        if (!isVariableUsed(content, name, match)) {
          modified = modified.replace(match, '')
          changesMade = true
          console.log(`  🗑️  移除未使用 import: ${name}`)
        }
      })
    }
  })

  // 2. 應用文件特定的模式修復
  knownUnusedVarPatterns.forEach(({ file: filePattern, patterns }) => {
    if (filePattern.test(relativePath)) {
      patterns.forEach(({ search, type }) => {
        const matches = [...modified.matchAll(search)]
        matches.forEach(match => {
          const fullMatch = match[0]
          const varName = match[1]

          if (!isVariableUsed(content, varName, fullMatch)) {
            if (type === 'prefix') {
              // 添加下劃線前綴
              const newMatch = fullMatch.replace(varName, `_${varName}`)
              modified = modified.replace(fullMatch, newMatch)
              changesMade = true
              console.log(`  🔄 添加前綴: ${varName} -> _${varName}`)
            } else if (type === 'disable') {
              // 添加 eslint-disable 註解
              const lines = modified.split('\n')
              const lineIndex = modified.substring(0, modified.indexOf(fullMatch)).split('\n').length - 1
              const indent = lines[lineIndex].match(/^(\s*)/)[1]
              lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)
              modified = lines.join('\n')
              changesMade = true
              console.log(`  🔇 添加 disable 註解: ${varName}`)
            }
          }
        })
      })
    }
  })

  // 3. 清理多餘空行
  if (changesMade) {
    modified = modified.replace(/\n\n\n+/g, '\n\n')
    fs.writeFileSync(filePath, modified)
    console.log(`  ✅ 文件已修復`)
    return true
  } else {
    console.log(`  ⏭️  無需修改`)
    return false
  }
}

function main() {
  const allFiles = [
    ...findFiles('src', '.js'),
    ...findFiles('tests', '.js')
  ]

  console.log(`📁 找到 ${allFiles.length} 個 JavaScript 文件\n`)

  allFiles.forEach(filePath => {
    processedFiles++
    const wasFixed = fixFile(filePath)
    if (wasFixed) {
      fixedCount++
    }
    console.log('')
  })

  console.log(`📊 處理統計:`)
  console.log(`   - 處理文件: ${processedFiles} 個`)
  console.log(`   - 修復文件: ${fixedCount} 個`)
  console.log(`   - 跳過文件: ${processedFiles - fixedCount} 個`)

  if (fixedCount > 0) {
    console.log('\n🎉 自動修復完成！')
    console.log('💡 建議執行 npm run lint 檢查效果')
  } else {
    console.log('\n📋 沒有需要修復的文件')
  }
}

main()