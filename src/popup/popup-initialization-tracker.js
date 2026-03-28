console.log('[POPUP DEBUG] popup-initialization-tracker.js 已載入')
// 支援多環境載入（瀏覽器 / Node.js 測試環境）
let Logger, ErrorCodes
if (typeof require !== 'undefined') {
  try {
    ({ Logger } = require('src/core/logging/Logger'));
    ({ ErrorCodes } = require('src/core/errors/ErrorCodes'))
  } catch (e) {
    Logger = window.Logger || { warn () {}, error () {}, info () {}, debug () {} }
    ErrorCodes = window.ErrorCodes || { UNKNOWN_ERROR: 'UNKNOWN_ERROR', CHROME_ERROR: 'CHROME_ERROR' }
  }
} else {
  Logger = window.Logger || { warn () {}, error () {}, info () {}, debug () {} }
  ErrorCodes = window.ErrorCodes || { UNKNOWN_ERROR: 'UNKNOWN_ERROR', CHROME_ERROR: 'CHROME_ERROR' }
}
/**
 * Popup 初始化進度追蹤器
 *
 * 負責功能：
 * - 詳細追蹤初始化每一步的進度
 * - 提供視覺化的進度顯示
 * - 檢測初始化卡住的位置
 * - 提供初始化超時處理
 *
 * 使用情境：
 * - 診斷「正在檢查狀態...」卡住問題
 * - 提供詳細的初始化進度回饋
 * - 超時處理和錯誤恢復
 */

class PopupInitializationTracker {
  constructor () {
    this.steps = []
    this.currentStep = 0
    this.startTime = Date.now()
    this.stepTimeout = 10000 // 每步驟最多10秒
    this.totalTimeout = 30000 // 總計30秒
    this.isCompleted = false
    this.isFailed = false
    this.stepTimers = new Map()

    // 初始化步驟定義
    this.initializationSteps = [
      {
        id: 'dom_ready',
        name: 'DOM 載入',
        description: '等待頁面元素載入完成',
        timeout: 5000
      },
      {
        id: 'version_display',
        name: '版本資訊',
        description: '顯示擴展版本資訊',
        timeout: 2000
      },
      {
        id: 'error_handler',
        name: '錯誤處理器',
        description: '初始化錯誤處理系統',
        timeout: 3000
      },
      {
        id: 'diagnostic_enhancer',
        name: '診斷增強器',
        description: '載入診斷功能模組',
        timeout: 5000
      },
      {
        id: 'event_listeners',
        name: '事件監聽器',
        description: '設定使用者界面事件',
        timeout: 2000
      },
      {
        id: 'background_check',
        name: '背景服務檢查',
        description: '連接 Background Service Worker',
        timeout: 10000
      },
      {
        id: 'current_tab',
        name: '頁面檢查',
        description: '檢查當前標籤頁狀態',
        timeout: 5000
      },
      {
        id: 'finalization',
        name: '完成初始化',
        description: '完成所有初始化程序',
        timeout: 2000
      }
    ]
  }

  /**
   * 開始追蹤初始化過程
   */
  startTracking () {
    this.startTime = Date.now()
    this.currentStep = 0
    this.isCompleted = false
    this.isFailed = false
    this.steps = []

    // 設置總體超時
    this.totalTimer = setTimeout(() => {
      this.handleTotalTimeout()
    }, this.totalTimeout)

    this.updateProgressDisplay()
    return true
  }

  /**
   * 開始執行特定步驟
   */
  startStep (stepId, customName = null, customDescription = null) {
    const stepConfig = this.initializationSteps.find(s => s.id === stepId)
    if (!stepConfig && !customName) {
      // eslint-disable-next-line no-console
      Logger.error(`❌ [初始化追蹤] 未知步驟: ${stepId}`)
      return false
    }

    const step = {
      id: stepId,
      name: customName || stepConfig?.name || stepId,
      description: customDescription || stepConfig?.description || '',
      startTime: Date.now(),
      status: 'running',
      timeout: stepConfig?.timeout || this.stepTimeout
    }

    this.steps.push(step)
    this.currentStep = this.steps.length - 1

    // 更新進度顯示
    this.updateProgressDisplay()

    // 設置步驟超時
    const timeoutId = setTimeout(() => {
      this.handleStepTimeout(stepId)
    }, step.timeout)

    this.stepTimers.set(stepId, timeoutId)

    return true
  }

  /**
   * 完成步驟
   */
  completeStep (stepId, result = null) {
    const stepIndex = this.steps.findIndex(s => s.id === stepId)
    if (stepIndex === -1) {
      // eslint-disable-next-line no-console
      Logger.warn(`⚠️ [初始化追蹤] 步驟未找到: ${stepId}`)
      return false
    }

    const step = this.steps[stepIndex]
    step.status = 'completed'
    step.endTime = Date.now()
    step.duration = step.endTime - step.startTime
    step.result = result

    // 清除步驟超時
    if (this.stepTimers.has(stepId)) {
      clearTimeout(this.stepTimers.get(stepId))
      this.stepTimers.delete(stepId)
    }

    // 更新進度顯示
    this.updateProgressDisplay()

    // 檢查是否所有步驟完成
    if (this.steps.every(s => s.status === 'completed')) {
      this.completeInitialization()
    }

    return true
  }

