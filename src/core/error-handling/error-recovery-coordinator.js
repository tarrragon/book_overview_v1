/**
 * 錯誤恢復策略協調器
 * 基於錯誤類型提供對應的恢復策略
 */

const { StandardError } = require('src/core/errors/StandardError')

const RECOVERY_STRATEGIES = {
  RETRY: 'RETRY',
  FALLBACK: 'FALLBACK',
  USER_INTERVENTION: 'USER_INTERVENTION',
  GRACEFUL_DEGRADATION: 'GRACEFUL_DEGRADATION'
}

// 錯誤類型對應的恢復策略配置
const ERROR_RECOVERY_CONFIG = {
  NETWORK_ERROR: {
    canRetry: true,
    retryStrategy: 'exponential_backoff',
    maxRetries: 3,
    fallbackAvailable: true,
    fallbackAction: 'use_cache'
  },

  DATA_ERROR: {
    canRetry: false,
    requiresRepair: true,
    repairStrategy: 'auto_fix',
    userGuidance: 'check_data_format'
  },

  SYSTEM_ERROR: {
    canRetry: true,
    retryStrategy: 'immediate',
    maxRetries: 1,
    requiresUserAction: true,
    actionRequired: 'free_resources'
  },

  DOM_ERROR: {
    canRetry: true,
    retryStrategy: 'fallback_selector',
    fallbackStrategy: 'alternative_method',
    gracefulDegradation: true
  },

  PLATFORM_ERROR: {
    canRetry: false,
    requiresUserAction: true,
    actionRequired: 'grant_permission',
    fallbackAvailable: false
  }
}

/**
 * 建立錯誤恢復策略
 * @param {Error} error - 錯誤物件
 * @param {string} errorCategory - 錯誤分類
 * @returns {Object} 恢復策略
 */
function createErrorRecovery (error, errorCategory = null) {
  if (!error) {
    throw new StandardError('REQUIRED_FIELD_MISSING', 'Error object is required for recovery planning', {
          "dataType": "object",
          "category": "ui"
      })
  }

  // 如果沒有提供錯誤分類，先進行分類
  let category = errorCategory
  if (!category) {
    // //todo: 整合錯誤分類器
    category = 'SYSTEM_ERROR' // 暫時預設
  }

  const config = ERROR_RECOVERY_CONFIG[category] || ERROR_RECOVERY_CONFIG.SYSTEM_ERROR

  return {
    canRetry: config.canRetry || false,
    retryStrategy: config.retryStrategy || 'immediate',
    maxRetries: config.maxRetries || 1,
    requiresUserAction: config.requiresUserAction || false,
    actionRequired: config.actionRequired || null,
    fallbackAvailable: config.fallbackAvailable || false,
    fallbackAction: config.fallbackAction || null,
    gracefulDegradation: config.gracefulDegradation || false,
    repairStrategy: config.repairStrategy || null,
    userGuidance: config.userGuidance || null,
    timestamp: new Date().toISOString(),
    errorReference: error.message || error.toString()
  }
}

/**
 * 執行恢復策略
 * @param {Object} recoveryPlan - 恢復計劃
 * @param {Function} originalOperation - 原始操作
 * @returns {Promise} 恢復結果
 */
async function executeRecoveryStrategy (recoveryPlan, originalOperation) {
  if (!recoveryPlan || !originalOperation) {
    throw new StandardError('REQUIRED_FIELD_MISSING', 'Recovery plan and original operation are required', {
          "category": "ui"
      })
  }

  if (recoveryPlan.canRetry) {
    return await retryOperation(originalOperation, {
      maxRetries: recoveryPlan.maxRetries,
      strategy: recoveryPlan.retryStrategy
    })
  }

  if (recoveryPlan.fallbackAvailable) {
    // //todo: 實作降級策略執行
    return { success: false, reason: 'fallback_not_implemented' }
  }

  if (recoveryPlan.requiresUserAction) {
    // //todo: 觸發使用者介入機制
    return { success: false, reason: 'user_action_required', action: recoveryPlan.actionRequired }
  }

  return { success: false, reason: 'no_recovery_available' }
}

/**
 * 重試操作
 * @param {Function} operation - 要重試的操作
 * @param {Object} options - 重試選項
 * @returns {Promise} 重試結果
 */
async function retryOperation (operation, options = {}) {
  const maxRetries = options.maxRetries || 3
  const strategy = options.strategy || 'exponential_backoff'

  let lastError = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = calculateRetryDelay(attempt, strategy)
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === maxRetries) {
        throw new StandardError('OPERATION_FAILED', `Operation failed after ${maxRetries + 1} attempts: ${error.message}`, {
          "values": [
              "1"
          ],
          "category": "general"
      })
      }
    }
  }

  throw lastError
}

/**
 * 計算重試延遲時間
 * @param {number} attempt - 嘗試次數
 * @param {string} strategy - 重試策略
 * @returns {number} 延遲毫秒數
 */
function calculateRetryDelay (attempt, strategy) {
  switch (strategy) {
    case 'exponential_backoff':
      return Math.min(1000 * Math.pow(2, attempt), 10000) // 最大10秒
    case 'linear':
      return attempt * 1000
    case 'immediate':
      return 0
    default:
      return 1000
  }
}

export {
  createErrorRecovery,
  executeRecoveryStrategy,
  retryOperation,
  RECOVERY_STRATEGIES
}
