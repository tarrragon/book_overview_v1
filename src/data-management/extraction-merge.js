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

// 早期提取拿不到閱讀連結與封面時，ID 退回 title-<書名>。之後再提取同一本書會拿到
// reader- ID 與封面，id 與「書名|封面」都對不上，所以這類舊紀錄另外用書名 ID 比對。
const TITLE_ID_PREFIX = 'title-'

function titleBasedId (extracted) {
  const raw = extracted.identifiers && extracted.identifiers.titleBased
  if (!raw) return null
  return raw.startsWith(TITLE_ID_PREFIX) ? raw : `${TITLE_ID_PREFIX}${raw}`
}

function findLocalMatch (extracted, index) {
  if (extracted.id && index.byId.has(extracted.id)) return index.byId.get(extracted.id)
  if (extracted.platformBookId && index.byPlatformId.has(extracted.platformBookId)) {
    return index.byPlatformId.get(extracted.platformBookId)
  }
  const key = fallbackKey(extracted)
  if (key && index.byFallback.has(key)) return index.byFallback.get(key)
  const titleId = titleBasedId(extracted)
  if (titleId && index.byTitleId.has(titleId)) return index.byTitleId.get(titleId)
  return null
}

function buildIndex (localBooks) {
  const index = { byId: new Map(), byPlatformId: new Map(), byFallback: new Map(), byTitleId: new Map() }
  for (const book of localBooks) {
    if (book.id) index.byId.set(book.id, book)
    if (book.platformBookId) index.byPlatformId.set(book.platformBookId, book)
    const key = fallbackKey(book)
    if (key && !index.byFallback.has(key)) index.byFallback.set(key, book)
    // 只收 ID 本身就是書名 ID 的紀錄；已有穩定 ID 的書不靠書名比對
    if (typeof book.id === 'string' && book.id.startsWith(TITLE_ID_PREFIX) && !index.byTitleId.has(book.id)) {
      index.byTitleId.set(book.id, book)
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
    const match = findLocalMatch(extracted, index)
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
