# 📏 代碼品質標準

> **第三層參考文件** - 完整代碼品質標準與檢查系統  
> **適用對象**: 開發者、代碼審查者、品質保證工程師  
> **預期閱讀時間**: 50-70 分鐘  

## 🎯 概述

本文件建立完整的代碼品質標準體系，包含代碼審查清單、品質門檻定義、靜態分析工具配置和代碼風格指南。確保所有代碼符合專案的品質要求和維護性標準。

## 📋 代碼品質框架

### 品質維度分類

#### 核心品質維度
```javascript
class CodeQualityFramework {
  constructor() {
    this.qualityDimensions = {
      CORRECTNESS: {
        weight: 0.3,
        metrics: ['bug_density', 'test_coverage', 'failure_rate'],
        standards: {
          bug_density: { max: 0.1, unit: 'bugs_per_kloc' },
          test_coverage: { min: 80, unit: 'percentage' },
          failure_rate: { max: 0.05, unit: 'percentage' }
        }
      },
      
      MAINTAINABILITY: {
        weight: 0.25,
        metrics: ['cyclomatic_complexity', 'code_duplication', 'coupling'],
        standards: {
          cyclomatic_complexity: { max: 10, unit: 'mccabe_score' },
          code_duplication: { max: 5, unit: 'percentage' },
          coupling: { max: 7, unit: 'afferent_coupling' }
        }
      },
      
      READABILITY: {
        weight: 0.2,
        metrics: ['naming_quality', 'comment_ratio', 'line_length'],
        standards: {
          naming_quality: { min: 80, unit: 'score' },
          comment_ratio: { range: [0.1, 0.3], unit: 'ratio' },
          line_length: { max: 120, unit: 'characters' }
        }
      },
      
      PERFORMANCE: {
        weight: 0.15,
        metrics: ['execution_time', 'memory_usage', 'algorithm_complexity'],
        standards: {
          execution_time: { max: 100, unit: 'milliseconds' },
          memory_usage: { max: 512, unit: 'mb' },
          algorithm_complexity: { max: 'O(n log n)', unit: 'big_o' }
        }
      },
      
      SECURITY: {
        weight: 0.1,
        metrics: ['vulnerability_count', 'security_hotspots', 'credential_exposure'],
        standards: {
          vulnerability_count: { max: 0, unit: 'count' },
          security_hotspots: { max: 2, unit: 'count' },
          credential_exposure: { max: 0, unit: 'count' }
        }
      }
    };
  }

  calculateQualityScore(codeMetrics) {
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const [dimension, config] of Object.entries(this.qualityDimensions)) {
      const dimensionScore = this.calculateDimensionScore(dimension, codeMetrics, config);
      totalScore += dimensionScore * config.weight;
      totalWeight += config.weight;
    }
    
    return {
      overallScore: totalScore / totalWeight,
      dimensionScores: this.getDimensionScores(codeMetrics),
      recommendations: this.generateImprovementRecommendations(codeMetrics),
      qualityGrade: this.getQualityGrade(totalScore / totalWeight)
    };
  }

  getQualityGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}
```

### 品質閾值定義

#### 分層品質標準
```javascript
class QualityThresholds {
  constructor() {
    this.thresholds = {
      // 必要條件 - 未達成將阻止合併
      BLOCKING: {
        test_coverage: { min: 80 },
        critical_bugs: { max: 0 },
        security_vulnerabilities: { max: 0 },
        build_status: { required: 'PASSING' }
      },
      
      // 警告條件 - 需要審查但不阻止合併  
      WARNING: {
        cyclomatic_complexity: { max: 15 },
        code_duplication: { max: 10 },
        technical_debt_ratio: { max: 5 },
        maintainability_rating: { min: 'B' }
      },
      
      // 建議條件 - 最佳實踐建議
      ADVISORY: {
        comment_density: { range: [10, 30] },
        function_length: { max: 50 },
        class_size: { max: 500 },
        package_dependencies: { max: 10 }
      }
    };
  }

  evaluateCode(codeMetrics) {
    const results = {
      blocking_issues: [],
      warning_issues: [],
      advisory_issues: [],
      overall_status: 'UNKNOWN'
    };

    // 檢查阻塞性問題
    for (const [metric, threshold] of Object.entries(this.thresholds.BLOCKING)) {
      const violation = this.checkThreshold(metric, codeMetrics[metric], threshold);
      if (violation) {
        results.blocking_issues.push(violation);
      }
    }

    // 檢查警告問題
    for (const [metric, threshold] of Object.entries(this.thresholds.WARNING)) {
      const violation = this.checkThreshold(metric, codeMetrics[metric], threshold);
      if (violation) {
        results.warning_issues.push(violation);
      }
    }

    // 檢查建議問題
    for (const [metric, threshold] of Object.entries(this.thresholds.ADVISORY)) {
      const violation = this.checkThreshold(metric, codeMetrics[metric], threshold);
      if (violation) {
        results.advisory_issues.push(violation);
      }
    }

    // 決定整體狀態
    results.overall_status = this.determineOverallStatus(results);
    
    return results;
  }

  determineOverallStatus(results) {
    if (results.blocking_issues.length > 0) return 'BLOCKED';
    if (results.warning_issues.length > 3) return 'NEEDS_REVIEW';
    if (results.warning_issues.length > 0) return 'WARNING';
    return 'APPROVED';
  }
}
```