  /**
   * 步驟失敗
   */
  failStep (stepId, error) {
    const stepIndex = this.steps.findIndex(s => s.id === stepId)
    if (stepIndex === -1) {
      // eslint-disable-next-line no-console
      Logger.warn(`⚠️ [初始化追蹤] 步驟未找到: ${stepId}`)
      return false
    }

    const step = this.steps[stepIndex]
    step.status = 'failed'
    step.endTime = Date.now()
    step.duration = step.endTime - step.startTime
    step.error = error

    // 清除步驟超時
    if (this.stepTimers.has(stepId)) {
      clearTimeout(this.stepTimers.get(stepId))
      this.stepTimers.delete(stepId)
    }

    // eslint-disable-next-line no-console
    Logger.error(`[初始化追蹤] 步驟失敗: ${step.name}`, { error })

    this.isFailed = true
    this.updateProgressDisplay()
    this.showFailureDetails(step)

    return true
  }

  /**
   * 處理步驟超時
   */
  handleStepTimeout (stepId) {
    // eslint-disable-next-line no-console
    Logger.error(`⏰ [初始化追蹤] 步驟超時: ${stepId}`)

    const step = this.steps.find(s => s.id === stepId)
    if (step) {
      const error = new Error(`步驟超時 (${step.timeout}ms)`)
      error.code = ErrorCodes.TIMEOUT_ERROR
      error.details = { category: 'general', stepId, timeout: step.timeout }
      this.failStep(stepId, error)
    }
  }

  /**
   * 處理總體超時
   */
  handleTotalTimeout () {
    // eslint-disable-next-line no-console
    Logger.error('⏰ [初始化追蹤] 初始化總體超時')

    this.isFailed = true

    // 清除所有步驟超時
    for (const timeoutId of this.stepTimers.values()) {
      clearTimeout(timeoutId)
    }
    this.stepTimers.clear()

    this.updateProgressDisplay()
    this.showTimeoutHelp()
  }

  /**
   * 完成初始化
   */
  completeInitialization () {
    Logger.info('🎉 [初始化追蹤] 初始化完成')

    this.isCompleted = true
    this.endTime = Date.now()
    this.totalDuration = this.endTime - this.startTime

    // 清除總體超時
    if (this.totalTimer) {
      clearTimeout(this.totalTimer)
    }

    // 清除所有步驟超時
    for (const timeoutId of this.stepTimers.values()) {
      clearTimeout(timeoutId)
    }
    this.stepTimers.clear()

    this.updateProgressDisplay()
    this.hideProgressDisplay()
  }

  /**
   * 更新進度顯示
   */
  updateProgressDisplay () {
    const completedSteps = this.steps.filter(s => s.status === 'completed').length
    const totalSteps = this.initializationSteps.length
    const currentStepInfo = this.getCurrentStepInfo()

    // 更新狀態文字
    if (this.isFailed) {
      this.updateStatusElements('初始化失敗', '請查看詳細資訊或嘗試重新載入', 'error')
    } else if (this.isCompleted) {
      this.updateStatusElements('就緒', '擴展初始化完成', 'ready')
    } else {
      const progressText = `正在初始化... (${completedSteps}/${totalSteps})`
      this.updateStatusElements('初始化中', progressText, 'loading')
    }

    // 更新詳細進度
    this.updateDetailedProgress(completedSteps, totalSteps, currentStepInfo)
  }

  /**
   * 獲取當前步驟資訊
   */
  getCurrentStepInfo () {
    const runningStep = this.steps.find(s => s.status === 'running')
    if (runningStep) {
      const elapsed = Date.now() - runningStep.startTime
      const remaining = Math.max(0, runningStep.timeout - elapsed)
      return {
        name: runningStep.name,
        description: runningStep.description,
        elapsed,
        remaining: remaining > 0 ? remaining : 0,
        isTimeout: remaining <= 0
      }
    }
    return null
  }

  /**
   * 更新狀態元素
   */
  updateStatusElements (status, info, type) {
    const elements = this.getElements()
    if (elements.statusText) {
      elements.statusText.textContent = status
    }
    if (elements.statusInfo) {
      elements.statusInfo.textContent = info
    }
    if (elements.statusDot) {
      elements.statusDot.className = `status-dot ${type}`
    }
  }

