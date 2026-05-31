/**
 * w4-006-popup-launch-spike-v3.js — Probe G 重做（click → storage 等待解耦）
 *
 * v2 G 失敗根因：popup page 在 click 後因 protocolTimeout 取消（popup 內又有
 * setInterval/checkCurrentTab polling），需把 click 與 storage 等待解耦：
 *   - popup.click('#extractBtn') 觸發後不再對 popup page evaluate
 *   - 改用 SW worker 直接 poll chrome.storage.local.readmoo_books
 *   - 結果驗證後再 close popup page
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
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
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

    // 1. 開 fixture
    console.log('\n=== Probe G v3：click → SW poll storage 解耦 ===')
    const fixturePage = await browser.newPage()
    await setupReadmooInterception(fixturePage)
    await fixturePage.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })

    // 等 content script ready
    const ready = await (async () => {
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
    console.log('  content script ready:', ready)

    // 2. 開 popup（新分頁）
    const popupPage = await browser.newPage()
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`,
      { waitUntil: 'domcontentloaded', timeout: 15000 })
    await new Promise(r => setTimeout(r, 1500))

    // 3. popup 內主動切換 active tab 為 fixture
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
    })

    const disabled = await popupPage.evaluate(() =>
      document.getElementById('extractBtn').disabled
    )
    console.log('  click 前 extractBtn.disabled:', disabled)

    if (disabled) {
      console.log('  [G v3 結論] 失敗，extractBtn 仍 disabled')
      return
    }

    // 4. 真實 click（不等回應）
    console.log('  發起 click（不等待 popup 回應）...')
    popupPage.click('#extractBtn').catch(() => { /* popup 可能被 polling 干擾 */ })

    // 5. SW 端 poll storage
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

    console.log('  storage 提取結果:', books ? `${books.length} 本書` : '無')
    if (books) {
      console.log('  第一本書範例:', JSON.stringify({
        title: books[0].title,
        readingStatus: books[0].readingStatus,
        tagIds: books[0].tagIds
      }))
    }
    const success = !!books && books.length === 5
    console.log('  [G v3 結論]', success ? '完整 popup click → SW → content script → storage pipeline 成功' : '失敗')
  } catch (e) {
    console.error('Spike v3 失敗:', e)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
