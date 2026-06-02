#!/usr/bin/env node
/* eslint-disable no-console -- CLI 工具腳本，console 為進度回報必要輸出 */
/**
 * src/ 全專案 emoji 移除與 ASCII 前綴替換腳本（0.19.1-W1-005.2）
 *
 * 依據父 ticket W1-005 ANA AC-2 替換決策表：
 * - 12 語意前綴 emoji → [KEYWORD] 格式（含契約 📍→[DETECT]、❌→[FAIL] 自動對齊 §3.4）
 * - 🔄（94 處）→ 重試語境 [RETRY]，其餘處理/系統/載入/恢復語境純移除
 * - 66 純裝飾 emoji → 直接移除
 *
 * 範圍補充（W1-005.2 執行期發現，超出 AC-2 表與 acceptance grep 兩範圍）：
 * AC-2 表與 acceptance grep 僅涵蓋 U+1F000-1FFFF 與 U+2600-27BF 兩範圍，
 * 但 src/ 另含 U+2139-25B6 區段 9 種 emoji（▶️⏹️⏸️⏭️⏰⏳⏱️ℹ️⌨️），語意同屬
 * 啟動/停止/暫停/跳過/定時/等待/計時/資訊/鍵盤，依既有 keyword 慣例一併替換，
 * 避免「acceptance 綠燈但仍殘留 emoji + 孤立 FE0F selector」違反 language-constraints 規則 3。
 *
 * 處理機制：
 * - 每個 emoji 後可能跟隨 U+FE0F variation selector（336 處），一併消費
 * - 語意前綴：emoji[+FE0F][+spaces] → "[KEYWORD] "（統一一個空格）
 * - 純裝飾：emoji[+FE0F][+spaces] → ""（連同尾隨空格移除，避免雙空格）
 *
 * 用法：
 *   node scripts/remove-emoji.js <dir>      # apply 到指定目錄
 *   node scripts/remove-emoji.js src        # 全量 apply
 */

'use strict'

const fs = require('fs')
const path = require('path')

const FE0F = '\\uFE0F'

// AC-2 語意前綴映射（emoji → [KEYWORD]）
const SEMANTIC = {
  '✅': '[OK]', // ✅ 423
  '❌': '[FAIL]', // ❌ 514（含契約 失敗: 對齊）
  '⚠': '[WARN]', // ⚠ 229
  '\u{1F50D}': '[CHECK]', // 🔍 39
  '\u{1F680}': '[START]', // 🚀 54
  '\u{1F6D1}': '[STOP]', // 🛑 27
  '\u{1F527}': '[FIX]', // 🔧 35
  '\u{1F4CA}': '[STATS]', // 📊 52
  '\u{1F4DD}': '[LOG]', // 📝 27
  '\u{1F4BE}': '[SAVE]', // 💾 16
  '\u{1F6A8}': '[ALERT]', // 🚨 16
  '\u{1F4CD}': '[DETECT]', // 📍 1（契約 頁面檢測: 對齊 §3.4）
  // 範圍補充：U+2139-25B6 區段語意前綴（執行期發現）
  '\u{25B6}': '[START]', // ▶️ 啟動（同 🚀 慣例）
  '\u{23F9}': '[STOP]', // ⏹️ 停止（同 🛑 慣例）
  '\u{23F8}': '[PAUSE]', // ⏸️ 暫停
  '\u{23ED}': '[SKIP]', // ⏭️ 跳過
  '\u{23F0}': '[TIMER]', // ⏰ 定時
  '\u{23F3}': '[WAIT]', // ⏳ 等待
  '\u{23F1}': '[TIME]', // ⏱️ 計時
  ℹ: '[INFO]' // ℹ️ 資訊
}

