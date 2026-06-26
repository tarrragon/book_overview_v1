/**
 * ui-factory — Popup UI 元件工廠（無狀態純函式）
 *
 * 以純 DOM API 動態建立 popup 元件，class 名稱與 popup.html 既有 `<style>`
 * 完全一致（不新增 CSS），使元件可程式化組裝、替換。CommonJS 匯出與
 * popup-ui-components.js 一致，供 jsdom 測試環境與 esbuild bundle 共用。
 *
 * 對應 ticket 1.2.0-W2-003.1。
 */

const BUTTON_VARIANTS = ['primary', 'secondary', 'danger']
const BUTTON_SIZES = { NORMAL: 'normal', SMALL: 'small' }
const STATUS_DOT_CLASS = { loading: 'loading', error: 'error', ready: null }

/**
 * 建立按鈕元素。
 *
 * @param {Object} options
 * @param {'primary'|'secondary'|'danger'} options.variant - 必填
 * @param {string} [options.text] - 按鈕文字
 * @param {string} [options.id] - DOM id
 * @param {string} [options.ariaLabel] - aria-label 屬性
 * @param {Function} [options.onClick] - click callback
 * @param {boolean} [options.disabled] - 是否禁用
 * @param {'normal'|'small'} [options.size='normal'] - 尺寸
 * @returns {HTMLButtonElement}
 */
function createButton ({ variant, text, id, ariaLabel, onClick, disabled, size = BUTTON_SIZES.NORMAL } = {}) {
  if (!BUTTON_VARIANTS.includes(variant)) {
    throw new Error(`createButton: variant 必須為 ${BUTTON_VARIANTS.join('/')}，收到 ${variant}`)
  }

  const button = document.createElement('button')
  button.classList.add('button', variant)
  if (size === BUTTON_SIZES.SMALL) {
    button.classList.add('small')
  }

  if (text !== undefined) button.textContent = text
  if (id) button.id = id
  if (ariaLabel) button.setAttribute('aria-label', ariaLabel)
  if (disabled) button.disabled = true
  if (typeof onClick === 'function') button.addEventListener('click', onClick)

  return button
}

/**
 * 建立卡片容器。
 *
 * @param {Object} options
 * @param {'default'|'error'} [options.variant='default']
 * @param {string} [options.title] - 卡片標題（建立 strong header）
 * @param {string} [options.id] - DOM id
 * @param {HTMLElement|string} [options.content] - 內容（字串包進 info-text）
 * @param {HTMLElement[]} [options.actions] - 操作按鈕（放入 action-buttons）
 * @returns {HTMLDivElement}
 */
function createCard ({ variant = 'default', title, id, content, actions } = {}) {
  const card = document.createElement('div')
  card.classList.add('status-card')
  if (variant === 'error') {
    card.classList.add('error-card')
  }
  if (id) card.id = id

  if (title !== undefined) {
    const header = document.createElement('div')
    header.classList.add(variant === 'error' ? 'error-header' : 'results-header')
    const strong = document.createElement('strong')
    strong.textContent = title
    header.appendChild(strong)
    card.appendChild(header)
  }

  if (content !== undefined) {
    if (typeof content === 'string') {
      const infoText = document.createElement('div')
      infoText.classList.add('info-text')
      infoText.textContent = content
      card.appendChild(infoText)
    } else {
      card.appendChild(content)
    }
  }

  if (Array.isArray(actions) && actions.length > 0) {
    const actionContainer = document.createElement('div')
    actionContainer.classList.add('action-buttons')
    actions.forEach(action => actionContainer.appendChild(action))
    card.appendChild(actionContainer)
  }

  return card
}

/**
 * 建立狀態指示器容器。
 *
 * @param {Object} options
 * @param {'loading'|'ready'|'error'} options.type
 * @param {string} [options.text] - 狀態文字
 * @param {string} [options.info] - 詳細資訊
 * @returns {HTMLDivElement}
 */
