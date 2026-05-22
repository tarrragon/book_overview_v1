# 📊 Chrome Extension 效能測試完整指南

> **第三層參考文件** - 全面的效能測試方法論與自動化實踐  
> **目標讀者**: 效能測試工程師、QA 團隊、DevOps 工程師  
> **文件類型**: 測試方法論參考手冊  

本文件提供 Readmoo 書庫提取器 Chrome Extension 的完整效能測試策略，涵蓋基準測試、回歸測試、負載測試、瓶頸分析等關鍵測試技術。

## 🎯 效能測試策略概觀

### 測試金字塔結構
```
┌─────────────────────────────────────┐
│          負載與壓力測試              │
│     (User Journey + Heavy Load)    │  ← 少量但關鍵
├─────────────────────────────────────┤
│          整合效能測試                │
│   (API + Component Integration)    │  ← 中等數量
├─────────────────────────────────────┤
│          單元效能測試                │
│    (Function + Method Level)       │  ← 大量且快速
└─────────────────────────────────────┘
```

### 效能測試分類
- **基準測試** (Benchmark): 建立效能基線，設定期望值
- **回歸測試** (Regression): 確保新變更不降低效能
- **負載測試** (Load): 模擬正常使用量下的表現
- **壓力測試** (Stress): 測試極限條件下的穩定性
- **容量測試** (Volume): 測試大量資料處理能力

## 🧪 單元效能測試

### Jest 效能測試框架
```javascript
// tests/performance/unit/performance.test.js
import { performance } from 'perf_hooks';

describe('Performance Unit Tests', () => {
  // 效能測試輔助工具
  class PerformanceHelper {
    static async measureFunction(fn, iterations = 1000) {
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        await fn();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      return {
        totalTime,
        avgTime,
        iterations,
        opsPerSecond: 1000 / avgTime
      };
    }

    static memorySnapshot() {
      if (global.gc) global.gc();
      
      return {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      };
    }
  }

  describe('Data Processing Performance', () => {
    test('Book data parsing should be fast', async () => {
      const mockBookData = Array(1000).fill(null).map((_, i) => ({
        id: i,
        title: `Book ${i}`,
        author: `Author ${i}`,
        content: 'Lorem ipsum '.repeat(100)
      }));

      const parseBookData = (data) => {
        return data.map(book => ({
          ...book,
          slug: book.title.toLowerCase().replace(/\s+/g, '-'),
          wordCount: book.content.split(' ').length
        }));
      };

      const result = await PerformanceHelper.measureFunction(() => {
        parseBookData(mockBookData);
      }, 100);

      // 斷言效能要求
      expect(result.avgTime).toBeLessThan(50); // 平均 < 50ms
      expect(result.opsPerSecond).toBeGreaterThan(20); // > 20 ops/sec
      
      console.log('📊 Book parsing performance:', {
        avgTime: `${result.avgTime.toFixed(2)}ms`,
        opsPerSecond: result.opsPerSecond.toFixed(2)
      });
    });

    test('Search algorithm performance', async () => {
      const books = Array(10000).fill(null).map((_, i) => ({
        id: i,
        title: `Book Title ${i}`,
        author: `Author ${i % 100}`,
        tags: [`tag${i % 10}`, `category${i % 5}`]
      }));

      const searchBooks = (books, query) => {
        const lowerQuery = query.toLowerCase();
        return books.filter(book =>
          book.title.toLowerCase().includes(lowerQuery) ||
          book.author.toLowerCase().includes(lowerQuery) ||
          book.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
      };

      const result = await PerformanceHelper.measureFunction(() => {
        searchBooks(books, 'Author 42');
      }, 100);

      expect(result.avgTime).toBeLessThan(10); // 平均 < 10ms
      expect(result.opsPerSecond).toBeGreaterThan(100); // > 100 searches/sec
    });
  });

  describe('Memory Usage Tests', () => {
    test('Large dataset processing should not leak memory', async () => {
      const memoryBefore = PerformanceHelper.memorySnapshot();
      
      // 處理大量資料
      const largeDataset = Array(50000).fill(null).map((_, i) => ({
        id: i,
        data: `Data chunk ${i}`.repeat(10)
      }));

      const processData = (data) => {
        return data
          .filter(item => item.id % 2 === 0)
          .map(item => ({ ...item, processed: true }))
          .slice(0, 1000);
      };

      const processedData = processData(largeDataset);
      
      // 強制垃圾回收
      if (global.gc) global.gc();
      
      const memoryAfter = PerformanceHelper.memorySnapshot();
      const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
      
      // 驗證記憶體使用合理
      expect(memoryDelta).toBeLessThan(50 * 1024 * 1024); // < 50MB
      expect(processedData.length).toBe(1000);
    });
  });
});
```

