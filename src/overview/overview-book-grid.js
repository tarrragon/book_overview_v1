/**
 * overview 封面網格：與表格共用同一份 filteredBooks 與選取狀態
 *
 * 表格（#tableBody）照舊渲染，網格是另一種呈現；兩者的勾選都走
 * controller.handleRowCheckboxToggle，所以匯出、全選看到的是同一組選取。
 */

const SAFE_URL = /^https?:\/\//i

/**
 * @param {HTMLElement} container - 網格的 <ul>
 * @param {Array} books
 * @param {Object} opts
 * @param {Document} opts.document
 * @param {(book) => ?string} opts.getId
 * @param {(id: string) => boolean} opts.isSelected
 * @param {(id: string) => void} opts.onToggleSelect
 * @param {(book) => {title, authors, authorIsMissing, source, statusValue, statusLabel, progress}} opts.format
 * @param {(tagIds: string[]) => HTMLElement} opts.createTagCell
 */
function renderBookGrid (container, books, opts) {
  if (!container) return
  container.textContent = ''
  const { document } = opts
  const fragment = document.createDocumentFragment()
  for (const book of books) fragment.appendChild(createCard(book, opts))
  container.appendChild(fragment)
}

function createCard (book, opts) {
  const { document } = opts
  const data = opts.format(book)
  const id = opts.getId(book)

  const card = document.createElement('li')
  card.className = 'book-card'
  if (id) card.dataset.bookId = id

  const cover = document.createElement('div')
  cover.className = 'book-card-cover'
  if (book.cover && SAFE_URL.test(book.cover)) {
    const img = document.createElement('img')
    img.src = book.cover
    img.alt = ''
    img.loading = 'lazy'
    cover.appendChild(img)
  } else {
    cover.classList.add('book-card-cover--empty')
    const fallback = document.createElement('span')
    fallback.textContent = data.title
    cover.appendChild(fallback)
  }

  if (id) {
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.className = 'card-checkbox'
    checkbox.dataset.bookId = id
    checkbox.setAttribute('aria-label', `選取《${data.title}》`)
    checkbox.checked = opts.isSelected(id)
    if (checkbox.checked) card.classList.add('is-selected')
    checkbox.addEventListener('change', () => {
      opts.onToggleSelect(id)
      card.classList.toggle('is-selected', opts.isSelected(id))
    })
    cover.appendChild(checkbox)
    // 點封面任一處都切換選取；勾選框平時隱藏，封面是較大的點擊目標
    cover.addEventListener('click', (e) => {
      if (e.target !== checkbox) checkbox.click()
    })
  }
  card.appendChild(cover)

  const title = document.createElement('h3')
  title.className = 'book-card-title'
  title.textContent = data.title
  title.title = data.title
  card.appendChild(title)

  const author = document.createElement('p')
  author.className = 'book-card-author'
  author.textContent = data.authorIsMissing ? '作者未提供' : data.authors
  card.appendChild(author)

  const progress = document.createElement('div')
  progress.className = 'book-card-progress'
  const track = document.createElement('span')
  track.className = 'progress-track'
  track.setAttribute('role', 'progressbar')
  track.setAttribute('aria-valuemin', '0')
  track.setAttribute('aria-valuemax', '100')
  track.setAttribute('aria-valuenow', String(data.progress))
  track.setAttribute('aria-label', '閱讀進度')
  const fill = document.createElement('span')
  fill.className = 'progress-fill'
  fill.style.width = `${data.progress}%`
  track.appendChild(fill)
  const value = document.createElement('span')
  value.className = 'progress-value'
  value.textContent = `${data.progress}%`
  progress.append(track, value)
  card.appendChild(progress)

  const meta = document.createElement('div')
  meta.className = 'book-card-meta'
  const badge = document.createElement('span')
  badge.className = 'reading-status-badge'
  if (data.statusValue) badge.dataset.status = data.statusValue
  badge.textContent = data.statusLabel
  const source = document.createElement('span')
  source.className = 'book-card-source'
  source.textContent = data.source
  meta.append(badge, source)
  card.appendChild(meta)

  const tagIds = book.tagIds || []
  if (tagIds.length > 0) {
    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'book-card-tags-toggle'
    toggle.setAttribute('aria-expanded', 'false')
    toggle.textContent = `標籤 ${tagIds.length}`
    const panel = document.createElement('div')
    panel.className = 'book-card-tags'
    panel.hidden = true
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true'
      if (!open && panel.childNodes.length === 0) {
        const cell = opts.createTagCell(tagIds)
        while (cell.firstChild) panel.appendChild(cell.firstChild)
      }
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true')
      panel.hidden = open
    })
    card.append(toggle, panel)
  }

  return card
}

module.exports = { renderBookGrid }
