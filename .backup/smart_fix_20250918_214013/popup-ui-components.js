/**
 * Popup UI 組件管理器 - TDD 循環 #25
 *
 * 負責功能：
 * - 管理 Popup 界面的各種 UI 組件
 * - 提供狀態顯示、進度條、結果展示、錯誤訊息等組件功能
 * - 統一的 UI 狀態管理和批量更新
 * - 支援無障礙功能和響應式設計
 *
 * 設計考量：
 * - 組件化設計，每個功能獨立管理
 * - 統一的狀態管理介面
 * - 支援動畫和視覺回饋
 * - 確保無障礙使用體驗
 * - 錯誤處理和邊界條件管理
 *
 * 使用情境：
 * - Popup 界面的 UI 狀態管理
 * - 與 PopupEventController 配合使用
 * - 提供統一的視覺回饋體驗
 */

// 常數定義
const STATUS_TYPES = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error'
}

const UI_VISIBILITY = {
  VISIBLE: 'block',
  HIDDEN: 'none'
}

const PROGRESS_BOUNDS = {
  MIN: 0,
  MAX: 100
}

class PopupUIComponents {
  /**
   * 建構 Popup UI 組件管理器
   *
   * @param {Document} document - DOM 文檔物件
   *
   * 負責功能：
   * - 初始化 DOM 元素引用
   * - 設定默認狀態
   * - 配置無障礙功能
   */
  constructor (document) {
    this.document = document

    // 初始化 DOM 元素引用
    this.initializeElements()

    // 設定無障礙標籤
    this.setAccessibilityLabels()
  }

  /**
   * 初始化 DOM 元素引用
   *
   * 負責功能：
   * - 取得所有必要的 DOM 元素引用
   * - 建立元素快取以提高效能
   * - 分類組織元素引用
   */
  initializeElements () {
    // 狀態相關元素
    this.statusElements = {
      dot: this.document.getElementById('statusDot'),
      text: this.document.getElementById('statusText'),
      info: this.document.getElementById('statusInfo')
    }

    // 進度相關元素
    this.progressElements = {
      container: this.document.getElementById('progressContainer'),
      percentage: this.document.getElementById('progressPercentage'),
      text: this.document.getElementById('progressText'),
      bar: this.document.getElementById('progressBar'),
      fill: this.document.querySelector('.progress-fill')
    }

    // 結果相關元素
    this.resultsElements = {
      container: this.document.getElementById('resultsContainer'),
      bookCount: this.document.getElementById('extractedBookCount'),
      time: this.document.getElementById('extractionTime'),
      successRate: this.document.getElementById('successRate'),
      exportBtn: this.document.getElementById('exportBtn'),
      viewBtn: this.document.getElementById('viewResultsBtn')
    }

    // 錯誤相關元素
    this.errorElements = {
      container: this.document.getElementById('errorContainer'),
      message: this.document.getElementById('errorMessage'),
      retryBtn: this.document.getElementById('retryBtn'),
      reportBtn: this.document.getElementById('reportBtn')
    }

    // 保持向後相容性
    this.statusDot = this.statusElements.dot
    this.statusText = this.statusElements.text
    this.statusInfo = this.statusElements.info
    this.progressContainer = this.progressElements.container
    this.progressPercentage = this.progressElements.percentage
    this.progressText = this.progressElements.text
    this.progressBar = this.progressElements.bar
    this.progressFill = this.progressElements.fill
    this.resultsContainer = this.resultsElements.container
    this.extractedBookCount = this.resultsElements.bookCount
    this.extractionTime = this.resultsElements.time
    this.successRate = this.resultsElements.successRate
    this.exportBtn = this.resultsElements.exportBtn
    this.viewResultsBtn = this.resultsElements.viewBtn
    this.errorContainer = this.errorElements.container
    this.errorMessage = this.errorElements.message
    this.retryBtn = this.errorElements.retryBtn
    this.reportBtn = this.errorElements.reportBtn
  }

  /**
   * 更新狀態指示器
   *
   * @param {string} type - 狀態類型 ('loading', 'ready', 'error')
   * @param {string} text - 狀態文字
   * @param {string} info - 詳細資訊
   *
   * 負責功能：
   * - 更新狀態點的視覺樣式
   * - 更新狀態文字和詳細資訊
   * - 處理狀態轉換動畫
   */
  updateStatus (type, text, info) {
    const { dot, text: textElement, info: infoElement } = this.statusElements

    if (!dot || !textElement || !infoElement) {
      return
    }

    // 清除所有狀態類別
    Object.values(STATUS_TYPES).forEach(statusType => {
      dot.classList.remove(statusType)
    })

    // 添加新的狀態類別
    if (type && Object.values(STATUS_TYPES).includes(type)) {
      dot.classList.add(type)
    }

    // 更新文字內容
    if (text) {
      textElement.textContent = text
    }

    if (info) {
      infoElement.textContent = info
    }
  }