### 函數級效能基準測試
```javascript
// tests/performance/benchmarks/function-benchmarks.js
class FunctionBenchmark {
  constructor() {
    this.results = new Map();
  }

  async benchmark(name, fn, options = {}) {
    const {
      iterations = 1000,
      warmupIterations = 100,
      timeout = 30000
    } = options;

    console.log(`🏃 Running benchmark: ${name}`);

    // 暖機階段
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }

    // 實際測試
    const times = [];
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Benchmark "${name}" timed out after ${timeout}ms`);
      }

      const iterationStart = performance.now();
      await fn();
      const iterationEnd = performance.now();
      
      times.push(iterationEnd - iterationStart);
    }

    const stats = this.calculateStatistics(times);
    this.results.set(name, stats);

    return stats;
  }

  calculateStatistics(times) {
    const sorted = times.sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);

    return {
      count: times.length,
      mean: sum / times.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: Math.min(...times),
      max: Math.max(...times),
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(times.reduce((sq, n) => sq + Math.pow(n - sum / times.length, 2), 0) / times.length)
    };
  }

  generateReport() {
    console.log('\n📊 Performance Benchmark Report');
    console.log('================================');

    for (const [name, stats] of this.results) {
      console.log(`\n${name}:`);
      console.log(`  Mean: ${stats.mean.toFixed(3)}ms`);
      console.log(`  Median: ${stats.median.toFixed(3)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(3)}ms`);
      console.log(`  P99: ${stats.p99.toFixed(3)}ms`);
      console.log(`  Min: ${stats.min.toFixed(3)}ms`);
      console.log(`  Max: ${stats.max.toFixed(3)}ms`);
      console.log(`  Std Dev: ${stats.stdDev.toFixed(3)}ms`);
    }

    return this.results;
  }
}

// 使用範例
describe('Function Benchmarks', () => {
  let benchmark;

  beforeAll(() => {
    benchmark = new FunctionBenchmark();
  });

  afterAll(() => {
    benchmark.generateReport();
  });

  test('JSON parsing methods comparison', async () => {
    const testData = JSON.stringify({
      books: Array(1000).fill(null).map((_, i) => ({
        id: i,
        title: `Book ${i}`,
        metadata: { pages: 200 + i, isbn: `978-${i}` }
      }))
    });

    // 測試原生 JSON.parse
    await benchmark.benchmark('Native JSON.parse', () => {
      JSON.parse(testData);
    });

    // 測試 JSON.parse 與錯誤處理
    await benchmark.benchmark('JSON.parse with error handling', () => {
      try {
        return JSON.parse(testData);
      } catch (error) {
        return null;
      }
    });

    const nativeStats = benchmark.results.get('Native JSON.parse');
    const safeStats = benchmark.results.get('JSON.parse with error handling');

    // 驗證效能差異在可接受範圍內
    expect(safeStats.mean / nativeStats.mean).toBeLessThan(1.2); // < 20% overhead
  });
});
```

## 🔗 整合效能測試

### Chrome Extension API 效能測試
```javascript
// tests/performance/integration/extension-performance.test.js
import { chromium } from 'playwright';

