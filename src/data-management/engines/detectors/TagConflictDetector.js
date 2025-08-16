/**
 * 標籤衝突檢測器
 * 
 * 負責功能：
 * - 檢測標籤、分類、書城來源等元資料衝突
 * - 支援層次化標籤結構和語義相似度比較
 * - 提供智能標籤合併和衝突解決建議
 * - 處理多語言標籤和同義詞識別
 */

class TagSemanticAnalyzer {
  constructor(options = {}) {
    this.synonyms = new Map([
      // 中文同義詞
      ['小說', ['fiction', '文學', '故事']],
      ['科幻', ['sci-fi', 'science-fiction', '科學幻想']],
      ['推理', ['mystery', '偵探', 'detective']],
      ['羅曼史', ['romance', '愛情', '言情']],
      ['歷史', ['history', '史學', '史記']],
      
      // 英文同義詞
      ['fiction', ['novel', 'story', '小說']],
      ['non-fiction', ['nonfiction', '非小說', '紀實']],
      ['biography', ['autobiography', '傳記', '自傳']],
      ['technology', ['tech', '科技', '技術']],
      ['business', ['商業', 'management', '管理']]
    ]);

    this.categories = new Map([
      // 標籤分層
      ['文學', ['小說', '詩歌', '散文', '戲劇']],
      ['科學', ['物理', '化學', '生物', '數學']],
      ['藝術', ['繪畫', '音樂', '雕塑', '攝影']],
      ['運動', ['足球', '籃球', '游泳', '跑步']]
    ]);
  }

  analyzeSimilarity(tags1, tags2) {
    const normalized1 = this.normalizeTags(tags1);
    const normalized2 = this.normalizeTags(tags2);

    // 1. 直接匹配
    const directMatch = this.calculateDirectMatch(normalized1, normalized2);
    
    // 2. 同義詞匹配
    const synonymMatch = this.calculateSynonymMatch(normalized1, normalized2);
    
    // 3. 層次匹配
    const hierarchicalMatch = this.calculateHierarchicalMatch(normalized1, normalized2);

    return {
      directMatch,
      synonymMatch,
      hierarchicalMatch,
      overallSimilarity: (directMatch * 0.6 + synonymMatch * 0.3 + hierarchicalMatch * 0.1)
    };
  }

  normalizeTags(tags) {
    if (!tags) return [];
    
    const tagArray = Array.isArray(tags) ? tags : [tags];
    
    return tagArray
      .map(tag => String(tag).toLowerCase().trim())
      .filter(tag => tag.length > 0)
      .map(tag => this.normalizeTag(tag));
  }

  normalizeTag(tag) {
    return tag
      .replace(/[^\w\u4e00-\u9fff\s]/g, '') // 移除特殊字元，保留中文
      .replace(/\s+/g, ' ')
      .trim();
  }

  calculateDirectMatch(tags1, tags2) {
    const set1 = new Set(tags1);
    const set2 = new Set(tags2);
    
    const intersection = new Set([...set1].filter(tag => set2.has(tag)));
    const union = new Set([...set1, ...set2]);
    
    return union.size === 0 ? 1.0 : intersection.size / union.size;
  }

  calculateSynonymMatch(tags1, tags2) {
    let matches = 0;
    let total = 0;

    for (const tag1 of tags1) {
      for (const tag2 of tags2) {
        total++;
        if (this.areSynonyms(tag1, tag2)) {
          matches++;
        }
      }
    }

    return total === 0 ? 0 : matches / total;
  }

  areSynonyms(tag1, tag2) {
    if (tag1 === tag2) return true;

    // 檢查同義詞字典
    for (const [primary, synonyms] of this.synonyms) {
      if ((tag1 === primary && synonyms.includes(tag2)) ||
          (tag2 === primary && synonyms.includes(tag1)) ||
          (synonyms.includes(tag1) && synonyms.includes(tag2))) {
        return true;
      }
    }

    return false;
  }

  calculateHierarchicalMatch(tags1, tags2) {
    let hierarchicalMatches = 0;
    let totalComparisons = 0;

    for (const tag1 of tags1) {
      for (const tag2 of tags2) {
        totalComparisons++;
        if (this.areInSameCategory(tag1, tag2)) {
          hierarchicalMatches++;
        }
      }
    }

    return totalComparisons === 0 ? 0 : hierarchicalMatches / totalComparisons;
  }

