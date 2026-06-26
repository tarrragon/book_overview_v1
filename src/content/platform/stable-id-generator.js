/**
 * stable-id-generator.js
 *
 * 穩定書籍 ID 生成框架
 *
 * 職責：
 * - 多策略 ID 生成（reader-link → cover → title → fallback）
 * - 輸入驗證與安全化
 * - Readmoo 專屬 cover ID 提取（可配置的 coverIdExtractor）
 */

const {
  cleanHtmlAndMaliciousContent,
  processUrlEncoding,
  normalizeTextContent,
  limitTextLength,
  isUnsafeUrl,
  safeStringify,
  handleWithFallback
} = require('src/content/platform/adapter-utils')

/**
 * 建立穩定 ID 生成器
 *
 * @param {Object} deps - 依賴注入
 * @param {Object} deps.logger - 日誌記錄器
 * @param {Function} deps.getLocationOrigin - 取得 location.origin 的函式
 * @param {Set} deps.unstableCoverIds - 已知不穩定 cover ID 集合
 * @returns {Object} ID 生成器實例
 */
function createStableIdGenerator (deps = {}) {
  const { logger, getLocationOrigin, unstableCoverIds } = deps

  const generator = {
    generateStableBookId (readerId, title, cover) {
      return generator.generateStableBookIdWithInfo(readerId, title, cover).id
    },

    generateStableBookIdWithInfo (readerId, title, cover) {
      return handleWithFallback(
        'generateStableBookIdWithInfo',
        () => {
          const inputs = generator.validateAndSanitizeInputs(readerId, title, cover)
          return generator.applyIdGenerationStrategiesWithInfo(inputs)
        },
        {
          id: readerId ? `reader-${readerId}` : 'reader-undefined',
          strategy: 'reader-link'
        },
        '',
        logger
      )
    },

    validateAndSanitizeInputs (readerId, title, cover) {
      return {
        readerId: safeStringify(readerId, logger),
        title: safeStringify(title, logger),
        cover: safeStringify(cover, logger)
      }
    },

    applyIdGenerationStrategies (inputs) {
      return generator.applyIdGenerationStrategiesWithInfo(inputs).id
    },

    applyIdGenerationStrategiesWithInfo (inputs) {
      const readerResult = generator.tryReaderStrategy(inputs)
      if (readerResult) {
        return {
          id: `reader-${inputs.readerId}`,
          strategy: 'reader-link'
        }
      }

      const coverResult = generator.tryCoverStrategy(inputs)
      if (coverResult) {
        return { id: coverResult, strategy: 'cover' }
      }

      const titleResult = generator.tryTitleStrategy(inputs)
      if (titleResult) {
        return { id: titleResult, strategy: 'title' }
      }

      return {
        id: generator.createFallbackId(),
        strategy: 'fallback'
      }
    },

    tryReaderStrategy ({ readerId }) {
      return readerId && readerId.trim() ? `reader-${readerId}` : null
    },

    tryCoverStrategy ({ cover }) {
      if (!cover || !cover.trim()) return null
      const coverId = generator.extractCoverIdFromUrl(cover)
      if (!coverId) return null
      if (unstableCoverIds && unstableCoverIds.has(coverId)) return null
      return `cover-${coverId}`
    },

    tryTitleStrategy ({ title }) {
      if (!title || !title.trim() || title.trim() === '未知標題') return null
      const titleId = generator.generateTitleBasedId(title)
      return titleId ? `title-${titleId}` : null
    },

    createFallbackId () {
      return 'reader-undefined'
    },

    validateTitleInput (title) {
      if (!title || typeof title !== 'string') return null
      const trimmed = title.trim()
      return trimmed || null
    },

    validateCoverUrlInput (coverUrl) {
      if (!coverUrl || typeof coverUrl !== 'string') return null
      const trimmed = coverUrl.trim()
      const base = getLocationOrigin ? getLocationOrigin() : undefined
      return isUnsafeUrl(trimmed, base) ? null : trimmed
    },

    validateReadmooDomain (url) {
      return handleWithFallback(
        'validateReadmooDomain',
        () => {
          const isRelative = typeof url === 'string' &&
            url.startsWith('/') && !url.startsWith('//')
          const base = getLocationOrigin ? getLocationOrigin() : undefined
          const urlObj = isRelative ? new URL(url, base) : new URL(url)

          const isCdnHost = urlObj.hostname === 'cdn.readmoo.com'
          const hasCoverPath = urlObj.pathname.includes('/cover/')

          return hasCoverPath && (isCdnHost || isRelative)
        },
        false,
        '',
        logger
      )
    },

    extractIdFromCoverPath (coverUrl) {
      const coverMatch = coverUrl.match(/\/cover\/[a-z0-9]+\/([^_]+)_/)
      return coverMatch ? coverMatch[1] : null
    },

    extractIdFromFilename (coverUrl) {
      const filenameMatch = coverUrl.match(/\/([^/]+)\.(jpg|png|jpeg)/i)
      return filenameMatch ? filenameMatch[1].replace(/_\d+x\d+$/, '') : null
    },

    extractCoverIdFromUrl (coverUrl) {
      const validatedUrl = generator.validateCoverUrlInput(coverUrl)
      if (!validatedUrl) return null

      if (!generator.validateReadmooDomain(validatedUrl)) return null

      return generator.extractIdFromCoverPath(validatedUrl) ||
             generator.extractIdFromFilename(validatedUrl) ||
             null
    },

    generateTitleBasedId (title) {
      return handleWithFallback(
        'generateTitleBasedId',
        () => {
          const validated = generator.validateTitleInput(title)
          if (!validated) return null
          const cleaned = cleanHtmlAndMaliciousContent(validated)
          const urlProcessed = processUrlEncoding(cleaned)
          const normalized = normalizeTextContent(urlProcessed)
          return limitTextLength(normalized, 50)
        },
        null,
        '',
        logger
      )
    }
  }

  return generator
}

module.exports = createStableIdGenerator