describe('Chrome Extension Performance Integration', () => {
  let browser, context, extensionId;

  beforeAll(async () => {
    // 載入 Extension 進行測試
    browser = await chromium.launch({
      headless: false,
      args: [
        '--load-extension=./build/development',
        '--disable-extensions-except=./build/development'
      ]
    });

    context = await browser.newContext();
    
    // 獲取 Extension ID
    const backgroundPage = await context.waitForEvent('page', page => 
      page.url().includes('chrome-extension://')
    );
    extensionId = backgroundPage.url().match(/chrome-extension:\/\/([^\/]+)/)[1];
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Extension Startup Performance', () => {
    test('Service Worker initialization time', async () => {
      const page = await context.newPage();
      
      const startTime = Date.now();
      
      // 觸發 Extension 啟動
      await page.goto('https://readmoo.com');
      
      // 等待 Extension 準備完成
      await page.evaluate(async () => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'GET_STARTUP_STATUS' }, (response) => {
            if (response.ready) {
              resolve(response);
            } else {
              // 輪詢等待
              const checkReady = () => {
                chrome.runtime.sendMessage({ type: 'GET_STARTUP_STATUS' }, (resp) => {
                  if (resp.ready) {
                    resolve(resp);
                  } else {
                    setTimeout(checkReady, 100);
                  }
                });
              };
              checkReady();
            }
          });
        });
      });

      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(2000); // < 2秒啟動
      console.log(`🚀 Extension startup time: ${totalTime}ms`);
    });

    test('Content script injection performance', async () => {
      const page = await context.newPage();
      
      const startTime = performance.now();
      
      await page.goto('https://read.readmoo.com/#/library');
      
      // 等待 Content Script 注入完成
      await page.waitForFunction(() => {
        return window.readmooExtensionReady === true;
      }, { timeout: 5000 });

      const injectionTime = performance.now() - startTime;
      
      expect(injectionTime).toBeLessThan(500); // < 500ms 注入
      console.log(`📄 Content script injection: ${injectionTime.toFixed(2)}ms`);
    });
  });

  describe('Data Extraction Performance', () => {
    test('Book list extraction speed', async () => {
      const page = await context.newPage();
      await page.goto('https://read.readmoo.com/#/library');
      
      // 等待頁面載入完成
      await page.waitForLoadState('networkidle');

      const extractionStart = performance.now();

      // 執行書籍資料提取
      const extractedBooks = await page.evaluate(async () => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'EXTRACT_BOOKS',
            source: 'library_page'
          }, (response) => {
            resolve(response.books);
          });
        });
      });

      const extractionTime = performance.now() - extractionStart;

      expect(extractionTime).toBeLessThan(3000); // < 3秒提取
      expect(extractedBooks.length).toBeGreaterThan(0);
      
      console.log(`📚 Extracted ${extractedBooks.length} books in ${extractionTime.toFixed(2)}ms`);
      console.log(`📊 Avg time per book: ${(extractionTime / extractedBooks.length).toFixed(2)}ms`);
    });

    test('Large library performance', async () => {
      // 模擬大量書籍的頁面
      const page = await context.newPage();
      
      // 注入大量書籍資料
      await page.goto('data:text/html,<html><body id="library"></body></html>');
      
      await page.evaluate(() => {
        const library = document.getElementById('library');
        
        // 建立 1000 本書的 DOM 結構
        for (let i = 0; i < 1000; i++) {
          const bookElement = document.createElement('div');
          bookElement.className = 'book-item';
          bookElement.innerHTML = `
            <h3>Book Title ${i}</h3>
            <p>Author ${i}</p>
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" />
            <div class="progress" data-progress="${i % 100}">
          `;
          library.appendChild(bookElement);
        }
      });

      const extractionStart = performance.now();

      // 執行大量資料提取
      const extractedBooks = await page.evaluate(async () => {
        const books = [];
        const bookElements = document.querySelectorAll('.book-item');
        
        bookElements.forEach((element, index) => {
          books.push({
            id: index,
            title: element.querySelector('h3').textContent,
            author: element.querySelector('p').textContent,
            progress: element.querySelector('.progress').dataset.progress
          });
        });

        return books;
      });

      const extractionTime = performance.now() - extractionStart;

      expect(extractionTime).toBeLessThan(1000); // < 1秒處理1000本書
      expect(extractedBooks.length).toBe(1000);
      
      console.log(`🏋️ Large library extraction: ${extractionTime.toFixed(2)}ms for ${extractedBooks.length} books`);
    });
  });
});
```

### API 效能測試
```javascript
// tests/performance/integration/api-performance.test.js
describe('API Performance Tests', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'https://api.readmoo.com';
  
  class APIPerformanceTester {
    constructor() {
      this.results = [];
    }

    async testEndpoint(name, url, options = {}) {
      const {
        method = 'GET',
        headers = {},
        body = null,
        expectedStatus = 200,
        timeout = 10000
      } = options;

      const startTime = performance.now();

      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: body ? JSON.stringify(body) : null,
          signal: AbortSignal.timeout(timeout)
        });

        const endTime = performance.now();
        const duration = endTime - startTime;

        const result = {
          name,
          url,
          method,
          status: response.status,
          duration,
          success: response.status === expectedStatus,
          size: parseInt(response.headers.get('content-length')) || 0
        };

        this.results.push(result);
        return result;

      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        const result = {
          name,
          url,
          method,
          status: 0,
          duration,
          success: false,
          error: error.message,
          size: 0
        };

        this.results.push(result);
        return result;
      }
    }

    async concurrentTest(requests) {
      const startTime = performance.now();
      
      const results = await Promise.all(
        requests.map(req => this.testEndpoint(req.name, req.url, req.options))
      );

      const totalTime = performance.now() - startTime;
      
      return {
        results,
        totalTime,
        successRate: results.filter(r => r.success).length / results.length * 100
      };
    }
  }

  let tester;

  beforeEach(() => {
    tester = new APIPerformanceTester();
  });

  describe('Individual API Endpoints', () => {
    test('User books API performance', async () => {
      const result = await tester.testEndpoint(
        'User Books',
        `${API_BASE_URL}/api/v1/users/me/books?limit=20`
      );

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(2000); // < 2秒
      console.log(`📚 User books API: ${result.duration.toFixed(2)}ms`);
    });

    test('Book search API performance', async () => {
      const result = await tester.testEndpoint(
        'Book Search',
        `${API_BASE_URL}/api/v1/books/search?q=javascript&limit=10`
      );

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(1500); // < 1.5秒
      console.log(`🔍 Book search API: ${result.duration.toFixed(2)}ms`);
    });
  });

  describe('Concurrent API Load Tests', () => {
    test('Multiple API calls concurrency', async () => {
      const requests = [
        { name: 'Books Page 1', url: `${API_BASE_URL}/api/v1/users/me/books?page=1&limit=20` },
        { name: 'Books Page 2', url: `${API_BASE_URL}/api/v1/users/me/books?page=2&limit=20` },
        { name: 'Books Page 3', url: `${API_BASE_URL}/api/v1/users/me/books?page=3&limit=20` },
        { name: 'User Profile', url: `${API_BASE_URL}/api/v1/users/me` },
        { name: 'Reading Progress', url: `${API_BASE_URL}/api/v1/users/me/reading-progress` }
      ];

      const result = await tester.concurrentTest(requests);

      expect(result.successRate).toBeGreaterThan(90); // > 90% 成功率
      expect(result.totalTime).toBeLessThan(5000); // 所有請求 < 5秒完成
      
      console.log(`🚀 Concurrent API test: ${result.successRate.toFixed(1)}% success in ${result.totalTime.toFixed(2)}ms`);
    });
  });
});
```

## 🏋️ 負載與壓力測試

### 使用者行為模擬測試
```javascript
// tests/performance/load/user-journey.test.js
import { chromium } from 'playwright';

