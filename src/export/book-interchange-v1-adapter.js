'use strict'

/**
 * book-interchange-v1 雙向映射 adapter（foundation 純函式核心）
 *
 * 提供 V1 內部 v2 book model ↔ canonical（everything-as-tags）的雙向映射，
 * 供匯出（.2.1 write）與匯入（.2.2 read + APP legacy 止血）兩端消費。
 *
 * 權威 SSOT：docs/spec/book-interchange-v1.md v3.0.0（§4/§6/§7/§11）。
 * 設計來源：ticket 0.19.0-W4-031.2 Phase 1/2/3a。
 *
 * 核心契約：
 * - 映射缺 id/title → throw BookValidationError（對齊既有 convertV1ToV2Book）。
 * - normalize 子函式 / buildTagTree 不 throw。
 * - 多值收斂（§A，ADR-5）：read 端首元素入固定欄位，其餘 + 完整陣列入 _passthrough；
 *   write 端優先讀 _passthrough 重建，達成 canonical 出發 round-trip 無損（C1）。
 */

const { isPlainObject, assertBookHasIdTitle } = require('./book-validation-helpers')

// §7 readingStatus 六態正規化對照表（V1 ↔ canonical），一對一可逆
const RS_V1_TO_CANONICAL = {
  unread: 'not_started',
  queued: 'queued',
  reading: 'reading',
  finished: 'finished',
  abandoned: 'abandoned',
  reference: 'reference'
}
const RS_CANONICAL_TO_V1 = Object.fromEntries(
  Object.entries(RS_V1_TO_CANONICAL).map(([v1, canon]) => [canon, v1])
)

// read 端不還原至 V1 固定欄位、僅 carry 至 _passthrough 的 tag 類別（C1，U15）
const CARRY_TAG_CATEGORIES = ['importance', 'ccl', 'description', 'series', 'language', 'alias']
// write 端由 _passthrough 重建的多值 tag 類別（§A 收斂對象）
const MULTI_VALUE_TAG_CATEGORIES = ['platform', 'publisher', 'isbn']

// =============================================================================
// readingStatus 正規化子函式（§7，純查表，不 throw、無副作用 — ADR-3）
// =============================================================================

/**
 * V1 readingStatus → canonical name（§7）。
 * @param {string} v1Status - V1 六態之一
 * @returns {string|null} canonical name，未知值回 null（passthrough 責任在 caller）
 */
function normalizeReadingStatusToCanonical (v1Status) {
  return Object.prototype.hasOwnProperty.call(RS_V1_TO_CANONICAL, v1Status)
    ? RS_V1_TO_CANONICAL[v1Status]
    : null
}

/**
 * canonical name → V1 readingStatus（§7 逆向）。
 * @param {string} canonicalName - canonical 六態之一
 * @returns {string|null} V1 status，未知值回 null
 */
function normalizeReadingStatusFromCanonical (canonicalName) {
  return Object.prototype.hasOwnProperty.call(RS_CANONICAL_TO_V1, canonicalName)
    ? RS_CANONICAL_TO_V1[canonicalName]
    : null
}

// =============================================================================
// 內部小工具
// =============================================================================

// 由 name 衍生穩定 tag id（固定欄位 → 單元素 tag 用，避免每次取值不同的 race flaky）
function genTagId (prefix, name) {
  return `${prefix}-${name}`
}

// 由 path 前綴衍生穩定中間層節點 id（buildTagTree 中間層無顯式 id，TD-3）
function deriveStableId (segments) {
  return `node:${segments.join('/')}`
}

// =============================================================================
// write 方向：mapV1BookToCanonical（V1 內部 v2 → canonical，供 .2.1）
// =============================================================================

/**
 * 將 V1 內部 v2 book model 映射為 canonical book（everything-as-tags）。
 *
 * 多值/carry 重建（§A / ADR-5）：若輸入帶有 read 階段存入的 _passthrough，
 * 優先讀其完整陣列重建多值 tag 與 carry 類；無 passthrough（V1 出發路徑）則由
 * 固定欄位包單元素 tag。兩路徑統一（H3）。
 *
 * @param {Object} v1Book - Extension 內部 v2 book model
 * @returns {Object} canonical book
 * @throws {BookValidationError} 非 object 或缺 id/title
 */
