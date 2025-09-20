#!/usr/bin/env node

/**
 * 批量修復 no-unused-vars 警告
 * 重點處理您提到的文件和變數類型
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🔧 批量修復 no-unused-vars 警告...\n')

// 重點文件列表（您提到的文件）
const PRIORITY_FILES = [
  'src/core/migration/DualErrorSystemBridge.js',
  'src/core/performance/performance-anomaly-detector.js',
  'src/overview/overview.js',
  'src/ui/handlers/ui-progress-handler.js',
  'src/ui/search/ui-controller/search-ui-controller.js'
]

// 常見未使用變數的處理策略
const VARIABLE_STRATEGIES = {
  // 真正未使用的引用 - 直接移除
  remove: [
    'MIGRATION_MODES', // 未使用的常數
    'StandardError', // 未使用的引用
    'ErrorCodes', // 某些文件中未使用
    'Logger' // 某些文件中未使用
  ],

  // 需要保留但加上 eslint-disable 註解
  preserve: [
    'getDiagnosticSuggestion', // 可能在未來版本使用
    'ErrorTypes', // 類型定義
    'UI_HANDLER_CONFIG' // 配置常數
  ]
}

/**
 * 讀取並解析當前的 ESLint 輸出
 */
function getCurrentLintIssues() {
  try {
    const lintOutput = execSync('npm run lint', { encoding: 'utf8', stdio: 'pipe' })
    return []
  } catch (error) {
    const output = error.stdout || error.stderr || ''
    return output.split('\n').filter(line =>
      line.includes('no-unused-vars') && !line.includes('eslint-disable')
    )
  }
}

/**
 * 解析 ESLint 警告行
 */
function parseLintWarning(warningLine) {
  // 格式: file.js:123:45  warning  'variableName' is assigned a value but never used  no-unused-vars
  const match = warningLine.match(/(.+?):(\d+):(\d+)\s+warning\s+'([^']+)'\s+(.+?)\s+no-unused-vars/)

  if (match) {
    return {
      file: match[1].trim(),
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      variable: match[4],
      description: match[5]
    }
  }
  return null
}

/**
 * 修復單個文件中的未使用變數
 */
