'use strict'

const { createTagResolver } = require('src/ui/search/tag-resolver')
const { COLORS } = require('../core/design-system/colors.js')

/**
 * Tag 顯示配置常數
 * 控制 tag cell 的顯示行為
 */
const TAG_DISPLAY = Object.freeze({
  MAX_VISIBLE: 3,
  EMPTY_LABEL: '未分類'
})

/**
 * CSS injection 防護：驗證 hex 色碼格式
 * 僅允許 #RRGGBB 格式，防止惡意 CSS 注入
 */
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/
const SAFE_FALLBACK_COLOR = COLORS.tagDefault

/**
 * 驗證並回傳安全的 hex 色碼
 * @param {string} color - 待驗證的色碼
 * @returns {string} 安全的 hex 色碼
 */
function sanitizeColor (color) {
  return HEX_COLOR_PATTERN.test(color) ? color : SAFE_FALLBACK_COLOR
}

/**
 * 建立 TagCellRenderer 實例
 *
 * 負責功能：
 * - 建立書籍 tag 欄位 DOM 元素
 * - Tag chips 渲染（含 +N 摺疊邏輯）
 * - CSS injection 防護（色碼格式驗證）
 *
 * @param {Object} deps - 依賴注入
 * @param {Function} deps.getTagById - (tagId) => Tag | null
 * @param {Function} deps.getCategoryById - (categoryId) => TagCategory | null
 * @param {Document} deps.document - DOM 文檔物件
 * @returns {Object} TagCellRenderer
 */
function createTagCellRenderer (deps) {
  if (!deps || typeof deps !== 'object') {
    throw new TypeError('createTagCellRenderer requires deps object')
  }
  if (typeof deps.getTagById !== 'function') {
    throw new TypeError('deps.getTagById must be a function')
  }
  if (typeof deps.getCategoryById !== 'function') {
    throw new TypeError('deps.getCategoryById must be a function')
  }
  if (!deps.document) {
    throw new TypeError('deps.document is required')
  }

  const doc = deps.document

  const tagResolver = createTagResolver({
    getTagById: deps.getTagById,
    getCategoryById: deps.getCategoryById
  })

  /**
   * 建立單一 tag chip DOM 元素
   * W5-003：categoryColor 格式驗證防止 CSS injection
   *
   * @param {Object} tag - 解析後的 tag 資料
   * @returns {HTMLElement} span 元素
   */
  function createTagChipElement (tag) {
    const safeColor = sanitizeColor(tag.categoryColor)
    const chip = doc.createElement('span')
    chip.className = 'tag-chip'
    chip.style.backgroundColor = `${safeColor}20`
    chip.style.color = safeColor
    chip.style.border = `1px solid ${safeColor}40`
    chip.title = `${tag.categoryName}: ${tag.tagName}`
    chip.textContent = tag.tagName
    return chip
  }

  /**
   * 將 tag chips 加入容器元素（含 +N 摺疊邏輯）
   *
   * @param {HTMLElement} container - 容器元素
   * @param {Array<Object>} resolvedTags - resolveTagsForDisplay 回傳值
   */
  function appendTagChips (container, resolvedTags) {
    const { MAX_VISIBLE } = TAG_DISPLAY
    const visible = resolvedTags.slice(0, MAX_VISIBLE)
    const remaining = resolvedTags.length - MAX_VISIBLE

    visible.forEach(tag => {
      const chip = createTagChipElement(tag)
      container.appendChild(chip)
    })

    if (remaining > 0) {
      const more = doc.createElement('span')
      more.className = 'tag-chip tag-chip--more'
      more.title = `還有 ${remaining} 個標籤`
      more.textContent = `+${remaining}`
      container.appendChild(more)
    }
  }

  /**
   * 建立書籍 tag 欄位 DOM 元素
   *
   * @param {string[]} tagIds - 書籍的 tagIds
   * @returns {HTMLElement} td 元素
   */
  function createTagCell (tagIds) {
    const td = doc.createElement('td')
    td.className = 'book-tags'
    const resolved = tagResolver.resolveTagsForDisplay(tagIds)

    if (resolved.length === 0) {
      td.innerHTML = `<span class="book-tags-empty">${TAG_DISPLAY.EMPTY_LABEL}</span>`
      return td
    }

    appendTagChips(td, resolved)
    return td
  }

  return {
    createTagCell,
    resolveTagsForDisplay: tagResolver.resolveTagsForDisplay
  }
}

module.exports = { createTagCellRenderer, TAG_DISPLAY }
