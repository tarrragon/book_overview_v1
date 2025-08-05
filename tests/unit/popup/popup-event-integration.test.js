/**
 * Popup Event Integration 測試
 * TDD循環 #24: Popup 核心功能
 * 
 * 測試目標：
 * 1. 🔴 測試 PopupEventController 與事件系統整合
 * 2. 🟢 實現 Popup 事件處理器
 * 3. 🔵 重構事件整合
 * 
 * 功能範圍：
 * - PopupEventController 與 EventBus 的整合
 * - EventHandler 基底類別的實現
 * - 事件驅動的狀態更新
 * - Background Script 與 Popup 的通訊
 * - UI 事件的觸發和處理
 */

const PopupEventController = require('../../../src/popup/popup-event-controller');
const EventBus = require('../../../src/core/event-bus');

// 模擬 Chrome Extension APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  }
};

// 模擬 DOM 環境
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Popup Event Integration', () => {
  let eventBus;
  let controller;
  let mockDocument;
  let mockChrome;
  let mockElements;

  beforeEach(() => {
    // 創建模擬的 DOM 元素
    const createMockElement = (id) => ({
      id,
      textContent: '',
      innerHTML: '',
      className: '',
      style: { display: 'block', width: '0%' },
      disabled: false,
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn().mockReturnValue(false)
      },
      addEventListener: jest.fn(),
      querySelector: jest.fn(),
      appendChild: jest.fn()
    });

    mockElements = {
      statusDot: createMockElement('statusDot'),
      statusText: createMockElement('statusText'),
      statusInfo: createMockElement('statusInfo'),
      extensionStatus: createMockElement('extensionStatus'),
      extractBtn: createMockElement('extractBtn'),
      settingsBtn: createMockElement('settingsBtn'),
      helpBtn: createMockElement('helpBtn'),
      pageInfo: createMockElement('pageInfo'),
      bookCount: createMockElement('bookCount'),
      progressContainer: createMockElement('progressContainer'),
      progressBar: { 
        ...createMockElement('progressBar'),
        querySelector: jest.fn().mockReturnValue(createMockElement('progress-fill'))
      },
      progressText: createMockElement('progressText'),
      progressPercentage: createMockElement('progressPercentage'),
      resultsContainer: createMockElement('resultsContainer'),
      extractedBookCount: createMockElement('extractedBookCount'),
      extractionTime: createMockElement('extractionTime'),
      successRate: createMockElement('successRate'),
      exportBtn: createMockElement('exportBtn'),
      viewResultsBtn: createMockElement('viewResultsBtn'),
      errorContainer: createMockElement('errorContainer'),
      errorMessage: createMockElement('errorMessage'),
      retryBtn: createMockElement('retryBtn'),
      reportBtn: createMockElement('reportBtn')
    };

    // 創建模擬的 Document
    mockDocument = {
      getElementById: jest.fn((id) => mockElements[id] || null),
      querySelector: jest.fn(),
      createElement: jest.fn(() => createMockElement('div')),
      addEventListener: jest.fn(),
      visibilityState: 'visible'
    };

    // 創建模擬的 Chrome API
    mockChrome = {
      runtime: {
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
        id: 'test-extension-id'
      },
      tabs: {
        query: jest.fn().mockResolvedValue([{
          id: 1,
          url: 'https://readmoo.com/library',
          active: true
        }]),
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
        create: jest.fn()
      }
    };

    // 創建 EventBus 和 Controller
    eventBus = new EventBus();
    controller = new PopupEventController(eventBus, mockDocument, mockChrome);
  });

  describe('基本事件系統整合 (TDD循環 #24)', () => {
    test('應該能創建 PopupEventController 實例', () => {
      expect(controller).toBeInstanceOf(PopupEventController);
      expect(controller.name).toBe('PopupEventController');
      expect(controller.priority).toBe(1);
      expect(controller.eventBus).toBe(eventBus);
      expect(controller.document).toBe(mockDocument);
      expect(controller.chrome).toBe(mockChrome);
    });

    test('應該能正確初始化 DOM 元素引用', () => {
      expect(controller.elements).toBeDefined();
      expect(controller.elements.statusDot).toBeTruthy();
      expect(controller.elements.statusText).toBeTruthy();
      expect(controller.elements.extractBtn).toBeTruthy();
      expect(controller.elements.progressContainer).toBeTruthy();
    });

    test('應該支援正確的事件類型', () => {
      const supportedEvents = controller.getSupportedEvents();
      expect(supportedEvents).toContain('UI.PROGRESS.UPDATE');
      expect(supportedEvents).toContain('EXTRACTION.COMPLETED');
      expect(supportedEvents).toContain('EXTRACTION.ERROR');
      expect(supportedEvents).toContain('POPUP.STATUS.UPDATE');
    });

    test('應該能與 Background Service Worker 通訊', async () => {
      const result = await controller.checkBackgroundStatus();
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: controller.MESSAGE_TYPES.GET_STATUS
      });
      expect(result).toBe(true);
    });

    test('應該能檢查當前標籤頁狀態', async () => {
      const tab = await controller.checkCurrentTab();
      
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true
      });
      expect(tab).toBeDefined();
      expect(tab.url).toContain('readmoo.com');
    });

    test('應該能處理 Background Service Worker 離線情況', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Service Worker offline'));
      
      const result = await controller.checkBackgroundStatus();
      
      expect(result).toBe(false);
      expect(controller.elements.statusText.textContent).toContain('Service Worker 離線');
    });
  });

  describe('狀態更新事件處理 (TDD循環 #24)', () => {
    test('應該能處理 POPUP.STATUS.UPDATE 事件', async () => {
      const event = {
        type: 'POPUP.STATUS.UPDATE',
        data: {
          status: '測試狀態',
          text: '測試文字',
          info: '測試資訊',
          type: 'ready'
        },
        flowId: 'test-flow-1'
      };

      const result = await controller.process(event);

      expect(result.success).toBe(true);
      expect(controller.elements.statusDot.className).toContain('ready');
      expect(controller.elements.statusText.textContent).toBe('測試文字');
      expect(controller.elements.statusInfo.textContent).toBe('測試資訊');
      expect(controller.elements.extensionStatus.textContent).toBe('測試狀態');
    });

    test('應該能更新狀態顯示', () => {
      controller.updateStatus(
        '測試狀態',
        '測試文字',
        '測試資訊',
        controller.STATUS_TYPES.READY
      );

      expect(controller.elements.statusDot.className).toContain('ready');
      expect(controller.elements.statusText.textContent).toBe('測試文字');
      expect(controller.elements.statusInfo.textContent).toBe('測試資訊');
      expect(controller.elements.extensionStatus.textContent).toBe('測試狀態');
    });

    test('應該能更新按鈕狀態', () => {
      controller.updateButtonState(true, '測試按鈕文字');

      expect(controller.elements.extractBtn.disabled).toBe(true);
      expect(controller.elements.extractBtn.textContent).toBe('測試按鈕文字');
    });

    test('應該能處理不同狀態類型的視覺變化', () => {
      // 測試載入狀態
      controller.updateStatus('載入中', '正在載入', '請稍候', controller.STATUS_TYPES.LOADING);
      expect(controller.elements.statusDot.className).toContain('loading');

      // 測試錯誤狀態
      controller.updateStatus('錯誤', '發生錯誤', '請重試', controller.STATUS_TYPES.ERROR);
      expect(controller.elements.statusDot.className).toContain('error');

      // 測試就緒狀態
      controller.updateStatus('就緒', '準備完成', '可以開始', controller.STATUS_TYPES.READY);
      expect(controller.elements.statusDot.className).toContain('ready');
    });
  });

  describe('進度事件處理 (TDD循環 #24)', () => {
    test('應該能處理 UI.PROGRESS.UPDATE 事件', async () => {
      const event = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 45,
          message: '正在提取書籍資料...'
        },
        flowId: 'test-progress-1'
      };

      const result = await controller.process(event);

      expect(result.success).toBe(true);
      expect(controller.elements.progressContainer.style.display).toBe('block');
      
      const progressFill = controller.elements.progressBar.querySelector('.progress-fill');
      expect(progressFill.style.width).toBe('45%');
      
      expect(controller.elements.progressPercentage.textContent).toBe('45%');
      expect(controller.elements.progressText.textContent).toBe('正在提取書籍資料...');
    });

    test('應該能更新提取進度', () => {
      controller.updateProgress(45, '正在提取書籍資料...');

      expect(controller.elements.progressContainer.style.display).toBe('block');
      
      const progressFill = controller.elements.progressBar.querySelector('.progress-fill');
      expect(progressFill.style.width).toBe('45%');
      
      expect(controller.elements.progressPercentage.textContent).toBe('45%');
      expect(controller.elements.progressText.textContent).toBe('正在提取書籍資料...');
    });

    test('應該能處理進度值的邊界情況', () => {
      // 測試負數進度
      controller.updateProgress(-10, '負數測試');
      const progressFill1 = controller.elements.progressBar.querySelector('.progress-fill');
      expect(progressFill1.style.width).toBe('0%');

      // 測試超過100%的進度
      controller.updateProgress(150, '超範圍測試');
      const progressFill2 = controller.elements.progressBar.querySelector('.progress-fill');
      expect(progressFill2.style.width).toBe('100%');
    });

    test('應該能處理 EXTRACTION.COMPLETED 事件', async () => {
      const event = {
        type: 'EXTRACTION.COMPLETED',
        data: {
          books: new Array(25).fill({}),
          extractionTime: '2分30秒',
          successRate: 95
        },
        flowId: 'test-extraction-completed'
      };

      const result = await controller.process(event);

      expect(result.success).toBe(true);
      expect(controller.elements.resultsContainer.style.display).toBe('block');
      expect(controller.elements.extractedBookCount.textContent).toBe(25);
      expect(controller.elements.extractionTime.textContent).toBe('2分30秒');
      expect(controller.elements.successRate.textContent).toBe('95%');
      
      expect(controller.elements.exportBtn.disabled).toBe(false);
      expect(controller.elements.viewResultsBtn.disabled).toBe(false);
    });

    test('應該能顯示提取結果', () => {
      const results = {
        bookCount: 25,
        extractionTime: '2分30秒',
        successRate: 95
      };

      controller.displayExtractionResults(results);

      expect(controller.elements.resultsContainer.style.display).toBe('block');
      expect(controller.elements.extractedBookCount.textContent).toBe(25);
      expect(controller.elements.extractionTime.textContent).toBe('2分30秒');
      expect(controller.elements.successRate.textContent).toBe('95%');
      
      expect(controller.elements.exportBtn.disabled).toBe(false);
      expect(controller.elements.viewResultsBtn.disabled).toBe(false);
    });
  });

  describe('錯誤處理事件 (TDD循環 #24)', () => {
    test('應該能處理 EXTRACTION.ERROR 事件', async () => {
      const event = {
        type: 'EXTRACTION.ERROR',
        data: {
          message: '提取過程中發生網路錯誤',
          error: new Error('網路連線中斷')
        },
        flowId: 'test-error-1'
      };

      const result = await controller.process(event);

      expect(result.success).toBe(true);
      expect(controller.extractionInProgress).toBe(false);
      expect(controller.elements.errorContainer.style.display).toBe('block');
      expect(controller.elements.errorMessage.textContent).toBe('提取過程中發生網路錯誤');
    });

    test('應該能處理提取錯誤', () => {
      const errorMessage = '提取過程中發生網路錯誤';
      
      controller.handleExtractionErrorUI(errorMessage);

      expect(controller.elements.errorContainer.style.display).toBe('block');
      expect(controller.elements.errorMessage.textContent).toBe(errorMessage);
      expect(controller.elements.progressContainer.style.display).toBe('none');
      expect(controller.elements.extractBtn.disabled).toBe(false);
    });

    test('應該能處理未知錯誤', () => {
      controller.handleExtractionErrorUI();

      expect(controller.elements.errorMessage.textContent).toBe('發生未知錯誤');
    });
  });

  describe('提取操作事件流程 (TDD循環 #24)', () => {
    test('應該能啟動完整的提取流程', async () => {
      // 模擬成功的提取回應
      mockChrome.tabs.sendMessage.mockResolvedValue({
        success: true,
        message: '提取完成',
        booksDetected: 42
      });

      await controller.startExtraction();

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        { type: controller.MESSAGE_TYPES.START_EXTRACTION }
      );
      
      // 提取開始後應該設為進行中
      expect(controller.extractionInProgress).toBe(true);
    });

    test('應該能處理提取失敗', async () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({
        success: false,
        error: '無法找到書籍元素'
      });

      await expect(controller.startExtraction()).rejects.toThrow('無法找到書籍元素');
      expect(controller.extractionInProgress).toBe(false);
    });

    test('應該能處理通訊錯誤', async () => {
      // 模擬 Content Script 通訊失敗
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Content script not responding'));
      
      // 呼叫 checkCurrentTab 會將 contentScriptReady 設為 false
      await controller.checkCurrentTab();
      
      expect(controller.contentScriptReady).toBe(false);
      
      await expect(controller.startExtraction()).rejects.toThrow('頁面或 Content Script 未就緒');
      expect(controller.extractionInProgress).toBe(false);
    });
  });

  describe('事件監聽器設定 (TDD循環 #24)', () => {
    test('應該能設定事件監聽器', () => {
      // 驗證主要按鈕的事件監聽器設定
      expect(controller.elements.extractBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(controller.elements.settingsBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(controller.elements.helpBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('應該能處理設定按鈕點擊', () => {
      controller.handleSettingsClick();
      
      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'chrome://extensions/?id=' + mockChrome.runtime.id
      });
    });

    test('應該能處理說明按鈕點擊', () => {
      // 模擬 alert
      global.alert = jest.fn();
      
      controller.handleHelpClick();
      
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('使用說明'));
    });
  });

  describe('頁面識別和驗證 (TDD循環 #24)', () => {
    test('應該能識別 Readmoo 頁面', async () => {
      const tab = await controller.checkCurrentTab();
      
      expect(controller.elements.pageInfo.textContent).toContain('Readmoo');
      expect(tab.url).toContain('readmoo.com');
    });

    test('應該能處理非 Readmoo 頁面', async () => {
      mockChrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://google.com',
        active: true
      }]);

      await controller.checkCurrentTab();

      expect(controller.elements.pageInfo.textContent).toBe('非 Readmoo 頁面');
      expect(controller.elements.extractBtn.disabled).toBe(true);
    });

    test('應該能處理無效標籤頁', async () => {
      mockChrome.tabs.query.mockResolvedValue([]);

      const result = await controller.checkCurrentTab();

      expect(result).toBeNull();
      expect(controller.elements.statusDot.className).toContain('error');
    });
  });

  describe('Content Script 通訊 (TDD循環 #24)', () => {
    test('應該能檢測 Content Script 狀態', async () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });

      await controller.checkCurrentTab();

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        { type: controller.MESSAGE_TYPES.PING }
      );
      expect(controller.elements.statusText.textContent).toBe('Content Script 連線正常');
    });

    test('應該能處理 Content Script 未就緒', async () => {
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('No response'));

      await controller.checkCurrentTab();

      expect(controller.elements.statusText.textContent).toContain('載入中');
    });
  });

  describe('EventHandler 基底類別整合 (TDD循環 #24)', () => {
    test('應該正確實現 EventHandler 抽象方法', () => {
      expect(typeof controller.process).toBe('function');
      expect(typeof controller.getSupportedEvents).toBe('function');
      expect(controller.getSupportedEvents()).toContain('UI.PROGRESS.UPDATE');
    });

    test('應該能維持進度狀態', () => {
      // 模擬提取開始
      controller.updateProgress(30, '提取中...');
      
      expect(controller.elements.progressContainer.style.display).toBe('block');
      
      // 模擬頁面重新載入後恢復狀態
      expect(controller.elements.progressText.textContent).toBe('提取中...');
    });

    test('應該能清理完成後的狀態', () => {
      // 顯示進度
      controller.updateProgress(100, '完成');
      
      // 顯示結果
      controller.displayExtractionResults({ bookCount: 10 });
      
      expect(controller.elements.resultsContainer.style.display).toBe('block');
    });

    test('應該支援啟用/停用功能', async () => {
      controller.setEnabled(false);
      
      const event = {
        type: 'UI.PROGRESS.UPDATE',
        data: { percentage: 50, message: '測試' },
        flowId: 'test-disabled'
      };

      const result = await controller.handle(event);
      expect(result).toBeNull(); // 停用時應該返回 null
    });

    test('應該追蹤執行統計', async () => {
      const initialStats = controller.getStats();
      const initialCount = initialStats.executionCount;

      const event = {
        type: 'UI.PROGRESS.UPDATE',
        data: { percentage: 25, message: '統計測試' },
        flowId: 'test-stats'
      };

      await controller.handle(event);

      const updatedStats = controller.getStats();
      expect(updatedStats.executionCount).toBe(initialCount + 1);
    });
  });
});