/**
 * w4-006-popup-launch-spike-v7.js — 驗證 popup init 是否完成（含 click handler）
 *
 * v6 揭露 popup 在 Puppeteer 環境下有 pageerror：
 *   - "Identifier 'Logger' has already been declared"
 *   - "PopupInitializationTracker is not defined"
 *
 * 根因推測：popup-error-handler.js + popup-diagnostic-enhancer.js + popup.js
 * 都 declared `const Logger`，在 Puppeteer 載入時 script 執行順序或快取狀態
 * 可能造成重複宣告。Logger 已宣告會中斷該檔案後續執行，導致 popup.js
 * 的 init() 永遠不會跑到，setupEventListeners() 也不會被呼叫，click 無人處理。
 *
 * v7 驗證：
 *   - 確認 extractBtn 是否有 click event listener
 *   - 確認 startExtraction 函式是否存在於 popup 全域
 */

const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')

const EXTENSION_PATH = path.resolve(__dirname, '../../build/development')

function resolveChromePath () {
  const PATHS = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ]
  try { puppeteer.executablePath(); return undefined } catch { /* noop */ }
  for (const p of PATHS) if (fs.existsSync(p)) return p
  return undefined
}

async function launchBrowser () {
  const chromePath = resolveChromePath()
  const opts = {
    headless: false, devtools: false, protocolTimeout: 180000,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'
    ]
  }
  if (chromePath) opts.executablePath = chromePath
  return await puppeteer.launch(opts)
}

async function getExtensionId (browser) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const t of browser.targets()) {
      if (t.type() === 'service_worker' && t.url().startsWith('chrome-extension://')) {
        return t.url().split('/')[2]
      }
    }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('SW timeout')
}

async function main () {
  const browser = await launchBrowser()
  try {
    const extensionId = await getExtensionId(browser)
    const popupPage = await browser.newPage()

    const errors = []
    popupPage.on('pageerror', e => errors.push(e.message))

    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`,
      { waitUntil: 'domcontentloaded', timeout: 15000 })
    await new Promise(r => setTimeout(r, 2000))

    const state = await popupPage.evaluate(() => ({
      hasStartExtraction: typeof window.startExtraction === 'function',
      hasCheckCurrentTab: typeof window.checkCurrentTab === 'function',
      hasLogger: typeof window.Logger,
      extractBtnExists: !!document.getElementById('extractBtn'),
      // 取得綁定的 listener 數量（透過 getEventListeners chrome devtools API）
      // 但 getEventListeners 只在 DevTools console 可用，這裡用 alternative
      btnOnclick: document.getElementById('extractBtn')?.onclick !== null
    }))

    console.log('Popup 初始化狀態:', state)
    console.log('Page errors:', errors)
  } catch (e) {
    console.error('Spike v7 失敗:', e)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