  areInSameCategory(tag1, tag2) {
    for (const [category, tags] of this.categories) {
      if (tags.includes(tag1) && tags.includes(tag2)) {
        return true;
      }
    }
    return false;
  }
}

class TagConflictDetector {
  constructor(options = {}) {
    this.options = {
      // 相似度閾值
      highSimilarityThreshold: options.highSimilarityThreshold || 0.8,
      mediumSimilarityThreshold: options.mediumSimilarityThreshold || 0.5,
      lowSimilarityThreshold: options.lowSimilarityThreshold || 0.2,
      
      // 標籤驗證
      minTagLength: options.minTagLength || 1,
      maxTagLength: options.maxTagLength || 50,
      maxTagCount: options.maxTagCount || 20,
      
      // 衝突檢測選項
      detectEmptyTags: options.detectEmptyTags !== false,
      detectDuplicateTags: options.detectDuplicateTags !== false,
      detectInconsistentCasing: options.detectInconsistentCasing !== false,
      
      ...options
    };

    this.semanticAnalyzer = new TagSemanticAnalyzer(options.semantic || {});
  }

  async detect(item1, item2, options = {}) {
    // 提取標籤資訊
    const tagInfo1 = this.extractTagInfo(item1);
    const tagInfo2 = this.extractTagInfo(item2);

    // 基本驗證
    if (!tagInfo1.isValid || !tagInfo2.isValid) {
      return this.createValidationConflict(tagInfo1, tagInfo2);
    }

    // 如果標籤完全相同，無衝突
    if (this.areTagsIdentical(tagInfo1.normalized, tagInfo2.normalized)) {
      return null;
    }

    // 語義相似度分析
    const similarity = this.semanticAnalyzer.analyzeSimilarity(
      tagInfo1.normalized, tagInfo2.normalized
    );

    // 檢查特殊衝突類型
    const specialConflicts = this.detectSpecialConflicts(tagInfo1, tagInfo2);

    // 如果相似度很高，可能不是衝突
    if (similarity.overallSimilarity >= this.options.highSimilarityThreshold && 
        specialConflicts.length === 0) {
      return null;
    }

    // 計算嚴重程度和信心度
    const severity = this.calculateSeverity(similarity, specialConflicts, tagInfo1, tagInfo2);
    const confidence = this.calculateConfidence(similarity, specialConflicts, tagInfo1, tagInfo2);

    return {
      severity,
      confidence,
      details: {
        tags1: tagInfo1.original,
        tags2: tagInfo2.original,
        normalizedTags1: tagInfo1.normalized,
        normalizedTags2: tagInfo2.normalized,
        similarity,
        specialConflicts,
        mergeSuggestions: this.generateMergeSuggestions(tagInfo1, tagInfo2, similarity)
      },
      metadata: {
        detectorType: 'tag',
        algorithm: 'semantic-similarity-analysis',
        version: '2.0'
      }
    };
  }

  extractTagInfo(item) {
    // 嘗試多個可能的標籤欄位
    const tagFields = ['tags', 'categories', 'genres', 'labels', 'keywords'];
    
    let tags = null;
    let source = 'unknown';

    for (const field of tagFields) {
      if (item[field]) {
        tags = item[field];
        source = field;
        break;
      }
    }

    if (!tags) {
      tags = [];
    }

    const normalized = this.semanticAnalyzer.normalizeTags(tags);
    const validation = this.validateTags(normalized);

    return {
      original: tags,
      normalized,
      source,
      isValid: validation.isValid,
      validationErrors: validation.errors,
      count: normalized.length,
      uniqueCount: new Set(normalized).size
    };
  }

  validateTags(tags) {
    const errors = [];
    let isValid = true;

    // 檢查標籤數量
    if (tags.length > this.options.maxTagCount) {
      errors.push(`Too many tags: ${tags.length} > ${this.options.maxTagCount}`);
      isValid = false;
    }

    // 檢查個別標籤
    for (const tag of tags) {
      if (tag.length < this.options.minTagLength) {
        errors.push(`Tag too short: "${tag}"`);
        isValid = false;
      }
      
      if (tag.length > this.options.maxTagLength) {
        errors.push(`Tag too long: "${tag}"`);
        isValid = false;
      }
    }

    // 檢查重複標籤
    const uniqueTags = new Set(tags);
    if (uniqueTags.size !== tags.length) {
      errors.push('Duplicate tags detected');
      if (this.options.detectDuplicateTags) {
        isValid = false;
      }
    }

    return { isValid, errors };
  }

