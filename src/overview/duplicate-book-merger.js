/**
 * DuplicateBookMerger - 重複書籍合併模組
 *
 * 負責功能：
 * - 匯入書籍時的重複偵測（ID 和 title+author 雙索引）
 * - 三種合併策略：skip / override / merge
 * - Schema v2 欄位級合併（readingStatus、progress、tagIds）
 *
 * 設計考量：
 * - 從 OverviewPageController 提取，專責重複書籍合併邏輯
 * - 無外部依賴，純函式模組
 * - 保持與原 Controller 相同的合併行為
 */

class DuplicateBookMerger {
  /**
   * 處理重複書籍的合併策略
   *
   * 業務規則：匯入書籍時，需依策略處理 ID 重複和跨平台重複（title+author）的書籍。
   * - skip：重複書籍保留既有版本
   * - override：重複書籍用匯入版本替換
   * - merge：依欄位級合併策略合併（Schema v2 欄位特殊處理）
   *
   * @param {Array} existingBooks - 既有書籍陣列
   * @param {Array} importedBooks - 匯入書籍陣列
   * @param {string} strategy - 合併策略 ('skip' | 'override' | 'merge')
   * @returns {Array} 合併後的書籍陣列
   */
  handleDuplicateBooks (existingBooks, importedBooks, strategy) {
    // 先對匯入清單去重（同 ID 取最後出現的）
    const deduplicatedImported = this._deduplicateByLastOccurrence(importedBooks)

    // 建立既有書籍的查找索引（ID 和 title+author 雙索引）
    const existingById = new Map()
    const existingByTitleAuthor = new Map()
    for (const book of existingBooks) {
      existingById.set(book.id, book)
      const compositeKey = this._buildTitleAuthorKey(book)
      if (compositeKey) {
        existingByTitleAuthor.set(compositeKey, book)
      }
    }

    // 結果集合：以 Map 避免重複
    const resultMap = new Map()

    // 先放入所有既有書籍
    for (const book of existingBooks) {
      resultMap.set(book.id, { ...book })
    }

    // 處理每本匯入書籍
    for (const imported of deduplicatedImported) {
      // 查找重複：優先 ID 匹配，其次 title+author 匹配
      const existingById_ = existingById.get(imported.id)
      const compositeKey = this._buildTitleAuthorKey(imported)
      const existingByTA = compositeKey ? existingByTitleAuthor.get(compositeKey) : null
      const matchedExisting = existingById_ || existingByTA

      if (!matchedExisting) {
        // 無重複，直接加入
        resultMap.set(imported.id, { ...imported })
        continue
      }

      const existingId = matchedExisting.id

      switch (strategy) {
        case 'skip':
          // 保留既有版本，不做任何處理
          break

        case 'override':
          // 移除既有版本，加入匯入版本
          resultMap.delete(existingId)
          resultMap.set(imported.id, { ...imported })
          break

        case 'merge': {
          // 欄位級合併
          resultMap.delete(existingId)
          const merged = this._mergeBooks(matchedExisting, imported)
          resultMap.set(merged.id, merged)
          break
        }

        default:
          // 未知策略視同 skip
          break
      }
    }

    return Array.from(resultMap.values())
  }

  /**
   * 建立 title+author 組合鍵，用於跨平台去重
   *
   * @param {Object} book - 書籍物件
   * @returns {string|null} 組合鍵，缺少 title 或 authors 時回傳 null
   */
  _buildTitleAuthorKey (book) {
    if (!book.title || !book.authors || !book.authors.length) return null
    return `${book.title}::${book.authors.join('|')}`
  }

  /**
   * 匯入清單內部去重，同 ID 取最後出現的
   *
   * @param {Array} books - 書籍陣列
   * @returns {Array} 去重後的書籍陣列
   */
  _deduplicateByLastOccurrence (books) {
    const seen = new Map()
    for (const book of books) {
      seen.set(book.id, book)
    }
    return Array.from(seen.values())
  }

  /**
   * 欄位級合併兩本書（Schema v2 合併策略）
   *
   * 合併規則：
   * - 基底版本：updatedAt 較新的為基底（相同或都缺失時取既有）
   * - readingStatus：isManualStatus=true 優先；同為 manual 或同為 auto 時取較新
   * - progress：取較大值
   * - tagIds：聯集 union（去重）
   * - 其他欄位：基底為 null/undefined 時取另一方的非空值
   *
   * @param {Object} existing - 既有書籍
   * @param {Object} imported - 匯入書籍
   * @returns {Object} 合併後的書籍
   */
  _mergeBooks (existing, imported) {
    // 決定基底版本：updatedAt 較新者為基底
    const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0
    const importedTime = imported.updatedAt ? new Date(imported.updatedAt).getTime() : 0
    const isImportedNewer = importedTime > existingTime

    const base = isImportedNewer ? { ...imported } : { ...existing }
    const other = isImportedNewer ? existing : imported

    // 合併 readingStatus（isManualStatus=true 優先）
    this._mergeReadingStatus(base, existing, imported, isImportedNewer)

    // 合併 progress（取較大值）
    this._mergeProgress(base, existing, imported)

    // 合併 tagIds（聯集去重）
    this._mergeTagIds(base, existing, imported)

    // 補充基底欄位的空值
    this._fillNullFields(base, other)

    return base
  }

  /**
   * 合併 readingStatus：isManualStatus=true 的一方優先
   *
   * 業務規則：使用者手動設定的閱讀狀態優先於系統自動偵測的狀態
   */
  _mergeReadingStatus (base, existing, imported, isImportedNewer) {
    const existingIsManual = existing.isManualStatus === true
    const importedIsManual = imported.isManualStatus === true

    if (existingIsManual && !importedIsManual) {
      base.readingStatus = existing.readingStatus
      base.isManualStatus = true
    } else if (!existingIsManual && importedIsManual) {
      base.readingStatus = imported.readingStatus
      base.isManualStatus = true
    } else if (existingIsManual && importedIsManual) {
      // 雙方都是 manual，取較新的
      const source = isImportedNewer ? imported : existing
      base.readingStatus = source.readingStatus
      base.isManualStatus = true
    }
    // 雙方都是 auto：base 已經是較新版本，不需額外處理
  }

  /**
   * 合併 progress：取較大值
   *
   * 業務規則：閱讀進度只會前進不會倒退
   */
  _mergeProgress (base, existing, imported) {
    const existingProgress = typeof existing.progress === 'number' ? existing.progress : -1
    const importedProgress = typeof imported.progress === 'number' ? imported.progress : -1
    const maxProgress = Math.max(existingProgress, importedProgress)

    if (maxProgress >= 0) {
      base.progress = maxProgress
    }
  }

  /**
   * 合併 tagIds：聯集去重
   *
   * 業務規則：標籤只會增加不會減少，合併時取兩方的聯集
   */
  _mergeTagIds (base, existing, imported) {
    const existingTags = Array.isArray(existing.tagIds) ? existing.tagIds : []
    const importedTags = Array.isArray(imported.tagIds) ? imported.tagIds : []

    if (existingTags.length > 0 || importedTags.length > 0) {
      base.tagIds = [...new Set([...existingTags, ...importedTags])]
    }
  }

  /**
   * 補充基底版本的 null/undefined 欄位
   *
   * 業務規則：有值優於無值，任何一方有資訊就應保留
   */
  _fillNullFields (base, other) {
    for (const key of Object.keys(other)) {
      if ((base[key] === null || base[key] === undefined) && other[key] != null) {
        base[key] = other[key]
      }
    }
  }
}

// Node.js 環境：CommonJS 匯出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DuplicateBookMerger }
}