function mapV1BookToCanonical (v1Book) {
  assertBookHasIdTitle(v1Book)

  const canonical = {
    id: v1Book.id, // 保留禁重生（C4）
    title: v1Book.title,
    cover: objectifyCover(v1Book),
    progress: objectifyProgress(v1Book),
    tags: {},
    _passthrough: {}
  }
  carryIfPresent(canonical, v1Book, ['createdAt', 'updatedAt'])
  // crossPlatformId/dataFingerprint：V1 內部無來源 → 不輸出（不臆造空值，§G/spec §11）

  // --- 固定欄位 → 單元素 tag（everything-as-tags）---
  canonical.tags.author = Array.isArray(v1Book.authors)
    ? v1Book.authors.map((name) => ({ id: genTagId('a', name), name }))
    : []
  canonical.tags.platform = wrapSingle(v1Book.source, 'platform')
  canonical.tags.publisher = wrapSingle(v1Book.publisher, 'publisher')
  canonical.tags.isbn = wrapSingle(v1Book.identifiers ? v1Book.identifiers.isbn : undefined, 'isbn')
  canonical.tags.custom = mapTagIdsToCustom(v1Book.tagIds)

  // readingStatus 單選 tag（§7 正規化），passthrough 責任在此 caller（§E）
  if (v1Book.readingStatus === undefined || v1Book.readingStatus === null) {
    canonical.tags.readingStatus = [] // B10 不臆造
  } else {
    const rsName = normalizeReadingStatusToCanonical(v1Book.readingStatus)
    if (rsName === null) {
      // 未知值（V1 正向不可達；防禦）— 記 passthrough，C1 禁丟失
      canonical.tags.readingStatus = []
      canonical._passthrough.readingStatusRaw = v1Book.readingStatus
    } else {
      canonical.tags.readingStatus = [{ id: `rs-${rsName}`, name: rsName }]
    }
  }

  // --- H3 / ADR-5：由 read 階段存入的 _passthrough 重建多值 / cover / carry ---
  rebuildFromPassthrough(canonical, v1Book._passthrough)

  return canonical
}

// cover(str) → {original}；若 _passthrough.cover 帶其餘尺寸由 rebuildFromPassthrough 併入
function objectifyCover (v1Book) {
  if (typeof v1Book.cover === 'string' && v1Book.cover !== '') {
    return { original: v1Book.cover }
  }
  if (isPlainObject(v1Book.cover)) {
    return { ...v1Book.cover }
  }
  return {}
}

// progress(num) → {percentage}；併入 progressInfo 多欄位
function objectifyProgress (v1Book) {
  const result = {}
  if (typeof v1Book.progress === 'number') {
    result.percentage = v1Book.progress
  } else if (isPlainObject(v1Book.progress)) {
    Object.assign(result, v1Book.progress)
  }
  if (isPlainObject(v1Book.progressInfo)) {
    Object.assign(result, v1Book.progressInfo)
  }
  return result
}

// 單值固定欄位 → 單元素 tag 陣列（undefined/空 → []）
function wrapSingle (value, prefix) {
  if (value === undefined || value === null || value === '') return []
  return [{ id: genTagId(prefix, value), name: value }]
}

// tagIds 圖 → custom tag node（carry id 語意，TD-2：name 解析屬 .2.2 接線）
function mapTagIdsToCustom (tagIds) {
  if (!Array.isArray(tagIds)) return []
  return tagIds.map((tagId) => ({ id: tagId, name: tagId }))
}

// 將 v1Book 既有欄位 carry 至 target（present 才設）
function carryIfPresent (target, source, fields) {
  for (const field of fields) {
    if (source && source[field] !== undefined) {
      target[field] = source[field]
    }
  }
}

