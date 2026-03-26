/**
 * 測試資料生成器
 *
 * 負責生成各種測試情境所需的資料
 * 支援不同規模的資料集和特殊測試情境
 */

class TestDataGenerator {
  constructor (options = {}) {
    this.options = {
      locale: options.locale || 'zh-TW',
      seed: options.seed || Date.now(),
      includeSpecialChars: options.includeSpecialChars || true,
      ...options
    }

    // 設定隨機種子以確保測試可重現
    this.randomSeed = this.options.seed
  }

  // 簡單的偽隨機數生成器
  random () {
    this.randomSeed = (this.randomSeed * 9301 + 49297) % 233280
    return this.randomSeed / 233280
  }

  randomInt (min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min
  }

  randomChoice (array) {
    return array[Math.floor(this.random() * array.length)]
  }

  generateBooks (count = 10, prefix = '') {
    const books = []
    const categories = [
      '技術類', '程式設計', '人工智慧', '雲端技術', '專案管理',
      '文學小說', '商業管理', '心理學', '歷史', '科學'
    ]

    const authors = [
      '測試作者A', '測試作者B', '測試作者C', '測試作者D', '測試作者E',
      'Test Author', 'John Doe', 'Jane Smith', '李明', '王小華'
    ]

    const types = ['流式', '版式']

    // 支援可選的前綴參數，用於區分不同批次的書籍 ID
    const idPrefix = prefix ? `${prefix}-` : 'test-book-'

    for (let i = 1; i <= count; i++) {
      const id = `${idPrefix}${String(i).padStart(6, '0')}`
      const progress = this.randomInt(0, 100)
      const isFinished = progress === 100 || this.random() < 0.1

      books.push({
        id,
        title: this.generateBookTitle(i),
        cover: `https://example.com/covers/${idPrefix}${i}.jpg`,
        progress: isFinished ? 100 : progress,
        type: this.randomChoice(types),
        isNew: this.random() < 0.3,
        isFinished,
        extractedAt: this.generateRandomDate(),
        category: this.randomChoice(categories),
        author: this.randomChoice(authors),
        // 測試專用屬性
        testMetadata: {
          generatedAt: new Date().toISOString(),
          dataSize: this.randomInt(1024, 10240), // bytes
          complexity: this.randomChoice(['simple', 'medium', 'complex'])
        }
      })
    }

    return books
  }

  generateBookTitle (index) {
    const baseTitles = [
      '資料結構與演算法',
      'JavaScript 完全指南',
      '人工智慧導論',
      '雲端架構設計模式',
      '敏捷開發實戰',
      '深度學習原理',
      'React 開發實務',
      '系統設計面試',
      '程式設計思維',
      '軟體工程原理'
    ]

    let title = this.randomChoice(baseTitles)

    // 添加序號使標題唯一
    title += ` ${index}`

    // 隨機添加特殊字符（測試國際化）
    if (this.options.includeSpecialChars && this.random() < 0.2) {
      const specialSuffixes = [
        ' 📚', ' (第二版)', ' - 實戰指南', ' & 進階技術',
        ' 🚀', ' (English Edition)', ' 한국어판', ' 日本語版'
      ]
      title += this.randomChoice(specialSuffixes)
    }

    return title
  }

  generateRandomDate () {
    const now = new Date()
    const pastDays = this.randomInt(1, 90)
    const randomDate = new Date(now.getTime() - pastDays * 24 * 60 * 60 * 1000)

    // 添加隨機時間
    randomDate.setHours(this.randomInt(0, 23))
    randomDate.setMinutes(this.randomInt(0, 59))
    randomDate.setSeconds(this.randomInt(0, 59))

    return randomDate.toISOString()
  }

  generateUsers (count = 3) {
    const users = []
    const names = ['測試使用者A', '測試使用者B', '測試使用者C', 'Test User', 'Demo User']

    for (let i = 1; i <= count; i++) {
      users.push({
        id: `test-user-${i}`,
        name: this.randomChoice(names) + i,
        email: `testuser${i}@example.com`,
        preferences: {
          theme: this.randomChoice(['light', 'dark', 'auto']),
          language: this.randomChoice(['zh-TW', 'en-US', 'ja-JP']),
          autoSync: this.random() < 0.7,
          dataSize: this.randomChoice(['small', 'medium', 'large'])
        },
        testMetadata: {
          createdAt: new Date().toISOString(),
          testUser: true
        }
      })
    }

    return users
  }

  generateSettings () {
    return {
      version: '1.0.0-test',
      testMode: true,
      debug: true,
      performance: {
        enableMetrics: true,
        trackMemory: true,
        slowMo: this.options.slowMo || 0
      },
      storage: {
        quota: 10 * 1024 * 1024, // 10MB
        compression: true,
        backup: true
      },
      ui: {
        theme: 'light',
        animations: false, // 加速測試
        autoRefresh: false
      },
      integration: {
        mockMode: true,
        apiTimeout: 5000,
        retryAttempts: 3
      }
    }
  }

