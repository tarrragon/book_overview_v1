'use strict'

const { createTagResolver, TAG_RESOLVER_DEFAULTS } = require('../../../../src/ui/search/tag-resolver')

describe('TagResolver', () => {
  // Mock data
  const mockTags = new Map([
    ['tag-01', { id: 'tag-01', name: '科幻', categoryId: 'cat-01', isSystem: false }],
    ['tag-02', { id: 'tag-02', name: '文學', categoryId: 'cat-01', isSystem: false }],
    ['tag-03', { id: 'tag-03', name: '推理', categoryId: 'cat-deleted', isSystem: false }]
  ])

  const mockCategories = new Map([
    ['cat-01', { id: 'cat-01', name: '類別', color: '#FF0000', isSystem: false }]
  ])

  const mockDeps = {
    getTagById: (id) => mockTags.get(id) || null,
    getCategoryById: (id) => mockCategories.get(id) || null
  }

  describe('createTagResolver', () => {
    test('正常建立 resolver', () => {
      const resolver = createTagResolver(mockDeps)
      expect(resolver).toHaveProperty('resolveTag')
      expect(resolver).toHaveProperty('resolveTagsForDisplay')
      expect(resolver).toHaveProperty('resolveTagName')
    })

    test('deps 為 null → TypeError', () => {
      expect(() => createTagResolver(null)).toThrow(TypeError)
    })

    test('缺少 getTagById → TypeError', () => {
      expect(() => createTagResolver({ getCategoryById: jest.fn() })).toThrow(TypeError)
    })

    test('缺少 getCategoryById → TypeError', () => {
      expect(() => createTagResolver({ getTagById: jest.fn() })).toThrow(TypeError)
    })
  })

  describe('resolveTag', () => {
    const resolver = createTagResolver(mockDeps)

    test('正常解析含完整 category 資訊', () => {
      const result = resolver.resolveTag('tag-01')
      expect(result).toEqual({
        tagId: 'tag-01',
        tagName: '科幻',
        categoryId: 'cat-01',
        categoryName: '類別',
        categoryColor: '#FF0000'
      })
    })

    test('已刪除 tag → null', () => {
      expect(resolver.resolveTag('tag-deleted')).toBeNull()
    })

    test('category 已刪除 → fallback 值', () => {
      const result = resolver.resolveTag('tag-03')
      expect(result.categoryName).toBe(TAG_RESOLVER_DEFAULTS.FALLBACK_CATEGORY_NAME)
      expect(result.categoryColor).toBe(TAG_RESOLVER_DEFAULTS.FALLBACK_CATEGORY_COLOR)
    })
  })

  describe('resolveTagsForDisplay', () => {
    const resolver = createTagResolver(mockDeps)

    test('批量解析正確，順序一致', () => {
      const result = resolver.resolveTagsForDisplay(['tag-01', 'tag-02'])
      expect(result).toHaveLength(2)
      expect(result[0].tagName).toBe('科幻')
      expect(result[1].tagName).toBe('文學')
    })

    test('過濾已刪除 tag', () => {
      const result = resolver.resolveTagsForDisplay(['tag-01', 'tag-deleted', 'tag-02'])
      expect(result).toHaveLength(2)
    })

    test('null/undefined → 空陣列', () => {
      expect(resolver.resolveTagsForDisplay(null)).toEqual([])
      expect(resolver.resolveTagsForDisplay(undefined)).toEqual([])
    })

    test('忽略非字串元素', () => {
      const result = resolver.resolveTagsForDisplay(['tag-01', 123, null, 'tag-02'])
      expect(result).toHaveLength(2)
    })
  })

  describe('resolveTagName', () => {
    const resolver = createTagResolver(mockDeps)

    test('正常 → 名稱字串', () => {
      expect(resolver.resolveTagName('tag-01')).toBe('科幻')
    })

    test('不存在 → null', () => {
      expect(resolver.resolveTagName('tag-gone')).toBeNull()
    })
  })
})