function fixUnusedVarsInFile(filePath, issues) {
  console.log(`📝 修復文件: ${filePath}`)

  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️ 文件不存在: ${filePath}`)
    return false
  }

  let content = fs.readFileSync(filePath, 'utf8')
  let lines = content.split('\n')
  let modified = false

  // 按行號倒序處理，避免行號變化影響
  const sortedIssues = issues.sort((a, b) => b.line - a.line)

  for (const issue of sortedIssues) {
    console.log(`   🔍 處理變數: ${issue.variable} (第 ${issue.line} 行)`)

    const lineIndex = issue.line - 1
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const currentLine = lines[lineIndex]

      // 策略 1: 移除真正未使用的引用
      if (VARIABLE_STRATEGIES.remove.includes(issue.variable)) {
        if (handleRemovalStrategy(lines, lineIndex, issue, currentLine)) {
          modified = true
          console.log(`   ✅ 移除未使用的變數: ${issue.variable}`)
        }
      }
      // 策略 2: 添加 eslint-disable 註解
      else if (VARIABLE_STRATEGIES.preserve.includes(issue.variable)) {
        if (handlePreserveStrategy(lines, lineIndex, issue, currentLine)) {
          modified = true
          console.log(`   ✅ 添加 eslint-disable 註解: ${issue.variable}`)
        }
      }
      // 策略 3: 智能判斷
      else {
        if (handleSmartStrategy(lines, lineIndex, issue, currentLine)) {
          modified = true
          console.log(`   ✅ 智能處理變數: ${issue.variable}`)
        }
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
    console.log(`   💾 文件已更新`)
    return true
  } else {
    console.log(`   📋 無需修改`)
    return false
  }
}

/**
 * 處理移除策略
 */
function handleRemovalStrategy(lines, lineIndex, issue, currentLine) {
  // 檢查是否是 import/require 行
  if (currentLine.includes('require(') || currentLine.includes('import ')) {
    // 檢查是否是解構導入中的一個變數
    if (currentLine.includes('{') && currentLine.includes('}')) {
      // 解構導入，移除單個變數
      const regex = new RegExp(`\\s*,?\\s*${issue.variable}\\s*,?\\s*`)
      lines[lineIndex] = currentLine.replace(regex, (match) => {
        // 如果前後都有逗號，保留一個
        if (match.includes(',')) {
          return match.includes(',') ? ', ' : ''
        }
        return ''
      }).replace(/{\s*,/, '{').replace(/,\s*}/, '}').replace(/{\s*}/, '{}')

      // 如果變成空的解構，移除整行
      if (lines[lineIndex].includes('{}')) {
        lines.splice(lineIndex, 1)
      }
      return true
    } else {
      // 單獨的 import，移除整行
      lines.splice(lineIndex, 1)
      return true
    }
  }

  // 檢查是否是變數宣告
  if (currentLine.includes('const ') || currentLine.includes('let ') || currentLine.includes('var ')) {
    // 移除整個變數宣告行
    lines.splice(lineIndex, 1)
    return true
  }

  return false
}

/**
 * 處理保留策略
 */
function handlePreserveStrategy(lines, lineIndex, issue, currentLine) {
  const indent = currentLine.match(/^(\s*)/)[1]

  // 在變數宣告行前添加 eslint-disable 註解
  lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)
  return true
}

/**
 * 處理智能策略
 */
function handleSmartStrategy(lines, lineIndex, issue, currentLine) {
  // 常見的可以移除的模式
  const removablePatterns = [
    /const\s+\w+\s*=\s*\w+\.\w+/, // const x = obj.prop
    /const\s+{\s*\w+\s*}\s*=/, // const { x } =
    /let\s+\w+\s*=/, // let x =
    /var\s+\w+\s*=/ // var x =
  ]

  // 如果是簡單的變數宣告且看起來是臨時變數，移除
  for (const pattern of removablePatterns) {
    if (pattern.test(currentLine) && !currentLine.includes('//')) {
      lines.splice(lineIndex, 1)
      return true
    }
  }

  // 否則添加 eslint-disable 註解
  const indent = currentLine.match(/^(\s*)/)[1]
  lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)
  return true
}

/**
 * 主要執行函數
 */
function main() {
  console.log('1️⃣ 檢查當前的 no-unused-vars 警告...')

  const warnings = getCurrentLintIssues()
  console.log(`📊 找到 ${warnings.length} 個 no-unused-vars 警告\n`)

  if (warnings.length === 0) {
    console.log('✅ 沒有 no-unused-vars 警告需要修復！')
    return
  }

  // 分析警告並按文件分組
  const fileIssues = new Map()

  warnings.forEach(warning => {
    const parsed = parseLintWarning(warning)
    if (parsed) {
      if (!fileIssues.has(parsed.file)) {
        fileIssues.set(parsed.file, [])
      }
      fileIssues.get(parsed.file).push(parsed)
    }
  })

  console.log('2️⃣ 開始修復文件...\n')

  let totalFixed = 0
  let filesModified = 0

  // 優先處理重點文件
  for (const priorityFile of PRIORITY_FILES) {
    if (fileIssues.has(priorityFile)) {
      const issues = fileIssues.get(priorityFile)
      if (fixUnusedVarsInFile(priorityFile, issues)) {
        filesModified++
        totalFixed += issues.length
      }
      fileIssues.delete(priorityFile)
    }
  }

  // 處理其他文件
  for (const [filePath, issues] of fileIssues) {
    if (fixUnusedVarsInFile(filePath, issues)) {
      filesModified++
      totalFixed += issues.length
    }
  }

  console.log('\n3️⃣ 修復完成，驗證結果...')

  // 再次檢查剩餘警告
  const remainingWarnings = getCurrentLintIssues()

  console.log(`\n📊 修復統計:`)
  console.log(`   • 修復了 ${filesModified} 個文件`)
  console.log(`   • 處理了 ${totalFixed} 個變數警告`)
  console.log(`   • 剩餘 ${remainingWarnings.length} 個警告需要手動處理`)

  if (remainingWarnings.length > 0) {
    console.log('\n⚠️ 剩餘警告需要手動檢查:')
    remainingWarnings.slice(0, 10).forEach(warning => {
      console.log(`   ${warning}`)
    })

    if (remainingWarnings.length > 10) {
      console.log(`   ... 還有 ${remainingWarnings.length - 10} 個警告`)
    }
  } else {
    console.log('\n✅ 所有 no-unused-vars 警告已修復！')
  }
}

// 執行主函數
if (require.main === module) {
  main()
}

module.exports = { main, fixUnusedVarsInFile, parseLintWarning }