class UserJourneySimulator {
  constructor() {
    this.scenarios = [];
    this.results = [];
  }

  addScenario(name, steps) {
    this.scenarios.push({ name, steps });
  }

  async runScenario(scenario, options = {}) {
    const {
      iterations = 10,
      concurrency = 3,
      thinkTime = 1000
    } = options;

    console.log(`🎬 Running scenario: ${scenario.name}`);

    const tasks = Array(concurrency).fill(null).map(async (_, workerIndex) => {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const iterationResults = [];

      for (let i = 0; i < Math.ceil(iterations / concurrency); i++) {
        try {
          const result = await this.executeScenarioSteps(context, scenario.steps, thinkTime);
          iterationResults.push({
            worker: workerIndex,
            iteration: i,
            success: true,
            ...result
          });
        } catch (error) {
          iterationResults.push({
            worker: workerIndex,
            iteration: i,
            success: false,
            error: error.message
          });
        }

        // 思考時間
        await new Promise(resolve => setTimeout(resolve, thinkTime));
      }

      await browser.close();
      return iterationResults;
    });

    const allResults = (await Promise.all(tasks)).flat();
    this.results.push({
      scenario: scenario.name,
      results: allResults
    });

    return this.analyzeResults(allResults);
  }

  async executeScenarioSteps(context, steps, thinkTime) {
    const page = await context.newPage();
    const stepResults = [];
    let totalTime = 0;

    for (const step of steps) {
      const stepStart = performance.now();
      
      try {
        await step.action(page);
        const stepDuration = performance.now() - stepStart;
        
        stepResults.push({
          name: step.name,
          duration: stepDuration,
          success: true
        });
        
        totalTime += stepDuration;

        // 步驟間的暫停
        if (step.waitTime) {
          await new Promise(resolve => setTimeout(resolve, step.waitTime));
        }

      } catch (error) {
        const stepDuration = performance.now() - stepStart;
        
        stepResults.push({
          name: step.name,
          duration: stepDuration,
          success: false,
          error: error.message
        });
      }
    }

    await page.close();
    
    return {
      steps: stepResults,
      totalDuration: totalTime,
      successfulSteps: stepResults.filter(s => s.success).length,
      totalSteps: stepResults.length
    };
  }

