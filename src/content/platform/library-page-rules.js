/**
 * 各書城「個人書庫頁」的網址規則（單一來源）。
 *
 * adapter 判斷能不能提取（isExtractablePage / getPageType）與 popup 決定主動作
 * （提取或前往書庫）都讀這裡，兩邊的判斷才不會分歧。本模組不依賴其他模組，
 * popup 引用時不會把 adapter 一起打包進去。
 *
 * 鍵是書城 id，與 platform-registry 的 name、popup 的 BOOKSTORE_LIST.id 相同。
 */

const LIBRARY_PAGE_RULES = Object.freeze({
  // 書庫是 SPA 的 hash 路由：read.readmoo.com/#/library
  readmoo: (url) => url.hash.includes('#/library'),
  // 書櫃是閱讀器頁帶 readlist 參數：viewer-ebook.books.com.tw/viewer/index.html?readlist=all
  'books-com-tw': (url) => url.searchParams.has('readlist'),
  // 各地區路徑都含 /library/books：/tw/zh/library/books、/jp/ja/library/books
  kobo: (url) => url.pathname.includes('/library/books')
})

// 各書城的網域：該網域本身與其下任何子網域都算這家書城。
// 依網域而非完整主機名比對，書城換子網域時（read.readmoo.com → next.readmoo.com）判斷不變。
const PLATFORM_DOMAINS = Object.freeze({
  readmoo: 'readmoo.com',
  'books-com-tw': 'books.com.tw',
  kobo: 'kobo.com'
})

/**
 * @param {string} href - 分頁網址
 * @returns {string|null} 書城 id；不屬於任何書城或網址無法解析時為 null
 */
function matchPlatformIdByUrl (href) {
  if (typeof href !== 'string') return null
  let hostname
  try {
    hostname = new URL(href).hostname.toLowerCase()
  } catch (error) {
    // 設計性靜默：網址無法解析時視為不屬於任何書城
    return null
  }
  const entry = Object.entries(PLATFORM_DOMAINS).find(([, domain]) =>
    hostname === domain || hostname.endsWith(`.${domain}`))
  return entry ? entry[0] : null
}

/**
 * @param {string} platformId - 書城 id（readmoo / books-com-tw / kobo）
 * @param {string} href - 分頁網址
 * @returns {boolean} 是不是這家書城的個人書庫頁；未知書城或網址無法解析時為 false
 */
function isLibraryPageUrl (platformId, href) {
  const rule = LIBRARY_PAGE_RULES[platformId]
  if (!rule || typeof href !== 'string') return false
  try {
    return rule(new URL(href))
  } catch (error) {
    // 設計性靜默：網址無法解析時視為非書庫頁
    return false
  }
}

module.exports = { isLibraryPageUrl, matchPlatformIdByUrl, LIBRARY_PAGE_RULES, PLATFORM_DOMAINS }