  areTagsIdentical(tags1, tags2) {
    if (tags1.length !== tags2.length) return false;
    
    const set1 = new Set(tags1);
    const set2 = new Set(tags2);
    
    return set1.size === set2.size && [...set1].every(tag => set2.has(tag));
  }

  createValidationConflict(tagInfo1, tagInfo2) {
    // 針對標籤驗證失敗的特殊衝突
    return {
      severity: 'MEDIUM',
      confidence: 0.9,
      details: {
        validationErrors1: tagInfo1.validationErrors,
        validationErrors2: tagInfo2.validationErrors,
        conflictType: 'validation_failure',
        recommendations: [
          '修正標籤格式錯誤',
          '移除重複或無效標籤',
          '確保標籤符合長度限制'
        ]
      },
      metadata: {
        detectorType: 'tag',
        algorithm: 'validation-conflict',
        version: '2.0'
      }
    };
  }

  detectSpecialConflicts(tagInfo1, tagInfo2) {
    const conflicts = [];

    // 1. 完全不相交的標籤集
    const intersection = new Set([...tagInfo1.normalized].filter(tag => 
      tagInfo2.normalized.includes(tag)
    ));
    
    if (intersection.size === 0 && tagInfo1.normalized.length > 0 && tagInfo2.normalized.length > 0) {
      conflicts.push('completely_disjoint');
    }

    // 2. 標籤數量差異過大
    const countDifference = Math.abs(tagInfo1.count - tagInfo2.count);
    if (countDifference > 5) {
      conflicts.push('large_count_difference');
    }

    // 3. 語言混用
    if (this.hasLanguageMixture(tagInfo1.normalized, tagInfo2.normalized)) {
      conflicts.push('language_mixture');
    }

    // 4. 矛盾的標籤（如：已完成 vs 進行中）
    if (this.hasContradictoryTags(tagInfo1.normalized, tagInfo2.normalized)) {
      conflicts.push('contradictory_tags');
    }

    // 5. 大小寫不一致
    if (this.hasInconsistentCasing(tagInfo1.original, tagInfo2.original)) {
      conflicts.push('inconsistent_casing');
    }

    return conflicts;
  }

  hasLanguageMixture(tags1, tags2) {
    const hasChineseChars = (tags) => tags.some(tag => /[\u4e00-\u9fff]/.test(tag));
    const hasEnglishChars = (tags) => tags.some(tag => /[a-zA-Z]/.test(tag));

    const chinese1 = hasChineseChars(tags1);
    const english1 = hasEnglishChars(tags1);
    const chinese2 = hasChineseChars(tags2);
    const english2 = hasEnglishChars(tags2);

    return (chinese1 !== chinese2) || (english1 !== english2);
  }

  hasContradictoryTags(tags1, tags2) {
    const contradictions = [
      ['完成', '進行中'],
      ['已讀', '未讀'],
      ['喜歡', '不喜歡'],
      ['推薦', '不推薦'],
      ['completed', 'in-progress'],
      ['read', 'unread'],
      ['like', 'dislike']
    ];

    for (const [tag1, tag2] of contradictions) {
      if ((tags1.includes(tag1) && tags2.includes(tag2)) ||
          (tags1.includes(tag2) && tags2.includes(tag1))) {
        return true;
      }
    }

    return false;
  }

  hasInconsistentCasing(originalTags1, originalTags2) {
    if (!this.options.detectInconsistentCasing) return false;

    const allTags = [...originalTags1, ...originalTags2];
    const tagCases = new Map();

    for (const tag of allTags) {
      const lower = tag.toLowerCase();
      if (!tagCases.has(lower)) {
        tagCases.set(lower, new Set());
      }
      tagCases.get(lower).add(tag);
    }

    // 檢查是否有相同標籤的不同大小寫形式
    for (const [, cases] of tagCases) {
      if (cases.size > 1) {
        return true;
      }
    }

    return false;
  }

