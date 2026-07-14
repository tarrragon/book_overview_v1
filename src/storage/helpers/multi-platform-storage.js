const { PLATFORM_IDS, platformBooksKey } = require('src/background/constants/module-constants')

/**
 * 讀取所有書城的書目並合併為單一陣列
 * @returns {Promise<Array>} 合併後的書目陣列（每本書含 source 欄位）
 */
async function loadAllPlatformBooks () {
  const allKeys = Object.values(PLATFORM_IDS).map(platformBooksKey)
  const result = await chrome.storage.local.get(allKeys)
  const merged = []
  for (const key of allKeys) {
    const data = result[key]
    if (data?.books && Array.isArray(data.books) && data.books.length > 0) {
      merged.push(...data.books)
    }
  }
  return merged
}

module.exports = { loadAllPlatformBooks }
