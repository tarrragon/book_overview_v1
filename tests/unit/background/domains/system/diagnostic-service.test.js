/**
 * @fileoverview Diagnostic Service 單元測試
 *
 * 對應 domain-map 不變式：診斷報告包含所有必要系統資訊（版本、配置、模組狀態）。
 *
 * 「診斷報告」對應本服務兩個公開方法的組合：
 * - generateDiagnosticReport()：含 systemInfo.extensions.version（版本）與統計摘要
 * - getStatus()：含 config（配置）與 initialized/active/collecting（模組狀態）
 */

const DiagnosticService = require('src/background/domains/system/services/diagnostic-service.js')

describe('DiagnosticService', () => {
  let service
  let mockLogger
  let mockEventBus

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(true),
      on: jest.fn().mockResolvedValue('listener-id'),
      off: jest.fn().mockResolvedValue(true)
    }

    chrome.runtime.getManifest.mockReturnValue({ version: '1.6.1' })
    chrome.storage.local.getBytesInUse.mockResolvedValue(1024)

    service = new DiagnosticService({ logger: mockLogger, eventBus: mockEventBus })
  })

  describe('診斷報告包含所有必要系統資訊（版本、配置、模組狀態）', () => {
    test('generateDiagnosticReport 應包含擴充套件版本資訊', async () => {
      await service.initialize()

      const report = await service.generateDiagnosticReport()

      expect(report.systemInfo.extensions.version).toBe('1.6.1')
    })

    test('getStatus 應包含目前配置與模組狀態', async () => {
      await service.initialize()
      await service.start()

      const status = service.getStatus()

      expect(status.config).toEqual(service.config)
      expect(status).toMatchObject({
        initialized: true,
        active: true,
        collecting: true
      })
    })

    test('generateDiagnosticReport 摘要應反映已收集的日誌數量', async () => {
      await service.initialize()
      service.state.collecting = true
      service.recordLogEntry('error', '測試錯誤')

      const report = await service.generateDiagnosticReport()

      expect(report.summary.totalLogs).toBe(1)
      expect(report.summary.errorCount).toBe(1)
    })
  })
})
