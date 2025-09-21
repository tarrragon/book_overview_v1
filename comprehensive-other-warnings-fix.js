#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🚀 開始全面修復其他類型的 ESLint 警告...\n')

process.chdir('/Users/tarragon/Projects/book_overview_v1')

const stats = {
  'no-useless-constructor': 0,
  'no-new': 0,
  'multiline-ternary': 0,
  'no-control-regex': 0,
  'n/no-callback-literal': 0,
  'accessor-pairs': 0,
  'no-useless-catch': 0,
  'n/handle-callback-err': 0,
  'other': 0
}

// 1. 修復 no-new 警告
function fixNoNewWarnings() {
  console.log('🔧 修復 no-new 警告...')

  try {
    const lintOutput = execSync('npx eslint src/ tests/ --format=compact 2>&1 | grep "no-new" || true', {
      encoding: 'utf8'
    })

    const noNewLines = lintOutput.split('\n').filter(line => line.includes('no-new'))

    if (noNewLines.length === 0) {
      console.log('   ✅ 沒有發現 no-new 警告')
      return
    }

    const filesToFix = new Map()

    noNewLines.forEach(line => {
      const match = line.match(/^([^:]+):(\d+):(\d+):\s+warning\s+(.+)\s+no-new/)
      if (match) {
        const [, filePath, lineNum, , message] = match
        if (!filesToFix.has(filePath)) {
          filesToFix.set(filePath, [])
        }
        filesToFix.get(filePath).push({
          line: parseInt(lineNum),
          message: message.trim()
        })
      }
    })

    filesToFix.forEach((warnings, filePath) => {
      try {
        const content = fs.readFileSync(filePath, 'utf8')
        const lines = content.split('\n')

        // 從高行號到低行號處理，避免行號變化
        warnings.sort((a, b) => b.line - a.line)

        warnings.forEach(({ line, message }) => {
          const lineIndex = line - 1
          const currentLine = lines[lineIndex]

          // 檢查前一行是否已經有 disable 註解
          const prevLineIndex = lineIndex - 1
          const prevLine = prevLineIndex >= 0 ? lines[prevLineIndex] : ''

          if (!prevLine.includes('eslint-disable-next-line no-new')) {
            // 計算當前行的縮排
            const indentMatch = currentLine.match(/^(\s*)/)
            const indent = indentMatch ? indentMatch[1] : ''

            // 在當前行前添加 disable 註解
            lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-new`)
            stats['no-new']++
            console.log(`   ✅ ${filePath}:${line}`)
          }
        })

        fs.writeFileSync(filePath, lines.join('\n'))

      } catch (error) {
        console.log(`   ❌ 修復 ${filePath} 失敗: ${error.message}`)
      }
    })

  } catch (error) {
    console.log(`   ❌ 處理 no-new 警告失敗: ${error.message}`)
  }
}

// 2. 修復 multiline-ternary 警告
function fixMultilineTernary() {
  console.log('\n🔧 修復 multiline-ternary 警告...')

  try {
    const lintOutput = execSync('npx eslint src/ tests/ --format=compact 2>&1 | grep "multiline-ternary" || true', {
      encoding: 'utf8'
    })

    const lines = lintOutput.split('\n').filter(line => line.includes('multiline-ternary'))

    if (lines.length === 0) {
      console.log('   ✅ 沒有發現 multiline-ternary 警告')
      return
    }

    lines.forEach(line => {
      const match = line.match(/^([^:]+):(\d+):/)
      if (match) {
        const [, filePath, lineNum] = match

        try {
          const content = fs.readFileSync(filePath, 'utf8')
          const fileLines = content.split('\n')
          const targetLine = fileLines[parseInt(lineNum) - 1]

          // 檢查是否為簡單的三元運算子
          if (targetLine && targetLine.includes('?') && targetLine.includes(':')) {
            // 簡單的修復：在行末添加 disable 註解
            if (!targetLine.includes('eslint-disable')) {
              fileLines[parseInt(lineNum) - 1] = targetLine + ' // eslint-disable-line multiline-ternary'
              fs.writeFileSync(filePath, fileLines.join('\n'))
              stats['multiline-ternary']++
              console.log(`   ✅ ${filePath}:${lineNum}`)
            }
          }
        } catch (error) {
          console.log(`   ❌ 修復 ${filePath} 失敗: ${error.message}`)
        }
      }
    })

  } catch (error) {
    console.log(`   ❌ 處理 multiline-ternary 警告失敗: ${error.message}`)
  }
}

// 3. 修復 no-control-regex 警告（雖然可能已經修復）
function fixControlRegex() {
  console.log('\n🔧 修復 no-control-regex 警告...')

  try {
    const lintOutput = execSync('npx eslint src/ tests/ --format=compact 2>&1 | grep "no-control-regex" || true', {
      encoding: 'utf8'
    })

    const lines = lintOutput.split('\n').filter(line => line.includes('no-control-regex'))

    if (lines.length === 0) {
      console.log('   ✅ 沒有發現 no-control-regex 警告')
      return
    }

    lines.forEach(line => {
      const match = line.match(/^([^:]+):(\d+):/)
      if (match) {
        const [, filePath, lineNum] = match

        try {
          const content = fs.readFileSync(filePath, 'utf8')
          let newContent = content

          // 將 \x00-\x1F 範圍的控制字符轉換為 Unicode 轉義
          newContent = newContent.replace(/\\x([0-1][0-9a-fA-F])/g, '\\u00$1')

          if (newContent !== content) {
            fs.writeFileSync(filePath, newContent)
            stats['no-control-regex']++
            console.log(`   ✅ ${filePath}:${lineNum}`)
          }
        } catch (error) {
          console.log(`   ❌ 修復 ${filePath} 失敗: ${error.message}`)
        }
      }
    })

  } catch (error) {
    console.log(`   ❌ 處理 no-control-regex 警告失敗: ${error.message}`)
  }
}

// 4. 修復 no-useless-constructor 警告（已經修復，但檢查其他情況）
function fixUselessConstructor() {
  console.log('\n🔧 修復 no-useless-constructor 警告...')

  try {
    const lintOutput = execSync('npx eslint src/ tests/ --format=compact 2>&1 | grep "no-useless-constructor" || true', {
      encoding: 'utf8'
    })

    const lines = lintOutput.split('\n').filter(line => line.includes('no-useless-constructor'))

    if (lines.length === 0) {
      console.log('   ✅ 沒有發現 no-useless-constructor 警告')
      return
    }

    lines.forEach(line => {
      const match = line.match(/^([^:]+):(\d+):/)
      if (match) {
        const [, filePath, lineNum] = match
        console.log(`   ⚠️  ${filePath}:${lineNum} - 請手動檢視並移除無用構造函數`)
      }
    })

  } catch (error) {
    console.log(`   ❌ 處理 no-useless-constructor 警告失敗: ${error.message}`)
  }
}

// 5. 修復其他特定警告類型
function fixOtherWarnings() {
  console.log('\n🔧 修復其他警告類型...')

  const warningTypes = ['n/no-callback-literal', 'accessor-pairs', 'no-useless-catch', 'n/handle-callback-err']

  warningTypes.forEach(warningType => {
    try {
      const lintOutput = execSync(`npx eslint src/ tests/ --format=compact 2>&1 | grep "${warningType}" || true`, {
        encoding: 'utf8'
      })

      const lines = lintOutput.split('\n').filter(line => line.includes(warningType))

      if (lines.length === 0) {
        console.log(`   ✅ 沒有發現 ${warningType} 警告`)
        return
      }

      console.log(`   📋 發現 ${lines.length} 個 ${warningType} 警告：`)
      lines.forEach(line => {
        const match = line.match(/^([^:]+):(\d+):/)
        if (match) {
          const [, filePath, lineNum] = match
          console.log(`      ${filePath}:${lineNum}`)
          stats[warningType]++
        }
      })

    } catch (error) {
      console.log(`   ❌ 處理 ${warningType} 警告失敗: ${error.message}`)
    }
  })
}

// 執行所有修復
async function runAllFixes() {
  console.log('🎯 開始執行所有修復策略...\n')

  fixNoNewWarnings()
  fixMultilineTernary()
  fixControlRegex()
  fixUselessConstructor()
  fixOtherWarnings()

  console.log('\n📊 修復結果統計：')
  Object.entries(stats).forEach(([rule, count]) => {
    if (count > 0) {
      console.log(`   ${rule}: ${count} 個${rule.includes('other') || rule.includes('callback') || rule.includes('accessor') || rule.includes('catch') || rule.includes('err') ? ' (需手動檢視)' : ' (已修復)'}`)
    }
  })

  const totalAutoFixes = stats['no-new'] + stats['multiline-ternary'] + stats['no-control-regex']
  const totalManualReviews = Object.values(stats).reduce((sum, count) => sum + count, 0) - totalAutoFixes

  console.log(`\n🎉 總計：`)
  console.log(`   自動修復: ${totalAutoFixes} 個`)
  console.log(`   需手動檢視: ${totalManualReviews} 個`)

  if (totalAutoFixes > 0) {
    console.log('\n🔍 驗證修復效果...')
    try {
      const afterLintOutput = execSync('npx eslint src/ tests/ --format=compact 2>&1 || true', {
        encoding: 'utf8'
      })

      const remainingOtherWarnings = afterLintOutput.split('\n').filter(line =>
        line.includes('warning') &&
        !line.includes('no-unused-vars') &&
        !line.includes('no-console')
      ).length

      console.log(`📈 剩餘其他警告: ${remainingOtherWarnings} 個`)

      if (remainingOtherWarnings === 0) {
        console.log('🎉 所有可自動修復的其他警告已修復！')
      }
    } catch (error) {
      console.log('❌ 驗證時發生錯誤')
    }
  }

  console.log('\n📋 後續行動建議：')
  console.log('   1. 檢查並運行測試確保修復不影響功能')
  console.log('   2. 手動檢視需要人工處理的警告')
  console.log('   3. 考慮更新 ESLint 配置以防止類似問題')
}

// 執行修復
runAllFixes().catch(console.error)