  analyzeResults(results) {
    const successful = results.filter(r => r.success);
    const durations = successful.map(r => r.totalDuration);

    if (durations.length === 0) {
      return {
        successRate: 0,
        avgDuration: 0,
        p95Duration: 0,
        minDuration: 0,
        maxDuration: 0
      };
    }

    const sorted = durations.sort((a, b) => a - b);

    return {
      successRate: (successful.length / results.length) * 100,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95Duration: sorted[Math.floor(sorted.length * 0.95)],
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalExecutions: results.length
    };
  }
}

describe('User Journey Load Tests', () => {
  let simulator;

  beforeAll(() => {
    simulator = new UserJourneySimulator();

    // 定義典型使用者流程
    simulator.addScenario('Book Library Browse', [
      {
        name: 'Navigate to library',
        action: async (page) => {
          await page.goto('https://read.readmoo.com/#/library');
          await page.waitForLoadState('networkidle');
        }
      },
      {
        name: 'Open extension popup',
        action: async (page) => {
          await page.click('[data-extension-trigger]');
          await page.waitForSelector('.extension-popup');
        },
        waitTime: 500
      },
      {
        name: 'Extract books data',
        action: async (page) => {
          await page.click('#extract-books-btn');
          await page.waitForSelector('.extraction-complete');
        }
      },
      {
        name: 'View extracted data',
        action: async (page) => {
          await page.click('#view-data-btn');
          await page.waitForSelector('.book-list');
        },
        waitTime: 1000
      }
    ]);

    simulator.addScenario('Book Search and Export', [
      {
        name: 'Search for books',
        action: async (page) => {
          await page.goto('https://readmoo.com/search?q=javascript');
          await page.waitForLoadState('networkidle');
        }
      },
      {
        name: 'Filter results',
        action: async (page) => {
          await page.click('.filter-programming');
          await page.waitForSelector('.filtered-results');
        },
        waitTime: 800
      },
      {
        name: 'Export search results',
        action: async (page) => {
          await page.click('#export-results');
          await page.waitForDownload();
        }
      }
    ]);
  });

  test('Library browse scenario under load', async () => {
    const result = await simulator.runScenario(
      simulator.scenarios.find(s => s.name === 'Book Library Browse'),
      {
        iterations: 20,
        concurrency: 5,
        thinkTime: 2000
      }
    );

    expect(result.successRate).toBeGreaterThan(85); // > 85% 成功率
    expect(result.avgDuration).toBeLessThan(10000); // 平均 < 10秒
    expect(result.p95Duration).toBeLessThan(15000); // 95% < 15秒

    console.log('📊 Library Browse Load Test Results:', {
      successRate: `${result.successRate.toFixed(1)}%`,
      avgDuration: `${result.avgDuration.toFixed(0)}ms`,
      p95Duration: `${result.p95Duration.toFixed(0)}ms`
    });
  });

  test('Search and export scenario performance', async () => {
    const result = await simulator.runScenario(
      simulator.scenarios.find(s => s.name === 'Book Search and Export'),
      {
        iterations: 15,
        concurrency: 3,
        thinkTime: 3000
      }
    );

    expect(result.successRate).toBeGreaterThan(80); // > 80% 成功率
    expect(result.p95Duration).toBeLessThan(20000); // 95% < 20秒

    console.log('📊 Search and Export Load Test Results:', {
      successRate: `${result.successRate.toFixed(1)}%`,
      avgDuration: `${result.avgDuration.toFixed(0)}ms`,
      p95Duration: `${result.p95Duration.toFixed(0)}ms`
    });
  });
});
```

## 📈 效能回歸測試

### 自動化回歸測試框架
```javascript
// tests/performance/regression/performance-regression.test.js
import fs from 'fs/promises';
import path from 'path';

class PerformanceRegressionTester {
  constructor() {
    this.baselineFile = 'tests/performance/baselines/performance-baseline.json';
    this.thresholds = {
      degradationLimit: 0.15, // 15% 效能降低警告
      failureLimit: 0.25      // 25% 效能降低失敗
    };
  }

