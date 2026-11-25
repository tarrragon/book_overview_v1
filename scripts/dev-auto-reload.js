/**
 * 開發版自動重新載入（只用於 npm run build:dev）
 *
 * 為什麼需要：未封裝的擴充功能裡，popup／overview 頁每次開啟都會讀磁碟上的新檔，
 * 但 service worker 與 content script 的程式在載入擴充功能時就固定下來；
 * 改了 src/background 或 src/content 之後重新建置，不到 chrome://extensions
 * 重新載入就還是跑舊程式（實驗紀錄見 docs/development-setup.md〈改動何時生效〉）。
 *
 * 做法：
 * - 建置時把這次的建置戳記寫死在附加到 background.js 尾端的程式裡，並在建置最後寫出
 *   dev-build-stamp.json。
 * - service worker 以 chrome.alarms 定期讀 dev-build-stamp.json，與寫死的戳記不同就
 *   chrome.runtime.reload()。
 * - 戳記必須寫死在程式裡，不能在 service worker 啟動時讀檔記下：service worker 閒置
 *   被停掉再喚醒時跑的是載入時的舊程式，若啟動時才讀檔，舊程式會記到新戳記而永遠不重載。
 * - 建置過程會先清空輸出目錄，期間讀不到戳記檔就不重載；戳記檔最後才寫，不會重載到
 *   建到一半的版本。
 *
 * 正式版（build:prod）不呼叫本模組：不附加程式、不加 alarms 權限、不寫戳記檔。
 * 建置時設 DEV_AUTO_RELOAD=0 可在開發版關閉。
 */

const fs = require('fs')
const path = require('path')

const STAMP_FILE = 'dev-build-stamp.json'
const ALARM_NAME = 'dev-auto-reload'
// 未封裝的擴充功能不受 chrome.alarms 30 秒下限限制（實測見 docs/development-setup.md）
const CHECK_PERIOD_MINUTES = 0.05

/**
 * @param {string} stamp - 這次建置的戳記
 * @returns {string} 附加到 background.js 尾端的程式
 */
function buildSnippet (stamp) {
  return `
;/* dev-auto-reload：只存在於開發版建置（scripts/dev-auto-reload.js） */
;(() => {
  const BUILT_STAMP = ${JSON.stringify(stamp)}
  const STAMP_URL = chrome.runtime.getURL(${JSON.stringify(STAMP_FILE)})
  const readStamp = () => fetch(STAMP_URL, { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data && data.stamp) || null)
    .catch(() => null)
  const check = async () => {
    const onDisk = await readStamp()
    if (onDisk && onDisk !== BUILT_STAMP) {
      console.log('[dev-auto-reload] 偵測到新建置，重新載入擴充功能', { from: BUILT_STAMP, to: onDisk })
      chrome.runtime.reload()
    }
  }
  console.log('[dev-auto-reload] 目前建置', BUILT_STAMP)
  if (chrome.alarms) {
    chrome.alarms.create(${JSON.stringify(ALARM_NAME)}, { periodInMinutes: ${CHECK_PERIOD_MINUTES} })
    chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ${JSON.stringify(ALARM_NAME)}) check() })
  }
  check()
})()
`
}

/**
 * 在 manifest 物件加上 alarms 權限（開發版用；回傳新物件，不改動輸入）
 * @param {object} manifest
 * @returns {object}
 */
function withAlarmsPermission (manifest) {
  const permissions = new Set(manifest.permissions || [])
  permissions.add('alarms')
  return { ...manifest, permissions: [...permissions] }
}

/**
 * 對已完成的開發版輸出目錄套用自動重載。必須在所有檔案寫完之後呼叫。
 *
 * @param {string} buildDir - 開發版輸出目錄（含已打包的 src/background/background.js）
 * @param {string} [stamp] - 建置戳記，預設為當下時間
 * @returns {{ stamp: string }}
 */
function applyDevAutoReload (buildDir, stamp = String(Date.now())) {
  const manifestPath = path.join(buildDir, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  fs.writeFileSync(manifestPath, JSON.stringify(withAlarmsPermission(manifest), null, 2))

  const backgroundPath = path.join(buildDir, manifest.background.service_worker)
  fs.appendFileSync(backgroundPath, buildSnippet(stamp))

  // 最後才寫戳記檔：service worker 讀到它，代表上面的檔案都已寫完
  fs.writeFileSync(path.join(buildDir, STAMP_FILE), JSON.stringify({ stamp }))
  return { stamp }
}

module.exports = { applyDevAutoReload, buildSnippet, withAlarmsPermission, STAMP_FILE, ALARM_NAME }
