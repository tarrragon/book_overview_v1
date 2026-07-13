/**
 * ui-factory — 全 Extension 共用 UI 元件工廠（無狀態純函式）
 *
 * 以純 DOM API 動態建立 UI 元件，class 名稱對齊
 * src/core/design-system/component-rules.js 的元件樣式規則
 * （design-system.css 的 SSOT 來源，不新增 CSS），使元件可程式化組裝、替換。
 * CommonJS 匯出與 popup-ui-components.js 一致，供 jsdom 測試環境與
 * esbuild bundle 共用。
 *
 * 對應 ticket 1.2.0-W2-003.1（建立）、1.5.0-W6-002（升格至 core）。
 */

// variant 命名契約對齊 APP 端跨平台元件對照表（design-system-spec.md §14.6，
// contract-version: v1）：primary=AppButton.action、confirm=AppButton.confirm
// （token positive，v1 沿用 color-success）、danger=AppButton.caution（token
// negative，v1 沿用 color-error）、secondary=AppButton.neutral、ghost=
// AppButton.ghost（token transparent）。既有 primary/secondary/danger 依契約
// 規則保留為既有別名，不重命名（1.5.0-W6-003）。
const BUTTON_VARIANTS = ['primary', 'secondary', 'danger', 'confirm', 'ghost']
// size 命名契約對齊 §14.6（雙端共用 small/medium/large）。'normal' 為 v1
// 既有呼叫點（popup.js 等）沿用的歷史別名，保留相容並映射為 medium 的
// 視覺表現（無額外 class，同 .button 基準樣式）。
const BUTTON_SIZES = { NORMAL: 'normal', SMALL: 'small', MEDIUM: 'medium', LARGE: 'large' }
const STATUS_DOT_CLASS = { loading: 'loading', error: 'error', ready: null }
// variant 命名契約對齊 §14.6：分隔 | AppDivider.subtle/.normal/.strong |
// createDivider({variant:'subtle'/'normal'/'strong'}) | dividerSubtle/Normal/Strong
const DIVIDER_VARIANTS = ['subtle', 'normal', 'strong']
// variant 命名契約對齊 §14.6：AppDialog.confirm/.alert ↔ createDialog（1.5.0-W6-022）
const DIALOG_VARIANTS = ['confirm', 'alert']
// variant 命名契約對齊 §14.6：AppBadge.success/.warning/.info/.muted ↔ createBadge
// （1.5.0-W6-023）。V1 既有 6 閱讀狀態（overview .reading-status-badge 的
// data-status 屬性）非 1:1 對應四契約 variant，映射設計見該 ticket Solution。
const BADGE_VARIANTS = ['success', 'warning', 'info', 'muted']
// 無自訂 actions 時的預設按鈕組。cancel/dismiss 統一以 value:null 表示「無結果」，
// 與 Esc / 遮罩點擊的 resolve(null) 語意一致（單一「取消」判斷點，呼叫端不需分辨來源）。
const DEFAULT_DIALOG_ACTIONS = {
  confirm: [
    { value: 'confirm', text: '確認', variant: 'primary' },
    { value: null, text: '取消', variant: 'secondary' }
  ],
  alert: [
    { value: null, text: '確定', variant: 'primary' }
  ]
}

let dialogElementIdSeq = 0
/**
 * 產生 dialog 內部元素的唯一 id（title/description aria 對應用）。
 * @param {string} prefix
 * @returns {string}
 * @private
 */
function generateDialogElementId (prefix) {
  dialogElementIdSeq += 1
  return `${prefix}-${dialogElementIdSeq}`
}

/**
 * 建立按鈕元素。
 *
 * @param {Object} options
 * @param {'primary'|'secondary'|'danger'|'confirm'|'ghost'} options.variant - 必填
 * @param {string} [options.text] - 按鈕文字
 * @param {string} [options.id] - DOM id
 * @param {string} [options.ariaLabel] - aria-label 屬性
 * @param {Function} [options.onClick] - click callback
 * @param {boolean} [options.disabled] - 是否禁用
 * @param {'normal'|'small'|'medium'|'large'} [options.size='normal'] - 尺寸（normal 為 medium 歷史別名）
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
  } else if (size === BUTTON_SIZES.LARGE) {
    button.classList.add('large')
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

/**
 * 建立分割陰影元素（取代分隔線，1.5.0-W6-004，spec §8.2/§14.2）。
 * 以 box-shadow 呈現分隔語意，不使用 border，命名對齊 APP AppDivider。
 *
 * @param {Object} options
 * @param {'subtle'|'normal'|'strong'} options.variant - 必填
 * @returns {HTMLDivElement}
 */
function createDivider ({ variant } = {}) {
  if (!DIVIDER_VARIANTS.includes(variant)) {
    throw new Error(`createDivider: variant 必須為 ${DIVIDER_VARIANTS.join('/')}，收到 ${variant}`)
  }

  const divider = document.createElement('div')
  divider.classList.add('divider', `divider-${variant}`)
  return divider
}

/**
 * 建立徽章元素（契約 §14.6：AppBadge.success/.warning/.info/.muted ↔ createBadge）。
 *
 * @param {Object} options
 * @param {'success'|'warning'|'info'|'muted'} [options.variant='info']
 * @param {string} [options.text] - 徽章文字
 * @param {string} [options.dataStatus] - 選填，設定 data-status 屬性，供保留
 *   status-specific 色值變體使用（如 overview 6 閱讀狀態，見 BADGE_VARIANTS 註解）
 * @returns {HTMLSpanElement}
 */