function createStatusIndicator ({ type, text, info } = {}) {
  const container = document.createElement('div')
  container.classList.add('status-card')

  const indicator = document.createElement('div')
  indicator.classList.add('status-indicator')

  const dot = document.createElement('div')
  dot.classList.add('status-dot')
  const dotModifier = STATUS_DOT_CLASS[type]
  if (dotModifier) {
    dot.classList.add(dotModifier)
  }

  const textSpan = document.createElement('span')
  if (text !== undefined) textSpan.textContent = text

  indicator.appendChild(dot)
  indicator.appendChild(textSpan)
  container.appendChild(indicator)

  const infoText = document.createElement('div')
  infoText.classList.add('info-text')
  if (info !== undefined) infoText.textContent = info
  container.appendChild(infoText)

  return container
}

/**
 * 建立進度區塊。
 *
 * @param {Object} options
 * @param {number} options.percentage - 0-100
 * @param {string} [options.text] - 進度文字
 * @returns {HTMLDivElement}
 */
function createProgressSection ({ percentage = 0, text } = {}) {
  const container = document.createElement('div')
  container.classList.add('status-card')

  const header = document.createElement('div')
  header.classList.add('progress-header')
  const strong = document.createElement('strong')
  strong.textContent = '提取進度'
  const percentageSpan = document.createElement('span')
  percentageSpan.textContent = `${percentage}%`
  header.appendChild(strong)
  header.appendChild(percentageSpan)
  container.appendChild(header)

  const barContainer = document.createElement('div')
  barContainer.classList.add('progress-bar-container')

  const bar = document.createElement('div')
  bar.classList.add('progress-bar')
  bar.setAttribute('role', 'progressbar')
  bar.setAttribute('aria-valuemin', '0')
  bar.setAttribute('aria-valuemax', '100')
  bar.setAttribute('aria-valuenow', String(percentage))

  const fill = document.createElement('div')
  fill.classList.add('progress-fill')
  fill.style.width = `${percentage}%`

  bar.appendChild(fill)
  barContainer.appendChild(bar)
  container.appendChild(barContainer)

  const progressText = document.createElement('div')
  progressText.classList.add('info-text')
  if (text !== undefined) progressText.textContent = text
  container.appendChild(progressText)

  return container
}

/**
 * 以 strong 標籤 + 純文字值的安全方式（textContent）附加一組「標籤: 值」，
 * 避免 innerHTML 拼接外部資料造成 XSS。
 *
 * @param {HTMLElement} parent
 * @param {string} label - 標籤文字（放入 strong）
 * @param {string|number} value - 值（純文字）
 * @param {string} [suffix=''] - 值後綴（如單位）
 * @private
 */
function appendLabeledValue (parent, label, value, suffix = '') {
  const strong = document.createElement('strong')
  strong.textContent = label
  parent.appendChild(strong)

  const valueSpan = document.createElement('span')
  valueSpan.textContent = ` ${value}`
  parent.appendChild(valueSpan)

  if (suffix) {
    parent.appendChild(document.createTextNode(suffix))
  }
}

/**
 * 建立提取結果區塊。
 *
 * @param {Object} options
 * @param {number} options.bookCount - 書籍數量
 * @param {string} options.time - 提取時間
 * @param {string} options.successRate - 成功率
 * @param {Function} [options.onExport] - 匯出按鈕 callback
 * @param {Function} [options.onView] - 查看按鈕 callback
 * @returns {HTMLDivElement}
 */
function createResultsSection ({ bookCount, time, successRate, onExport, onView } = {}) {
  const infoText = document.createElement('div')
  infoText.classList.add('info-text')
  appendLabeledValue(infoText, '已提取書籍:', bookCount, ' 本')
  infoText.appendChild(document.createElement('br'))
  appendLabeledValue(infoText, '提取時間:', time)
  infoText.appendChild(document.createElement('br'))
  appendLabeledValue(infoText, '成功率:', successRate)

  const exportBtn = createButton({ variant: 'secondary', text: '匯出資料', size: 'small', onClick: onExport })
  const viewBtn = createButton({ variant: 'secondary', text: '查看結果', size: 'small', onClick: onView })

  return createCard({
    variant: 'default',
    title: '提取結果',
    content: infoText,
    actions: [exportBtn, viewBtn]
  })
}

/**
 * 建立錯誤區塊。
 *
 * @param {Object} options
 * @param {string} options.message - 錯誤訊息
 * @param {Function} [options.onRetry] - 重試按鈕 callback
 * @param {Function} [options.onReload] - 重新載入按鈕 callback
 * @param {string[]} [options.suggestions] - 建議步驟清單
 * @returns {HTMLDivElement}
 */