// H3 / ADR-5：write 端優先用 read 階段保留的 _passthrough 重建完整資訊
function rebuildFromPassthrough (canonical, pt) {
  if (!isPlainObject(pt)) return // V1 出發路徑：無 passthrough，保留單元素 tag

  // 多值 tag：優先用完整陣列覆蓋單元素版本（U17/U18）
  if (isPlainObject(pt.tags)) {
    for (const category of MULTI_VALUE_TAG_CATEGORIES) {
      if (Array.isArray(pt.tags[category])) {
        canonical.tags[category] = pt.tags[category]
      }
    }
    // author 不收斂，但其 tag id 經 _passthrough 還原（canonical 出發 round-trip，U17）
    if (Array.isArray(pt.tags.author)) {
      canonical.tags.author = pt.tags.author
    }
    // carry 類 tag：read 端存於 pt → write 還原（U15/U17）
    for (const category of CARRY_TAG_CATEGORIES) {
      if (pt.tags[category] !== undefined) {
        canonical.tags[category] = pt.tags[category]
      }
    }
  }

  // cover 多尺寸：pt.cover 含 {thumbnail,medium} → 與 original 合併（U19）
  if (isPlainObject(pt.cover)) {
    canonical.cover = { ...pt.cover, ...canonical.cover }
  }

  // 固定欄位 carry（activeLoan/crossPlatformId/dataFingerprint/extensions）
  carryIfPresent(canonical, pt, ['activeLoan', 'crossPlatformId', 'dataFingerprint', 'extensions'])

  // readingStatusRaw：未知態還原（B15）
  if (pt.readingStatusRaw !== undefined) {
    canonical.tags.readingStatus = [{ id: `rs-${pt.readingStatusRaw}`, name: pt.readingStatusRaw }]
  }
}

// =============================================================================
// read 方向：mapCanonicalToV1Book（canonical → V1 內部 v2，供 .2.2）
// =============================================================================

/**
 * 將 canonical book 映射為 V1 內部 v2 book model。
 *
 * 多值收斂（§A / ADR-5）：多值 tag 還原至 V1 單值固定欄位時，首元素入固定欄位，
 * 其餘 + 完整陣列入 _passthrough（C1，禁丟失，為 round-trip 前提）。
 *
 * @param {Object} canonical - canonical book
 * @returns {Object} V1 內部 v2 book model
 * @throws {BookValidationError} 非 object 或缺 id/title
 */
function mapCanonicalToV1Book (canonical) {
  assertBookHasIdTitle(canonical)

  const v1 = {
    id: canonical.id, // 保留禁重生（C4）
    title: canonical.title,
    _passthrough: {}
  }

  const t = isPlainObject(canonical.tags) ? canonical.tags : {}

  // author 多值全保留（不收斂，§A author 例外，U17/C-U17）；B12 缺→[]
  // V1 authors[] 僅承載 name；為使 canonical 出發 round-trip（U17）保留 tag id 無損（C1），
  // 將原始 author tag 陣列存入 _passthrough（write 端優先讀以還原 id），不影響 authors[] 顯示。
  v1.authors = Array.isArray(t.author) ? t.author.map((node) => node.name) : []
  if (Array.isArray(t.author) && t.author.length > 0) {
    v1._passthrough.tags = v1._passthrough.tags || {}
    v1._passthrough.tags.author = t.author
  }

  // 多值收斂（§A / ADR-5）：首元素入固定欄位，其餘 + 完整陣列入 _passthrough（C1）
  convergeMultiValue(v1, 'source', t.platform, 'platform') // U18
  convergeMultiValue(v1, 'publisher', t.publisher, 'publisher')
  convergeIsbn(v1, t.isbn) // isbn 入 identifiers.isbn

  // readingStatus 逆正規化（§7），passthrough 責任在此 caller（§E）
  if (Array.isArray(t.readingStatus) && t.readingStatus.length > 0) {
    const rsName = t.readingStatus[0].name
    const v1Status = normalizeReadingStatusFromCanonical(rsName)
    if (v1Status === null) {
      // 未知態（B13/F 防禦）— 記 passthrough，不臆造 readingStatus
      v1._passthrough.readingStatusRaw = rsName
    } else {
      v1.readingStatus = v1Status
    }
  }

  // custom → tagIds 圖（U13）
  v1.tagIds = Array.isArray(t.custom) ? t.custom.map((node) => node.id) : []

  // 固定欄位還原 + 多尺寸/多欄位收斂
  convergeCover(v1, canonical.cover) // U19
  convergeProgress(v1, canonical.progress) // U20
  carryIfPresent(v1, canonical, ['createdAt', 'updatedAt'])

  // 不還原（V1 carry+display）→ 進 _passthrough（不重推、不丟失，C1，U15）
  for (const category of CARRY_TAG_CATEGORIES) {
    if (Array.isArray(t[category]) && t[category].length > 0) {
      v1._passthrough.tags = v1._passthrough.tags || {}
      v1._passthrough.tags[category] = t[category]
    }
  }
  carryIfPresent(v1._passthrough, canonical, ['activeLoan', 'crossPlatformId', 'dataFingerprint', 'extensions'])

  return v1
}