function createBadge ({ variant = 'info', text, dataStatus } = {}) {
  if (!BADGE_VARIANTS.includes(variant)) {
    throw new Error(`createBadge: variant 必須為 ${BADGE_VARIANTS.join('/')}，收到 ${variant}`)
  }

  const badge = document.createElement('span')
  badge.classList.add('badge', `badge--${variant}`)
  if (text !== undefined) badge.textContent = text
  if (dataStatus) badge.dataset.status = dataStatus

  return badge
}

/**
 * 建立對話框元素與生命週期控制器（契約 §14.6：AppDialog.confirm/.alert ↔ createDialog）。
 *
 * 與其他 ui-factory 函式（回傳純 HTMLElement）不同，dialog 天生需要生命週期管理
 * （show → user action → close → resolve），故回傳 { overlay, open() } 複合物件——
 * ui-factory 首個「元件+控制器」模式。overlay 需由呼叫端掛載至 DOM（如
 * document.body.appendChild(dialog.overlay)），resolve 後呼叫端負責移除。
 *
 * @param {Object} options
 * @param {'confirm'|'alert'} options.variant - 必填
 * @param {string} [options.title] - 對話框標題（渲染為 h2.modal-title）
 * @param {string|HTMLElement} [options.message] - 訊息內容；HTMLElement 直接插入（不包 p 標籤）
 * @param {Array<{value: *, text: string, variant?: string}>} [options.actions]
 *   按鈕清單。未提供時 confirm 預設 [確認/取消]、alert 預設 [確定]（皆以 value:null
 *   表示取消/確定，與 Esc / 遮罩點擊 resolve(null) 語意一致）
 * @param {Object} [options.aria] - 無障礙屬性覆蓋
 * @param {string} [options.aria.labelledby] - title 元素 id 覆蓋值
 * @param {string} [options.aria.describedby] - description 元素 id 覆蓋值
 * @returns {{ overlay: HTMLElement, open: () => Promise<*> }}
 *   overlay 為完整 DOM 樹（遮罩+對話框+按鈕）；open() 顯示對話框並回傳 Promise，
 *   resolve(actionValue) 於按鈕點擊，resolve(null) 於 Esc / 遮罩點擊。
 */
function createDialog ({ variant, title, message, actions, aria } = {}) {
  if (!DIALOG_VARIANTS.includes(variant)) {
    throw new Error(`createDialog: variant 必須為 ${DIALOG_VARIANTS.join('/')}，收到 ${variant}`)
  }

  const resolvedActions = actions || DEFAULT_DIALOG_ACTIONS[variant]

  const overlay = document.createElement('div')
  overlay.classList.add('modal-overlay')
  overlay.style.display = 'none'

  const dialogEl = document.createElement('div')
  dialogEl.classList.add('modal-dialog')
  dialogEl.setAttribute('role', 'dialog')
  dialogEl.setAttribute('aria-modal', 'true')

  if (title !== undefined) {
    const titleEl = document.createElement('h2')
    titleEl.classList.add('modal-title')
    titleEl.id = (aria && aria.labelledby) || generateDialogElementId('dialog-title')
    titleEl.textContent = title
    dialogEl.appendChild(titleEl)
    dialogEl.setAttribute('aria-labelledby', titleEl.id)
  }

  if (message !== undefined) {
    if (message instanceof HTMLElement) {
      dialogEl.appendChild(message)
    } else {
      const descEl = document.createElement('p')
      descEl.classList.add('modal-description')
      descEl.id = (aria && aria.describedby) || generateDialogElementId('dialog-desc')
      descEl.textContent = message
      dialogEl.appendChild(descEl)
      dialogEl.setAttribute('aria-describedby', descEl.id)
    }
  }

  const actionsContainer = document.createElement('div')
  actionsContainer.classList.add('modal-actions')

  // settle 於 open() 內賦值；按鈕 onClick 透過閉包引用最新賦值（single-instance 模式核心）
  let settle = () => {}
  resolvedActions.forEach(action => {
    const btn = createButton({
      variant: action.variant || 'secondary',
      text: action.text,
      onClick: () => settle(action.value)
    })
    actionsContainer.appendChild(btn)
  })
  dialogEl.appendChild(actionsContainer)
  overlay.appendChild(dialogEl)

  let pendingPromise = null
  let previousFocusEl = null

  function open () {
    if (pendingPromise) return pendingPromise

    previousFocusEl = document.activeElement
    overlay.style.display = 'flex'

    const buttons = Array.from(actionsContainer.querySelectorAll('button'))
    if (buttons[0]) buttons[0].focus()

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        settle(null)
        return
      }
      if (event.key === 'Tab') {
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault()
            last.focus()
          }
        } else if (document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    const handleOverlayClick = (event) => {
      if (event.target === overlay) settle(null)
    }

    dialogEl.addEventListener('keydown', handleKeydown)
    overlay.addEventListener('click', handleOverlayClick)

    pendingPromise = new Promise((resolve) => {
      settle = (value) => {
        dialogEl.removeEventListener('keydown', handleKeydown)
        overlay.removeEventListener('click', handleOverlayClick)
        overlay.style.display = 'none'
        if (previousFocusEl && typeof previousFocusEl.focus === 'function') {
          previousFocusEl.focus()
        }
        pendingPromise = null
        resolve(value)
      }
    })

    return pendingPromise
  }

  return { overlay, open }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createButton,
    createCard,
    createStatusIndicator,
    createProgressSection,
    createResultsSection,
    createErrorSection,
    createBookstoreNavSection,
    createDivider,
    createDialog,
    createBadge
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
    createBookstoreNavSection,
    createDivider,
    createDialog,
    createBadge
  }
}
