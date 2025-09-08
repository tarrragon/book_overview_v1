/**
 * 書籍驗證錯誤類別
 *
 * 專用錯誤類別，不依賴中央字典，直接處理書籍驗證失敗的情況
 * 遵循 Linux 專家建議的簡化設計原則
 */

// 條件性引入，支援瀏覽器和 Node.js 環境
let StandardError
if (typeof require !== 'undefined') {
  try {
    StandardError = require('./StandardError').StandardError
  } catch (e) {
    // 瀏覽器環境或引入失敗時，假設 StandardError 已全域可用
  }
}

class BookValidationError extends StandardError {
  /**
   * 建立書籍驗證錯誤
   * @param {Object} book - 書籍物件
   * @param {Array|string} validationFailures - 驗證失敗的詳細資訊
   */
  constructor (book, validationFailures) {
    // 安全地取得書籍標題
    const bookTitle = book?.title || book?.name || 'Unknown Book'
    const bookId = book?.id || book?.isbn || 'Unknown ID'

    // 處理不同的驗證失敗格式
    let failureMessage = ''
    if (Array.isArray(validationFailures)) {
      failureMessage = validationFailures.join(', ')
    } else if (typeof validationFailures === 'string') {
      failureMessage = validationFailures
    } else {
      failureMessage = '未知驗證錯誤'
    }

    const message = `書籍驗證失敗: "${bookTitle}" - ${failureMessage}`

    super('BOOK_VALIDATION_FAILED', message, {
      book: { id: bookId, title: bookTitle },
      failures: validationFailures,
      category: 'validation'
    })
  }

  /**
   * 便利的靜態建立方法
   * @param {Object} book - 書籍物件
   * @param {Array|string} failures - 驗證失敗資訊
   * @returns {BookValidationError} 錯誤實例
   */
  static create (book, failures) {
    return new BookValidationError(book, failures)
  }

  /**
   * 為缺少必要欄位的錯誤建立特殊方法
   * @param {Object} book - 書籍物件
   * @param {Array<string>} missingFields - 缺少的欄位
   * @returns {BookValidationError} 錯誤實例
   */
  static missingFields (book, missingFields) {
    const failures = `缺少必要欄位: ${missingFields.join(', ')}`
    return new BookValidationError(book, failures)
  }

  /**
   * 為無效格式的錯誤建立特殊方法
   * @param {Object} book - 書籍物件
   * @param {string} fieldName - 無效欄位名稱
   * @param {string} expectedFormat - 期望格式
   * @returns {BookValidationError} 錯誤實例
   */
  static invalidFormat (book, fieldName, expectedFormat) {
    const failures = `${fieldName} 格式無效，期望格式: ${expectedFormat}`
    return new BookValidationError(book, failures)
  }
}

// 匯出 BookValidationError 類別
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BookValidationError }
} else if (typeof window !== 'undefined') {
  window.BookValidationError = BookValidationError
}
