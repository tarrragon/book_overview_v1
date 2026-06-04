#!/usr/bin/env node

/**
 * 大規模路徑語意化修復工具
 * 專門處理深層相對路徑轉換為 src/ 語意路徑
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// 路徑修復配置
const BATCH_CONFIG = {
  // Batch 1: Interface 測試檔案
  batch1: [
    'tests/unit/background/domains/data-management/interfaces/IDataQualityAnalyzer.test.js',
    'tests/unit/background/domains/data-management/interfaces/IValidationCacheManager.test.js',
    'tests/unit/background/domains/data-management/interfaces/IValidationServiceCoordinator.test.js',
    'tests/unit/background/domains/data-management/interfaces/IPlatformRuleManager.test.js',
    'tests/unit/background/domains/data-management/interfaces/IValidationBatchProcessor.test.js'
  ],

  // Batch 2: Service 測試檔案
  batch2: [
    'tests/unit/background/domains/data-management/services/data-validation-service-integration.test.js',
    'tests/unit/background/domains/data-management/services/data-validation-service-complete-integration.test.js',
    'tests/unit/background/domains/data-management/services/data-validation-service-refactor.test.js',
    'tests/unit/background/domains/data-management/services/readmoo-data-consistency-service.test.js',
    'tests/unit/background/domains/data-management/services/cache-management-service.test.js',
    'tests/unit/background/domains/data-management/services/batch-validation-processor.test.js',
    'tests/unit/background/domains/data-management/services/data-normalization-service.test.js',
    'tests/unit/background/domains/data-management/services/data-difference-engine.test.js',
    'tests/unit/background/domains/data-management/services/DataComparisonEngine.test.js',
    'tests/unit/background/domains/data-management/services/ConflictDetectionService.test.js',
    'tests/unit/background/domains/data-management/services/RetryCoordinator.test.js',
    'tests/unit/background/domains/data-management/services/quality-assessment-service.test.js'
  ],

  // Batch 3: 整合測試與腳本
  batch3: [
    'tests/integration/error-handling/basic-integration.test.js',
    'scripts/test-path-fix.sh'
  ]
}

function fixFilePaths (filePath) {
  const fullPath = path.join(__dirname, '..', filePath)

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  檔案不存在: ${filePath}`)
    return { success: false, modified: false }
  }

  let content = fs.readFileSync(fullPath, 'utf8')
  let modified = false
  const changes = []

  // 使用正規表達式搜尋並替換深層相對路徑
  const deepPathRegex = /require\('((?:\.\.\/){2,}.*?)'\)/g

  content = content.replace(deepPathRegex, (match, relativePath) => {
    // 移除所有 ../ 前綴，找到實際的 src 路徑
    const cleanPath = relativePath.replace(/^(\.\.\/)+/, '')

    // 確保路徑以 src/ 開頭
    let newPath
    if (cleanPath.startsWith('src/')) {
      newPath = cleanPath
    } else {
      newPath = `src/${cleanPath}`
    }

    const newRequire = `require('${newPath}')`

    if (match !== newRequire) {
      changes.push({ from: match, to: newRequire })
      modified = true
      return newRequire
    }

    return match
  })

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8')
    console.log(`✅ 修復 ${filePath}:`)
    changes.forEach(change => {
      console.log(`   ${change.from} → ${change.to}`)
    })
  }

  return { success: true, modified, changes: changes.length }
}

function runTestsForBatch (batchName, files) {
  console.log(`\n🧪 執行 ${batchName} 測試驗證...`)

  try {
    // 執行特定檔案的測試
    files.forEach(file => {
      if (file.endsWith('.test.js')) {
        console.log(`   測試: ${file}`)
        execSync(`npx jest "${file}" --verbose`, {
          stdio: 'pipe',
          cwd: path.join(__dirname, '..')
        })
      }
    })

    console.log(`✅ ${batchName} 測試通過`)
    return true
  } catch (error) {
    console.error(`❌ ${batchName} 測試失敗:`)
    console.error(error.message)
    return false
  }
}

function processBatch (batchName, files) {
  console.log(`\n📦 處理 ${batchName} (${files.length} 個檔案)`)
  console.log('='.repeat(50))

  let processedCount = 0
  let modifiedCount = 0
  let totalChanges = 0

  // 處理檔案
  for (const file of files) {
    const result = fixFilePaths(file)
    processedCount++

    if (result.modified) {
      modifiedCount++
      totalChanges += result.changes || 0
    }
  }

  console.log(`\n📊 ${batchName} 處理結果:`)
  console.log(`   處理檔案: ${processedCount}`)
  console.log(`   修復檔案: ${modifiedCount}`)
  console.log(`   總變更數: ${totalChanges}`)

  // 執行測試驗證
  const testsPassed = runTestsForBatch(batchName, files)

  return {
    batchName,
    processed: processedCount,
    modified: modifiedCount,
    changes: totalChanges,
    testsPassed
  }
}

function main () {
  console.log('🚀 大規模路徑語意化修復工具')
  console.log('Target: 將深層相對路徑轉換為 src/ 語意路徑\n')

  const results = []

  // 執行批次處理
  for (const [batchName, files] of Object.entries(BATCH_CONFIG)) {
    const result = processBatch(batchName, files)
    results.push(result)

    if (!result.testsPassed) {
      console.error(`\n❌ ${batchName} 測試失敗，停止執行`)
      console.error('請檢查修復結果並手動解決問題')
      process.exit(1)
    }

    // 批次間的間隔
    console.log('\n⏸️  批次完成，按 Enter 繼續下一批次...')
    // process.stdin.setRawMode(true);
    // process.stdin.resume();
    // process.stdin.on('data', () => process.stdin.pause());
  }

  // 總結報告
  console.log('\n' + '='.repeat(60))
  console.log('🎉 大規模路徑修復完成總結')
  console.log('='.repeat(60))

  let totalProcessed = 0
  let totalModified = 0
  let totalChanges = 0

  results.forEach(result => {
    console.log(`${result.batchName}: ${result.modified}/${result.processed} 檔案修復 (${result.changes} 變更)`)
    totalProcessed += result.processed
    totalModified += result.modified
    totalChanges += result.changes
  })

  console.log('\n📈 總計:')
  console.log(`   處理檔案: ${totalProcessed}`)
  console.log(`   修復檔案: ${totalModified}`)
  console.log(`   總變更數: ${totalChanges}`)
  console.log(`   成功率: ${((totalModified / totalProcessed) * 100).toFixed(1)}%`)

  // 最終測試
  console.log('\n🧪 執行完整測試套件驗證...')
  try {
    execSync('npm test', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    })
    console.log('\n✅ 所有測試通過！路徑修復成功完成。')
  } catch (error) {
    console.error('\n❌ 最終測試失敗，需要檢查和修復')
  }
}

if (require.main === module) {
  main()
}

module.exports = { fixFilePaths, processBatch }