## 🔍 代碼審查標準

### 審查檢查清單

#### 功能性審查
```markdown
# 📋 功能性代碼審查清單

## 🎯 邏輯正確性
- [ ] 算法邏輯正確且高效
- [ ] 邊界條件處理完整
- [ ] 錯誤處理機制適當
- [ ] 輸入驗證充分且安全

## 🧪 測試覆蓋
- [ ] 單元測試覆蓋率達標 (≥80%)
- [ ] 關鍵路徑有整合測試
- [ ] 邊界值測試完整
- [ ] 負面測試案例充分

## 🔒 安全性
- [ ] 無SQL注入風險
- [ ] 無XSS漏洞
- [ ] 敏感資料正確處理
- [ ] 權限控制機制正確

## ⚡ 效能考量
- [ ] 無明顯效能瓶頸
- [ ] 資料庫查詢優化
- [ ] 記憶體使用合理
- [ ] 算法複雜度acceptable
```

#### 結構性審查
```javascript
class StructuralReviewChecker {
  constructor() {
    this.structureRules = {
      SOLID_PRINCIPLES: {
        rules: [
          'single_responsibility',
          'open_closed',
          'liskov_substitution', 
          'interface_segregation',
          'dependency_inversion'
        ],
        weight: 0.4
      },
      
      DESIGN_PATTERNS: {
        rules: [
          'appropriate_pattern_usage',
          'pattern_implementation_correctness',
          'no_anti_patterns'
        ],
        weight: 0.3
      },
      
      CODE_ORGANIZATION: {
        rules: [
          'logical_file_structure',
          'appropriate_abstraction_level',
          'clear_separation_of_concerns'
        ],
        weight: 0.3
      }
    };
  }

  checkStructuralQuality(codeAnalysis) {
    const results = {};
    
    for (const [category, config] of Object.entries(this.structureRules)) {
      results[category] = {
        score: this.evaluateCategory(category, codeAnalysis),
        violations: this.findViolations(category, codeAnalysis),
        recommendations: this.generateRecommendations(category, codeAnalysis)
      };
    }
    
    return {
      overall_structural_score: this.calculateOverallScore(results),
      category_results: results,
      critical_issues: this.identifyCriticalStructuralIssues(results),
      improvement_plan: this.createImprovementPlan(results)
    };
  }

  evaluateCategory(category, codeAnalysis) {
    switch(category) {
      case 'SOLID_PRINCIPLES':
        return this.evaluateSOLIDCompliance(codeAnalysis);
      case 'DESIGN_PATTERNS':
        return this.evaluatePatternUsage(codeAnalysis);
      case 'CODE_ORGANIZATION':
        return this.evaluateOrganization(codeAnalysis);
      default:
        return 0;
    }
  }

  evaluateSOLIDCompliance(analysis) {
    let score = 100;
    
    // Single Responsibility Principle
    if (analysis.class_responsibilities_count > 3) {
      score -= 20;
    }
    
    // Open/Closed Principle
    if (analysis.modification_frequency > 0.1) {
      score -= 15;
    }
    
    // Liskov Substitution Principle
    if (analysis.inheritance_violations > 0) {
      score -= 25;
    }
    
    // Interface Segregation Principle
    if (analysis.interface_pollution > 0) {
      score -= 20;
    }
    
    // Dependency Inversion Principle
    if (analysis.concrete_dependencies_ratio > 0.3) {
      score -= 20;
    }
    
    return Math.max(0, score);
  }
}
```