// §A 多值收斂通用規則：首元素入固定欄位，length>1 時完整陣列存 passthrough
function convergeMultiValue (target, fieldName, tagArray, passthroughKey) {
  if (!Array.isArray(tagArray) || tagArray.length === 0) return // B12 安全降級
  target[fieldName] = tagArray[0].name
  if (tagArray.length > 1) {
    target._passthrough.tags = target._passthrough.tags || {}
    target._passthrough.tags[passthroughKey] = tagArray // 完整陣列（C1，B16）
  }
}

// isbn 收斂入 identifiers.isbn（巢狀欄位）
function convergeIsbn (v1, isbnTags) {
  if (!Array.isArray(isbnTags) || isbnTags.length === 0) return
  v1.identifiers = v1.identifiers || {}
  v1.identifiers.isbn = isbnTags[0].name
  if (isbnTags.length > 1) {
    v1._passthrough.tags = v1._passthrough.tags || {}
    v1._passthrough.tags.isbn = isbnTags
  }
}

// cover：original→cover(str)，其餘尺寸→_passthrough.cover（U19）
function convergeCover (v1, cover) {
  if (typeof cover === 'string') {
    v1.cover = cover
    return
  }
  if (!isPlainObject(cover)) return
  if (cover.original !== undefined) v1.cover = cover.original
  const rest = {}
  for (const [key, value] of Object.entries(cover)) {
    if (key !== 'original') rest[key] = value
  }
  if (Object.keys(rest).length > 0) {
    v1._passthrough.cover = rest
  }
}

// progress：percentage→progress(num)，其餘→progressInfo（U20）
function convergeProgress (v1, progress) {
  if (typeof progress === 'number') {
    v1.progress = progress
    return
  }
  if (!isPlainObject(progress)) return
  if (progress.percentage !== undefined) v1.progress = progress.percentage
  const info = {}
  for (const [key, value] of Object.entries(progress)) {
    if (key !== 'percentage') info[key] = value
  }
  if (Object.keys(info).length > 0) {
    v1.progressInfo = info
  }
}

// =============================================================================
// buildTagTree（樹結構聚合，spec §6，ADR-4）
// =============================================================================

/**
 * 由多本 canonical book 的 ccl/custom tag node 聚合扁平樹節點陣列。
 *
 * 依 path 拆解階層推導 parentId，同 id 去重；ccl locked:true、custom locked:false（§6）。
 *
 * @param {Array} books - canonical book 陣列
 * @returns {{ ccl: Array, custom: Array }} 扁平 tree node 陣列
 */
function buildTagTree (books) {
  if (!Array.isArray(books)) return { ccl: [], custom: [] } // B17 安全降級

  const cclMap = new Map()
  const customMap = new Map()

  for (const book of books) {
    if (!book || !isPlainObject(book.tags)) continue
    accumulateTree(cclMap, book.tags.ccl, true) // ccl locked:true（U22）
    accumulateTree(customMap, book.tags.custom, false) // custom locked:false（U22）
  }

  return { ccl: Array.from(cclMap.values()), custom: Array.from(customMap.values()) }
}

function accumulateTree (treeMap, nodes, locked) {
  if (!Array.isArray(nodes)) return
  for (const node of nodes) {
    if (!node || !node.id) continue
    const segments = typeof node.path === 'string' && node.path !== ''
      ? node.path.split('/')
      : [node.name]

    segments.forEach((seg, i) => {
      const isLeaf = i === segments.length - 1
      const nodeId = isLeaf ? node.id : deriveStableId(segments.slice(0, i + 1))
      const parentId = i === 0 ? null : deriveStableId(segments.slice(0, i))
      if (!treeMap.has(nodeId)) {
        treeMap.set(nodeId, { id: nodeId, name: seg, parentId, locked })
      }
    })
  }
}

module.exports = {
  mapV1BookToCanonical,
  mapCanonicalToV1Book,
  normalizeReadingStatusToCanonical,
  normalizeReadingStatusFromCanonical,
  buildTagTree
}
