/**
 * 效能測試資料生成器
 *
 * 負責生成各種規模和複雜度的測試資料
 * 支援書籍資料生成、JSON檔案生成、場景資料生成
 */

class PerformanceTestDataGenerator {
  constructor () {
    this.bookTemplates = this.initializeBookTemplates()
    this.generatedData = new Map() // 快取已生成的資料
  }

  // 初始化書籍模板
  initializeBookTemplates () {
    return {
      fiction: {
        genres: ['小說', '推理', '科幻', '奇幻', '愛情', '冒險', '恐怖', '青春'],
        titlePatterns: ['xxx的秘密', 'xxx之謎', 'xxx傳說', 'xxx日記', 'xxx之旅', 'xxx物語'],
        authorPatterns: ['李xxx', '陳xxx', '王xxx', '張xxx', '林xxx', '吳xxx', '黃xxx'],
        descriptionStarters: ['這是一個關於xxx的故事', 'xxx在一個神秘的', '當xxx遇見xxx時']
      },
      nonFiction: {
        genres: ['商業', '科技', '歷史', '傳記', '自我成長', '心理學', '哲學', '社會學'],
        titlePatterns: ['xxx指南', 'xxx大全', 'xxx思考', 'xxx方法', 'xxx原理', 'xxx實戰'],
        authorPatterns: ['Dr. xxx', 'Prof. xxx', 'xxx博士', 'xxx教授', 'xxx專家'],
        descriptionStarters: ['本書探討xxx的核心概念', '作者深入分析xxx', '透過xxx方法']
      }
    }
  }

  // 主要書籍生成方法
  generateBooks (count, options = {}) {
    const {
      complexity = 'normal',
      duplicateRate = 0.05,
      includeImages = false,
      includeLongTexts = false,
      cacheKey = null
    } = options

    // 檢查快取
    if (cacheKey && this.generatedData.has(cacheKey)) {
      const cached = this.generatedData.get(cacheKey)
      return cached.slice(0, count) // 返回請求數量的書籍
    }

    const complexitySettings = this.getComplexitySettings(complexity)
    const books = []

    for (let i = 0; i < count; i++) {
      const book = this.generateSingleBook(i, complexitySettings, {
        includeImages,
        includeLongTexts
      })
      books.push(book)
    }

    // 添加重複書籍以測試去重邏輯
    this.addDuplicateBooks(books, duplicateRate)

    // 快取結果
    if (cacheKey) {
      this.generatedData.set(cacheKey, [...books])
    }

    return books
  }

  // 真實場景書籍生成器 (重構版)
  generateRealisticBooks (count, options = {}) {
    const {
      complexityDistribution = { simple: 30, normal: 50, complex: 20 },
      includeVariations = true,
      simulateRealWorldErrors = true,
      cacheKey = null
    } = options

    // 檢查快取
    if (cacheKey && this.generatedData.has(cacheKey)) {
      const cached = this.generatedData.get(cacheKey)
      return cached.slice(0, count)
    }

    const books = []
    const total = complexityDistribution.simple + complexityDistribution.normal + complexityDistribution.complex

    // 計算各複雜度的書籍數量
    const simpleCount = Math.floor(count * complexityDistribution.simple / total)
    const normalCount = Math.floor(count * complexityDistribution.normal / total)
    const complexCount = count - simpleCount - normalCount

    // 生成不同複雜度的書籍
    books.push(...this.generateComplexityLevelBooks(simpleCount, 'simple', includeVariations))
    books.push(...this.generateComplexityLevelBooks(normalCount, 'normal', includeVariations))
    books.push(...this.generateComplexityLevelBooks(complexCount, 'complex', includeVariations))

    // 隨機打亂書籍順序
    this.shuffleArray(books)

    // 模擬真實世界的資料錯誤和異常
    if (simulateRealWorldErrors) {
      this.introduceRealisticDataErrors(books)
    }

    // 快取結果
    if (cacheKey) {
      this.generatedData.set(cacheKey, [...books])
    }

    return books
  }