### 自動化代碼審查

#### CI/CD 整合檢查
```yaml
# .github/workflows/code-quality.yml
name: Code Quality Check

on:
  pull_request:
    branches: [ main, develop ]
  push:
    branches: [ main ]

jobs:
  code-quality:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
      with:
        fetch-depth: 0
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run ESLint
      run: npm run lint -- --format=json --output-file=eslint-results.json
      continue-on-error: true
    
    - name: Run Tests with Coverage
      run: npm run test:coverage -- --reporter=json --outputFile=test-results.json
      continue-on-error: true
    
    - name: Run Security Audit
      run: npm audit --json --audit-level=moderate > security-audit.json
      continue-on-error: true
    
    - name: Analyze Code Quality
      uses: ./.github/actions/quality-gate
      with:
        eslint-results: eslint-results.json
        test-results: test-results.json
        security-audit: security-audit.json
        quality-threshold: 80
    
    - name: Comment PR
      if: github.event_name == 'pull_request'
      uses: ./.github/actions/pr-comment
      with:
        results-path: quality-results.json
```

#### 品質閘門實作
```javascript
class QualityGate {
  constructor(config) {
    this.config = config;
    this.checkers = [
      new LintChecker(config.lint),
      new TestChecker(config.test),
      new CoverageChecker(config.coverage),
      new SecurityChecker(config.security),
      new ComplexityChecker(config.complexity)
    ];
  }

  async evaluatePullRequest(prData) {
    const results = {
      overall_status: 'UNKNOWN',
      checks: {},
      score: 0,
      recommendations: [],
      blocking_issues: []
    };

    // 並行執行所有檢查
    const checkPromises = this.checkers.map(async checker => {
      try {
        const result = await checker.check(prData);
        results.checks[checker.name] = result;
        return result;
      } catch (error) {
        results.checks[checker.name] = {
          status: 'ERROR',
          error: error.message
        };
        return null;
      }
    });

    const checkResults = await Promise.all(checkPromises);
    
    // 計算總體分數
    results.score = this.calculateOverallScore(checkResults);
    
    // 判定整體狀態
    results.overall_status = this.determineStatus(results.score, checkResults);
    
    // 收集阻塞性問題
    results.blocking_issues = this.collectBlockingIssues(checkResults);
    
    // 生成建議
    results.recommendations = this.generateRecommendations(checkResults);

    return results;
  }

  determineStatus(score, checkResults) {
    // 檢查是否有阻塞性失敗
    const hasBlockingFailures = checkResults.some(result => 
      result && result.blocking && !result.passed
    );
    
    if (hasBlockingFailures) return 'BLOCKED';
    if (score < this.config.quality_threshold) return 'NEEDS_IMPROVEMENT';
    if (score < this.config.excellence_threshold) return 'APPROVED';
    return 'EXCELLENT';
  }
}
```

## 📊 靜態分析工具配置

### ESLint 配置標準

#### 基礎 ESLint 配置
```javascript
// .eslintrc.js
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:security/recommended',
    'plugin:sonarjs/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: [
    '@typescript-eslint',
    'security',
    'sonarjs',
    'complexity',
    'import'
  ],
  rules: {
    // 複雜度控制
    'complexity': ['error', { max: 10 }],
    'max-lines': ['error', { max: 500 }],
    'max-lines-per-function': ['error', { max: 50 }],
    'max-params': ['error', { max: 4 }],
    'max-depth': ['error', { max: 4 }],
    
    // 代碼品質
    'no-duplicate-code': 'error',
    'no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    
    // TypeScript 特定規則
    '@typescript-eslint/no-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    
    // 安全性規則
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    
    // SonarJS 代碼異味檢測
    'sonarjs/cognitive-complexity': ['error', 15],
    'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
    'sonarjs/no-identical-functions': 'error',
    
    // 匯入管理
    'import/no-circular': 'error',
    'import/no-unused-modules': 'error',
    'import/order': ['error', {
      'groups': ['builtin', 'external', 'parent', 'sibling', 'index'],
      'newlines-between': 'always'
    }]
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.test.ts'],
      rules: {
        'max-lines-per-function': 'off',
        'sonarjs/no-duplicate-string': 'off'
      }
    }
  ]
};
```

