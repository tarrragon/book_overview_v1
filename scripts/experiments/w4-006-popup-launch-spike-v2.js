/**
 * w4-006-popup-launch-spike-v2.js — 後續驗證
 *
 * v1 結論的延伸驗證：
 *   - v1 Probe A 顯示 active tab 為 undefined（不是 chrome-extension://），與 W1-008
 *     既有描述「popup 自身為 active tab」不完全一致。實際根因是 popup 為新分頁但
 *     不被標為 active，使 chrome.tabs.query({active:true,currentWindow:true}) 回傳
 *     空陣列，[tab] 解構為 undefined，checkCurrentTab 在第一個 if (!tab) 分支即
 *     return null、extractBtn 永遠 disabled。
 *
 * v2 驗證項目：
 *   D. 重複 v1 Probe A 但檢視 `chrome.tabs.query({})` 全清單，確認 popup tab 的
 *      active 屬性實際值，補充對「為何 [tab] 為 undefined」的證據鏈。
 *
 *   E. 方案 3 變體（先開 fixture 並 bringToFront 後，再開 popup 同 window 並
 *      將 fixture 設為 active）：能否讓 popup 內 checkCurrentTab 取得 readmoo
 *      tab？瓶頸：popup 仍是新分頁，瀏覽器自動把新分頁設為 active。
 *
 *   F. 方案 3 最終變體（在 popup tab 內以 chrome.tabs.update 主動把 fixture tab
 *      切回 active，再呼叫 checkCurrentTab）：證明只要 active tab 被導正為
 *      readmoo，popup UI 流程就能正確走通。
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
    protocolTimeout: 120000,
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

async function probeD_tabState (browser, extensionId) {
  console.log('\n=== 驗證 D：popup tab 的 active 屬性實際值 ===')
  const popupPage = await browser.newPage()
  try {
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`,
      { waitUntil: 'domcontentloaded', timeout: 15000 })
    await new Promise(r => setTimeout(r, 1500))

    const allTabs = await popupPage.evaluate(async () => {
      const tabs = await chrome.tabs.query({})
      return tabs.map(t => ({ id: t.id, url: t.url, active: t.active, windowId: t.windowId }))
    })
    console.log('  所有 tabs:', JSON.stringify(allTabs, null, 2))

    return { probe: 'D', evidence: allTabs }
  } finally {
    await popupPage.close()
  }
}

async function probeF_tabsUpdateActive (browser, extensionId) {
  console.log('\n=== 驗證 F：popup 內主動 chrome.tabs.update 切換 active tab 至 fixture ===')

  // 1. 開 fixture
  const fixturePage = await browser.newPage()
  await setupReadmooInterception(fixturePage)
  await fixturePage.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await new Promise(r => setTimeout(r, 1500))

  // 2. 開 popup
  const popupPage = await browser.newPage()
  await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`,
    { waitUntil: 'domcontentloaded', timeout: 15000 })
  await new Promise(r => setTimeout(r, 1500))

  try {
    // 3. 在 popup 內把 fixture tab 設為 active，再呼叫 checkCurrentTab
    const result = await popupPage.evaluate(async () => {
      // 找到 fixture tab id
      const allTabs = await chrome.tabs.query({})
      const fixtureTab = allTabs.find(t => t.url && t.url.includes('readmoo.com/library'))
      if (!fixtureTab) return { error: 'fixture tab 不存在', allTabs: allTabs.map(t => t.url) }

      // 設為 active
      await chrome.tabs.update(fixtureTab.id, { active: true })

      // 等待 200ms 後再 query
      await new Promise(r => setTimeout(r, 200))

      // 呼叫 popup 的 checkCurrentTab（如果暴露在 window）
      if (typeof window.checkCurrentTab === 'function') {
        await window.checkCurrentTab()
      }

      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const extractBtn = document.getElementById('extractBtn')
      return {
        activeTabUrl: activeTab ? activeTab.url : null,
        extractBtnDisabled: extractBtn ? extractBtn.disabled : null,
        pageInfoText: document.getElementById('pageInfo')?.textContent,
        checkCurrentTabAvailable: typeof window.checkCurrentTab === 'function'
      }
    })

    console.log('  結果:', JSON.stringify(result, null, 2))
    const success = result.extractBtnDisabled === false &&
                    result.activeTabUrl && result.activeTabUrl.includes('readmoo.com')
    console.log('  [F 結論]', success ? '成功！extractBtn 已啟用，可進行真實 click' : '失敗，extractBtn 仍 disabled')
    return { probe: 'F', success, evidence: result }
  } finally {
    await popupPage.close()
    await fixturePage.close()
  }
}

async function probeG_clickExtractBtn (browser, extensionId) {
  console.log('\n=== 驗證 G：F 路徑成功後實際 click #extractBtn 看 storage 結果 ===')

  // 開 fixture
  const fixturePage = await browser.newPage()
  await setupReadmooInterception(fixturePage)
  await fixturePage.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })

  // 等 content script ready
  const sw = await (async () => {
    for (const t of browser.targets()) {
      if (t.type() === 'service_worker' && t.url().startsWith('chrome-extension://')) {
        return await t.worker()
      }
    }
    throw new Error('SW not found')
  })()

  const ready = await new Promise(async (resolve) => {
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
      if (r) return resolve(true)
      await new Promise(r => setTimeout(r, 500))
    }
    resolve(false)
  })
  console.log('  content script ready:', ready)

  // 清 storage
  await sw.evaluate(async () => { await chrome.storage.local.remove('readmoo_books') })

  // 開 popup
  const popupPage = await browser.newPage()
  await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`,
    { waitUntil: 'domcontentloaded', timeout: 15000 })
  await new Promise(r => setTimeout(r, 1500))

  try {
    // 主動切回 fixture 為 active + 重新 checkCurrentTab
    await popupPage.evaluate(async () => {
      const allTabs = await chrome.tabs.query({})
      const fixtureTab = allTabs.find(t => t.url && t.url.includes('readmoo.com/library'))
      if (fixtureTab) {
        await chrome.tabs.update(fixtureTab.id, { active: true })
        await new Promise(r => setTimeout(r, 300))
        if (typeof window.checkCurrentTab === 'function') {
          await window.checkCurrentTab()
        }
      }
    })

    // 確認按鈕已啟用
    const disabled = await popupPage.evaluate(() => document.getElementById('extractBtn').disabled)
    console.log('  click 前 extractBtn.disabled:', disabled)

    if (disabled) {
      console.log('  [G 結論] click 前提條件未滿足，跳過')
      return { probe: 'G', success: false, reason: 'extractBtn 仍 disabled' }
    }

    // 真實 click
    await popupPage.click('#extractBtn')

    // 等 storage 寫入
    const books = await new Promise(async (resolve) => {
      const deadline = Date.now() + 20000
      while (Date.now() < deadline) {
        const stored = await sw.evaluate(async () => {
          const r = await chrome.storage.local.get('readmoo_books')
          return r.readmoo_books
        })
        if (stored && Array.isArray(stored.books) && stored.books.length === 5) {
          return resolve(stored.books)
        }
        await new Promise(r => setTimeout(r, 500))
      }
      resolve(null)
    })

    console.log('  storage 提取結果:', books ? `${books.length} 本書` : '無')
    const success = !!books && books.length === 5
    console.log('  [G 結論]', success ? '完整 popup click 觸發 → SW → content script → storage pipeline 成功' : '失敗')
    return { probe: 'G', success, evidence: { bookCount: books?.length } }
  } finally {
    await popupPage.close()
    await fixturePage.close()
  }
}

async function main () {
  const browser = await launchBrowser()
  try {
    const extensionId = await getExtensionId(browser)
    console.log('Extension ID:', extensionId)

    await probeD_tabState(browser, extensionId)
    await probeF_tabsUpdateActive(browser, extensionId)
    await probeG_clickExtractBtn(browser, extensionId)
  } catch (e) {
    console.error('Spike v2 失敗:', e)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