  // 生成特定複雜度等級的書籍
  generateComplexityLevelBooks (count, complexity, includeVariations) {
    const books = []
    const complexitySettings = this.getComplexitySettings(complexity)

    for (let i = 0; i < count; i++) {
      const book = this.generateRealisticSingleBook(i, complexity, complexitySettings, includeVariations)
      books.push(book)
    }

    return books
  }

  // 生成真實的單一書籍
  generateRealisticSingleBook (index, complexity, settings, includeVariations) {
    const bookType = Math.random() < 0.6 ? 'fiction' : 'nonFiction'
    const template = this.bookTemplates[bookType]
    const variationLevel = includeVariations ? Math.random() : 0.5

    const book = {
      id: `realistic-book-${complexity}-${index}`,
      title: this.generateVariatedTitle(template, variationLevel),
      author: this.generateVariatedAuthor(template, variationLevel),
      description: this.generateVariatedDescription(settings.descriptionLength, template, variationLevel),
      publishDate: this.generateRealisticDate(complexity, variationLevel),
      genre: this.selectVariatedGenre(template.genres, variationLevel),
      rating: this.generateRealisticRating(variationLevel),
      pageCount: this.generateRealisticPageCount(complexity, variationLevel),
      isbn: this.generateRealisticISBN(variationLevel),
      tags: this.generateVariatedTags(complexity, variationLevel),
      readingStatus: this.selectRealisticReadingStatus(variationLevel),
      addedDate: this.generateRealisticDate('recent', variationLevel),
      lastModified: this.generateRealisticDate('recent', variationLevel)
    }

    // 根據複雜度添加額外欄位
    if (complexity !== 'simple') {
      book.metadata = this.generateRealisticMetadata(complexity, variationLevel)
    }

    if (complexity === 'complex') {
      book.categories = this.generateRealisticCategories(variationLevel)
      book.reviews = this.generateRealisticReviews(variationLevel)
      book.readingProgress = this.generateRealisticProgress(variationLevel)
    }

    return book
  }

  generateSingleBook (index, settings, options) {
    const bookType = Math.random() < 0.6 ? 'fiction' : 'nonFiction'
    const template = this.bookTemplates[bookType]

    const book = {
      id: `perf-test-book-${index}`,
      title: this.generateTitle(template.titlePatterns, template.genres),
      author: this.generateAuthor(template.authorPatterns),
      description: this.generateDescription(settings.descriptionLength, template.descriptionStarters),
      publishDate: this.generateRandomDate(2015, 2024),
      genre: this.selectRandom(template.genres),
      rating: Number((Math.random() * 5).toFixed(1)),
      pageCount: Math.floor(Math.random() * 800) + 100,
      isbn: this.generateISBN(),
      tags: this.generateTags(Math.floor(Math.random() * 8) + 2),
      readingStatus: this.selectRandom(['未讀', '閱讀中', '已讀', '暫停']),
      addedDate: this.generateRandomDate(2020, 2024),
      lastModified: this.generateRandomDate(2021, 2024)
    }

    // 根據設定添加額外欄位
    if (settings.includeMetadata) {
      book.metadata = this.generateMetadata()
    }

    if (options.includeImages) {
      book.coverImage = `https://picsum.photos/300/450?random=${index}`
      book.images = this.generateImageList(Math.floor(Math.random() * 3))
    }

    if (options.includeLongTexts) {
      book.fullDescription = this.generateLongText(settings.longTextLength)
      book.review = this.generateLongText(settings.longTextLength / 2)
    }

    return book
  }

  getComplexitySettings (complexity) {
    const settings = {
      simple: {
        descriptionLength: 50,
        includeMetadata: false,
        longTextLength: 0
      },
      normal: {
        descriptionLength: 150,
        includeMetadata: true,
        longTextLength: 300
      },
      complex: {
        descriptionLength: 400,
        includeMetadata: true,
        longTextLength: 1000
      },
      extreme: {
        descriptionLength: 800,
        includeMetadata: true,
        longTextLength: 2000
      }
    }

    return settings[complexity] || settings.normal
  }