#### 自訂規則擴展
```javascript
// eslint-rules/custom-rules.js
class CustomEslintRules {
  constructor() {
    this.rules = {
      'enforce-error-handling': this.enforceErrorHandling.bind(this),
      'require-jsdoc-functions': this.requireJsdocFunctions.bind(this),
      'no-deep-destructuring': this.noDeepDestructuring.bind(this),
      'prefer-functional-style': this.preferFunctionalStyle.bind(this)
    };
  }

  enforceErrorHandling(context) {
    return {
      CallExpression(node) {
        // 檢查是否為async函數調用但未處理錯誤
        if (this.isAsyncCall(node) && !this.hasErrorHandling(node)) {
          context.report({
            node,
            message: 'Async函數調用必須包含錯誤處理',
            suggest: [
              {
                desc: '添加try-catch處理',
                fix(fixer) {
                  return fixer.insertTextBefore(node, 'try { ');
                }
              }
            ]
          });
        }
      }
    };
  }

  requireJsdocFunctions(context) {
    return {
      FunctionDeclaration(node) {
        if (this.isPublicFunction(node) && !this.hasJSDocComment(node)) {
          context.report({
            node,
            message: '公開函數必須包含JSDoc文件',
            fix(fixer) {
              const jsdocTemplate = this.generateJSDocTemplate(node);
              return fixer.insertTextBefore(node, jsdocTemplate);
            }
          });
        }
      }
    };
  }

  generateJSDocTemplate(functionNode) {
    const params = functionNode.params.map(param => 
      `* @param {*} ${param.name} - 參數說明`
    ).join('\n');
    
    return `/**
 * 函數說明
${params}
 * @returns {*} 回傳值說明
 */
`;
  }
}
```

### SonarQube 整合

#### SonarQube 配置
```properties
# sonar-project.properties
sonar.projectKey=book-overview-v1
sonar.projectName=Book Overview Extension
sonar.projectVersion=1.0

# 原始碼配置
sonar.sources=src
sonar.tests=tests
sonar.exclusions=**/node_modules/**,**/dist/**,**/*.test.js

# JavaScript/TypeScript 配置
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.typescript.tsconfigPath=tsconfig.json

# 品質閘門設定
sonar.qualitygate.wait=true

# 代碼覆蓋率
sonar.coverage.exclusions=**/*.test.js,**/*.spec.js,**/test/**

# 重複代碼檢測
sonar.cpd.exclusions=**/*.test.js,**/*.spec.js

# 品質規則自訂
sonar.issue.ignore.multicriteria=e1,e2,e3

# 忽略測試文件的複雜度檢查
sonar.issue.ignore.multicriteria.e1.ruleKey=javascript:FunctionComplexity
sonar.issue.ignore.multicriteria.e1.resourceKey=**/*.test.js

# 忽略generated文件
sonar.issue.ignore.multicriteria.e2.ruleKey=*
sonar.issue.ignore.multicriteria.e2.resourceKey=**/generated/**

# 特殊業務規則豁免
sonar.issue.ignore.multicriteria.e3.ruleKey=javascript:S3776
sonar.issue.ignore.multicriteria.e3.resourceKey=**/legacy/**
```

#### 品質閘門定義
```json
{
  "qualityGate": {
    "name": "Book Overview Quality Gate",
    "conditions": [
      {
        "metric": "coverage",
        "op": "LT",
        "warning": "80",
        "error": "70"
      },
      {
        "metric": "duplicated_lines_density",
        "op": "GT", 
        "warning": "5",
        "error": "10"
      },
      {
        "metric": "maintainability_rating",
        "op": "GT",
        "warning": "2",
        "error": "3"
      },
      {
        "metric": "reliability_rating",
        "op": "GT",
        "warning": "2",
        "error": "3"
      },
      {
        "metric": "security_rating",
        "op": "GT",
        "warning": "2",
        "error": "3"
      },
      {
        "metric": "sqale_rating",
        "op": "GT",
        "warning": "2",
        "error": "3"
      }
    ]
  }
}
```

## 🎨 代碼風格指南

### 台灣繁體中文註解標準

