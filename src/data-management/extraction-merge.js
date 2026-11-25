/**
 * 重新提取時，把這次從書城頁面讀到的書目合併進本機既有的書目（UC-02）。
 *
 * 欄位分兩邊管：
 * - 頁面決定的欄位（書名、作者、封面、進度等）以這次提取為準。
 * - 使用者決定的欄位以本機為準：tagIds（取聯集）、isManualStatus，
 *   以及手動設定時的 readingStatus。非手動狀態依新的進度重新推導（由呼叫端先算好）。
 *
 * 頁面上這次沒讀到的本機書目原樣保留、不刪除：書城頁面可能還沒載入完，
 * 刪除會讓使用者在本機加的標籤一起消失。
 */

// 使用者決定、或由合併規則另外處理的欄位，不從提取結果覆寫
const USER_OWNED_FIELDS = new Set(['id', 'tagIds', 'isManualStatus', 'readingStatus', 'tags'])

// 每次提取都會變、不代表書目內容有變的欄位，判斷「有沒有變化」時不比
const VOLATILE_FIELDS = new Set(['extractedAt', 'updatedAt', 'schemaVersion'])

function fallbackKey (book) {
  if (!book.title) return null
  return `${book.title}|${book.cover || ''}`
}

// 早期提取拿不到閱讀連結時，ID 退回 cover-<封面 ID>（有封面）或 title-<書名>（連封面都沒有）。
// 之後再提取同一本書會拿到 reader- ID，封面網址的版本參數也可能變了，id 與「書名|封面」
// 都對不上，所以這兩類舊紀錄另外用提取結果的 identifiers.coverId 與 identifiers.titleBased 比對。
const TITLE_ID_PREFIX = 'title-'
const COVER_ID_PREFIX = 'cover-'

function withPrefix (prefix, raw) {
  if (!raw) return null
  return raw.startsWith(prefix) ? raw : `${prefix}${raw}`
}

function legacyIds (extracted) {
  const ids = extracted.identifiers || {}
  return [withPrefix(COVER_ID_PREFIX, ids.coverId), withPrefix(TITLE_ID_PREFIX, ids.titleBased)].filter(Boolean)
}

/**
 * @param {Object} extracted
 * @param {Object} index - buildIndex 的結果
 * @param {Map} claimed - 這次已經對上的本機紀錄；舊 ID 可能撞號，撞號時跳過已被認領的那一筆
 */
function findLocalMatch (extracted, index, claimed) {
  if (extracted.id && index.byId.has(extracted.id)) return index.byId.get(extracted.id)
  if (extracted.platformBookId && index.byPlatformId.has(extracted.platformBookId)) {
    return index.byPlatformId.get(extracted.platformBookId)
  }
  const key = fallbackKey(extracted)
  if (key && index.byFallback.has(key)) return index.byFallback.get(key)

  // 書名 ID 會撞號（例如「十月堂舊書事１」「十月堂舊書事２」產生的書名 ID 相同），
  // 同一個舊 ID 有多筆時，先找書名完全相同、還沒被認領的那一筆
  for (const legacyId of legacyIds(extracted)) {
    const candidates = (index.byLegacyId.get(legacyId) || []).filter(book => !claimed.has(book))
    if (candidates.length === 0) continue
    return candidates.find(book => book.title === extracted.title) || candidates[0]
  }
  return null
}

function buildIndex (localBooks) {
  const index = { byId: new Map(), byPlatformId: new Map(), byFallback: new Map(), byLegacyId: new Map() }
  for (const book of localBooks) {
    if (book.id) index.byId.set(book.id, book)
    if (book.platformBookId) index.byPlatformId.set(book.platformBookId, book)
    const key = fallbackKey(book)
    if (key && !index.byFallback.has(key)) index.byFallback.set(key, book)
    // 只收 ID 本身就是封面 ID 或書名 ID 的紀錄；已有閱讀連結 ID 的書不靠這兩種比對
    const isLegacy = typeof book.id === 'string' &&
      (book.id.startsWith(TITLE_ID_PREFIX) || book.id.startsWith(COVER_ID_PREFIX))
    if (isLegacy) {
      if (!index.byLegacyId.has(book.id)) index.byLegacyId.set(book.id, [])
      index.byLegacyId.get(book.id).push(book)
    }
  }
  return index
}

function pageFieldsChanged (local, extracted) {
  return Object.keys(extracted).some((field) => {
    if (USER_OWNED_FIELDS.has(field) || VOLATILE_FIELDS.has(field)) return false
    return JSON.stringify(local[field]) !== JSON.stringify(extracted[field])
  })
}

function mergeOne (local, extracted, now) {
  const merged = { ...local }
  for (const [field, value] of Object.entries(extracted)) {
    if (USER_OWNED_FIELDS.has(field)) continue
    merged[field] = value
  }
  merged.id = local.id
  merged.tags = [...new Set([...(local.tags || []), ...(extracted.tags || [])])]
  merged.tagIds = [...new Set([...(local.tagIds || []), ...(extracted.tagIds || [])])]
  merged.isManualStatus = Boolean(local.isManualStatus)
  merged.readingStatus = local.isManualStatus ? local.readingStatus : extracted.readingStatus
  merged.updatedAt = now
  return merged
}

/**
 * @param {Array<Object>} localBooks - 本機既有的書目（同一書城）
 * @param {Array<Object>} extractedBooks - 這次提取、已正規化的書目
 * @param {string} [now] - ISO 時間字串，寫進有更新的書的 updatedAt
 * @returns {{ books: Array<Object>, summary: { added: number, updated: number, unchanged: number, notOnPage: number } }}
 */
function mergeExtractedBooks (localBooks, extractedBooks, now = new Date().toISOString()) {
  const local = Array.isArray(localBooks) ? localBooks : []
  const index = buildIndex(local)
  const replaced = new Map()
  const added = []
  const summary = { added: 0, updated: 0, unchanged: 0, notOnPage: 0 }

  for (const extracted of extractedBooks) {
    const match = findLocalMatch(extracted, index, replaced)
    if (!match || replaced.has(match)) {
      added.push(extracted)
      summary.added++
      continue
    }
    if (pageFieldsChanged(match, extracted) || (!match.isManualStatus && match.readingStatus !== extracted.readingStatus)) {
      replaced.set(match, mergeOne(match, extracted, now))
      summary.updated++
    } else {
      replaced.set(match, match)
      summary.unchanged++
    }
  }

  const books = local.map((book) => {
    if (replaced.has(book)) return replaced.get(book)
    summary.notOnPage++
    return book
  })

  return { books: [...books, ...added], summary }
}

module.exports = { mergeExtractedBooks }
