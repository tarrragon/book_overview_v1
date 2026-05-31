/**
 * w4-006-popup-launch-spike-v6.js — Probe G 深度診斷
 *
 * v5 真實 click 失敗，但 v4 popup context 直接 sendMessage 成功，差異在於：
 *   - v5 觸發 popup 內的 startExtraction()，其內部會再呼叫 checkCurrentTab()
 *   - checkCurrentTab() 重新 chrome.tabs.query({active:true,currentWindow:true})
 *   - 若此時 popup tab 重新變回 active，[tab] 為 popup 自身（url 為 chrome-extension://），
 *     isReadmoo=false → updateButtonState(true) → 但 startExtraction 已經拿到 tab，
 *     繼續 chrome.tabs.sendMessage(tab.id, START_EXTRACTION) → 傳給 popup 自己 → 失敗
 *
 * v6 加入：
 *   - popup page console 捕捉 → 看 startExtraction 內部 log
 *   - 監聽 chrome.tabs.sendMessage 呼叫實際傳遞的 tab.id
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
    // 捕捉 popup console
    popupPage.on('console', msg => {
      const txt = msg.text()
      if (txt.includes('提取') || txt.includes('extract') || txt.includes('tab') || txt.includes('error')) {
        console.log(`  [popup console][${msg.type()}]`, txt)
      }
    })
    popupPage.on('pageerror', e => console.log('  [popup pageerror]', e.message))

    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`,
      { waitUntil: 'domcontentloaded', timeout: 15000 })
    await new Promise(r => setTimeout(r, 1500))

    // 切 fixture 為 active + 攔截 chrome.tabs.sendMessage
    const setup = await popupPage.evaluate(async () => {
      const all = await chrome.tabs.query({})
      const fixture = all.find(t => t.url && t.url.includes('readmoo.com/library'))
      if (!fixture) return { error: 'no fixture' }

      // 攔截 chrome.tabs.sendMessage：記錄目標 tab id
      window.__sentMessages = []
      const orig = chrome.tabs.sendMessage
      chrome.tabs.sendMessage = function (tabId, msg, ...rest) {
        window.__sentMessages.push({ tabId, msg })
        return orig.call(this, tabId, msg, ...rest)
      }

      // 攔截 chrome.tabs.query：記錄結果
      window.__queryResults = []
      const origQuery = chrome.tabs.query
      chrome.tabs.query = function (opts, ...rest) {
        const r = origQuery.call(this, opts, ...rest)
        if (r && typeof r.then === 'function') {
          return r.then(result => {
            window.__queryResults.push({ opts, result: result.map(t => ({ id: t.id, url: t.url, active: t.active })) })
            return result
          })
        }
        return r
      }

      await chrome.tabs.update(fixture.id, { active: true })
      await new Promise(r => setTimeout(r, 300))
      if (typeof window.checkCurrentTab === 'function') {
        await window.checkCurrentTab()
      }
      return { fixtureId: fixture.id, disabled: document.getElementById('extractBtn').disabled }
    })
    console.log('  click 前狀態:', setup)

    // click
    await popupPage.evaluate(() => {
      document.getElementById('extractBtn').click()
    })

    // 等 storage（短 timeout）
    const books = await (async () => {
      const deadline = Date.now() + 15000
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

    // 看攔截結果
    const intercepted = await popupPage.evaluate(() => ({
      sent: window.__sentMessages,
      queries: window.__queryResults
    })).catch(e => ({ error: e.message }))
    console.log('  sendMessage 攔截:', JSON.stringify(intercepted.sent, null, 2))
    console.log('  query 攔截（最後 3 筆）:', JSON.stringify((intercepted.queries || []).slice(-3), null, 2))
    console.log('  storage:', books ? `${books.length} 本書` : '無')
  } catch (e) {
    console.error('Spike v6 失敗:', e)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
