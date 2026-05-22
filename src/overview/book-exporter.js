/**
 * BookExporter - 書籍資料複製模組
 *
 * 負責功能：
 * - 複製為純文字（tab-separated）到剪貼簿
 *
 * 設計考量：
 * - 從 OverviewPageController 提取，專責複製邏輯
 * - 透過 dependency injection 接收 getFilteredBooks 和 document
 * - v1 JSON/CSV 匯出方法已於 W1-042.2 移除（被 BookDataExporter v2 取代）
 */

// 複製配置常數
const EXPORT_CONSTANTS = {
  NO_DATA_EXPORT: '沒有資料可以匯出',
  // 無資料可複製時的提示（handleCopyText 早退路徑）
  NO_DATA_COPY: '沒有資料可以複製',
  // 複製成功提示（navigator.clipboard.writeText 成功後）
  COPY_SUCCESS: '已複製到剪貼簿',
  // 複製失敗提示（剪貼簿 API 不支援或拋例外）
  COPY_FAILED: '複製失敗，請確認瀏覽器支援剪貼簿功能',
  // 複製純文字的 header 列，欄位順序須對應 generateCopyText 組裝順序
  // （title / _formatBookSource / progress / status）
  COPY_TEXT_HEADERS: ['書名', '書城', '閱讀進度', '狀態']
}

class BookExporter {
  /**
   * 建構 BookExporter
   *
   * @param {Object} deps - 依賴注入
   * @param {Function} deps.getFilteredBooks - 取得當前篩選書籍的函式
   * @param {Document} deps.document - DOM 文檔物件
   */
  constructor ({ getFilteredBooks, document }) {
    this.getFilteredBooks = getFilteredBooks
    this.document = document
  }

  /**
   * 處理複製為文字到剪貼簿（W6-012.7.3）
   *
   * 負責功能：
   * - 將當前篩選/選取的書籍資料以 tab-separated 純文字格式複製到剪貼簿
   * - 透過 getFilteredBooks 的 selection-aware DI（W6-012.7.2），
   *   當有書本被選取時僅複製選取項，否則複製當前 displayed 範圍
   * - 顯示成功/失敗回饋（alert，與其他匯出按鈕一致）
   *
   * 設計理由：
   * - tab-separated 而非 CSV：便於直接貼入 Excel/Sheets/Notion 表格
   * - 使用 navigator.clipboard.writeText（async）並 catch 失敗情境
   *   （HTTPS 限制、權限拒絕、瀏覽器不支援）
   */
  async handleCopyText () {
    const books = this.getFilteredBooks()
    if (!books || books.length === 0) {
      alert(EXPORT_CONSTANTS.NO_DATA_COPY)
      return
    }

    const text = this.generateCopyText()

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        alert(EXPORT_CONSTANTS.COPY_SUCCESS)
      } else {
        alert(EXPORT_CONSTANTS.COPY_FAILED)
      }
    } catch (error) {
      // 剪貼簿 API 失敗（權限/HTTPS/不支援），給予使用者明確回饋
      // eslint-disable-next-line no-console
      console.warn('複製到剪貼簿失敗:', error)
      alert(EXPORT_CONSTANTS.COPY_FAILED)
    }
  }

  /**
   * 生成複製用純文字內容（tab-separated）
   *
   * 格式：header 行 + 每本書一行，欄位以 \t 分隔
   * 便於直接貼入 Excel/Sheets/Notion 表格欄位
   */
  generateCopyText () {
    const books = this.getFilteredBooks()
    const rows = [
      EXPORT_CONSTANTS.COPY_TEXT_HEADERS.join('\t'),
      ...books.map(book => [
        book.title || '',
        this._formatBookSource(book),
        String(book.progress || 0),
        book.status || ''
      ].join('\t'))
    ]
    return rows.join('\n')
  }

  /**
   * 格式化書城來源顯示
   * @private
   * @param {Object} book - 書籍資料
   * @returns {string} 格式化的書城來源
   */
  _formatBookSource (book) {
    // 優先使用 tags 陣列
    if (Array.isArray(book.tags) && book.tags.length > 0) {
      return book.tags.join(', ')
    }

    if (book.tag) {
      return book.tag
    }

    if (book.store) {
      return book.store
    }

    if (book.source) {
      return book.source
    }

    return 'readmoo'
  }
}

// 瀏覽器環境：將 BookExporter 定義為全域變數
if (typeof window !== 'undefined') {
  window.BookExporter = BookExporter
}

// Node.js 環境：保持 CommonJS 匯出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BookExporter }
}
