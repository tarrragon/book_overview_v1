/**
 * 標題衝突檢測器
 * 
 * 負責功能：
 * - 檢測書籍標題的差異和潛在衝突
 * - 使用多層次相似度算法進行精確比較
 * - 支援語言特性和格式化差異的智能處理
 * - 提供可配置的相似度閾值和語言設定
 */

class AdvancedSimilarityCalculator {
  constructor(options = {}) {
    this.options = {
      characterWeight: options.characterWeight || 0.3,
      wordWeight: options.wordWeight || 0.4,
      semanticWeight: options.semanticWeight || 0.3,
      ...options
    };
  }

  calculate(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    // 正規化字串
    const normalized1 = this.normalizeString(str1);
    const normalized2 = this.normalizeString(str2);

    if (normalized1 === normalized2) return 1.0;

    // 1. 字元級相似度
    const charSimilarity = this.calculateCharacterSimilarity(normalized1, normalized2);
    
    // 2. 詞彙級相似度
    const wordSimilarity = this.calculateWordSimilarity(normalized1, normalized2);
    
    // 3. 語義級相似度
    const semanticSimilarity = this.calculateSemanticSimilarity(normalized1, normalized2);
    
    // 加權組合
    return this.combineScores(charSimilarity, wordSimilarity, semanticSimilarity);
  }

  normalizeString(str) {
    return str
      .toLowerCase()
      .trim()
      // 移除標點符號
      .replace(/[^\w\s\u4e00-\u9fff]/g, '')
      // 統一空白字元
      .replace(/\s+/g, ' ')
      // 移除常見的書籍格式詞彙
      .replace(/\b(第\d+[卷冊集部]|vol\.?\s*\d+|volume\s*\d+)\b/gi, '')
      .trim();
  }

  calculateCharacterSimilarity(str1, str2) {
    // 使用 Levenshtein 距離計算字元相似度
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // 初始化矩陣
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // 填充矩陣
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,     // 刪除
            matrix[i][j - 1] + 1,     // 插入
            matrix[i - 1][j - 1] + 1  // 替換
          );
        }
      }
    }

    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1.0 : 1 - (matrix[len1][len2] / maxLen);
  }

  calculateWordSimilarity(str1, str2) {
    const words1 = new Set(str1.split(/\s+/).filter(word => word.length > 0));
    const words2 = new Set(str2.split(/\s+/).filter(word => word.length > 0));

    if (words1.size === 0 && words2.size === 0) return 1.0;
    if (words1.size === 0 || words2.size === 0) return 0.0;

    // Jaccard 相似度
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  calculateSemanticSimilarity(str1, str2) {
    // 簡化的語義相似度：基於關鍵字特徵
    const features1 = this.extractFeatures(str1);
    const features2 = this.extractFeatures(str2);

    // 計算特徵向量的餘弦相似度
    return this.calculateCosineSimilarity(features1, features2);
  }

  extractFeatures(str) {
    const features = new Map();
    
    // 1. N-gram 特徵 (2-gram 和 3-gram)
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i <= str.length - n; i++) {
        const ngram = str.substring(i, i + n);
        features.set(`ngram_${n}_${ngram}`, (features.get(`ngram_${n}_${ngram}`) || 0) + 1);
      }
    }

    // 2. 詞彙特徵
    const words = str.split(/\s+/);
    words.forEach(word => {
      if (word.length > 1) {
        features.set(`word_${word}`, (features.get(`word_${word}`) || 0) + 1);
      }
    });

    // 3. 長度特徵
    features.set('length_category', this.getLengthCategory(str.length));

    return features;
  }

  getLengthCategory(length) {
    if (length < 10) return 'short';
    if (length < 30) return 'medium';
    if (length < 50) return 'long';
    return 'very_long';
  }

  calculateCosineSimilarity(features1, features2) {
    const allKeys = new Set([...features1.keys(), ...features2.keys()]);
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const key of allKeys) {
      const val1 = features1.get(key) || 0;
      const val2 = features2.get(key) || 0;
      
      dotProduct += val1 * val2;
      norm1 += val1 * val1;
      norm2 += val2 * val2;
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  combineScores(charSimilarity, wordSimilarity, semanticSimilarity) {
    return (
      charSimilarity * this.options.characterWeight +
      wordSimilarity * this.options.wordWeight +
      semanticSimilarity * this.options.semanticWeight
    );
  }
}