#### 註解寫作規範
```javascript
/**
 * 書籍資料擷取器
 * 負責從Readmoo網站擷取書籍詳細資訊，包含書名、作者、價格等metadata
 * 
 * @class BookExtractor
 * @implements {DataExtractor}
 * @author Taiwan Development Team
 * @since v1.0.0
 * 
 * @example
 * ```javascript
 * const extractor = new BookExtractor();
 * const bookData = await extractor.extract('https://readmoo.com/book/123');
 * console.log(bookData.title); // 輸出書名
 * ```
 */
class BookExtractor implements DataExtractor {
  /**
   * 擷取書籍資訊的主要方法
   * 
   * @param {string} bookUrl - 書籍頁面的完整URL
   * @param {ExtractOptions} options - 擷取選項配置
   * @param {boolean} options.includeReviews - 是否包含評論資訊
   * @param {number} options.timeout - 請求超時時間(毫秒)
   * 
   * @returns {Promise<BookData>} 包含書籍詳細資訊的物件
   * 
   * @throws {ValidationError} 當URL格式不正確時拋出
   * @throws {NetworkError} 當網路請求失敗時拋出
   * @throws {ParseError} 當頁面解析失敗時拋出
   * 
   * @since v1.0.0
   * @memberof BookExtractor
   */
  async extract(bookUrl: string, options: ExtractOptions = {}): Promise<BookData> {
    // 驗證URL格式是否正確
    if (!this.isValidReadmooUrl(bookUrl)) {
      throw new ValidationError('無效的Readmoo書籍URL格式');
    }

    try {
      // 發送HTTP請求獲取頁面內容
      const response = await this.fetchBookPage(bookUrl, options.timeout);
      
      // 解析HTML並提取書籍資訊
      const bookData = await this.parseBookData(response.html);
      
      // 如果需要，獲取評論資訊
      if (options.includeReviews) {
        bookData.reviews = await this.extractReviews(bookUrl);
      }

      return bookData;
    } catch (error) {
      // 根據錯誤類型提供具體的錯誤資訊
      this.handleExtractionError(error, bookUrl);
    }
  }

  /**
   * 驗證是否為有效的Readmoo書籍URL
   * 支援格式: https://readmoo.com/book/[數字ID]
   * 
   * @private
   * @param {string} url - 待驗證的URL
   * @returns {boolean} 驗證結果
   */
  private isValidReadmooUrl(url: string): boolean {
    const readmooPattern = /^https:\/\/readmoo\.com\/book\/\d+$/;
    return readmooPattern.test(url);
  }
}
```

#### 內嵌註解規範
```javascript
class BookDataProcessor {
  processBookData(rawData: RawBookData): ProcessedBookData {
    // TODO: 考慮使用更高效的資料結構優化處理速度
    // 目前使用基本的物件處理，未來可考慮使用Map或其他優化方案
    
    // FIXME: 價格解析邏輯需要處理折扣價格的特殊情況  
    // 目前只處理原價，但實際上Readmoo經常有折扣活動
    const price = this.parsePrice(rawData.priceText);
    
    // HACK: 暫時使用字串替換處理特殊字符
    // 應該建立專門的文字清理函式來處理各種特殊情況
    const cleanTitle = rawData.title.replace(/[^\w\s]/gi, '');
    
    // NOTE: 作者資訊可能包含多個作者，用逗號分隔
    // 這裡將字串分割成陣列以便後續處理
    const authors = rawData.authorText.split(',').map(author => author.trim());

    return {
      title: cleanTitle,
      authors: authors,
      price: price,
      // ... 其他欄位處理
    };
  }
}
```

### 命名規範

