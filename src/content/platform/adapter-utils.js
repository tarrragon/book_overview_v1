/**
 * adapter-utils.js
 *
 * 跨書城通用工具函式（純函式，無狀態依賴）
 *
 * 職責：
 * - 文字處理：sanitize / HTML 清理 / URL 編碼 / 正規化 / 長度限制
 * - URL 工具：安全檢查 / 檔名提取 / 域名提取
 * - 型別工具：null 檢查 / 型別檢查 / 安全轉換
 * - 錯誤處理：handleWithFallback（參數化 logger）
 */

// === 文字處理 ===

function sanitizeText (text) {
  if (!text) return ''
  return text
    .replace(/\s+/g, ' ')
    .replace(/[<>'"]/g, '')
    .trim()
}

function cleanHtmlAndMaliciousContent (text) {
  if (!text) return ''
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-zA-Z0-9#]+;/g, '')
    .replace(/[<>"']/g, '')
}

function processUrlEncoding (text) {
  if (!text) return ''
  return text
    .replace(/%20/g, ' ')
    .replace(/&amp;/g, '&')
}

function normalizeTextContent (text) {
  if (!text) return ''
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^一-鿿\w\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

function limitTextLength (text, maxLength) {
  if (!text) return null
  return text.length > 0 ? text.substring(0, maxLength) : null
}

// === URL 工具 ===

function isUnsafeUrl (url, base) {
  if (!url || typeof url !== 'string') {
    return true
  }

  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('..') || lowerUrl.includes('%2e%2e')) {
    return true
  }

  try {
    const urlObj = base ? new URL(url, base) : new URL(url)
    const protocol = urlObj.protocol.toLowerCase()
    if (protocol !== 'https:' && protocol !== 'http:') {
      return true
    }
    return false
  } catch (error) {
    return true
  }
}

function extractFilenameFromUrl (url) {
  if (!url || typeof url !== 'string') {
    return null
  }

  try {
    const urlObj = new URL(url.trim())
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop()
    return filename?.split('?')[0] || null
  } catch (error) {
    const match = url.match(/\/([^/]+\.(jpg|png|jpeg|gif|webp))(\?|$)/i)
    return match ? match[1] : null
  }
}

function extractDomainFromUrl (url) {
  if (!url || typeof url !== 'string') {
    return null
  }

  try {
    const urlObj = new URL(url.trim())
    return urlObj.hostname
  } catch (error) {
    return null
  }
}

// === 型別工具 ===

function isNullOrUndefined (input) {
  return input === null || input === undefined
}

function isStringType (input) {
  return typeof input === 'string'
}

function requiresSpecialHandling (input) {
  const type = typeof input
  return type === 'boolean' || type === 'object' || type === 'number'
}

function safeConvertToString (input, logger) {
  return handleWithFallback(
    'safeConvertToString',
    () => String(input),
    '',
    '',
    logger
  )
}

function safeStringify (input, logger) {
  if (isNullOrUndefined(input)) return ''
  if (isStringType(input)) return input
  if (requiresSpecialHandling(input)) return ''
  return safeConvertToString(input, logger)
}

// === 錯誤處理 ===

function handleWithFallback (methodName, operation, fallbackValue, context, logger) {
  try {
    return operation()
  } catch (error) {
    if (logger) {
      logger.warn('ADAPTER_METHOD_ERROR', {
        method: methodName,
        context: context || '',
        error: error.message,
        stack: error.stack
      })
    }
    return fallbackValue
  }
}

module.exports = {
  sanitizeText,
  cleanHtmlAndMaliciousContent,
  processUrlEncoding,
  normalizeTextContent,
  limitTextLength,
  isUnsafeUrl,
  extractFilenameFromUrl,
  extractDomainFromUrl,
  isNullOrUndefined,
  isStringType,
  requiresSpecialHandling,
  safeConvertToString,
  safeStringify,
  handleWithFallback
}
