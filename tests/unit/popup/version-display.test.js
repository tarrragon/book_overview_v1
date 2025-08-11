/**
 * Popup 版本號顯示單元測試
 *
 * 測試目的：
 * - 驗證從 chrome.runtime.getManifest() 取得版本號並顯示在 #versionDisplay
 * - 版本格式：
 *   - 一般版：v{version}
 *   - 開發版：v{version} 開發版本（當 version 含 dev 或以 0. 開頭）
 * - 例外處理：getManifest 失敗時顯示 v?.?.? 未知版本
 *
 * @jest-environment jsdom
 */

const fs = require('fs')
const path = require('path')

describe('Popup 版本號顯示', () => {
  let popupScript

  const loadPopupScript = () => {
    const popupJsPath = path.join(__dirname, '../../../src/popup/popup.js')
    popupScript = fs.readFileSync(popupJsPath, 'utf8')
    // 評估腳本到當前 jsdom 的 window 環境
    // 注意：popup.js 會註冊一些事件與計時器，但不會自動執行初始化（需 DOMContentLoaded）
    // 測試中改為直接呼叫 window.updateVersionDisplay()
    // eslint-disable-next-line no-eval
    eval(popupScript)
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="versionDisplay">載入中...</div>
    `

    // 提供基本的 chrome 物件
    global.chrome = global.chrome || {}
    global.chrome.runtime = global.chrome.runtime || {}
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('應該顯示一般版本字串 v{version}', () => {
    // 模擬正式版本號（非 0.x，且不含 dev）
    const version = '1.2.3'
    global.chrome.runtime.getManifest = jest.fn(() => ({ version }))

    loadPopupScript()

    expect(typeof window.updateVersionDisplay).toBe('function')
    window.updateVersionDisplay()

    const versionEl = document.getElementById('versionDisplay')
    expect(versionEl.textContent).toBe(`v${version}`)
  })

  test('應該在開發版本時加註「開發版本」字樣 (0.x)', () => {
    // 模擬 0.x 版本號
    const version = '0.5.33'
    global.chrome.runtime.getManifest = jest.fn(() => ({ version }))

    loadPopupScript()

    window.updateVersionDisplay()
    const versionEl = document.getElementById('versionDisplay')
    expect(versionEl.textContent).toBe(`v${version} 開發版本`)
  })

  test('應該在開發版本時加註「開發版本」字樣 (含 dev)', () => {
    // 模擬帶有 dev 字串的版本號
    const version = '1.0.0-dev.2'
    global.chrome.runtime.getManifest = jest.fn(() => ({ version }))

    loadPopupScript()

    window.updateVersionDisplay()
    const versionEl = document.getElementById('versionDisplay')
    expect(versionEl.textContent).toBe(`v${version} 開發版本`)
  })

  test('getManifest 例外時應顯示未知版本字串', () => {
    // 模擬例外
    global.chrome.runtime.getManifest = jest.fn(() => { throw new Error('mock failure') })

    loadPopupScript()

    window.updateVersionDisplay()
    const versionEl = document.getElementById('versionDisplay')
    expect(versionEl.textContent).toBe('v?.?.? 未知版本')
  })
})
