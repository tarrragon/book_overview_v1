'use strict'

const TAG_RESOLVER_DEFAULTS = Object.freeze({
  FALLBACK_CATEGORY_NAME: '未分類',
  FALLBACK_CATEGORY_COLOR: '#808080'
})

/**
 * 建立 Tag Resolver 實例
 *
 * @param {Object} deps - 依賴注入
 * @param {Function} deps.getTagById - (tagId) => Tag | null
 * @param {Function} deps.getCategoryById - (categoryId) => TagCategory | null
 * @returns {Object} TagResolver
 */
function createTagResolver (deps) {
  if (!deps || typeof deps !== 'object') {
    throw new TypeError('createTagResolver requires deps object')
  }
  if (typeof deps.getTagById !== 'function') {
    throw new TypeError('deps.getTagById must be a function')
  }
  if (typeof deps.getCategoryById !== 'function') {
    throw new TypeError('deps.getCategoryById must be a function')
  }

  const { getTagById, getCategoryById } = deps

  /**
   * 解析單一 tagId
   * @param {string} tagId
   * @returns {Object|null}
   */
  function resolveTag (tagId) {
    if (!tagId || typeof tagId !== 'string') {
      return null
    }

    const tag = getTagById(tagId)
    if (!tag) {
      return null
    }

    const category = getCategoryById(tag.categoryId)

    return {
      tagId: tag.id,
      tagName: tag.name,
      categoryId: tag.categoryId,
      categoryName: category ? category.name : TAG_RESOLVER_DEFAULTS.FALLBACK_CATEGORY_NAME,
      categoryColor: category ? category.color : TAG_RESOLVER_DEFAULTS.FALLBACK_CATEGORY_COLOR
    }
  }

  /**
   * 批量解析 tagIds 為顯示用資料
   * @param {string[]} tagIds
   * @returns {Array}
   */
  function resolveTagsForDisplay (tagIds) {
    if (!Array.isArray(tagIds)) {
      return []
    }

    const results = []
    for (const tagId of tagIds) {
      if (typeof tagId !== 'string') {
        continue
      }
      const resolved = resolveTag(tagId)
      if (resolved) {
        results.push(resolved)
      }
    }
    return results
  }

  /**
   * 便捷方法：tagId → tag 名稱
   * @param {string} tagId
   * @returns {string|null}
   */
  function resolveTagName (tagId) {
    const resolved = resolveTag(tagId)
    return resolved ? resolved.tagName : null
  }

  return {
    resolveTag,
    resolveTagsForDisplay,
    resolveTagName
  }
}

module.exports = { createTagResolver, TAG_RESOLVER_DEFAULTS }
