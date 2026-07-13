/**
 * createDialog 工廠函式單元測試 — ticket 1.5.0-W6-022
 *
 * 驗證 createDialog 產出的對話框 DOM 結構、行為規格與生命週期控制器。
 * 對應 Phase 1 功能規格（§14.6 契約：AppDialog.confirm/.alert ↔ createDialog）。
 *
 * 測試群組：
 * - A：DOM 結構與 variant 驗證
 * - B：confirm variant 行為（按鈕 resolve / Esc / 遮罩）
 * - C：alert variant 行為
 * - D：焦點管理（初始焦點 / 焦點陷阱 / 焦點還原）
 * - E：單實例保護
 * - F：variant 驗證與錯誤處理
 *
 * @jest-environment jsdom
 */

const {
  createDialog
} = require('../../../../../src/core/ui/components/ui-factory')

describe('createDialog', () => {
  describe('Group A: DOM 結構', () => {
    test('A1: confirm variant 回傳 overlay + open 函式', () => {
      const dialog = createDialog({ variant: 'confirm', title: '確認', message: '確定嗎？' })
      expect(dialog).toHaveProperty('overlay')
      expect(dialog).toHaveProperty('open')
      expect(typeof dialog.open).toBe('function')
      expect(dialog.overlay).toBeInstanceOf(HTMLElement)
    })

    test('A2: overlay 含 modal-overlay class', () => {
      const { overlay } = createDialog({ variant: 'confirm', title: '測試' })
      expect(overlay.classList.contains('modal-overlay')).toBe(true)
    })

    test('A3: dialog 容器具備 role="dialog" 與 aria-modal="true"', () => {
      const { overlay } = createDialog({ variant: 'confirm', title: '測試' })
      const dialogEl = overlay.querySelector('[role="dialog"]')
      expect(dialogEl).not.toBeNull()
      expect(dialogEl.getAttribute('aria-modal')).toBe('true')
    })

    test('A4: dialog 含 modal-dialog class', () => {
      const { overlay } = createDialog({ variant: 'confirm', title: '測試' })
      const dialogEl = overlay.querySelector('.modal-dialog')
      expect(dialogEl).not.toBeNull()
    })

    test('A5: title 渲染為 h2.modal-title 且 aria-labelledby 對應', () => {
      const { overlay } = createDialog({ variant: 'confirm', title: '我的標題' })
      const titleEl = overlay.querySelector('h2.modal-title')
      expect(titleEl).not.toBeNull()
      expect(titleEl.textContent).toBe('我的標題')

      const dialogEl = overlay.querySelector('[role="dialog"]')
      expect(dialogEl.getAttribute('aria-labelledby')).toBe(titleEl.id)
    })

    test('A6: message 渲染為 p.modal-description 且 aria-describedby 對應', () => {
      const { overlay } = createDialog({ variant: 'confirm', title: '標題', message: '說明文字' })
      const descEl = overlay.querySelector('p.modal-description')
      expect(descEl).not.toBeNull()
      expect(descEl.textContent).toBe('說明文字')

      const dialogEl = overlay.querySelector('[role="dialog"]')
      expect(dialogEl.getAttribute('aria-describedby')).toBe(descEl.id)
    })

    test('A7: actions 建立對應按鈕於 .modal-actions 容器', () => {
      const { overlay } = createDialog({
        variant: 'confirm',
        title: '標題',
        actions: [
          { value: 'yes', text: '是', variant: 'primary' },
          { value: 'no', text: '否', variant: 'secondary' }
        ]
      })
      const actionsContainer = overlay.querySelector('.modal-actions')
      expect(actionsContainer).not.toBeNull()
      const buttons = actionsContainer.querySelectorAll('button')
      expect(buttons.length).toBe(2)
      expect(buttons[0].textContent).toBe('是')
      expect(buttons[1].textContent).toBe('否')
    })

    test('A8: confirm variant 無自訂 actions 時使用預設確認/取消', () => {
      const { overlay } = createDialog({ variant: 'confirm', title: '確認' })
      const buttons = overlay.querySelectorAll('.modal-actions button')
      expect(buttons.length).toBe(2)
    })

    test('A9: alert variant 無自訂 actions 時使用單一 dismiss 按鈕', () => {
      const { overlay } = createDialog({ variant: 'alert', title: '警告' })
      const buttons = overlay.querySelectorAll('.modal-actions button')
      expect(buttons.length).toBe(1)
    })

    test('A10: overlay 初始 display 為 none', () => {
      const { overlay } = createDialog({ variant: 'confirm', title: '測試' })
      expect(overlay.style.display).toBe('none')
    })

    test('A11: message 為 HTMLElement 時直接插入（非 textContent）', () => {
      const customEl = document.createElement('div')
      customEl.className = 'custom-content'
      customEl.textContent = '自訂內容'

      const { overlay } = createDialog({ variant: 'confirm', title: '標題', message: customEl })
      // message 為 HTMLElement 時應作為子元素或替代 p 元素
      const found = overlay.querySelector('.custom-content')
      expect(found).not.toBeNull()
    })
  })

  describe('Group B: confirm variant 行為', () => {
    let dialog

    beforeEach(() => {
      dialog = createDialog({
        variant: 'confirm',
        title: '確認操作',
        message: '確定要繼續嗎？',
        actions: [
          { value: 'proceed', text: '繼續', variant: 'primary' },
          { value: null, text: '取消', variant: 'secondary' }
        ]
      })
      document.body.appendChild(dialog.overlay)
    })

    afterEach(() => {
      dialog.overlay.remove()
    })

    test('B1: open() 回傳 Promise', () => {
      const result = dialog.open()
      expect(result).toBeInstanceOf(Promise)
      // resolve to avoid hanging
      dialog.overlay.querySelector('.modal-actions button').click()
    })

    test('B2: open() 後 overlay display 不為 none', async () => {
      const promise = dialog.open()
      expect(dialog.overlay.style.display).not.toBe('none')
      dialog.overlay.querySelector('.modal-actions button').click()
      await promise
    })

    test('B3: 點擊 action 按鈕 resolve 對應 value', async () => {
      const promise = dialog.open()
      const buttons = dialog.overlay.querySelectorAll('.modal-actions button')
      buttons[0].click() // value: 'proceed'
      const result = await promise
      expect(result).toBe('proceed')
    })

    test('B4: 點擊取消按鈕（value:null）resolve null', async () => {
      const promise = dialog.open()
      const buttons = dialog.overlay.querySelectorAll('.modal-actions button')
      buttons[1].click() // value: null
      const result = await promise
      expect(result).toBeNull()
    })

    test('B5: Esc 鍵 resolve null', async () => {
      const promise = dialog.open()
      const dialogEl = dialog.overlay.querySelector('.modal-dialog')
      dialogEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      const result = await promise
      expect(result).toBeNull()
    })

    test('B6: 點擊遮罩（overlay 本身）resolve null', async () => {
      const promise = dialog.open()
      dialog.overlay.dispatchEvent(new MouseEvent('click', { bubbles: false }))
      const result = await promise
      expect(result).toBeNull()
    })

    test('B7: 點擊 dialog 內部不觸發遮罩 dismiss（冒泡防護）', async () => {
      const promise = dialog.open()
      const dialogEl = dialog.overlay.querySelector('.modal-dialog')
      // 模擬點擊 dialog 內部冒泡到 overlay
      const event = new MouseEvent('click', { bubbles: true })
      Object.defineProperty(event, 'target', { value: dialogEl })
      dialog.overlay.dispatchEvent(event)
      // Promise 不應 resolve（dialog 仍開啟）
      // 用按鈕關閉以避免懸掛
      const buttons = dialog.overlay.querySelectorAll('.modal-actions button')
      buttons[0].click()
      const result = await promise
      expect(result).toBe('proceed')
    })

    test('B8: resolve 後 overlay display 恢復為 none', async () => {
      const promise = dialog.open()
      const buttons = dialog.overlay.querySelectorAll('.modal-actions button')
      buttons[0].click()
      await promise
      expect(dialog.overlay.style.display).toBe('none')
    })
  })

  describe('Group C: alert variant 行為', () => {
    let dialog

    beforeEach(() => {
      dialog = createDialog({
        variant: 'alert',
        title: '提示',
        message: '操作完成'
      })
      document.body.appendChild(dialog.overlay)
    })

    afterEach(() => {
      dialog.overlay.remove()
    })

    test('C1: dismiss 按鈕 resolve null', async () => {
      const promise = dialog.open()
      const btn = dialog.overlay.querySelector('.modal-actions button')
      btn.click()
      const result = await promise
      expect(result).toBeNull()
    })

    test('C2: Esc 鍵 resolve null', async () => {
      const promise = dialog.open()
      const dialogEl = dialog.overlay.querySelector('.modal-dialog')
      dialogEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      const result = await promise
      expect(result).toBeNull()
    })

    test('C3: 遮罩點擊 resolve null', async () => {
      const promise = dialog.open()
      dialog.overlay.dispatchEvent(new MouseEvent('click', { bubbles: false }))
      const result = await promise
      expect(result).toBeNull()
    })
  })

  describe('Group D: 焦點管理', () => {
    let dialog, previousFocusEl

    beforeEach(() => {
      previousFocusEl = document.createElement('button')
      previousFocusEl.textContent = '觸發按鈕'
      document.body.appendChild(previousFocusEl)
      previousFocusEl.focus()

      dialog = createDialog({
        variant: 'confirm',
        title: '焦點測試',
        actions: [
          { value: 'a', text: '按鈕A', variant: 'primary' },
          { value: 'b', text: '按鈕B', variant: 'secondary' },
          { value: null, text: '取消', variant: 'secondary' }
        ]
      })
      document.body.appendChild(dialog.overlay)
    })

    afterEach(() => {
      dialog.overlay.remove()
      previousFocusEl.remove()
    })

    test('D1: open() 後初始焦點移至第一個 action 按鈕', async () => {
      const promise = dialog.open()
      const firstBtn = dialog.overlay.querySelectorAll('.modal-actions button')[0]
      expect(document.activeElement).toBe(firstBtn)
      firstBtn.click()
      await promise
    })

    test('D2: resolve 後焦點還原至 open() 前的 activeElement', async () => {
      const promise = dialog.open()
      const firstBtn = dialog.overlay.querySelectorAll('.modal-actions button')[0]
      firstBtn.click()
      await promise
      expect(document.activeElement).toBe(previousFocusEl)
    })

    test('D3: Tab 在最後一個按鈕時循環至第一個（焦點陷阱）', async () => {
      const promise = dialog.open()
      const buttons = dialog.overlay.querySelectorAll('.modal-actions button')
      const lastBtn = buttons[buttons.length - 1]
      lastBtn.focus()

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      Object.defineProperty(tabEvent, 'shiftKey', { value: false })
      const preventDefaultSpy = jest.spyOn(tabEvent, 'preventDefault')

      const dialogEl = dialog.overlay.querySelector('.modal-dialog')
      dialogEl.dispatchEvent(tabEvent)

      // 焦點應被攔截循環至第一個按鈕
      expect(preventDefaultSpy).toHaveBeenCalled()

      buttons[0].click()
      await promise
    })

    test('D4: Shift+Tab 在第一個按鈕時循環至最後一個', async () => {
      const promise = dialog.open()
      const buttons = dialog.overlay.querySelectorAll('.modal-actions button')
      buttons[0].focus()

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
      const preventDefaultSpy = jest.spyOn(tabEvent, 'preventDefault')

      const dialogEl = dialog.overlay.querySelector('.modal-dialog')
      dialogEl.dispatchEvent(tabEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()

      buttons[0].click()
      await promise
    })
  })

  describe('Group E: 單實例保護', () => {
    let dialog

    beforeEach(() => {
      dialog = createDialog({ variant: 'confirm', title: '單實例測試' })
      document.body.appendChild(dialog.overlay)
    })

    afterEach(() => {
      dialog.overlay.remove()
    })

    test('E1: 重複呼叫 open() 回傳同一 Promise 物件', () => {
      const p1 = dialog.open()
      const p2 = dialog.open()
      expect(p1).toBe(p2)
      // 清理
      dialog.overlay.querySelector('.modal-actions button').click()
    })

    test('E2: resolve 後再次呼叫 open() 產生新 Promise', async () => {
      const p1 = dialog.open()
      dialog.overlay.querySelector('.modal-actions button').click()
      await p1

      const p2 = dialog.open()
      expect(p2).not.toBe(p1)
      dialog.overlay.querySelector('.modal-actions button').click()
      await p2
    })
  })

  describe('Group F: 錯誤處理', () => {
    test('F1: 不合法 variant 拋出 Error', () => {
      expect(() => createDialog({ variant: 'invalid' })).toThrow()
    })

    test('F2: 未提供 variant 拋出 Error', () => {
      expect(() => createDialog({ title: '無 variant' })).toThrow()
    })
  })
})