class TitleConflictDetector {
  constructor(options = {}) {
    this.options = {
      // 相似度閾值
      lowSimilarityThreshold: options.lowSimilarityThreshold || 0.9,    // 90% 以上視為相同
      mediumSimilarityThreshold: options.mediumSimilarityThreshold || 0.7, // 70-90% 為潛在衝突
      highSimilarityThreshold: options.highSimilarityThreshold || 0.5,  // 50-70% 為明顯衝突
      
      // 語言設定
      supportedLanguages: options.supportedLanguages || ['zh', 'en', 'ja'],
      
      // 特殊處理
      ignoreCase: options.ignoreCase !== false,
      ignoreSpecialChars: options.ignoreSpecialChars !== false,
      handleNumberVariations: options.handleNumberVariations !== false,
      
      ...options
    };

    this.similarityCalculator = new AdvancedSimilarityCalculator(options.similarity || {});
  }

  async detect(item1, item2, options = {}) {
    // 提取標題
    const title1 = this.extractTitle(item1);
    const title2 = this.extractTitle(item2);

    // 基本驗證
    if (!title1 || !title2) {
      return null; // 缺少標題資料
    }

    // 快速完全相同檢查
    if (title1 === title2) {
      return null; // 完全相同，無衝突
    }

    // 計算相似度
    const similarity = this.similarityCalculator.calculate(title1, title2);

    // 檢查是否構成衝突
    if (similarity >= this.options.lowSimilarityThreshold) {
      return null; // 相似度太高，不視為衝突
    }

    // 特殊情況檢查
    const specialConflict = this.checkSpecialCases(title1, title2);
    
    // 計算嚴重程度和信心度
    const severity = this.calculateSeverity(similarity, specialConflict);
    const confidence = this.calculateConfidence(title1, title2, similarity, specialConflict);

    return {
      severity,
      confidence,
      details: {
        title1,
        title2,
        similarity,
        specialConflict,
        detectionReason: this.getDetectionReason(similarity, specialConflict),
        recommendations: this.generateRecommendations(title1, title2, similarity)
      },
      metadata: {
        detectorType: 'title',
        algorithm: 'advanced-similarity',
        version: '2.0'
      }
    };
  }

  extractTitle(item) {
    let title = item.title || item.name || item.bookTitle || '';
    
    if (typeof title !== 'string') {
      return '';
    }

    // 清理標題
    return title
      .trim()
      .replace(/\s+/g, ' '); // 統一空白
  }

  checkSpecialCases(title1, title2) {
    const cases = [];

    // 1. 版本差異 (如：v1, v2, 第二版等)
    if (this.hasVersionDifference(title1, title2)) {
      cases.push('version_difference');
    }

    // 2. 語言差異 (中英文對照)
    if (this.hasLanguageDifference(title1, title2)) {
      cases.push('language_difference');
    }

    // 3. 格式差異 (全形半形、大小寫等)
    if (this.hasFormatDifference(title1, title2)) {
      cases.push('format_difference');
    }

    // 4. 縮寫展開
    if (this.hasAbbreviationDifference(title1, title2)) {
      cases.push('abbreviation_difference');
    }

    // 5. 序號差異 (卷號、集數等)
    if (this.hasSeriesNumberDifference(title1, title2)) {
      cases.push('series_number_difference');
    }

    return cases;
  }

  hasVersionDifference(title1, title2) {
    const versionPattern = /(?:第?\s*[一二三四五六七八九十\d]+\s*[版本卷集部]|v\.?\s*\d+|version\s*\d+)/gi;
    
    const hasVersion1 = versionPattern.test(title1);
    const hasVersion2 = versionPattern.test(title2);
    
    // 重設正則表達式的 lastIndex
    versionPattern.lastIndex = 0;
    
    return hasVersion1 !== hasVersion2 || (hasVersion1 && hasVersion2);
  }

  hasLanguageDifference(title1, title2) {
    const chineseChars = /[\u4e00-\u9fff]/;
    const englishChars = /[a-zA-Z]/;
    
    const isChinese1 = chineseChars.test(title1);
    const isEnglish1 = englishChars.test(title1);
    const isChinese2 = chineseChars.test(title2);
    const isEnglish2 = englishChars.test(title2);
    
    return (isChinese1 !== isChinese2) || (isEnglish1 !== isEnglish2);
  }

  hasFormatDifference(title1, title2) {
    // 檢查全形半形差異
    const fullWidth = /[！-～]/;
    const hasFullWidth1 = fullWidth.test(title1);
    const hasFullWidth2 = fullWidth.test(title2);
    
    return hasFullWidth1 !== hasFullWidth2;
  }