  generateDuplicateBooks (originalBooks, duplicateRatio = 0.1) {
    const duplicateCount = Math.ceil(originalBooks.length * duplicateRatio)
    const duplicates = []

    for (let i = 0; i < duplicateCount; i++) {
      const original = this.randomChoice(originalBooks)
      const duplicate = {
        ...original,
        id: original.id + '-duplicate-' + i,
        // 略微修改某些屬性以測試去重邏輯
        progress: Math.min(100, original.progress + this.randomInt(-10, 10)),
        extractedAt: new Date(Date.now() - this.randomInt(0, 86400000)).toISOString(),
        testMetadata: {
          ...original.testMetadata,
          isDuplicate: true,
          originalId: original.id
        }
      }

      duplicates.push(duplicate)
    }

    return duplicates
  }

  generateCorruptedBooks (validBooks, corruptionTypes = ['missingId', 'invalidProgress', 'nullTitle']) {
    const corrupted = []

    corruptionTypes.forEach(type => {
      const original = this.randomChoice(validBooks)
      const corruptedBook = { ...original }

      switch (type) {
        case 'missingId':
          delete corruptedBook.id
          break
        case 'invalidProgress':
          corruptedBook.progress = 'invalid'
          break
        case 'nullTitle':
          corruptedBook.title = null
          break
        case 'wrongType':
          corruptedBook.id = 123 // should be string
          break
        default: {
          // 隨機破壞
          const keys = Object.keys(corruptedBook)
          const randomKey = this.randomChoice(keys)
          corruptedBook[randomKey] = undefined
        }
      }

      corruptedBook.testMetadata = {
        ...corruptedBook.testMetadata,
        corrupted: true,
        corruptionType: type
      }

      corrupted.push(corruptedBook)
    })

    return corrupted
  }

  generatePerformanceTestData () {
    const sizes = {
      small: 50,
      medium: 500,
      large: 2000,
      huge: 8000
    }

    const testSets = {}

    Object.entries(sizes).forEach(([size, count]) => {
      testSets[size] = {
        books: this.generateBooks(count),
        expectedMetrics: {
          maxLoadTime: this.getExpectedLoadTime(count),
          maxMemoryUsage: this.getExpectedMemoryUsage(count),
          maxOperationTime: this.getExpectedOperationTime(count)
        }
      }
    })

    return testSets
  }

  getExpectedLoadTime (bookCount) {
    // 基於書籍數量估算載入時間（毫秒）
    if (bookCount <= 100) return 1000
    if (bookCount <= 1000) return 3000
    if (bookCount <= 5000) return 10000
    return 30000
  }

  getExpectedMemoryUsage (bookCount) {
    // 基於書籍數量估算記憶體使用（位元組）
    const baseMemory = 1024 * 1024 // 1MB 基礎記憶體
    const perBookMemory = 512 // 每本書 512 bytes
    return baseMemory + (bookCount * perBookMemory)
  }

  getExpectedOperationTime (bookCount) {
    // 基於書籍數量估算操作時間（毫秒）
    return Math.max(100, bookCount * 2) // 至少100ms，每本書增加2ms
  }

  /**
   * 生成特殊配置的測試書籍
   */
  generateSpecialBook (type, customProperties = {}) {
    const baseId = `special-${type}-${Date.now()}`

    // 預設的特殊書籍模板
    const templates = {
      'completed-book': {
        id: baseId,
        title: `已完成閱讀的書籍 - ${type}`,
        progress: 100,
        status: 'completed',
        readingTime: this.randomInt(3600, 36000), // 1-10 小時
        type: this.randomChoice(['流式', '版式'])
      },
      'new-book': {
        id: baseId,
        title: `全新書籍 - ${type}`,
        progress: 0,
        status: 'new',
        readingTime: 0,
        type: this.randomChoice(['流式', '版式'])
      },
      'half-read': {
        id: baseId,
        title: `閱讀中書籍 - ${type}`,
        progress: this.randomInt(25, 75),
        status: 'reading',
        readingTime: this.randomInt(600, 3600),
        type: this.randomChoice(['流式', '版式'])
      },
      'unicode-title': {
        id: baseId,
        title: customProperties.title || '測試Unicode字符📚🔖✨',
        progress: this.randomInt(0, 100),
        status: 'reading',
        readingTime: this.randomInt(0, 3600),
        type: this.randomChoice(['流式', '版式'])
      },
      'large-title': {
        id: baseId,
        title: '這是一個非常非常非常非常非常非常非常非常非常非常非常非常長的書籍標題用於測試長標題處理能力',
        progress: this.randomInt(0, 100),
        status: this.randomChoice(['new', 'reading', 'completed']),
        readingTime: this.randomInt(0, 7200),
        type: this.randomChoice(['流式', '版式'])
      },
      'special-characters': {
        id: baseId,
        title: '特殊字符 & <script>alert("test")</script> 書籍',
        progress: this.randomInt(0, 100),
        status: this.randomChoice(['new', 'reading', 'completed']),
        readingTime: this.randomInt(0, 3600),
        type: this.randomChoice(['流式', '版式'])
      }
    }

    // 取得對應模板或使用通用模板
    const template = templates[type] || {
      id: baseId,
      title: `特殊測試書籍 - ${type}`,
      progress: this.randomInt(0, 100),
      status: this.randomChoice(['new', 'reading', 'completed']),
      readingTime: this.randomInt(0, 3600),
      type: this.randomChoice(['流式', '版式'])
    }

    // 加入基本書籍屬性
    const specialBook = {
      ...template,
      authors: ['特殊測試作者'],
      category: '測試分類',
      extractedAt: new Date().toISOString(),
      platform: 'readmoo',
      testMetadata: {
        isTestData: true,
        specialType: type,
        createdAt: new Date().toISOString()
      },
      ...customProperties // 覆寫自訂屬性
    }

    return specialBook
  }

