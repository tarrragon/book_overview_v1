/**
 * w4-006-popup-launch-spike.js — Puppeteer popup launch 技術可行性 spike
 *
 * 目的：
 *   驗證 W1-008 Phase 3b 偏差 2 描述的 popup 環境限制是否仍成立，並對三個候選
 *   方案進行 prototype 驗證，輸出證據驅動的方案選擇。
 *
 * 驗證項目：
 *   A. 重現 W1-008 既有問題：page.goto('chrome-extension://<id>/src/popup/popup.html')
 *      在 Puppeteer 環境下開為「獨立分頁」，popup 內 chrome.tabs.query({active:true,
 *      currentWindow:true}) 會把 popup 自身視為 active tab，導致 isReadmoo=false、
 *      #extractBtn 保持 disabled。
 *
 *   B. 探索方案 1（真實 popup overlay）：嘗試以 SW 呼叫 chrome.action.openPopup()
 *      或其他 Puppeteer API 觸發真實 popup overlay。記錄成功/失敗與限制。
 *
 *   C. 探索方案 3 變體（先導航 fixture，再開 popup 同 window）：在 fixture 分頁存在
 *      且為 active 之下，新開 popup 分頁是否仍會把 popup 自身視為 active？
 *
 * 設計考量：
 *   - 不修改任何 src/、tests/；spike 結果寫入 ticket md
 *   - 採 headed 模式（Chrome Manifest V3 限制）
 *   - 使用既有的 build/development 路徑載入 extension
 *
 * 執行方式：
 *   node scripts/experiments/w4-006-popup-launch-spike.js
 *
 * 預期輸出：
 *   - stdout 列印每個驗證項目的結果（pass/fail + 證據摘要）
 *   - 不寫入任何持久檔案
 */

const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')

const EXTENSION_PATH = path.resolve(__dirname, '../../build/development')
const FIXTURE_HTML_PATH = path.resolve(__dirname, '../../tests/e2e/fixtures/readmoo-mock-page.html')
const FIXTURE_URL = 'https://readmoo.com/library'

// 偵測 Chrome 路徑（複用 extension-setup.js 邏輯）
function resolveChromePath () {
  const SYSTEM_CHROME_PATHS = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ]
  try {
    puppeteer.executablePath()
    return undefined
  } catch {
    // fall through to system Chrome
  }
  for (const p of SYSTEM_CHROME_PATHS) {
    if (fs.existsSync(p)) return p
  }
  return undefined
}

async function getExtensionId (browser) {
  const targets = browser.targets()
  for (const t of targets) {
    if (t.type() === 'service_worker' && t.url().startsWith('chrome-extension://')) {
      return t.url().split('/')[2]
    }
  }
  // polling 等候 SW 註冊
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const t of browser.targets()) {
      if (t.type() === 'service_worker' && t.url().startsWith('chrome-extension://')) {
        return t.url().split('/')[2]
      }
    }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('Service Worker target 未在 30s 內出現')
}

async function getServiceWorker (browser) {
  for (const t of browser.targets()) {
    if (t.type() === 'service_worker' && t.url().startsWith('chrome-extension://')) {
      return await t.worker()
    }
  }
  throw new Error('SW target 不存在')
}

async function setupReadmooInterception (page) {
  const fixtureHtml = fs.readFileSync(FIXTURE_HTML_PATH, 'utf8')
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = req.url()
    if (url.startsWith(FIXTURE_URL)) {
      req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fixtureHtml })
    } else if (url.startsWith('https://readmoo.com') || url.startsWith('http://readmoo.com')) {
      req.respond({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html><body></body></html>' })
    } else {
      req.continue()
    }
  })
}

async function launchBrowser () {
  const chromePath = resolveChromePath()
  const launchOptions = {
    headless: false,
    devtools: false,
    protocolTimeout: 120000,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  }
  if (chromePath) launchOptions.executablePath = chromePath
  return await puppeteer.launch(launchOptions)
}

