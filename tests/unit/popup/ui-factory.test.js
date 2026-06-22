/**
 * ui-factory 工廠函式單元測試 — ticket 1.2.0-W2-003.1
 *
 * 驗證 6 個工廠函式產出的 DOM 元素 class 與結構，與 popup.html 既有
 * 元件一致（不新增 CSS，純 DOM API 動態建立可替換元件）。
 */

const {
  createButton,
  createCard,
  createStatusIndicator,
  createProgressSection,
  createResultsSection,
  createErrorSection
} = require('../../../src/popup/components/ui-factory')

describe('ui-factory', () => {
  describe('createButton', () => {
    test('primary variant 產出 button.primary', () => {
      const btn = createButton({ variant: 'primary', text: '提取' })
      expect(btn.tagName).toBe('BUTTON')
      expect(btn.classList.contains('button')).toBe(true)
      expect(btn.classList.contains('primary')).toBe(true)
      expect(btn.textContent).toBe('提取')
    })

    test('secondary variant 產出 button.secondary', () => {
      const btn = createButton({ variant: 'secondary', text: '設定' })
      expect(btn.classList.contains('secondary')).toBe(true)
    })

    test('danger variant 產出 button.danger', () => {
      const btn = createButton({ variant: 'danger', text: '刪除' })
      expect(btn.classList.contains('danger')).toBe(true)
    })

    test('size=small 加上 small class', () => {
      const btn = createButton({ variant: 'secondary', text: '匯出', size: 'small' })
      expect(btn.classList.contains('small')).toBe(true)
    })

    test('size 預設 normal 不加 small class', () => {
      const btn = createButton({ variant: 'primary', text: '提取' })
      expect(btn.classList.contains('small')).toBe(false)
    })

    test('缺少 variant 時拋出錯誤', () => {
      expect(() => createButton({ text: '無 variant' })).toThrow()
    })

    test('id / ariaLabel / disabled 正確套用', () => {
      const btn = createButton({
        variant: 'primary',
        text: '提取',
        id: 'extractBtn',
        ariaLabel: '開始提取',
        disabled: true
      })
      expect(btn.id).toBe('extractBtn')
      expect(btn.getAttribute('aria-label')).toBe('開始提取')
      expect(btn.disabled).toBe(true)
    })

    test('onClick callback 綁定後可觸發', () => {
      const onClick = jest.fn()
      const btn = createButton({ variant: 'primary', text: '提取', onClick })
      btn.click()
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('createCard', () => {
    test('default variant 產出 status-card', () => {
      const card = createCard({})
      expect(card.tagName).toBe('DIV')
      expect(card.classList.contains('status-card')).toBe(true)
      expect(card.classList.contains('error-card')).toBe(false)
    })

    test('error variant 加上 error-card class', () => {
      const card = createCard({ variant: 'error' })
      expect(card.classList.contains('error-card')).toBe(true)
    })

    test('title 建立 strong header', () => {
      const card = createCard({ title: '提取結果' })
      const strong = card.querySelector('strong')
      expect(strong).not.toBeNull()
      expect(strong.textContent).toBe('提取結果')
    })

    test('content 為字串時包進 info-text', () => {
      const card = createCard({ content: '這是內容' })
      const infoText = card.querySelector('.info-text')
      expect(infoText).not.toBeNull()
      expect(infoText.textContent).toBe('這是內容')
    })

    test('content 為 HTMLElement 時直接放入', () => {
      const span = document.createElement('span')
      span.textContent = '元素內容'
      const card = createCard({ content: span })
      expect(card.contains(span)).toBe(true)
    })

    test('actions 放入 action-buttons 容器', () => {
      const btn = createButton({ variant: 'primary', text: '確定' })
      const card = createCard({ actions: [btn] })
      const actionsContainer = card.querySelector('.action-buttons')
      expect(actionsContainer).not.toBeNull()
      expect(actionsContainer.contains(btn)).toBe(true)
    })

    test('id 正確套用', () => {
      const card = createCard({ id: 'resultsContainer' })
      expect(card.id).toBe('resultsContainer')
    })
  })

  describe('createStatusIndicator', () => {
    test('產出含 status-dot + statusText + statusInfo 的容器', () => {
      const el = createStatusIndicator({ type: 'loading', text: '檢查中', info: '請稍候' })
      expect(el.querySelector('.status-dot')).not.toBeNull()
      const indicator = el.querySelector('.status-indicator')
      expect(indicator).not.toBeNull()
      const info = el.querySelector('.info-text')
      expect(info).not.toBeNull()
    })

    test('type=loading 時 status-dot 含 loading class', () => {
      const el = createStatusIndicator({ type: 'loading', text: '檢查中' })
      const dot = el.querySelector('.status-dot')
      expect(dot.classList.contains('loading')).toBe(true)
    })

    test('type=error 時 status-dot 含 error class', () => {
      const el = createStatusIndicator({ type: 'error', text: '失敗' })
      const dot = el.querySelector('.status-dot')
      expect(dot.classList.contains('error')).toBe(true)
    })

    test('type=ready 時 status-dot 不含 loading/error class', () => {
      const el = createStatusIndicator({ type: 'ready', text: '就緒' })
      const dot = el.querySelector('.status-dot')
      expect(dot.classList.contains('loading')).toBe(false)
      expect(dot.classList.contains('error')).toBe(false)
    })

    test('text / info 正確顯示', () => {
      const el = createStatusIndicator({ type: 'ready', text: '就緒', info: '可開始提取' })
      expect(el.textContent).toContain('就緒')
      expect(el.textContent).toContain('可開始提取')
    })
  })

  describe('createProgressSection', () => {
    test('產出含 progress-bar 與 progress-fill 的完整區塊', () => {
      const el = createProgressSection({ percentage: 50, text: '提取中' })
      expect(el.querySelector('.progress-header')).not.toBeNull()
      expect(el.querySelector('.progress-bar-container')).not.toBeNull()
      expect(el.querySelector('.progress-bar')).not.toBeNull()
      expect(el.querySelector('.progress-fill')).not.toBeNull()
    })

    test('progress-fill 寬度反映 percentage', () => {
      const el = createProgressSection({ percentage: 75 })
      const fill = el.querySelector('.progress-fill')
      expect(fill.style.width).toBe('75%')
    })

    test('progress-bar 設定 ARIA progressbar 屬性', () => {
      const el = createProgressSection({ percentage: 30 })
      const bar = el.querySelector('.progress-bar')
      expect(bar.getAttribute('role')).toBe('progressbar')
      expect(bar.getAttribute('aria-valuemin')).toBe('0')
      expect(bar.getAttribute('aria-valuemax')).toBe('100')
      expect(bar.getAttribute('aria-valuenow')).toBe('30')
    })

    test('text 顯示於進度文字區', () => {
      const el = createProgressSection({ percentage: 10, text: '準備開始' })
      expect(el.textContent).toContain('準備開始')
    })

    test('percentage 顯示百分比', () => {
      const el = createProgressSection({ percentage: 42 })
      expect(el.textContent).toContain('42%')
    })
  })

  describe('createResultsSection', () => {
    test('產出含書籍數 / 時間 / 成功率的結果區塊', () => {
      const el = createResultsSection({ bookCount: 120, time: '3s', successRate: '98%' })
      expect(el.classList.contains('status-card')).toBe(true)
      expect(el.querySelector('.results-header')).not.toBeNull()
      expect(el.textContent).toContain('120')
      expect(el.textContent).toContain('3s')
      expect(el.textContent).toContain('98%')
    })

    test('onExport / onView callback 綁定後可觸發', () => {
      const onExport = jest.fn()
      const onView = jest.fn()
      const el = createResultsSection({
        bookCount: 1,
        time: '1s',
        successRate: '100%',
        onExport,
        onView
      })
      const buttons = el.querySelectorAll('.action-buttons button')
      expect(buttons.length).toBe(2)
      buttons[0].click()
      buttons[1].click()
      expect(onExport).toHaveBeenCalledTimes(1)
      expect(onView).toHaveBeenCalledTimes(1)
    })
  })

  describe('createErrorSection', () => {
    test('產出含錯誤訊息 / 重試 / 重載按鈕的錯誤卡片', () => {
      const el = createErrorSection({ message: '提取失敗' })
      expect(el.classList.contains('status-card')).toBe(true)
      expect(el.classList.contains('error-card')).toBe(true)
      expect(el.querySelector('.error-header')).not.toBeNull()
      const msg = el.querySelector('.error-message')
      expect(msg.textContent).toBe('提取失敗')
      const buttons = el.querySelectorAll('.action-buttons button')
      expect(buttons.length).toBe(2)
    })

    test('onRetry / onReload callback 綁定後可觸發', () => {
      const onRetry = jest.fn()
      const onReload = jest.fn()
      const el = createErrorSection({ message: '失敗', onRetry, onReload })
      const buttons = el.querySelectorAll('.action-buttons button')
      buttons[0].click()
      buttons[1].click()
      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onReload).toHaveBeenCalledTimes(1)
    })

    test('suggestions 有值時建立 ol 清單', () => {
      const el = createErrorSection({
        message: '失敗',
        suggestions: ['重新整理頁面', '檢查登入狀態']
      })
      const list = el.querySelector('ol')
      expect(list).not.toBeNull()
      expect(list.querySelectorAll('li').length).toBe(2)
      expect(list.textContent).toContain('重新整理頁面')
    })

    test('suggestions 為空時不建立 ol 清單', () => {
      const el = createErrorSection({ message: '失敗' })
      expect(el.querySelector('ol')).toBeNull()
    })
  })
})