  /**
   * 更新詳細進度
   */
  updateDetailedProgress (completed, total, currentStep) {
    const elements = this.getElements()

    // 更新進度條
    if (elements.progressContainer && elements.progressBar && elements.progressText) {
      const percentage = Math.round((completed / total) * 100)

      elements.progressContainer.style.display = 'block'
      elements.progressBar.style.width = `${percentage}%`
      elements.progressText.textContent = currentStep
        ? `${currentStep.name}: ${currentStep.description}`
        : `初始化進度: ${completed}/${total}`

      if (elements.progressPercentage) {
        elements.progressPercentage.textContent = `${percentage}%`
      }
    }

    // 顯示當前步驟詳細資訊
    if (currentStep && elements.statusInfo) {
      let detailText = currentStep.description
      if (currentStep.remaining > 0) {
        detailText += ` (剩餘 ${Math.round(currentStep.remaining / 1000)}秒)`
      } else if (currentStep.isTimeout) {
        detailText += ' (可能已超時)'
      }
      elements.statusInfo.textContent = detailText
    }
  }

  /**
   * 隱藏進度顯示
   */
  hideProgressDisplay () {
    const elements = this.getElements()
    if (elements.progressContainer) {
      setTimeout(() => {
        elements.progressContainer.style.display = 'none'
      }, 2000) // 2秒後隱藏
    }
  }

  /**
   * 顯示失敗詳細資訊
   */
  showFailureDetails (failedStep) {
    const elements = this.getElements()
    if (elements.errorContainer && elements.errorMessage) {
      let errorText = `初始化在「${failedStep.name}」步驟失敗\n\n`
      errorText += `步驟描述: ${failedStep.description}\n`
      errorText += `執行時間: ${failedStep.duration}ms\n`

      if (failedStep.error) {
        errorText += `錯誤原因: ${failedStep.error.message}\n`
      }

      errorText += '\n建議解決方案:\n'
      errorText += '1. 重新載入擴展\n'
      errorText += '2. 重新整理頁面\n'
      errorText += '3. 重啟瀏覽器\n'
      errorText += '4. 執行系統健康檢查'

      elements.errorMessage.textContent = errorText
      elements.errorContainer.style.display = 'block'
    }
  }

  /**
   * 顯示超時幫助
   */
  showTimeoutHelp () {
    const elements = this.getElements()
    if (elements.errorContainer && elements.errorMessage) {
      let helpText = `初始化超時 (超過 ${this.totalTimeout / 1000} 秒)\n\n`
      helpText += '已完成步驟:\n'

      this.steps.forEach((step, index) => {
        const status = step.status === 'completed'
          ? '✅'
          : step.status === 'failed'
            ? '❌'
            : step.status === 'running' ? '🔄' : '⏸️'
        helpText += `${index + 1}. ${status} ${step.name}\n`
      })

      helpText += '\n可能的原因:\n'
      helpText += '• Background Service Worker 未啟動\n'
      helpText += '• Chrome Extension API 限制\n'
      helpText += '• 網路連線問題\n'
      helpText += '• 系統資源不足\n'

      helpText += '\n建議解決方案:\n'
      helpText += '1. 執行系統健康檢查\n'
      helpText += '2. 重新載入擴展\n'
      helpText += '3. 重啟 Chrome 瀏覽器\n'
      helpText += '4. 檢查 Chrome 擴展權限'

      elements.errorMessage.textContent = helpText
      elements.errorContainer.style.display = 'block'
    }
  }

  /**
   * 獲取 DOM 元素
   */
  getElements () {
    return {
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      statusInfo: document.getElementById('statusInfo'),
      progressContainer: document.getElementById('progressContainer'),
      progressBar: document.getElementById('progressBar'),
      progressText: document.getElementById('progressText'),
      progressPercentage: document.getElementById('progressPercentage'),
      errorContainer: document.getElementById('errorContainer'),
      errorMessage: document.getElementById('errorMessage')
    }
  }

  /**
   * 獲取初始化報告
   */
  getInitializationReport () {
    return {
      startTime: this.startTime,
      endTime: this.endTime,
      totalDuration: this.totalDuration,
      isCompleted: this.isCompleted,
      isFailed: this.isFailed,
      steps: this.steps.map(step => ({
        id: step.id,
        name: step.name,
        description: step.description,
        status: step.status,
        duration: step.duration,
        error: step.error?.message
      })),
      summary: {
        totalSteps: this.steps.length,
        completedSteps: this.steps.filter(s => s.status === 'completed').length,
        failedSteps: this.steps.filter(s => s.status === 'failed').length,
        runningSteps: this.steps.filter(s => s.status === 'running').length
      }
    }
  }

  /**
   * 重置追蹤器
   */
  reset () {
    // 清除所有計時器
    if (this.totalTimer) {
      clearTimeout(this.totalTimer)
    }

    for (const timeoutId of this.stepTimers.values()) {
      clearTimeout(timeoutId)
    }
    this.stepTimers.clear()

    // 重置狀態
    this.steps = []
    this.currentStep = 0
    this.isCompleted = false
    this.isFailed = false
    this.startTime = null
    this.endTime = null
    this.totalDuration = null
  }
}

// 匯出類別以供使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PopupInitializationTracker
} else if (typeof window !== 'undefined') {
  window.PopupInitializationTracker = PopupInitializationTracker
}