  /**
   * 顯示進度容器
   *
   * 負責功能：
   * - 顯示進度條區域
   * - 重置進度狀態
   */
  showProgress () {
    this._setElementVisibility(this.progressElements.container, true)
  }

  /**
   * 隱藏進度容器
   *
   * 負責功能：
   * - 隱藏進度條區域
   */
  hideProgress () {
    this._setElementVisibility(this.progressElements.container, false)
  }

  /**
   * 設定元素可見性的統一方法
   *
   * @param {HTMLElement} element - 要操作的元素
   * @param {boolean} visible - 是否可見
   * @private
   */
  _setElementVisibility (element, visible) {
    if (element) {
      element.style.display = visible ? UI_VISIBILITY.VISIBLE : UI_VISIBILITY.HIDDEN
    }
  }

  /**
   * 更新進度條和進度資訊
   *
   * @param {number} percentage - 百分比進度 (0-100)
   * @param {string} status - 進度狀態文字
   * @param {string} text - 詳細進度文字
   *
   * 負責功能：
   * - 更新進度條視覺進度
   * - 更新進度百分比顯示
   * - 更新進度文字訊息
   * - 處理邊界值限制
   */
  updateProgress (percentage, status, text) {
    const { percentage: percentageElement, text: textElement, bar, fill } = this.progressElements

    // 限制進度在 0-100 範圍內
    const clampedPercentage = this._clampValue(percentage, PROGRESS_BOUNDS.MIN, PROGRESS_BOUNDS.MAX)

    // 更新進度百分比顯示
    if (percentageElement) {
      percentageElement.textContent = `${clampedPercentage}%`
    }

    // 更新進度條寬度
    if (fill) {
      fill.style.width = `${clampedPercentage}%`
    }

    // 更新進度文字
    if (textElement && text) {
      textElement.textContent = text
    }

    // 更新無障礙屬性
    if (bar) {
      bar.setAttribute('aria-valuenow', clampedPercentage)
    }
  }

