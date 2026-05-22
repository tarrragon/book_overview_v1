/**
 * BookExporter copyText 功能測試（0.19.0-W1-045）
 *
 * 測試範圍：
 * - handleCopyText 觸發不丟 TypeError（修復 EXPORT_CONSTANTS 缺漏 key）
 * - generateCopyText 產出正確的 tab-separated 純文字內容
 * - 無資料時走 NO_DATA_COPY 早退路徑
 * - 剪貼簿成功 / 失敗 / 不支援三種情境的回饋
 *
 * 背景：W1-042.2 執行中發現 book-exporter.js 的 handleCopyText/generateCopyText
 * 引用 EXPORT_CONSTANTS.NO_DATA_COPY / COPY_SUCCESS / COPY_FAILED / COPY_TEXT_HEADERS，
 * 但 EXPORT_CONSTANTS 定義缺這 4 個 key。COPY_TEXT_HEADERS 為 undefined 時呼叫
 * .join('\t') 會丟 TypeError，copyText 觸發即崩潰（pre-existing 缺陷）。
 *
 * @jest-environment jsdom
 */

const { BookExporter } = require('../../../src/overview/book-exporter')

/**
 * 建立測試書籍
 * @param {Object} overrides - 覆寫欄位
 * @returns {Object}
 */
function makeBook (overrides = {}) {
  return {
    title: '三體',
    progress: 100,
    status: '已完成',
    tags: ['readmoo'],
    ...overrides
  }
}

describe('BookExporter copyText（0.19.0-W1-045）', () => {
  let alertMock

  beforeEach(() => {
    alertMock = jest.fn()
    global.alert = alertMock
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete global.alert
    delete global.navigator
  })

  /**
   * 建立 BookExporter 實例
   * @param {Array} books - getFilteredBooks 回傳的書籍陣列
   * @returns {BookExporter}
   */
  function makeExporter (books) {
    return new BookExporter({
      getFilteredBooks: () => books,
      document: global.document
    })
  }

  describe('generateCopyText', () => {
    test('不丟 TypeError 並產出含 header 列的 tab-separated 文字', () => {
      const exporter = makeExporter([makeBook()])

      let text
      expect(() => {
        text = exporter.generateCopyText()
      }).not.toThrow()

      const lines = text.split('\n')
      // 第一列為 header（COPY_TEXT_HEADERS）
      expect(lines[0]).toBe(['書名', '書城', '閱讀進度', '狀態'].join('\t'))
      // 第二列為書籍資料
      expect(lines[1]).toBe(['三體', 'readmoo', '100', '已完成'].join('\t'))
    })

    test('多本書產出多列資料', () => {
      const exporter = makeExporter([
        makeBook({ title: '書A', progress: 50, status: '閱讀中', tags: ['kindle'] }),
        makeBook({ title: '書B', progress: 0, status: '未讀', tags: ['kobo'] })
      ])

      const lines = exporter.generateCopyText().split('\n')
      expect(lines).toHaveLength(3) // header + 2 本書
      expect(lines[1]).toBe(['書A', 'kindle', '50', '閱讀中'].join('\t'))
      expect(lines[2]).toBe(['書B', 'kobo', '0', '未讀'].join('\t'))
    })

    test('缺漏欄位以預設值填補（progress 預設 0）', () => {
      const exporter = makeExporter([{ title: '無進度書' }])

      const lines = exporter.generateCopyText().split('\n')
      expect(lines[1]).toBe(['無進度書', 'readmoo', '0', ''].join('\t'))
    })
  })

  describe('handleCopyText', () => {
    test('無資料時走 NO_DATA_COPY 早退路徑且不丟 TypeError', async () => {
      const exporter = makeExporter([])

      await expect(exporter.handleCopyText()).resolves.toBeUndefined()
      expect(alertMock).toHaveBeenCalledWith('沒有資料可以複製')
    })

    test('複製成功時呼叫 clipboard.writeText 並顯示 COPY_SUCCESS', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined)
      global.navigator = { clipboard: { writeText } }

      const exporter = makeExporter([makeBook()])
      await exporter.handleCopyText()

      expect(writeText).toHaveBeenCalledTimes(1)
      const copied = writeText.mock.calls[0][0]
      expect(copied.split('\n')[0]).toBe(['書名', '書城', '閱讀進度', '狀態'].join('\t'))
      expect(alertMock).toHaveBeenCalledWith('已複製到剪貼簿')
    })

    test('剪貼簿 API 不支援時顯示 COPY_FAILED', async () => {
      global.navigator = {}

      const exporter = makeExporter([makeBook()])
      await exporter.handleCopyText()

      expect(alertMock).toHaveBeenCalledWith('複製失敗，請確認瀏覽器支援剪貼簿功能')
    })

    test('clipboard.writeText 拋例外時顯示 COPY_FAILED', async () => {
      const writeText = jest.fn().mockRejectedValue(new Error('權限拒絕'))
      global.navigator = { clipboard: { writeText } }
      jest.spyOn(console, 'warn').mockImplementation(() => {})

      const exporter = makeExporter([makeBook()])
      await exporter.handleCopyText()

      expect(alertMock).toHaveBeenCalledWith('複製失敗，請確認瀏覽器支援剪貼簿功能')
    })
  })
})
