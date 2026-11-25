/**
 * overview 左側篩選欄：書目的分組依據與本數
 *
 * 閱讀狀態、書城、重要程度、標籤四組。重要程度是 APP 的七級 importanceLevel，
 * 本頁唯讀（spec book-interchange-v1 §5.1：V1 carry+display、不編輯）；
 * 值來自 book.importanceLevel，或 APP 匯入時存進的 _passthrough.tags.importance。
 */

const STATUS_ORDER = ['reading', 'queued', 'unread', 'finished', 'abandoned', 'reference']

const STATUS_LABELS = {
  unread: '未讀',
  queued: '待讀',
  reading: '閱讀中',
  finished: '讀完',
  abandoned: '放棄',
  reference: '參考'
}

const PLATFORM_LABELS = {
  readmoo: 'Readmoo',
  books_com_tw: '博客來',
  kobo: 'Kobo',
  bookwalker: 'BOOKWALKER',
  kindle: 'Kindle'
}

// spec book-interchange-v1 §5.1 的 imp-1 到 imp-7
const IMPORTANCE_LABELS = {
  'imp-1': '參考書',
  'imp-2': '重讀收藏',
  'imp-3': '文獻保存',
  'imp-4': '推薦分享',
  'imp-5': '收藏價值',
  'imp-6': '裝飾展示',
  'imp-7': '可清理'
}

const UNSET = '__unset__'

// 舊資料沒有 source 也沒有書城 tag 時，沿用表格一直以來的預設（readmoo）
const DEFAULT_PLATFORM = 'readmoo'

function getPlatformId (book) {
  if (!book) return DEFAULT_PLATFORM
  if (book.source && PLATFORM_LABELS[book.source]) return book.source
  if (Array.isArray(book.tags)) {
    const hit = book.tags.find(t => PLATFORM_LABELS[t])
    if (hit) return hit
  }
  if (book.store && PLATFORM_LABELS[book.store]) return book.store
  return book.source || DEFAULT_PLATFORM
}

function getPlatformLabel (platformId) {
  return PLATFORM_LABELS[platformId] || String(platformId)
}

function getStatusLabel (status) {
  return STATUS_LABELS[status] || status
}

function getImportanceId (book) {
  if (!book) return null
  const level = book.importanceLevel
  if (typeof level === 'number' && level >= 1 && level <= 7) return `imp-${level}`
  const nodes = book._passthrough && book._passthrough.tags && book._passthrough.tags.importance
  if (Array.isArray(nodes)) {
    const hit = nodes.find(n => n && IMPORTANCE_LABELS[n.id])
    if (hit) return hit.id
  }
  return null
}

function countBy (books, keyOf) {
  const counts = new Map()
  for (const book of books) {
    const key = keyOf(book)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return counts
}

/**
 * 依全部書目算出四組的項目與本數（本數不隨其他組的篩選變動）
 * @param {Array} books
 * @param {Map<string, {name: string}>} tagMap
 * @returns {{status: Array, platform: Array, importance: Array, tags: Array}}
 */
function buildFacetModel (books, tagMap) {
  const list = Array.isArray(books) ? books : []

  const statusCounts = countBy(list, b => b.readingStatus || 'unread')
  const status = STATUS_ORDER
    .filter(s => statusCounts.get(s))
    .map(s => ({ value: s, label: STATUS_LABELS[s], count: statusCounts.get(s) }))

  const platformCounts = countBy(list, getPlatformId)
  const platform = [...platformCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, label: getPlatformLabel(value), count }))

  const importanceCounts = countBy(list, b => getImportanceId(b) || UNSET)
  const importance = Object.keys(IMPORTANCE_LABELS)
    .filter(id => importanceCounts.get(id))
    .map(id => ({ value: id, label: IMPORTANCE_LABELS[id], count: importanceCounts.get(id) }))
  if (importanceCounts.get(UNSET)) {
    importance.push({ value: UNSET, label: '未設定', count: importanceCounts.get(UNSET) })
  }

  const tagCounts = new Map()
  for (const book of list) {
    for (const id of (book.tagIds || [])) {
      if (tagMap && tagMap.has(id)) tagCounts.set(id, (tagCounts.get(id) || 0) + 1)
    }
  }
  const tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || String(tagMap.get(a[0]).name).localeCompare(String(tagMap.get(b[0]).name)))
    .map(([value, count]) => ({ value, label: tagMap.get(value).name, count }))

  return { status, platform, importance, tags }
}

function matchesImportance (book, importanceFilter) {
  if (!importanceFilter) return true
  const id = getImportanceId(book)
  return importanceFilter === UNSET ? id === null : id === importanceFilter
}

/**
 * 渲染篩選欄
 * @param {HTMLElement} container
 * @param {Object} model - buildFacetModel 的結果
 * @param {{status: ?string, platform: ?string, importance: ?string, tags: Set<string>}} active
 * @param {{total: number, onSelect: Function, onClear: Function}} options
 * @param {Document} document
 */
function renderFacetPanel (container, model, active, options, document) {
  if (!container) return
  container.textContent = ''

  const anyActive = Boolean(active.status || active.platform || active.importance || active.tags.size)

  const allBtn = createItem(document, '全部書目', options.total, !anyActive)
  allBtn.classList.add('facet-item--all')
  allBtn.addEventListener('click', () => options.onClear())
  container.appendChild(allBtn)

  const groups = [
    { key: 'status', title: '閱讀狀態', items: model.status },
    { key: 'platform', title: '書城', items: model.platform },
    { key: 'importance', title: '重要程度', items: model.importance },
    { key: 'tags', title: '標籤', items: model.tags }
  ]

  for (const group of groups) {
    if (group.items.length === 0) continue
    const section = document.createElement('section')
    section.className = 'facet-group'
    section.setAttribute('aria-label', group.title)
    const heading = document.createElement('h2')
    heading.className = 'facet-title'
    heading.textContent = group.title
    section.appendChild(heading)

    for (const item of group.items) {
      const pressed = group.key === 'tags' ? active.tags.has(item.value) : active[group.key] === item.value
      const btn = createItem(document, item.label, item.count, pressed)
      btn.dataset.facet = group.key
      btn.dataset.value = item.value
      btn.addEventListener('click', () => options.onSelect(group.key, item.value))
      section.appendChild(btn)
    }
    container.appendChild(section)
  }
}

function createItem (document, label, count, pressed) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'facet-item'
  btn.setAttribute('aria-pressed', pressed ? 'true' : 'false')
  const name = document.createElement('span')
  name.className = 'facet-name'
  name.textContent = label
  const num = document.createElement('span')
  num.className = 'facet-count'
  num.textContent = String(count)
  btn.append(name, num)
  return btn
}

module.exports = {
  STATUS_LABELS,
  PLATFORM_LABELS,
  IMPORTANCE_LABELS,
  UNSET,
  getPlatformId,
  getPlatformLabel,
  getStatusLabel,
  getImportanceId,
  buildFacetModel,
  matchesImportance,
  renderFacetPanel
}