  /**
   * 批次生成特殊書籍
   */
  generateSpecialBooks (bookConfigs) {
    return bookConfigs.map((config, index) => {
      const type = config.type || `custom-${index}`
      return this.generateSpecialBook(type, config)
    })
  }

  /**
   * 生成具有指定進度分佈的書籍
   */
  generateBooksWithProgress (count, scenarioName = 'default', options = {}) {
    const {
      completedRatio = 0.3, // 已完成書籍比例
      averageProgress = 50 // 平均進度
    } = options

    const books = []
    const completedCount = Math.floor(count * completedRatio)
    const inProgressCount = count - completedCount

    // 生成已完成的書籍
    for (let i = 0; i < completedCount; i++) {
      books.push({
        id: `${scenarioName}-completed-${i + 1}`,
        title: `已完成書籍 ${i + 1} - ${scenarioName}`,
        progress: 100,
        status: 'completed',
        isFinished: true,
        readingTime: this.randomInt(3600, 36000), // 1-10 小時
        type: this.randomChoice(['流式', '版式']),
        category: '測試分類',
        author: '測試作者',
        extractedAt: this.generateRandomDate(),
        testMetadata: {
          scenario: scenarioName,
          progressType: 'completed',
          generatedAt: new Date().toISOString()
        }
      })
    }

    // 計算整體目標：需要考慮已完成書籍（100%）和進行中書籍的平均值
    // 已完成書籍的貢獻：completedCount * 100
    // 進行中書籍的總貢獻需要：(averageProgress * count) - (completedCount * 100)
    const totalTargetProgress = averageProgress * count
    const completedContribution = completedCount * 100
    const inProgressTotalNeeded = totalTargetProgress - completedContribution

    // 生成進行中的書籍 - 精確控制以達到目標總平均
    const inProgressBooks = []

    if (inProgressCount > 0) {
      // 計算進行中書籍需要的平均進度
      const inProgressAverage = inProgressTotalNeeded / inProgressCount
      const clampedAverage = Math.max(0, Math.min(99, inProgressAverage))

      for (let i = 0; i < inProgressCount; i++) {
        if (i === inProgressCount - 1) {
          // 最後一本書：計算確切需要的進度值以達到精確總和
          const currentSum = inProgressBooks.reduce((sum, progress) => sum + progress, 0)
          const neededProgress = inProgressTotalNeeded - currentSum
          const finalProgress = Math.max(0, Math.min(99, neededProgress))
          inProgressBooks.push(finalProgress)
        } else {
          // 其他書籍：使用計算出的平均值，允許小幅變化
          let progress = clampedAverage

          // 對於多本書的情況，允許一些變化但確保能調整回來
          if (inProgressCount > 1) {
            const maxVariation = Math.min(3, Math.floor(Math.abs(clampedAverage) * 0.05)) // 更小的變化範圍
            const variation = this.randomInt(-maxVariation, maxVariation)
            progress = Math.max(1, Math.min(99, clampedAverage + variation))
          }

          inProgressBooks.push(progress)
        }
      }
    }

    // 創建進行中的書籍
    for (let i = 0; i < inProgressCount; i++) {
      books.push({
        id: `${scenarioName}-inprogress-${i + 1}`,
        title: `閱讀中書籍 ${i + 1} - ${scenarioName}`,
        progress: inProgressBooks[i],
        status: 'reading',
        isFinished: false,
        readingTime: this.randomInt(600, 7200), // 10分鐘-2小時
        type: this.randomChoice(['流式', '版式']),
        category: '測試分類',
        author: '測試作者',
        extractedAt: this.generateRandomDate(),
        testMetadata: {
          scenario: scenarioName,
          progressType: 'inprogress',
          targetProgress: averageProgress,
          generatedAt: new Date().toISOString()
        }
      })
    }

    // 隨機打亂順序
    for (let i = books.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1))
      ;[books[i], books[j]] = [books[j], books[i]]
    }

    return books
  }

  // 靜態方法：快速生成常用資料集
  static generateQuickTestData (size = 'small') {
    const generator = new TestDataGenerator()

    const counts = {
      small: 10,
      medium: 100,
      large: 1000
    }

    return {
      books: generator.generateBooks(counts[size] || 10),
      users: generator.generateUsers(1),
      settings: generator.generateSettings()
    }
  }
}

module.exports = { TestDataGenerator }
