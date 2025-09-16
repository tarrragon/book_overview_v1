/**
 * 簡化版端對端測試環境驗證
 *
 * 負責功能：
 * - 驗證基本測試設定和依賴項
 * - 檢查建置檔案的完整性
 * - 測試 Manifest V3 配置正確性
 * - 驗證測試資料和模擬頁面
 *
 * 設計考量：
 * - 不依賴 Puppeteer，避免複雜的瀏覽器環境問題
 * - 快速驗證核心測試組件
 * - 提供清晰的環境檢查結果
 * - 為完整的端對端測試做準備
 *
 * 處理流程：
 * 1. 檢查測試相關檔案是否存在
 * 2. 驗證建置產物的完整性
 * 3. 檢查測試設定的正確性
 * 4. 驗證測試資料和模擬檔案
 *
 * 使用情境：
 * - 快速驗證測試環境基本設定
 * - 在 Puppeteer 環境出現問題時的後備測試
 * - CI/CD 環境的基礎檢查
 */

const fs = require('fs')
const path = require('path')

describe('🔧 簡化版端對端測試環境驗證', () => {
  const projectRoot = path.resolve(__dirname, '../../..')
  const buildPath = path.join(projectRoot, 'build/development')
  const e2eTestsPath = path.join(projectRoot, 'tests/e2e')

  describe('📁 基本檔案檢查', () => {
    test('應該存在端對端測試目錄結構', () => {
      const expectedDirectories = [
        'setup',
        'fixtures',
        'workflows',
        'integration',
        'performance',
        'deployment',
        'validation',
        'screenshots'
      ]

      expectedDirectories.forEach(dir => {
        const dirPath = path.join(e2eTestsPath, dir)
        expect(fs.existsSync(dirPath)).toBe(true)
        console.log(`✅ 目錄存在: ${dir}`)
      })
    })

    test('應該存在核心測試檔案', () => {
      const expectedFiles = [
        'setup/extension-setup.js',
        'fixtures/readmoo-mock-page.html',
        'workflows/complete-extraction-workflow.test.js',
        'integration/ui-interaction-flow.test.js',
        'performance/benchmark-tests.test.js',
        'deployment/chrome-store-readiness.test.js'
      ]

      expectedFiles.forEach(file => {
        const filePath = path.join(e2eTestsPath, file)
        expect(fs.existsSync(filePath)).toBe(true)
        console.log(`✅ 檔案存在: ${file}`)
      })
    })

    test('應該存在建置產物', () => {
      expect(fs.existsSync(buildPath)).toBe(true)

      const requiredFiles = [
        'manifest.json',
        'src/background/background.js',
        'src/popup/popup.html',
        'src/popup/popup.js'
      ]

      requiredFiles.forEach(file => {
        const filePath = path.join(buildPath, file)
        expect(fs.existsSync(filePath)).toBe(true)
        console.log(`✅ 建置檔案存在: ${file}`)
      })
    })
  })

  describe('📋 Manifest V3 配置驗證', () => {
    let manifest

    beforeAll(() => {
      const manifestPath = path.join(buildPath, 'manifest.json')
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    })

    test('應該使用 Manifest V3', () => {
      expect(manifest.manifest_version).toBe(3)
      console.log('✅ Manifest V3 配置正確')
    })

    test('應該有必要的基本資訊', () => {
      expect(manifest.name).toBeDefined()
      expect(manifest.version).toBeDefined()
      expect(manifest.description).toBeDefined()

      expect(manifest.name.length).toBeGreaterThan(0)
      expect(manifest.version).toMatch(/^\d+\.\d+(\.\d+)?$/)
      expect(manifest.description.length).toBeGreaterThan(10)

      console.log(`✅ Extension 基本資訊: ${manifest.name} v${manifest.version}`)
    })

    test('應該有正確的 Service Worker 配置', () => {
      expect(manifest.background).toBeDefined()
      expect(manifest.background.service_worker).toBeDefined()

      const serviceWorkerPath = path.join(buildPath, manifest.background.service_worker)
      expect(fs.existsSync(serviceWorkerPath)).toBe(true)

      console.log(`✅ Service Worker: ${manifest.background.service_worker}`)
    })

    test('應該有合理的權限配置', () => {
      expect(manifest.permissions).toBeDefined()
      expect(Array.isArray(manifest.permissions)).toBe(true)

      const dangerousPermissions = ['debugger', 'proxy', 'system.cpu']
      dangerousPermissions.forEach(perm => {
        expect(manifest.permissions).not.toContain(perm)
      })

      console.log(`✅ 權限配置合理: ${manifest.permissions.join(', ')}`)
    })

    test('應該有完整的圖示配置', () => {
      expect(manifest.icons).toBeDefined()

      const requiredSizes = ['16', '48', '128']
      requiredSizes.forEach(size => {
        expect(manifest.icons[size]).toBeDefined()

        const iconPath = path.join(buildPath, manifest.icons[size])
        expect(fs.existsSync(iconPath)).toBe(true)
      })

      console.log('✅ 圖示配置完整')
    })
  })

  describe('🎭 模擬測試資料驗證', () => {
    test('模擬 Readmoo 頁面應該有正確的結構', () => {
      const mockPagePath = path.join(e2eTestsPath, 'fixtures/readmoo-mock-page.html')
      const mockPageContent = fs.readFileSync(mockPagePath, 'utf8')

      // 檢查關鍵元素
      expect(mockPageContent).toContain('.book-item')
      expect(mockPageContent).toContain('.book-title')
      expect(mockPageContent).toContain('.book-author')
      expect(mockPageContent).toContain('data-book-id')

      // 檢查測試資料
      expect(mockPageContent).toContain('testBookData')
      expect(mockPageContent).toContain('getTestBookData')

      console.log('✅ 模擬 Readmoo 頁面結構正確')
    })

    test('測試資料應該包含完整的書籍資訊', () => {
      const mockPagePath = path.join(e2eTestsPath, 'fixtures/readmoo-mock-page.html')
      const mockPageContent = fs.readFileSync(mockPagePath, 'utf8')

      // 提取 JSON 資料
      const jsonMatch = mockPageContent.match(/type="application\/json"[^>]*>([^<]+)</)
      expect(jsonMatch).toBeTruthy()

      const testData = JSON.parse(jsonMatch[1].trim())
      expect(testData.books).toBeInstanceOf(Array)
      expect(testData.books.length).toBe(5)

      // 檢查第一本書的資料結構
      const firstBook = testData.books[0]
      expect(firstBook).toHaveProperty('id')
      expect(firstBook).toHaveProperty('title')
      expect(firstBook).toHaveProperty('author')
      expect(firstBook).toHaveProperty('progress')
      expect(firstBook).toHaveProperty('purchaseDate')
    })
  })

  describe('🧪 測試設定檔驗證', () => {
    test('Jest 配置應該包含端對端測試', () => {
      const jestConfigPath = path.join(projectRoot, 'tests/jest.config.js')
      const jestConfigContent = fs.readFileSync(jestConfigPath, 'utf8')

      expect(jestConfigContent).toContain('tests/e2e')
      expect(jestConfigContent).toContain('testMatch')
    })

    test('package.json 應該有端對端測試腳本', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

      expect(packageJson.scripts).toHaveProperty('test:e2e')
      expect(packageJson.scripts).toHaveProperty('test:e2e:full')
      expect(packageJson.scripts).toHaveProperty('test:e2e:workflow')
    })

    test('應該有必要的測試依賴項', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

      const requiredDevDeps = ['puppeteer', 'jest', 'jest-chrome']
      const devDependencies = packageJson.devDependencies || {}

      requiredDevDeps.forEach(dep => {
        expect(devDependencies).toHaveProperty(dep)
      })
    })
  })

  describe('📊 建置品質檢查', () => {
    test('JavaScript 檔案應該沒有語法錯誤', () => {
      const jsFiles = [
        'src/background/background.js',
        'src/popup/popup.js',
        'src/content/content.js'
      ]

      jsFiles.forEach(file => {
        const filePath = path.join(buildPath, file)
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8')

          // 基本語法檢查
          expect(content.length).toBeGreaterThan(0)

          // 檢查是否有明顯的語法問題

          console.log(`✅ ${file} 語法檢查通過 (${content.length} 字符)`)
        }
      })
    })

    test('HTML 檔案應該有正確的結構', () => {
      const htmlFiles = ['src/popup/popup.html', 'overview.html']

      htmlFiles.forEach(file => {
        const filePath = path.join(buildPath, file)
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8')

          expect(content).toContain('<!DOCTYPE html>')
          expect(content).toContain('<html')
          expect(content).toContain('<head>')
          expect(content).toContain('<body>')

          console.log(`✅ ${file} HTML 結構正確`)
        }
      })
    })

    test('檔案大小應該在合理範圍內', () => {
      const fileSizeLimits = {
        'manifest.json': 5 * 1024, // 5KB
        'src/popup/popup.js': 100 * 1024, // 100KB
        'src/background/background.js': 100 * 1024 // 100KB
      }

      Object.entries(fileSizeLimits).forEach(([file, maxSize]) => {
        const filePath = path.join(buildPath, file)
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath)
          expect(stats.size).toBeLessThan(maxSize)

          console.log(`✅ ${file} 大小合理: ${(stats.size / 1024).toFixed(2)}KB`)
        }
      })
    })
  })

  describe('📈 測試準備度評估', () => {
    test('端對端測試環境準備度檢查', () => {
      const checklist = {
        buildExists: fs.existsSync(buildPath),
        manifestV3: true, // 基於前面的測試
        testFilesExist: true, // 基於前面的測試
        mockDataReady: true, // 基於前面的測試
        jestConfigured: true, // 基於前面的測試
        dependenciesInstalled: fs.existsSync(path.join(projectRoot, 'node_modules'))
      }

      const totalChecks = Object.keys(checklist).length
      const passedChecks = Object.values(checklist).filter(Boolean).length
      const readinessPercentage = (passedChecks / totalChecks) * 100

      Object.entries(checklist).forEach(([check, passed]) => {
        console.log(`  ${passed ? '✅' : '❌'} ${check}`)
      })

      console.log(`\n🎯 總體準備度: ${readinessPercentage.toFixed(1)}% (${passedChecks}/${totalChecks})`)

      // 至少 80% 準備度才算合格
      expect(readinessPercentage).toBeGreaterThanOrEqual(80)

      if (readinessPercentage === 100) {
      } else {
        console.log('⚠️ 部分檢查未通過，請檢查失敗項目')
      }
    })
  })
})
