/**
 * @fileoverview Platform Registry - 書城偵測與路由模組
 * @version v1.0.0
 * @since 2026-06-26
 *
 * 負責功能：
 * - 集中管理所有支援書城的配置（PLATFORM_CONFIGS）
 * - 依 URL hostname 偵測對應書城並回傳 adapter factory
 * - 提供 manifest content script 註冊所需的 match patterns 清單
 *
 * 設計考量：
 * - 新增書城只需在 PLATFORM_CONFIGS 增加一筆配置（開放封閉原則）
 * - adapterFactory 採 lazy require，避免載入未使用書城的適配器
 * - hostname 採完全比對與子網域後綴比對，避免 readmoo.com 誤判為 evilreadmoo.com
 */

/**
 * @typedef {Object} PlatformConfig
 * @property {string} name 書城識別碼（小寫）
 * @property {string} displayName 書城顯示名稱
 * @property {string[]} matchPatterns manifest content script 用 URL match patterns
 * @property {string[]} hostnames 偵測比對用 hostname 清單
 * @property {() => Function} adapterFactory lazy require，回傳適配器工廠函式
 * @property {string} libraryUrl 書庫頁 URL
 */

/**
 * 支援書城配置清單
 *
 * @type {PlatformConfig[]}
 */
const PLATFORM_CONFIGS = [
  {
    name: 'readmoo',
    displayName: 'Readmoo 讀墨',
    matchPatterns: ['*://*.readmoo.com/*'],
    hostnames: ['read.readmoo.com', 'member.readmoo.com', 'readmoo.com'],
    adapterFactory: () => require('../adapters/readmoo-adapter'),
    libraryUrl: 'https://read.readmoo.com/#/library'
  },
  {
    name: 'books-com-tw',
    displayName: '博客來電子書',
    matchPatterns: ['*://*.books.com.tw/*'],
    hostnames: ['viewer-ebook.books.com.tw', 'www.books.com.tw', 'books.com.tw'],
    adapterFactory: () => require('../adapters/books-com-tw-adapter'),
    libraryUrl: 'https://viewer-ebook.books.com.tw/viewer/index.html?readlist=all'
  }
]

/**
 * 從 URL 字串解析出 hostname
 *
 * @param {string} url 完整 URL
 * @returns {string|null} hostname（小寫），解析失敗回傳 null
 */
function parseHostname (url) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch (error) {
    return null
  }
}

/**
 * 判斷 hostname 是否屬於某書城配置
 *
 * 比對規則：完全相等，或為設定 hostname 的子網域（後綴比對加上 `.` 邊界，
 * 避免 `evilreadmoo.com` 誤命中 `readmoo.com`）。
 *
 * @param {string} hostname 待比對 hostname
 * @param {PlatformConfig} config 書城配置
 * @returns {boolean}
 */
function matchesHostname (hostname, config) {
  return config.hostnames.some((configured) => {
    const lower = configured.toLowerCase()
    return hostname === lower || hostname.endsWith(`.${lower}`)
  })
}

/**
 * 偵測 URL 對應的書城
 *
 * @param {string} url 完整 URL
 * @returns {{ config: PlatformConfig, createAdapter: (options?: Object) => Object }|null}
 *   命中時回傳書城配置與 adapter 建構函式；未命中或 URL 無效回傳 null
 */
function detect (url) {
  const hostname = parseHostname(url)
  if (!hostname) {
    return null
  }

  const config = PLATFORM_CONFIGS.find((candidate) => matchesHostname(hostname, candidate))
  if (!config) {
    return null
  }

  return {
    config,
    createAdapter: (options) => config.adapterFactory()(options)
  }
}

/**
 * 取得所有書城的 match patterns（供 manifest content script 註冊）
 *
 * @returns {string[]} 去重後的 match patterns 清單
 */
function getAllMatchPatterns () {
  const patterns = PLATFORM_CONFIGS.flatMap((config) => config.matchPatterns)
  return Array.from(new Set(patterns))
}

/**
 * 取得所有已註冊書城配置
 *
 * @returns {PlatformConfig[]} 配置清單副本
 */
function getRegisteredPlatforms () {
  return PLATFORM_CONFIGS.slice()
}

module.exports = {
  PLATFORM_CONFIGS,
  detect,
  getAllMatchPatterns,
  getRegisteredPlatforms
}
