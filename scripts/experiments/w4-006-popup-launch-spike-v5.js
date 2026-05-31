/**
 * w4-006-popup-launch-spike-v5.js — Probe G 最終驗證：真實 click 觸發
 *
 * v4 證實 popup context 可直接呼叫 chrome.tabs.sendMessage（不經 click），
 * v5 驗證真實 click 路徑：
 *   - Probe G1: 標準 click（DOM event）→ 是否觸發 startExtraction
 *   - Probe G2: 透過 dispatchEvent 觸發 click（繞過 user gesture 假設）
 *
 * v3 失敗的可能根因驗證：
 *   - popup 每 3 秒 periodicStatusUpdate 會再次 checkCurrentTab → 可能把 active
 *     tab 改回 popup 自身（fixture 失去 active 標記）
 *   - 對策：click 前先暫停 polling（clearInterval）或在 click 前再切一次 active
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

async function probeRealClick (browser, extensionId, sw, useDispatchEvent) {
  console.log(`\n=== Probe G${useDispatchEvent ? '2' : '1'}：${useDispatchEvent ? 'dispatchEvent' : 'page.click'} 真實 click ===`)
  await sw.evaluate(async () => { await chrome.storage.local.remove('readmoo_books') })

  const fixturePage = await browser.newPage()
  await setupReadmooInterception(fixturePage)
  await fixturePage.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })

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

  const popupPage = await browser.newPage()
  await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`,
    { waitUntil: 'domcontentloaded', timeout: 15000 })
  await new Promise(r => setTimeout(r, 1500))

  // 切換 active tab + 暫停 polling
  await popupPage.evaluate(async () => {
    const all = await chrome.tabs.query({})
    const fixture = all.find(t => t.url && t.url.includes('readmoo.com/library'))
    if (fixture) {
      await chrome.tabs.update(fixture.id, { active: true })
      await new Promise(r => setTimeout(r, 300))
      if (typeof window.checkCurrentTab === 'function') {
        await window.checkCurrentTab()
      }
    }
    // 嘗試暫停 popup 內的 setInterval polling，避免 race
    const highestId = setTimeout(() => {}, 0)
    for (let i = 0; i < highestId; i++) clearInterval(i)
  })

  const disabled = await popupPage.evaluate(() =>
    document.getElementById('extractBtn').disabled
  )
  console.log('  click 前 extractBtn.disabled:', disabled)
  if (disabled) {
    console.log('  跳過 click（按鈕仍 disabled）')
    await popupPage.close()
    await fixturePage.close()
    return false
  }

  // click
  if (useDispatchEvent) {
    await popupPage.evaluate(() => {
      const btn = document.getElementById('extractBtn')
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
  } else {
    popupPage.click('#extractBtn').catch(() => { /* popup polling */ })
  }
  console.log('  click 已發起')

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
  console.log('  storage:', books ? `${books.length} 本書，第一本: ${books[0].title}` : '無')

  await popupPage.close()
  await fixturePage.close()
  return !!books && books.length === 5
}

async function main () {
  const browser = await launchBrowser()
  try {
    const extensionId = await getExtensionId(browser)
    console.log('Extension ID:', extensionId)
    const sw = await getSW(browser)

    const g1 = await probeRealClick(browser, extensionId, sw, false)
    const g2 = await probeRealClick(browser, extensionId, sw, true)
    console.log('\n=== Summary ===')
    console.log('  G1 page.click:', g1 ? 'SUCCESS' : 'FAIL')
    console.log('  G2 dispatchEvent:', g2 ? 'SUCCESS' : 'FAIL')
  } catch (e) {
    console.error('Spike v5 失敗:', e)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