// 純裝飾 emoji 清單（L190）+ 🎯（AC-2 標註純移除）
const DECORATION = [
  '\u{1F9F9}', '\u{1F3A8}', '\u{1F4CB}', '\u{1F4DA}', '⚡', '\u{1F4C8}',
  '\u{1F4A5}', '\u{1F3D7}', '\u{1F6AB}', '\u{1F5D1}', '\u{1F4E4}', '\u{1F4E5}',
  '\u{1F4E2}', '\u{1F4DC}', '\u{1F4C2}', '\u{1F4A1}', '\u{1F6E1}', '\u{1F4E8}',
  '\u{1F389}', '\u{1F5BC}', '\u{1F512}', '\u{1F510}', '\u{1F4F1}', '\u{1F4C1}',
  '\u{1F441}', '\u{1F3F7}', '\u{1F916}', '\u{1F6E0}', '\u{1F5C2}', '\u{1F50C}',
  '\u{1F503}', '\u{1F4E1}', '\u{1F3AD}', '\u{1F3AA}', '❓', '⚖',
  '⚕', '\u{1FA7A}', '\u{1F9FE}', '\u{1F9E9}', '\u{1F9E0}', '\u{1F507}',
  '\u{1F4F6}', '\u{1F4CF}', '\u{1F4C5}', '\u{1F4C4}', '\u{1F4AC}', '\u{1F480}',
  '\u{1F41B}', '\u{1F3E2}', '\u{1F3C1}', '\u{1F3AC}', '\u{1F3A7}', '\u{1F39B}',
  '\u{1F309}', '\u{1F195}', '✨', '♿', '\u{1F9ED}', '\u{1F493}',
  '\u{1F310}', '\u{1F4E6}', '\u{1F4D6}', '\u{1F517}', '⚙', '\u{1F3AF}',
  '\u{2328}' // ⌨️ 鍵盤（icon 裝飾，純移除）
]

const RETRY_EMOJI = '\u{1F504}' // 🔄

// 重試語境判定關鍵字（出現在同一行 → [RETRY]，否則純移除）
const RETRY_KEYWORDS = ['重試', '重新嘗試', '重新加入佇列', '重新連接', 'retry', 'RETRY', 'Retry']

function isRetryLine (line) {
  return RETRY_KEYWORDS.some((kw) => line.includes(kw))
}

// UI 狀態指示符語境：`status === 'running' ? '🔄' : ...` 中 🔄 代表執行中狀態標籤，
// 非 log 前綴，應替換為 [RUNNING] 而非移除（移除會留空字串使狀態標籤消失）。
function isRunningStatusLine (line) {
  return line.includes("status === 'running'") && line.includes('?')
}

// 建構替換 regex：emoji + 可選 FE0F + 可選空格
function semanticPattern (emoji) {
  return new RegExp(`${escapeForRegex(emoji)}${FE0F}?[ \\t]*`, 'gu')
}
function decorationPattern (emoji) {
  return new RegExp(`${escapeForRegex(emoji)}${FE0F}?[ \\t]*`, 'gu')
}
function escapeForRegex (s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function transformContent (content) {
  // 1. 語意前綴：emoji[+FE0F][+spaces] → "[KEYWORD] "
  let out = content
  for (const [emoji, keyword] of Object.entries(SEMANTIC)) {
    out = out.replace(semanticPattern(emoji), `${keyword} `)
  }

  // 2. 🔄 依行語境處理（逐行）
  if (out.includes(RETRY_EMOJI)) {
    out = out
      .split('\n')
      .map((line) => {
        if (!line.includes(RETRY_EMOJI)) return line
        const retryRe = new RegExp(`${escapeForRegex(RETRY_EMOJI)}${FE0F}?[ \\t]*`, 'gu')
        if (isRunningStatusLine(line)) {
          // UI 狀態標籤：保留為 [RUNNING]（無尾隨空格，因位於字串字面內）
          return line.replace(new RegExp(`${escapeForRegex(RETRY_EMOJI)}${FE0F}?`, 'gu'), '[RUNNING]')
        }
        if (isRetryLine(line)) {
          return line.replace(retryRe, '[RETRY] ')
        }
        return line.replace(retryRe, '')
      })
      .join('\n')
  }

  // 3. 純裝飾：emoji[+FE0F][+spaces] → ""
  for (const emoji of DECORATION) {
    out = out.replace(decorationPattern(emoji), '')
  }

  return out
}

function walk (dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fp, files)
    } else if (entry.isFile()) {
      files.push(fp)
    }
  }
}

function main () {
  const target = process.argv[2]
  if (!target) {
    console.error('用法: node scripts/remove-emoji.js <dir|file>')
    process.exit(1)
  }

  const stat = fs.statSync(target)
  const files = []
  if (stat.isDirectory()) {
    walk(target, files)
  } else {
    files.push(target)
  }

  let changedFiles = 0
  let totalFiles = 0
  for (const fp of files) {
    totalFiles += 1
    const original = fs.readFileSync(fp, 'utf8')
    const transformed = transformContent(original)
    if (transformed !== original) {
      fs.writeFileSync(fp, transformed, 'utf8')
      changedFiles += 1
      console.log(`  modified: ${fp}`)
    }
  }
  console.log(`\n掃描 ${totalFiles} 檔，修改 ${changedFiles} 檔（target: ${target}）`)
}

main()
