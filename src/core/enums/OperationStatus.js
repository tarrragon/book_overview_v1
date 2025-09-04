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

module.exports = {
  OperationStatus
}