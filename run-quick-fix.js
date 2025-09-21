#!/usr/bin/env node

/**
 * 執行快速 unused vars 修復
 */

const { exec } = require('child_process')

console.log('🚀 執行快速 unused vars 修復...\n')

// 先檢查當前狀態
console.log('🔍 檢查修復前狀態...')
exec('node quick-test-unused-vars-fix.js', (error, stdout, stderr) => {
  if (error) {
    console.error('修復過程出錯:', error)
    return
  }

  console.log(stdout)
  if (stderr) console.error(stderr)

  console.log('\n🔍 檢查修復後的 lint 狀態...')
  exec('npx eslint tests/ --format=stylish 2>/dev/null | grep "no-unused-vars" | wc -l', (error, stdout, stderr) => {
    if (!error) {
      const count = parseInt(stdout.trim(), 10)
      console.log(`📊 測試文件剩餘 no-unused-vars warnings: ${count}`)

      if (count < 20) {
        console.log('🎉 測試文件 warnings 已大幅減少！')
      }
    }

    console.log('\n🔄 檢查 src 文件狀態...')
    exec('npx eslint src/ --format=stylish 2>/dev/null | grep "no-unused-vars" | wc -l', (error, stdout, stderr) => {
      if (!error) {
        const count = parseInt(stdout.trim(), 10)
        console.log(`📊 src 文件剩餘 no-unused-vars warnings: ${count}`)
      }

      console.log('\n✅ 快速修復執行完成！')
    })
  })
})