function createErrorSection ({ message, onRetry, onReload, suggestions } = {}) {
  const errorMessage = document.createElement('div')
  errorMessage.classList.add('error-message')
  if (message !== undefined) errorMessage.textContent = message

  const retryBtn = createButton({ variant: 'primary', text: '重試', size: 'small', onClick: onRetry })
  const reloadBtn = createButton({ variant: 'secondary', text: '重新載入擴展', size: 'small', onClick: onReload })

  const card = createCard({
    variant: 'error',
    title: '錯誤訊息',
    content: errorMessage,
    actions: [retryBtn, reloadBtn]
  })

  if (Array.isArray(suggestions) && suggestions.length > 0) {
    const suggestionsContainer = document.createElement('div')
    suggestionsContainer.classList.add('error-suggestions')

    const infoText = document.createElement('div')
    infoText.classList.add('info-text')
    const strong = document.createElement('strong')
    strong.textContent = '建議解決步驟：'
    infoText.appendChild(strong)

    const list = document.createElement('ol')
    suggestions.forEach(suggestion => {
      const item = document.createElement('li')
      item.textContent = suggestion
      list.appendChild(item)
    })
    infoText.appendChild(list)
    suggestionsContainer.appendChild(infoText)
    card.appendChild(suggestionsContainer)
  }

  return card
}

/**
 * 建立書庫導航區塊。
 *
 * @param {Object} options
 * @param {Array<{id: string, name: string, url: string, enabled: boolean}>} options.bookstores
 * @param {string} [options.sectionTitle] - 區塊標題
 * @param {string} [options.ariaPrefix] - aria-label 前綴（+ bookstore name）
 * @param {Function} [options.onNavigate] - (bookstore) => void
 * @returns {HTMLDivElement}
 */
function createBookstoreNavSection ({ bookstores = [], sectionTitle, ariaPrefix = '', onNavigate } = {}) {
  const container = document.createElement('div')
  container.classList.add('status-card')
  container.id = 'bookstoreNavSection'

  const bodyId = 'bookstoreNavBody'

  if (sectionTitle) {
    const header = document.createElement('div')
    header.classList.add('collapsible-header')
    header.setAttribute('role', 'button')
    header.setAttribute('tabindex', '0')
    header.setAttribute('aria-expanded', 'false')
    header.setAttribute('aria-controls', bodyId)

    const strong = document.createElement('strong')
    strong.textContent = sectionTitle
    header.appendChild(strong)

    const chevron = document.createElement('span')
    chevron.classList.add('collapsible-chevron')
    chevron.textContent = '▼'
    header.appendChild(chevron)

    const toggleExpand = () => {
      const expanded = header.getAttribute('aria-expanded') === 'true'
      header.setAttribute('aria-expanded', String(!expanded))
      const body = container.querySelector('#' + bodyId)
      if (body) {
        body.classList.toggle('expanded', !expanded)
      }
    }

    header.addEventListener('click', toggleExpand)
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggleExpand()
      }
    })

    container.appendChild(header)
  }

  const body = document.createElement('div')
  body.id = bodyId
  body.classList.add('collapsible-body')

  const buttonContainer = document.createElement('div')
  buttonContainer.classList.add('action-buttons')

  const enabledStores = bookstores.filter(b => b.enabled)
  enabledStores.forEach(store => {
    const btn = createButton({
      variant: 'secondary',
      text: store.name,
      ariaLabel: ariaPrefix + store.name,
      onClick: typeof onNavigate === 'function' ? () => onNavigate(store) : undefined
    })
    btn.dataset.bookstoreId = store.id
    buttonContainer.appendChild(btn)
  })

  body.appendChild(buttonContainer)
  container.appendChild(body)
  return container
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createButton,
    createCard,
    createStatusIndicator,
    createProgressSection,
    createResultsSection,
    createErrorSection,
    createBookstoreNavSection
  }
}

if (typeof window !== 'undefined') {
  window.PopupUIFactory = {
    createButton,
    createCard,
    createStatusIndicator,
    createProgressSection,
    createResultsSection,
    createErrorSection,
    createBookstoreNavSection
  }
}