  // JSON檔案生成方法
  generateJSONFile (targetSize, options = {}) {
    const {
      format = 'standard',
      compression = 'none',
      includeMetadata = true,
      complexity = 'normal'
    } = options

    const targetSizeBytes = this.parseSize(targetSize)
    let currentSize = 0
    const books = []
    let bookIndex = 0

    // 估算單本書籍大小並生成
    const estimatedBookSize = this.estimateBookSize(complexity)
    const estimatedBookCount = Math.ceil(targetSizeBytes / estimatedBookSize)

    while (currentSize < targetSizeBytes * 0.95 && books.length < estimatedBookCount * 1.2) {
      const book = this.generateSingleBook(bookIndex++,
        this.getComplexitySettings(complexity),
        options)

      const bookJson = JSON.stringify(book)
      const bookSize = new Blob([bookJson]).size

      if (currentSize + bookSize > targetSizeBytes * 1.1) {
        // 如果加入這本書會超過目標太多，停止生成
        break
      }

      currentSize += bookSize
      books.push(book)
    }

    const fileData = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      metadata: includeMetadata
        ? {
            totalBooks: books.length,
            estimatedSize: currentSize,
            targetSize: targetSizeBytes,
            format,
            complexity
          }
        : undefined,
      books
    }

    return {
      data: fileData,
      actualSize: new Blob([JSON.stringify(fileData)]).size,
      bookCount: books.length
    }
  }

  parseSize (sizeString) {
    const match = sizeString.match(/^(\d+(?:\.\d+)?)(KB|MB|GB)?$/i)
    if (!match) throw new Error(`Invalid size format: ${sizeString}`)

    const value = parseFloat(match[1])
    const unit = (match[2] || 'B').toUpperCase()

    const multipliers = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 }
    return value * multipliers[unit]
  }

  estimateBookSize (complexity) {
    const settings = this.getComplexitySettings(complexity)
    // 基礎欄位 + 描述長度 + metadata
    let baseSize = 200 // JSON結構和基礎欄位
    baseSize += settings.descriptionLength * 2 // Unicode字符
    baseSize += settings.includeMetadata ? 100 : 0
    baseSize += settings.longTextLength * 2 // 長文字欄位

    return baseSize
  }

  // 輔助方法
  generateTitle (titlePatterns, genres) {
    const pattern = this.selectRandom(titlePatterns)
    const genre = this.selectRandom(genres)
    const randomWord = this.generateRandomWord()
    return pattern.replace(/xxx/g, randomWord)
  }

  generateAuthor (authorPatterns) {
    const pattern = this.selectRandom(authorPatterns)
    const randomName = this.generateRandomName()
    return pattern.replace(/xxx/g, randomName)
  }

  generateDescription (length, starters) {
    const starter = this.selectRandom(starters)
    const baseText = starter.replace(/xxx/g, this.generateRandomWord())

    // 擴充到指定長度
    let description = baseText
    const words = ['故事', '情節', '角色', '背景', '主題', '內容', '結局', '開始']

    while (description.length < length) {
      description += '，' + this.selectRandom(words) + '非常' + this.selectRandom(['精彩', '動人', '深刻', '有趣', '震撼'])
    }

    return description.substring(0, length)
  }

  generateRandomDate (startYear, endYear) {
    const start = new Date(startYear, 0, 1)
    const end = new Date(endYear, 11, 31)
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0]
  }

  generateISBN () {
    const prefix = '978'
    const group = Math.floor(Math.random() * 10)
    const publisher = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
    const title = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    const check = Math.floor(Math.random() * 10)

    return `${prefix}-${group}-${publisher}-${title}-${check}`
  }

  generateTags (count) {
    const availableTags = ['精選', '推薦', '暢銷', '經典', '新書', '熱門', '得獎', '翻譯', '原創', '系列']
    const tags = []

    for (let i = 0; i < count && i < availableTags.length; i++) {
      const tag = availableTags[Math.floor(Math.random() * availableTags.length)]
      if (!tags.includes(tag)) {
        tags.push(tag)
      }
    }

    return tags
  }

  generateMetadata () {
    return {
      language: this.selectRandom(['zh-TW', 'zh-CN', 'en', 'ja']),
      format: this.selectRandom(['EPUB', 'PDF', 'MOBI', 'AZW3']),
      fileSize: Math.floor(Math.random() * 10000) + 1000, // KB
      downloadCount: Math.floor(Math.random() * 10000),
      lastAccessed: this.generateRandomDate(2023, 2024)
    }
  }

  generateLongText (length) {
    const sentences = [
      '這是一個非常精彩的故事內容。',
      '作者運用了豐富的想像力來描述場景。',
      '角色刻劃深刻，情節發展緊湊。',
      '整本書的主題思想值得深度思考。',
      '文字優美，描述生動有趣。'
    ]

    let text = ''
    while (text.length < length) {
      text += this.selectRandom(sentences) + ' '
    }

    return text.substring(0, length).trim()
  }

  generateImageList (count) {
    const images = []
    for (let i = 0; i < count; i++) {
      images.push({
        url: `https://picsum.photos/600/400?random=${Date.now()}-${i}`,
        type: 'illustration',
        caption: `插圖 ${i + 1}`
      })
    }
    return images
  }

  addDuplicateBooks (books, duplicateRate) {
    const duplicateCount = Math.floor(books.length * duplicateRate)

    for (let i = 0; i < duplicateCount; i++) {
      const originalIndex = Math.floor(Math.random() * Math.min(books.length, 20)) // 只從前20本中選擇
      const duplicateBook = JSON.parse(JSON.stringify(books[originalIndex]))

      // 略微修改以模擬真實的重複情況
      duplicateBook.id = `duplicate-${duplicateBook.id}`
      duplicateBook.addedDate = this.generateRandomDate(2023, 2024)

      books.push(duplicateBook)
    }
  }

  // 真實世界資料錯誤模擬
  introduceRealisticDataErrors (books) {
    const errorRate = 0.03 // 3%的錯誤率
    const errorCount = Math.floor(books.length * errorRate)

    for (let i = 0; i < errorCount; i++) {
      const bookIndex = Math.floor(Math.random() * books.length)
      const book = books[bookIndex]
      const errorType = this.selectRandom(['missing_field', 'invalid_format', 'encoding_issue', 'truncated_data'])

      switch (errorType) {
        case 'missing_field':
          // 隨機移除某個欄位
          const fieldsToRemove = ['author', 'publishDate', 'genre', 'description']
          const fieldToRemove = this.selectRandom(fieldsToRemove)
          if (Math.random() > 0.5) {
            delete book[fieldToRemove]
          } else {
            book[fieldToRemove] = null
          }
          break

        case 'invalid_format':
          // 格式錯誤
          if (Math.random() > 0.5) {
            book.rating = 'invalid_rating'
          } else {
            book.pageCount = 'not_a_number'
          }
          break

        case 'encoding_issue':
          // 編碼問題
          book.title = book.title.replace(/[\u4e00-\u9fff]/g, '?') // 中文變成問號
          break

        case 'truncated_data':
          // 資料截斷
          if (book.description && book.description.length > 50) {
            book.description = book.description.substring(0, 50) + '...'
          }
          break
      }
    }
  }

  // 陣列隨機打亂
  shuffleArray (array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
  }

  // 變化標題生成
  generateVariatedTitle (template, variationLevel) {
    const pattern = this.selectRandom(template.titlePatterns)
    let baseWord = this.generateRandomWord()

    // 高變化率時加入更複雜的詞彙
    if (variationLevel > 0.7) {
      const complexWords = ['量子', '時空', '永恆', '命運', '靈魂', '宇宙', '維度']
      baseWord = this.selectRandom(complexWords)
    }

    return pattern.replace(/xxx/g, baseWord)
  }

  // 變化作者生成
  generateVariatedAuthor (template, variationLevel) {
    const pattern = this.selectRandom(template.authorPatterns)
    let name = this.generateRandomName()

    // 高變化率時可能包含英文名或筆名
    if (variationLevel > 0.8) {
      const westernNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones']
      name = this.selectRandom(westernNames)
    }

    return pattern.replace(/xxx/g, name)
  }

  // 真實評分生成
  generateRealisticRating (variationLevel) {
    // 真實書籍評分通常集中在3-5分
    const baseRating = 3 + Math.random() * 2
    const variation = variationLevel * 0.5
    const rating = baseRating + (Math.random() - 0.5) * variation
    return Math.max(1, Math.min(5, Number(rating.toFixed(1))))
  }

  // 真實頁數生成
  generateRealisticPageCount (complexity, variationLevel) {
    let basePage = 200

    switch (complexity) {
      case 'simple':
        basePage = 100 + Math.random() * 150 // 100-250頁
        break
      case 'normal':
        basePage = 200 + Math.random() * 300 // 200-500頁
        break
      case 'complex':
        basePage = 400 + Math.random() * 600 // 400-1000頁
        break
    }

    const variation = variationLevel * 100
    return Math.floor(basePage + (Math.random() - 0.5) * variation)
  }

  // 場景資料生成
  generateScenarioData (scenarioType) {
    switch (scenarioType) {
      case 'concurrent_operations':
        return this.generateConcurrentScenario()
      case 'error_conditions':
        return this.generateErrorScenario()
      case 'memory_stress':
        return this.generateMemoryStressScenario()
      case 'large_dataset':
        return this.generateLargeDatasetScenario()
      default:
        throw new Error(`Unknown scenario type: ${scenarioType}`)
    }
  }

  generateConcurrentScenario () {
    return {
      operations: [
        { type: 'extract', delay: 0, books: this.generateBooks(50) },
        { type: 'search', delay: 100, query: '小說' },
        { type: 'filter', delay: 200, criteria: { genre: '推理' } },
        { type: 'export', delay: 300, format: 'json' },
        { type: 'import', delay: 400, data: this.generateBooks(30) }
      ],
      expectedConcurrency: 3,
      maxExecutionTime: 5000 // ms
    }
  }

  generateErrorScenario () {
    const corruptedBooks = this.generateBooks(10)
    // 故意損壞某些資料
    corruptedBooks[0].title = null
    corruptedBooks[1].id = undefined
    delete corruptedBooks[2].author

    return {
      invalidData: corruptedBooks,
      networkErrors: ['timeout', 'connection_refused', 'dns_error'],
      storageErrors: ['quota_exceeded', 'permission_denied'],
      expectedErrorHandling: ['graceful_degradation', 'user_notification', 'recovery_option']
    }
  }

  generateMemoryStressScenario () {
    return {
      largeBooks: this.generateBooks(100, {
        complexity: 'extreme',
        includeLongTexts: true,
        includeImages: true
      }),
      repeatedOperations: 50,
      memoryLimit: 100 * 1024 * 1024, // 100MB
      expectedBehavior: ['memory_cleanup', 'garbage_collection', 'graceful_degradation']
    }
  }

  generateLargeDatasetScenario () {
    return {
      datasets: {
        small: this.generateBooks(100),
        medium: this.generateBooks(1000),
        large: this.generateBooks(5000)
      },
      operationsPerDataset: ['load', 'search', 'filter', 'sort', 'export'],
      performanceExpectations: {
        small: { maxTime: 1000, maxMemory: 10 * 1024 * 1024 },
        medium: { maxTime: 5000, maxMemory: 50 * 1024 * 1024 },
        large: { maxTime: 15000, maxMemory: 100 * 1024 * 1024 }
      }
    }
  }

  // 快取管理
  clearCache () {
    this.generatedData.clear()
  }

  getCacheStats () {
    return {
      cacheSize: this.generatedData.size,
      totalItems: Array.from(this.generatedData.values()).reduce((sum, items) => sum + items.length, 0)
    }
  }

  // 工具方法
  selectRandom (array) {
    return array[Math.floor(Math.random() * array.length)]
  }

  generateRandomWord () {
    const words = ['夢想', '冒險', '秘密', '傳說', '英雄', '魔法', '未來', '過去', '愛情', '友情']
    return this.selectRandom(words)
  }

  generateRandomName () {
    const surnames = ['王', '李', '張', '劉', '陳', '楊', '趙', '黃', '周', '吳']
    const names = ['明', '華', '偉', '芳', '娟', '敏', '靜', '麗', '強', '磊']
    return this.selectRandom(surnames) + this.selectRandom(names)
  }

  // 真實ISBN生成
  generateRealisticISBN (variationLevel) {
    // 有時候ISBN格式會不標準
    if (variationLevel > 0.9) {
      // 10%機率產生舊版ISBN-10格式
      const group = Math.floor(Math.random() * 10)
      const publisher = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
      const title = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      return `${group}-${publisher}-${title}`
    }

    return this.generateISBN()
  }

  // 變化標籤生成
  generateVariatedTags (complexity, variationLevel) {
    const baseTags = ['精選', '推薦', '暢銷', '經典', '新書', '熱門', '得獎', '翻譯', '原創', '系列']
    const complexTags = ['深度思考', '心靈成長', '專業技能', '生活智慧', '文學經典', '科普知識']

    const availableTags = [...baseTags]
    if (complexity === 'complex') {
      availableTags.push(...complexTags)
    }

    const tagCount = Math.floor(2 + Math.random() * 6) // 2-8個標籤
    const tags = []

    for (let i = 0; i < tagCount && i < availableTags.length; i++) {
      const tag = availableTags[Math.floor(Math.random() * availableTags.length)]
      if (!tags.includes(tag)) {
        tags.push(tag)
      }
    }

    return tags
  }

  // 真實閱讀狀態選擇
  selectRealisticReadingStatus (variationLevel) {
    const statuses = ['未讀', '閱讀中', '已讀', '暫停']
    const weights = [0.4, 0.2, 0.3, 0.1] // 真實分布：40%未讀，20%閱讀中，30%已讀，10%暫停

    let random = Math.random()
    for (let i = 0; i < statuses.length; i++) {
      random -= weights[i]
      if (random <= 0) {
        return statuses[i]
      }
    }

    return statuses[0]
  }

  // 真實日期生成
  generateRealisticDate (type, variationLevel) {
    const now = new Date()
    let startYear, endYear

    switch (type) {
      case 'simple':
        startYear = now.getFullYear() - 2
        endYear = now.getFullYear()
        break
      case 'normal':
        startYear = now.getFullYear() - 5
        endYear = now.getFullYear()
        break
      case 'complex':
        startYear = now.getFullYear() - 10
        endYear = now.getFullYear()
        break
      case 'recent':
        startYear = now.getFullYear()
        endYear = now.getFullYear()
        break
      default:
        startYear = 2020
        endYear = now.getFullYear()
    }

    return this.generateRandomDate(startYear, endYear)
  }

  // 真實元數據生成
  generateRealisticMetadata (complexity, variationLevel) {
    const metadata = {
      language: this.selectWeightedRandom([
        { value: 'zh-TW', weight: 0.6 },
        { value: 'zh-CN', weight: 0.2 },
        { value: 'en', weight: 0.15 },
        { value: 'ja', weight: 0.05 }
      ]),
      format: this.selectWeightedRandom([
        { value: 'EPUB', weight: 0.5 },
        { value: 'PDF', weight: 0.3 },
        { value: 'MOBI', weight: 0.15 },
        { value: 'AZW3', weight: 0.05 }
      ]),
      fileSize: Math.floor(500 + Math.random() * 20000), // 0.5MB - 20MB
      downloadCount: Math.floor(Math.random() * 50000),
      lastAccessed: this.generateRealisticDate('recent', variationLevel)
    }

    // 複雜模式添加更多元數據
    if (complexity === 'complex') {
      metadata.chapters = Math.floor(5 + Math.random() * 25)
      metadata.readingTime = Math.floor(180 + Math.random() * 1800) // 3-30小時
      metadata.difficulty = this.selectRandom(['初級', '中級', '高級'])
    }

    return metadata
  }

  // 加權隨機選擇
  selectWeightedRandom (items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
    let random = Math.random() * totalWeight

    for (const item of items) {
      random -= item.weight
      if (random <= 0) {
        return item.value
      }
    }

    return items[0].value
  }

  // 真實類別生成
  generateRealisticCategories (variationLevel) {
    const categories = [
      '文學小說', '商業理財', '心理勵志', '醫療保健', '旅遊',
      '藝術設計', '人文史地', '社會科學', '自然科普', '語言學習'
    ]

    const count = Math.floor(1 + Math.random() * 3) // 1-3個類別
    const result = []

    for (let i = 0; i < count; i++) {
      const category = this.selectRandom(categories)
      if (!result.includes(category)) {
        result.push(category)
      }
    }

    return result
  }

  // 真實評論生成
  generateRealisticReviews (variationLevel) {
    const reviewCount = Math.floor(Math.random() * 10) // 0-9個評論
    const reviews = []

    for (let i = 0; i < reviewCount; i++) {
      reviews.push({
        rating: this.generateRealisticRating(variationLevel),
        comment: this.generateRealisticReviewText(),
        date: this.generateRealisticDate('recent', variationLevel),
        helpful: Math.floor(Math.random() * 20)
      })
    }

    return reviews
  }

  // 真實評論文字
  generateRealisticReviewText () {
    const positiveComments = [
      '內容豐富，值得推薦', '寫得很好，學到很多', '非常實用的一本書',
      '作者見解獨到', '深入淺出，容易理解'
    ]
    const neutralComments = [
      '普通的一本書', '內容還可以', '有些部分比較冗長',
      '適合入門讀者', '觀點比較傳統'
    ]
    const negativeComments = [
      '內容太淺顯', '不如期待', '翻譯有問題',
      '論點不夠充分', '例子太少'
    ]

    const allComments = [...positiveComments, ...neutralComments, ...negativeComments]
    return this.selectRandom(allComments)
  }

  // 真實進度生成
  generateRealisticProgress (variationLevel) {
    return {
      currentPage: Math.floor(Math.random() * 500),
      totalPages: Math.floor(300 + Math.random() * 700),
      percentage: Math.floor(Math.random() * 101),
      lastReadDate: this.generateRealisticDate('recent', variationLevel),
      bookmarks: Math.floor(Math.random() * 10),
      notes: Math.floor(Math.random() * 25)
    }
  }

  // 變化描述生成
  generateVariatedDescription (length, template, variationLevel) {
    const starter = this.selectRandom(template.descriptionStarters)
    const baseText = starter.replace(/xxx/g, this.generateRandomWord())

    // 根據變化等級調整描述複雜度
    const complexityWords = variationLevel > 0.7
      ? ['深刻', '複雜', '多層次', '哲學性', '批判性', '創新性']
      : ['有趣', '精彩', '動人', '實用', '清楚', '生動']

    let description = baseText
    while (description.length < length) {
      const word = this.selectRandom(complexityWords)
      description += '，' + word + '且' + this.selectRandom(['引人入勝', '發人深省', '令人印象深刻', '值得思考'])
    }

    return description.substring(0, length)
  }

  // 變化類型選擇
  selectVariatedGenre (genres, variationLevel) {
    if (variationLevel > 0.8) {
      // 高變化率時可能組合多個類型
      const primary = this.selectRandom(genres)
      const secondary = this.selectRandom(genres.filter(g => g !== primary))
      return `${primary}／${secondary}`
    }

    return this.selectRandom(genres)
  }
}

module.exports = { PerformanceTestDataGenerator }