  /**
   * 限制數值在指定範圍內的工具方法
   *
   * @param {number} value - 要限制的值
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {number} 限制後的值
   * @private
   */
  _clampValue (value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  /**
   * 更新元素文字內容的工具方法
   *
   * @param {HTMLElement} element - 要更新的元素
   * @param {string} content - 新的文字內容
   * @private
   */
  _updateTextContent (element, content) {
    if (element && content !== undefined && content !== null) {
      element.textContent = content
    }
  }

  /**
   * 設定按鈕狀態的工具方法
   *
   * @param {HTMLButtonElement} button - 按鈕元素
   * @param {boolean} disabled - 是否禁用
   * @private
   */
  _setButtonState (button, disabled) {
    if (button) {
      button.disabled = disabled
    }
  }

  /**
   * 顯示提取結果
   *
   * @param {Object} resultData - 結果資料
   * @param {number} resultData.bookCount - 書籍數量
   * @param {string} resultData.extractionTime - 提取時間
   * @param {string} resultData.successRate - 成功率
   *
   * 負責功能：
   * - 顯示結果容器
   * - 更新結果資料顯示
   * - 啟用操作按鈕
   */
  showResults (resultData) {
    if (!resultData) return

    const { container, bookCount, time, successRate, exportBtn, viewBtn } = this.resultsElements

    // 顯示結果容器
    this._setElementVisibility(container, true)

    // 更新結果資料
    this._updateTextContent(bookCount, resultData.bookCount?.toString())
    this._updateTextContent(time, resultData.extractionTime)
    this._updateTextContent(successRate, resultData.successRate)

    // 啟用操作按鈕
    this._setButtonState(exportBtn, false)
    this._setButtonState(viewBtn, false)
  }

  /**
   * 隱藏結果容器
   *
   * 負責功能：
   * - 隱藏結果顯示區域
   */
  hideResults () {
    this._setElementVisibility(this.resultsElements.container, false)
  }

  /**
   * 顯示錯誤訊息
   *
   * @param {string} message - 錯誤訊息
   *
   * 負責功能：
   * - 顯示錯誤容器
   * - 更新錯誤訊息文字
   */
  showError (message) {
    const { container, message: messageElement } = this.errorElements

    this._setElementVisibility(container, true)
    this._updateTextContent(messageElement, message)
  }

  /**
   * 隱藏錯誤容器
   *
   * 負責功能：
   * - 隱藏錯誤顯示區域
   */
  hideError () {
    this._setElementVisibility(this.errorElements.container, false)
  }

  /**
   * 設定錯誤操作按鈕的事件處理器
   *
   * @param {Function} retryCallback - 重試按鈕回調函數
   * @param {Function} reportCallback - 回報按鈕回調函數
   *
   * 負責功能：
   * - 設定重試按鈕事件監聽器
   * - 設定回報按鈕事件監聽器
   */
  setErrorHandlers (retryCallback, reportCallback) {
    const { retryBtn, reportBtn } = this.errorElements

    this._addEventListener(retryBtn, 'click', retryCallback)
    this._addEventListener(reportBtn, 'click', reportCallback)
  }

  /**
   * 安全地為元素添加事件監聽器的工具方法
   *
   * @param {HTMLElement} element - 目標元素
   * @param {string} event - 事件類型
   * @param {Function} callback - 回調函數
   * @private
   */
  _addEventListener (element, event, callback) {
    if (element && typeof callback === 'function') {
      element.addEventListener(event, callback)
    }
  }

  /**
   * 重置所有 UI 組件狀態
   *
   * 負責功能：
   * - 隱藏所有動態容器
   * - 重置狀態為初始值
   * - 清除進度和結果資料
   */
  resetAll () {
    // 隱藏所有容器
    this.hideProgress()
    this.hideResults()
    this.hideError()

    // 重置狀態
    this.updateStatus('loading', '檢查狀態中...', '初始化中')

    // 重置進度
    this.updateProgress(0, '', '準備開始...')

    // 重置結果按鈕
    if (this.exportBtn) {
      this.exportBtn.disabled = true
    }

    if (this.viewResultsBtn) {
      this.viewResultsBtn.disabled = true
    }
  }

  /**
   * 批量更新 UI 狀態
   *
   * @param {Object} config - 更新配置
   * @param {Object} config.status - 狀態更新配置
   * @param {Object} config.progress - 進度更新配置
   * @param {Object} config.results - 結果更新配置
   * @param {Object} config.error - 錯誤更新配置
   *
   * 負責功能：
   * - 根據配置批量更新多個 UI 組件
   * - 提供統一的狀態管理介面
   */
  updateUI (config) {
    if (!config) return

    // 更新狀態
    if (config.status) {
      this.updateStatus(config.status.type, config.status.text, config.status.info)
    }

    // 更新進度
    if (config.progress) {
      if (config.progress.visible) {
        this.showProgress()
        if (config.progress.percentage !== undefined) {
          this.updateProgress(config.progress.percentage, '', config.progress.text)
        }
      } else {
        this.hideProgress()
      }
    }

    // 更新結果
    if (config.results) {
      if (config.results.visible && config.results.data) {
        this.showResults(config.results.data)
      } else if (config.results.visible === false) {
        this.hideResults()
      }
    }

    // 更新錯誤
    if (config.error) {
      if (config.error.visible && config.error.message) {
        this.showError(config.error.message)
      } else if (config.error.visible === false) {
        this.hideError()
      }
    }
  }

  /**
   * 設定無障礙標籤和屬性
   *
   * 負責功能：
   * - 為 UI 組件添加 ARIA 標籤
   * - 設定語意化的無障礙屬性
   * - 確保螢幕閱讀器相容性
   */
  setAccessibilityLabels () {
    // 設定進度條的無障礙屬性
    if (this.progressBar) {
      this.progressBar.setAttribute('role', 'progressbar')
      this.progressBar.setAttribute('aria-valuemin', '0')
      this.progressBar.setAttribute('aria-valuemax', '100')
      this.progressBar.setAttribute('aria-valuenow', '0')
      this.progressBar.setAttribute('aria-label', '提取進度')
    }

    // 設定狀態區域的標籤
    if (this.statusText) {
      this.statusText.setAttribute('aria-live', 'polite')
      this.statusText.setAttribute('aria-label', '目前狀態')
    }

    // 設定錯誤區域的標籤
    if (this.errorMessage) {
      this.errorMessage.setAttribute('role', 'alert')
      this.errorMessage.setAttribute('aria-live', 'assertive')
    }
  }
}

// CommonJS 匯出
module.exports = { PopupUIComponents }