  calculateSeverity(similarity, specialConflicts, tagInfo1, tagInfo2) {
    // 特殊衝突的嚴重程度
    if (specialConflicts.includes('contradictory_tags')) {
      return 'HIGH';
    }

    if (specialConflicts.includes('completely_disjoint')) {
      return 'MEDIUM';
    }

    if (specialConflicts.includes('large_count_difference')) {
      return 'MEDIUM';
    }

    // 基於相似度的嚴重程度
    if (similarity.overallSimilarity <= this.options.lowSimilarityThreshold) {
      return 'HIGH';
    } else if (similarity.overallSimilarity <= this.options.mediumSimilarityThreshold) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  calculateConfidence(similarity, specialConflicts, tagInfo1, tagInfo2) {
    let confidence = 0.7; // 基礎信心度

    // 根據特殊衝突調整
    if (specialConflicts.includes('contradictory_tags')) {
      confidence *= 1.4; // 矛盾標籤是明確衝突
    }

    if (specialConflicts.includes('language_mixture')) {
      confidence *= 1.2; // 語言混用是明確信號
    }

    if (specialConflicts.includes('inconsistent_casing')) {
      confidence *= 0.8; // 大小寫差異可能不是真實衝突
    }

    // 根據相似度調整
    if (similarity.overallSimilarity < 0.1) {
      confidence *= 1.3; // 極低相似度表示明確衝突
    } else if (similarity.overallSimilarity > 0.7) {
      confidence *= 0.7; // 高相似度可能不是真實衝突
    }

    // 根據標籤數量調整
    const avgTagCount = (tagInfo1.count + tagInfo2.count) / 2;
    if (avgTagCount < 2) {
      confidence *= 0.6; // 標籤太少容易誤判
    } else if (avgTagCount > 10) {
      confidence *= 1.1; // 標籤多比較可靠
    }

    return Math.min(1.0, Math.max(0.1, confidence));
  }

  generateMergeSuggestions(tagInfo1, tagInfo2, similarity) {
    const suggestions = [];

    // 1. 直接合併策略
    const allTags = [...new Set([...tagInfo1.normalized, ...tagInfo2.normalized])];
    suggestions.push({
      strategy: 'merge_all',
      result: allTags,
      description: '合併所有標籤並去重'
    });

    // 2. 保留高頻標籤
    const tagFrequency = new Map();
    [...tagInfo1.normalized, ...tagInfo2.normalized].forEach(tag => {
      tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
    });

    const frequentTags = Array.from(tagFrequency.entries())
      .filter(([, freq]) => freq > 1)
      .map(([tag]) => tag);

    if (frequentTags.length > 0) {
      suggestions.push({
        strategy: 'keep_frequent',
        result: frequentTags,
        description: '保留在兩個資料源中都出現的標籤'
      });
    }

    // 3. 同義詞合併
    const synonymMerged = this.mergeSynonyms([...tagInfo1.normalized, ...tagInfo2.normalized]);
    if (synonymMerged.length !== allTags.length) {
      suggestions.push({
        strategy: 'merge_synonyms',
        result: synonymMerged,
        description: '合併同義詞標籤'
      });
    }

    return suggestions;
  }

  mergeSynonyms(tags) {
    const merged = new Set();
    const processed = new Set();

    for (const tag of tags) {
      if (processed.has(tag)) continue;

      // 尋找同義詞
      const synonyms = this.findSynonyms(tag, tags);
      
      if (synonyms.length > 0) {
        // 選擇最常見或最標準的形式
        const canonical = this.selectCanonicalForm([tag, ...synonyms]);
        merged.add(canonical);
        
        // 標記所有同義詞為已處理
        [tag, ...synonyms].forEach(syn => processed.add(syn));
      } else {
        merged.add(tag);
        processed.add(tag);
      }
    }

    return Array.from(merged);
  }

  findSynonyms(target, tags) {
    return tags.filter(tag => 
      tag !== target && this.semanticAnalyzer.areSynonyms(target, tag)
    );
  }

  selectCanonicalForm(synonyms) {
    // 簡單的啟發式：優先選擇中文，然後選擇最短的
    const chinese = synonyms.filter(syn => /[\u4e00-\u9fff]/.test(syn));
    if (chinese.length > 0) {
      return chinese.sort((a, b) => a.length - b.length)[0];
    }

    return synonyms.sort((a, b) => a.length - b.length)[0];
  }

  // 批次處理
  async detectBatch(items1, items2, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 100;

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
      type: 'TagConflictDetector',
      version: '2.0.0',
      configuration: this.options,
      capabilities: [
        'semantic-similarity-analysis',
        'synonym-detection',
        'hierarchical-matching',
        'multi-language-support',
        'merge-suggestions'
      ]
    };
  }
}

module.exports = TagConflictDetector;