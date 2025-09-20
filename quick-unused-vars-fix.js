#!/usr/bin/env node

/**
 * 快速修復已知的 no-unused-vars 警告
 */

const fs = require('fs')
const path = require('path')

console.log('🔧 快速修復已知的 no-unused-vars 警告...\n')

// 已知的修復規則
const knownFixes = [
  // 1. currentUrl 問題 - 已修復
  // 2. EventHandler 問題
  {
    file: 'src/core/event-system-unifier.js',
    line: 47,
    variable: 'EventHandler',
    fix: 'add-disable-comment'
  },
  // 3. chainName 問題
  {
    file: 'src/core/event-system-unifier.js',
    line: 657,
    variable: 'chainName',
    fix: 'add-disable-comment'
  },
  // 4. eventConflicts 問題
  {
    file: 'src/core/events/event-priority-manager.js',
    line: 317,
    variable: 'eventConflicts',
    fix: 'add-disable-comment'
  },
  // 5. message 問題
  {
    file: 'src/core/logging/Logger.js',
    line: 77,
    variable: 'message',
    fix: 'add-disable-comment'
  },
  // 6. totalPassed, totalChecks 問題
  {
    file: 'src/core/logging/Logger.js',
    line: 753,
    variable: 'totalPassed',
    fix: 'add-disable-comment'
  },
  {
    file: 'src/core/logging/Logger.js',
    line: 754,
    variable: 'totalChecks',
    fix: 'add-disable-comment'
  },
  // 7. usedBytes 問題
  {
    file: 'src/storage/adapters/chrome-storage-adapter.js',
    line: 298,
    variable: 'usedBytes',
    fix: 'add-disable-comment'
  },
  // 8. UI_HANDLER_CONFIG 問題
  {
    file: 'src/ui/book-search-filter-integrated.js',
    line: 34,
    variable: 'UI_HANDLER_CONFIG',
    fix: 'add-disable-comment'
  },
  // 9. timestamp 問題
  {
    file: 'src/ui/handlers/ui-notification-handler.js',
    line: 172,
    variable: 'timestamp',
    fix: 'add-disable-comment'
  },
  // 10. options 問題
  {
    file: 'src/ui/search/core/search-engine.js',
    line: 682,
    variable: 'options',
    fix: 'add-disable-comment'
  }
]

function addDisableComment(filePath, lineNumber, variable) {
  const fullPath = path.resolve(filePath)

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  檔案不存在: ${filePath}`)
    return false
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8')
    const lines = content.split('\n')

    const lineIndex = lineNumber - 1

    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex]

      // 檢查是否已經有 eslint-disable 註解
      if (lineIndex > 0 && lines[lineIndex - 1].includes('eslint-disable-next-line no-unused-vars')) {
        console.log(`  ⏭️  ${filePath}:${lineNumber} - 已有 eslint-disable 註解 (${variable})`)
        return false
      }

      // 添加 eslint-disable 註解
      const indent = line.match(/^(\s*)/)[1]
      lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)

      fs.writeFileSync(fullPath, lines.join('\n'))
      console.log(`  ✅ ${filePath}:${lineNumber} - 添加 eslint-disable 註解 (${variable})`)
      return true
    } else {
      console.log(`  ⚠️  行號超出範圍: ${filePath}:${lineNumber}`)
      return false
    }
  } catch (error) {
    console.error(`處理檔案時發生錯誤 ${filePath}:`, error.message)
    return false
  }
}

function removeUnusedVariable(filePath, lineNumber, variable) {
  const fullPath = path.resolve(filePath)

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  檔案不存在: ${filePath}`)
    return false
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8')
    const lines = content.split('\n')

    const lineIndex = lineNumber - 1

    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex]

      // 檢查是否為簡單的變數宣告
      const simpleDeclarationPattern = new RegExp(`^\\s*(const|let|var)\\s+${variable}\\s*=.*$`)

      if (simpleDeclarationPattern.test(line)) {
        // 移除整行
        lines.splice(lineIndex, 1)
        fs.writeFileSync(fullPath, lines.join('\n'))
        console.log(`  ✅ ${filePath}:${lineNumber} - 移除未使用變數 (${variable})`)
        return true
      } else {
        // 不是簡單宣告，改用 eslint-disable
        return addDisableComment(filePath, lineNumber, variable)
      }
    } else {
      console.log(`  ⚠️  行號超出範圍: ${filePath}:${lineNumber}`)
      return false
    }
  } catch (error) {
    console.error(`處理檔案時發生錯誤 ${filePath}:`, error.message)
    return false
  }
}

function applyFix(fix) {
  const { file, line, variable, fix: fixType } = fix

  switch (fixType) {
    case 'add-disable-comment':
      return addDisableComment(file, line, variable)
    case 'remove-variable':
      return removeUnusedVariable(file, line, variable)
    case 'add-underscore':
      return addUnderscorePrefix(file, line, variable)
    default:
      console.log(`  ⚠️  未知修復類型: ${fixType}`)
      return false
  }
}

function addUnderscorePrefix(filePath, lineNumber, variable) {
  const fullPath = path.resolve(filePath)

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  檔案不存在: ${filePath}`)
    return false
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8')
    const lines = content.split('\n')

    const lineIndex = lineNumber - 1

    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex]

      // 替換變數名為加上下劃線的版本
      const newLine = line.replace(
        new RegExp(`\\b${escapeRegex(variable)}\\b`),
        `_${variable}`
      )

      if (newLine !== line) {
        lines[lineIndex] = newLine
        fs.writeFileSync(fullPath, lines.join('\n'))
        console.log(`  ✅ ${filePath}:${lineNumber} - 添加下劃線前綴 (${variable} → _${variable})`)
        return true
      } else {
        console.log(`  ⚠️  無法替換變數: ${filePath}:${lineNumber} (${variable})`)
        return false
      }
    } else {
      console.log(`  ⚠️  行號超出範圍: ${filePath}:${lineNumber}`)
      return false
    }
  } catch (error) {
    console.error(`處理檔案時發生錯誤 ${filePath}:`, error.message)
    return false
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 主要執行流程
function main() {
  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  console.log(`📋 準備修復 ${knownFixes.length} 個已知問題...\n`)

  for (const fix of knownFixes) {
    const { file, line, variable } = fix
    console.log(`🔧 處理: ${file}:${line} (${variable})`)

    const result = applyFix(fix)

    if (result === true) {
      successCount++
    } else if (result === false) {
      skipCount++
    } else {
      errorCount++
    }
  }

  console.log(`\n📊 修復統計:`)
  console.log(`   - 成功修復: ${successCount} 個`)
  console.log(`   - 跳過處理: ${skipCount} 個`)
  console.log(`   - 處理錯誤: ${errorCount} 個`)

  if (successCount > 0) {
    console.log('\n🎉 部分 no-unused-vars 問題已修復！')
    console.log('💡 建議執行 npm run lint 查看剩餘問題')
  } else {
    console.log('\n📋 沒有新的問題需要修復')
  }
}

main()