async function probeA_reproduceKnownIssue (browser, extensionId) {
  console.log('\n=== 驗證 A：重現 W1-008 既有問題（page.goto popup 為獨立分頁） ===')
  const popupPage = await browser.newPage()
  const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`
  try {
    await popupPage.goto(popupUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
    // 等 popup script 跑完 init
    await new Promise(r => setTimeout(r, 2000))

    // 讀 popup 自身的 active tab 判定結果
    const result = await popupPage.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const extractBtn = document.getElementById('extractBtn')
      return {
        activeTabUrl: tab ? tab.url : null,
        extractBtnDisabled: extractBtn ? extractBtn.disabled : null,
        pageInfoText: document.getElementById('pageInfo')?.textContent
      }
    })

    console.log('  active tab URL:', result.activeTabUrl)
    console.log('  extractBtn.disabled:', result.extractBtnDisabled)
    console.log('  pageInfo:', result.pageInfoText)

    const reproduced = result.activeTabUrl && result.activeTabUrl.startsWith('chrome-extension://') && result.extractBtnDisabled === true
    console.log('  [A 結論]', reproduced ? '已重現問題（popup 自身為 active tab）' : '問題未重現（active tab 非 popup）')
    return { probe: 'A', reproduced, evidence: result }
  } finally {
    await popupPage.close()
  }
}

async function probeB_chromeActionOpenPopup (browser, extensionId) {
  console.log('\n=== 驗證 B：嘗試 SW 呼叫 chrome.action.openPopup() ===')
  const worker = await getServiceWorker(browser)
  const result = await worker.evaluate(async () => {
    if (!chrome.action || typeof chrome.action.openPopup !== 'function') {
      return { available: false, error: 'chrome.action.openPopup 不存在' }
    }
    try {
      await chrome.action.openPopup()
      return { available: true, called: true, error: null }
    } catch (e) {
      return { available: true, called: false, error: e.message }
    }
  })
  console.log('  chrome.action.openPopup 可用:', result.available)
  console.log('  呼叫結果:', result.called ? 'success' : `failed (${result.error})`)
  console.log('  [B 結論]', result.called ? '成功觸發（待人工確認 popup 是否真實顯示）' : 'SW 無法直接觸發真實 popup overlay')
  return { probe: 'B', success: result.called, evidence: result }
}

async function probeC_fixtureFirstThenPopup (browser, extensionId) {
  console.log('\n=== 驗證 C：先導航 fixture 再開 popup（方案 3 變體） ===')
  // 1. 開 fixture 分頁
  const fixturePage = await browser.newPage()
  await setupReadmooInterception(fixturePage)
  await fixturePage.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await new Promise(r => setTimeout(r, 1500)) // 等 content script 注入

  // 2. 新分頁開 popup
  const popupPage = await browser.newPage()
  const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`
  try {
    await popupPage.goto(popupUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await new Promise(r => setTimeout(r, 2000))

    const result = await popupPage.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const tabsAll = await chrome.tabs.query({ currentWindow: true })
      const extractBtn = document.getElementById('extractBtn')
      return {
        activeTabUrl: tab ? tab.url : null,
        allTabsUrls: tabsAll.map(t => t.url),
        extractBtnDisabled: extractBtn ? extractBtn.disabled : null
      }
    })

    console.log('  active tab URL:', result.activeTabUrl)
    console.log('  all tabs:', result.allTabsUrls)
    console.log('  extractBtn.disabled:', result.extractBtnDisabled)
    const stillBrokenSame = result.activeTabUrl && result.activeTabUrl.startsWith('chrome-extension://') && result.extractBtnDisabled === true
    console.log('  [C 結論]', stillBrokenSame ? '問題仍存在（popup tab 變 active 把自己當 active tab）' : '可能解決（active tab 為 readmoo）')
    return { probe: 'C', success: !stillBrokenSame, evidence: result }
  } finally {
    await popupPage.close()
    await fixturePage.close()
  }
}

async function main () {
  const browser = await launchBrowser()
  const results = []
  try {
    const extensionId = await getExtensionId(browser)
    console.log('Extension ID:', extensionId)

    results.push(await probeA_reproduceKnownIssue(browser, extensionId))
    results.push(await probeB_chromeActionOpenPopup(browser, extensionId))
    results.push(await probeC_fixtureFirstThenPopup(browser, extensionId))

    console.log('\n=== Spike 結論摘要 ===')
    for (const r of results) {
      const status = (r.probe === 'A' && r.reproduced) || (r.probe !== 'A' && r.success) ? 'YES' : 'NO'
      console.log(`  Probe ${r.probe}: ${status}`)
    }
  } catch (e) {
    console.error('Spike 失敗:', e)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