  hasAbbreviationDifference(title1, title2) {
    // 簡化的縮寫檢查
    const abbreviations = [
      ['and', '&'],
      ['corporation', 'corp'],
      ['company', 'co'],
      ['的', '之']
    ];

    for (const [full, abbr] of abbreviations) {
      const hasFullInFirst = title1.toLowerCase().includes(full);
      const hasAbbrInFirst = title1.toLowerCase().includes(abbr);
      const hasFullInSecond = title2.toLowerCase().includes(full);
      const hasAbbrInSecond = title2.toLowerCase().includes(abbr);

      if ((hasFullInFirst && hasAbbrInSecond) || (hasAbbrInFirst && hasFullInSecond)) {
        return true;
      }
    }

    return false;
  }

  hasSeriesNumberDifference(title1, title2) {
    const numberPattern = /第?\s*[一二三四五六七八九十\d]+\s*[卷冊集部章回]/gi;
    
    const numbers1 = title1.match(numberPattern) || [];
    const numbers2 = title2.match(numberPattern) || [];
    
    return numbers1.length !== numbers2.length || 
           !numbers1.every((num, index) => num === numbers2[index]);
  }

  calculateSeverity(similarity, specialCases) {
    // 特殊情況的嚴重程度調整
    if (specialCases.includes('format_difference') && similarity > 0.8) {
      return 'LOW'; // 僅格式差異，相似度高
    }

    if (specialCases.includes('version_difference') || specialCases.includes('series_number_difference')) {
      return 'MEDIUM'; // 版本或序號差異
    }

    if (specialCases.includes('language_difference')) {
      return 'HIGH'; // 語言差異需要人工確認
    }

    // 基於相似度的嚴重程度
    if (similarity >= this.options.mediumSimilarityThreshold) {
      return 'LOW';
    } else if (similarity >= this.options.highSimilarityThreshold) {
      return 'MEDIUM';
    } else {
      return 'HIGH';
    }
  }

  calculateConfidence(title1, title2, similarity, specialCases) {
    let confidence = 0.8; // 基礎信心度

    // 根據相似度調整
    if (similarity < 0.3) {
      confidence *= 1.2; // 低相似度 = 明確衝突
    } else if (similarity > 0.8) {
      confidence *= 0.8; // 高相似度 = 可能不是真實衝突
    }

    // 根據特殊情況調整
    if (specialCases.includes('format_difference')) {
      confidence *= 0.7; // 格式差異可能是假陽性
    }

    if (specialCases.includes('language_difference')) {
      confidence *= 1.1; // 語言差異是明確信號
    }

    // 根據標題長度調整
    const avgLength = (title1.length + title2.length) / 2;
    if (avgLength < 5) {
      confidence *= 0.6; // 短標題容易誤判
    } else if (avgLength > 50) {
      confidence *= 1.1; // 長標題比較可靠
    }

    return Math.min(1.0, Math.max(0.1, confidence));
  }

  getDetectionReason(similarity, specialCases) {
    if (specialCases.length > 0) {
      return `特殊情況檢測: ${specialCases.join(', ')}`;
    }

    if (similarity < 0.3) {
      return '標題差異過大';
    } else if (similarity < 0.5) {
      return '標題有明顯差異';
    } else {
      return '標題存在潛在差異';
    }
  }

  generateRecommendations(title1, title2, similarity) {
    const recommendations = [];

    if (similarity > 0.7) {
      recommendations.push('建議確認是否為同一書籍的不同版本');
    }

    if (similarity < 0.3) {
      recommendations.push('建議人工確認書籍是否相同');
      recommendations.push('可能需要檢查書籍ISBN或其他唯一標識');
    }

    recommendations.push('建議使用更詳細的書籍元資料進行比對');

    return recommendations;
  }

  // 批次處理
  async detectBatch(items1, items2, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 50; // 標題比較相對消耗資源，使用較小批次

    for (let i = 0; i < items1.length; i += batchSize) {
      const batch1 = items1.slice(i, i + batchSize);
      const batch2 = items2.slice(i, i + batchSize);

      const batchPromises = batch1.map(async (item1, index) => {
        const item2 = batch2[index];
        if (!item2) return null;

        return await this.detect(item1, item2, options);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null));
    }

    return results;
  }

  getDetectorInfo() {
    return {
      type: 'TitleConflictDetector',
      version: '2.0.0',
      configuration: this.options,
      capabilities: [
        'advanced-similarity-calculation',
        'multi-language-support',
        'special-case-detection',
        'batch-processing'
      ]
    };
  }
}

module.exports = TitleConflictDetector;