#### TypeScript 命名標準
```typescript
// 介面命名：使用 PascalCase，以 I 開頭（可選）
interface BookData {
  title: string;
  authors: string[];
  price: number;
  publishDate: Date;
}

// 類型別名：使用 PascalCase
type ExtractorStatus = 'IDLE' | 'EXTRACTING' | 'COMPLETED' | 'ERROR';

// 類別命名：使用 PascalCase，具體描述功能
class ReadmooBookExtractor implements BookExtractor {
  // 私有屬性：使用 camelCase，前綴底線（可選）
  private _extractionCount: number = 0;
  private readonly maxRetries: number = 3;

  // 公開屬性：使用 camelCase
  public currentStatus: ExtractorStatus = 'IDLE';

  // 方法命名：使用 camelCase，動詞開頭
  public async extractBookData(url: string): Promise<BookData> {
    // 本地變數：使用 camelCase，具有描述性
    const validationResult = this.validateBookUrl(url);
    const extractedContent = await this.fetchPageContent(url);
    
    return this.parseBookInformation(extractedContent);
  }

  // 私有方法：使用 camelCase，前綴底線（可選）
  private _incrementExtractionCount(): void {
    this._extractionCount++;
  }
}

// 常數命名：使用 UPPER_SNAKE_CASE
const MAX_CONCURRENT_EXTRACTIONS = 5;
const DEFAULT_TIMEOUT_MS = 30000;
const READMOO_BASE_URL = 'https://readmoo.com';

// 列舉命名：使用 PascalCase
enum BookStatus {
  AVAILABLE = 'available',
  OUT_OF_STOCK = 'out_of_stock', 
  COMING_SOON = 'coming_soon',
  DISCONTINUED = 'discontinued'
}

// 泛型參數：使用 PascalCase，通常以 T 開頭
interface DataExtractor<TInput, TOutput> {
  extract(input: TInput): Promise<TOutput>;
}

// 模組命名空間：使用 PascalCase
namespace BookUtils {
  export function formatPrice(price: number): string {
    return `NT$ ${price.toLocaleString()}`;
  }
  
  export function validateIsbn(isbn: string): boolean {
    // ISBN驗證邏輯
    return /^\d{13}$/.test(isbn);
  }
}
```

## 🔧 品質保證工具鏈

### 自動化品質檢查

#### Git Hooks 整合
```bash
#!/bin/sh
# .husky/pre-commit

# 代碼品質檢查腳本
echo "🔍 執行代碼品質檢查..."

# 1. 執行 lint 檢查
echo "📋 檢查代碼風格..."
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Lint 檢查失敗，請修正後再提交"
  exit 1
fi

# 2. 執行型別檢查
echo "🔍 檢查 TypeScript 型別..."
npm run type-check
if [ $? -ne 0 ]; then
  echo "❌ 型別檢查失敗，請修正後再提交"
  exit 1
fi

# 3. 執行單元測試
echo "🧪 執行單元測試..."
npm run test:unit
if [ $? -ne 0 ]; then
  echo "❌ 單元測試失敗，請修正後再提交"
  exit 1
fi

# 4. 檢查測試覆蓋率
echo "📊 檢查測試覆蓋率..."
npm run test:coverage -- --silent
COVERAGE=$(npm run test:coverage -- --silent | grep "All files" | awk '{print $4}' | sed 's/%//')
if [ "$COVERAGE" -lt "80" ]; then
  echo "❌ 測試覆蓋率不足 ($COVERAGE% < 80%)，請增加測試"
  exit 1
fi

# 5. 安全性檢查
echo "🔒 執行安全性掃描..."
npm audit --audit-level moderate
if [ $? -ne 0 ]; then
  echo "❌ 發現安全性問題，請修正後再提交"
  exit 1
fi

echo "✅ 所有品質檢查通過，準備提交..."
```

#### 持續品質監控
```javascript
// scripts/quality-monitor.js
class QualityMonitor {
  constructor() {
    this.metrics = {
      codeQuality: new CodeQualityTracker(),
      testMetrics: new TestMetricsTracker(),
      performanceMetrics: new PerformanceTracker(),
      securityMetrics: new SecurityTracker()
    };
    
    this.reporters = [
      new SlackReporter(),
      new EmailReporter(),
      new DashboardReporter()
    ];
  }

  async runDailyQualityReport() {
    const report = {
      timestamp: new Date(),
      metrics: {},
      trends: {},
      alerts: [],
      recommendations: []
    };

    // 收集各項指標
    for (const [name, tracker] of Object.entries(this.metrics)) {
      try {
        report.metrics[name] = await tracker.collect();
        report.trends[name] = await tracker.analyzeTrend(7); // 7天趨勢
      } catch (error) {
        console.error(`收集 ${name} 指標時發生錯誤:`, error);
        report.alerts.push({
          type: 'METRIC_COLLECTION_ERROR',
          metric: name,
          error: error.message
        });
      }
    }

    // 分析品質趨勢
    report.alerts.push(...this.analyzeQualityAlerts(report.metrics, report.trends));
    
    // 生成改善建議
    report.recommendations = this.generateRecommendations(report.metrics, report.trends);

    // 發送報告
    await this.distributeReport(report);

    return report;
  }

  analyzeQualityAlerts(metrics, trends) {
    const alerts = [];

    // 檢查代碼品質下降
    if (trends.codeQuality?.direction === 'DECLINING' && 
        trends.codeQuality?.rate > 5) {
      alerts.push({
        type: 'QUALITY_DECLINE',
        severity: 'HIGH',
        message: '代碼品質持續下降',
        metrics: trends.codeQuality
      });
    }

    // 檢查測試覆蓋率
    if (metrics.testMetrics?.coverage < 80) {
      alerts.push({
        type: 'LOW_COVERAGE',
        severity: 'MEDIUM',
        message: `測試覆蓋率過低: ${metrics.testMetrics.coverage}%`,
        target: 80
      });
    }

    // 檢查技術債務
    if (metrics.codeQuality?.technicalDebt > 20) {
      alerts.push({
        type: 'HIGH_TECH_DEBT',
        severity: 'HIGH',
        message: '技術債務過高，影響開發效率',
        currentRatio: metrics.codeQuality.technicalDebt
      });
    }

    return alerts;
  }

  async distributeReport(report) {
    const promises = this.reporters.map(reporter => 
      reporter.send(report).catch(error => 
        console.error(`報告發送失敗 (${reporter.name}):`, error)
      )
    );

    await Promise.all(promises);
  }
}
```

