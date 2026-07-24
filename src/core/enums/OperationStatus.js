/**
 * 操作狀態枚舉
 *
 * 定義所有操作的標準狀態類型，確保系統中狀態表示的一致性
 * 用於 OperationResult 和其他需要狀態追蹤的場景
 */

/**
 * 操作狀態枚舉
 *
 * 使用字串枚舉確保 JSON 序列化支援 (Chrome Extension 需要)
 * 移除驗證函數 - 好的設計讓錯誤變成不可能
 */
const OperationStatus = Object.freeze({
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  TIMEOUT: 'TIMEOUT',
  PARTIAL_SUCCESS: 'PARTIAL_SUCCESS'
})

/**
 * 檢查給定值是否為合法的 OperationStatus
 * @param {string} status - 待驗證的狀態值
 * @returns {boolean} 是否為合法的 OperationStatus
 */
function isValidOperationStatus (status) {
  return Object.values(OperationStatus).includes(status)
}

/**
 * 檢查狀態是否代表操作已結束（成功、失敗、取消、逾時、部分成功）
 * @param {string} status - 待檢查的狀態值
 * @returns {boolean} 是否為已完成狀態
 */
function isCompletedStatus (status) {
  const completedStatuses = [
    OperationStatus.SUCCESS,
    OperationStatus.FAILED,
    OperationStatus.CANCELLED,
    OperationStatus.TIMEOUT,
    OperationStatus.PARTIAL_SUCCESS
  ]
  return completedStatuses.includes(status)
}

/**
 * 檢查狀態是否代表操作成功（成功或部分成功）
 * @param {string} status - 待檢查的狀態值
 * @returns {boolean} 是否為成功狀態
 */
function isSuccessStatus (status) {
  return status === OperationStatus.SUCCESS || status === OperationStatus.PARTIAL_SUCCESS
}

module.exports = {
  OperationStatus,
  isValidOperationStatus,
  isCompletedStatus,
  isSuccessStatus
}
