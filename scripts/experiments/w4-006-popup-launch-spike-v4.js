/**
 * w4-006-popup-launch-spike-v4.js — Probe G 最終嘗試：等 click 流程完成
 *
 * v3 失敗根因待釐清：click 發生但 storage 沒有寫入。可能原因：
 *   (1) startExtraction 內部又呼叫 checkCurrentTab，因 popup 觸發 click 那一刻
 *       chrome.tabs.update active=fixture 已生效，但 popup polling setInterval
 *       3 秒會再次呼叫 checkCurrentTab → popup 可能因此重新查詢 active tab，
 *       碰到 race condition
 *   (2) chrome.tabs.sendMessage 在 popup tab 被切換為非 active 後失效
 *
 * v4 驗證：直接呼叫 popup 內暴露的 startExtraction（如果暴露），跳過 click 與
 * polling 的 race condition，純驗證「popup→SW→content script→storage」單向通訊。
 */

const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')

const EXTENSION_PATH = path.resolve(__dirname, '../../build/development')
const FIXTURE_HTML_PATH = path.resolve(__dirname, '../../tests/e2e/fixtures/readmoo-mock-page.html')
const FIXTURE_URL = 'https://readmoo.com/library'

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
    headless: false,
    devtools: false,
    protocolTimeout: 180000,
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

async function getSW (browser) {
  for (const t of browser.targets()) {
    if (t.type() === 'service_worker' && t.url().startsWith('chrome-extension://')) {
      return await t.worker()
    }
  }
  throw new Error('SW not found')
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

async function main () {
  const browser = await launchBrowser()
  try {
    const extensionId = await getExtensionId(browser)
    console.log('Extension ID:', extensionId)
    const sw = await getSW(browser)
    await sw.evaluate(async () => { await chrome.storage.local.remove('readmoo_books') })

    // 1. fixture
    console.log('\n=== Probe G v4：跳過 click，從 popup context 直接 sendMessage ===')
    const fixturePage = await browser.newPage()
    await setupReadmooInterception(fixturePage)
    await fixturePage.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })

    // content script ready
    await (async () => {
      const deadline = Date.now() + 15000
      while (Date.now() < deadline) {
        const r = await sw.evaluate(async () => {
          const tabs = await chrome.tabs.query({})
          const target = tabs.find(t => t.url && t.url.includes('readmoo.com/library'))
          if (!target) return false
          try {
            const resp = await chrome.tabs.sendMessage(target.id, { type: 'PING' })
            return !!(resp && resp.success && resp.ready)
          } catch { return false }
        })
        if (r) return true
        await new Promise(r => setTimeout(r, 500))
      }
      return false
    })()
    console.log('  content script ready: true')

    // 2. popup
    const popupPage = await browser.newPage()
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`,
      { waitUntil: 'domcontentloaded', timeout: 15000 })
    await new Promise(r => setTimeout(r, 1500))

    // 3. popup 內直接呼叫 chrome.tabs.sendMessage（跳過 popup UI button 層 → 與 helpers/extraction-flow.js 既有路徑等價，但發訊者是 popup context 而非 SW）
    const sendResult = await popupPage.evaluate(async () => {
      const all = await chrome.tabs.query({})
      const fixture = all.find(t => t.url && t.url.includes('readmoo.com/library'))
      if (!fixture) return { ok: false, reason: 'fixture not found' }
      try {
        const resp = await chrome.tabs.sendMessage(fixture.id, { type: 'START_EXTRACTION' })
        return { ok: true, resp }
      } catch (e) {
        return { ok: false, reason: e.message }
      }
    })
    console.log('  popup → content script START_EXTRACTION 結果:', JSON.stringify(sendResult))

    // 4. poll storage
    const books = await (async () => {
      const deadline = Date.now() + 30000
      while (Date.now() < deadline) {
        const stored = await sw.evaluate(async () => {
          const r = await chrome.storage.local.get('readmoo_books')
          return r.readmoo_books
        })
        if (stored && Array.isArray(stored.books) && stored.books.length === 5) {
          return stored.books
        }
        await new Promise(r => setTimeout(r, 500))
      }
      return null
    })()

    console.log('  storage:', books ? `${books.length} 本書，第一本: ${books[0].title}, status=${books[0].readingStatus}, tagIds=${JSON.stringify(books[0].tagIds)}` : '無')
    console.log('  [v4 結論]', books && books.length === 5 ? '成功（popup context 直接 sendMessage 可達 storage）' : '失敗')
  } catch (e) {
    console.error('Spike v4 失敗:', e)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