## 📋 最佳實踐總結

### 品質文化建立

#### 開發團隊品質約定
```markdown
# 📋 團隊代碼品質約定

## 🎯 基本原則
1. **品質優先於速度**: 寧可多花時間寫出高品質代碼，也不匆忙提交低品質代碼
2. **預防勝於修正**: 通過良好的設計和測試預防問題，而非事後修正
3. **持續改善**: 定期審視並改善代碼品質標準和流程

## 🤝 團隊協作規範
- 每個 Pull Request 必須經過至少一位資深開發者審查
- 代碼審查重點關注邏輯正確性、可讀性和維護性
- 建設性地提供改善建議，避免純粹批評
- 接受審查時保持開放態度，積極回應建議

## 🔧 工具使用約定
- 統一使用配置好的 ESLint 和 Prettier
- 提交前必須通過所有自動化檢查
- 定期更新和調整品質工具配置
- 分享有用的品質工具和技巧

## 📚 學習和分享
- 定期舉行代碼品質分享會
- 記錄和分享最佳實踐案例
- 鼓勵參與開源專案和技術社群
- 建立團隊知識庫累積經驗
```

### 持續改善機制

#### 品質指標追蹤
```javascript
class QualityMetricsTracker {
  constructor() {
    this.baseline = this.loadBaseline();
    this.targets = this.loadQualityTargets();
    this.history = this.loadHistory();
  }

  async trackProgress() {
    const currentMetrics = await this.collectCurrentMetrics();
    const progress = this.calculateProgress(currentMetrics);
    
    // 更新歷史記錄
    this.history.push({
      timestamp: new Date(),
      metrics: currentMetrics,
      progress: progress
    });

    // 檢查是否達成目標
    const achievements = this.checkAchievements(currentMetrics);
    
    // 生成進度報告
    const report = this.generateProgressReport(progress, achievements);
    
    return report;
  }

  calculateProgress(currentMetrics) {
    const progress = {};
    
    for (const [metric, target] of Object.entries(this.targets)) {
      const current = currentMetrics[metric];
      const baseline = this.baseline[metric];
      
      if (target > baseline) {
        // 改善目標
        progress[metric] = {
          current,
          target,
          baseline,
          progress: Math.min((current - baseline) / (target - baseline) * 100, 100),
          status: current >= target ? 'ACHIEVED' : 'IN_PROGRESS'
        };
      } else {
        // 降低目標
        progress[metric] = {
          current,
          target,
          baseline,
          progress: Math.min((baseline - current) / (baseline - target) * 100, 100),
          status: current <= target ? 'ACHIEVED' : 'IN_PROGRESS'
        };
      }
    }
    
    return progress;
  }
}
```

## 🔗 相關文件

- [技術債務管理](./technical-debt-management.md) - 技術債務識別和管理策略
- [重構決策樹](./refactoring-decision-tree.md) - 代碼重構決策指南
- [案例研究](./case-studies.md) - 品質改善實際案例
- [代碼審查指南](../../02-development/workflows/code-review.md) - 代碼審查流程和標準
- [測試策略](../../02-development/testing/testing-strategy.md) - 測試覆蓋率和品質保證

---

**📝 文件狀態**: 已完成 | **最後更新**: 2025-09-06 | **版本**: v0.11.0