  async loadBaseline() {
    try {
      const data = await fs.readFile(this.baselineFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('No baseline found, creating new baseline');
      return {};
    }
  }

  async saveBaseline(results) {
    await fs.mkdir(path.dirname(this.baselineFile), { recursive: true });
    await fs.writeFile(this.baselineFile, JSON.stringify(results, null, 2));
  }

  compareResults(baseline, current) {
    const comparison = {};
    
    for (const [testName, currentResult] of Object.entries(current)) {
      if (!baseline[testName]) {
        comparison[testName] = {
          status: 'NEW',
          current: currentResult,
          baseline: null,
          change: null
        };
        continue;
      }

      const baselineValue = baseline[testName].avgTime || baseline[testName].duration;
      const currentValue = currentResult.avgTime || currentResult.duration;
      
      const change = (currentValue - baselineValue) / baselineValue;
      
      let status = 'PASS';
      if (change > this.thresholds.failureLimit) {
        status = 'FAIL';
      } else if (change > this.thresholds.degradationLimit) {
        status = 'WARN';
      } else if (change < -0.1) { // 10% 改善
        status = 'IMPROVED';
      }

      comparison[testName] = {
        status,
        current: currentResult,
        baseline: baseline[testName],
        change,
        changePercent: change * 100
      };
    }

    return comparison;
  }

  generateRegressionReport(comparison) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: Object.keys(comparison).length,
        passed: 0,
        warnings: 0,
        failures: 0,
        improved: 0,
        new: 0
      },
      details: comparison
    };

    for (const result of Object.values(comparison)) {
      report.summary[result.status.toLowerCase()]++;
    }

    return report;
  }

  async runRegressionTests() {
    const currentResults = {};

    // 執行各種效能測試
    console.log('🧪 Running performance regression tests...');

    // 函數效能測試
    const functionBenchmark = new FunctionBenchmark();
    
    // 測試關鍵函數
    await functionBenchmark.benchmark('book-parsing', () => {
      // 模擬書籍解析邏輯
      const mockData = Array(100).fill(null).map((_, i) => ({ id: i, title: `Book ${i}` }));
      return mockData.map(book => ({ ...book, slug: book.title.toLowerCase() }));
    });

    await functionBenchmark.benchmark('search-algorithm', () => {
      // 模擬搜尋演算法
      const books = Array(1000).fill(null).map((_, i) => ({ id: i, title: `Book ${i}` }));
      return books.filter(book => book.title.includes('Book 5'));
    });

    // 收集結果
    for (const [name, stats] of functionBenchmark.results) {
      currentResults[name] = stats;
    }

    // 載入基準線並比較
    const baseline = await this.loadBaseline();
    const comparison = this.compareResults(baseline, currentResults);
    const report = this.generateRegressionReport(comparison);

    // 輸出報告
    console.log('\n📊 Performance Regression Test Report');
    console.log('====================================');
    console.log(`Total tests: ${report.summary.total}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`❌ Failures: ${report.summary.failures}`);
    console.log(`🚀 Improved: ${report.summary.improved}`);
    console.log(`🆕 New: ${report.summary.new}`);

    // 詳細結果
    for (const [testName, result] of Object.entries(comparison)) {
      if (result.status !== 'PASS') {
        console.log(`\n${this.getStatusIcon(result.status)} ${testName}:`);
        
        if (result.baseline) {
          console.log(`  Baseline: ${result.baseline.avgTime?.toFixed(2) || result.baseline.duration?.toFixed(2)}ms`);
          console.log(`  Current:  ${result.current.avgTime?.toFixed(2) || result.current.duration?.toFixed(2)}ms`);
          console.log(`  Change:   ${result.changePercent?.toFixed(1)}%`);
        } else {
          console.log(`  Current:  ${result.current.avgTime?.toFixed(2) || result.current.duration?.toFixed(2)}ms`);
        }
      }
    }

    // 更新基準線 (如果沒有失敗)
    if (report.summary.failures === 0) {
      await this.saveBaseline(currentResults);
      console.log('\n✅ Baseline updated');
    } else {
      console.log('\n❌ Baseline not updated due to failures');
    }

    return report;
  }

  getStatusIcon(status) {
    const icons = {
      'PASS': '✅',
      'WARN': '⚠️',
      'FAIL': '❌',
      'IMPROVED': '🚀',
      'NEW': '🆕'
    };
    return icons[status] || '❓';
  }
}

describe('Performance Regression Tests', () => {
  let tester;

  beforeAll(() => {
    tester = new PerformanceRegressionTester();
  });

  test('Run full regression test suite', async () => {
    const report = await tester.runRegressionTests();

    // 斷言沒有效能回歸
    expect(report.summary.failures).toBe(0);
    
    // 警告數量應該在合理範圍內
    expect(report.summary.warnings).toBeLessThan(report.summary.total * 0.2); // < 20%
  }, 60000); // 60秒超時
});
```

## 🔧 效能分析與瓶頸定位

### 效能分析工具整合
```javascript
// tests/performance/profiling/performance-profiler.js
class PerformanceProfiler {
  constructor() {
    this.profiles = [];
    this.isRunning = false;
  }

  startProfiling(label) {
    if (this.isRunning) {
      throw new Error('Profiler is already running');
    }

    this.currentProfile = {
      label,
      startTime: performance.now(),
      marks: [],
      measures: [],
      memorySnapshots: []
    };

    this.isRunning = true;
    
    // 初始記憶體快照
    this.takeMemorySnapshot('start');
    
    // 設定性能標記
    performance.mark(`${label}-start`);
    
    console.log(`🔍 Started profiling: ${label}`);
  }

  mark(name) {
    if (!this.isRunning) {
      throw new Error('Profiler is not running');
    }

    const timestamp = performance.now();
    const elapsed = timestamp - this.currentProfile.startTime;
    
    this.currentProfile.marks.push({
      name,
      timestamp,
      elapsed
    });

    performance.mark(`${this.currentProfile.label}-${name}`);
  }

  measure(name, startMark, endMark) {
    if (!this.isRunning) {
      throw new Error('Profiler is not running');
    }

    const measureName = `${this.currentProfile.label}-${name}`;
    const startMarkName = `${this.currentProfile.label}-${startMark}`;
    const endMarkName = endMark ? `${this.currentProfile.label}-${endMark}` : undefined;

    performance.measure(measureName, startMarkName, endMarkName);
    
    const measure = performance.getEntriesByName(measureName)[0];
    
    this.currentProfile.measures.push({
      name,
      duration: measure.duration,
      startTime: measure.startTime
    });
  }

  takeMemorySnapshot(label) {
    if (performance.memory) {
      const snapshot = {
        label,
        timestamp: performance.now(),
        heapUsed: performance.memory.usedJSHeapSize,
        heapTotal: performance.memory.totalJSHeapSize,
        heapLimit: performance.memory.jsHeapSizeLimit
      };

      if (this.currentProfile) {
        this.currentProfile.memorySnapshots.push(snapshot);
      }

      return snapshot;
    }
    return null;
  }

  stopProfiling() {
    if (!this.isRunning) {
      throw new Error('Profiler is not running');
    }

    const endTime = performance.now();
    const totalDuration = endTime - this.currentProfile.startTime;

    // 結束標記
    performance.mark(`${this.currentProfile.label}-end`);
    
    // 最終記憶體快照
    this.takeMemorySnapshot('end');

    // 完成分析資料
    this.currentProfile.endTime = endTime;
    this.currentProfile.totalDuration = totalDuration;

    // 分析結果
    const analysis = this.analyzeProfile(this.currentProfile);
    this.currentProfile.analysis = analysis;

    this.profiles.push(this.currentProfile);
    
    console.log(`✅ Completed profiling: ${this.currentProfile.label} (${totalDuration.toFixed(2)}ms)`);
    
    const profile = this.currentProfile;
    this.currentProfile = null;
    this.isRunning = false;

    return profile;
  }

  analyzeProfile(profile) {
    const analysis = {
      performance: {
        totalDuration: profile.totalDuration,
        slowestOperation: null,
        bottlenecks: []
      },
      memory: {
        peakUsage: 0,
        memoryLeaks: [],
        growthRate: 0
      }
    };

    // 效能分析
    if (profile.measures.length > 0) {
      const sortedMeasures = profile.measures.sort((a, b) => b.duration - a.duration);
      analysis.performance.slowestOperation = sortedMeasures[0];
      
      // 識別瓶頸 (超過總時間 20% 的操作)
      const threshold = profile.totalDuration * 0.2;
      analysis.performance.bottlenecks = sortedMeasures.filter(m => m.duration > threshold);
    }

    // 記憶體分析
    if (profile.memorySnapshots.length > 1) {
      const memoryUsages = profile.memorySnapshots.map(s => s.heapUsed);
      analysis.memory.peakUsage = Math.max(...memoryUsages);
      
      const startMemory = profile.memorySnapshots[0].heapUsed;
      const endMemory = profile.memorySnapshots[profile.memorySnapshots.length - 1].heapUsed;
      
      analysis.memory.growthRate = ((endMemory - startMemory) / startMemory) * 100;
      
      // 檢測記憶體洩漏 (增長超過 20%)
      if (analysis.memory.growthRate > 20) {
        analysis.memory.memoryLeaks.push({
          type: 'potential_leak',
          growthRate: analysis.memory.growthRate,
          startMemory: startMemory,
          endMemory: endMemory
        });
      }
    }

    return analysis;
  }

  generateReport() {
    console.log('\n🔍 Performance Profiling Report');
    console.log('==============================');

    for (const profile of this.profiles) {
      console.log(`\n📊 Profile: ${profile.label}`);
      console.log(`Total Duration: ${profile.totalDuration.toFixed(2)}ms`);
      
      if (profile.analysis.performance.slowestOperation) {
        const slowest = profile.analysis.performance.slowestOperation;
        console.log(`Slowest Operation: ${slowest.name} (${slowest.duration.toFixed(2)}ms)`);
      }

      if (profile.analysis.performance.bottlenecks.length > 0) {
        console.log('⚠️ Performance Bottlenecks:');
        profile.analysis.performance.bottlenecks.forEach(bottleneck => {
          console.log(`  - ${bottleneck.name}: ${bottleneck.duration.toFixed(2)}ms`);
        });
      }

      if (profile.analysis.memory.memoryLeaks.length > 0) {
        console.log('🚨 Memory Issues:');
        profile.analysis.memory.memoryLeaks.forEach(leak => {
          console.log(`  - ${leak.type}: ${leak.growthRate.toFixed(1)}% growth`);
        });
      }

      console.log(`Peak Memory: ${(profile.analysis.memory.peakUsage / 1024 / 1024).toFixed(2)}MB`);
    }

    return this.profiles;
  }
}

describe('Performance Profiling', () => {
  let profiler;

  beforeEach(() => {
    profiler = new PerformanceProfiler();
  });

  test('Profile complex data processing', async () => {
    profiler.startProfiling('data-processing');

    // 模擬資料載入
    profiler.mark('data-load-start');
    await new Promise(resolve => setTimeout(resolve, 100)); // 模擬載入時間
    profiler.mark('data-load-end');
    profiler.measure('data-loading', 'data-load-start', 'data-load-end');

    // 模擬資料處理
    profiler.mark('processing-start');
    const data = Array(10000).fill(null).map((_, i) => ({ id: i, value: Math.random() }));
    const processed = data.filter(item => item.value > 0.5).map(item => ({ ...item, processed: true }));
    profiler.mark('processing-end');
    profiler.measure('data-processing', 'processing-start', 'processing-end');

    // 模擬輸出
    profiler.mark('output-start');
    const output = JSON.stringify(processed.slice(0, 100));
    profiler.mark('output-end');
    profiler.measure('output-generation', 'output-start', 'output-end');

    const profile = profiler.stopProfiling();

    // 驗證分析結果
    expect(profile.totalDuration).toBeGreaterThan(100); // 至少100ms
    expect(profile.analysis.performance.bottlenecks.length).toBeGreaterThanOrEqual(0);
    
    const report = profiler.generateReport();
    expect(report.length).toBe(1);
  });
});
```

## 📚 相關資源

### 內部文件連結
- [效能監控體系](./monitoring-system.md)
- [記憶體最佳化指南](./memory-optimization.md)  
- [載入效能優化](./loading-performance.md)
- [測試金字塔實踐](../../02-development/testing/test-pyramid.md)
- [效能問題診斷](../troubleshooting/performance-troubleshooting.md)

### 外部參考資源
- [Playwright Performance Testing](https://playwright.dev/docs/test-runner)
- [Jest Performance Testing](https://jestjs.io/docs/performance-testing)
- [Chrome DevTools Performance](https://developers.google.com/web/tools/chrome-devtools/performance)
- [Web Performance Testing Best Practices](https://web.dev/performance-testing/)

## ✅ 效能測試實施檢查清單

完整效能測試體系的檢查項目：

### 🧪 單元效能測試
- [ ] **函數級基準測試**: 關鍵函數效能基準建立
- [ ] **記憶體使用測試**: 記憶體洩漏檢測機制
- [ ] **演算法效能測試**: 核心演算法效能驗證
- [ ] **資料處理測試**: 大量資料處理效能測試

### 🔗 整合效能測試  
- [ ] **Extension 啟動測試**: Service Worker 和 Content Script 啟動時間
- [ ] **API 效能測試**: 外部 API 呼叫效能驗證
- [ ] **資料提取測試**: 書籍資料提取效能測試
- [ ] **並發處理測試**: 多請求並發處理能力

### 🏋️ 負載與壓力測試
- [ ] **使用者流程模擬**: 完整使用者行為路徑測試
- [ ] **高並發測試**: 多使用者同時使用場景
- [ ] **大資料量測試**: 大型書庫處理能力
- [ ] **長時間運行測試**: 記憶體穩定性驗證

### 📈 回歸測試與監控
- [ ] **自動化回歸測試**: 效能基準自動比較機制
- [ ] **持續效能監控**: CI/CD 整合效能檢查
- [ ] **效能分析工具**: Profiler 和分析報告生成
- [ ] **瓶頸識別系統**: 自動化瓶頸檢測與警報

---

**📊 效能測試體系已完成，建立全方位的效能品質保證機制！**